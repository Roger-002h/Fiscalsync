// core/reindexacion.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO: FUNCIÓN REINDEXAR
    // Reconstruye y sincroniza toda la información interna del sistema
    // (catálogo de empresas, períodos y Libros de IVA de cada empresa)
    // aplicando la lógica y estructura de la versión actualmente
    // instalada. No elimina ni sobrescribe información ingresada
    // manualmente por el usuario: únicamente recalcula/completa datos
    // derivados y estructurales, siendo especialmente útil después de
    // actualizar el programa desde una versión anterior.
    // ══════════════════════════════════════════════════════════════════
    function confirmarReindexarSistema() {
        fsConfirm(
            'Reindexar Sistema\n' +
            'Esta acción recorrerá todas las empresas y períodos guardados para recalcular ' +
            'información interna, actualizar los Libros de IVA con la lógica vigente y ' +
            'sincronizar la estructura de datos con la versión actual del programa.\n\n' +
            'No se eliminará ni sobrescribirá información ingresada manualmente. ¿Deseas continuar?',
            function() { reindexarSistema(); }
        );
    }

    function reindexarSistema() {
        try {
            var resumen = {
                empresasProcesadas:   0,
                empresasActualizadas: 0,
                periodosProcesados:   0,
                periodosActualizados: 0,
                registrosVerificados: 0,
                camposCorregidos:     0
            };

            // ── PASO 1: Sincronizar catálogo de empresas con la versión actual ──
            var empRaw = fsStore.getItem('fs_v' + APP_VERSION + '_empresas');
            var empList = empRaw ? JSON.parse(empRaw) : [];
            var empresasCambiaron = false;

            empList.forEach(function(emp) {
                resumen.empresasProcesadas++;
                var cambio = false;
                if (!emp.tipoIng)                              { emp.tipoIng     = '1';    cambio = true; }
                if (!emp.sector)                                { emp.sector      = '1';    cambio = true; }
                if (typeof emp.correosActivo === 'undefined')   { emp.correosActivo = false; cambio = true; }
                if (typeof emp.correosEmail  === 'undefined')   { emp.correosEmail  = '';    cambio = true; }
                if (typeof emp.correosPass   === 'undefined')   { emp.correosPass   = '';    cambio = true; }
                // Implementación 01 — Facturación Electrónica: empresas
                // creadas antes de esta función quedan con la config
                // deshabilitada por defecto (comportamiento actual, sin
                // pantalla de selección — ver ingresarEmpresa()).
                if (typeof emp.facturacionElectronica === 'undefined') { emp.facturacionElectronica = false; cambio = true; }
                if (cambio) {
                    resumen.empresasActualizadas++;
                    resumen.camposCorregidos++;
                    empresasCambiaron = true;
                }
            });

            if (empresasCambiaron) {
                fsStore.setItem('fs_v' + APP_VERSION + '_empresas', JSON.stringify(empList));
            }

            // ── PASO 2: Recorrer todos los períodos (Libros de IVA) de todas las empresas ──
            for (var i = 0; i < fsStore.length(); i++) {
                var key = fsStore.key(i);
                if (!key || key.indexOf('fs_data_v' + APP_VERSION + '_') !== 0) continue;

                var raw = fsStore.getItem(key);
                var data;
                try { data = raw ? JSON.parse(raw) : null; } catch(e) { data = null; }
                if (!data) continue;

                resumen.periodosProcesados++;
                var periodoCambio = false;

                // Asegurar que existan todos los libros que utiliza la versión actual,
                // sin tocar los datos ya existentes en cada uno.
                ['debito','cf','compras','percibido','retenido','anticipo','excluido','f14','anulados'].forEach(function(libro) {
                    if (!Array.isArray(data[libro])) { data[libro] = []; periodoCambio = true; resumen.camposCorregidos++; }
                });

                // Recalcular/actualizar Libros de IVA (Débito Fiscal y Crédito Fiscal) con la lógica vigente
                ['debito','cf'].forEach(function(libro) {
                    data[libro].forEach(function(rec) {
                        resumen.registrosVerificados++;
                        if (!rec.tipoIng) { rec.tipoIng = '1'; periodoCambio = true; resumen.camposCorregidos++; }
                        if (!rec.clase)   { rec.clase   = '4'; periodoCambio = true; resumen.camposCorregidos++; }
                    });
                });

                // Actualizar clasificación de Compras con la lógica vigente
                data.compras.forEach(function(rec) {
                    resumen.registrosVerificados++;
                    if (!rec.clasif)    { rec.clasif    = '1'; periodoCambio = true; resumen.camposCorregidos++; }
                    if (!rec.sector)    { rec.sector    = '1'; periodoCambio = true; resumen.camposCorregidos++; }
                    if (!rec.tipoCosto) { rec.tipoCosto = '1'; periodoCambio = true; resumen.camposCorregidos++; }
                });

                // Verificar el resto de libros para dejar constancia en el resumen
                ['percibido','retenido','anticipo','excluido','f14','anulados'].forEach(function(libro) {
                    resumen.registrosVerificados += data[libro].length;
                });

                if (periodoCambio) {
                    fsStore.setItem(key, JSON.stringify(data));
                    resumen.periodosActualizados++;
                }
            }

            // ── PASO 3: Recargar el estado en memoria para reflejar la información sincronizada ──
            loadEmpresas();
            renderEmpresaList();

            if (activeEmpresaId) {
                loadCurrentMonthData();
                renderAllTables();
            }

            var msg = 'Reindexación completa: ' + resumen.empresasProcesadas + ' empresa(s), ' +
                resumen.periodosProcesados + ' período(s) y ' + resumen.registrosVerificados +
                ' registro(s) verificados' +
                (resumen.camposCorregidos > 0 ? ' (' + resumen.camposCorregidos + ' campo(s) sincronizado(s))' : '') + '.';
            showToast(msg, 'success');

        } catch(err) {
            console.warn('Reindexar con advertencia:', err);
            showToast('Ocurrió un problema durante la reindexación: ' + err.message, 'error');
        }
    }