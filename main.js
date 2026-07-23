const { app, BrowserWindow, Menu, session, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const { autoUpdater } = require('electron-updater'); // 👈 NUEVO

let mainWindowRef = null; // 👈 NUEVO: referencia para enviar el estado del updater al renderer

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
    }
  });

  mainWindowRef = win; // 👈 NUEVO

  Menu.setApplicationMenu(null);

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
// mailOptions: { from, to, cc, bcc, subject, text, attachments:[{path}] }
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

  // Marca de referencia para detectar cuándo cambia el resultado en pantalla
  await win.webContents.executeJavaScript(
    "window.__dgiiPrevText = document.body.innerText;", true
  ).catch(() => {});

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

  // Esperar a que el texto de la página cambie respecto al estado anterior
  const cambio = await _dgiiWaitFor(win, "document.body.innerText !== window.__dgiiPrevText", 8000, 250);
  if (!cambio) console.warn(logPrefix + ' El texto de la página no cambió tras 8s de espera — puede que la búsqueda esté tardando más de lo esperado.');
  // Margen adicional para que Angular termine de pintar el resultado
  await _dgiiSleep(600);

  const bodyText = await win.webContents.executeJavaScript(
    "document.body.innerText || ''", true
  ).catch(() => '');
  const lower = bodyText.toLowerCase();

  for (const item of DGII_ESTADOS) {
    for (const frase of item.match) {
      if (lower.indexOf(frase) !== -1) {
        console.log(logPrefix + ' Resultado detectado:', item.code);
        return { estado: item.code, textoOriginal: frase };
      }
    }
  }
  console.warn(logPrefix + ' No se reconoció ninguna frase de estado en la respuesta. Texto recibido (primeros 300 caracteres):', bodyText.slice(0, 300));
  return { estado: 'ERROR', error: 'No se pudo interpretar la respuesta de la página (revisa la consola para ver el texto recibido)' };
}

ipcMain.handle('verificar-dte-mh', async (event, fechaGeneracion, codigoGeneracion, slot) => {
  try {
    if (!fechaGeneracion || !codigoGeneracion) {
      return { estado: 'ERROR', error: 'Documento sin fecha o código de generación' };
    }
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ estado: 'ERROR', error: 'Tiempo de espera agotado (50s) consultando el documento' }), 50000);
    });
    return await Promise.race([_dgiiConsultarUno(fechaGeneracion, codigoGeneracion, slot), timeout]);
  } catch (e) {
    return { estado: 'ERROR', error: e.message || 'Error desconocido al consultar el Ministerio de Hacienda' };
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