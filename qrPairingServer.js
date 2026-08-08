// ══════════════════════════════════════════════════════════════════════
// qrPairingServer.js — Cambio 01 (Escaneo de Documentos Físicos vía QR)
//
// Levanta un servidor HTTPS local (solo en la IP de la red LAN, nunca en
// 0.0.0.0) + un WebSocket sobre esa misma conexión, para que el teléfono:
//   1) Se empareje escaneando el QR de vinculación (token de un solo uso,
//      expira a los 10 minutos si no se usa).
//   2) Reciba el catálogo de proveedores y de clientes de la empresa activa.
//   3) Envíe de vuelta el documento escaneado (QR del DTE + proveedor/cliente
//      elegido/nuevo + libro destino: 'compras', 'cf' o 'ccf') para que
//      FiscalSync dispare la consulta pública y guarde el registro
//      automáticamente en Compras, Consumidor Final o Crédito Fiscal.
//
// Este módulo NO conoce nada de Electron, IPC, ni del catálogo real de
// proveedores — solo orquesta la conexión y expone un EventEmitter para
// que main.js reaccione. Toda la lógica de negocio (guardar proveedor,
// consultar DGII, autocompletar el formulario) vive fuera de este archivo.
//
// Requiere los paquetes 'ws', 'qrcode' y 'selfsigned' (via certGen.js).
//   npm install ws qrcode selfsigned
// ══════════════════════════════════════════════════════════════════════

const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const certGen = require('./certGen');

const PHONE_APP_DIR = path.join(__dirname, 'phone-app');
const PAIRING_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutos para escanear el QR de vinculación
const AUTH_TIMEOUT_MS = 15 * 1000; // el teléfono tiene 15s tras conectar el WS para autenticarse

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

// Único evento público de este módulo: eventos.emit(...)
const eventos = new EventEmitter();

let _httpsServer = null;
let _wss = null;
let _token = null;
let _pairingExpiresAt = 0;
let _pareado = false; // true una vez que el teléfono se autenticó al menos una vez
let _phoneSocket = null; // socket activo del teléfono (uno solo a la vez)
let _empresaNombre = '';
let _proveedoresCache = [];
let _clientesCache = []; // catálogo de clientes (usado por el flujo de Ventas — Crédito Fiscal)
let _clasifLabelsCache = {}; // mapa v->l de la clasificación de proveedores (config. de la empresa activa), solo para mostrarla en el teléfono
// Cambio 01 (ampliación): mapas v->l de Sector y Tipo de Costo/Gasto de proveedores —
// mismo propósito que _clasifLabelsCache (solo para mostrar/editar en el teléfono con
// el mismo texto que usa el programa), y mismo patrón de cacheo.
let _sectorLabelsCache = {};
let _costoLabelsCache = {};

function estaCorriendo() {
  return !!_httpsServer;
}

// Elige la IP de LAN más apropiada para escuchar (prefiere rangos privados típicos).
function elegirIpLan() {
  const ips = certGen.listarIPsLocales();
  if (!ips.length) return null;
  const privadas = ips.filter(function (ip) {
    return /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  });
  return (privadas[0] || ips[0]);
}

// Comparación en tiempo constante — evita filtrar por timing cuánto del token coincide.
function _compararTokenSeguro(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  try { return crypto.timingSafeEqual(bufA, bufB); } catch (e) { return false; }
}

