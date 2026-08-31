const { app, BrowserWindow, Menu, session, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const { autoUpdater } = require('electron-updater'); // 👈 NUEVO
// Cambio 04 — Catálogo CAT-002 centralizado (fuente única, compartida con
// index.html). Ver cat002.js para el catálogo completo y la equivalencia
// texto de Hacienda -> código CAT-002.
const { cat002CodigoDesdeTexto, nombrePorCodigo } = require('./data/cat002.js');

let mainWindowRef = null; // 👈 NUEVO: referencia para enviar el estado del updater al renderer

// ══════════════════════════════════════════════════════════════════════
// Corrección 04 — Facturación Electrónica: descarga/organización de JSON
// y PDF dentro de Gestión (Mes → Cliente → Facturacion).
//
// _feContextos: guarda, por cada partición ("persist:facturacion-
// electronica-<idEmpresa>"), el mes de trabajo y la empresa que el
// renderer indicó (ver ipcMain.handle('fe-set-context') más abajo), más
// el nombre base del último .json descargado (para nombrar el PDF igual,
// ver punto 6 de la Corrección 04).
//
// _feSesionesEnganchadas: evita instalar el listener 'will-download' más
// de una vez para la misma partición (el <webview> puede recrearse varias
// veces para la misma empresa a lo largo de la sesión de la app).
// ══════════════════════════════════════════════════════════════════════
const _feContextos = {};
const _feSesionesEnganchadas = new Map();

function _feMesLabelPorDefecto() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const d = new Date();
  return meses[d.getMonth()] + ' ' + d.getFullYear();
}

function _feContextoDe(partition) {
  return _feContextos[partition] || {
    mesLabel: _feMesLabelPorDefecto(),
    empresaNombre: 'Empresa',
    ultimoJsonBase: null
  };
}

// Corrección 08 — Simula el clic sobre el botón "Descargar" del visor de
// PDF de Chromium (<cr-icon-button id="save" iron-icon="cr:file-download">)
// dentro de la pestaña oculta que Hacienda abre para mostrar el PDF. Ese
// botón vive anidado dentro de varios Shadow DOM (del propio visor
// interno), así que hay que atravesarlos recursivamente para encontrarlo
// — son de tipo "open", por lo que sí se pueden inspeccionar/hacer clic
// desde afuera con executeJavaScript.
// El visor de PDF de Chromium normalmente NO vive en el documento
// principal de la pestaña: corre en un frame interno propio (una especie
// de "guest" embebido, similar a un <webview>). Por eso no basta con
// recorrer el Shadow DOM del documento de arriba — hay que probar el
// script en CADA frame de la pestaña (el principal y todos sus hijos),
// usando la API de frames de Electron (webContents.mainFrame.frames).
// El visor puede tardar un momento en terminar de inicializarse (sobre
// todo con PDFs grandes), así que se reintenta varias veces con una
// pequeña pausa entre cada intento antes de darse por vencido.
const _FE_SCRIPT_BUSCAR_BOTON_DESCARGA = `
    (function() {
      function buscarBoton(root) {
        if (!root) return null;
        var directo = root.querySelector('#save');
        if (directo) return directo;
        var nodos = root.querySelectorAll('*');
        for (var i = 0; i < nodos.length; i++) {
          if (nodos[i].shadowRoot) {
            var enc = buscarBoton(nodos[i].shadowRoot);
            if (enc) return enc;
          }
        }
        return null;
      }
      var boton = buscarBoton(document);
      if (boton) { boton.click(); return true; }
      return false;
    })();
`;

// Junta el frame principal + todos sus frames hijos (recursivo), para
// poder probar el script de búsqueda del botón en cada uno.
function _feRecolectarFrames(frame, lista) {
  if (!frame) return lista;
  lista.push(frame);
  try {
    const hijos = frame.frames || [];
    for (const hijo of hijos) _feRecolectarFrames(hijo, lista);
  } catch (e) { /* noop */ }
  return lista;
}

async function _feBuscarYClickEnTodosLosFrames(wc) {
  let frames = [];
  try {
    frames = _feRecolectarFrames(wc.mainFrame, []);
  } catch (e) {
    console.warn('[Facturación Electrónica][debug] no se pudo listar frames:', e.message);
  }
  console.log('[Facturación Electrónica][debug] buscando botón de descarga en', frames.length, 'frame(s)');
  for (const frame of frames) {
    try {
      const clicked = await frame.executeJavaScript(_FE_SCRIPT_BUSCAR_BOTON_DESCARGA, true);
      if (clicked) return true;
    } catch (e) {
      console.warn('[Facturación Electrónica][debug] error ejecutando el script en un frame:', e.message);
    }
  }
  return false;
}

function _feIntentarClickDescargarPdf(childWindow, intentosRestantes) {
  if (!childWindow || childWindow.isDestroyed()) return;
  const wc = childWindow.webContents;
  if (!wc || wc.isDestroyed()) return;

  _feBuscarYClickEnTodosLosFrames(wc).then((clicked) => {
    if (clicked) {
      console.log('[Facturación Electrónica][debug] clic automático en "Descargar" realizado con éxito.');
      return; // listo — el clic disparó la descarga real
    }
    if (intentosRestantes > 0) {
      setTimeout(() => _feIntentarClickDescargarPdf(childWindow, intentosRestantes - 1), 500);
    } else {
      // No se encontró el botón tras varios intentos (visor no cargó,
      // vive en un frame que no pudimos listar, cambió su estructura, u
      // otro error). No dejamos al usuario sin forma de descargar el
      // PDF: se muestra la pestaña para que pueda hacer clic manualmente.
      console.warn('[Facturación Electrónica] No se encontró el botón de descarga tras varios intentos (revisar los logs [debug] de arriba); se muestra la pestaña para descarga manual.');
      if (!childWindow.isDestroyed()) childWindow.show();
    }
  }).catch((e) => {
    console.warn('[Facturación Electrónica] Error automatizando la descarga del PDF:', e.message);
    if (intentosRestantes > 0) {
      setTimeout(() => _feIntentarClickDescargarPdf(childWindow, intentosRestantes - 1), 500);
    } else if (!childWindow.isDestroyed()) {
      childWindow.show();
    }
  });
}

// Cambio 04 — Trae la ventana principal al frente (por encima de cualquier
// otra ventana/aplicación abierta) SOLO en el instante en que llega un
// documento escaneado por QR que sí va a mostrarse (justo antes de enviarlo
// al renderer, que es quien abre el modal de "Documento Escaneado"). No se
// llama en ningún otro momento — si el documento se rechaza por tipo no
// permitido, la ventana se queda como estaba.
// - restore(): si estaba minimizada, la regresa a su tamaño normal.
// - show()+focus(): la hace visible y le da el foco del teclado.
// - setAlwaysOnTop(true) seguido de false: fuerza que quede por encima de
//   CUALQUIER otra ventana (de esta app o de otras apps del sistema) en el
//   instante en que se muestra, sin dejarla fija "siempre encima" después
//   — apenas el usuario haga clic en otra ventana, vuelve a comportarse
//   como una ventana normal.
function _traerVentanaAlFrente(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.setAlwaysOnTop(true);
    win.show();
    win.focus();
    win.moveTop();
    // Se quita el "siempre encima" casi de inmediato — solo se usó para
    // ganarle el frente a otras ventanas en este instante, no para
    // mantenerla fija arriba de forma permanente.
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(false);
    }, 300);
  } catch (e) {
    console.warn('[QR] No se pudo traer la ventana al frente: ' + e.message);
  }
}

function createWindow() {
  // Leer versión una sola vez — app.getVersion() lee del package.json automáticamente
  const appVersion = app.getVersion() || '';
  const winTitle = 'FiscalSync | Minimal Enterprise' + (appVersion ? ' | Versión' + appVersion : '');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    titleBarOverlay: false,
    title: winTitle,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      // Implementación 01 — Facturación Electrónica: habilita el tag
      // <webview> (deshabilitado por defecto en Electron) para poder
      // embeber el portal oficial de Hacienda dentro de la app. El
      // candado real está en 'will-attach-webview' más abajo, que valida
      // cada <webview> antes de crearse.
      webviewTag: true,
      // Corrección — sin esto, Chromium le baja la prioridad a los
      // temporizadores del renderer cuando la ventana está minimizada o
      // sin foco (p. ej. el intervalo obligatorio de 15s entre consultas
      // de Consulta DTE, ver ConsultaDTE.js), haciendo que procesos con
      // setTimeout/setInterval avancen más lento sin ningún error. Mismo
      // ajuste que ya se usa en la ventana oculta del visor de PDF de
      // Facturación Electrónica (ver contents.setWindowOpenHandler más
      // abajo).
      backgroundThrottling: false,
    }
  });

  mainWindowRef = win; // 👈 NUEVO

  Menu.setApplicationMenu(null);

  // Implementación 01 / Corrección 01 — Facturación Electrónica: candado
  // de seguridad para el tag <webview> (ver #facturacionElectronicaScreen
  // en index.html). Aunque el HTML que crea el <webview> es el nuestro (no
  // contenido de terceros), Electron recomienda validar igual cualquier
  // <webview> antes de adjuntarse, por si en el futuro se agrega
  // contenido dinámico a esa pantalla:
  //   - Fuerza sus webPreferences (nunca nodeIntegration, siempre
  //     contextIsolation) sin importar lo que el HTML haya pedido.
  //   - Valida que la partición sea una de Facturación Electrónica para
  //     UNA empresa concreta ("persist:facturacion-electronica-<idEmpresa>")
  //     — Corrección 01 le dio a cada empresa su propia sesión aislada
  //     (ver _asegurarWebviewFacturacion en index.html), así que YA NO se
  //     fuerza un único valor fijo (eso volvería a mezclar la sesión de
  //     todas las empresas en una sola, deshaciendo esa corrección) — solo
  //     se rechaza cualquier partición que no siga ese patrón esperado.
  //   - Rechaza cualquier intento de cargar un <webview> fuera del
  //     dominio oficial de Hacienda (admin.factura.gob.sv).
  win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.preload = undefined;

    if (typeof params.partition !== 'string' || !/^persist:facturacion-electronica-.+$/.test(params.partition)) {
      console.warn('[Facturación Electrónica] Se bloqueó un <webview> con partición inesperada:', params.partition);
      event.preventDefault();
      return;
    }

    let host = '';
    try { host = new URL(params.src).hostname; } catch (e) { /* noop */ }
    if (host !== 'admin.factura.gob.sv') {
      console.warn('[Facturación Electrónica] Se bloqueó un <webview> fuera del portal oficial:', params.src);
      event.preventDefault();
      return;
    }

    // Corrección 04, punto 1 y 5/6 — Hacienda descarga el .json de forma
    // automática y, para el PDF, abre una pestaña nueva desde la cual el
    // usuario lo descarga manualmente. Ambas descargas pasan por la MISMA
    // sesión (partition) de esta empresa, así que basta con enganchar
    // 'will-download' una sola vez por partición para capturar las dos.
    const partition = params.partition;
    if (!_feSesionesEnganchadas.has(partition)) {
      const sess = session.fromPartition(partition);
      _feSesionesEnganchadas.set(partition, sess);

      sess.on('will-download', (downloadEvent, item, webContentsDeDescarga) => {
        try {
          const ctx = _feContextoDe(partition);
          const dir = _feGetFacturacionDir(ctx.mesLabel, ctx.empresaNombre);
          const originalName = item.getFilename();
          const ext = path.extname(originalName).toLowerCase();
          let destName;

          if (ext === '.json') {
            // Punto 1/2 — el .json se guarda con su nombre tal cual, y se
            // recuerda su nombre base para que el PDF (punto 6) lo use.
            destName = sanitizeFolderName(originalName);
            _feContextos[partition] = Object.assign({}, ctx, {
              ultimoJsonBase: path.basename(originalName, ext)
            });
          } else if (ext === '.pdf') {
            // Punto 6 — el PDF usa como base el nombre del último .json
            // descargado, cambiando únicamente la extensión.
            const base = ctx.ultimoJsonBase || path.basename(originalName, ext);
            destName = sanitizeFolderName(base) + '.pdf';
          } else {
            destName = sanitizeFolderName(originalName);
          }

          const destPath = path.join(dir, destName);
          item.setSavePath(destPath);

          item.once('done', (doneEvent, state) => {
            if (mainWindowRef && !mainWindowRef.isDestroyed()) {
              mainWindowRef.webContents.send('fe-descarga-completada', {
                ok: state === 'completed',
                state: state,
                ext: ext,
                path: destPath
              });
            }
            // Corrección 07, punto 2 — apenas el PDF termina de guardarse
            // (ya organizado y renombrado igual que el .json, arriba), se
            // abre automáticamente con el visor de PDF predeterminado del
            // sistema, para que el usuario lo vea de inmediato sin tener
            // que ir a buscarlo a mano en la carpeta Facturacion. Misma
            // mecánica que ya usa el handler 'print-pdf' (shell.openPath).
            if (state === 'completed' && ext === '.pdf') {
              shell.openPath(destPath).then((err) => {
                if (err) console.warn('[Facturación Electrónica] No se pudo abrir automáticamente el PDF:', err);
              });
            }
            // Corrección 08 — la pestaña oculta que disparó esta descarga
            // (mediante el clic simulado en 'Descargar', ver
            // _feIntentarClickDescargarPdf) ya cumplió su función; se
            // cierra sola para no dejar ventanas ocultas acumulándose.
            // Cuidado: NUNCA se cierra si la descarga vino del <webview>
            // principal (el .json, que se descarga directo, sin pestaña
            // nueva) — por eso se compara contra mainWindowRef.
            if (ext === '.pdf' && webContentsDeDescarga && !webContentsDeDescarga.isDestroyed()) {
              try {
                const winDeDescarga = BrowserWindow.fromWebContents(webContentsDeDescarga);
                if (winDeDescarga && !winDeDescarga.isDestroyed() && winDeDescarga !== mainWindowRef) {
                  winDeDescarga.destroy();
                }
              } catch (e) { /* noop */ }
            }
          });
        } catch (e) {
          console.warn('[Facturación Electrónica] Error organizando descarga:', e.message);
        }
      });
    }
  });

  // Corrección 04, punto 1 — Hacienda muestra el PDF en una pestaña nueva
  // del navegador (no lo descarga directo). Se permite esa pestaña nueva
  // ÚNICAMENTE si apunta al portal oficial, y se la fuerza a compartir la
  // MISMA partición (sesión) del <webview> que la abrió, para que su
  // descarga pase por el mismo 'will-download' de arriba y quede
  // organizada y renombrada igual que el .json (ver Corrección 04).
  win.webContents.on('did-attach-webview', (event, contents) => {
    let partitionDeEstaWebview = null;
    for (const [p, s] of _feSesionesEnganchadas.entries()) {
      if (s === contents.session) { partitionDeEstaWebview = p; break; }
    }
    if (!partitionDeEstaWebview) return;

    // AGREGADO NUEVO (Agregado 01 — Atajo Ctrl+B para búsqueda rápida de
    // clientes): mientras el usuario trabaja normalmente en el portal de
    // Hacienda, el foco del teclado queda DENTRO de este <webview> — un
    // WebContents aparte del de la ventana principal. Un keydown escuchado
    // en el documento de index.html nunca se entera de esas teclas, así
    // que hay que interceptarlas aquí, sobre el propio webContents del
    // <webview> (antes de que la página del portal las reciba), y
    // reenviar el atajo a la ventana principal por IPC para que sea
    // index.html quien abra/cierre el panel flotante de búsqueda rápida.
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (!(input.control || input.meta) || input.alt || input.shift) return;
      if ((input.key || '').toLowerCase() !== 'b') return;
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('fe-atajo-busqueda-rapida');
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      let host = '';
      try { host = new URL(url).hostname; } catch (e) { /* noop */ }

      // Corrección 05 — Hacienda abre la pestaña nueva inicialmente en
      // "about:blank" (todavía sin dominio) y RECIÉN DESPUÉS, ya con la
      // ventana abierta, la redirige hacia el PDF. Si aquí solo se
      // aceptara el dominio oficial, esa apertura en about:blank quedaba
      // bloqueada y la pestaña nunca llegaba a existir para poder navegar
      // al PDF (ese era el bug: new URL('about:blank').hostname es '' y
      // nunca coincide con 'admin.factura.gob.sv'). Por eso se permite
      // about:blank explícitamente aquí; el candado de dominio se aplica
      // de todas formas más abajo, en 'did-create-window', validando la
      // PRIMERA navegación real que haga esa pestaña.
      const esAboutBlank = (url === 'about:blank' || host === '');
      if (!esAboutBlank && host !== 'admin.factura.gob.sv') {
        console.warn('[Facturación Electrónica] Se bloqueó una pestaña nueva fuera del portal oficial:', url);
        return { action: 'deny' };
      }
      // Corrección 08, punto 1 — la pestaña sigue oculta (el usuario no
      // necesita verla), pero ahora SÍ se le permite cargar normalmente
      // hasta mostrar el visor de PDF de Chromium (igual que cuando
      // estaba visible y la descarga manual funcionaba) — se agrega
      // backgroundThrottling:false para que, al estar oculta, Chromium no
      // le baje la prioridad a sus temporizadores/JS y el visor tarde lo
      // mismo en aparecer que si estuviera visible. El clic en
      // "Descargar" se automatiza más abajo, en 'did-create-window'.
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: false,
          webPreferences: {
            partition: partitionDeEstaWebview,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
          }
        }
      };
    });

    // Corrección 08 — Automatiza la descarga del PDF simulando el clic
    // real sobre el botón "Descargar" del visor de PDF de Chromium
    // (<cr-icon-button id="save">), en vez de intentar reconstruir o
    // interceptar la URL del PDF a mano (la Corrección 07 intentó eso y
    // falló: Hacienda no siempre navega esa pestaña de forma directa a
    // una URL descargable — a veces el PDF se carga dentro del propio
    // visor interno, así que 'will-navigate' nunca llegaba a dispararse
    // con una URL útil, y la pestaña oculta se quedaba sin hacer nada).
    // Ahora se dej a la pestaña cargar TAL CUAL lo hacía cuando estaba
    // visible (igual comportamiento, solo que sin mostrarla), y una vez
    // que termina de cargar se busca el botón de descarga atravesando
    // los Shadow DOM del visor (son de tipo "open", por eso se puede
    // encontrar así) y se le simula un clic. Ese clic dispara la MISMA
    // descarga que el 'will-download' de la sesión compartida ya
    // organiza y renombra igual que el .json (Corrección 04).
    contents.on('did-create-window', (childWindow) => {
      try {
        console.log('[Facturación Electrónica][debug] se creó la pestaña oculta del PDF (about:blank).');

        childWindow.webContents.on('will-navigate', (navEvent, navUrl) => {
          let navHost = '';
          try { navHost = new URL(navUrl).hostname; } catch (e) { /* noop */ }
          console.log('[Facturación Electrónica][debug] will-navigate en la pestaña del PDF ->', navUrl);
          if (navHost !== 'admin.factura.gob.sv') {
            console.warn('[Facturación Electrónica] Se bloqueó una navegación fuera del portal oficial en la pestaña del PDF:', navUrl);
            navEvent.preventDefault();
            if (!childWindow.isDestroyed()) childWindow.destroy();
          }
          // Si es del dominio oficial, se deja continuar la navegación
          // normalmente — es necesario que el visor cargue de verdad
          // para poder simular el clic de descarga más abajo.
        });

        childWindow.webContents.on('did-finish-load', () => {
          console.log('[Facturación Electrónica][debug] did-finish-load en la pestaña del PDF, URL actual:', childWindow.webContents.getURL());
          _feIntentarClickDescargarPdf(childWindow, 15);
        });
      } catch (e) {
        console.warn('[Facturación Electrónica] No se pudo asegurar la pestaña del PDF:', e.message);
      }
    });
  });

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => { callback({ cancel: true }); }
  );

  win.loadFile('index.html');

  // did-finish-load: volver a forzar el título porque Electron lo sobreescribe con el <title> del HTML al cargar
  win.webContents.on('did-finish-load', () => {
    win.setTitle(winTitle);
  });

  win.once('ready-to-show', () => {
    win.setTitle(winTitle);
    win.show();
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Error al cargar:', errorCode, errorDescription);
  });
}

