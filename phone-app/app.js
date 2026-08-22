// ══════════════════════════════════════════════════════════════════════
// app.js — Página servida al teléfono
// Cambio 03 (Gestión del documento trasladada a la computadora): el
// teléfono dejó de ser una app de gestión — ya NO elige tipo de documento,
// no busca/agrega/edita proveedor ni cliente, no decide si una venta es
// "exenta" y no tiene botón de "Confirmar". Ahora es ÚNICAMENTE un lector
// remoto de códigos QR conectado a FiscalSync:
//
//   Abrir cámara → Escanear QR → Enviar el QR a la computadora.
//
// Todo lo demás (mostrar el documento, seleccionar/agregar proveedor o
// cliente, validar y confirmar, y registrarlo en el anexo correspondiente)
// vive ahora en FiscalSync (ver index.html). Sin dependencias externas
// salvo jsqr.min.js (vendorizado, 100% offline).
// ══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var HOST_VALIDO = 'admin.factura.gob.sv';

  var els = {
    connDot: document.getElementById('connDot'),
    connSub: document.getElementById('connSub'),
    connTitle: document.getElementById('connTitle'),
    connHint: document.getElementById('connHint'),
    screenConnecting: document.getElementById('screenConnecting'),
    screenReady: document.getElementById('screenReady'),
    screenCamera: document.getElementById('screenCamera'),
    screenEnviando: document.getElementById('screenEnviando'),
    screenResultado: document.getElementById('screenResultado'),
    screenResumen: document.getElementById('screenResumen'),
    empresaBar: document.getElementById('empresaBar'),
    empresaBarNombre: document.getElementById('empresaBarNombre'),
    // La pantalla "Listo" y la cámara solo muestran qué tipo de documento
    // ordenó la computadora — nunca lo elige el teléfono.
    libroOrdenadoTxt: document.getElementById('libroOrdenadoTxt'),
    camaraLibroLabel: document.getElementById('camaraLibroLabel'),
    btnCancelarCamara: document.getElementById('btnCancelarCamara'),
    btnSeguirEscaneando: document.getElementById('btnSeguirEscaneando'),
    video: document.getElementById('video'),
    resTitulo: document.getElementById('resTitulo'),
    resMensaje: document.getElementById('resMensaje'),
    toast: document.getElementById('toast')
  };

  // Cambio 05 (Resumen de Escaneo en el teléfono): cuando Admin tiene
  // configurado "Resumen en celular", el teléfono SÍ necesita el mismo
  // catálogo de proveedores/clientes que ya usa la computadora, para
  // poder buscar/elegir uno al completar el resumen — la PC ya lo estaba
  // mandando en 'catalogo-proveedores'/'catalogo-clientes' (quedó del
  // Cambio 01), solo que antes el teléfono lo ignoraba (Cambio 03). No
  // hace falta tocar nada del lado del servidor.
  var proveedoresCache = [];
  var clientesCache = [];
  var clasifLabelsCache = {};
  var sectorLabelsCache = {};
  var costoLabelsCache = {};

  // Cambio 05: catálogo estático CAT-002 de tipos de documento por libro,
  // idéntico (mismos códigos/etiquetas) al QRDOC_LIBRO_INFO que usa
  // openQrDocModal() en index.html, para pintar el mismo formulario de
  // Resumen. No se manda por la red: es fijo, igual que LIBRO_LABELS.
  var QRDOC_LIBRO_INFO = {
    compras: {
      titulo: 'Compras — Documento Escaneado', anexo: 'Libro de Compras (Anexo 3)',
      esCliente: false, sinProveedor: false, sinTipoDoc: false, uso: 'compras',
      montoLabel: 'Monto (Compras Gravadas)', tipoDocDefault: '03',
      tiposDoc: [
        ['03', '03 — Comprobante de Crédito Fiscal'],
        ['05', '05 — Nota de Crédito'],
        ['06', '06 — Nota de Débito'],
        ['11', '11 — Factura de Exportación'],
        ['12', '12 — Declaración de Mercancías'],
        ['13', '13 — Mandamiento de Ingreso']
      ]
    },
    cf: {
      titulo: 'Consumidor Final — Documento Escaneado', anexo: 'Ventas — Consumidor Final (Anexo 2)',
      esCliente: false, sinProveedor: true, sinTipoDoc: false, uso: null,
      montoLabel: 'Monto (Ventas)', tipoDocDefault: '01',
      tiposDoc: [
        ['01', '01 — Factura'],
        ['02', '02 — Factura de Venta Simplificada'],
        ['10', '10 — Tiquete de Máquina Registradora'],
        ['11', '11 — Factura de Exportación'],
        ['05', '05 — Nota de Crédito'],
        ['06', '06 — Nota de Débito']
      ]
    },
    ccf: {
      titulo: 'Crédito Fiscal — Documento Escaneado', anexo: 'Ventas — Crédito Fiscal (Anexo 1)',
      esCliente: true, sinProveedor: false, sinTipoDoc: false, uso: null,
      montoLabel: 'Monto (Ventas Gravadas)', tipoDocDefault: '03',
      tiposDoc: [
        ['03', '03 — Comprobante de Crédito Fiscal'],
        ['05', '05 — Nota de Crédito'],
        ['06', '06 — Nota de Débito']
      ]
    },
    retencion: {
      titulo: 'Retención IVA — Documento Escaneado', anexo: 'Comprobantes de Retención (Anexo 7)',
      esCliente: false, sinProveedor: false, sinTipoDoc: false, uso: 'retenido',
      montoLabel: 'Monto Sujeto a Retención', tipoDocDefault: '07',
      tiposDoc: [
        ['07', '07 — Comprobante de Retención'],
        ['05', '05 — Nota de Crédito'],
        ['06', '06 — Nota de Débito']
      ]
    },
    excluido: {
      titulo: 'Sujeto Excluido — Documento Escaneado', anexo: 'Compras a Sujeto Excluido (Anexo 5)',
      esCliente: false, sinProveedor: false, sinTipoDoc: false, uso: 'excluido',
      montoLabel: 'Monto de la Operación', tipoDocDefault: '14',
      tiposDoc: [
        ['14', '14 — Factura de Sujeto Excluido'],
        ['05', '05 — Nota de Crédito'],
        ['06', '06 — Nota de Débito']
      ]
    }
  };

  var CLASIF_OPCIONES = [['1', 'Costo'], ['2', 'Gasto'], ['3', 'Activo Fijo']];
  var SECTOR_OPCIONES = [['1', 'Sector Público'], ['2', 'Sector Privado']];
  var COSTO_OPCIONES = [['1', 'Costos'], ['2', 'Gastos de Administración'], ['3', 'Gastos de Venta'], ['4', 'Gastos Financieros'], ['5', 'Otros']];
  var TIPODOCEX_OPCIONES = [['1', 'NIT'], ['2', 'DUI'], ['3', 'Otro']];
  var TIPOOPEX_OPCIONES = [['1', 'Gravada'], ['2', 'Exenta'], ['3', 'No Sujeta']];

  // Estado de la pantalla de Resumen actualmente abierta.
  var resumenState = { libro: null, combinado: null, sel: null };
  var _rsResultados = []; // últimos resultados de búsqueda de proveedor/cliente (para _rsSeleccionar por índice)

  var ws = null;
  var empresaNombre = '';

  var modoActual = 'compras';  // 'compras' | 'cf' | 'ccf' | 'retencion' | 'excluido' — libro que ordenó la PC
  var streamCamara = null;
  var loopId = null;
  var reconectando = false;
  // El botón "Seguir Escaneando" solo debe aparecer una vez que la
  // computadora ya ordenó al menos un escaneo (para saber qué tipo de
  // documento reabrir) — no antes.
  var escaneoIniciadoAlgunaVez = false;

  // Cambio 01: etiquetas de cada tipo de documento, solo para que el
  // teléfono MUESTRE (nunca elija) qué está escaneando por orden de la
  // computadora — misma nomenclatura que usa FiscalSync.
  var LIBRO_LABELS = {
    compras: 'Compras',
    cf: 'Venta — Consumidor Final',
    ccf: 'Venta — Crédito Fiscal',
    retencion: 'Comprobante de Retención',
    excluido: 'Compra a Sujeto Excluido'
  };

  function actualizarLibroActualUI() {
    var etiqueta = LIBRO_LABELS[modoActual] || '';
    if (els.libroOrdenadoTxt) {
      els.libroOrdenadoTxt.textContent = etiqueta ? ('Escaneando: ' + etiqueta) : '';
    }
    if (els.camaraLibroLabel) {
      els.camaraLibroLabel.textContent = etiqueta ? ('Escaneando: ' + etiqueta) : '';
    }
    if (els.btnSeguirEscaneando) {
      els.btnSeguirEscaneando.classList.toggle('hidden', !escaneoIniciadoAlgunaVez);
    }
  }

  // Punto 3 (se mantiene): refleja la empresa activa en la barra
  // persistente del header, visible en todas las pantallas, para evitar
  // escanear para la empresa incorrecta.
  function actualizarEmpresaActiva() {
    if (!els.empresaBar || !els.empresaBarNombre) return;
    if (empresaNombre) {
      els.empresaBarNombre.textContent = empresaNombre;
      els.empresaBar.classList.remove('hidden');
    } else {
      els.empresaBar.classList.add('hidden');
    }
  }

  function showToast(msg, tipo) {
    els.toast.textContent = msg;
    els.toast.className = 'toast show' + (tipo ? ' ' + tipo : '');
    setTimeout(function () { els.toast.className = 'toast'; }, 3200);
  }

  function mostrarPantalla(id) {
    ['screenConnecting', 'screenReady', 'screenCamera', 'screenEnviando', 'screenResultado', 'screenResumen']
      .forEach(function (key) {
        els[key].classList.toggle('hidden', key !== id);
      });
  }

  // Pantalla "Sin Empresa Activa" (reutiliza screenConnecting + los textos
  // de connTitle/connHint) — se muestra tanto al conectar sin ninguna
  // empresa activa en el escritorio como al cambiar a "ninguna empresa".
  function _mostrarSinEmpresaActiva() {
    mostrarPantalla('screenConnecting');
    els.connTitle.textContent = 'Sin empresa activa';
    els.connHint.textContent = 'Selecciona una empresa en FiscalSync para poder escanear documentos.';
  }

  // ── Conexión WebSocket ──────────────────────────────────────────────
  var catalogoInicialRecibido = false; // primera llegada de 'catalogo-proveedores' tras conectar (ver manejarMensaje)

  function obtenerToken() {
    var params = new URLSearchParams(location.search);
    return params.get('t') || '';
  }

  function conectar() {
    var token = obtenerToken();
    if (!token) {
      els.connTitle.textContent = 'Enlace inválido';
      els.connHint.textContent = 'Vuelve a escanear el código QR de vinculación desde FiscalSync.';
      return;
    }

    catalogoInicialRecibido = false;

    ws = new WebSocket('wss://' + location.host + '/ws');

    ws.onopen = function () {
      ws.send(JSON.stringify({ tipo: 'auth', token: token }));
    };

    ws.onclose = function (ev) {
      els.connDot.className = 'dot off';
      els.connSub.textContent = 'Desconectado';
      cerrarCamara();
      mostrarPantalla('screenConnecting');
      if (ev.code === 4001 || ev.code === 4002) {
        els.connTitle.textContent = 'Vinculación expirada';
        els.connHint.textContent = 'Cierra esta página y vuelve a escanear el QR desde FiscalSync.';
        return;
      }
      els.connTitle.textContent = 'Conexión perdida';
      els.connHint.textContent = 'Intentando reconectar…';
      if (!reconectando) {
        reconectando = true;
        setTimeout(function () { reconectando = false; conectar(); }, 2000);
      }
    };

    ws.onerror = function () { /* onclose se dispara igual */ };

    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      manejarMensaje(msg);
    };
  }

  function manejarMensaje(msg) {
    if (msg.tipo === 'auth-ok') {
      els.connDot.className = 'dot on';
      els.connSub.textContent = 'Conectado';
      return;
    }

    // Cambio 05 (Resumen de Escaneo en el teléfono): además del nombre de
    // la empresa (lo único que se usaba desde Cambio 03), ahora también se
    // guarda el catálogo de proveedores y sus etiquetas — se necesitan
    // SOLO cuando Admin tiene configurado "Resumen en celular", para poder
    // buscar/elegir un proveedor al completar el resumen (ver abrirResumen).
    if (msg.tipo === 'catalogo-proveedores') {
      var empresaNueva = msg.empresa || '';
      var esCambioDeEmpresa = catalogoInicialRecibido && empresaNueva !== empresaNombre;
      empresaNombre = empresaNueva;
      actualizarEmpresaActiva();
      proveedoresCache = Array.isArray(msg.proveedores) ? msg.proveedores : [];
      clasifLabelsCache = msg.clasifLabels || {};
      sectorLabelsCache = msg.sectorLabels || {};
      costoLabelsCache = msg.costoLabels || {};

      if (esCambioDeEmpresa) {
        cerrarCamara();
        // Al cambiar de empresa se descarta el último tipo de documento
        // ordenado: "Seguir Escaneando" vuelve a ocultarse hasta que la
        // computadora ordene un nuevo escaneo para la empresa activa.
        escaneoIniciadoAlgunaVez = false;
        actualizarLibroActualUI();
        if (empresaNombre) {
          mostrarPantalla('screenReady');
          showToast('Empresa activa cambiada a: ' + empresaNombre, 'ok');
        } else {
          _mostrarSinEmpresaActiva();
        }
        return;
      }

      if (!catalogoInicialRecibido) {
        catalogoInicialRecibido = true;
        if (empresaNombre) {
          mostrarPantalla('screenReady');
        } else {
          _mostrarSinEmpresaActiva();
        }
      }
      return;
    }

    // Cambio 05: se guarda el catálogo de clientes (usado por el libro de
    // Crédito Fiscal) por el mismo motivo que el de proveedores arriba.
    if (msg.tipo === 'catalogo-clientes') {
      clientesCache = Array.isArray(msg.clientes) ? msg.clientes : [];
      return;
    }

    // Cambio 01: la computadora ordena qué tipo de documento escanear a
    // continuación. El teléfono ya no elige nada por su cuenta — solo
    // obedece: guarda el tipo de documento indicado y abre la cámara.
    if (msg.tipo === 'iniciar-escaneo') {
      var librosValidos = ['compras', 'cf', 'ccf', 'retencion', 'excluido'];
      if (librosValidos.indexOf(msg.libro) === -1) return;
      modoActual = msg.libro;
      escaneoIniciadoAlgunaVez = true;
      actualizarLibroActualUI();
      abrirCamara();
      return;
    }

    if (msg.tipo === 'recibido') {
      mostrarPantalla('screenEnviando');
      return;
    }

    // Cambio 03: este mensaje ya NO es el resultado final del guardado (eso
    // ahora lo decide el usuario en la computadora) — es solo la
    // confirmación de que el QR llegó bien y se está procesando ahí, o un
    // aviso de que hubo un problema con la lectura/consulta y conviene
    // volver a escanear.
    if (msg.tipo === 'resultado-documento') {
      els.resTitulo.textContent = msg.ok
        ? 'Enviado'
        : 'No se pudo procesar';
      els.resMensaje.textContent = msg.mensaje || (msg.ok
        ? 'Revisa el documento en tu computadora.'
        : 'Vuelve a escanear el documento.');
      mostrarPantalla('screenResultado');
      // Ya no vuelve a abrir la cámara por su cuenta: tras mostrar el
      // resultado, el teléfono pasa a "Teléfono listo" y espera. La cámara
      // solo se abre de nuevo cuando la computadora ordena otro escaneo
      // (mensaje 'iniciar-escaneo', ver arriba).
      setTimeout(function () {
        if (els.screenResultado.classList.contains('hidden')) return; // el usuario ya salió de esta pantalla
        mostrarPantalla('screenReady');
      }, 1600);
      return;
    }

    // Cambio 05 (Resumen de Escaneo en el teléfono — Modo Admin: "Resumen
    // en celular"): la computadora ya consultó el documento en Hacienda y
    // decidió (según la configuración de Admin) que se complete aquí en
    // vez de en la propia PC. Se abre la misma información/campos que
    // tendría el modal "Documento Escaneado" de la computadora.
    if (msg.tipo === 'mostrar-resumen') {
      abrirResumen(msg.libro, msg.combinado);
      return;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Cambio 05 — RESUMEN DE ESCANEO EN EL TELÉFONO
  // (Modo Admin: "Resumen en celular")
  //
  // Muestra y completa aquí la MISMA información que el modal "Documento
  // Escaneado" de la computadora (ver openQrDocModal/qrDocEnviar en
  // index.html): datos del documento ya consultado en Hacienda, tipo de
  // documento, monto, "exenta", bien/servicio (solo Factura de
  // Exportación), y selección o alta de proveedor/cliente.
  //
  // El registro NUNCA se guarda aquí: al enviar, este teléfono solo manda
  // los valores elegidos de vuelta a la computadora (mensaje
  // 'resumen-completado'), que es quien arma y guarda el registro con
  // _guardarRegistroEscaneo() — la MISMA función que usa el modal de la
  // PC. Así el cálculo/guardado nunca vive en dos lugares.
  // ══════════════════════════════════════════════════════════════════

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _fMoney(n) {
    n = parseFloat(n) || 0;
    return '$' + n.toFixed(2);
  }

  // Mismo formato que usa la PC para NIT/NRC (0000-000000-000-0) y DUI
  // (00000000-0) — validación ligera para no guardar datos claramente mal
  // escritos desde el teléfono; el guardado final en la PC no vuelve a
  // exigir el formato, así que esta es la única barrera.
  function _validoNitONrc(v) { return /^\d{4}-\d{6}-\d{3}-\d$/.test(String(v || '').trim()); }
  function _validoDui(v) { return /^\d{8}-\d$/.test(String(v || '').trim()); }

  function _provTieneUso(p, uso) {
    if (!uso) return true;
    var usos = (Array.isArray(p.usos) && p.usos.length) ? p.usos : ['compras'];
    return usos.indexOf(uso) !== -1;
  }

  function _rsInfo() { return QRDOC_LIBRO_INFO[resumenState.libro] || {}; }

  // Punto de entrada: llega 'mostrar-resumen' desde la computadora.
  function abrirResumen(libro, combinado) {
    if (!QRDOC_LIBRO_INFO[libro] || !combinado) return;
    cerrarCamara();
    resumenState = { libro: libro, combinado: combinado, sel: null };
    _rsResultados = [];
    renderResumen();
    mostrarPantalla('screenResumen');
  }

  function renderResumen() {
    var info = _rsInfo();
    var c = resumenState.combinado || {};
    var estado = c.estado || '';
    var estadoOk = estado.toUpperCase() === 'TRANSMITIDO';

    var html = '';
    html += '<p class="rs-eyebrow">' + _esc(info.anexo || '') + '</p>';
    html += '<p class="rs-title">' + _esc(info.titulo || 'Documento Escaneado') + '</p>';
    html += '<span class="rs-pill' + (estadoOk ? '' : ' warn') + '"><span class="d"></span>' + _esc(estado || 'Sin estado') + '</span>';

    if (!estadoOk) {
      html += '<div class="rs-aviso">Este documento no aparece como TRANSMITIDO en la consulta de Hacienda. Verifica los datos antes de enviarlo.</div>';
    }

    html += '<div class="doc-meta">';
    html += '<div class="field"><div class="k">Fecha</div><div class="v">' + _esc(c.fecha || '—') + '</div></div>';
    html += '<div class="field"><div class="k">Código Generación</div><div class="v">' + _esc(c.codGen || '—') + '</div></div>';
    if (c.selloRecepcion) html += '<div class="field"><div class="k">Sello de Recepción</div><div class="v">' + _esc(c.selloRecepcion) + '</div></div>';
    if (c.numeroControl) html += '<div class="field"><div class="k">N.º de Control</div><div class="v">' + _esc(c.numeroControl) + '</div></div>';
    html += '</div>';

    // Tipo de documento
    if (!info.sinTipoDoc) {
      var tipoSel = (resumenState.campos && resumenState.campos.tipoDoc) || (c.tipoDocMapeado || info.tipoDocDefault);
      html += '<div class="rs-field"><label>Tipo de Documento (CAT-002)</label><select id="rsTipoDoc" onchange="window._rsOnTipoDocChange()">';
      info.tiposDoc.forEach(function (t) {
        html += '<option value="' + t[0] + '"' + (t[0] === tipoSel ? ' selected' : '') + '>' + _esc(t[1]) + '</option>';
      });
      html += '</select></div>';
    }

    // Monto
    html += '<div class="rs-field"><label>' + _esc(info.montoLabel || 'Monto') + '</label>';
    html += '<input type="number" step="0.01" min="0" id="rsMonto" value="' + _esc(c.montoTotal != null ? c.montoTotal : '') + '"></div>';

    // Bien/Servicio (solo Factura de Exportación, compras/cf)
    html += '<div id="rsBSWrap" class="rs-field hidden"><label>Tipo de Operación</label><div class="rs-bs-row">' +
      '<button type="button" id="rsBSBien" class="rs-bs-btn" onclick="window._rsSelectBienServicio(\'bien\')">Bien</button>' +
      '<button type="button" id="rsBSServicio" class="rs-bs-btn" onclick="window._rsSelectBienServicio(\'servicio\')">Servicio</button>' +
      '</div></div>';

    // Exenta (cf/ccf)
    if (info.uso === null && !info.sinProveedor === false) { /* no-op, cf entra abajo por sinProveedor */ }
    html += '<div id="rsExentaWrap" class="rs-field hidden" style="display:flex;align-items:center;justify-content:space-between;">' +
      '<label style="margin:0;">Operación exenta de IVA</label>' +
      '<label class="switch"><input type="checkbox" id="rsExenta"><span class="switch-track"></span></label></div>';

    // Datos adicionales informativos (si vienen)
    var extra = [];
    if (c.ivaOperaciones) extra.push(['IVA Operaciones', c.ivaOperaciones]);
    if (c.ivaPercibido) extra.push(['IVA Percibido', c.ivaPercibido]);
    if (c.ivaRetenido) extra.push(['IVA Retenido', c.ivaRetenido]);
    if (c.retencionRenta) extra.push(['Retención Renta', c.retencionRenta]);
    if (c.totalOperacion) extra.push(['Total Operación', c.totalOperacion]);
    if (extra.length) {
      html += '<div class="rs-field">';
      extra.forEach(function (e) { html += '<div class="rs-money-row"><span>' + _esc(e[0]) + '</span><b>' + _fMoney(e[1]) + '</b></div>'; });
      html += '</div>';
    }

    // Proveedor / Cliente
    if (!info.sinProveedor) {
      var etiqueta = info.esCliente ? 'Cliente' : 'Proveedor';
      html += '<div class="rs-prov-panel">';
      html += '<label style="display:block;font-size:11px;font-weight:700;color:var(--dim);margin-bottom:6px;">' + etiqueta + '</label>';
      html += '<div id="rsProvBuscarWrap">';
      html += '<input type="text" id="rsProvBuscar" placeholder="Buscar ' + etiqueta.toLowerCase() + ' por nombre o NIT…" oninput="window._rsBuscar(this.value)">';
      html += '<div id="rsProvResultados" class="rs-prov-results"></div>';
      html += '<button type="button" class="rs-link-btn" style="margin-top:8px;" onclick="window._rsMostrarNuevo()">+ Agregar ' + etiqueta.toLowerCase() + ' nuevo</button>';
      html += '</div>';
      html += '<div id="rsProvChosen"></div>';
      html += '<div id="rsProvNuevoForm" class="hidden"></div>';
      html += '</div>';
    }

    html += '<div class="rs-btn-row">';
    html += '<button type="button" class="btn-outline" style="flex:1;" onclick="window._rsCancelar()">Cancelar</button>';
    html += '<button type="button" class="btn-teal" style="flex:2;" onclick="window._rsEnviar()">Enviar a FiscalSync</button>';
    html += '</div>';

    els.screenResumen.innerHTML = html;

    // Ajustes que dependen del tipo de documento inicial
    window._rsOnTipoDocChange();
    if (info.uso === null) {
      // cf y ccf: la exenta siempre aplica salvo Factura de Exportación (tipoDoc 11)
      document.getElementById('rsExentaWrap').classList.remove('hidden');
    }
  }

  // Muestra/oculta Bien-Servicio y Exenta según el tipo de documento
  // elegido — replica exactamente qué controles habilita
  // qrDocOnTipoDocChange() en la PC para Factura de Exportación (11).
  window._rsOnTipoDocChange = function () {
    var info = _rsInfo();
    var tipoDocEl = document.getElementById('rsTipoDoc');
    var tipoDoc = tipoDocEl ? tipoDocEl.value : info.tipoDocDefault;
    var esExportacion = (tipoDoc === '11') && (resumenState.libro === 'compras' || resumenState.libro === 'cf');

    var bsWrap = document.getElementById('rsBSWrap');
    if (bsWrap) {
      bsWrap.classList.toggle('hidden', !esExportacion);
      if (esExportacion && !resumenState._bs) window._rsSelectBienServicio('bien');
    }

    var exentaWrap = document.getElementById('rsExentaWrap');
    if (exentaWrap && (resumenState.libro === 'cf' || resumenState.libro === 'ccf')) {
      exentaWrap.classList.toggle('hidden', esExportacion);
    }
  };

  window._rsSelectBienServicio = function (val) {
    resumenState._bs = val;
    var bBien = document.getElementById('rsBSBien'), bServ = document.getElementById('rsBSServicio');
    if (bBien) bBien.classList.toggle('on', val === 'bien');
    if (bServ) bServ.classList.toggle('on', val === 'servicio');
  };

  // ── Búsqueda y selección de proveedor/cliente ───────────────────────
  window._rsBuscar = function (q) {
    var info = _rsInfo();
    var origen = info.esCliente ? clientesCache : proveedoresCache;
    q = String(q || '').trim().toLowerCase();
    var resultados = origen.filter(function (p) {
      if (!info.esCliente && !_provTieneUso(p, info.uso)) return false;
      if (!q) return true;
      var nombre = (p.nombre || '').toLowerCase();
      var nit = (p.nit || '').toLowerCase();
      var nrc = (p.nrc || '').toLowerCase();
      return nombre.indexOf(q) !== -1 || nit.indexOf(q) !== -1 || nrc.indexOf(q) !== -1;
    }).slice(0, 8);
    _rsResultados = resultados;
    var wrap = document.getElementById('rsProvResultados');
    if (!wrap) return;
    if (!resultados.length) {
      wrap.innerHTML = q ? '<p style="font-size:11.5px;color:var(--faint);margin:4px 0 0;">Sin coincidencias — puedes agregarlo como nuevo.</p>' : '';
      return;
    }
    wrap.innerHTML = resultados.map(function (p, i) {
      return '<button type="button" class="rs-prov-item" onclick="window._rsSeleccionar(' + i + ')">' +
        '<div class="nombre">' + _esc(p.nombre || '(sin nombre)') + '</div>' +
        '<div class="nit">' + _esc(p.nit || p.nrc || p.dui || '') + '</div></button>';
    }).join('');
  };

  window._rsSeleccionar = function (idx) {
    var p = _rsResultados[idx];
    if (!p) return;
    resumenState.sel = {
      nombre: p.nombre || '', nit: p.nit || '', nrc: p.nrc || '', dui: p.dui || '',
      clasif: p.clasif || '1', sector: p.sector || '1', tipoCosto: p.tipoCosto || '1',
      tipoOp: p.tipoOp || '1', tipoIng: p.tipoIng || '1'
    };
    document.getElementById('rsProvBuscarWrap').classList.add('hidden');
    _rsRenderChosen();
  };

  window._rsQuitarSel = function () {
    resumenState.sel = null;
    document.getElementById('rsProvBuscarWrap').classList.remove('hidden');
    document.getElementById('rsProvBuscar').value = '';
    document.getElementById('rsProvResultados').innerHTML = '';
    _rsRenderChosen();
  };

  function _rsRenderChosen() {
    var wrap = document.getElementById('rsProvChosen');
    if (!wrap) return;
    var s = resumenState.sel;
    if (!s) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<div class="rs-prov-chosen"><div>' +
      '<div class="nombre">' + _esc(s.nombre) + '</div>' +
      '<div class="nit">' + _esc(s.nit || s.nrc || s.dui || '') + '</div></div>' +
      '<button type="button" class="rs-link-btn" onclick="window._rsQuitarSel()">Cambiar</button></div>';
  }

  // ── Alta de proveedor/cliente nuevo (mismos campos que el formulario
  // "Agregar nuevo" del modal en la PC — ver openQrDocModal) ─────────────
  window._rsMostrarNuevo = function () {
    var info = _rsInfo();
    var esExcluido = resumenState.libro === 'excluido';
    var form = document.getElementById('rsProvNuevoForm');
    var html = '<div class="rs-new-grid">';
    html += '<div class="rs-field"><label>Nombre / Razón Social</label><input type="text" id="rsNuevo_nombre"></div>';
    html += '<div class="rs-field"><label>NIT o NRC</label><input type="text" id="rsNuevo_nit" placeholder="0000-000000-000-0"></div>';
    if (!info.esCliente) {
      html += '<div class="rs-field"><label>DUI (opcional)</label><input type="text" id="rsNuevo_dui" placeholder="00000000-0"></div>';
      html += '<div class="rs-field"><label>Clasificación</label><select id="rsNuevo_clasif">' + CLASIF_OPCIONES.map(function (o) { return '<option value="' + o[0] + '">' + _esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      html += '<div class="rs-field"><label>Sector</label><select id="rsNuevo_sector">' + SECTOR_OPCIONES.map(function (o) { return '<option value="' + o[0] + '">' + _esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      html += '<div class="rs-field"><label>Tipo de Costo</label><select id="rsNuevo_tipoCosto">' + COSTO_OPCIONES.map(function (o) { return '<option value="' + o[0] + '">' + _esc(o[1]) + '</option>'; }).join('') + '</select></div>';
    }
    if (esExcluido) {
      html += '<div class="rs-field"><label>Tipo de Documento del Sujeto</label><select id="rsNuevo_tipoDocEx">' + TIPODOCEX_OPCIONES.map(function (o) { return '<option value="' + o[0] + '">' + _esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      html += '<div class="rs-field"><label>Tipo de Operación</label><select id="rsNuevo_tipoOpEx">' + TIPOOPEX_OPCIONES.map(function (o) { return '<option value="' + o[0] + '">' + _esc(o[1]) + '</option>'; }).join('') + '</select></div>';
    }
    html += '<div class="rs-btn-row" style="margin-top:0;">' +
      '<button type="button" class="btn-outline" style="flex:1;" onclick="window._rsCancelarNuevo()">Cancelar</button>' +
      '<button type="button" class="btn-teal" style="flex:1;" onclick="window._rsUsarNuevo()">Usar este</button></div>';
    html += '</div>';
    form.innerHTML = html;
    form.classList.remove('hidden');
    document.getElementById('rsProvBuscarWrap').classList.add('hidden');
  };

  window._rsCancelarNuevo = function () {
    var form = document.getElementById('rsProvNuevoForm');
    form.classList.add('hidden');
    form.innerHTML = '';
    if (!resumenState.sel) document.getElementById('rsProvBuscarWrap').classList.remove('hidden');
  };

  window._rsUsarNuevo = function () {
    var info = _rsInfo();
    var nombre = (document.getElementById('rsNuevo_nombre').value || '').trim();
    var nitRaw = (document.getElementById('rsNuevo_nit').value || '').trim();
    if (!nombre) { showToast('Escribe el nombre.', 'err'); return; }
    if (!nitRaw) { showToast('Escribe el NIT o NRC.', 'err'); return; }
    if (!_validoNitONrc(nitRaw)) { showToast('El NIT/NRC debe tener el formato 0000-000000-000-0.', 'err'); return; }

    var sel = { nombre: nombre, nit: nitRaw, nrc: nitRaw, dui: '', clasif: '1', sector: '1', tipoCosto: '1', tipoOp: '1', tipoIng: '1' };

    if (!info.esCliente) {
      var duiRaw = (document.getElementById('rsNuevo_dui').value || '').trim();
      if (duiRaw && !_validoDui(duiRaw)) { showToast('El DUI debe tener el formato 00000000-0.', 'err'); return; }
      sel.dui = duiRaw;
      sel.clasif = document.getElementById('rsNuevo_clasif').value;
      sel.sector = document.getElementById('rsNuevo_sector').value;
      sel.tipoCosto = document.getElementById('rsNuevo_tipoCosto').value;
    }
    if (resumenState.libro === 'excluido') {
      sel.tipoDocEx = document.getElementById('rsNuevo_tipoDocEx').value;
      sel.tipoOpEx = document.getElementById('rsNuevo_tipoOpEx').value;
    }

    resumenState.sel = sel;
    var form = document.getElementById('rsProvNuevoForm');
    form.classList.add('hidden');
    form.innerHTML = '';
    document.getElementById('rsProvBuscarWrap').classList.add('hidden');
    _rsRenderChosen();
  };

  // ── Enviar / Cancelar ────────────────────────────────────────────────
  window._rsCancelar = function () {
    resumenState = { libro: null, combinado: null, sel: null };
    mostrarPantalla('screenReady');
  };

  window._rsEnviar = function () {
    var info = _rsInfo();
    if (!info.sinProveedor && !resumenState.sel) {
      showToast(info.esCliente ? 'Selecciona o agrega un cliente antes de enviar.' : 'Selecciona o agrega un proveedor antes de enviar.', 'err');
      return;
    }
    var montoEl = document.getElementById('rsMonto');
    var monto = parseFloat(montoEl ? montoEl.value : 0) || 0;
    if (monto <= 0) { showToast('Ingresa un monto válido.', 'err'); return; }

    if (!ws || ws.readyState !== 1) {
      showToast('Se perdió la conexión — espera a reconectar e intenta de nuevo.', 'err');
      return;
    }

    var campos = {
      tipoDoc: info.sinTipoDoc ? '' : (document.getElementById('rsTipoDoc') || {}).value,
      monto: monto,
      esExenta: !!(document.getElementById('rsExenta') || {}).checked,
      bienServicio: resumenState._bs || 'bien'
    };

    mostrarPantalla('screenEnviando');
    ws.send(JSON.stringify({
      tipo: 'resumen-completado',
      libro: resumenState.libro,
      combinado: resumenState.combinado,
      campos: campos,
      sel: resumenState.sel
    }));
  };

  // ── Cámara + lectura de QR ──────────────────────────────────────────
  function abrirCamara() {
    mostrarPantalla('screenCamera');

    var constraintsAlta = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        advanced: [{ focusMode: 'continuous' }]
      }
    };
    var constraintsBasica = { video: { facingMode: 'environment' } };

    navigator.mediaDevices.getUserMedia(constraintsAlta)
      .catch(function () {
        // Si el dispositivo no soporta las restricciones avanzadas, se reintenta con lo básico.
        return navigator.mediaDevices.getUserMedia(constraintsBasica);
      })
      .then(function (stream) {
        streamCamara = stream;
        els.video.srcObject = stream;

        // Intenta forzar enfoque continuo si el track lo soporta (mejora nitidez al escanear documentos).
        var track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          try {
            var caps = track.getCapabilities();
            if (caps.focusMode && caps.focusMode.indexOf('continuous') !== -1) {
              track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            }
          } catch (e) { /* no soportado, se ignora */ }
        }

        els.video.onloadedmetadata = function () {
          els.video.play();
          loopEscaneo();
        };
      })
      .catch(function () {
        showToast('No se pudo acceder a la cámara. Revisa los permisos del navegador.', 'err');
        cerrarCamara();
        mostrarPantalla('screenReady');
      });
  }

  function cerrarCamara() {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = null;
    if (streamCamara) {
      streamCamara.getTracks().forEach(function (t) { t.stop(); });
      streamCamara = null;
    }
  }

  function loopEscaneo() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (!streamCamara) return;
      if (els.video.readyState === els.video.HAVE_ENOUGH_DATA) {
        canvas.width = els.video.videoWidth;
        canvas.height = els.video.videoHeight;
        ctx.drawImage(els.video, 0, 0, canvas.width, canvas.height);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // 'attemptBoth' prueba también la variante invertida en cada frame
        // (brillo del flash, reflejo del papel térmico, impresoras que
        // invierten el sello, etc.) sin cambiar el resultado para los QR
        // que ya funcionaban con la primera pasada.
        var code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) {
          onQrDecodificado(code.data);
          return;
        }
      }
      loopId = requestAnimationFrame(tick);
    }
    loopId = requestAnimationFrame(tick);
  }

  // Valida dominio y extrae ambiente/codGen/fechaEmi del QR del DTE.
  // Solo se acepta si el host es EXACTAMENTE admin.factura.gob.sv.
  function parsearQrDte(texto) {
    var url;
    try { url = new URL(texto); } catch (e) { return null; }
    if (url.hostname.toLowerCase() !== HOST_VALIDO) return null;

    var params = url.searchParams;
    // Compatibilidad con QR de consulta pública que traen ambiente=null
    // (texto literal "null", no ausencia del parámetro) u otras variantes
    // equivalentes ("undefined", vacío, solo espacios) — se tratan igual
    // que si el parámetro no viniera.
    function esValorVacioOEquivalente(v) {
      if (!v) return true;
      var norm = String(v).trim().toLowerCase();
      return norm === '' || norm === 'null' || norm === 'undefined';
    }
    function buscarParam(nombres) {
      for (var i = 0; i < nombres.length; i++) {
        var v = params.get(nombres[i]);
        if (v && !esValorVacioOEquivalente(v)) return v;
      }
      return '';
    }
    var ambiente = buscarParam(['ambiente', 'Ambiente']);
    var codGen = buscarParam(['codGen', 'codgen', 'CodGen']);
    var fechaEmi = buscarParam(['fechaEmi', 'fechaemi', 'FechaEmi']);
    // La identificación del DTE depende de codGen y fechaEmi (más el host
    // ya validado arriba) — 'ambiente' es informativo y nunca debe, por sí
    // solo, invalidar un QR de consulta pública legítimo.
    if (!codGen || !fechaEmi) return null;
    return { ambiente: ambiente || '01', codGen: codGen, fechaEmi: fechaEmi };
  }

  // Feedback de escaneo exitoso: sonido corto (Web Audio, sin archivos
  // externos) + vibración breve del dispositivo, si el navegador lo soporta.
  function feedbackEscaneoExitoso() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        var ctx = new Ctx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        osc.onended = function () { ctx.close(); };
      }
    } catch (e) { /* audio no disponible — se ignora */ }

    try {
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (e) { /* vibración no disponible — se ignora */ }
  }

  // Cambio 03: el teléfono ya no muestra ninguna pantalla de gestión del
  // documento (proveedor, cliente, exenta, confirmar) — en cuanto lee un QR
  // válido, lo envía de inmediato a la computadora y pasa a "Enviando…".
  // Todo lo demás ocurre en FiscalSync.
  function onQrDecodificado(texto) {
    cerrarCamara();
    var datos = parsearQrDte(texto);
    if (!datos) {
      showToast('Este no es un QR de DTE válido. Vuelve a intentar.', 'err');
      abrirCamara();
      return;
    }
    feedbackEscaneoExitoso();
    enviarDocumentoEscaneado(datos);
  }

  function enviarDocumentoEscaneado(qr) {
    if (!ws || ws.readyState !== 1 /* OPEN */) {
      showToast('Se perdió la conexión — espera a reconectar e intenta de nuevo.', 'err');
      mostrarPantalla('screenReady');
      return;
    }
    mostrarPantalla('screenEnviando');
    ws.send(JSON.stringify({
      tipo: 'documento-escaneado',
      qr: qr
    }));
  }

  // ── Botones ──────────────────────────────────────────────────────────
  if (els.btnCancelarCamara) {
    els.btnCancelarCamara.addEventListener('click', function () {
      cerrarCamara();
      mostrarPantalla('screenReady');
    });
  }

  // "Seguir Escaneando": reabre la cámara desde el teléfono, sin esperar
  // una nueva orden de la computadora — reutiliza el último tipo de
  // documento ('modoActual') que ya había ordenado FiscalSync.
  if (els.btnSeguirEscaneando) {
    els.btnSeguirEscaneando.addEventListener('click', function () {
      actualizarLibroActualUI();
      abrirCamara();
    });
  }

  // ── Arranque ─────────────────────────────────────────────────────────
  actualizarLibroActualUI();
  conectar();
})();
