// backup/BackupRestore.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO: BACKUP & RESTORE — SISTEMA COMPLETO
    // ══════════════════════════════════════════════════════════════════

    var brPendingBackupData = null;

    function swBR(p, b) {
        ['br-tab-backup','br-tab-restore'].forEach(function(i) {
            var el = document.getElementById(i);
            if (el) el.style.display = 'none';
            el && el.classList.remove('active');
        });
        ['br-btn-backup','br-btn-restore'].forEach(function(i) {
            document.getElementById(i).classList.remove('active');
        });
        document.getElementById(p).style.display = 'block';
        document.getElementById(p).classList.add('active');
        document.getElementById(b).classList.add('active');
    }

    function openBackupRestoreModal() {
        brPendingBackupData = null;
        document.getElementById('brPreview').classList.add('hidden');
        document.getElementById('brError').classList.add('hidden');
        document.getElementById('brFileInput').value = '';
        swBR('br-tab-backup','br-btn-backup');
        renderBackupStats();
        document.getElementById('backupRestoreModal').style.display='flex'; document.getElementById('backupRestoreModal').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeBackupRestoreModal() {
        _cerrarModalAnimado('backupRestoreModal');
        brPendingBackupData = null;
    }

    function openRestoreNamesModal() {
        var list = document.getElementById('restoreNamesList');
        list.innerHTML = '';
        empresas.forEach(function(emp, i) {
            var isReconstructed = emp._reconstructed || /^emp_\d+_[a-z0-9]+$/i.test(emp.razon);
            if (!isReconstructed) return;
            var item = document.createElement('div');
            item.id = 'rnItem_' + i;
            item.style.cssText = 'background:var(--rp-inset);border:1px solid var(--rp-border-strong);border-radius:10px;padding:14px 16px;';
            item.innerHTML =
                '<p style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--rp-text-secondary);margin-bottom:8px;">ID: <span style="color:var(--rp-accent);">' + emp.id + '</span></p>' +
                '<div style="display:flex;gap:8px;">' +
                '<input type="text" id="rnRazon_' + i + '" class="f-input" placeholder="Razón Social de la empresa" style="flex:2;" value="">' +
                '<input type="text" id="rnNit_' + i + '" class="f-input" placeholder="NIT / DUI" style="flex:1;" value="' + (emp.nit||'') + '">' +
                '<input type="text" id="rnNrc_' + i + '" class="f-input" placeholder="NRC" style="flex:1;" value="' + (emp.nrc||'') + '">' +
                '<button onclick="saveRestoreName(' + i + ')" style="background:var(--rp-accent);color:#fff;border:none;border-radius:8px;padding:0 16px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;">Guardar</button>' +
                '</div>';
            list.appendChild(item);
        });
        if (!list.children.length) return; // nada que mostrar
        document.getElementById('restoreNamesModal').style.display='flex';
        document.getElementById('restoreNamesModal').classList.add('modal-open');
    }

    function saveRestoreName(index) {
        var razon = (document.getElementById('rnRazon_' + index) || {}).value;
        if (!razon || !razon.trim()) { showToast('Ingresa la Razón Social', 'error'); return; }
        empresas[index].razon   = razon.trim();
        empresas[index].nit     = ((document.getElementById('rnNit_' + index) || {}).value || '').trim();
        empresas[index].nrc     = ((document.getElementById('rnNrc_' + index) || {}).value || '').trim();
        delete empresas[index]._reconstructed;
        saveEmpresas();
        renderEmpresaList();
        // Marcar fila como completada en el modal
        var item = document.getElementById('rnItem_' + index);
        if (item) {
            item.style.borderColor = 'var(--rp-success)';
            item.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rp-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
                '<p style="font-size:13px;font-weight:600;color:var(--rp-success);">' + razon.trim() + '</p>' +
                '<p style="font-size:11px;color:var(--rp-text-secondary);margin-left:4px;">Guardada correctamente</p></div>';
        }
        // Si ya no hay pendientes, cerrar modal automáticamente
        var stillPending = empresas.some(function(e) { return e._reconstructed || /^emp_\d+_[a-z0-9]+$/i.test(e.razon); });
        if (!stillPending) {
            setTimeout(function() { closeRestoreNamesModal(); showToast('Todas las empresas han sido completadas', 'success'); }, 600);
        } else {
            showToast('Empresa guardada', 'success');
        }
    }

    function closeRestoreNamesModal() {
        _cerrarModalAnimado('restoreNamesModal');
    }

    function renderBackupStats() {
        var statsEl = document.getElementById('brBackupStats');
        if (!statsEl) return;

        var empCount = empresas.length;
        var usersCount = loadFsUsers().length;

        // Contar total de registros en localStorage
        var totalMonths = 0;
        var totalRecords = 0;
        var totalRevStates = 0;
        var totalAnulados = 0;
        // AGREGADO (Cambio 01): contadores de Clientes, Empleados y Correos
        var totalClientes = 0;
        var totalEmpleados = 0;
        var totalCorreosDocs = 0;
        var totalProveedores = 0;
        for (var i = 0; i < fsStore.length(); i++) {
            var key = fsStore.key(i);
            if (key && key.startsWith('fs_data_v' + APP_VERSION + '_')) {
                totalMonths++;
                try {
                    var d = JSON.parse(fsStore.getItem(key));
                    ['debito','cf','compras','percibido','retenido','anticipo','excluido','f14'].forEach(function(k) {
                        if (d[k]) totalRecords += d[k].length;
                    });
                    if (Array.isArray(d.anulados)) totalAnulados += d.anulados.length;
                } catch(e) {}
            }
            if (key && key.startsWith('fs_rev_v' + APP_VERSION + '_')) {
                try {
                    var rv = JSON.parse(fsStore.getItem(key));
                    if (rv && typeof rv === 'object') totalRevStates += Object.keys(rv).length;
                } catch(e) {}
            }
            if (key && key.startsWith('fs_prov_v' + APP_VERSION + '_')) {
                try {
                    var pv = JSON.parse(fsStore.getItem(key));
                    if (Array.isArray(pv)) totalProveedores += pv.length;
                } catch(e) {}
            }
            if (key && key.startsWith('fs_clientes_v' + APP_VERSION + '_')) {
                try {
                    var cl = JSON.parse(fsStore.getItem(key));
                    if (Array.isArray(cl)) totalClientes += cl.length;
                } catch(e) {}
            }
            if (key && key.startsWith('fs_empleados_v' + APP_VERSION + '_')) {
                try {
                    var em = JSON.parse(fsStore.getItem(key));
                    if (Array.isArray(em)) totalEmpleados += em.length;
                } catch(e) {}
            }
            if (key && key.startsWith('fs_correos_docs_v' + APP_VERSION + '_')) {
                try {
                    var cd = JSON.parse(fsStore.getItem(key));
                    if (Array.isArray(cd)) totalCorreosDocs += cd.length;
                } catch(e) {}
            }
        }

        statsEl.innerHTML =
            '<div class="backup-stat-card"><span class="bsc-label">Empresas</span><span class="bsc-value">' + empCount + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Usuarios</span><span class="bsc-value">' + usersCount + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Períodos</span><span class="bsc-value">' + totalMonths + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Total Registros</span><span class="bsc-value">' + totalRecords + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Doc. Revisados</span><span class="bsc-value" style="color:var(--rp-success);">' + totalRevStates + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Anulados</span><span class="bsc-value" style="color:var(--rp-warning);">' + totalAnulados + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Proveedores</span><span class="bsc-value">' + totalProveedores + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Clientes — Gestión</span><span class="bsc-value">' + totalClientes + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Empleados</span><span class="bsc-value">' + totalEmpleados + '</span></div>' +
            '<div class="backup-stat-card"><span class="bsc-label">Correos Generados</span><span class="bsc-value">' + totalCorreosDocs + '</span></div>';

        // AGREGADO (Cambio 01): mostrar por separado el conteo de Clientes
        // de Facturación Electrónica (catálogo independiente del de
        // Gestión de arriba). Se agrega de forma asíncrona porque este
        // catálogo vive en disco por empresa (fiscalAPI.leerClientesFE).
        if (window.fiscalAPI && window.fiscalAPI.leerClientesFE && Array.isArray(empresas) && empresas.length) {
            Promise.all(empresas.map(function(emp) {
                return window.fiscalAPI.leerClientesFE(emp.id).then(function(res) {
                    return (res && res.ok && Array.isArray(res.clientes)) ? res.clientes.length : 0;
                }).catch(function() { return 0; });
            })).then(function(counts) {
                var totalClientesFE = counts.reduce(function(a, b) { return a + b; }, 0);
                var elNow = document.getElementById('brBackupStats');
                if (!elNow) return;
                var feCard = document.createElement('div');
                feCard.className = 'backup-stat-card';
                feCard.innerHTML = '<span class="bsc-label">Clientes — Fact. Electrónica</span><span class="bsc-value">' + totalClientesFE + '</span>';
                elNow.appendChild(feCard);
            });
        }
    }

    function generarBackup() {
        // Recopilar TODOS los datos de localStorage que pertenezcan a FiscalSync
        var allData = {};
        for (var i = 0; i < fsStore.length(); i++) {
            var key = fsStore.key(i);
            if (key && (
                key === 'fs_v' + APP_VERSION + '_empresas' ||
                key === 'fs_v' + APP_VERSION + '_users' ||
                key.startsWith('fs_data_v' + APP_VERSION + '_') ||
                key.startsWith('fs_res_v' + APP_VERSION + '_') ||
                key.startsWith('fs_prov_v' + APP_VERSION + '_') ||
                key.startsWith('fs_rev_v' + APP_VERSION + '_') ||
                // AGREGADO (Cambio 01): Clientes, Empleados y Correos entran al backup completo
                key.startsWith('fs_clientes_v' + APP_VERSION + '_') ||
                key.startsWith('fs_empleados_v' + APP_VERSION + '_') ||
                key.startsWith('fs_correos_docs_v' + APP_VERSION + '_') ||
                key.startsWith('fs_correos_hist_v' + APP_VERSION + '_') ||
                key.startsWith('fs_correos_plant_v' + APP_VERSION + '_')
            )) {
                try {
                    allData[key] = JSON.parse(fsStore.getItem(key));
                } catch(e) {
                    allData[key] = fsStore.getItem(key);
                }
            }
        }

        // AGREGADO (Cambio 01): incorporar al Backup completo el catálogo
        // de Clientes de Facturación Electrónica (independiente del de
        // Gestión, ya incluido arriba en allData).
        _feClientesBackupRecolectar().then(function(feData) {
            Object.keys(feData).forEach(function(k) { allData[k] = feData[k]; });

            var now = new Date();
            var pad = function(n) { return String(n).padStart(2,'0'); };
            var timestamp = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) +
                            'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

            var backup = {
                _fiscalSyncBackup: true,
                _version: '1.0',
                _createdAt: timestamp,
                _empresaCount: empresas.length,
                _userCount: loadFsUsers().length,
                data: allData
            };

            var json = JSON.stringify(backup, null, 2);
            var blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'FiscalSync_Backup_' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes()) + '.json';
            a.click();
            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);

            showToast('Backup descargado exitosamente', 'success');
        });
    }

    function handleBackupDrop(event) {
        event.preventDefault();
        document.getElementById('brDropZone').classList.remove('drag-over');
        var files = event.dataTransfer.files;
        if (files && files.length > 0) {
            handleBackupFile(files[0]);
        }
    }

    function handleBackupFile(file) {
        document.getElementById('brPreview').classList.add('hidden');
        document.getElementById('brError').classList.add('hidden');
        brPendingBackupData = null;

        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.json')) {
            mostrarErrorBackup('El archivo debe ser un .json generado por FiscalSync.');
            return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var parsed = JSON.parse(e.target.result);

                // Validar estructura del backup
                if (!parsed._fiscalSyncBackup) {
                    mostrarErrorBackup('Archivo inválido: no es un backup de FiscalSync. Asegúrate de usar un archivo generado por esta aplicación.');
                    return;
                }
                if (!parsed.data || typeof parsed.data !== 'object') {
                    mostrarErrorBackup('Archivo corrupto: la sección de datos está ausente o tiene formato incorrecto.');
                    return;
                }

                // Calcular estadísticas del backup
                var empCount = 0;
                var usersCount = 0;
                var monthCount = 0;
                var recordCount = 0;

                try {
                    var empListPreview = parsed.data['fs_v' + APP_VERSION + '_empresas'] || parsed.data['fs_empresas'];
                    if (empListPreview && Array.isArray(empListPreview)) {
                        empCount = empListPreview.length;
                    } else {
                        // Backup antiguo: extraer IDs únicos de empresa desde las claves
                        var empIdsSet = {};
                        Object.keys(parsed.data).forEach(function(k) {
                            var m = k.match(/emp_(\d+_[a-z0-9]+)/i);
                            if (m) empIdsSet[m[1]] = true;
                        });
                        empCount = Object.keys(empIdsSet).length;
                    }
                } catch(e) {}
                try { usersCount = (parsed.data['fs_v' + APP_VERSION + '_users'] || parsed.data['fs_users'] || []).length; } catch(e) {}

                Object.keys(parsed.data).forEach(function(key) {
                    if (key.startsWith('fs_data_v' + APP_VERSION + '_') || key.startsWith('fs_data_')) {
                        monthCount++;
                        var d = parsed.data[key];
                        if (d && typeof d === 'object') {
                            ['debito','cf','compras','percibido','retenido','anticipo','excluido','f14','anulados'].forEach(function(k) {
                                if (Array.isArray(d[k])) recordCount += d[k].length;
                            });
                        }
                    }
                });

                var revCount = 0;
                // AGREGADO (Cambio 01): estadísticas de Clientes, Empleados y Correos del backup cargado
                var clientesCount = 0;
                var empleadosCount = 0;
                var correosCount = 0;
                var proveedoresCount = 0;
                Object.keys(parsed.data).forEach(function(key) {
                    if (key.startsWith('fs_rev_v' + APP_VERSION + '_') || key.startsWith('fs_revision_')) {
                        var rv = parsed.data[key];
                        if (rv && typeof rv === 'object') revCount += Object.keys(rv).length;
                    }
                    if (key.startsWith('fs_prov_v' + APP_VERSION + '_')) {
                        var pvArr = parsed.data[key];
                        if (Array.isArray(pvArr)) proveedoresCount += pvArr.length;
                    }
                    if (key.startsWith('fs_clientes_v' + APP_VERSION + '_')) {
                        var clArr = parsed.data[key];
                        if (Array.isArray(clArr)) clientesCount += clArr.length;
                    }
                    if (key.startsWith('fs_empleados_v' + APP_VERSION + '_')) {
                        var emArr = parsed.data[key];
                        if (Array.isArray(emArr)) empleadosCount += emArr.length;
                    }
                    if (key.startsWith('fs_correos_docs_v' + APP_VERSION + '_')) {
                        var cdArr = parsed.data[key];
                        if (Array.isArray(cdArr)) correosCount += cdArr.length;
                    }
                });

                // AGREGADO (Cambio 01): contar Clientes de Facturación
                // Electrónica presentes en el Backup cargado (catálogo
                // independiente de Clientes de Gestión). Un Backup antiguo
                // que no tenga este dato simplemente cuenta 0, sin error.
                var clientesFECount = 0;
                Object.keys(parsed.data).forEach(function(key) {
                    if (key.indexOf(FE_CLIENTES_BACKUP_PREFIX) === 0) {
                        var feArr = parsed.data[key];
                        if (Array.isArray(feArr)) clientesFECount += feArr.length;
                    }
                });

                brPendingBackupData = parsed;

                // Mostrar preview
                document.getElementById('brFileName').innerText = file.name;
                document.getElementById('brFileDate').innerText = parsed._createdAt
                    ? 'Creado: ' + parsed._createdAt.replace('T',' ')
                    : 'Fecha de creación desconocida';

                document.getElementById('brPreviewStats').innerHTML =
                    '<div class="backup-stat-card"><span class="bsc-label">Empresas</span><span class="bsc-value">' + empCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Usuarios</span><span class="bsc-value">' + usersCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Períodos</span><span class="bsc-value">' + monthCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Total Registros</span><span class="bsc-value">' + recordCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Doc. Revisados</span><span class="bsc-value" style="color:var(--rp-success);">' + revCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Proveedores</span><span class="bsc-value">' + proveedoresCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Clientes — Gestión</span><span class="bsc-value">' + clientesCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Clientes — Fact. Electrónica</span><span class="bsc-value">' + clientesFECount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Empleados</span><span class="bsc-value">' + empleadosCount + '</span></div>' +
                    '<div class="backup-stat-card"><span class="bsc-label">Correos Generados</span><span class="bsc-value">' + correosCount + '</span></div>';

                document.getElementById('brPreview').classList.remove('hidden');
                lucide.createIcons();

            } catch(err) {
                mostrarErrorBackup('Error al leer el archivo: ' + err.message + '. Asegúrate de que el archivo no esté dañado.');
            }
        };
        reader.onerror = function() {
            mostrarErrorBackup('No se pudo leer el archivo. Intenta de nuevo.');
        };
        reader.readAsText(file);
    }

    function mostrarErrorBackup(msg) {
        document.getElementById('brErrorMsg').innerText = msg;
        document.getElementById('brError').classList.remove('hidden');
        document.getElementById('brPreview').classList.add('hidden');
        brPendingBackupData = null;
    }

    function ejecutarRestore() {
        if (!brPendingBackupData) {
            mostrarErrorBackup('No hay backup cargado. Selecciona un archivo primero.');
            return;
        }
        fsConfirm('¿Confirmas restaurar el sistema?\n\nTODOS los datos actuales serán reemplazados permanentemente. Esta acción no se puede deshacer.', function() {

        try {
            var data = brPendingBackupData.data;

            // Paso 1: Limpiar todos los datos existentes de FiscalSync en localStorage
            var keysToRemove = [];
            for (var i = 0; i < fsStore.length(); i++) {
                var key = fsStore.key(i);
                if (key && (
                    key === 'fs_v' + APP_VERSION + '_empresas' ||
                    key === 'fs_v' + APP_VERSION + '_users' ||
                    key.startsWith('fs_data_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_res_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_prov_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_rev_v' + APP_VERSION + '_') ||
                    // AGREGADO (Cambio 01): limpiar también Clientes, Empleados y Correos antes de restaurar
                    key.startsWith('fs_clientes_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_empleados_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_correos_docs_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_correos_hist_v' + APP_VERSION + '_') ||
                    key.startsWith('fs_correos_plant_v' + APP_VERSION + '_') ||
                    // AGREGADO (Cambio 01): limpiar también el transporte de
                    // Clientes de Facturación Electrónica antes de restaurar
                    key.startsWith(FE_CLIENTES_BACKUP_PREFIX)
                )) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(function(k) { fsStore.removeItem(k); });

            // AGREGADO (Cambio 01): limpiar los Clientes de Facturación
            // Electrónica de las empresas actualmente cargadas en su
            // propio almacenamiento (independiente del catálogo de
            // Clientes de Gestión, que se limpia arriba sin cambios).
            try {
                if (window.fiscalAPI && window.fiscalAPI.guardarClientesFE && Array.isArray(empresas)) {
                    empresas.forEach(function(emp) {
                        try { window.fiscalAPI.guardarClientesFE(emp.id, []); } catch(e) {}
                    });
                }
            } catch(feCleanErr) {}

            // Paso 2: Restaurar todos los datos del backup
            var restoredKeys = 0;
            Object.keys(data).forEach(function(key) {
                try {
                    fsStore.setItem(key, JSON.stringify(data[key]));
                    restoredKeys++;
                } catch(e) {
                    console.warn('No se pudo restaurar la clave: ' + key, e);
                }
            });

            // AGREGADO (Cambio 01): restaurar los Clientes de Facturación
            // Electrónica en su propio almacenamiento (fiscalAPI.
            // guardarClientesFE), SIN convertirlos en Clientes de Gestión
            // ni sobrescribir ese catálogo, que ya se restauró arriba.
            try { _feClientesBackupRestaurar(data); } catch(feRestoreErr) {
                console.warn('No se pudieron restaurar los Clientes de Facturación Electrónica:', feRestoreErr);
            }

            // Paso 2c: MIGRACIÓN DE CLAVES ANTIGUAS — renombrar claves sin versión al formato actual
            // Cubre: fs_data_emp_*, fs_revision_emp_*, fs_proveedores_emp_*, fs_resSeries_emp_*
            try {
                var legacyMigrations = [];
                for (var lmi = 0; lmi < fsStore.length(); lmi++) {
                    var lmk = fsStore.key(lmi);
                    if (!lmk) continue;
                    var newKey = null;
                    // fs_data_emp_ID_YEAR_MONTH  →  fs_data_v1.0.9_emp_ID_YEAR_MONTH
                    if (/^fs_data_emp_/.test(lmk) && !/^fs_data_v/.test(lmk)) {
                        newKey = lmk.replace(/^fs_data_/, 'fs_data_v' + APP_VERSION + '_');
                    }
                    // fs_data_v1.0.9_emp_ID_YEAR_MONTH (versión distinta) → actualizar versión
                    else if (/^fs_data_v/.test(lmk) && lmk.indexOf('fs_data_v' + APP_VERSION + '_') !== 0) {
                        newKey = lmk.replace(/^fs_data_v[^_]+_/, 'fs_data_v' + APP_VERSION + '_');
                    }
                    // fs_revision_emp_*  →  fs_rev_v1.0.9_emp_*
                    else if (/^fs_revision_emp_/.test(lmk)) {
                        newKey = lmk.replace(/^fs_revision_/, 'fs_rev_v' + APP_VERSION + '_');
                    }
                    // fs_proveedores_emp_*  →  fs_prov_v1.0.9_emp_*
                    else if (/^fs_proveedores_emp_/.test(lmk)) {
                        newKey = lmk.replace(/^fs_proveedores_/, 'fs_prov_v' + APP_VERSION + '_');
                    }
                    // fs_resSeries_emp_*  →  fs_res_v1.0.9_emp_*
                    else if (/^fs_resSeries_emp_/.test(lmk)) {
                        newKey = lmk.replace(/^fs_resSeries_/, 'fs_res_v' + APP_VERSION + '_');
                    }
                    if (newKey && newKey !== lmk) {
                        legacyMigrations.push({ oldKey: lmk, newKey: newKey });
                    }
                }
                legacyMigrations.forEach(function(pair) {
                    try {
                        var val = fsStore.getItem(pair.oldKey);
                        if (val !== null) {
                            fsStore.setItem(pair.newKey, val);
                            fsStore.removeItem(pair.oldKey);
                        }
                    } catch(e) {}
                });
            } catch(lmErr) {
                console.warn('Migración de claves antiguas con advertencia:', lmErr);
            }

            // Paso 2b: MIGRACIÓN DE CLAVE DE EMPRESAS — si el backup es antiguo y no tiene
            // la clave 'fs_v{VERSION}_empresas', reconstruirla extrayendo IDs únicos de las claves.
            try {
                var hasEmpKey = !!fsStore.getItem('fs_v' + APP_VERSION + '_empresas');
                if (!hasEmpKey) {
                    var empIdsFound = {};
                    for (var ei = 0; ei < fsStore.length(); ei++) {
                        var ek = fsStore.key(ei);
                        if (!ek) continue;
                        var em = ek.match(/emp_(\d+)_([a-z0-9]+)/i);
                        if (em) {
                            var fullId = 'emp_' + em[1] + '_' + em[2];
                            empIdsFound[fullId] = true;
                        }
                    }
                    var reconstructedEmps = Object.keys(empIdsFound).map(function(eid) {
                        return { id: eid, razon: eid, nit: '', nrc: '', tipoIng: '1', sector: '1', _reconstructed: true };
                    });
                    if (reconstructedEmps.length > 0) {
                        fsStore.setItem('fs_v' + APP_VERSION + '_empresas', JSON.stringify(reconstructedEmps));
                    }
                }
            } catch(rebuildErr) {
                console.warn('Reconstrucción de empresas con advertencia:', rebuildErr);
            }

            // Paso 3: MIGRACIÓN DE VERSIÓN — aplicar directrices actuales sobre datos restaurados
            // Garantiza que registros de backups antiguos sean compatibles con la versión en ejecución
            try {
                var empRaw = fsStore.getItem('fs_v' + APP_VERSION + '_empresas');
                var empList = empRaw ? JSON.parse(empRaw) : [];
                var migrated = false;
                empList.forEach(function(emp) {
                    if (!emp.tipoIng) { emp.tipoIng = '1'; migrated = true; }
                    if (!emp.sector)  { emp.sector  = '1'; migrated = true; }
                });
                if (migrated) fsStore.setItem('fs_v' + APP_VERSION + '_empresas', JSON.stringify(empList));

                // Migrar registros de datos mensuales — asegurar campos nuevos existan
                for (var ki = 0; ki < fsStore.length(); ki++) {
                    var dkey = fsStore.key(ki);
                    if (dkey && dkey.startsWith('fs_data_v' + APP_VERSION + '_')) {
                        try {
                            var dRaw = fsStore.getItem(dkey);
                            var dObj = dRaw ? JSON.parse(dRaw) : null;
                            if (!dObj) continue;
                            var dmig = false;
                            // Asegurar array anulados existe
                            if (!Array.isArray(dObj.anulados)) { dObj.anulados = []; dmig = true; }
                            // Asegurar array f14 existe
                            if (!Array.isArray(dObj.f14)) { dObj.f14 = []; dmig = true; }
                            // Asegurar tipoIng en registros debito y cf
                            ['debito','cf'].forEach(function(arr) {
                                if (Array.isArray(dObj[arr])) {
                                    dObj[arr].forEach(function(rec) {
                                        if (!rec.tipoIng) { rec.tipoIng = '1'; dmig = true; }
                                        if (!rec.clase)   { rec.clase   = '4'; dmig = true; }
                                    });
                                }
                            });
                            // Asegurar campos de clasificación en compras
                            if (Array.isArray(dObj.compras)) {
                                dObj.compras.forEach(function(rec) {
                                    if (!rec.clasif)    { rec.clasif    = '1'; dmig = true; }
                                    if (!rec.sector)    { rec.sector    = '1'; dmig = true; }
                                    if (!rec.tipoCosto) { rec.tipoCosto = '1'; dmig = true; }
                                });
                            }
                            if (dmig) fsStore.setItem(dkey, JSON.stringify(dObj));
                        } catch(me) {}
                    }
                }
            } catch(migErr) {
                console.warn('Migración de versión con advertencia:', migErr);
            }

            // Paso 4: Recargar estado en memoria
            loadEmpresas();

            // Paso 5: Si había una empresa activa, volver a la pantalla de empresas
            activeEmpresaId = null;
            resetInMemoryRecords();

            // AJUSTADO — Cambio 07 (Animaciones): misma transición visual
            // consistente al volver a la pantalla de empresas.
            _mostrarPantalla('empresaScreen', 'workspaceContainer');
            renderEmpresaList();
            lucide.createIcons();

            // Si hay empresas reconstruidas (sin razón social), mostrar modal de completar
            var needsNames = empresas.some(function(e) { return e._reconstructed || /^emp_\d+_[a-z0-9]+$/i.test(e.razon); });
            if (needsNames) { openRestoreNamesModal(); }

            // Cerrar modal
            closeBackupRestoreModal();

            showToast('Sistema restaurado exitosamente (' + restoredKeys + ' bloques de datos)', 'success');

        } catch(err) {
            mostrarErrorBackup('Error durante la restauración: ' + err.message + '. El sistema puede estar en un estado parcial. Recarga la página e intenta de nuevo.');
        }
    }); }