function normalizarTexto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Validación defensiva del lado del servidor (además de la validación de
// dominio que ya hace el teléfono en el cliente): formato de codGen (UUID),
// fechaEmi (YYYY-MM-DD) y ambiente (00, 01, o vacío/"null"/"undefined" —
// ver nota abajo).
function qrEsValido(qr) {
  if (!qr) return false;
  const codGenOk = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(String(qr.codGen || ''));
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(String(qr.fechaEmi || ''));
  // CAMBIO — Compatibilidad con QR de consulta pública que traen
  // ambiente=null (u otra variante equivalente: vacío, "undefined"). La
  // identificación del DTE depende de codGen + fechaEmi (ya validados
  // arriba); 'ambiente' es informativo y no debe por sí solo invalidar un
  // QR legítimo. Se sigue exigiendo que, SI viene con un valor real, sea
  // uno de los dos válidos ('00' o '01') — esto no afloja la validación
  // para datos corruptos, solo para las variantes de "sin valor".
  const ambienteStr = String(qr.ambiente || '').trim().toLowerCase();
  const ambienteVacio = (ambienteStr === '' || ambienteStr === 'null' || ambienteStr === 'undefined');
  const ambienteOk = ambienteVacio || ['00', '01'].indexOf(ambienteStr) !== -1;
  return codGenOk && fechaOk && ambienteOk;
}

function servirEstatico(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'https://local').pathname);
  } catch (e) {
    pathname = '/';
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(PHONE_APP_DIR, pathname));
  // Protección contra path traversal — el archivo resuelto debe seguir dentro de phone-app/
  if (filePath.indexOf(PHONE_APP_DIR) !== 0) {
    res.writeHead(403);
    res.end('Prohibido');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function enviarAlTelefono(mensaje) {
  if (_phoneSocket && _phoneSocket.readyState === 1 /* OPEN */) {
    try {
      _phoneSocket.send(JSON.stringify(mensaje));
    } catch (e) {
      // conexión ya caída — se ignora, el teléfono deberá reconectar
    }
  }
}

function manejarConexionWs(ws) {
  let autenticado = false;

  const timeoutAuth = setTimeout(function () {
    if (!autenticado) {
      try { ws.close(4000, 'Tiempo de espera de autenticación agotado'); } catch (e) { /* noop */ }
    }
  }, AUTH_TIMEOUT_MS);

  ws.on('message', function (raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.tipo === 'auth') {
      const tokenValido = _compararTokenSeguro(msg.token, _token);
      const dentroDePlazo = _pareado || (Date.now() <= _pairingExpiresAt);
      if (!tokenValido) {
        try { ws.close(4001, 'Token inválido'); } catch (e) { /* noop */ }
        return;
      }
      if (!dentroDePlazo) {
        try { ws.close(4002, 'El QR de vinculación expiró — cierra y vuelve a abrir el módulo'); } catch (e) { /* noop */ }
        return;
      }
      autenticado = true;
      _pareado = true;
      clearTimeout(timeoutAuth);
      // Si había otro teléfono conectado antes, se reemplaza (un solo dispositivo a la vez)
      if (_phoneSocket && _phoneSocket !== ws) {
        try { _phoneSocket.close(4003, 'Se conectó otro dispositivo'); } catch (e) { /* noop */ }
      }
      _phoneSocket = ws;
      enviarAlTelefono({ tipo: 'auth-ok' });
      enviarAlTelefono({
        tipo: 'catalogo-proveedores',
        empresa: _empresaNombre,
        proveedores: _proveedoresCache,
        clasifLabels: _clasifLabelsCache,
        sectorLabels: _sectorLabelsCache,
        costoLabels: _costoLabelsCache
      });
      enviarAlTelefono({ tipo: 'catalogo-clientes', clientes: _clientesCache });
      eventos.emit('conexion', { conectado: true });
      return;
    }

    if (!autenticado) return; // ignora cualquier otro mensaje antes de autenticarse

    if (msg.tipo === 'documento-escaneado') {
      if (!qrEsValido(msg.qr)) {
        enviarAlTelefono({ tipo: 'resultado-documento', ok: false, mensaje: 'El código QR no tiene el formato esperado de un DTE.' });
        return;
      }
      enviarAlTelefono({ tipo: 'recibido' });
      const proveedor = msg.proveedor || null;
      const cliente = msg.cliente || null;
      // Si el proveedor/cliente viene marcado como nuevo, se emite también un
      // evento aparte para que main.js lo reenvíe al renderer y lo registre en
      // el catálogo real (autoRegistrarProveedor / autoRegistrarCliente) — el
      // identificador es el NIT, NRC o DUI (no un id sintético), así que no
      // hace falta ningún viaje de vuelta.
      // CORRECCIÓN: antes se exigía proveedor.nit sí o sí, así que un
      // Sujeto Excluido creado en el teléfono con solo DUI o solo NRC
      // (permitido desde el cambio de validación de Sujeto Excluido) nunca
      // emitía este evento — el proveedor quedaba elegido para el documento
      // escaneado, pero jamás se registraba en el catálogo de la PC. Ahora
      // basta con que tenga NIT, DUI o NRC, igual que la validación del
      // formulario "Proveedor nuevo" del teléfono.
      if (proveedor && proveedor.esNuevo && (proveedor.nit || proveedor.dui || proveedor.nrc)) {
        eventos.emit('proveedor-nuevo', proveedor);
      }
      if (cliente && cliente.esNuevo && cliente.nit) {
        eventos.emit('cliente-nuevo', cliente);
      }
      // 'compras' (default, requiere proveedor), 'cf' (Consumidor Final — no
      // requiere cliente, pero sí si la venta es exenta o no), 'ccf' (Ventas
      // — Crédito Fiscal — requiere cliente Y si la venta es exenta o no),
      // 'retencion' (Comprobantes de Retención — Anexo 7, no requiere
      // proveedor/cliente ni exenta, solo el QR del documento) o 'excluido'
      // (Compras a Sujeto Excluido — Anexo 5, reutiliza el mismo catálogo de
      // Proveedores que 'compras' para identificar al Sujeto Excluido, ya
      // que la consulta pública de Hacienda no expone su NIT/DUI ni nombre).
      let libro = 'compras';
      if (msg.libro === 'cf') libro = 'cf';
      else if (msg.libro === 'ccf') libro = 'ccf';
      else if (msg.libro === 'retencion') libro = 'retencion';
      else if (msg.libro === 'excluido') libro = 'excluido';

      eventos.emit('documento-escaneado', {
        qr: {
          ambiente: String(msg.qr.ambiente),
          codGen: String(msg.qr.codGen),
          fechaEmi: String(msg.qr.fechaEmi)
        },
        proveedor: proveedor,
        cliente: cliente,
        libro: libro,
        exenta: !!msg.exenta
      });
      return;
    }

    // Cambio 01 (ampliación): edición de un proveedor YA EXISTENTE en el catálogo,
    // hecha desde el teléfono. No toca nada del flujo de escaneo — es un mensaje
    // aparte que main.js reenvía al renderer para que actualice fiscaldata.json
    // con la MISMA estructura que usa el catálogo de Proveedores del escritorio
    // (ver autoRegistrarProveedor / saveProveedorRecord en index.html).
    // 'nitOriginal' identifica al proveedor a modificar (puede diferir de 'nit'
    // si el usuario también corrigió el NIT durante la edición).
    if (msg.tipo === 'proveedor-editado') {
      const prov = msg.proveedor || null;
      const nitOriginal = prov && (prov.nitOriginal || prov.nit);
      if (!prov || !nitOriginal) return; // datos insuficientes — se ignora en silencio
      eventos.emit('proveedor-editado', {
        nitOriginal: String(nitOriginal),
        nit: String(prov.nit || ''),
        nrc: String(prov.nrc || ''),
        dui: String(prov.dui || ''),
        nombre: String(prov.nombre || ''),
        clasif: String(prov.clasif || ''),
        sector: String(prov.sector || ''),
        tipoCosto: String(prov.tipoCosto || '')
      });
      return;
    }

    // Cambio 01 (ampliación): edición de un cliente YA EXISTENTE en el catálogo
    // (flujo Ventas — Crédito Fiscal), hecha desde el teléfono. Mismo patrón que
    // 'proveedor-editado' — no toca nada del flujo de escaneo.
    // 'nitOriginal' identifica al cliente a modificar (puede diferir de 'nit'
    // si el usuario también corrigió el NIT durante la edición).
    if (msg.tipo === 'cliente-editado') {
      const cli = msg.cliente || null;
      const nitOriginalCli = cli && (cli.nitOriginal || cli.nit);
      if (!cli || !nitOriginalCli) return; // datos insuficientes — se ignora en silencio
      eventos.emit('cliente-editado', {
        nitOriginal: String(nitOriginalCli),
        nit: String(cli.nit || ''),
        nrc: String(cli.nrc || ''),
        nombre: String(cli.nombre || ''),
        tipoOp: String(cli.tipoOp || ''),
        tipoIng: String(cli.tipoIng || '')
      });
      return;
    }
  });

  ws.on('close', function () {
    clearTimeout(timeoutAuth);
    if (_phoneSocket === ws) {
      _phoneSocket = null;
      eventos.emit('conexion', { conectado: false });
    }
  });

  ws.on('error', function () {
    // el 'close' se dispara igual después de un error — no hace falta manejar aparte
  });
}

