// exportacion/Exportacion.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    // ══════════════════════════════════════════════
    // EXPORT COUNTS UPDATE
    // ══════════════════════════════════════════════
    function updateExportCounts() {
        document.getElementById('exp-count-consumidor').innerText = cfRecords.length;
        document.getElementById('exp-count-debito').innerText     = debitoRecords.length;
        document.getElementById('exp-count-compras').innerText    = comprasRecords.length;
        document.getElementById('exp-count-percibido').innerText  = percibidoRecords.length;
        document.getElementById('exp-count-retenido').innerText   = retenidoRecords.length;
        document.getElementById('exp-count-anticipo').innerText   = anticipoRecords.length;
        document.getElementById('exp-count-excluido').innerText   = excluidoRecords.length;
        document.getElementById('exp-count-f14').innerText        = f14Records.length;
        document.getElementById('exp-count-quincena25').innerText = quincena25Records.length;
        document.getElementById('exp-count-anulados').innerText   = anuladosRecords.length;
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO (Cambio 03): RUTAS DE EXPORTACIÓN CONFIGURABLES
    // ══════════════════════════════════════════════════════════════════

    function _exportPathShortLabel(p) {
        if (!p) return 'Escritorio (predeterminado)';
        // Recorta rutas largas para que quepan en la caja sin romper el diseño
        return p.length > 46 ? ('…' + p.slice(-44)) : p;
    }

    function loadExportConfigUI() {
        if (!window.fiscalAPI || !window.fiscalAPI.getExportConfig) return;
        window.fiscalAPI.getExportConfig().then(function(res) {
            var cfg = (res && res.ok) ? res.config : { csvPath: null, pdfPath: null };
            var csvEl = document.getElementById('exportPathCsvDisplay');
            var pdfEl = document.getElementById('exportPathPdfDisplay');
            if (csvEl) { csvEl.textContent = _exportPathShortLabel(cfg.csvPath); csvEl.title = cfg.csvPath || ''; }
            if (pdfEl) { pdfEl.textContent = _exportPathShortLabel(cfg.pdfPath); pdfEl.title = cfg.pdfPath || ''; }
        });
    }

    function pickExportFolder(tipo) {
        if (!window.fiscalAPI || !window.fiscalAPI.selectFolder) return;
        window.fiscalAPI.selectFolder().then(function(folderPath) {
            if (!folderPath) return; // usuario canceló el diálogo
            var payload = {};
            if (tipo === 'csv') payload.csvPath = folderPath;
            else payload.pdfPath = folderPath;
            window.fiscalAPI.setExportConfig(payload).then(function(res) {
                if (res && res.ok) {
                    loadExportConfigUI();
                    showToast('Ruta de ' + (tipo === 'csv' ? 'CSV' : 'PDF') + ' actualizada', 'success');
                } else {
                    showToast('No se pudo guardar la ruta', 'error');
                }
            });
        });
    }

    function resetExportPaths() {
        fsConfirm('¿Restablecer las rutas de exportación al Escritorio (valor predeterminado)?', function() {
            window.fiscalAPI.resetExportConfig().then(function(res) {
                loadExportConfigUI();
                showToast('Rutas restablecidas al Escritorio', 'success');
            });
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 01 — EXPORTAR / IMPORTAR CATÁLOGOS POR EMPRESA
    // Permite trasladar el Catálogo de Proveedores, Clientes y Empleados de
    // la empresa activa entre distintas computadoras. Reutiliza exactamente
    // las mismas funciones de carga/guardado (loadProveedores/saveProveedores,
    // loadClientes/saveClientes, loadEmpleados/saveEmpleados) que ya usa el
    // resto de la aplicación, por lo que los catálogos permanecen
    // independientes por empresa (fs_prov_v.._<empresaId>, etc.) igual que
    // hasta ahora. No modifica ningún otro flujo de importación/exportación.
    // ══════════════════════════════════════════════════════════════════

    function exportarCatalogos() {
        if (!activeEmpresaId) { showToast('No hay una empresa activa seleccionada', 'error'); return; }
        var emp = empresas.find(function(e) { return e.id === activeEmpresaId; });

        var proveedoresList = loadProveedores();
        var clientesList    = loadClientes();
        var empleadosList   = loadEmpleados();

        if (!proveedoresList.length && !clientesList.length && !empleadosList.length) {
            showToast('Esta empresa no tiene registros en sus catálogos todavía', 'error');
            return;
        }

        var now = new Date();
        var pad = function(n) { return String(n).padStart(2,'0'); };
        var timestamp = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) +
                        'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

        var payload = {
            _fiscalSyncCatalogos: true,
            _version: '1.0',
            _exportedAt: timestamp,
            empresa: {
                id: emp ? emp.id : activeEmpresaId,
                razon: emp ? emp.razon : '',
                nit: emp ? emp.nit : ''
            },
            proveedores: proveedoresList,
            clientes: clientesList,
            empleados: empleadosList
        };

        var json = JSON.stringify(payload, null, 2);
        var blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var razonArchivo = (emp && emp.razon ? emp.razon : 'Empresa').replace(/[^a-z0-9]+/gi, '_');
        a.download = 'FiscalSync_Catalogos_' + razonArchivo + '_' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes()) + '.json';
        a.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);

        showToast('Catálogo exportado: ' + proveedoresList.length + ' proveedores, ' + clientesList.length + ' clientes, ' + empleadosList.length + ' empleados', 'success');
    }

    function abrirImportarCatalogos() {
        if (!activeEmpresaId) { showToast('No hay una empresa activa seleccionada', 'error'); return; }
        var input = document.getElementById('catalogosImportInput');
        if (input) input.click();
    }

    function handleCatalogosImportFile(file) {
        if (!file) return;
        var inputEl = document.getElementById('catalogosImportInput');
        var reader = new FileReader();
        reader.onload = function(e) {
            var parsed;
            try {
                parsed = JSON.parse(e.target.result);
            } catch(err) {
                showToast('El archivo seleccionado no es un JSON válido', 'error');
                if (inputEl) inputEl.value = '';
                return;
            }
            if (!parsed || !parsed._fiscalSyncCatalogos) {
                showToast('El archivo no corresponde a un Catálogo exportado de FiscalSync', 'error');
                if (inputEl) inputEl.value = '';
                return;
            }

            var emp = empresas.find(function(e) { return e.id === activeEmpresaId; });
            var razonActiva = emp ? (emp.razon || '') : '';
            var razonArchivo = (parsed.empresa && parsed.empresa.razon) ? parsed.empresa.razon : '';

            var mensaje = 'Se importarán los catálogos hacia la empresa actualmente activa' +
                (razonActiva ? (' (' + razonActiva + ')') : '') + '.\n' +
                (razonArchivo ? ('Estos catálogos fueron exportados desde: ' + razonArchivo + '.\n') : '') +
                'Los registros nuevos se agregarán; los que ya existan (mismo NIT/DUI) no se sobrescribirán.\n' +
                '¿Deseas continuar?';

            fsConfirm(mensaje, function() {
                _ejecutarImportacionCatalogos(parsed);
                if (inputEl) inputEl.value = '';
            });
        };
        reader.onerror = function() {
            showToast('No se pudo leer el archivo seleccionado', 'error');
            if (inputEl) inputEl.value = '';
        };
        reader.readAsText(file);
    }

    // Combina los catálogos del archivo importado con los ya existentes de la
    // empresa activa. No mezcla información entre empresas: siempre escribe
    // en las claves de almacenamiento (fs_prov_v.._<activeEmpresaId>, etc.) de
    // la empresa actualmente activa. No sobrescribe registros existentes: si
    // ya hay un registro con el mismo identificador (NIT/DUI), se omite.
    function _ejecutarImportacionCatalogos(parsed) {
        var resumen = { proveedores: 0, clientes: 0, empleados: 0, omitidos: 0 };

        if (Array.isArray(parsed.proveedores) && parsed.proveedores.length) {
            var provList = loadProveedores();
            var provExistentes = {};
            provList.forEach(function(p) { if (p.nit) provExistentes[p.nit] = true; if (p.nrc) provExistentes[p.nrc] = true; });
            parsed.proveedores.forEach(function(p) {
                var yaExiste = (p.nit && provExistentes[p.nit]) || (p.nrc && provExistentes[p.nrc]);
                if (yaExiste) { resumen.omitidos++; return; }
                provList.push(p);
                if (p.nit) provExistentes[p.nit] = true;
                if (p.nrc) provExistentes[p.nrc] = true;
                resumen.proveedores++;
            });
            saveProveedores(provList);
        }

        if (Array.isArray(parsed.clientes) && parsed.clientes.length) {
            var cliList = loadClientes();
            var cliExistentes = {};
            cliList.forEach(function(c) { if (c.nit) cliExistentes[c.nit] = true; if (c.nrc) cliExistentes[c.nrc] = true; });
            parsed.clientes.forEach(function(c) {
                var yaExiste = (c.nit && cliExistentes[c.nit]) || (c.nrc && cliExistentes[c.nrc]);
                if (yaExiste) { resumen.omitidos++; return; }
                cliList.push(c);
                if (c.nit) cliExistentes[c.nit] = true;
                if (c.nrc) cliExistentes[c.nrc] = true;
                resumen.clientes++;
            });
            saveClientes(cliList);
        }

        if (Array.isArray(parsed.empleados) && parsed.empleados.length) {
            var empList = loadEmpleados();
            var empExistentes = {};
            empList.forEach(function(emp2) { if (emp2.nit) empExistentes[emp2.nit] = true; if (emp2.dui) empExistentes[emp2.dui] = true; });
            parsed.empleados.forEach(function(emp2) {
                var yaExiste = (emp2.nit && empExistentes[emp2.nit]) || (emp2.dui && empExistentes[emp2.dui]);
                if (yaExiste) { resumen.omitidos++; return; }
                empList.push(emp2);
                if (emp2.nit) empExistentes[emp2.nit] = true;
                if (emp2.dui) empExistentes[emp2.dui] = true;
                resumen.empleados++;
            });
            saveEmpleados(empList);
        }

        // Refrescar las tablas visibles, si corresponde
        if (typeof renderProveedoresTable === 'function') renderProveedoresTable();
        if (typeof renderClientesTable === 'function') renderClientesTable();
        if (typeof renderEmpleadosTable === 'function') renderEmpleadosTable();

        var totalImportados = resumen.proveedores + resumen.clientes + resumen.empleados;
        if (totalImportados === 0) {
            showToast('No se importaron registros nuevos (todos ya existían en el catálogo)', 'success');
        } else {
            showToast('Importado: ' + resumen.proveedores + ' proveedores, ' + resumen.clientes + ' clientes, ' + resumen.empleados + ' empleados' + (resumen.omitidos ? ' (' + resumen.omitidos + ' ya existían)' : ''), 'success');
        }
    }