// ══════════════════════════════════════════════════════════════════════
// AGREGADO NUEVO (Cambio 04): CONFIGURACIÓN DE IMPRESIÓN DE LIBROS LEGALES
// Cada libro (compras, cf, ccf) tiene su propia configuración independiente
// de márgenes, espaciados y posiciones. Se guarda en print-config.json
// dentro de userData, separado del resto de la configuración del sistema.
// ══════════════════════════════════════════════════════════════════════
const PRINT_CONFIG_DEFAULTS = {
  marginTopCm: 0.6,
  marginBottomCm: 0.6,
  marginLeftCm: 0.6,
  marginRightCm: 0.6,
  headerPaddingTop: 8,
  headerPaddingBottom: 20,
  lineHeight: 1.3,
  rowPaddingV: 3,
  cellPaddingH: 4,
  tableOffsetX: 0,
  tableOffsetY: 0,
  fontSize: 7
};

function getPrintConfigPath() {
  return path.join(app.getPath('userData'), 'print-config.json');
}

function readPrintConfig() {
  try {
    const p = getPrintConfigPath();
    if (!fs.existsSync(p)) {
      return { compras: Object.assign({}, PRINT_CONFIG_DEFAULTS), cf: Object.assign({}, PRINT_CONFIG_DEFAULTS), ccf: Object.assign({}, PRINT_CONFIG_DEFAULTS) };
    }
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    // Rellena con defaults cualquier campo faltante (por si se agregan parámetros nuevos a futuro)
    ['compras', 'cf', 'ccf'].forEach(function(tipo) {
      parsed[tipo] = Object.assign({}, PRINT_CONFIG_DEFAULTS, parsed[tipo] || {});
    });
    return parsed;
  } catch (e) {
    return { compras: Object.assign({}, PRINT_CONFIG_DEFAULTS), cf: Object.assign({}, PRINT_CONFIG_DEFAULTS), ccf: Object.assign({}, PRINT_CONFIG_DEFAULTS) };
  }
}