// Inicia el módulo. params: { app, proveedores: [...], empresaNombre: string }
// Devuelve { ok, qrDataUrl, ip, port, error }
async function iniciar(params) {
  const app = params && params.app;
  if (!app) return { ok: false, error: 'Falta la referencia de la app de Electron' };

  let QRCode, WebSocketServer;
  try {
    QRCode = require('qrcode');
    WebSocketServer = require('ws').Server;
  } catch (e) {
    return { ok: false, error: 'Faltan dependencias. Ejecuta: npm install ws qrcode selfsigned en la carpeta del proyecto. (' + e.message + ')' };
  }

  // Si ya había un módulo corriendo (ej. el usuario cerró y reabrió rápido), se detiene primero
  if (estaCorriendo()) await detener();

  const ip = elegirIpLan();
  if (!ip) return { ok: false, error: 'No se detectó ninguna red LAN activa en este equipo.' };

  let certData;
  try {
    certData = await certGen.obtenerCertificado(app);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  _empresaNombre = (params.empresaNombre || '').toString();
  _proveedoresCache = Array.isArray(params.proveedores) ? params.proveedores : [];
  _clientesCache = Array.isArray(params.clientes) ? params.clientes : [];
  _clasifLabelsCache = (params.clasifLabels && typeof params.clasifLabels === 'object') ? params.clasifLabels : {};
  _sectorLabelsCache = (params.sectorLabels && typeof params.sectorLabels === 'object') ? params.sectorLabels : {};
  _costoLabelsCache = (params.costoLabels && typeof params.costoLabels === 'object') ? params.costoLabels : {};
  _token = crypto.randomBytes(24).toString('hex');
  _pairingExpiresAt = Date.now() + PAIRING_TOKEN_TTL_MS;
  _pareado = false;
  _phoneSocket = null;

  return await new Promise(function (resolve) {
    const server = https.createServer({ cert: certData.cert, key: certData.key }, servirEstatico);

    server.on('error', function (err) {
      resolve({ ok: false, error: 'No se pudo iniciar el servidor local: ' + err.message });
    });

    server.listen(0, ip, async function () {
      const port = server.address().port;
      _httpsServer = server;

      _wss = new WebSocketServer({ server: server, path: '/ws' });
      _wss.on('connection', manejarConexionWs);

      const pairingUrl = 'https://' + ip + ':' + port + '/?t=' + _token;

      try {
        const qrDataUrl = await QRCode.toDataURL(pairingUrl, { margin: 1, scale: 6 });
        resolve({ ok: true, qrDataUrl: qrDataUrl, pairingUrl: pairingUrl, ip: ip, port: port });
      } catch (e) {
        resolve({ ok: false, error: 'No se pudo generar la imagen QR: ' + e.message });
      }
    });
  });
}

// Envía al teléfono el resultado final (ya combinado con la consulta DGII) de un documento
function enviarResultadoDocumento(resultado) {
  enviarAlTelefono(Object.assign({ tipo: 'resultado-documento' }, resultado));
}

// Refresca el catálogo de proveedores que se le manda al teléfono (ej. si el usuario
// agrega proveedores manualmente en el desktop mientras el módulo sigue abierto)
function actualizarCatalogo(proveedores) {
  _proveedoresCache = Array.isArray(proveedores) ? proveedores : [];
  enviarAlTelefono({
    tipo: 'catalogo-proveedores',
    empresa: _empresaNombre,
    proveedores: _proveedoresCache,
    clasifLabels: _clasifLabelsCache,
    sectorLabels: _sectorLabelsCache,
    costoLabels: _costoLabelsCache
  });
}

// Refresca el catálogo de clientes que se le manda al teléfono (usado por el
// flujo de Ventas — Crédito Fiscal). Mismo patrón que actualizarCatalogo().
function actualizarClientes(clientes) {
  _clientesCache = Array.isArray(clientes) ? clientes : [];
  enviarAlTelefono({ tipo: 'catalogo-clientes', clientes: _clientesCache });
}

// CAMBIO — Actualización dinámica de empresa: se llama cuando el usuario
// cambia de empresa activa en el escritorio (o entra/vuelve a una) mientras
// el módulo de escaneo sigue abierto/minimizado, para que el teléfono se
// entere SIN necesidad de cerrar y volver a abrir el módulo.
// params: { empresaNombre, proveedores, clientes, clasifLabels, sectorLabels, costoLabels }
// Reemplaza TODA la caché en memoria de este módulo (igual que iniciar()),
// así que a partir de este llamado ninguna referencia — nombre, catálogo,
// clasificaciones — sigue perteneciendo a la empresa anterior.
function actualizarEmpresaActiva(params) {
  params = params || {};
  _empresaNombre = (params.empresaNombre || '').toString();
  _proveedoresCache = Array.isArray(params.proveedores) ? params.proveedores : [];
  _clientesCache = Array.isArray(params.clientes) ? params.clientes : [];
  _clasifLabelsCache = (params.clasifLabels && typeof params.clasifLabels === 'object') ? params.clasifLabels : {};
  _sectorLabelsCache = (params.sectorLabels && typeof params.sectorLabels === 'object') ? params.sectorLabels : {};
  _costoLabelsCache = (params.costoLabels && typeof params.costoLabels === 'object') ? params.costoLabels : {};
  enviarAlTelefono({
    tipo: 'catalogo-proveedores',
    empresa: _empresaNombre,
    proveedores: _proveedoresCache,
    clasifLabels: _clasifLabelsCache,
    sectorLabels: _sectorLabelsCache,
    costoLabels: _costoLabelsCache
  });
  enviarAlTelefono({ tipo: 'catalogo-clientes', clientes: _clientesCache });
  return { ok: true };
}

async function detener() {
  return await new Promise(function (resolve) {
    if (_phoneSocket) {
      try { _phoneSocket.close(1000, 'Módulo cerrado'); } catch (e) { /* noop */ }
      _phoneSocket = null;
    }
    if (_wss) {
      try { _wss.close(); } catch (e) { /* noop */ }
      _wss = null;
    }
    if (_httpsServer) {
      _httpsServer.close(function () {
        _httpsServer = null;
        resolve({ ok: true });
      });
      // por si el server nunca dispara el callback de close (sockets colgados)
      setTimeout(function () { _httpsServer = null; resolve({ ok: true }); }, 2000);
    } else {
      resolve({ ok: true });
    }
  });
}

module.exports = {
  eventos: eventos,
  iniciar: iniciar,
  detener: detener,
  estaCorriendo: estaCorriendo,
  enviarResultadoDocumento: enviarResultadoDocumento,
  actualizarCatalogo: actualizarCatalogo,
  actualizarClientes: actualizarClientes,
  actualizarEmpresaActiva: actualizarEmpresaActiva
};
