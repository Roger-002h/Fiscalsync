// importacion/ImportacionCSV.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════
    // CSV SCREEN — Meses Anteriores
    // ══════════════════════════════════════════════
    function initCsvScreen() {
        csvPendingFile = null;
        csvParsedRows  = [];
        var fn = document.getElementById('csvScreenFileName');
        var pb = document.getElementById('csvScreenPreviewBox');
        var pc = document.getElementById('csvScreenPreviewContent');
        var fi = document.getElementById('csvScreenFileInput');
        if (fn) fn.innerText = 'Ningún archivo seleccionado';
        if (pb) pb.classList.add('hidden');
        if (pc) pc.innerHTML = '';
        if (fi) fi.value = '';
        // AGREGADO NUEVO — Cambio 03: además de desmarcar el input, se retira la
        // clase visual "checked" de la etiqueta (pill) correspondiente. El estilo
        // seleccionado de estos controles se controla con esa clase (ver
        // syncPillGroup()), no solo con el atributo checked del radio; sin este
        // paso el radio quedaba lógicamente deseleccionado pero la opción seguía
        // viéndose resaltada en pantalla tras finalizar la importación.
        document.querySelectorAll('input[name="csv_screen_type"]').forEach(function(r) {
            r.checked = false;
            var lbl = r.closest('.radio-pill-item');
            if (lbl) lbl.classList.remove('checked');
        });
        var yi = document.getElementById('csv_screen_year');
        var mi = document.getElementById('csv_screen_month');
        if (yi) yi.value = currentYear;
        if (mi) mi.value = currentMonth;
    }

    function handleCsvScreenDrop(event) {
        event.preventDefault();
        document.getElementById('csvScreenDropZone').classList.remove('border-amber-500');
        var files = event.dataTransfer.files;
        if (files && files.length > 0) handleCsvScreenFileSelect(files[0]);
    }

    function handleCsvScreenFileSelect(file) {
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && ext !== 'txt') {
            showToast('Solo se aceptan archivos .csv', 'error'); return;
        }
        csvPendingFile = file;
        document.getElementById('csvScreenFileName').innerText = file.name;
        var reader = new FileReader();
        reader.onload = function(e) {
            var text = e.target.result;
            csvParsedRows = parseCsvText(text);
            mostrarCsvScreenPreview(csvParsedRows);
        };
        reader.readAsText(file, 'UTF-8');
    }

    function mostrarCsvScreenPreview(rows) {
        var box = document.getElementById('csvScreenPreviewBox');
        var pre = document.getElementById('csvScreenPreviewContent');
        if (!rows.length) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        var preview = rows.slice(0, 5).map(function(r, i) {
            return '<div style="margin-bottom:4px;"><span style="color:var(--rp-text-secondary);">Fila ' + (i+1) + ':</span> ' + r.join(' | ') + '</div>';
        }).join('');
        if (rows.length > 5) preview += '<div style="color:var(--rp-text-secondary);">... y ' + (rows.length - 5) + ' filas más</div>';
        pre.innerHTML = preview;
        document.getElementById('csvScreenCounter').innerText = rows.length + ' filas detectadas';
    }

    function ejecutarCsvScreenImport() {
        var year  = parseInt(document.getElementById('csv_screen_year').value);
        var month = parseInt(document.getElementById('csv_screen_month').value);
        var tipo  = document.querySelector('input[name="csv_screen_type"]:checked');

        if (!year || year < 2020 || year > 2035) { showToast('Ingresa un año válido (2020–2035)', 'error'); return; }
        if (isNaN(month)) { showToast('Selecciona el mes', 'error'); return; }
        if (!tipo) { showToast('Selecciona el tipo de libro', 'error'); return; }
        if (!csvParsedRows.length) { showToast('Carga un archivo CSV primero', 'error'); return; }

        var tipoVal = tipo.value;

        saveCurrentMonthData();

        var prevYear  = currentYear;
        var prevMonth = currentMonth;
        currentYear   = year;
        currentMonth  = month;
        loadCurrentMonthData();

        var mappers = {
            compras:    csvRowToCompras,
            consumidor: csvRowToConsumidor,
            debito:     csvRowToDebito,
            percibido:  csvRowToPercibido,
            retenido:   csvRowToRetenido,
            anticipo:   csvRowToAnticipo,
            excluido:   csvRowToExcluido,
            f14:        csvRowToF14,
            anulados:   csvRowToAnulados
        };
        var targets = {
            compras:    comprasRecords,
            consumidor: cfRecords,
            debito:     debitoRecords,
            percibido:  percibidoRecords,
            retenido:   retenidoRecords,
            anticipo:   anticipoRecords,
            excluido:   excluidoRecords,
            f14:        f14Records,
            anulados:   anuladosRecords
        };

        var mapper = mappers[tipoVal];
        var target = targets[tipoVal];
        var count  = 0;
        var omitidos = 0;
        var duplicados = 0;

        // ══════════════════════════════════════════════════════════════
        // REVISIÓN 01 — Rendimiento de importación CSV
        // ══════════════════════════════════════════════════════════════
        // Antes, esDocumentoDuplicado() recorría TODO el localStorage (todos
        // los períodos guardados, con su propio JSON.parse) por CADA fila del
        // CSV — esto era la causa real de la pausa perceptible con archivos
        // grandes (costo O(filas × períodos), repitiendo el mismo trabajo una
        // y otra vez). Aquí se construye el mismo conjunto de huellas
        // (fingerprints) UNA sola vez antes de procesar el archivo, y luego
        // cada fila se valida contra ese conjunto en tiempo O(1). El criterio
        // de duplicados (docFingerprint) y el resultado final no cambian.
        var dupSet = {};
        target.forEach(function(r) { dupSet[docFingerprint(tipoVal, r)] = true; });
        if (activeEmpresaId) {
            var _prefix = 'fs_data_v' + APP_VERSION + '_' + activeEmpresaId + '_';
            var _currentKey = monthKey(activeEmpresaId, currentYear, currentMonth);
            var _len = fsStore.length();
            for (var _i = 0; _i < _len; _i++) {
                var _k = fsStore.key(_i);
                if (!_k || _k.indexOf(_prefix) !== 0 || _k === _currentKey) continue;
                try {
                    var _raw = fsStore.getItem(_k);
                    if (!_raw) continue;
                    var _data = JSON.parse(_raw);
                    var _records = _data[tipoVal] || [];
                    _records.forEach(function(rec) { dupSet[docFingerprint(tipoVal, rec)] = true; });
                } catch(e) { /* ignorar período corrupto */ }
            }
        }

        // Procesamiento por lotes: se cede el hilo principal entre cada lote
        // (setTimeout) para que la interfaz nunca deje de responder, incluso
        // con archivos de miles de filas, y se muestra el progreso en el
        // propio botón de importación.
        var btn = document.getElementById('csvScreenImportBtn');
        var btnTextOriginal = btn ? btn.innerText : '';
        if (btn) { btn.disabled = true; btn.innerText = 'Procesando…'; }
        showToast('Procesando ' + csvParsedRows.length + ' fila(s)…', 'info');

        var CHUNK_SIZE = 400;
        var idx = 0;

        function procesarLote() {
            var fin = Math.min(idx + CHUNK_SIZE, csvParsedRows.length);
            for (; idx < fin; idx++) {
                var row = csvParsedRows[idx];
                if (esCabeceraCSV(row, tipoVal)) { omitidos++; continue; }
                if (row.every(function(c){ return !c.trim(); })) { omitidos++; continue; }
                try {
                    var rec = mapper(row);
                    var fp = docFingerprint(tipoVal, rec);
                    if (dupSet[fp]) { duplicados++; continue; }
                    dupSet[fp] = true;
                    target.push(rec);
                    count++;
                } catch(e) { omitidos++; }
            }
            if (btn) { btn.innerText = 'Procesando… ' + Math.round((idx / csvParsedRows.length) * 100) + '%'; }
            if (idx < csvParsedRows.length) {
                setTimeout(procesarLote, 0);
            } else {
                finalizarImport();
            }
        }

        function finalizarImport() {
            saveCurrentMonthData();

            // OPTIMIZACIÓN: registrar proveedores en un solo lote — se carga el
            // catálogo una vez, se actualiza en memoria y se guarda una sola vez,
            // en lugar de leer/escribir localStorage por cada registro importado
            // (mismo criterio de coincidencia y de datos completados que
            // autoRegistrarProveedor, sin cambiar el resultado).
            var provNuevos = 0;
            var tiposConProveedor = ['compras', 'percibido', 'retenido', 'anticipo', 'excluido'];
            if (tiposConProveedor.indexOf(tipoVal) !== -1) {
                provNuevos = _autoRegistrarProveedoresBatch(targets[tipoVal], tipoVal);
            }

            currentYear  = prevYear;
            currentMonth = prevMonth;
            loadCurrentMonthData();
            renderAllTables();
            updateMonthLabel();
            refreshOpenLibroLegal(); // AGREGADO NUEVO: refresca el Libro Legal si estaba abierto al restaurar el mes

            var MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            var msg = count + ' registros cargados en ' + MONTH_NAMES_ES[month] + ' ' + year;
            if (omitidos > 0) msg += ' (' + omitidos + ' filas omitidas)';
            if (duplicados > 0) msg += ' · ' + duplicados + ' duplicado(s) omitido(s)';
            if (provNuevos > 0) msg += ' · ' + provNuevos + ' proveedor(es) nuevos';
            showToast(msg, 'success');
            if (provNuevos > 0) renderProveedoresTable();

            if (btn) { btn.disabled = false; btn.innerText = btnTextOriginal || 'Importar al Sistema'; }

            // Limpiar pantalla después de importar
            initCsvScreen();
        }

        setTimeout(procesarLote, 0);
    }

    function csvEscape(v) {
        if (v === null || v === undefined) return '';
        var s = String(v).trim();
        return s.replace(/;/g, ' ').replace(/"/g, '');
    }

    function buildCSV(rows) {
        var lines = [];
        rows.forEach(function(row) { lines.push(row.map(csvEscape).join(';')); });
        return lines.join('\r\n');
    }

    function downloadCSV(filename, content) {
        // Agregar nombre de empresa y mes al nombre del archivo
        var empNombre = '';
        var empRazonCompleta = '';
        if (activeEmpresaId) {
            var empActual = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActual && empActual.razon) {
                empNombre = empActual.razon.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s]/g, '').trim().replace(/\s+/g, '_').substring(0, 30);
                empRazonCompleta = empActual.razon;
            }
        }
        var mesStr = MONTH_NAMES[currentMonth] + '_' + currentYear;
        var prefix = (empNombre ? empNombre + '_' : '') + mesStr + '_';
        var finalFilename = prefix + filename;

        // ── Exportación automática (Electron): guarda directamente en
        //    Escritorio/FiscalSync - [Mes]/[Empresa]/ sin pedir carpeta al usuario ──
        if (window.fiscalAPI && window.fiscalAPI.isElectron && window.fiscalAPI.saveExportFile) {
            var mesLabel = MONTH_NAMES[currentMonth] + ' ' + currentYear;
            window.fiscalAPI.saveExportFile({
                mes:      mesLabel,
                empresa:  empRazonCompleta || 'Sin_Empresa',
                fileName: finalFilename,
                content:  content,
                encoding: 'utf8'
            }).then(function(res) {
                if (res && res.ok) {
                    showToast(finalFilename + ' se guardó correctamente.', 'success', {
                        title: 'Archivo exportado',
                        details: 'FiscalSync - ' + mesLabel + ' / ' + (empRazonCompleta || 'Sin_Empresa') + ' — ' + finalFilename
                    });
                } else {
                    showToast('No fue posible completar la exportación del archivo.', 'error', {
                        title: 'Error al exportar',
                        details: (res && res.error) ? res.error : 'Error desconocido.'
                    });
                }
            }).catch(function() {
                showToast('No fue posible completar la exportación del archivo.', 'error', {
                    title: 'Error al exportar',
                    details: 'Ocurrió un error inesperado al exportar el archivo.'
                });
            });
            return;
        }

        // ── Navegador (sin Electron): mantener descarga estándar como respaldo ──
        var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url;
        a.download = finalFilename;
        a.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    function exportCSV(type) {
        var rows, filename;
        var f = function(n) { return (n || 0).toFixed(2); };

        // Helper: detecta si un registro está marcado como anulado usando _id único
        function esAnuladoDoc(r) {
            // Método primario: _id único (registros nuevos)
            if (r._id) {
                return anuladosRecords.some(function(a) { return a._registroId === r._id; });
            }
            // Fallback para registros sin _id: solo match por UUID largo (evita falsos positivos)
            var codigoGen = r.docDel || r.numDoc || '';
            if (codigoGen && codigoGen.length > 10) {
                return anuladosRecords.some(function(a) {
                    return a.codigoGeneracion === codigoGen && a.codigoGeneracion.length > 10;
                });
            }
            return false;
        }

        switch (type) {

            case 'consumidor': {
                var cfActivos = cfRecords.filter(function(r) { return !esAnuladoDoc(r); });
                if (!cfActivos.length) { showToast('No hay registros activos (todos anulados o lista vacía)', 'error'); return; }
                cfActivos.sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
                rows = cfActivos.map(function(r) { return [
                    formatFecha(r.fecha),
                    extractNum(r.clase),
                    extractNum(r.tipoDoc),
                    r.resolucion,
                    r.serie,
                    r.ctrlDel,
                    r.ctrlAl,
                    r.docDel,
                    r.docAl,
                    r.maquina || '',
                    f(r.exentas),
                    f(r.exentaNosuj),
                    f(r.nosujetas),
                    f(r.gravadas),
                    f(r.expCa),
                    f(r.expFuera),
                    f(r.expServ),
                    f(r.zonas),
                    f(r.terceros),
                    f(r.total),
                    extractNum(r.tipoOp),
                    extractNum(r.tipoIng),
                    '2'
                ]; });
                filename = 'Anexo2_Consumidor_Final.csv';
                break;
            }

            case 'debito': {
                var debitoActivos = debitoRecords.filter(function(r) { return !esAnuladoDoc(r); });
                if (!debitoActivos.length) { showToast('No hay registros activos (todos anulados o lista vacía)', 'error'); return; }
                debitoActivos.sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
                rows = debitoActivos.map(function(r) {
                    // 3.2: si NIT/DUI está vacío, usar NRC Cliente como identificador en el CSV
                    var csvNitDebito = (r.nit || '').trim() || (r.nrc || '').trim();
                    return [
                    formatFecha(r.fecha),
                    extractNum(r.clase),
                    extractNum(r.tipoDoc),
                    r.resolucion,
                    r.serie,
                    r.numDoc,
                    r.ctrl || '',
                    csvNitDebito,
                    r.nombre,
                    f(r.exentas),
                    f(r.nosujetas),
                    f(r.gravadas),
                    f(r.iva),
                    f(r.tercero),
                    f(r.dfTercero),
                    f(r.total),
                    r.dui || '',
                    extractNum(r.tipoOp),
                    extractNum(r.tipoIng),
                    '1'
                ]; });
                filename = 'Anexo1_Credito_Fiscal.csv';
                break;
            }

            case 'compras':
                if (!comprasRecords.length) { showToast('No hay registros', 'error'); return; }
                rows = comprasRecords.slice().sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); }).map(function(r) {
                    // 3.1: si NIT/NRC está vacío, usar NRC Proveedor como identificador en el CSV
                    var csvNit = (r.nit || '').trim() || (r.nrc || '').trim();
                    return [
                    formatFecha(r.fecha),
                    extractNum(r.clase),
                    extractNum(r.tipoDoc),
                    r.numDoc,
                    csvNit,
                    r.nombre,
                    f(r.intExentas),
                    f(r.internExentas),
                    f(r.impExentas),
                    f(r.intGravadas),
                    f(r.internGrav),
                    f(r.impGrav),
                    f(r.impServ),
                    f(r.credito),
                    f(r.total),
                    r.dui || '',
                    extractNum(r.tipoOp),
                    extractNum(r.clasif),
                    extractNum(r.sector),
                    extractNum(r.tipoCosto),
                    '3'
                ]; });
                filename = 'Anexo3_Compras.csv';
                break;

            case 'percibido':
                if (!percibidoRecords.length) { showToast('No hay registros', 'error'); return; }
                rows = percibidoRecords.slice().sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); }).map(function(r) { return [
                    r.nit,
                    formatFecha(r.fecha),
                    extractNum(r.tipoDoc),
                    r.serie,
                    r.numDoc,
                    f(r.monto),
                    f(r.iva),
                    r.dui || '',
                    '8'
                ]; });
                filename = 'Anexo8_IVA_Percibido.csv';
                break;

            case 'retenido':
                if (!retenidoRecords.length) { showToast('No hay registros', 'error'); return; }
                rows = retenidoRecords.slice().sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); }).map(function(r) { return [
                    r.nit,
                    formatFecha(r.fecha),
                    extractNum(r.tipoDoc),
                    r.serie,
                    r.numDoc,
                    f(r.monto),
                    f(r.iva),
                    r.dui || '',
                    '7'
                ]; });
                filename = 'Anexo7_IVA_Retenido.csv';
                break;

            case 'anticipo':
                if (!anticipoRecords.length) { showToast('No hay registros', 'error'); return; }
                rows = anticipoRecords.slice().sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); }).map(function(r) { return [
                    r.nit,
                    formatFecha(r.fecha),
                    r.serie,
                    r.numDoc,
                    f(r.monto),
                    f(r.iva),
                    r.dui || '',
                    '6'
                ]; });
                filename = 'Anexo6_Anticipo_Cuenta.csv';
                break;

            case 'excluido': {
                var excluidoActivos = excluidoRecords.filter(function(r) { return !esAnuladoDoc(r); });
                if (!excluidoActivos.length) { showToast('No hay registros activos (todos anulados o lista vacía)', 'error'); return; }
                rows = excluidoActivos.slice().sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); }).map(function(r) { return [
                    extractNum(r.tipoDoc),
                    r.identificacion,
                    r.nombre,
                    formatFecha(r.fecha),
                    r.serie,
                    r.numDoc,
                    f(r.monto),
                    f(r.retencion),
                    extractNum(r.tipoOp),
                    extractNum(r.clasif),
                    extractNum(r.sector),
                    extractNum(r.tipoCosto),
                    '5'
                ]; });
                filename = 'Anexo5_Sujeto_Excluido.csv';
                break;
            }

            // AGREGADO NUEVO: Exportar Retenciones F14
            case 'f14':
                if (!f14Records.length) { showToast('No hay registros', 'error'); return; }
                rows = f14Records.map(function(r) { return [
                    extractNum(r.domiciliado),
                    r.pais || '',
                    r.nombre || '',
                    r.nit || '',
                    r.dui || '',
                    extractNum(r.codIngreso),
                    f(r.devengado),
                    f(r.bonificacion),
                    f(r.retenido),
                    f(r.aguinaldoExento),
                    f(r.aguinaldoGravado),
                    f(r.afp),
                    f(r.isss),
                    f(r.inpep),
                    f(r.ipsfa),
                    f(r.cefafa),
                    f(r.bienestar),
                    f(r.isssIvm),
                    extractNum(r.tipoOp),
                    extractNum(r.clasif),
                    extractNum(r.sector),
                    extractNum(r.tipoCosto),
                    r.periodo || ''
                ]; });
                filename = 'Anexo_Retenciones_F14.csv';
                break;

            // AGREGADO 01: Exportar Quincena Veinticinco
            case 'quincena25':
                if (!quincena25Records.length) { showToast('No hay registros', 'error'); return; }
                rows = quincena25Records.map(function(r) { return [
                    r.nombre || '',
                    r.nit || '',
                    r.dui || '',
                    r.fechaPago || '',
                    f(r.salarioNominal),
                    f(r.montoQuincena),
                    r.periodo || ''
                ]; });
                filename = 'Anexo_Quincena_Veinticinco.csv';
                break;

            case 'anulados':
                if (!anuladosRecords.length) { showToast('No hay registros de anulados', 'error'); return; }
                rows = anuladosRecords.map(function(r) { return [
                    r.numResolucion || '',
                    extractNum(r.clase),
                    r.desdePreimpreso || '0',
                    r.hastaPreimpreso || '0',
                    extractNum(r.tipoDoc),
                    r.tipoDetalle || '',
                    r.serieDoc || '',
                    r.desde || '0',
                    r.hasta || '0',
                    r.codigoGeneracion || ''
                ]; });
                filename = 'Docs_Anulados_Invalidados.csv';
                break;

            default:
                return;
        }

        downloadCSV(filename, buildCSV(rows));
        // Título diferenciado por tipo de CSV (punto 10 de la especificación).
        // La cantidad de documentos proviene siempre de "rows" (los mismos
        // registros ya filtrados/ordenados arriba) — nunca se inventa.
        var _csvTitles = {
            consumidor: 'CSV de Consumidor Final generado',
            debito: 'CSV de Crédito Fiscal generado',
            compras: 'CSV de Compras generado',
            percibido: 'CSV de IVA Percibido generado',
            retenido: 'CSV de IVA Retenido generado',
            anticipo: 'CSV de Anticipo a Cuenta generado',
            excluido: 'CSV de Sujeto Excluido generado',
            f14: 'CSV de Retenciones F14 generado',
            quincena25: 'CSV de Quincena 25 generado',
            anulados: 'CSV de Documentos Anulados generado'
        };
        showToast(rows.length + ' documento(s) fueron exportados correctamente.', 'success', {
            title: _csvTitles[type] || 'CSV exportado',
            details: 'Archivo: ' + filename
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // IMPORTAR CSV — MESES ANTERIORES
    // ══════════════════════════════════════════════════════════════════

    var csvPendingFile = null;
    var csvParsedRows  = [];

    function openCsvImportModal() {
        csvPendingFile = null;
        csvParsedRows  = [];
        document.getElementById('csvFileName').innerText = 'Ningún archivo seleccionado';
        document.getElementById('csvFileInput').value = '';
        document.getElementById('csvPreviewBox').classList.add('hidden');
        document.getElementById('csvPreviewContent').innerHTML = '';
        // Pre-seleccionar año/mes actuales
        document.getElementById('csv_year').value  = currentYear;
        document.getElementById('csv_month').value = currentMonth;
        // Limpiar radio
        document.querySelectorAll('input[name="csv_type"]').forEach(function(r){ r.checked = false; });
        document.getElementById('csvImportModal').style.display = 'flex';
        document.getElementById('csvImportModal').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeCsvImportModal() {
        _cerrarModalAnimado('csvImportModal');
        csvPendingFile = null;
        csvParsedRows  = [];
    }

    function handleCsvDrop(event) {
        event.preventDefault();
        document.getElementById('csvDropZone').classList.remove('drag-over');
        var files = event.dataTransfer.files;
        if (files && files.length > 0) handleCsvFileSelect(files[0]);
    }

    function handleCsvFileSelect(file) {
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && ext !== 'txt') {
            showToast('Solo se aceptan archivos .csv', 'error'); return;
        }
        csvPendingFile = file;
        document.getElementById('csvFileName').innerText = file.name;
        var reader = new FileReader();
        reader.onload = function(e) {
            var text = e.target.result;
            csvParsedRows = parseCsvText(text);
            mostrarCsvPreview(csvParsedRows);
        };
        reader.readAsText(file, 'UTF-8');
    }

    // Parser CSV robusto — separador ; o , auto-detectado
    function parseCsvText(text) {
        // Normalizar saltos de línea
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var lines = text.split('\n').filter(function(l){ return l.trim() !== ''; });
        if (!lines.length) return [];

        // Auto-detectar separador
        var sep = ';';
        if (lines[0].indexOf(';') === -1 && lines[0].indexOf(',') !== -1) sep = ',';

        return lines.map(function(line) {
            // Manejo básico de campos entre comillas
            var cols = [];
            var cur = '';
            var inQ = false;
            for (var i = 0; i < line.length; i++) {
                var c = line[i];
                if (c === '"') { inQ = !inQ; }
                else if (c === sep && !inQ) { cols.push(cur.trim()); cur = ''; }
                else { cur += c; }
            }
            cols.push(cur.trim());
            return cols;
        });
    }

    function mostrarCsvPreview(rows) {
        var box = document.getElementById('csvPreviewBox');
        var pre = document.getElementById('csvPreviewContent');
        if (!rows.length) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        var preview = rows.slice(0, 5).map(function(r, i) {
            return '<div style="margin-bottom:4px;"><span style="color:var(--rp-text-secondary);">Fila ' + (i+1) + ':</span> ' + r.join(' | ') + '</div>';
        }).join('');
        if (rows.length > 5) preview += '<div style="color:var(--rp-text-secondary);">... y ' + (rows.length - 5) + ' filas más</div>';
        pre.innerHTML = preview;
    }

    // Parsear fecha desde distintos formatos hacia YYYY-MM-DD
    function parseCsvFecha(val) {
        if (!val) return '';
        val = val.trim();
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        // DD/MM/YYYY
        var m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return m[3] + '-' + m[2] + '-' + m[1];
        // MM/DD/YYYY
        var m2 = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m2) return m2[3] + '-' + m2[1] + '-' + m2[2];
        return val;
    }

    function csvN(v) { return parseFloat((v||'').replace(',','.')) || 0; }
    function csvS(v) { return (v||'').trim(); }

    // Mappers CSV → registros internos (misma estructura que mapJson*)
    function csvRowToCompras(r) {
        return {
            fecha:       parseCsvFecha(r[0]),
            clase:       csvS(r[1]) || '4',
            tipoDoc:     csvS(r[2]) || '03',
            numDoc:      csvS(r[3]),
            nit:         csvS(r[4]),
            nombre:      csvS(r[5]),
            intExentas:  csvN(r[6]),
            internExentas: csvN(r[7]),
            impExentas:  csvN(r[8]),
            intGravadas: csvN(r[9]),
            internGrav:  csvN(r[10]),
            impGrav:     csvN(r[11]),
            impServ:     csvN(r[12]),
            credito:     csvN(r[13]),
            total:       csvN(r[14]),
            dui:         csvS(r[15]),
            tipoOp:      csvS(r[16]) || '1',
            clasif:      csvS(r[17]) || '1',
            sector:      csvS(r[18]) || '1',
            tipoCosto:   csvS(r[19]) || '1'
        };
    }

    function csvRowToConsumidor(r) {
        return {
            fecha:       parseCsvFecha(r[0]),
            clase:       csvS(r[1]) || '4',
            tipoDoc:     csvS(r[2]) || '01',
            resolucion:  csvS(r[3]),
            serie:       csvS(r[4]),
            ctrlDel:     csvS(r[5]),
            ctrlAl:      csvS(r[6]),
            docDel:      csvS(r[7]),
            docAl:       csvS(r[8]),
            maquina:     csvS(r[9]),
            exentas:     csvN(r[10]),
            exentaNosuj: csvN(r[11]),
            nosujetas:   csvN(r[12]),
            gravadas:    csvN(r[13]),
            expCa:       csvN(r[14]),
            expFuera:    csvN(r[15]),
            expServ:     csvN(r[16]),
            zonas:       csvN(r[17]),
            terceros:    csvN(r[18]),
            total:       csvN(r[19]),
            tipoOp:      csvS(r[20]) || '1',
            tipoIng:     csvS(r[21]) || '1'
        };
    }

    function csvRowToDebito(r) {
        return {
            fecha:       parseCsvFecha(r[0]),
            clase:       csvS(r[1]) || '4',
            tipoDoc:     csvS(r[2]) || '03',
            resolucion:  csvS(r[3]),
            serie:       csvS(r[4]),
            numDoc:      csvS(r[5]),
            ctrl:        csvS(r[6]),
            nit:         csvS(r[7]),
            nombre:      csvS(r[8]),
            exentas:     csvN(r[9]),
            nosujetas:   csvN(r[10]),
            gravadas:    csvN(r[11]),
            iva:         csvN(r[12]),
            tercero:     csvN(r[13]),
            dfTercero:   csvN(r[14]),
            total:       csvN(r[15]),
            dui:         csvS(r[16]),
            tipoOp:      csvS(r[17]) || '1',
            tipoIng:     csvS(r[18]) || '1'
        };
    }

    function csvRowToPercibido(r) {
        return {
            nit:     csvS(r[0]),
            fecha:   parseCsvFecha(r[1]),
            tipoDoc: csvS(r[2]) || '08',
            serie:   csvS(r[3]),
            numDoc:  csvS(r[4]),
            monto:   csvN(r[5]),
            iva:     csvN(r[6]),
            dui:     csvS(r[7])
        };
    }

    function csvRowToRetenido(r) {
        return {
            nit:     csvS(r[0]),
            fecha:   parseCsvFecha(r[1]),
            tipoDoc: csvS(r[2]) || '07',
            serie:   csvS(r[3]),
            numDoc:  csvS(r[4]),
            monto:   csvN(r[5]),
            iva:     csvN(r[6]),
            dui:     csvS(r[7])
        };
    }

    function csvRowToAnticipo(r) {
        return {
            nit:    csvS(r[0]),
            fecha:  parseCsvFecha(r[1]),
            serie:  csvS(r[2]),
            numDoc: csvS(r[3]),
            monto:  csvN(r[4]),
            iva:    csvN(r[5]),
            dui:    csvS(r[6])
        };
    }

    function csvRowToExcluido(r) {
        return {
            tipoDoc:        csvS(r[0]),
            identificacion: csvS(r[1]),
            nombre:         csvS(r[2]),
            fecha:          parseCsvFecha(r[3]),
            serie:          csvS(r[4]),
            numDoc:         csvS(r[5]),
            monto:          csvN(r[6]),
            retencion:      csvN(r[7]),
            tipoOp:         csvS(r[8]) || '1',
            clasif:         csvS(r[9]) || '1',
            sector:         csvS(r[10]) || '1',
            tipoCosto:      csvS(r[11]) || '1'
        };
    }

    function csvRowToF14(r) {
        return {
            domiciliado:     csvS(r[0]) || '1',
            pais:            csvS(r[1]),
            nombre:          csvS(r[2]),
            nit:             csvS(r[3]),
            dui:             csvS(r[4]),
            codIngreso:      csvS(r[5]),
            devengado:       csvN(r[6]),
            bonificacion:    csvN(r[7]),
            retenido:        csvN(r[8]),
            aguinaldoExento: csvN(r[9]),
            aguinaldoGravado:csvN(r[10]),
            afp:             csvN(r[11]),
            isss:            csvN(r[12]),
            inpep:           csvN(r[13]),
            ipsfa:           csvN(r[14]),
            cefafa:          csvN(r[15]),
            bienestar:       csvN(r[16]),
            isssIvm:         csvN(r[17]),
            tipoOp:          csvS(r[18]) || '1',
            clasif:          csvS(r[19]) || '1',
            sector:          csvS(r[20]) || '1',
            tipoCosto:       csvS(r[21]) || '1',
            periodo:         csvS(r[22])
        };
    }

    function csvRowToAnulados(r) {
        return {
            numResolucion:    csvS(r[0]),
            clase:            csvS(r[1]) || '4',
            desdePreimpreso:  csvS(r[2]) || '0',
            hastaPreimpreso:  csvS(r[3]) || '0',
            tipoDoc:          csvS(r[4]) || '01',
            tipoDetalle:      csvS(r[5]) || 'A',
            serieDoc:         csvS(r[6]),
            desde:            csvS(r[7]) || '0',
            hasta:            csvS(r[8]) || '0',
            codigoGeneracion: csvS(r[9]),
            origen:           'csv'
        };
    }

    // Detectar si una fila es cabecera (texto no numérico en columnas clave)
    function esCabeceraCSV(row, tipo) {
        if (!row || row.length < 2) return true;
        // Si la primera columna tiene texto claramente no-fecha y no-número, es header
        var first = (row[0]||'').trim().toLowerCase();
        if (first === 'fecha' || first === 'nit' || first === 'date' || first === 'f_emision') return true;
        // Si todas las columnas numéricas esperadas son cadenas de texto, es header
        return false;
    }

    function ejecutarCsvImport() {
        var year  = parseInt(document.getElementById('csv_year').value);
        var month = parseInt(document.getElementById('csv_month').value);
        var tipo  = document.querySelector('input[name="csv_type"]:checked');

        if (!year || year < 2020 || year > 2035) { showToast('Ingresa un año válido (2020–2035)', 'error'); return; }
        if (isNaN(month)) { showToast('Selecciona el mes', 'error'); return; }
        if (!tipo) { showToast('Selecciona el tipo de libro', 'error'); return; }
        if (!csvParsedRows.length) { showToast('Carga un archivo CSV primero', 'error'); return; }

        var tipoVal = tipo.value;

        // Guardar estado actual del mes activo
        saveCurrentMonthData();

        // Cambiar temporalmente al mes/año de destino para cargar
        var prevYear  = currentYear;
        var prevMonth = currentMonth;
        currentYear   = year;
        currentMonth  = month;
        loadCurrentMonthData();

        var mappers = {
            compras:    csvRowToCompras,
            consumidor: csvRowToConsumidor,
            debito:     csvRowToDebito,
            percibido:  csvRowToPercibido,
            retenido:   csvRowToRetenido,
            anticipo:   csvRowToAnticipo,
            excluido:   csvRowToExcluido,
            f14:        csvRowToF14
        };
        var targets = {
            compras:    comprasRecords,
            consumidor: cfRecords,
            debito:     debitoRecords,
            percibido:  percibidoRecords,
            retenido:   retenidoRecords,
            anticipo:   anticipoRecords,
            excluido:   excluidoRecords,
            f14:        f14Records
        };

        var mapper = mappers[tipoVal];
        var target = targets[tipoVal];
        var count  = 0;
        var omitidos = 0;
        var duplicados = 0;

        csvParsedRows.forEach(function(row) {
            if (esCabeceraCSV(row, tipoVal)) { omitidos++; return; }
            if (row.every(function(c){ return !c.trim(); })) { omitidos++; return; }
            try {
                var rec = mapper(row);
                // CAMBIO 02: aplicar la misma validación de documentos duplicados que el
                // sistema ya usa para JSON (docFingerprint), también a los registros
                // importados por CSV, revisando el período activo y el resto de períodos.
                if (esDocumentoDuplicado(tipoVal, rec, target, null)) { duplicados++; return; }
                target.push(rec);
                count++;
            } catch(e) { omitidos++; }
        });

        saveCurrentMonthData();

        // Auto-registrar proveedores desde los registros importados
        // Bug #4 fix: además de registrar nuevos, aplicar clasificación existente del
        // catálogo a registros recién importados (incluso cuando es un mes anterior)
        var provNuevos = 0;
        var tiposConProveedor = ['compras', 'percibido', 'retenido', 'anticipo', 'excluido'];
        if (tiposConProveedor.indexOf(tipoVal) !== -1) {
            var provsActuales = loadProveedores();
            targets[tipoVal].forEach(function(r) {
                var nitProv = r.nit || r.identificacion || '';
                var nombreProv = r.nombre || '';
                var duiProv = r.dui || '';
                var nrcProv2 = r.nrc || '';
                if (nitProv) {
                    var added = autoRegistrarProveedor(nitProv, nombreProv, duiProv, nrcProv2);
                    if (added) provNuevos++;
                    else {
                        // Aplicar clasificación existente del catálogo al registro
                        var prov = provsActuales.find(function(p) { return p.nit === nitProv || (p.nrc && p.nrc === nitProv); });
                        if (prov) {
                            if (prov.nombre && !r.nombre) r.nombre = prov.nombre;
                            if (prov.clasif && !r.clasif) r.clasif = prov.clasif;
                            if (prov.sector && !r.sector) r.sector = prov.sector;
                            if (prov.tipoCosto && !r.tipoCosto) r.tipoCosto = prov.tipoCosto;
                        }
                    }
                }
            });
        }

        // Volver al mes activo original
        currentYear  = prevYear;
        currentMonth = prevMonth;
        loadCurrentMonthData();
        renderAllTables();
        updateMonthLabel();
        refreshOpenLibroLegal(); // AGREGADO NUEVO: refresca el Libro Legal si estaba abierto al restaurar el mes

        var MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        var msg = count + ' registros cargados en ' + MONTH_NAMES_ES[month] + ' ' + year;
        if (omitidos > 0) msg += ' (' + omitidos + ' filas omitidas)';
        if (duplicados > 0) msg += ' · ' + duplicados + ' duplicado(s) omitido(s)';
        if (provNuevos > 0) msg += ' · ' + provNuevos + ' proveedor(es) nuevos';
        showToast(msg, 'success');
        if (provNuevos > 0) renderProveedoresTable();
        closeCsvImportModal();
    }