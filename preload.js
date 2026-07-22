const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fiscalAPI', {

    // Abrir diálogo para seleccionar carpeta
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Leer todos los archivos de una carpeta (retorna array de { name, ext })
    readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),

    // Leer contenido de un archivo JSON
    readJson: (folderPath, fileName) => ipcRenderer.invoke('read-json', folderPath, fileName),

    // Abrir PDF con el visor predeterminado del sistema
    printPdf: (folderPath, fileName) => ipcRenderer.invoke('print-pdf', folderPath, fileName),

    // Imprimir PDF directamente sin abrir visor (impresora predeterminada)
    directPrint: (folderPath, fileName) => ipcRenderer.invoke('direct-print', folderPath, fileName),

    // Abrir diálogo nativo de impresión de Windows para elegir impresora — retorna { ok, printerName } o { canceled }
    // options: { grayscale: bool }
    directPrintDialog: (folderPath, fileName, options) => ipcRenderer.invoke('direct-print-dialog', folderPath, fileName, options),

    // Imprimir PDF en silencio en una impresora específica por nombre
    // options: { grayscale: bool }
    directPrintTo: (folderPath, fileName, printerName, options) => ipcRenderer.invoke('direct-print-to', folderPath, fileName, printerName, options),

    // ── CAMBIO 7: Almacenamiento en disco ──────────────────────────────
    // Leer todo el store desde disco (retorna JSON string o null)
    fsReadStore: () => ipcRenderer.invoke('fs-read-store'),

    // Escribir el store completo a disco (jsonStr = JSON string)
    fsWriteStore: (jsonStr) => ipcRenderer.invoke('fs-write-store', jsonStr),

    // Controles de ventana
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose:    () => ipcRenderer.invoke('window-close'),

    // Verificar si el API está disponible (para detección en runtime)
    isElectron: true,

    // Guardar libro contable como PDF silencioso (sin diálogo)
    // htmlContent: HTML completo de la página del libro
    // fileName: nombre del archivo (sin extensión o con .pdf)
    // mes: mes/año del período (ej. "Julio 2026"), empresa: razón social de la empresa
    // Guarda automáticamente en Escritorio/FiscalSync - [Mes]/[Empresa]/<fileName>.pdf
    saveLibroPdf: (htmlContent, fileName, mes, empresa) => ipcRenderer.invoke('save-libro-pdf', { htmlContent, fileName, mes, empresa }),

    // ── Exportación automática organizada por mes y empresa ──────────────
    // Guarda cualquier archivo exportado (CSV, XLS, JSON, etc.) directamente en
    // Escritorio/FiscalSync - [Mes]/[Empresa]/<fileName> sin mostrar ningún diálogo.
    // params: { mes, empresa, fileName, content, encoding }
    saveExportFile: (params) => ipcRenderer.invoke('save-export-file', params),

    // ── CAMBIO 9: Verificación de Estado DGII ──────────────────────────
    // Consulta el estado oficial de un DTE en el Ministerio de Hacienda
    // (fechaGeneracion formato "YYYY-MM-DD", codigoGeneracion = UUID del DTE)
    // slot: número de carril (0, 1, 2…) — permite correr varias consultas en
    // paralelo, cada una con su propia ventana oculta e independiente. Si se
    // omite, se usa el carril 0 (comportamiento secuencial de siempre).
    // Retorna { estado, textoOriginal } o { estado:'ERROR', error }
    verificarEstadoDTE: (fechaGeneracion, codigoGeneracion, slot) =>
        ipcRenderer.invoke('verificar-dte-mh', fechaGeneracion, codigoGeneracion, slot),

    // Cancela un lote de verificación en curso
    cancelarVerificacionDTE: () => ipcRenderer.invoke('cancelar-verificacion-dte'),

    // Cierra las ventanas ocultas del pool de consulta DGII al terminar un
    // lote completo (sin cancelar nada). Se vuelven a crear automáticamente
    // la próxima vez que se inicie una verificación.
    cerrarVentanasDTE: () => ipcRenderer.invoke('cerrar-ventanas-dte'),

    // Reinicia el flag de cancelación antes de iniciar un nuevo lote
    resetCancelacionDTE: () => ipcRenderer.invoke('reset-cancelacion-dte'),

    // ── Auto-actualizaciones (GitHub Releases) ─────────────────────────
    // Busca si hay una versión nueva; si la hay, la descarga sola en segundo plano
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    // Devuelve la versión instalada actualmente (fuente: app.getVersion())
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Instala la actualización ya descargada y reinicia la app
    installUpdate: () => ipcRenderer.invoke('install-update'),

    // Escucha el estado del proceso: { status: 'checking'|'available'|'not-available'
    //   |'downloading'|'downloaded'|'error', version, percent, message }
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data))
});

// ── electronAPI — usado por el módulo de Correos DTE ──
// Se expone por separado para compatibilidad con el módulo de correos
// que detecta window.electronAPI.sendEmail, selectFolder, readFolder
contextBridge.exposeInMainWorld('electronAPI', {

    // Enviar correo vía nodemailer (main process) — equivalente al VBA CDO SMTP 465 SSL
    sendEmail: (data) => ipcRenderer.invoke('send-email', data),

    // Seleccionar carpeta (reutiliza el handler existente 'select-folder')
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Leer archivos de una carpeta (reutiliza el handler existente 'read-folder')
    readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),

    // Leer contenido de un JSON vía IPC (para _correosProcessarArchivosElectron)
    readJson: (folderPath, fileName) => ipcRenderer.invoke('read-json', folderPath, fileName),

    // Seleccionar carpeta y devolver todas las rutas absolutas de JSONs (recursivo)
    selectFolderJsons: () => ipcRenderer.invoke('select-folder-jsons'),

    isElectron: true
});
