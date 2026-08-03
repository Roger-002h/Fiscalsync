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
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),

    // ── Configuración de rutas de exportación (Cambio 03) ──────────────
    // Devuelve { ok, config: { csvPath, pdfPath } } — null en un campo = usa el Escritorio (default)
    getExportConfig: () => ipcRenderer.invoke('get-export-config'),

    // Guarda una o ambas rutas. Parámetros opcionales: { csvPath, pdfPath }
    setExportConfig: (cfg) => ipcRenderer.invoke('set-export-config', cfg),

    // Restablece ambas rutas al valor por defecto (Escritorio)
    resetExportConfig: () => ipcRenderer.invoke('reset-export-config'),

    // ── Configuración de impresión de Libros Legales (Cambio 04) ───────
    // Devuelve { ok, config: { compras:{...}, cf:{...}, ccf:{...} }, defaults: {...} }
    getPrintConfig: () => ipcRenderer.invoke('get-print-config'),

    // Guarda la config de UN libro. tipo: 'compras'|'cf'|'ccf'
    setPrintConfig: (tipo, config) => ipcRenderer.invoke('set-print-config', { tipo, config }),

    // Restaura UN libro a los valores originales del programa
    resetPrintConfig: (tipo) => ipcRenderer.invoke('reset-print-config', { tipo })
});

// ── CAMBIO 01: Escaneo de Documentos Físicos vía QR ─────────────────
contextBridge.exposeInMainWorld('qrScan', {

    // Inicia el módulo: levanta el servidor local y genera el QR de vinculación.
    // proveedores: array del catálogo de la empresa activa (lo lee el renderer con loadProveedores()).
    // clientes: array del catálogo de clientes de la empresa activa (loadClientes()) — usado por
    // el flujo de Ventas — Crédito Fiscal.
    // clasifLabels: mapa {valor: etiqueta} de la clasificación configurada para Proveedores (CLASIF_LABELS),
    // solo para que el teléfono pueda MOSTRAR la clasificación con el mismo texto que usa el programa.
    // sectorLabels / costoLabels (Cambio 01 — ampliación): mismos mapas {valor: etiqueta} para Sector
    // (SECTOR_LABELS) y Tipo de Costo/Gasto (COSTO_LABELS), para que el teléfono pueda mostrar y editar
    // la clasificación COMPLETA del proveedor con el mismo texto que usa el programa. Opcionales — si se
    // omiten, el teléfono simplemente no podrá mostrar esas dos etiquetas (no rompe nada existente).
    // Devuelve { ok, qrDataUrl, ip, port, error }
    iniciar: (proveedores, clientes, empresaNombre, clasifLabels, sectorLabels, costoLabels) =>
        ipcRenderer.invoke('iniciar-qr-scan', { proveedores, clientes, empresaNombre, clasifLabels, sectorLabels, costoLabels }),

    // Detiene el servidor y cierra cualquier sesión activa con el teléfono
    detener: () => ipcRenderer.invoke('detener-qr-scan'),

    // Reenvía un catálogo de proveedores actualizado al teléfono (si cambió mientras el módulo está abierto)
    actualizarCatalogo: (proveedores) => ipcRenderer.invoke('qr-actualizar-catalogo', proveedores),

    // Reenvía un catálogo de clientes actualizado al teléfono (si cambió mientras el módulo está abierto)
    actualizarClientes: (clientes) => ipcRenderer.invoke('qr-actualizar-clientes', clientes),

    // cb(data) — data: { conectado: true|false } — se dispara cuando el teléfono se conecta o se desconecta
    onEstadoConexion: (cb) => ipcRenderer.on('qr-estado-conexion', (event, data) => cb(data)),

    // cb(combinado) — combinado: resultado de la consulta pública + proveedor elegido,
    // listo para autocompletar "Nuevo Registro — Compras"
    onDocumentoEscaneado: (cb) => ipcRenderer.on('qr-documento-escaneado', (event, data) => cb(data)),

    // cb(combinado) — combinado: resultado de la consulta pública + si la venta
    // es exenta o no, listo para guardar directo en el Libro de Ventas —
    // Consumidor Final (Anexo 2)
    onDocumentoEscaneadoCF: (cb) => ipcRenderer.on('qr-documento-escaneado-cf', (event, data) => cb(data)),

    // cb(combinado) — combinado: resultado de la consulta pública + cliente elegido/nuevo +
    // si la venta es exenta o no, listo para guardar directo en el Libro de Ventas —
    // Crédito Fiscal (Anexo 1)
    onDocumentoEscaneadoCCF: (cb) => ipcRenderer.on('qr-documento-escaneado-ccf', (event, data) => cb(data)),

    // cb(proveedor) — proveedor nuevo creado desde el teléfono, para registrar
    // con autoRegistrarProveedor() en el catálogo real del renderer
    onProveedorNuevo: (cb) => ipcRenderer.on('qr-proveedor-nuevo', (event, data) => cb(data)),

    // Cambio 01 (ampliación): cb(proveedorEditado) — un proveedor YA EXISTENTE del
    // catálogo fue editado desde el teléfono (nombre, NIT, NRC, DUI y/o clasificación
    // completa). proveedorEditado: { nitOriginal, nit, nrc, dui, nombre, clasif, sector, tipoCosto }.
    // El renderer debe localizarlo por nitOriginal y actualizarlo con la MISMA
    // estructura que usa el catálogo de Proveedores del escritorio.
    onProveedorEditado: (cb) => ipcRenderer.on('qr-proveedor-editado', (event, data) => cb(data)),

    // Cambio 01 (ampliación): cb(clienteEditado) — un cliente YA EXISTENTE del
    // catálogo fue editado desde el teléfono (flujo Ventas — Crédito Fiscal).
    // clienteEditado: { nitOriginal, nit, nrc, nombre, tipoOp, tipoIng }.
    // El renderer debe localizarlo por nitOriginal y actualizarlo con la MISMA
    // estructura que usa el catálogo de Clientes del escritorio.
    onClienteEditado: (cb) => ipcRenderer.on('qr-cliente-editado', (event, data) => cb(data)),

    // cb(cliente) — cliente nuevo creado desde el teléfono (flujo Crédito Fiscal),
    // para registrar con autoRegistrarCliente() en el catálogo real del renderer
    onClienteNuevo: (cb) => ipcRenderer.on('qr-cliente-nuevo', (event, data) => cb(data)),

    // Limpia los listeners registrados arriba (llamar al cerrar el módulo, para no acumular)
    removerListeners: () => {
        ipcRenderer.removeAllListeners('qr-estado-conexion');
        ipcRenderer.removeAllListeners('qr-documento-escaneado');
        ipcRenderer.removeAllListeners('qr-documento-escaneado-cf');
        ipcRenderer.removeAllListeners('qr-documento-escaneado-ccf');
        ipcRenderer.removeAllListeners('qr-proveedor-nuevo');
        ipcRenderer.removeAllListeners('qr-proveedor-editado');
        ipcRenderer.removeAllListeners('qr-cliente-editado');
        ipcRenderer.removeAllListeners('qr-cliente-nuevo');
    }
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