function writePrintConfig(cfg) {
  fs.writeFileSync(getPrintConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

ipcMain.handle('get-print-config', async () => {
  try {
    return { ok: true, config: readPrintConfig(), defaults: PRINT_CONFIG_DEFAULTS };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Recibe { tipo: 'compras'|'cf'|'ccf', config: {...} } — reemplaza la config de ESE libro únicamente
ipcMain.handle('set-print-config', async (event, { tipo, config }) => {
  try {
    if (['compras', 'cf', 'ccf'].indexOf(tipo) === -1) return { ok: false, error: 'Tipo de libro inválido' };
    const all = readPrintConfig();
    all[tipo] = Object.assign({}, PRINT_CONFIG_DEFAULTS, all[tipo], config || {});
    writePrintConfig(all);
    return { ok: true, config: all[tipo] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Recibe { tipo } — restaura ESE libro a los valores originales del programa
ipcMain.handle('reset-print-config', async (event, { tipo }) => {
  try {
    if (['compras', 'cf', 'ccf'].indexOf(tipo) === -1) return { ok: false, error: 'Tipo de libro inválido' };
    const all = readPrintConfig();
    all[tipo] = Object.assign({}, PRINT_CONFIG_DEFAULTS);
    writePrintConfig(all);
    return { ok: true, config: all[tipo] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// AGREGADO NUEVO (Cambio 03): CONFIGURACIÓN DE RUTAS DE EXPORTACIÓN
// Permite al usuario elegir dónde se guardan los CSV y los PDF, en vez de
// usar siempre el Escritorio. Se guarda en un archivo aparte dentro de
// userData, independiente del store principal (fiscaldata.json).
// Si no hay configuración (o se restablece), se usa el Escritorio por defecto.
// ══════════════════════════════════════════════════════════════════════
function getExportConfigPath() {
  return path.join(app.getPath('userData'), 'export-config.json');
}

function readExportConfig() {
  try {
    const p = getExportConfigPath();
    if (!fs.existsSync(p)) return { csvPath: null, pdfPath: null };
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return { csvPath: parsed.csvPath || null, pdfPath: parsed.pdfPath || null };
  } catch (e) {
    return { csvPath: null, pdfPath: null };
  }
}

function writeExportConfig(cfg) {
  fs.writeFileSync(getExportConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

ipcMain.handle('get-export-config', async () => {
  try {
    return { ok: true, config: readExportConfig() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('set-export-config', async (event, { csvPath, pdfPath }) => {
  try {
    const current = readExportConfig();
    const next = {
      csvPath: (csvPath !== undefined) ? csvPath : current.csvPath,
      pdfPath: (pdfPath !== undefined) ? pdfPath : current.pdfPath
    };
    writeExportConfig(next);
    return { ok: true, config: next };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('reset-export-config', async () => {
  try {
    writeExportConfig({ csvPath: null, pdfPath: null });
    return { ok: true, config: { csvPath: null, pdfPath: null } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// EXPORTACIÓN AUTOMÁTICA ORGANIZADA POR AÑO, MES Y EMPRESA
// Centraliza todos los documentos generados por FiscalSync en:
//   [Raíz]/FiscalSync/FiscalSync [Año]/FiscalSync - [Mes] [Año]/[Empresa]/
// [Raíz] es el Escritorio por defecto, o la carpeta configurada por el
// usuario en Admin > Sistema > Rutas de exportación (Cambio 03).
// Las carpetas se crean únicamente si no existen; si ya existen se reutilizan.
// ══════════════════════════════════════════════════════════════════════
function sanitizeFolderName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .replace(/\s+/g, ' ') || 'Sin_Nombre';
}

// Devuelve (y crea si hace falta) la carpeta de destino para una empresa y un mes dados.
// mesLabel esperado con formato "Nombre_del_Mes Año" (ej. "Julio 2026").
// tipo: 'csv' | 'pdf' — determina qué carpeta raíz configurada usar (Cambio 03).
function getExportDir(mesLabel, empresaNombre, tipo) {
  const cfg = readExportConfig();
  const customRoot = tipo === 'pdf' ? cfg.pdfPath : cfg.csvPath;
  const rootBase = (customRoot && fs.existsSync(customRoot)) ? customRoot : app.getPath('desktop');

  // Extrae el año del mesLabel (ej. "Julio 2026" -> "2026").
  // Si por algún motivo no viene el año en el texto, usa el año actual como respaldo.
  const yearMatch = String(mesLabel || '').match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const rootDir     = path.join(rootBase, 'FiscalSync');
  const yearDir     = path.join(rootDir, 'FiscalSync ' + year);
  const mesDir      = path.join(yearDir, 'FiscalSync - ' + sanitizeFolderName(mesLabel));
  const empresaDir  = path.join(mesDir, sanitizeFolderName(empresaNombre));

  if (!fs.existsSync(rootDir))     fs.mkdirSync(rootDir, { recursive: true });
  if (!fs.existsSync(yearDir))     fs.mkdirSync(yearDir, { recursive: true });
  if (!fs.existsSync(mesDir))      fs.mkdirSync(mesDir, { recursive: true });
  if (!fs.existsSync(empresaDir))  fs.mkdirSync(empresaDir, { recursive: true });

  return empresaDir;
}

// ══════════════════════════════════════════════════════════════════════
// Corrección 04, puntos 2-5 — Carpeta de Facturación Electrónica dentro de
// la MISMA estructura que ya usa Gestión (getExportDir de arriba), para no
// tener una segunda lógica de carpetas independiente:
// [Raíz]/FiscalSync/FiscalSync [Año]/FiscalSync - [Mes]/[Empresa]/Facturacion/
// Se crea solo si no existe; si ya existe (con archivos o sin ellos) se
// reutiliza tal cual — nunca se borra ni sobrescribe nada.
// ══════════════════════════════════════════════════════════════════════
function _feGetFacturacionDir(mesLabel, empresaNombre) {
  const empresaDir = getExportDir(mesLabel, empresaNombre, 'pdf');
  const facturacionDir = path.join(empresaDir, 'Facturacion');
  if (!fs.existsSync(facturacionDir)) fs.mkdirSync(facturacionDir, { recursive: true });
  return facturacionDir;
}

// ══════════════════════════════════════════════════════════════════════
// IMPLEMENTACIÓN 01 — Gestión → Correos DTE: búsqueda alternativa de PDF/JSON
// Antes de armar los adjuntos de un correo, el renderer llama a este handler
// para resolver la ruta real de cada archivo:
//   1) Si la ruta actual del documento (doc.pdfPath / doc.jsonPath) existe
//      físicamente, se usa tal cual (sin tocarla).
//   2) Si no existe, se busca en la MISMA carpeta que ya usa Facturación
//      Electrónica para esa empresa/mes (_feGetFacturacionDir de arriba —
//      no se crea una estructura de carpetas nueva), usando el Código de
//      Generación como nombre base (codigoBase + '.pdf' / '.json').
// No copia, mueve ni modifica ningún archivo — solo localiza rutas.
// Cada archivo (pdf/json) se resuelve de forma independiente.
// ══════════════════════════════════════════════════════════════════════
function _feResolverUnAdjunto(currentPath, dir, codigoBase, ext) {
  if (currentPath) {
    try { if (fs.existsSync(currentPath)) return { path: currentPath, origen: 'actual' }; } catch (e) { /* ignorar y continuar buscando */ }
  }
  if (codigoBase) {
    const candidato = path.join(dir, codigoBase + ext);
    try { if (fs.existsSync(candidato)) return { path: candidato, origen: 'facturacion' }; } catch (e) { /* no encontrado */ }
  }
  return { path: null, origen: 'ninguno' };
}

ipcMain.handle('fe-resolver-adjuntos-correo', async (event, { pdfPath, jsonPath, mesLabel, empresaNombre, codigoBase } = {}) => {
  try {
    const dir  = _feGetFacturacionDir(mesLabel, empresaNombre);
    const pdf  = _feResolverUnAdjunto(pdfPath  || '', dir, codigoBase, '.pdf');
    const json = _feResolverUnAdjunto(jsonPath || '', dir, codigoBase, '.json');
    return {
      ok: true,
      pdfPath:   pdf.path,
      pdfOrigen: pdf.origen,
      jsonPath:  json.path,
      jsonOrigen: json.origen
    };
  } catch (e) {
    return { error: e.message };
  }
});

// fe-set-context — el renderer llama esto cada vez que el usuario entra a
// Facturación Electrónica o cambia el selector de "Mes de trabajo" (ver
// _feEnviarContexto en index.html), para que las descargas de esa empresa
// (JSON automático y PDF desde la pestaña nueva) se guarden en la carpeta
// correcta. Mientras el usuario no cambie el mes, todo lo que se descargue
// sigue yendo al mismo período — cambiar el mes redirige los PRÓXIMOS
// archivos, sin tocar los ya guardados.
ipcMain.handle('fe-set-context', async (event, { empresaId, mesLabel, empresaNombre } = {}) => {
  try {
    if (!empresaId) return { error: 'empresaId es requerido' };
    const partition = 'persist:facturacion-electronica-' + empresaId;
    const anterior = _feContextos[partition] || {};
    _feContextos[partition] = {
      mesLabel: mesLabel || _feMesLabelPorDefecto(),
      empresaNombre: empresaNombre || anterior.empresaNombre || 'Empresa',
      ultimoJsonBase: anterior.ultimoJsonBase || null
    };
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// Implementación 02 — Facturación Electrónica: CLIENTES (llenado de
// formularios en el portal de Hacienda).
//
// Esta lista de clientes es independiente del catálogo de "Clientes" que
// ya usan Gestión / Escaneo QR (Libro de Ventas): aquí solo se guardan los
// datos que se necesitan para autocompletar los formularios de admin.
// factura.gob.sv (Factura, CCF, FSE, Nota de Crédito).
//
// Se guarda en disco, UN archivo JSON por empresa
// (userData/facturacion-electronica-clientes/<empresaId>.json),
// independiente de la carpeta mensual de PDF/JSON (esa carpeta cambia de
// mes en mes; los clientes de un comprador no deberían perderse ni
// duplicarse al cambiar el "Mes de trabajo").
// ══════════════════════════════════════════════════════════════════════
function _feClientesDir() {
  const dir = path.join(app.getPath('userData'), 'facturacion-electronica-clientes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function _feClientesPath(empresaId) {
  return path.join(_feClientesDir(), sanitizeFolderName(String(empresaId)) + '.json');
}

function _feClientesLeer(empresaId) {
  try {
    const p = _feClientesPath(empresaId);
    if (!fs.existsSync(p)) return [];
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[Facturación Electrónica][Clientes] Error leyendo clientes:', e.message);
    return [];
  }
}

function _feClientesGuardar(empresaId, clientes) {
  try {
    fs.writeFileSync(_feClientesPath(empresaId), JSON.stringify(clientes || [], null, 2), 'utf8');
    return true;
  } catch (e) {
    console.warn('[Facturación Electrónica][Clientes] Error guardando clientes:', e.message);
    return false;
  }
}

// Mismo orden de columnas que ya usaba la extensión de Chrome retirada,
// para que un CSV exportado por ella (o por versiones anteriores) se
// pueda seguir importando aquí sin conversión manual.
const _FE_CSV_HEADER = 'Modos,TipoDoc,Numero,Nombre,Actividad,Depto,Muni,Distrito,Direccion,Tel,Email,NombreComercial,NRC,ActividadFSE,NitCCF';

// Parser CSV genérico (RFC 4180): procesa TODO el contenido carácter por
// carácter en vez de cortar primero por líneas — así un campo entre
// comillas que contenga comas, comillas escapadas ("") o incluso un salto
// de línea literal no rompe el resto de las columnas. Devuelve un arreglo
// de filas, cada fila un arreglo de valores de columna (strings, ya sin
// las comillas envolventes).
function _feParsearCSVFilas(contenido) {
  const text = String(contenido || '');
  const filas = [];
  let fila = [];
  let campo = '';
  let dentroComillas = false;
  const len = text.length;
  let i = 0;
  while (i < len) {
    const ch = text[i];
    if (dentroComillas) {
      if (ch === '"') {
        if (text[i + 1] === '"') { campo += '"'; i += 2; continue; }
        dentroComillas = false; i++; continue;
      }
      campo += ch; i++; continue;
    }
    if (ch === '"') { dentroComillas = true; i++; continue; }
    if (ch === ',') { fila.push(campo); campo = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { fila.push(campo); campo = ''; filas.push(fila); fila = []; i++; continue; }
    campo += ch; i++;
  }
  // Última fila si el archivo no termina con salto de línea.
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

// Convierte las filas ya separadas en clientes con la estructura "plana"
// que usa el resto de esta sección (modos/tDoc/num/nom/act/dep/mun/dis/
// com/tel/cor/nomCom/nrc/actFse/nitCcf), respetando el mismo mapeo que ya
// usaba el importador anterior. Los campos numéricos (Numero/NRC/NitCCF/
// Tel) se conservan como texto para no perder ceros a la izquierda. Los
// campos vacíos se conservan vacíos: no se inventa información.
// Devuelve { clientes, errores } — "errores" lista filas con muy pocas
// columnas como para representar un cliente, junto con su número de fila.
function _feClientesParsearCSV(contenido) {
  const filas = _feParsearCSVFilas(contenido);
  const nuevos = [];
  const errores = [];
  for (let i = 1; i < filas.length; i++) { // i = 1: se salta el encabezado
    const f = filas[i];
    if (!f || !f.length || (f.length === 1 && !f[0].trim())) continue; // fila vacía
    if (f.length < 4) { errores.push({ fila: i + 1, motivo: 'Columnas insuficientes (' + f.length + ')' }); continue; }
    nuevos.push({
      modos: (f[0] || '').split(';').map(m => m.trim().toUpperCase()).filter(Boolean),
      tDoc: (f[1] || '').trim(),
      num: (f[2] || '').trim(),
      nom: (f[3] || '').trim(),
      act: (f[4] || '').trim(),
      dep: (f[5] || '').trim().padStart(2, '0'),
      mun: (f[6] || '').trim().padStart(2, '0'),
      dis: (f[7] || '').trim(),
      com: (f[8] || '').trim(),
      tel: (f[9] || '').trim(),
      cor: (f[10] || '').trim(),
      nomCom: (f[11] || '').trim(),
      nrc: (f[12] || '').trim(),
      actFse: (f[13] || '').trim(),
      nitCcf: (f[14] || '').trim()
    });
  }
  return { clientes: nuevos, errores: errores };
}

// ── Detección de duplicados / fusión con clientes ya existentes ─────────
// Identificadores de negocio de un cliente (NIT CCF, NRC, TipoDoc+Numero).
// Solo se usan los que vienen no vacíos: dos clientes con NIT CCF vacío en
// ambos NO se consideran "coincidentes" por eso.
function _feClientesIdentificadores(c) {
  const ids = [];
  if (c && c.nitCcf && String(c.nitCcf).trim()) ids.push('nit:' + String(c.nitCcf).trim());
  if (c && c.nrc && String(c.nrc).trim()) ids.push('nrc:' + String(c.nrc).trim());
  if (c && c.tDoc && c.num && String(c.tDoc).trim() && String(c.num).trim()) {
    ids.push('doc:' + String(c.tDoc).trim() + ':' + String(c.num).trim());
  }
  return ids;
}

// Busca, dentro de la lista ya guardada, el índice de un cliente que
// comparta al menos un identificador con la fila importada. -1 si no hay
// coincidencia (es decir, es un cliente nuevo).
function _feClientesBuscarExistente(clientesExistentes, nuevo) {
  const idsNuevo = _feClientesIdentificadores(nuevo);
  if (!idsNuevo.length) return -1;
  for (let i = 0; i < clientesExistentes.length; i++) {
    const idsExistente = _feClientesIdentificadores(clientesExistentes[i]);
    for (let j = 0; j < idsNuevo.length; j++) {
      if (idsExistente.indexOf(idsNuevo[j]) !== -1) return i;
    }
  }
  return -1;
}

// Arma la estructura porModo para una fila importada: los datos propios
// del tipo de documento (tDoc/num/nitCcf/nrc/nomCom/act/actFse) se
// replican para CADA modo que trae esa fila (el CSV de la extensión
// anterior no distinguía datos por modo dentro de una misma fila).
function _feClientesPorModoDesdeFila(fila) {
  const porModo = {};
  (fila.modos || []).forEach(function(m) {
    porModo[m] = {
      tDoc: fila.tDoc || '',
      num: fila.num || '',
      nitCcf: fila.nitCcf || (fila.tDoc === '36' ? (fila.num || '') : ''),
      nrc: fila.nrc || '',
      nomCom: fila.nomCom || '',
      act: fila.act || '',
      actFse: fila.actFse || ''
    };
  });
  return porModo;
}

// Crea un cliente nuevo (estructura interna completa, con porModo) a
// partir de una fila importada.
function _feClientesCrearDesdeImportacion(fila) {
  return {
    modos: fila.modos || [],
    nom: fila.nom || '',
    tDoc: fila.tDoc || '',
    num: fila.num || '',
    nitCcf: fila.nitCcf || '',
    nrc: fila.nrc || '',
    nomCom: fila.nomCom || '',
    act: fila.act || '',
    actFse: fila.actFse || '',
    porModo: _feClientesPorModoDesdeFila(fila),
    dep: fila.dep || '',
    mun: fila.mun || '',
    dis: fila.dis || '',
    com: fila.com || '',
    tel: fila.tel || '',
    cor: fila.cor || ''
  };
}

// Fusiona un cliente ya existente con una fila importada que coincidió
// con él (mismo NIT CCF, NRC o TipoDoc+Numero). Reglas (ver punto 14 del
// pedido): no se pierde información ya guardada.
//   - Los campos de texto del CSV solo sobrescriben si vienen NO vacíos;
//     si el CSV trae el campo vacío, se conserva el valor ya guardado.
//   - "modos" se UNE (no se reemplaza): si el cliente ya era válido para
//     un modo que este CSV no trae, lo sigue siendo.
//   - "porModo" se actualiza/crea solo para los modos que trae ESTA fila,
//     sin tocar los datos por modo que el cliente ya tenía para otros
//     tipos de documento.
function _feClientesFusionar(existente, fila) {
  const combinado = Object.assign({}, existente);
  ['nom', 'act', 'dep', 'mun', 'dis', 'com', 'tel', 'cor', 'nomCom', 'nrc', 'actFse', 'nitCcf', 'tDoc', 'num'].forEach(function(campo) {
    if (fila[campo] && String(fila[campo]).trim()) combinado[campo] = fila[campo];
  });
  const modosExistentes = (Array.isArray(existente.modos) && existente.modos.length) ? existente.modos.slice() : (existente.modo ? [existente.modo] : []);
  (fila.modos || []).forEach(function(m) { if (modosExistentes.indexOf(m) === -1) modosExistentes.push(m); });
  combinado.modos = modosExistentes;
  combinado.porModo = Object.assign({}, existente.porModo || {}, _feClientesPorModoDesdeFila(fila));
  return combinado;
}

function _feClientesACSV(clientes) {
  const clean = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
  const modosDe = (c) => (Array.isArray(c.modos) && c.modos.length) ? c.modos : (c.modo ? [c.modo] : []);
  let csv = _FE_CSV_HEADER + '\n';
  (clientes || []).forEach((c) => {
    csv += `${modosDe(c).join(';')},${c.tDoc || ''},${c.num || ''},${clean(c.nom)},${clean(c.act)},${c.dep || ''},${c.mun || ''},${clean(c.dis)},${clean(c.com)},${clean(c.tel)},${clean(c.cor)},${clean(c.nomCom)},${clean(c.nrc)},${clean(c.actFse)},${clean(c.nitCcf)}\n`;
  });
  return csv;
}

// Lee la lista completa de clientes de una empresa.
ipcMain.handle('fe-clientes-leer', async (event, { empresaId } = {}) => {
  if (!empresaId) return { error: 'empresaId es requerido' };
  return { ok: true, clientes: _feClientesLeer(empresaId) };
});

// Sobrescribe la lista completa de clientes de una empresa (alta, edición
// y borrado se resuelven en el renderer sobre el array completo, y este
// handler simplemente lo persiste).
ipcMain.handle('fe-clientes-guardar', async (event, { empresaId, clientes } = {}) => {
  if (!empresaId) return { error: 'empresaId es requerido' };
  const ok = _feClientesGuardar(empresaId, clientes || []);
  return ok ? { ok: true } : { error: 'No se pudo guardar el archivo de clientes.' };
});

// Diálogo nativo para elegir un CSV e importarlo (se AGREGA a los
// clientes ya existentes de la empresa, no los reemplaza).
ipcMain.handle('fe-clientes-importar-csv', async (event, { empresaId } = {}) => {
  if (!empresaId) return { error: 'empresaId es requerido' };
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(win, {
    title: 'Importar clientes desde CSV',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  try {
    const contenido = fs.readFileSync(res.filePaths[0], 'utf8');
    const parseo = _feClientesParsearCSV(contenido);
    const filasNuevas = parseo.clientes;
    const actuales = _feClientesLeer(empresaId);

    let nuevosCount = 0;
    let actualizadosCount = 0;
    filasNuevas.forEach(function(fila) {
      const idxExistente = _feClientesBuscarExistente(actuales, fila);
      if (idxExistente !== -1) {
        actuales[idxExistente] = _feClientesFusionar(actuales[idxExistente], fila);
        actualizadosCount++;
      } else {
        actuales.push(_feClientesCrearDesdeImportacion(fila));
        nuevosCount++;
      }
    });

    _feClientesGuardar(empresaId, actuales);
    return {
      ok: true,
      clientes: actuales,
      agregados: nuevosCount, // se conserva por compatibilidad con llamadores anteriores
      procesados: filasNuevas.length,
      nuevos: nuevosCount,
      actualizados: actualizadosCount,
      errores: parseo.errores.length,
      detalleErrores: parseo.errores
    };
  } catch (e) {
    return { error: 'No se pudo leer el archivo: ' + e.message };
  }
});

// Diálogo nativo para elegir dónde guardar el CSV exportado.
ipcMain.handle('fe-clientes-exportar-csv', async (event, { empresaId, empresaNombre } = {}) => {
  if (!empresaId) return { error: 'empresaId es requerido' };
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showSaveDialog(win, {
    title: 'Exportar clientes a CSV',
    defaultPath: `Clientes_${sanitizeFolderName(empresaNombre || String(empresaId))}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  try {
    fs.writeFileSync(res.filePath, _feClientesACSV(_feClientesLeer(empresaId)), 'utf8');
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { error: 'No se pudo guardar el archivo: ' + e.message };
  }
});

// save-export-file — Guarda cualquier archivo exportado (CSV, XLS, JSON, etc.)
// directamente en [Raíz]/FiscalSync/FiscalSync [Año]/FiscalSync - [Mes]/[Empresa]/ sin mostrar ningún diálogo.
// Recibe: { mes, empresa, fileName, content, encoding }
ipcMain.handle('save-export-file', async (event, { mes, empresa, fileName, content, encoding }) => {
  try {
    const destDir  = getExportDir(mes, empresa, 'csv');
    const safeName = String(fileName || 'archivo').replace(/[\\/:*?"<>|]/g, '_');
    const destPath = path.join(destDir, safeName);
    fs.writeFileSync(destPath, content, encoding || 'utf8');
    return { ok: true, path: destPath };
  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar carpeta con PDFs y JSONs',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('read-folder', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    return files.map(f => {
      const ext  = path.extname(f).toLowerCase();
      const name = path.basename(f, ext);
      return { name, ext, full: f };
    });
  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// select-folder-jsons — devuelve rutas absolutas de todos los .json (recursivo)
ipcMain.handle('select-folder-jsons', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Seleccionar carpeta con JSONs de ventas',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths.length) return { files: [] };
    function getAllJsons(dir, results) {
      results = results || [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) getAllJsons(full, results);
        else if (entry.name.toLowerCase().endsWith('.json')) results.push(full);
      }
      return results;
    }
    return { files: getAllJsons(result.filePaths[0]) };
  } catch (e) {
    return { files: [], error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('read-json', async (event, folderPath, fileName) => {
  try {
    const fullPath = path.join(folderPath, fileName);
    const raw = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('print-pdf', async (event, folderPath, fileName) => {
  try {
    const pdfPath = path.join(folderPath, fileName);
    if (!fs.existsSync(pdfPath)) return { error: 'Archivo no encontrado: ' + fileName };
    const errMsg = await shell.openPath(pdfPath);
    if (errMsg) return { error: errMsg };
    await new Promise(r => setTimeout(r, 1500));
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('direct-print', async (event, folderPath, fileName) => {
  try {
    const pdfPath = path.join(folderPath, fileName);
    if (!fs.existsSync(pdfPath)) return { error: 'Archivo no encontrado: ' + fileName };

    return await new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      printWin.loadURL('file://' + pdfPath.replace(/\\/g, '/'));

      printWin.webContents.once('did-finish-load', () => {
        // Esperar 1200ms antes de imprimir — fix Windows 10: PDF viewer necesita tiempo para renderizar
        setTimeout(() => {
          printWin.webContents.print(
            { silent: true, printBackground: true, margins: { marginType: 'none' } },
            (success, reason) => {
              printWin.destroy();
              if (success) resolve({ ok: true });
              else resolve({ error: reason || 'Error al imprimir' });
            }
          );
        }, 1200);
      });

      printWin.webContents.once('did-fail-load', () => {
        printWin.destroy();
        resolve({ error: 'No se pudo cargar el PDF para imprimir' });
      });

      setTimeout(() => {
        if (!printWin.isDestroyed()) printWin.destroy();
        resolve({ error: 'Timeout al imprimir ' + fileName });
      }, 30000);
    });

  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('direct-print-dialog', async (event, folderPath, fileName, options) => {
  try {
    const pdfPath = path.join(folderPath, fileName);
    if (!fs.existsSync(pdfPath)) return { error: 'Archivo no encontrado: ' + fileName };
    const grayscale = !!(options && options.grayscale);

    return await new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      printWin.loadURL('file://' + pdfPath.replace(/\\/g, '/'));

      printWin.webContents.once('did-finish-load', () => {
        // Esperar 1200ms — fix Windows 10: PDF viewer necesita tiempo para renderizar
        setTimeout(() => {
          const printOpts = {
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' }
          };
          // Bug 5 fix: aplicar escala de grises si se solicita
          if (grayscale) printOpts.color = false;
          printWin.webContents.print(
            printOpts,
            (success, reason) => {
              // Obtener la impresora que el usuario eligió en el diálogo
              printWin.webContents.getPrintersAsync().then((printers) => {
                printWin.destroy();
                if (success) {
                  const def = printers.find(p => p.isDefault);
                  resolve({ ok: true, printerName: def ? def.name : null });
                } else {
                  if (reason === 'Print job canceled') resolve({ canceled: true });
                  else resolve({ error: reason || 'Error al imprimir' });
                }
              }).catch(() => {
                printWin.destroy();
                if (success) resolve({ ok: true, printerName: null });
                else resolve({ canceled: true });
              });
            }
          );
        }, 1200);
      });

      printWin.webContents.once('did-fail-load', () => {
        printWin.destroy();
        resolve({ error: 'No se pudo cargar el PDF para imprimir' });
      });

      setTimeout(() => {
        if (!printWin.isDestroyed()) printWin.destroy();
        resolve({ error: 'Timeout al imprimir ' + fileName });
      }, 60000);
    });

  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// Imprime un PDF en silencio en una impresora específica por nombre
// Fix robusto: espera did-finish-load + delay adaptativo + verify content loaded
ipcMain.handle('direct-print-to', async (event, folderPath, fileName, printerName, options) => {
  try {
    const pdfPath = path.join(folderPath, fileName);
    if (!fs.existsSync(pdfPath)) return { error: 'Archivo no encontrado: ' + fileName };
    const grayscale = !!(options && options.grayscale);

    return await new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          plugins: true
        }
      });

      let settled = false;
      function settle(result) {
        if (settled) return;
        settled = true;
        if (!printWin.isDestroyed()) printWin.destroy();
        resolve(result);
      }

      // Timeout global de seguridad
      const globalTimeout = setTimeout(() => {
        settle({ error: 'Timeout al imprimir ' + fileName });
      }, 45000);

      printWin.loadURL('file:///' + pdfPath.replace(/\\/g, '/'));

      printWin.webContents.once('did-finish-load', () => {
        // Delay de 2000ms — tiempo suficiente para que el plugin PDF de Chromium
        // termine de renderizar el contenido antes de enviar al spooler
        setTimeout(() => {
          if (printWin.isDestroyed()) return;
          const printOptions = {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: 'Letter'
          };
          if (printerName) printOptions.deviceName = printerName;
          // Bug 5 fix: escala de grises para impresión en serie
          if (grayscale) printOptions.color = false;
          printWin.webContents.print(printOptions, (success, reason) => {
            clearTimeout(globalTimeout);
            if (success) settle({ ok: true });
            else settle({ error: reason || 'Error al imprimir' });
          });
        }, 2000);
      });

      printWin.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(globalTimeout);
        settle({ error: 'No se pudo cargar el PDF: ' + errorDescription });
      });
    });

  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// send-email — Equivalente al VBA CDO/SMTP Gmail SSL 465
// Requiere: npm install nodemailer  (en la raíz del proyecto)
// mailOptions: { from, to, cc, bcc, subject, text, html, attachments:[{path}] }
// smtpConfig:  { host, port, secure, auth:{ user, pass }, connectionTimeout }
ipcMain.handle('send-email', async (event, { mailOptions, smtpConfig }) => {
  try {
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (e) {
      return { error: 'nodemailer no instalado. Ejecuta: npm install nodemailer en la carpeta del proyecto. (' + e.message + ')' };
    }

    // Crear transporte SMTP igual que VBA: smtp.gmail.com:465 SSL + autenticación
    const transporter = nodemailer.createTransport({
      host:              smtpConfig.host   || 'smtp.gmail.com',
      port:              smtpConfig.port   || 465,
      secure:            smtpConfig.secure !== false,
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass
      },
      connectionTimeout: smtpConfig.connectionTimeout || 30000,
      greetingTimeout:   smtpConfig.greetingTimeout   || 15000,
      socketTimeout:     smtpConfig.socketTimeout      || 30000
    });

    // Construir opciones igual que VBA: .To .CC .BCC .Subject .TextBody .AddAttachment
    const sendOptions = {
      from:    mailOptions.from,
      to:      mailOptions.to,
      subject: mailOptions.subject,
      text:    mailOptions.text
    };
    // AGREGADO NUEVO — Plantilla visual "01 · Azul profesional": el
    // renderer (index.html) ahora arma también un cuerpo HTML
    // (mailOptions.html) además del texto plano de siempre. Antes este
    // archivo lo descartaba porque sendOptions solo copiaba "text", así
    // que el cliente de correo (Gmail, etc.) nunca veía el diseño, solo
    // el texto plano. Se reenvía tal cual, sin modificar el resto de la
    // lógica de envío (SMTP, adjuntos, cc/bcc).
    if (mailOptions.html && String(mailOptions.html).trim()) {
      sendOptions.html = mailOptions.html;
    }
    if (mailOptions.cc  && String(mailOptions.cc).trim())  sendOptions.cc  = mailOptions.cc;
    if (mailOptions.bcc && String(mailOptions.bcc).trim()) sendOptions.bcc = mailOptions.bcc;

    // Adjuntos — verificar existencia antes de adjuntar (igual que VBA: If Dir(path) <> "")
    if (Array.isArray(mailOptions.attachments) && mailOptions.attachments.length > 0) {
      sendOptions.attachments = mailOptions.attachments.filter(a => {
        if (!a || !a.path) return false;
        try { return fs.existsSync(a.path); } catch (e) { return false; }
      });
    }

    const info = await transporter.sendMail(sendOptions);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { error: err.message || 'Error desconocido al enviar correo' };
  }
});

// ══════════════════════════════════════════════════════════════════════
// CAMBIO 7 — Almacenamiento en disco
// Guarda todos los datos de la app en un archivo JSON local en la máquina
// Ruta: app.getPath('userData')/fiscaldata.json  (ej. %AppData%/FiscalSync/)
// ══════════════════════════════════════════════════════════════════════
function getFiscalDataPath() {
  return path.join(app.getPath('userData'), 'fiscaldata.json');
}

ipcMain.handle('fs-read-store', async () => {
  try {
    const p = getFiscalDataPath();
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  } catch(e) {
    console.error('fs-read-store error:', e.message);
    return null;
  }
});

ipcMain.handle('fs-write-store', async (event, jsonStr) => {
  try {
    const p = getFiscalDataPath();
    fs.writeFileSync(p, jsonStr, 'utf8');
    return { ok: true };
  } catch(e) {
    console.error('fs-write-store error:', e.message);
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// Corrección 02 — Imprimir Libro Legal desde HTML aislado
//
// El renderer NO usa window.print() sobre la ventana principal.
// Recibe exactamente el mismo snapshot HTML que usa save-libro-pdf,
// lo carga en una BrowserWindow independiente y solo imprime cuando
// Chromium confirma que el documento y la tabla están renderizados.
//
// No se utiliza un delay fijo como condición de renderizado.
// La espera se basa en:
//   1) did-finish-load
//   2) document.readyState
//   3) document.fonts.ready (si existe)
//   4) dos requestAnimationFrame consecutivos
//   5) verificación real de la tabla y de sus dimensiones
// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('print-libro-html', async (event, { htmlContent, tipo }) => {
  if (typeof htmlContent !== 'string' || !htmlContent.trim()) {
    return { error: 'No se recibió contenido HTML para imprimir.' };
  }

  const tiposValidos = new Set(['compras', 'cf', 'ccf']);
  if (!tiposValidos.has(tipo)) {
    return { error: 'Tipo de Libro Legal no válido: ' + tipo };
  }

  const tableIds = {
    compras: 'llComprasTable',
    cf: 'llCfTable',
    ccf: 'llCcfTable'
  };
  const expectedTableId = tableIds[tipo];

  return await new Promise((resolve) => {
    let printWin = null;
    let settled = false;
    let globalTimeout = null;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (globalTimeout) clearTimeout(globalTimeout);

      if (printWin && !printWin.isDestroyed()) {
        try { printWin.destroy(); } catch (_) {}
      }
      printWin = null;
      resolve(result);
    };

    globalTimeout = setTimeout(() => {
      settle({ error: 'Tiempo de espera agotado al preparar el Libro Legal para impresión.' });
    }, 60000);

    try {
      printWin = new BrowserWindow({
        show: false,
        width: 1400,
        height: 1000,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: true,
          webSecurity: true
        }
      });

      // Cargar el MISMO documento HTML aislado que se usa para generar el PDF.
      printWin.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
      );

      printWin.webContents.once('did-fail-load', (loadEvent, errorCode, errorDescription) => {
        settle({
          error: 'No se pudo cargar el documento de impresión: ' +
            (errorDescription || errorCode || 'error desconocido')
        });
      });

      printWin.webContents.once('did-finish-load', async () => {
        if (!printWin || printWin.isDestroyed()) return;

        try {
          // Espera basada en el estado real del documento, no en un
          // número arbitrario de milisegundos.
          const readiness = await printWin.webContents.executeJavaScript(
            `(async function() {
              if (document.readyState !== 'complete') {
                await new Promise(function(resolve) {
                  if (document.readyState === 'complete') {
                    resolve();
                    return;
                  }
                  window.addEventListener('load', resolve, { once: true });
                });
              }

              if (document.fonts && document.fonts.ready) {
                try { await document.fonts.ready; } catch (_) {}
              }

              await new Promise(function(resolve) {
                requestAnimationFrame(function() {
                  requestAnimationFrame(resolve);
                });
              });

              var table = document.getElementById(${JSON.stringify(expectedTableId)});
              if (!table) {
                return {
                  ok: false,
                  error: 'La tabla ' + ${JSON.stringify(expectedTableId)} + ' no existe en el documento de impresión.'
                };
              }

              var rect = table.getBoundingClientRect();
              var rows = table.querySelectorAll('tr').length;
              var textLength = (table.innerText || table.textContent || '').trim().length;

              return {
                ok: rect.width > 0 && rect.height > 0 && rows > 0 && textLength > 0,
                width: rect.width,
                height: rect.height,
                rows: rows,
                textLength: textLength
              };
            })()`,
            true
          );

          if (!readiness || !readiness.ok) {
            settle({
              error: (readiness && readiness.error) ||
                'El contenido del Libro Legal no terminó de renderizarse correctamente.'
            });
            return;
          }

          if (!printWin || printWin.isDestroyed()) return;

          // Imprimir el contenido de la BrowserWindow independiente.
          // silent:false mantiene el diálogo nativo de impresión.
          // La orientación coincide con la configuración del Libro:
          // CF = vertical; Compras/CCF = horizontal.
          printWin.webContents.print(
            {
              silent: false,
              printBackground: true,
              landscape: tipo !== 'cf',
              pageSize: 'Letter',
              margins: { marginType: 'none' }
            },
            (success, reason) => {
              if (success) {
                settle({ ok: true });
              } else if (reason === 'Print job canceled' || reason === 'User canceled') {
                settle({ canceled: true });
              } else {
                settle({ error: reason || 'El proceso de impresión fue cancelado o falló.' });
              }
            }
          );
        } catch (err) {
          settle({ error: err.message || 'Error preparando el contenido de impresión.' });
        }
      });
    } catch (err) {
      settle({ error: err.message || 'No se pudo crear la ventana de impresión.' });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// save-libro-pdf — Genera PDF silencioso desde HTML del libro contable
// Recibe: { htmlContent: string, fileName: string, mes: string, empresa: string }
// Guarda automáticamente en: [Raíz]/FiscalSync/FiscalSync [Año]/FiscalSync - [Mes]/[Empresa]/<fileName>.pdf
// ([Raíz] = Escritorio por defecto, o la carpeta configurada en Admin > Sistema)
// No muestra ningún diálogo — proceso completamente silencioso
// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('save-libro-pdf', async (event, { htmlContent, fileName, mes, empresa }) => {
  try {
    // Nombre seguro: reemplazar caracteres no válidos en nombre de archivo
    const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    const safeFileName = safeName.endsWith('.pdf') ? safeName : safeName + '.pdf';

    // Carpeta destino automática: [Raíz]/FiscalSync/FiscalSync [Año]/FiscalSync - [Mes]/[Empresa]/
    // Se crea únicamente si no existe; si ya existe se reutiliza.
    const destDir  = getExportDir(mes, empresa, 'pdf');
    const savePath = path.join(destDir, safeFileName);

    return await new Promise((resolve) => {
      // Ventana oculta con el mismo tamaño que una hoja carta landscape
      const pdfWin = new BrowserWindow({
        show: false,
        width: 1100,
        height: 850,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          javascript: true
        }
      });

      let settled = false;
      function settle(result) {
        if (settled) return;
        settled = true;
        if (!pdfWin.isDestroyed()) pdfWin.destroy();
        resolve(result);
      }

      // Timeout de seguridad global
      const globalTimeout = setTimeout(() => {
        settle({ error: 'Timeout al generar PDF' });
      }, 30000);

      // Cargar el HTML directamente como data URL
      pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

      pdfWin.webContents.once('did-finish-load', () => {
        // Esperar 800ms para que los estilos terminen de aplicarse
        setTimeout(() => {
          if (pdfWin.isDestroyed()) return;
          pdfWin.webContents.printToPDF({
            landscape: true,
            pageSize: 'Letter',
            printBackground: true,
            margins: {
              marginType: 'custom',
              top:    0.3,
              bottom: 0.3,
              left:   0.3,
              right:  0.3
            }
          }).then((pdfData) => {
            clearTimeout(globalTimeout);
            fs.writeFileSync(savePath, pdfData);
            settle({ ok: true, path: savePath });
          }).catch((err) => {
            clearTimeout(globalTimeout);
            settle({ error: err.message || 'Error al generar PDF' });
          });
        }, 800);
      });

      pdfWin.webContents.once('did-fail-load', (ev, code, desc) => {
        clearTimeout(globalTimeout);
        settle({ error: 'No se pudo cargar el HTML: ' + desc });
      });
    });

  } catch (e) {
    return { error: e.message };
  }
});

// ══════════════════════════════════════════════════════════════════════
// CAMBIO 9 — Verificación de Estado DGII
// Automatiza el formulario público de consulta de DTE del Ministerio de
// Hacienda (https://admin.factura.gob.sv/consultaPublica) usando una
// ventana de Electron oculta (nunca visible al usuario). Se reutiliza la
// misma ventana para todo un lote de documentos para no recargar la app
// Angular en cada consulta — solo se re-llenan los campos y se vuelve a
// presionar "Realizar Búsqueda".
// No requiere credenciales: la página no tiene reCAPTCHA (confirmado).
// ══════════════════════════════════════════════════════════════════════
const DGII_CONSULTA_URL = 'https://admin.factura.gob.sv/consultaPublica';

// Vocabulario de estados oficiales que puede devolver el Ministerio.
// Se busca por coincidencia de texto (insensible a mayúsculas) sobre el
// texto visible de la página luego de la búsqueda.
const DGII_ESTADOS = [
  { code: 'TRANSMITIDO',    match: ['transmitido satisfactoriamente', 'procesado'] },
  { code: 'INVALIDADO',     match: ['invalidado'] },
  { code: 'RECHAZADO',      match: ['rechazado'] },
  { code: 'CON_EVENTO',     match: ['con evento', 'evento de'] },
  { code: 'NO_ENCONTRADO',  match: ['no se encontr', 'no existe', 'no encontrado', 'sin resultados'] }
];

let _dgiiWins = {};       // pool de ventanas ocultas, una por "carril" (slot) cuando se corre en paralelo
let _dgiiCancelado = false;

// AGREGADO — Detección de "Hacienda no disponible" (punto 24 de la
// especificación de la notificación persistente). No es un estado nuevo
// inventado del lado del front: se apoya en la misma señal que ya existía
// (un documento termina en ERROR incluso después de su único reintento
// automático), pero mirada a nivel de LOTE — si varios documentos SEGUIDOS
// (entre todos los carriles activos) terminan así, es más probable que el
// Ministerio esté caído/lento que un problema puntual de un solo documento.
// _dgiiErroresConsecutivos se reinicia a 0 en cualquier resultado que NO sea
// ERROR (cualquier carril) y también al iniciar un lote nuevo (ver
// 'reset-cancelacion-dte' más abajo). _dgiiPausaHaciendaPromise evita que,
// si varios carriles llegan al umbral casi al mismo tiempo, se disparen
// varias pausas/avisos superpuestos: el primero en llegar crea la pausa
// compartida y los demás simplemente la esperan.
let _dgiiErroresConsecutivos = 0;
let _dgiiPausaHaciendaPromise = null;
const DGII_UMBRAL_HACIENDA_NO_DISPONIBLE = 3;        // documentos seguidos fallando tras su reintento
const DGII_ESPERA_HACIENDA_NO_DISPONIBLE_MS = 20000; // pausa respetuosa antes de reintentar (20s)

// Ejecuta (o espera, si ya está en curso) la pausa por "Hacienda no
// disponible": avisa al renderer, espera, avisa que se reanuda, y reinicia
// el contador de errores consecutivos. No cancela el lote ni descarta
// ningún documento — el llamador decide qué hacer con el resultado después.
function _dgiiEsperarSiHaciendaCaida(event) {
  if (_dgiiPausaHaciendaPromise) return _dgiiPausaHaciendaPromise;
  _dgiiPausaHaciendaPromise = (async () => {
    try {
      event.sender.send('dgii-hacienda-no-disponible', { segundos: Math.round(DGII_ESPERA_HACIENDA_NO_DISPONIBLE_MS / 1000) });
    } catch (e) {}
    console.warn('[DGII] Varios documentos seguidos fallaron tras su reintento — posible caída del Ministerio de Hacienda. Pausando ' + (DGII_ESPERA_HACIENDA_NO_DISPONIBLE_MS / 1000) + 's...');
    await _dgiiSleep(DGII_ESPERA_HACIENDA_NO_DISPONIBLE_MS);
    if (!_dgiiCancelado) {
      try { event.sender.send('dgii-hacienda-disponible'); } catch (e) {}
    }
    _dgiiErroresConsecutivos = 0;
    _dgiiPausaHaciendaPromise = null;
  })();
  return _dgiiPausaHaciendaPromise;
}

// Devuelve (o crea) la ventana oculta correspondiente a un carril (slot).
// Cada carril tiene su propia partición de sesión para poder correr varias
// consultas en paralelo sin que se pisen entre sí (cada uno con su propio
// formulario/resultado independiente en la página del Ministerio).
function _dgiiGetWindow(slot) {
  slot = slot || 0;
  if (_dgiiWins[slot] && !_dgiiWins[slot].isDestroyed()) return _dgiiWins[slot];
  const win = new BrowserWindow({
    // Oculta: el flujo ya está confirmado y probado, corre en silencio sin
    // mostrar ninguna ventana al usuario.
    show: false,
    width: 1500,
    height: 850,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      javascript: true,
      // Sesión propia y aislada por carril — NO comparte el session.defaultSession
      // que el resto de la app mantiene bloqueado. Así esta ventana navega
      // con libertad total (necesaria para que carguen Cloudflare, fuentes,
      // y cualquier otro recurso de terceros que la página del Ministerio
      // necesite) sin tener que ir adivinando qué dominios permitir, y sin
      // aflojar el bloqueo de red del resto del programa ni un poco. Cada
      // carril usa su propia partición para poder correr en paralelo sin
      // que un carril pise el formulario/resultado de otro.
      partition: 'dgii-consulta-aislada-' + slot
    }
  });
  win.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
    console.error('[DGII][slot ' + slot + '] did-fail-load:', errorCode, errorDescription, validatedURL);
  });
  win.webContents.on('did-finish-load', () => {
    console.log('[DGII][slot ' + slot + '] did-finish-load — URL actual:', win.webContents.getURL());
  });
  win.webContents.on('did-navigate', (e, url) => {
    console.log('[DGII][slot ' + slot + '] did-navigate:', url);
  });
  win.on('closed', () => { if (_dgiiWins[slot] === win) _dgiiWins[slot] = null; });
  _dgiiWins[slot] = win;
  return win;
}

function _dgiiSleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Espera hasta que el texto visible de la página contenga alguna de las
// frases reconocidas de DGII_ESTADOS (o hasta agotar timeoutMs). En vez de
// esperar un cambio de texto genérico y luego leer a ciegas tras un margen
// fijo, se pregunta directamente "¿ya hay un estado reconocible?" en cada
// intervalo — así el margen se adapta solo: si la respuesta llega rápido,
// se detecta rápido; si tarda, se sigue esperando en vez de leer temprano.
// Devuelve el bodyText en el que se detectó el estado, o el último bodyText
// leído si se agotó el tiempo sin reconocer ninguna frase (para no perder
// la información de diagnóstico en ese caso).
async function _dgiiEsperarResultado(win, timeoutMs, step) {
  const start = Date.now();
  let bodyText = '';
  while (Date.now() - start < timeoutMs) {
    if (_dgiiCancelado) break;
    try {
      bodyText = await win.webContents.executeJavaScript("document.body.innerText || ''", true);
    } catch (e) { bodyText = ''; }
    const lower = bodyText.toLowerCase();
    for (const item of DGII_ESTADOS) {
      for (const frase of item.match) {
        if (lower.indexOf(frase) !== -1) return bodyText;
      }
    }
    await _dgiiSleep(step);
  }
  return bodyText; // timeout: se devuelve lo último leído aunque no se haya reconocido nada
}

// Espera hasta que una expresión evaluada en la página deje de ser falsy,
// revisando cada `step` ms hasta agotar `timeoutMs`.
async function _dgiiWaitFor(win, expression, timeoutMs, step) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (_dgiiCancelado) return false;
    let ok = false;
    try { ok = await win.webContents.executeJavaScript(expression, true); } catch (e) { ok = false; }
    if (ok) return true;
    await _dgiiSleep(step);
  }
  return false;
}

// Consulta un único DTE. Devuelve { estado, textoOriginal } o { estado:'ERROR', error }.
async function _dgiiConsultarUno(fechaGeneracion, codigoGeneracion, slot) {
  const win = _dgiiGetWindow(slot);
  const logPrefix = '[DGII][slot ' + (slot || 0) + ']';

  // Se recarga la página SIEMPRE, en cada documento. Tras una búsqueda,
  // Angular reemplaza el formulario por una vista de resultado, así que
  // reutilizar la misma pantalla para el siguiente documento no es
  // confiable. Recargar garantiza partir siempre del formulario limpio.
  // El navegador ya cachea los archivos de la app tras la primera carga,
  // así que las recargas siguientes deberían ser bastante más rápidas
  // que el arranque en frío inicial.
  console.log(logPrefix + ' Cargando página...');
  try {
    await win.loadURL(DGII_CONSULTA_URL);
  } catch (e) {
    console.error(logPrefix + ' loadURL error:', e.message);
    return { estado: 'ERROR', error: 'No se pudo cargar la página del Ministerio: ' + e.message };
  }

  // Esperar a que Angular haya montado el formulario (el primer documento del
  // lote puede tardar bastante más — es cuando Angular arranca de cero)
  const listo = await _dgiiWaitFor(
    win,
    "!!(document.querySelector('input[formcontrolname=\"fechaGeneracion\"]') && document.querySelector('input[formcontrolname=\"codGen\"]'))",
    35000, 300
  );
  if (!listo) {
    console.error(logPrefix + ' Timeout esperando el formulario. URL actual:', await win.webContents.executeJavaScript('location.href', true).catch(() => '?'));
    return { estado: 'ERROR', error: 'La página del Ministerio no cargó a tiempo (timeout esperando el formulario)' };
  }
  console.log(logPrefix + ' Formulario detectado, llenando campos...');

  // Llenar los campos como lo haría un usuario (setter nativo + evento 'input'
  // para que Angular reactive forms detecte el cambio)
  const fillScript = `
    (function() {
      function setVal(el, val) {
        var proto = Object.getPrototypeOf(el);
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      var fechaEl = document.querySelector('input[formcontrolname="fechaGeneracion"]');
      var codEl   = document.querySelector('input[formcontrolname="codGen"]');
      if (!fechaEl || !codEl) return false;
      setVal(fechaEl, ${JSON.stringify(fechaGeneracion)});
      setVal(codEl, ${JSON.stringify(codigoGeneracion)});
      return true;
    })();
  `;
  const llenado = await win.webContents.executeJavaScript(fillScript, true).catch((e) => { console.error(logPrefix + ' Error llenando campos:', e.message); return false; });
  if (!llenado) return { estado: 'ERROR', error: 'No se pudieron llenar los campos del formulario' };
  console.log(logPrefix + ' Campos llenados, presionando Buscar...');

  const clickScript = `
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var buscar = btns.find(function(b) { return (b.textContent || '').trim().indexOf('Realizar Búsqueda') !== -1; });
      if (!buscar) return false;
      buscar.click();
      return true;
    })();
  `;
  const clickeado = await win.webContents.executeJavaScript(clickScript, true).catch((e) => { console.error(logPrefix + ' Error al hacer clic en Buscar:', e.message); return false; });
  if (!clickeado) return { estado: 'ERROR', error: 'No se encontró el botón "Realizar Búsqueda" en la página' };
  console.log(logPrefix + ' Buscar presionado, esperando resultado...');

  // Esperar a que aparezca una frase reconocible de DGII_ESTADOS (en vez de
  // esperar un cambio de texto genérico + margen fijo). Timeout de 18s: da
  // tiempo real a una respuesta lenta del Ministerio, sin ser tan largo como
  // para chocar con el límite de 50s del handler de arriba.
  const bodyText = await _dgiiEsperarResultado(win, 18000, 300);
  const lower = bodyText.toLowerCase();
  if (!DGII_ESTADOS.some((item) => item.match.some((frase) => lower.indexOf(frase) !== -1))) {
    console.warn(logPrefix + ' No se reconoció ningún estado tras 18s de espera — puede que la búsqueda esté tardando más de lo esperado.');
  }

  // Extraer el Sello de Recepción del resultado (si la página lo muestra).
  // Se busca el <label> cuyo texto sea "Sello de Recepción" y se toma el
  // siguiente <label> con contenido como el valor del sello. Es puramente
  // informativo — no afecta la detección de estado de arriba, y si no se
  // encuentra simplemente se devuelve cadena vacía. Se extrae siempre
  // (para cualquier libro), pero solo el Libro de Compras lo usa para
  // completar el campo "Sello de Recepción" — ver dgiiIniciarVerificacion
  // en index.html.
  const selloScript = `
    (function() {
      try {
        function norm(s) {
          return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        }
        var labels = Array.from(document.querySelectorAll('label'));
        var idx = labels.findIndex(function(l) { return norm(l.textContent).indexOf('sello de recepcion') !== -1; });
        if (idx === -1) return '';
        for (var i = idx + 1; i < labels.length; i++) {
          var txt = (labels[i].textContent || '').trim();
          if (txt && norm(txt).indexOf('sello de recepcion') === -1) return txt;
        }
        return '';
      } catch (e) { return ''; }
    })();
  `;
  const selloRecepcion = await win.webContents.executeJavaScript(selloScript, true).catch(() => '');
  if (selloRecepcion) console.log(logPrefix + ' Sello de Recepción detectado en la consulta.');

  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) {
        console.log(logPrefix + ' Resultado detectado:', item.code);
        return { estado: item.code, textoOriginal: frase, selloRecepcion: selloRecepcion };
      }
    }
  }
  console.warn(logPrefix + ' No se reconoció ninguna frase de estado en la respuesta. Texto recibido (primeros 300 caracteres):', bodyText.slice(0, 300));
  return { estado: 'ERROR', error: 'No se pudo interpretar la respuesta de la página (revisa la consola para ver el texto recibido)', selloRecepcion: selloRecepcion };
}

// Corre _dgiiConsultarUno con un límite de 50s. Si se agota el tiempo, la
// operación abandonada puede seguir viva dentro de la ventana del carril —
// como Promise.race por sí solo no la detiene, se destruye la ventana de ese
// carril para que la próxima consulta arranque de una ventana limpia en vez
// de reutilizar una que todavía podría estar navegando o rellenando el
// formulario del documento anterior. La ventana se vuelve a crear sola (ver
// _dgiiGetWindow) la próxima vez que se necesite ese carril.
async function _dgiiConsultarConTimeout(fechaGeneracion, codigoGeneracion, slot) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      const slotKey = slot || 0;
      const w = _dgiiWins[slotKey];
      if (w && !w.isDestroyed()) { try { w.destroy(); } catch (e) {} }
      _dgiiWins[slotKey] = null;
      resolve({ estado: 'ERROR', error: 'Tiempo de espera agotado (50s) consultando el documento' });
    }, 50000);
  });
  const resultado = await Promise.race([_dgiiConsultarUno(fechaGeneracion, codigoGeneracion, slot), timeout]);
  clearTimeout(timeoutId);
  return resultado;
}

// ARREGLO 02 — REGLA CRÍTICA DEL REINTENTO (punto 2 y 17 de la especificación):
// este handler YA NO reintenta el documento de forma inmediata dentro de la
// misma llamada IPC. Antes, si el primer intento daba ERROR, aquí mismo se
// disparaba un segundo `_dgiiConsultarConTimeout(...)` pegado al primero, sin
// respetar el intervalo obligatorio de 15 segundos. Eso quedó eliminado por
// completo: ahora, si la consulta falla, el resultado ERROR se devuelve tal
// cual al renderer en su primer y único intento por llamada. Es el renderer
// (ver correrColaSecuencial()/procesarDocumento() en index.html) quien decide
// marcar el documento como "Pendiente de reintento" y reincorporarlo al FINAL
// de la cola real, para que su reintento se procese más adelante como un
// turno normal más — pasando otra vez por correrColaSecuencial() y, por lo
// tanto, respetando también los 15 segundos obligatorios en el reintento.
// No se elimina la capacidad de reintentar: solo cambia DÓNDE y CUÁNDO
// ocurre (ver ARREGLO 02, punto 31 — regla final).
ipcMain.handle('verificar-dte-mh', async (event, fechaGeneracion, codigoGeneracion, slot) => {
  try {
    if (!fechaGeneracion || !codigoGeneracion) {
      return { estado: 'ERROR', error: 'Documento sin fecha o código de generación' };
    }
    let resultado = await _dgiiConsultarConTimeout(fechaGeneracion, codigoGeneracion, slot);

    // AGREGADO — "Hacienda no disponible" (se conserva igual que en ARREGLO
    // 01, punto 24): sigue siendo una señal de LOTE, no del documento
    // individual — varios documentos SEGUIDOS terminando en ERROR (ahora en
    // su único intento por llamada, ya que el reintento inmediato dejó de
    // existir arriba) sugieren que el Ministerio está caído/lento, no un
    // problema puntual de un solo documento. Al llegar al umbral, se pausa
    // de forma respetuosa, se avisa al renderer, y se le da a ESTE documento
    // una oportunidad más una vez pasada la pausa. Esto NO es el "reintento
    // inmediato" que ARREGLO 02 prohíbe: es una espera real de ~20s por
    // posible caída del servicio (afecta a todo el lote, no solo a este
    // documento) y no un segundo intento pegado al primero para este mismo
    // documento en condiciones normales.
    if (resultado.estado === 'ERROR' && !_dgiiCancelado) {
      _dgiiErroresConsecutivos++;
      if (_dgiiErroresConsecutivos >= DGII_UMBRAL_HACIENDA_NO_DISPONIBLE) {
        await _dgiiEsperarSiHaciendaCaida(event);
        if (!_dgiiCancelado) {
          resultado = await _dgiiConsultarConTimeout(fechaGeneracion, codigoGeneracion, slot);
        }
      }
    } else if (resultado.estado !== 'ERROR') {
      _dgiiErroresConsecutivos = 0; // cualquier éxito corta la racha de errores
    }

    return resultado;
  } catch (e) {
    return { estado: 'ERROR', error: e.message || 'Error desconocido al consultar el Ministerio de Hacienda' };
  }
});

// ══════════════════════════════════════════════════════════════════════
// CAMBIO 01 — Escaneo de Documentos Físicos vía QR (Libro de Compras)
//
// Reutiliza el patrón ya probado de _dgiiGetWindow/_dgiiWaitFor/_dgiiSleep
// y el vocabulario DGII_ESTADOS de arriba, pero con una función de
// extracción MÁS AMPLIA (extraerCamposCompras) que además del Estado y el
// Sello de Recepción (que ya extraía selloScript) también saca: Tipo de
// DTE, Fecha y Hora de Generación, Monto Total de la Operación e IVA
// percibido — campos que _dgiiConsultarUno nunca necesitó y por eso nunca
// extrajo. No se modifica ninguna línea de _dgiiConsultarUno, DGII_ESTADOS,
// ni de los handlers ya existentes: este bloque solo agrega funciones
// hermanas, llamadas exclusivamente desde el flujo de escaneo QR.
//
// Usa su propio "carril" de ventana oculta ('qr'), separado de los carriles
// numéricos (0,1,2…) que usa la verificación en lote, para poder escanear
// documentos sin pisar ni esperar a un lote de Consulta DTE que esté
// corriendo al mismo tiempo.
// ══════════════════════════════════════════════════════════════════════
const QR_SLOT = 'qr-compras';

// Extrae, en un solo executeJavaScript, todos los labels que necesita el
// autocompletado de "Nuevo Registro — Compras". Devuelve texto crudo tal
// cual aparece en la página; la interpretación/mapeo se hace después en
// _dgiiConsultarParaCompras. Nunca lanza — ante cualquier error devuelve
// cadenas vacías para los campos que no pudo leer.
async function extraerCamposCompras(win) {
  const script = `
    (function() {
      function norm(s) {
        return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      }
      // Corrección 02 — ahora acepta un solo texto o un arreglo de textos
      // candidatos (para labels cuyo texto exacto en la página puede variar
      // ligeramente). Prueba cada candidato en orden y devuelve el primer
      // valor encontrado; si ninguno aparece, devuelve ''. No cambia el
      // comportamiento para las llamadas existentes (que siguen pasando un
      // solo string).
      // Corrección 06 — "total de la operacion" es substring de "monto total
      // de la operacion" (el label que ya usamos para montoTotal). Antes,
      // valorDespuesDeLabel encontraba ESE MISMO label al buscar
      // totalOperacion (porque lo contiene) y devolvía el valor del
      // siguiente label del DOM (p.ej. el de IVA percibido), mostrando un
      // número que no correspondía al total real. Ahora se excluye
      // cualquier label que también contenga "monto", para que sólo
      // encuentre un label "Total de la Operación" standalone (si existe
      // en la página) y no el de "Monto Total de la Operación".
      function valorDespuesDeLabel(labels, buscado, excluirSiContiene) {
        var candidatos = Array.isArray(buscado) ? buscado : [buscado];
        var excluir = excluirSiContiene || [];
        for (var b = 0; b < candidatos.length; b++) {
          var needle = candidatos[b];
          var idx = labels.findIndex(function(l) {
            var t = norm(l.textContent);
            if (t.indexOf(needle) === -1) return false;
            for (var e = 0; e < excluir.length; e++) { if (t.indexOf(excluir[e]) !== -1) return false; }
            return true;
          });
          if (idx === -1) continue;
          for (var i = idx + 1; i < labels.length; i++) {
            var txt = (labels[i].textContent || '').trim();
            if (txt && norm(txt).indexOf(needle) === -1) return txt;
          }
        }
        return '';
      }
      try {
        var labels = Array.from(document.querySelectorAll('label'));
        return {
          tipoDte:      valorDespuesDeLabel(labels, 'tipo de dte'),
          fechaHora:    valorDespuesDeLabel(labels, 'fecha y hora de generacion'),
          sello:        valorDespuesDeLabel(labels, 'sello de recepcion'),
          montoTotal:   valorDespuesDeLabel(labels, 'monto total de la operacion'),
          ivaPercibido: valorDespuesDeLabel(labels, 'iva percibido'),
          numeroControl: valorDespuesDeLabel(labels, 'numero de control'),
          retencionRenta: valorDespuesDeLabel(labels, 'retencion renta'),
          // Corrección 02 — 3 campos adicionales, solo para mostrarlos en el
          // resumen visual del modal de Documento Escaneado (index.html).
          // No participan en ningún mapeo/cálculo/validación existente.
          ivaOperaciones: valorDespuesDeLabel(labels, ['iva de las operaciones', 'iva de operaciones']),
          ivaRetenido:    valorDespuesDeLabel(labels, 'iva retenido'),
          totalOperacion: valorDespuesDeLabel(labels, ['total de la operacion', 'total operacion', 'total de operacion'], ['monto'])
        };
      } catch (e) {
        return { tipoDte: '', fechaHora: '', sello: '', montoTotal: '', ivaPercibido: '', numeroControl: '', retencionRenta: '', ivaOperaciones: '', ivaRetenido: '', totalOperacion: '' };
      }
    })();
  `;
  return await win.webContents.executeJavaScript(script, true).catch(() => ({
    tipoDte: '', fechaHora: '', sello: '', montoTotal: '', ivaPercibido: '', numeroControl: '', retencionRenta: '', ivaOperaciones: '', ivaRetenido: '', totalOperacion: ''
  }));
}

// Convierte un texto tipo "$1,234.56" o "1234.56" a número. Si no puede, devuelve 0.
function _parseMontoQr(texto) {
  const limpio = String(texto || '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

// Deriva el código de Tipo de Documento (03/05/06/11) a partir del texto
// exacto que muestra la consulta pública. Compartida entre Compras (Anexo
// 3) y Venta Crédito Fiscal. Cualquier otro valor -> null (no soportado aún).
function _mapearTipoDteQr(textoTipoDte) {
  const n = String(textoTipoDte || '').toUpperCase();
  if (n.indexOf('COMPROBANTE DE CRÉDITO FISCAL') !== -1 || n.indexOf('COMPROBANTE DE CREDITO FISCAL') !== -1) return '03';
  if (n.indexOf('NOTA DE CRÉDITO') !== -1 || n.indexOf('NOTA DE CREDITO') !== -1) return '05';
  // Cambio 04 — NOTA DE DÉBITO (código 06) agregada como documento
  // permitido en Compras — Anexo 3 y en Venta Crédito Fiscal (esta función
  // se comparte entre ambos módulos). Reutiliza el mismo reconocimiento de
  // texto que ya usa _mapearTipoDteQrRetencion para este mismo tipo.
  if (n.indexOf('NOTA DE DÉBITO') !== -1 || n.indexOf('NOTA DE DEBITO') !== -1) return '06';
  // Cambio 01 — FACTURA(S) DE EXPORTACIÓN (código 11) agregada como
  // documento permitido en Compras — Anexo 3.
  if (n.indexOf('FACTURA DE EXPORTACIÓN') !== -1 || n.indexOf('FACTURA DE EXPORTACION') !== -1 ||
      n.indexOf('FACTURAS DE EXPORTACIÓN') !== -1 || n.indexOf('FACTURAS DE EXPORTACION') !== -1) return '11';
  return null;
}

// Igual que _mapearTipoDteQr pero para el Libro de Ventas — Consumidor Final
// (Anexo 2): Factura -> 01, Nota de Crédito -> 05. Cualquier otro valor -> null.
function _mapearTipoDteQrCF(textoTipoDte) {
  const n = String(textoTipoDte || '').toUpperCase();
  if (n.indexOf('NOTA DE CRÉDITO') !== -1 || n.indexOf('NOTA DE CREDITO') !== -1) return '05';
  // Cambio 01 — FACTURA(S) DE EXPORTACIÓN (código 11) agregada como
  // documento permitido en Ventas Consumidor Final — Anexo 2. Debe
  // revisarse ANTES del chequeo genérico de 'FACTURA' de abajo: si no,
  // toda Factura de Exportación se identificaría por error como 01
  // (Factura Consumidor Final), porque su texto también contiene "FACTURA".
  if (n.indexOf('FACTURA DE EXPORTACIÓN') !== -1 || n.indexOf('FACTURA DE EXPORTACION') !== -1 ||
      n.indexOf('FACTURAS DE EXPORTACIÓN') !== -1 || n.indexOf('FACTURAS DE EXPORTACION') !== -1) return '11';
  if (n.indexOf('FACTURA') !== -1) return '01';
  return null;
}

// Igual que _mapearTipoDteQr pero para el Libro de Retenciones de IVA
// (Anexo 7): Comprobante de Retención -> 07, Nota de Crédito -> 05, Nota de
// Débito -> 06. Cualquier otro valor -> null (no soportado aún).
function _mapearTipoDteQrRetencion(textoTipoDte) {
  const n = String(textoTipoDte || '').toUpperCase();
  if (n.indexOf('COMPROBANTE DE RETENCIÓN') !== -1 || n.indexOf('COMPROBANTE DE RETENCION') !== -1) return '07';
  if (n.indexOf('NOTA DE CRÉDITO') !== -1 || n.indexOf('NOTA DE CREDITO') !== -1) return '05';
  if (n.indexOf('NOTA DE DÉBITO') !== -1 || n.indexOf('NOTA DE DEBITO') !== -1) return '06';
  return null;
}

// Igual que _mapearTipoDteQr pero para el Libro de Compras a Sujetos
// Excluidos (Anexo 5): Factura de Sujeto Excluido -> 14. Cualquier otro
// valor -> null (no soportado aún — ej. si por error se escanea otro tipo
// de documento en este modo).
function _mapearTipoDteQrSujetoExcluido(textoTipoDte) {
  const n = String(textoTipoDte || '').toUpperCase();
  if (n.indexOf('FACTURA DE SUJETO EXCLUIDO') !== -1) return '14';
  return null;
}

// Cambio 04 — La traducción de texto real de "Tipo de DTE" a identificador
// interno ahora vive centralizada en cat002.js (catálogo oficial CAT-002,
// 13 tipos) y se usa mediante cat002CodigoDesdeTexto(texto), requerido más
// arriba en este archivo. Antes existía aquí una función local
// (_canonTipoDteQR) limitada a 5 tipos con identificadores propios
// ('FACTURA','CCF','NC','RETENCION','EXCLUIDO') — se retira porque
// cat002CodigoDesdeTexto la reemplaza con el catálogo completo (13 tipos,
// códigos oficiales '01'..'18') sin cambiar el comportamiento para los 5
// tipos que ya funcionaban.

// Ejecuta la consulta pública igual que _dgiiConsultarUno (misma URL, mismo
// llenado de formulario, mismo botón "Realizar Búsqueda"), pero usando el
// carril QR_SLOT y llamando a extraerCamposCompras al final en vez de solo
// buscar el Sello. Devuelve el paquete ya interpretado y listo para el
// autocompletado del formulario de Compras.
async function _dgiiConsultarParaCompras(fechaGeneracion, codigoGeneracion) {
  const win = _dgiiGetWindow(QR_SLOT);
  const logPrefix = '[QR-Compras]';

  console.log(logPrefix + ' Cargando página...');
  try {
    await win.loadURL(DGII_CONSULTA_URL);
  } catch (e) {
    return { estado: 'ERROR', error: 'No se pudo cargar la página del Ministerio: ' + e.message };
  }

  const listo = await _dgiiWaitFor(
    win,
    "!!(document.querySelector('input[formcontrolname=\"fechaGeneracion\"]') && document.querySelector('input[formcontrolname=\"codGen\"]'))",
    35000, 300
  );
  if (!listo) {
    return { estado: 'ERROR', error: 'La página del Ministerio no cargó a tiempo (timeout esperando el formulario)' };
  }

  const fillScript = `
    (function() {
      function setVal(el, val) {
        var proto = Object.getPrototypeOf(el);
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      var fechaEl = document.querySelector('input[formcontrolname="fechaGeneracion"]');
      var codEl   = document.querySelector('input[formcontrolname="codGen"]');
      if (!fechaEl || !codEl) return false;
      setVal(fechaEl, ${JSON.stringify(fechaGeneracion)});
      setVal(codEl, ${JSON.stringify(codigoGeneracion)});
      return true;
    })();
  `;
  const llenado = await win.webContents.executeJavaScript(fillScript, true).catch(() => false);
  if (!llenado) return { estado: 'ERROR', error: 'No se pudieron llenar los campos del formulario' };

  const clickScript = `
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var buscar = btns.find(function(b) { return (b.textContent || '').trim().indexOf('Realizar Búsqueda') !== -1; });
      if (!buscar) return false;
      buscar.click();
      return true;
    })();
  `;
  const clickeado = await win.webContents.executeJavaScript(clickScript, true).catch(() => false);
  if (!clickeado) return { estado: 'ERROR', error: 'No se encontró el botón "Realizar Búsqueda" en la página' };

  const bodyText = await _dgiiEsperarResultado(win, 18000, 300);
  const lower = bodyText.toLowerCase();
  if (!DGII_ESTADOS.some((item) => item.match.some((frase) => lower.indexOf(frase) !== -1))) {
    console.warn(logPrefix + ' No se reconoció ningún estado tras 18s de espera.');
  }

  let estadoCode = 'ERROR';
  let estadoTexto = '';
  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) { estadoCode = item.code; estadoTexto = frase; break; }
    }
    if (estadoTexto) break;
  }

  const campos = await extraerCamposCompras(win);
  const tipoDocMapeado = _mapearTipoDteQr(campos.tipoDte);

  // "Fecha y Hora de Generación" viene como "31/07/2026 14:32:10" o similar —
  // se toma solo la parte de fecha y se normaliza a YYYY-MM-DD si se puede.
  let fechaSolo = fechaGeneracion; // respaldo: la que ya venía del QR
  const m = String(campos.fechaHora || '').match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) fechaSolo = m[3] + '-' + m[2] + '-' + m[1];
  else {
    const m2 = String(campos.fechaHora || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) fechaSolo = m2[0];
  }

  return {
    estado: estadoCode,
    estadoTexto: estadoTexto,
    tipoDocMapeado: tipoDocMapeado,       // '03' | '05' | '06' | '11' | null (no soportado aún)
    tipoDteTexto: campos.tipoDte || '',
    fecha: fechaSolo,
    selloRecepcion: campos.sello || '',
    montoTotal: _parseMontoQr(campos.montoTotal),
    ivaPercibido: _parseMontoQr(campos.ivaPercibido),
    // Corrección 02 — solo para el resumen visual del modal; no participan
    // en el mapeo/registro del Libro de Compras.
    ivaOperaciones: _parseMontoQr(campos.ivaOperaciones),
    ivaRetenido: _parseMontoQr(campos.ivaRetenido),
    totalOperacion: _parseMontoQr(campos.totalOperacion)
  };
}

// ── Consulta DGII para Ventas — Consumidor Final (Anexo 2) vía escaneo QR ──
// Mismo patrón que _dgiiConsultarParaCompras (misma URL, mismo formulario,
// mismo botón "Realizar Búsqueda"), pero usando su propio carril de ventana
// oculta (QR_SLOT_CF) para no pisar una consulta de Compras que esté
// corriendo al mismo tiempo, y mapeando el Tipo de DTE a los códigos que usa
// el Libro de Consumidor Final (01 Factura / 05 Nota de Crédito) en vez de
// los de Compras (03/05). También extrae el Número de Control, que Compras
// no necesita pero Consumidor Final sí (se usa como N° Resolución y como
// Control Interno DEL/AL).
const QR_SLOT_CF = 'qr-cf';

async function _dgiiConsultarParaCF(fechaGeneracion, codigoGeneracion) {
  const win = _dgiiGetWindow(QR_SLOT_CF);
  const logPrefix = '[QR-ConsumidorFinal]';

  console.log(logPrefix + ' Cargando página...');
  try {
    await win.loadURL(DGII_CONSULTA_URL);
  } catch (e) {
    return { estado: 'ERROR', error: 'No se pudo cargar la página del Ministerio: ' + e.message };
  }

  const listo = await _dgiiWaitFor(
    win,
    "!!(document.querySelector('input[formcontrolname=\"fechaGeneracion\"]') && document.querySelector('input[formcontrolname=\"codGen\"]'))",
    35000, 300
  );
  if (!listo) {
    return { estado: 'ERROR', error: 'La página del Ministerio no cargó a tiempo (timeout esperando el formulario)' };
  }

  const fillScript = `
    (function() {
      function setVal(el, val) {
        var proto = Object.getPrototypeOf(el);
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      var fechaEl = document.querySelector('input[formcontrolname="fechaGeneracion"]');
      var codEl   = document.querySelector('input[formcontrolname="codGen"]');
      if (!fechaEl || !codEl) return false;
      setVal(fechaEl, ${JSON.stringify(fechaGeneracion)});
      setVal(codEl, ${JSON.stringify(codigoGeneracion)});
      return true;
    })();
  `;
  const llenado = await win.webContents.executeJavaScript(fillScript, true).catch(() => false);
  if (!llenado) return { estado: 'ERROR', error: 'No se pudieron llenar los campos del formulario' };

  const clickScript = `
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var buscar = btns.find(function(b) { return (b.textContent || '').trim().indexOf('Realizar Búsqueda') !== -1; });
      if (!buscar) return false;
      buscar.click();
      return true;
    })();
  `;
  const clickeado = await win.webContents.executeJavaScript(clickScript, true).catch(() => false);
  if (!clickeado) return { estado: 'ERROR', error: 'No se encontró el botón "Realizar Búsqueda" en la página' };

  const bodyText = await _dgiiEsperarResultado(win, 18000, 300);
  const lower = bodyText.toLowerCase();
  if (!DGII_ESTADOS.some((item) => item.match.some((frase) => lower.indexOf(frase) !== -1))) {
    console.warn(logPrefix + ' No se reconoció ningún estado tras 18s de espera.');
  }

  let estadoCode = 'ERROR';
  let estadoTexto = '';
  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) { estadoCode = item.code; estadoTexto = frase; break; }
    }
    if (estadoTexto) break;
  }

  const campos = await extraerCamposCompras(win);
  const tipoDocMapeado = _mapearTipoDteQrCF(campos.tipoDte);

  let fechaSolo = fechaGeneracion; // respaldo: la que ya venía del QR
  const m = String(campos.fechaHora || '').match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) fechaSolo = m[3] + '-' + m[2] + '-' + m[1];
  else {
    const m2 = String(campos.fechaHora || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) fechaSolo = m2[0];
  }

  return {
    estado: estadoCode,
    estadoTexto: estadoTexto,
    tipoDocMapeado: tipoDocMapeado,       // '01' | '05' | '11' | null (no soportado aún)
    tipoDteTexto: campos.tipoDte || '',
    fecha: fechaSolo,
    selloRecepcion: campos.sello || '',
    numeroControl: campos.numeroControl || '',
    montoTotal: _parseMontoQr(campos.montoTotal),
    // Corrección 02 — solo para el resumen visual del modal; no participan
    // en el registro de Consumidor Final.
    ivaOperaciones: _parseMontoQr(campos.ivaOperaciones),
    ivaRetenido: _parseMontoQr(campos.ivaRetenido),
    totalOperacion: _parseMontoQr(campos.totalOperacion)
  };
}

// ── Consulta DGII para Retenciones de IVA (Anexo 7) vía escaneo QR ──
// Mismo patrón que _dgiiConsultarParaCF (misma URL, mismo formulario, mismo
// botón "Realizar Búsqueda"), pero usando su propio carril de ventana oculta
// (QR_SLOT_RETENCION) para no pisar una consulta de Compras/CF/CCF que esté
// corriendo al mismo tiempo, y mapeando el Tipo de DTE con
// _mapearTipoDteQrRetencion (07 Comprobante de Retención / 05 Nota de
// Crédito / 06 Nota de Débito) en vez de los mapeos que usan los otros
// libros. No requiere Número de Control (el registro de Retenciones no lo
// usa) — sí usa el Sello de Recepción (-> Serie de Documento) y el Monto
// Total de la Operación (-> Monto Sujeto), igual que ya extrae
// extraerCamposCompras para los demás libros.
const QR_SLOT_RETENCION = 'qr-retencion';

async function _dgiiConsultarParaRetencion(fechaGeneracion, codigoGeneracion) {
  const win = _dgiiGetWindow(QR_SLOT_RETENCION);
  const logPrefix = '[QR-Retencion]';

  console.log(logPrefix + ' Cargando página...');
  try {
    await win.loadURL(DGII_CONSULTA_URL);
  } catch (e) {
    return { estado: 'ERROR', error: 'No se pudo cargar la página del Ministerio: ' + e.message };
  }

  const listo = await _dgiiWaitFor(
    win,
    "!!(document.querySelector('input[formcontrolname=\"fechaGeneracion\"]') && document.querySelector('input[formcontrolname=\"codGen\"]'))",
    35000, 300
  );
  if (!listo) {
    return { estado: 'ERROR', error: 'La página del Ministerio no cargó a tiempo (timeout esperando el formulario)' };
  }

  const fillScript = `
    (function() {
      function setVal(el, val) {
        var proto = Object.getPrototypeOf(el);
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      var fechaEl = document.querySelector('input[formcontrolname="fechaGeneracion"]');
      var codEl   = document.querySelector('input[formcontrolname="codGen"]');
      if (!fechaEl || !codEl) return false;
      setVal(fechaEl, ${JSON.stringify(fechaGeneracion)});
      setVal(codEl, ${JSON.stringify(codigoGeneracion)});
      return true;
    })();
  `;
  const llenado = await win.webContents.executeJavaScript(fillScript, true).catch(() => false);
  if (!llenado) return { estado: 'ERROR', error: 'No se pudieron llenar los campos del formulario' };

  const clickScript = `
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var buscar = btns.find(function(b) { return (b.textContent || '').trim().indexOf('Realizar Búsqueda') !== -1; });
      if (!buscar) return false;
      buscar.click();
      return true;
    })();
  `;
  const clickeado = await win.webContents.executeJavaScript(clickScript, true).catch(() => false);
  if (!clickeado) return { estado: 'ERROR', error: 'No se encontró el botón "Realizar Búsqueda" en la página' };

  const bodyText = await _dgiiEsperarResultado(win, 18000, 300);
  const lower = bodyText.toLowerCase();
  if (!DGII_ESTADOS.some((item) => item.match.some((frase) => lower.indexOf(frase) !== -1))) {
    console.warn(logPrefix + ' No se reconoció ningún estado tras 18s de espera.');
  }

  let estadoCode = 'ERROR';
  let estadoTexto = '';
  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) { estadoCode = item.code; estadoTexto = frase; break; }
    }
    if (estadoTexto) break;
  }

  const campos = await extraerCamposCompras(win);
  const tipoDocMapeado = _mapearTipoDteQrRetencion(campos.tipoDte);

  let fechaSolo = fechaGeneracion; // respaldo: la que ya venía del QR
  const m = String(campos.fechaHora || '').match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) fechaSolo = m[3] + '-' + m[2] + '-' + m[1];
  else {
    const m2 = String(campos.fechaHora || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) fechaSolo = m2[0];
  }

  return {
    estado: estadoCode,
    estadoTexto: estadoTexto,
    tipoDocMapeado: tipoDocMapeado,       // '07' | '05' | '06' | null (no soportado aún)
    tipoDteTexto: campos.tipoDte || '',
    fecha: fechaSolo,
    selloRecepcion: campos.sello || '',
    montoTotal: _parseMontoQr(campos.montoTotal),
    // Corrección 02 — solo para el resumen visual del modal; no participan
    // en el registro de Retenciones (Anexo 7).
    ivaOperaciones: _parseMontoQr(campos.ivaOperaciones),
    ivaRetenido: _parseMontoQr(campos.ivaRetenido),
    totalOperacion: _parseMontoQr(campos.totalOperacion)
  };
}

// ── Consulta DGII para Ventas — Crédito Fiscal (Anexo 1) vía escaneo QR ──
// Mismo patrón que _dgiiConsultarParaCF (misma URL, mismo formulario, mismo
// botón "Realizar Búsqueda"), pero usando su propio carril de ventana oculta
// (QR_SLOT_CCF) para no pisar una consulta de Compras o de Consumidor Final
// que esté corriendo al mismo tiempo, y mapeando el Tipo de DTE con
// _mapearTipoDteQr (03 Comprobante de Crédito Fiscal / 05 Nota de Crédito /
// 06 Nota de Débito — los mismos códigos que ya usa Compras) en vez de
// _mapearTipoDteQrCF (01/05), que es el mapeo que usa Consumidor Final.
const QR_SLOT_CCF = 'qr-ccf';

async function _dgiiConsultarParaCCF(fechaGeneracion, codigoGeneracion) {
  const win = _dgiiGetWindow(QR_SLOT_CCF);
  const logPrefix = '[QR-CreditoFiscal]';

  console.log(logPrefix + ' Cargando página...');
  try {
    await win.loadURL(DGII_CONSULTA_URL);
  } catch (e) {
    return { estado: 'ERROR', error: 'No se pudo cargar la página del Ministerio: ' + e.message };
  }

  const listo = await _dgiiWaitFor(
    win,
    "!!(document.querySelector('input[formcontrolname=\"fechaGeneracion\"]') && document.querySelector('input[formcontrolname=\"codGen\"]'))",
    35000, 300
  );
  if (!listo) {
    return { estado: 'ERROR', error: 'La página del Ministerio no cargó a tiempo (timeout esperando el formulario)' };
  }

  const fillScript = `
    (function() {
      function setVal(el, val) {
        var proto = Object.getPrototypeOf(el);
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      var fechaEl = document.querySelector('input[formcontrolname="fechaGeneracion"]');
      var codEl   = document.querySelector('input[formcontrolname="codGen"]');
      if (!fechaEl || !codEl) return false;
      setVal(fechaEl, ${JSON.stringify(fechaGeneracion)});
      setVal(codEl, ${JSON.stringify(codigoGeneracion)});
      return true;
    })();
  `;
  const llenado = await win.webContents.executeJavaScript(fillScript, true).catch(() => false);
  if (!llenado) return { estado: 'ERROR', error: 'No se pudieron llenar los campos del formulario' };

  const clickScript = `
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var buscar = btns.find(function(b) { return (b.textContent || '').trim().indexOf('Realizar Búsqueda') !== -1; });
      if (!buscar) return false;
      buscar.click();
      return true;
    })();
  `;
  const clickeado = await win.webContents.executeJavaScript(clickScript, true).catch(() => false);
  if (!clickeado) return { estado: 'ERROR', error: 'No se encontró el botón "Realizar Búsqueda" en la página' };

  const bodyText = await _dgiiEsperarResultado(win, 18000, 300);
  const lower = bodyText.toLowerCase();
  if (!DGII_ESTADOS.some((item) => item.match.some((frase) => lower.indexOf(frase) !== -1))) {
    console.warn(logPrefix + ' No se reconoció ningún estado tras 18s de espera.');
  }

  let estadoCode = 'ERROR';
  let estadoTexto = '';
  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) { estadoCode = item.code; estadoTexto = frase; break; }
    }
    if (estadoTexto) break;
  }

  const campos = await extraerCamposCompras(win);
  const tipoDocMapeado = _mapearTipoDteQr(campos.tipoDte);

  let fechaSolo = fechaGeneracion; // respaldo: la que ya venía del QR
  const m = String(campos.fechaHora || '').match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) fechaSolo = m[3] + '-' + m[2] + '-' + m[1];
  else {
    const m2 = String(campos.fechaHora || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) fechaSolo = m2[0];
  }

  return {
    estado: estadoCode,
    estadoTexto: estadoTexto,
    tipoDocMapeado: tipoDocMapeado,       // '03' | '05' | '06' | '11' | null (no soportado aún)
    tipoDteTexto: campos.tipoDte || '',
    fecha: fechaSolo,
    selloRecepcion: campos.sello || '',
    numeroControl: campos.numeroControl || '',
    montoTotal: _parseMontoQr(campos.montoTotal),
    // Corrección 02 — solo para el resumen visual del modal; no participan
    // en el registro de Crédito Fiscal (Anexo 1).
    ivaOperaciones: _parseMontoQr(campos.ivaOperaciones),
    ivaRetenido: _parseMontoQr(campos.ivaRetenido),
    totalOperacion: _parseMontoQr(campos.totalOperacion)
  };
}

// ── Consulta DGII para Compras a Sujeto Excluido (Anexo 5) vía escaneo QR ──
// Mismo patrón que _dgiiConsultarParaCompras (misma URL, mismo formulario,
// mismo botón "Realizar Búsqueda"), pero usando su propio carril de ventana
// oculta (QR_SLOT_EXCLUIDO) para no pisar una consulta de Compras/CF/CCF/
// Retenciones que esté corriendo al mismo tiempo, y mapeando el Tipo de DTE
// con _mapearTipoDteQrSujetoExcluido (14 Factura de Sujeto Excluido) en vez
// de los mapeos que usan los demás libros. No requiere Número de Control
// (el registro de Sujeto Excluido no lo usa) — sí usa el Sello de Recepción
// (-> Serie de Documento), el Monto Total de la Operación (-> Monto de la
// Operación) y la Retención Renta (-> Retención IVA (13%) — Manual, ya que
// en el caso de Sujeto Excluido el Ministerio informa ese monto como
// "Retención renta" en vez de como IVA retenido), igual que ya extrae
// extraerCamposCompras para los demás libros. El NIT/DUI y Nombre del
// Sujeto Excluido NO vienen en la consulta pública (no los expone
// Hacienda) — se toman del MISMO catálogo de Proveedores que ya usa
// Compras, eligiéndolo/creándolo en el teléfono en la misma pantalla que
// usa el flujo de Compras.
const QR_SLOT_EXCLUIDO = 'qr-excluido';

async function _dgiiConsultarParaExcluido(fechaGeneracion, codigoGeneracion) {
  const win = _dgiiGetWindow(QR_SLOT_EXCLUIDO);
  const logPrefix = '[QR-SujetoExcluido]';

  console.log(logPrefix + ' Cargando página...');
  try {
    await win.loadURL(DGII_CONSULTA_URL);
  } catch (e) {
    return { estado: 'ERROR', error: 'No se pudo cargar la página del Ministerio: ' + e.message };
  }

  const listo = await _dgiiWaitFor(
    win,
    "!!(document.querySelector('input[formcontrolname=\"fechaGeneracion\"]') && document.querySelector('input[formcontrolname=\"codGen\"]'))",
    35000, 300
  );
  if (!listo) {
    return { estado: 'ERROR', error: 'La página del Ministerio no cargó a tiempo (timeout esperando el formulario)' };
  }

  const fillScript = `
    (function() {
      function setVal(el, val) {
        var proto = Object.getPrototypeOf(el);
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      var fechaEl = document.querySelector('input[formcontrolname="fechaGeneracion"]');
      var codEl   = document.querySelector('input[formcontrolname="codGen"]');
      if (!fechaEl || !codEl) return false;
      setVal(fechaEl, ${JSON.stringify(fechaGeneracion)});
      setVal(codEl, ${JSON.stringify(codigoGeneracion)});
      return true;
    })();
  `;
  const llenado = await win.webContents.executeJavaScript(fillScript, true).catch(() => false);
  if (!llenado) return { estado: 'ERROR', error: 'No se pudieron llenar los campos del formulario' };

  const clickScript = `
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var buscar = btns.find(function(b) { return (b.textContent || '').trim().indexOf('Realizar Búsqueda') !== -1; });
      if (!buscar) return false;
      buscar.click();
      return true;
    })();
  `;
  const clickeado = await win.webContents.executeJavaScript(clickScript, true).catch(() => false);
  if (!clickeado) return { estado: 'ERROR', error: 'No se encontró el botón "Realizar Búsqueda" en la página' };

  const bodyText = await _dgiiEsperarResultado(win, 18000, 300);
  const lower = bodyText.toLowerCase();
  if (!DGII_ESTADOS.some((item) => item.match.some((frase) => lower.indexOf(frase) !== -1))) {
    console.warn(logPrefix + ' No se reconoció ningún estado tras 18s de espera.');
  }

  let estadoCode = 'ERROR';
  let estadoTexto = '';
  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) { estadoCode = item.code; estadoTexto = frase; break; }
    }
    if (estadoTexto) break;
  }

  const campos = await extraerCamposCompras(win);
  const tipoDocMapeado = _mapearTipoDteQrSujetoExcluido(campos.tipoDte);

  let fechaSolo = fechaGeneracion; // respaldo: la que ya venía del QR
  const m = String(campos.fechaHora || '').match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) fechaSolo = m[3] + '-' + m[2] + '-' + m[1];
  else {
    const m2 = String(campos.fechaHora || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) fechaSolo = m2[0];
  }

  return {
    estado: estadoCode,
    estadoTexto: estadoTexto,
    tipoDocMapeado: tipoDocMapeado,       // '14' | null (no soportado aún)
    tipoDteTexto: campos.tipoDte || '',
    fecha: fechaSolo,
    selloRecepcion: campos.sello || '',
    montoTotal: _parseMontoQr(campos.montoTotal),
    retencionRenta: _parseMontoQr(campos.retencionRenta),
    // Corrección 02 — solo para el resumen visual del modal; no participan
    // en el registro de Sujeto Excluido (Anexo 5).
    ivaOperaciones: _parseMontoQr(campos.ivaOperaciones),
    ivaRetenido: _parseMontoQr(campos.ivaRetenido),
    totalOperacion: _parseMontoQr(campos.totalOperacion)
  };
}

// ── Servidor de emparejamiento QR (proceso principal) ──────────────────
// Instancia única — se crea/destruye completa cada vez que el usuario abre
// o cierra el módulo desde la interfaz, así nunca queda nada corriendo en
// segundo plano sin que el usuario lo haya pedido explícitamente.
let _qrServerModule = null;
let _qrEventosEnganchados = false;

// Cambio 02 — Validación de "Tipos de Documento Permitidos" (Admin →
// Escaneo QR) hecha también en el proceso principal, no solo en el
// renderer. La configuración en sí la sigue guardando el renderer (vive en
// fsStore/localStorage, ver qrScanTiposLoad() en index.html) — este mapa es
// solo una COPIA en memoria que el renderer empuja aquí (ver el handler
// 'qr-actualizar-tipos-permitidos' más abajo) cada vez que cambia o cada
// vez que se abre el módulo, para que main.js pueda bloquear un documento
// no permitido ANTES de reenviarlo a la pantalla de la PC.
// Cambio 04: las listas usan los códigos oficiales del catálogo CAT-002
// centralizado en cat002.js — '01' | '03' | '04' | '05' | '06' | '07' |
// '08' | '09' | '11' | '14' | '15' | '17' | '18'. Forma: { compras:
// ['01','03',...], cf: [...], ccf: [...], retencion: [...], excluido: [...] }
// Un código que NO aparece en la lista de un anexo se trata como NO
// PERMITIDO (denegación por defecto — "no configurado" nunca equivale a
// "permitido").
// null = todavía no se ha recibido ninguna copia desde el renderer (recién
// abierta la app) -> no se bloquea por falta de configuración, igual que
// hace qrScanTiposLoad() en el renderer mientras no ha llegado nada.
let _tiposPermitidosPorLibroQR = null;

// Mismo catálogo de anexos que QRSCAN_MODULOS en index.html, solo para
// poder armar el mensaje de rechazo que se muestra en el teléfono.
const _QR_ANEXO_LABEL = {
  compras: 'Compras',
  cf: 'Venta Consumidor Final',
  ccf: 'Venta Crédito Fiscal',
  retencion: 'Retención IVA',
  excluido: 'Sujeto Excluido'
};

// Punto único de validación en el proceso principal — se llama justo
// después de consultar el Ministerio y antes de reenviar el documento al
// renderer (ver el listener de 'documento-escaneado' más abajo).
//
// Cambio 04: recibe el TEXTO REAL de "Tipo de DTE" y lo traduce a un código
// CAT-002 (cat002CodigoDesdeTexto, catálogo centralizado en cat002.js — 13
// tipos oficiales). Devuelve siempre un resultado con dos posibles motivos
// de rechazo, que ya NO se tratan igual (antes, un tipo no reconocido
// simplemente no se bloqueaba; ahora sí se rechaza, pero con un mensaje
// distinto al de "no permitido para el anexo"):
//
//   - { permitido: true }                      → procesar normalmente
//   - { permitido: false, motivo: 'desconocido' }  → el texto de Hacienda no
//     corresponde a ningún tipo del catálogo CAT-002 (posible tipo de
//     documento nuevo o inconsistencia). Se rechaza SIEMPRE — nunca se
//     asume válido solo porque "no se pudo identificar".
//   - { permitido: false, motivo: 'no_habilitado', codigo, nombre } → el
//     tipo SÍ es un código CAT-002 conocido, pero no está habilitado para
//     el anexo seleccionado (o directamente no ha sido configurado —
//     "no configurado" se trata igual que "deshabilitado", nunca como
//     "permitido por defecto").
//
// Si _tiposPermitidosPorLibroQR todavía no se ha sincronizado desde el
// renderer (app recién abierta), no se bloquea por falta de configuración
// — se deja pasar, igual que hacía la versión anterior.
function _qrTipoDocumentoPermitidoEnMain(libro, tipoDteTexto) {
  const codigo = cat002CodigoDesdeTexto(tipoDteTexto);
  if (!codigo) return { permitido: false, motivo: 'desconocido' };
  if (!_tiposPermitidosPorLibroQR) return { permitido: true }; // aún no sincronizado — no bloquear
  const permitidos = _tiposPermitidosPorLibroQR[libro];
  if (!Array.isArray(permitidos)) return { permitido: true }; // libro sin config recibida — no bloquear
  const nombre = nombrePorCodigo(codigo);
  if (permitidos.indexOf(codigo) === -1) {
    return { permitido: false, motivo: 'no_habilitado', codigo: codigo, nombre: nombre };
  }
  return { permitido: true, codigo: codigo, nombre: nombre };
}

function _obtenerQrServerModule() {
  if (!_qrServerModule) {
    _qrServerModule = require('./qrPairingServer');
  }
  if (!_qrEventosEnganchados) {
    _qrEventosEnganchados = true;
    _qrServerModule.eventos.on('conexion', (data) => {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('qr-estado-conexion', data);
      }
      // Cambio 01: el teléfono se desconectó — cerrar las ventanas ocultas
      // que el escaneo haya podido dejar abiertas (carriles 'qr-compras',
      // 'qr-cf', 'qr-ccf'), sin tocar las de la Consulta DTE en lote. Si el
      // usuario vuelve a conectar el teléfono, se recrean solas al escanear
      // el primer documento (mismo comportamiento de siempre).
      if (data && data.conectado === false) {
        _dgiiCerrarVentanasQR();
      }
    });

    // Cambio 05 (Resumen de Escaneo en el teléfono): el usuario completó y
    // envió desde el teléfono el mismo Resumen que existe en la PC. Este
    // proceso NO arma ni guarda ningún registro — solo relay al renderer
    // (igual que con 'qr-documento-escaneado*'), que es quien tiene la
    // lógica de negocio (comprasRecords/cfRecords/etc.) y quien realmente
    // construye y guarda el registro (ver _procesarResumenCompletadoCelular
    // / _guardarRegistroEscaneo en index.html).
    _qrServerModule.eventos.on('resumen-completado', (payload) => {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        _traerVentanaAlFrente(mainWindowRef);
        mainWindowRef.webContents.send('qr-resumen-completado', payload);
      }
    });

    // Cambio 03: el teléfono ya no crea ni edita proveedores/clientes (esa
    // gestión vive ahora por completo en la computadora), así que
    // qrPairingServer nunca vuelve a emitir 'proveedor-nuevo', 'cliente-nuevo',
    // 'proveedor-editado' ni 'cliente-editado' — se quitan estos listeners.
    // Los canales IPC 'qr-proveedor-nuevo', etc. y sus manejadores en
    // index.html se dejan intactos (quedan inertes, sin romper nada) por si
    // en el futuro alguna otra vía los vuelve a emitir.

    _qrServerModule.eventos.on('documento-escaneado', async (payload) => {
      const libro = payload.libro || 'compras';
      // Cambio 03 (gestión trasladada a la computadora): el teléfono ya no
      // manda proveedor, cliente ni "exenta" — solo el QR. main.js consulta
      // el Ministerio (igual que antes) y SIEMPRE reenvía el resultado al
      // renderer para que la computadora lo muestre y el usuario lo revise
      // (seleccione/agregue proveedor o cliente y confirme) — ya no se
      // decide aquí si el documento "se agrega" o no; eso ahora lo decide
      // el usuario en la pantalla de la PC, aunque el tipo de documento no
      // se haya podido mapear automáticamente o el estado no sea
      // TRANSMITIDO (el renderer avisa de ambos casos igual que antes).
      // Al teléfono solo se le confirma que el QR se recibió correctamente
      // — nunca el resultado final del guardado, porque eso ya no ocurre
      // de forma automática.
      const CANAL_POR_LIBRO = {
        cf: 'qr-documento-escaneado-cf',
        ccf: 'qr-documento-escaneado-ccf',
        retencion: 'qr-documento-escaneado-retencion',
        excluido: 'qr-documento-escaneado-excluido',
        compras: 'qr-documento-escaneado'
      };
      const CONSULTA_POR_LIBRO = {
        cf: _dgiiConsultarParaCF,
        ccf: _dgiiConsultarParaCCF,
        retencion: _dgiiConsultarParaRetencion,
        excluido: _dgiiConsultarParaExcluido,
        compras: _dgiiConsultarParaCompras
      };
      // Cambio 04 — carril (slot) de ventana oculta que le corresponde a
      // cada libro, para poder cerrar SOLO esa ventana una vez procesado
      // este documento (ver _dgiiCerrarVentanaSlot más abajo).
      const SLOT_POR_LIBRO = {
        cf: QR_SLOT_CF,
        ccf: QR_SLOT_CCF,
        retencion: QR_SLOT_RETENCION,
        excluido: QR_SLOT_EXCLUIDO,
        compras: QR_SLOT
      };
      try {
        const consultar = CONSULTA_POR_LIBRO[libro] || CONSULTA_POR_LIBRO.compras;
        const canal = CANAL_POR_LIBRO[libro] || CANAL_POR_LIBRO.compras;
        const resultado = await consultar(payload.qr.fechaEmi, payload.qr.codGen);

        const combinado = Object.assign({}, resultado, {
          codGen: payload.qr.codGen,
          ambiente: payload.qr.ambiente
        });

        // Cambio 02 — Reforzar validación de "Tipos de Documento Permitidos"
        // (Admin → Escaneo QR): se comprueba AQUÍ, en el proceso principal,
        // antes de reenviar el documento a la pantalla de la PC. Si el tipo
        // detectado no está permitido para este anexo, el proceso se
        // detiene de inmediato: no se manda 'combinado' al renderer (por lo
        // tanto nunca se abre ningún modal ni se crea ningún registro
        // pendiente en la PC — queda como si el documento nunca hubiera
        // llegado) y se avisa al teléfono con un mensaje claro. La consulta
        // al Ministerio ya se hizo (es necesaria para poder identificar el
        // tipo), pero su resultado se descarta aquí mismo sin persistir ni
        // mostrar nada más. El renderer conserva su propia validación
        // (qrScanTipoPermitido) como segunda capa, por si un documento
        // llegara a colarse antes de que este proceso sincronizara la
        // configuración vigente.
        // Cambio 04 — Ahora se distinguen dos motivos de rechazo (ver
        // _qrTipoDocumentoPermitidoEnMain): tipo desconocido para el
        // catálogo CAT-002, o tipo conocido pero no habilitado para este
        // anexo. En ambos casos el documento se descarta igual (no se
        // envía al renderer, no llega nada al modal, no queda estado
        // temporal — la consulta al Ministerio ya se hizo pero su
        // resultado se descarta aquí mismo) y se avisa al teléfono, solo
        // que con un mensaje distinto según el motivo. El renderer
        // conserva su propia validación (qrScanTipoPermitido) como segunda
        // capa, por si un documento llegara a colarse antes de que este
        // proceso sincronizara la configuración vigente.
        const validacionTipo = _qrTipoDocumentoPermitidoEnMain(libro, resultado.tipoDteTexto);
        if (!validacionTipo.permitido) {
          const anexoLabel = _QR_ANEXO_LABEL[libro] || libro;
          const mensaje = validacionTipo.motivo === 'desconocido'
            ? 'Tipo de documento no reconocido. El documento no puede ser procesado.'
            : 'Documento no permitido. Este tipo de documento (' + validacionTipo.nombre + ') no es válido para el anexo de ' + anexoLabel + '. Verifique el tipo de documento permitido en la configuración de Escaneo QR.';
          _qrServerModule.enviarResultadoDocumento({ ok: false, mensaje: mensaje });
          return;
        }

        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          // Cambio 04 — Solo aquí, justo antes de enviar el documento que sí
          // va a abrir el modal de "Documento Escaneado" en la PC, se trae
          // la ventana al frente.
          _traerVentanaAlFrente(mainWindowRef);
          mainWindowRef.webContents.send(canal, combinado);
        }

        const consultaOk = resultado.estado !== 'ERROR';
        _qrServerModule.enviarResultadoDocumento({
          ok: consultaOk,
          estado: resultado.estado,
          mensaje: consultaOk
            ? 'Documento recibido — revísalo en tu computadora.'
            : ('No se pudo consultar el documento: ' + (resultado.error || 'error desconocido'))
        });
      } catch (e) {
        _qrServerModule.enviarResultadoDocumento({ ok: false, mensaje: 'Error inesperado: ' + e.message });
      } finally {
        // Cambio 04 — Ya se extrajeron los datos de este documento y se
        // enviaron a la pantalla de la PC (o falló la consulta): la
        // ventana oculta que se usó para ESTE escaneo se cierra aquí. El
        // próximo escaneo (de este mismo libro) la vuelve a abrir desde
        // cero, sola, a través de _dgiiGetWindow — no reutiliza la
        // anterior. Se hace en el 'finally' para que también se cierre si
        // la consulta terminó en error.
        _dgiiCerrarVentanaSlot(SLOT_POR_LIBRO[libro] || QR_SLOT);
      }
    });
  }
  return _qrServerModule;
}

// Recibe { proveedores, empresaNombre } — el catálogo lo manda el RENDERER
// (fuente de verdad real, ver preload.js/index.html), este handler nunca
// lee fiscaldata.json directamente para evitar condiciones de carrera.
ipcMain.handle('iniciar-qr-scan', async (event, { proveedores, clientes, empresaNombre, clasifLabels, sectorLabels, costoLabels } = {}) => {
  try {
    const mod = _obtenerQrServerModule();
    return await mod.iniciar({
      app,
      proveedores: proveedores || [],
      clientes: clientes || [],
      empresaNombre: empresaNombre || '',
      clasifLabels: clasifLabels || {},
      // Cambio 01 (ampliación): Sector y Tipo de Costo/Gasto, para que el teléfono
      // pueda mostrar y editar la clasificación completa del proveedor.
      sectorLabels: sectorLabels || {},
      costoLabels: costoLabels || {}
    });
  } catch (e) {
    return { ok: false, error: e.message || 'Error desconocido al iniciar el módulo de escaneo' };
  }
});

// Cambio 01 (Escaneo de Documentos — control desde la PC): la computadora
// ordena al teléfono qué tipo de documento escanear a continuación. El
// teléfono ya no elige nada por su cuenta — solo obedece esta orden y
// funciona como cámara/lector. libro: 'compras'|'cf'|'ccf'|'retencion'|'excluido'.
ipcMain.handle('qr-ordenar-escaneo', async (event, libro) => {
  try {
    if (!_qrServerModule || !_qrServerModule.estaCorriendo()) {
      return { ok: false, error: 'El módulo de escaneo no está iniciado.' };
    }
    return _qrServerModule.ordenarEscaneo(libro);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('detener-qr-scan', async () => {
  try {
    if (_qrServerModule) return await _qrServerModule.detener();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    // Cambio 01: al cerrar el módulo (aunque el teléfono siguiera
    // conectado en ese momento), cerrar también las ventanas ocultas del
    // escaneo QR. Si ya se habían cerrado por el evento de desconexión,
    // esto no hace nada (quedaron en null).
    _dgiiCerrarVentanasQR();
  }
});

// El renderer llama esto si el catálogo cambia mientras el módulo sigue abierto
// (ej. el usuario edita proveedores manualmente en el desktop durante el escaneo).
ipcMain.handle('qr-actualizar-catalogo', async (event, proveedores) => {
  try {
    if (_qrServerModule && _qrServerModule.estaCorriendo()) {
      _qrServerModule.actualizarCatalogo(proveedores || []);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Igual que arriba pero para el catálogo de clientes (usado por Ventas — Crédito Fiscal).
ipcMain.handle('qr-actualizar-clientes', async (event, clientes) => {
  try {
    if (_qrServerModule && _qrServerModule.estaCorriendo()) {
      _qrServerModule.actualizarClientes(clientes || []);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// CAMBIO — Actualización dinámica de empresa: el renderer llama esto cada
// vez que el usuario entra a una empresa (o cambia de una a otra) mientras
// el módulo de escaneo QR sigue abierto/minimizado en segundo plano, para
// que el teléfono se actualice en tiempo real (nombre de empresa, catálogo
// de proveedores/clientes y etiquetas de clasificación) sin tener que
// cerrar y volver a abrir el módulo. Mismo payload que 'iniciar-qr-scan'.
ipcMain.handle('qr-actualizar-empresa-activa', async (event, { proveedores, clientes, empresaNombre, clasifLabels, sectorLabels, costoLabels } = {}) => {
  try {
    if (_qrServerModule && _qrServerModule.estaCorriendo()) {
      return _qrServerModule.actualizarEmpresaActiva({
        proveedores: proveedores || [],
        clientes: clientes || [],
        empresaNombre: empresaNombre || '',
        clasifLabels: clasifLabels || {},
        sectorLabels: sectorLabels || {},
        costoLabels: costoLabels || {}
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Cambio 02 — El renderer llama esto para mantener sincronizada en el
// proceso principal la copia de "Tipos de Documento Permitidos" (Admin →
// Escaneo QR): al arrancar/abrir el módulo, y cada vez que el admin guarda
// cambios en el editor (ver qrTiposSaveModulo() en index.html). No depende
// de que el módulo de escaneo esté corriendo — se guarda siempre, así ya
// está lista en cuanto el teléfono se conecte y empiece a escanear.
ipcMain.handle('qr-actualizar-tipos-permitidos', async (event, tipos) => {
  try {
    _tiposPermitidosPorLibroQR = (tipos && typeof tipos === 'object') ? tipos : null;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Cambio 05 (Resumen de Escaneo en el teléfono): reenvía al teléfono
// conectado el documento ya consultado en Hacienda (libro + combinado)
// para que el usuario complete ahí el mismo Resumen que existe en la PC
// (proveedor/cliente, tipo de documento, monto, exenta, bien/servicio) —
// el renderer llama esto solo cuando Admin tiene configurado "Resumen en
// celular" (ver resumenEscaneoModoLoad() en index.html). Devuelve
// { ok, conectado, error? }; si no hay teléfono conectado, el renderer
// debe mostrar el resumen en la propia PC como respaldo, para no perder
// el documento.
ipcMain.handle('qr-enviar-resumen-celular', async (event, { libro, combinado } = {}) => {
  try {
    if (!_qrServerModule || !_qrServerModule.estaCorriendo()) {
      return { ok: false, error: 'El módulo de escaneo no está iniciado.' };
    }
    return _qrServerModule.enviarResumenCelular(libro, combinado);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Corrección Bug 01: el renderer es quien sabe, después de recibir el
// documento combinado (qr-documento-escaneado / -cf / -ccf), si el
// documento ya existía en el libro correspondiente (registrado antes de
// forma manual, por JSON, por CSV o por un escaneo previo) y por lo tanto
// NO lo guardó. Como el mensaje "cargado" que main.js le manda al teléfono
// justo después de consultar el Ministerio se envía ANTES de que el
// renderer tome esa decisión, este handler permite que el renderer corrija
// ese mensaje en el teléfono una vez que ya sabe el resultado real —
// sin tocar en nada la lógica de escaneo/consulta existente.
ipcMain.handle('qr-reportar-resultado', async (event, resultado) => {
  try {
    if (_qrServerModule && _qrServerModule.estaCorriendo()) {
      _qrServerModule.enviarResultadoDocumento(resultado || {});
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Cierra el módulo automáticamente si la ventana principal se destruye,
// para no dejar el servidor HTTPS local corriendo en segundo plano.
app.on('before-quit', () => {
  if (_qrServerModule && _qrServerModule.estaCorriendo()) {
    _qrServerModule.detener().catch(() => {});
  }
});

// Cierra y descarta todas las ventanas ocultas del pool de consulta DGII.
// Se usa tanto al cancelar una verificación como al terminarla normalmente,
// para no dejar ventanas abiertas en segundo plano sin necesidad — la
// próxima consulta las vuelve a crear automáticamente desde cero.
function _dgiiCerrarTodasLasVentanas() {
  Object.keys(_dgiiWins).forEach((slot) => {
    const w = _dgiiWins[slot];
    if (w && !w.isDestroyed()) { try { w.destroy(); } catch (e) { /* ya cerrada */ } }
    _dgiiWins[slot] = null;
  });
}

// Cambio 01 — Igual que _dgiiCerrarTodasLasVentanas, pero cierra ÚNICAMENTE
// los carriles ocultos que usa el escaneo QR (QR_SLOT / QR_SLOT_CF /
// QR_SLOT_CCF / QR_SLOT_RETENCION / QR_SLOT_EXCLUIDO), sin tocar los
// carriles numéricos (0,1,2…) que usa la Consulta DTE en lote — así un lote
// que esté corriendo en paralelo no se ve afectado. Se llama cuando el
// teléfono se desconecta y cuando el usuario cierra el módulo de escaneo.
// La próxima vez que se escanee un documento, _dgiiGetWindow las vuelve a
// crear solas (mismo patrón de siempre, no se toca esa lógica).
function _dgiiCerrarVentanasQR() {
  [QR_SLOT, QR_SLOT_CF, QR_SLOT_CCF, QR_SLOT_RETENCION, QR_SLOT_EXCLUIDO].forEach((slot) => {
    const w = _dgiiWins[slot];
    if (w && !w.isDestroyed()) { try { w.destroy(); } catch (e) { /* ya cerrada */ } }
    _dgiiWins[slot] = null;
  });
}

// Cambio 04 — Cierra ÚNICAMENTE el carril de UN libro (una sola ventana
// oculta), y no los demás. Se llama justo después de extraer los datos de
// un documento escaneado por QR y enviarlos a la pantalla de la PC (ver
// 'documento-escaneado' más abajo): esa ventana ya cumplió su propósito
// para ESE documento, así que se cierra en vez de dejarla reutilizable.
// Al llegar el siguiente escaneo, _dgiiGetWindow encuentra el carril vacío
// (null) y crea una ventana nueva desde cero para ese nuevo documento —
// mismo patrón que ya usaba _dgiiCerrarVentanasQR, pero de a una.
function _dgiiCerrarVentanaSlot(slot) {
  const w = _dgiiWins[slot];
  if (w && !w.isDestroyed()) { try { w.destroy(); } catch (e) { /* ya cerrada */ } }
  _dgiiWins[slot] = null;
}

ipcMain.handle('cancelar-verificacion-dte', async () => {
  _dgiiCancelado = true;
  // Cerrar todas las ventanas del pool de inmediato para que cualquier espera
  // en curso (carga de página, executeJavaScript) en cualquier carril se
  // corte al instante en vez de esperar a que termine su propio timeout.
  _dgiiCerrarTodasLasVentanas();
  return { ok: true };
});

// Cierra las ventanas ocultas del pool al terminar una verificación completa
// (sin cancelar nada). La próxima vez que se presione "Consulta DTE" se
// crean de nuevo desde cero.
ipcMain.handle('cerrar-ventanas-dte', async () => {
  _dgiiCerrarTodasLasVentanas();
  return { ok: true };
});

ipcMain.handle('reset-cancelacion-dte', async () => {
  _dgiiCancelado = false;
  // AGREGADO — arranca cada lote nuevo con la racha de errores en cero, para
  // que fallos de un lote anterior no disparen "Hacienda no disponible" de
  // entrada en un lote distinto.
  _dgiiErroresConsecutivos = 0;
  return { ok: true };
});

// ══════════════════════════════════════════════════════════════════════
ipcMain.handle('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.handle('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

// ══════════════════════════════════════════════════════════════════════
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  // Ya NO se revisa automáticamente al iniciar — el usuario la busca manualmente
  // desde el botón "Actualizaciones" en la interfaz.
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 👇 NUEVO: actualizaciones manuales, controladas desde el botón en la interfaz
autoUpdater.autoDownload = true;        // al encontrar una versión nueva, la descarga sola
autoUpdater.autoInstallOnAppQuit = false; // no instala silenciosamente al cerrar — solo cuando el usuario confirma

// Envía el estado del updater al HTML (index.html escucha esto vía preload.js)
function sendUpdateStatus(status, data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('update-status', Object.assign({ status }, data || {}));
  }
}

// El botón "Actualizaciones" del index.html llama a esto para buscar
ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Devuelve la versión real instalada (la fuente de verdad es app.getVersion())
ipcMain.handle('get-app-version', () => app.getVersion());

// El botón "Instalar y reiniciar" (aparece solo cuando ya se descargó) llama a esto
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus('checking');
});

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus('available', { version: info.version });
});

autoUpdater.on('update-not-available', () => {
  sendUpdateStatus('not-available');
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', { percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatus('downloaded', { version: info.version });
  // Instalación silenciosa y automática: sin diálogo, sin preguntar nada.
  // isSilent=true (no muestra el instalador de Windows), isForceRunAfter=true (reabre la app sola)
  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true);
  }, 1500); // pequeña pausa para que el usuario alcance a ver el mensaje "Instalando..."
});

autoUpdater.on('error', (err) => {
  sendUpdateStatus('error', { message: err.message });
});