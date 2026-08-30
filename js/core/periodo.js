// core/periodo.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════
    // PERSISTENCIA localStorage
    // ══════════════════════════════════════════════
    function monthKey(empresaId, year, month) {
        return 'fs_data_v' + APP_VERSION + '_' + empresaId + '_' + year + '_' + String(month).padStart(2,'0');
    }

    function saveCurrentMonthData() {
        if (!activeEmpresaId) return;
        var key = monthKey(activeEmpresaId, currentYear, currentMonth);
        var data = {
            debito:    debitoRecords,
            cf:        cfRecords,
            compras:   comprasRecords,
            percibido: percibidoRecords,
            retenido:  retenidoRecords,
            anticipo:  anticipoRecords,
            excluido:  excluidoRecords,
            f14:       f14Records,
            quincena25: quincena25Records,
            anulados:  anuladosRecords
        };
        try { fsStore.setItem(key, JSON.stringify(data)); } catch(e) { console.warn('localStorage full', e); }
        // Cambio 8: disparar re-render automático en el siguiente frame
        _scheduleRender();
    }

    function loadCurrentMonthData() {
        if (!activeEmpresaId) return;
        var key = monthKey(activeEmpresaId, currentYear, currentMonth);
        var raw = fsStore.getItem(key);
        if (raw) {
            try {
                var data = JSON.parse(raw);
                debitoRecords    = data.debito    || [];
                cfRecords        = data.cf        || [];
                comprasRecords   = data.compras   || [];
                percibidoRecords = data.percibido || [];
                retenidoRecords  = data.retenido  || [];
                anticipoRecords  = data.anticipo  || [];
                excluidoRecords  = data.excluido  || [];
                f14Records       = data.f14       || [];
                quincena25Records = data.quincena25 || [];
                anuladosRecords  = data.anulados  || [];
            } catch(e) {
                resetInMemoryRecords();
            }
        } else {
            resetInMemoryRecords();
        }
    }

    function resetInMemoryRecords() {
        debitoRecords   = [];
        cfRecords       = [];
        comprasRecords  = [];
        percibidoRecords= [];
        retenidoRecords = [];
        anticipoRecords = [];
        excluidoRecords = [];
        f14Records      = [];
        quincena25Records = [];
        anuladosRecords = [];
    }

    // ══════════════════════════════════════════════
    // SELECTOR DE MES
    // ══════════════════════════════════════════════
    function updateMonthLabel() {
        document.getElementById('monthLabel').innerText = MONTH_NAMES[currentMonth] + ' ' + currentYear;
    }

    function changeMonth(delta) {
        saveCurrentMonthData();

        // Cancelar cualquier render pendiente del _scheduleRender anterior
        // para evitar que se dispare después de cambiar currentMonth
        if (_renderRAF) { cancelAnimationFrame(_renderRAF); _renderRAF = null; }
        _renderPending = false;

        currentMonth += delta;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        if (currentMonth < 0)  { currentMonth = 11; currentYear--; }

        _aplicarCambioDePeriodoGestion();

        showToast('Periodo: ' + MONTH_NAMES[currentMonth] + ' ' + currentYear, 'success', { category: 'month-change' });

        // Agregado 01 — Integración Facturación Electrónica ↔ Gestión:
        // mantener el selector de mes de Facturación Electrónica
        // sincronizado con el que se acaba de elegir en Gestión (ver
        // _sincronizarMesFEconGestion más abajo).
        _sincronizarMesFEconGestion();
    }

    // ══════════════════════════════════════════════
    // RENDER ALL TABLES
    // ══════════════════════════════════════════════
    function renderAllTables() {
        renderDebitoTable();
        renderCfTable();
        renderComprasTable();
        renderPercibidoTable();
        renderRetenidoTable();
        renderAnticipoTable();
        renderExcluidoTable();
        renderF14Table();
        renderQuincena25Table();
        renderAnuladosTable();
        renderProveedoresTable();
        renderClientesTable();
    }