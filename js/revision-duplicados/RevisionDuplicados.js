// revision-duplicados/RevisionDuplicados.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // MODO REVISIÓN — Sistema de revisión de documentos
    // ══════════════════════════════════════════════════════════════════

    // Estado en memoria: { debito: bool, cf: bool, compras: bool }
    var _revisionActive = { debito: false, cf: false, compras: false, percibido: false, retenido: false, anticipo: false, excluido: false, f14: false };

    // Persistencia: clave por empresa + mes + libro
    function revKey(libro) {
        return 'fs_rev_v' + APP_VERSION + '_' + (activeEmpresaId||'_') + '_' + currentYear + '_' + String(currentMonth).padStart(2,'0') + '_' + libro;
    }
    function loadRevStates(libro) {
        try { var r = fsStore.getItem(revKey(libro)); return r ? JSON.parse(r) : {}; } catch(e) { return {}; }
    }
    function saveRevStates(libro, states) {
        try { fsStore.setItem(revKey(libro), JSON.stringify(states)); } catch(e) {}
    }

    function toggleModoRevision(libro) {
        _revisionActive[libro] = !_revisionActive[libro];
        var btnMap = { debito: 'btnRevisionDebito', cf: 'btnRevisionCf', compras: 'btnRevisionCompras',
                       percibido: 'btnRevisionPercibido', retenido: 'btnRevisionRetenido',
                       anticipo: 'btnRevisionAnticipo', excluido: 'btnRevisionExcluido', f14: 'btnRevisionF14' };
        var btn = document.getElementById(btnMap[libro]);
        var exportBtn = document.getElementById('btnExportFalta_' + libro);
        if (_revisionActive[libro]) {
            if (btn) { btn.classList.add('btn-revision-active'); }
        } else {
            if (btn) { btn.classList.remove('btn-revision-active'); }
            // Deshabilitar el botón exportar al desactivar modo revisión
            if (exportBtn) exportBtn.style.display = 'none';
            // Cambio 02 — Al salir de Modo Revisión, "Consulta DTE" vuelve a su
            // comportamiento normal (siempre visible), sin importar los estados.
            var dteBtn = document.getElementById('btnConsultaDte_' + libro);
            if (dteBtn) dteBtn.style.display = 'flex';
        }
        // Ocultar columnas "Acciones" y "Estado DGII" mientras el modo revisión
        // está activo; vuelven a aparecer automáticamente al desactivarlo.
        var tbodyMap = { debito: 'debitoTableBody', cf: 'cfTableBody', compras: 'comprasTableBody',
                          percibido: 'percibidoTableBody', retenido: 'retenidoTableBody',
                          anticipo: 'anticipoTableBody', excluido: 'excluidoTableBody', f14: 'f14TableBody' };
        var tbodyEl = document.getElementById(tbodyMap[libro]);
        var tableEl = tbodyEl && tbodyEl.closest('table');
        if (tableEl) tableEl.classList.toggle('rev-cols-hidden', _revisionActive[libro]);
        if (libro === 'debito')    renderDebitoTable();
        if (libro === 'cf')        renderCfTable();
        if (libro === 'compras')   renderComprasTable();
        if (libro === 'percibido') renderPercibidoTable();
        if (libro === 'retenido')  renderRetenidoTable();
        if (libro === 'anticipo')  renderAnticipoTable();
        if (libro === 'excluido')  renderExcluidoTable();
        if (libro === 'f14')       renderF14Table();
        lucide.createIcons();
    }

    // Asignar estado de revisión a un documento
    function setRevState(libro, index, estado) {
        var states = loadRevStates(libro);
        if (estado === null) {
            delete states[index];
        } else {
            states[index] = estado;
        }
        saveRevStates(libro, states);
        if (libro === 'debito')    renderDebitoTable();
        if (libro === 'cf')        renderCfTable();
        if (libro === 'compras')   renderComprasTable();
        if (libro === 'percibido') renderPercibidoTable();
        if (libro === 'retenido')  renderRetenidoTable();
        if (libro === 'anticipo')  renderAnticipoTable();
        if (libro === 'excluido')  renderExcluidoTable();
        if (libro === 'f14')       renderF14Table();
        lucide.createIcons();
    }

    // Eliminar duplicado
    function eliminarDuplicadoRevision(libro, index) {
        fsConfirm('¿Eliminar este documento duplicado?\n\nSolo se eliminará esta copia. El documento original quedará intacto.', function() {
            if (libro === 'debito')    { debitoRecords.splice(index, 1); saveCurrentMonthData(); renderDebitoTable(); }
            if (libro === 'cf')        { cfRecords.splice(index, 1); saveCurrentMonthData(); renderCfTable(); }
            if (libro === 'compras')   { comprasRecords.splice(index, 1); saveCurrentMonthData(); renderComprasTable(); }
            if (libro === 'percibido') { percibidoRecords.splice(index, 1); saveCurrentMonthData(); renderPercibidoTable(); }
            if (libro === 'retenido')  { retenidoRecords.splice(index, 1); saveCurrentMonthData(); renderRetenidoTable(); }
            if (libro === 'anticipo')  { anticipoRecords.splice(index, 1); saveCurrentMonthData(); renderAnticipoTable(); }
            if (libro === 'excluido')  { excluidoRecords.splice(index, 1); saveCurrentMonthData(); renderExcluidoTable(); }
            if (libro === 'f14')       { f14Records.splice(index, 1); saveCurrentMonthData(); renderF14Table(); }
            // Limpiar estados guardados y re-indexar
            var states = loadRevStates(libro);
            var newStates = {};
            Object.keys(states).forEach(function(k) {
                var ki = parseInt(k);
                if (ki < index)  newStates[ki] = states[k];
                else if (ki > index) newStates[ki - 1] = states[k];
                // ki === index se descarta
            });
            saveRevStates(libro, newStates);
            showToast('Duplicado eliminado', 'success');
            lucide.createIcons();
        });
    }

    // Actualizar estadísticas de revisión en barra
    function updateRevStats(libro, states, duplicados, total) {
        var statsId = { debito: 'revStatsDebito', cf: 'revStatsCf', compras: 'revStatsCompras', percibido: 'revStatsPercibido', retenido: 'revStatsRetenido', anticipo: 'revStatsAnticipo', excluido: 'revStatsExcluido', f14: 'revStatsF14' };
        var el = document.getElementById(statsId[libro]);
        if (!el) return;
        var pendientes  = 0, revisados = 0, faltan = 0, dups = Object.keys(duplicados).length;
        var impresos = 0;
        for (var i = 0; i < total; i++) {
            var st = states[i];
            if (!st || st === 'pendiente') pendientes++;
            else if (st === 'revisado') revisados++;
            else if (st === 'falta') faltan++;
            else if (st === 'impreso') impresos++;
        }
        el.innerHTML =
            '<span style="color:var(--rp-warning);">⬤ ' + pendientes + ' pendientes</span>' +
            '<span style="color:var(--rp-success);">⬤ ' + revisados + ' revisados</span>' +
            '<span style="color:var(--rp-violet-soft);">⬤ ' + faltan + ' falta doc.</span>' +
            (impresos > 0 ? '<span style="color:var(--rp-success);">🖨 ' + impresos + ' impresos</span>' : '') +
            (dups > 0 ? '<span style="color:var(--rp-error);">⬤ ' + dups + ' duplicados</span>' : '');
        // Habilitar/deshabilitar botón exportar según si hay documentos falta
        var exportBtn = document.getElementById('btnExportFalta_' + libro);
        if (exportBtn) exportBtn.style.display = faltan > 0 ? 'flex' : 'none';
        // Cambio 02 — Dentro de Modo Revisión: ocultar "Consulta DTE" si existe
        // al menos un documento con estado "Falta Documento" en el anexo actual.
        var dteBtn = document.getElementById('btnConsultaDte_' + libro);
        if (dteBtn) dteBtn.style.display = faltan > 0 ? 'none' : 'flex';
        el.classList.add('visible');
    }

    function clearRevStats(libro) {
        var statsId = { debito: 'revStatsDebito', cf: 'revStatsCf', compras: 'revStatsCompras', percibido: 'revStatsPercibido', retenido: 'revStatsRetenido', anticipo: 'revStatsAnticipo', excluido: 'revStatsExcluido', f14: 'revStatsF14' };
        var el = document.getElementById(statsId[libro]);
        if (!el) return;
        el.innerHTML = '';
        el.classList.remove('visible');
        var exportBtn = document.getElementById('btnExportFalta_' + libro);
        if (exportBtn) exportBtn.style.display = 'none';
    }

    // Construir overlay de revisión para una fila
    function buildRevOverlay(libro, index, isDuplicado, align) {
        var justifyStyle = align === 'start' ? 'justify-content:flex-start;padding-left:8px;' : '';
        var overlay = '<div class="rev-overlay" style="' + justifyStyle + '">';
        if (isDuplicado) {
            overlay += '<button class="rev-action-btn eliminar" onclick="event.stopPropagation();eliminarDuplicadoRevision(\'' + libro + '\',' + index + ')">✕ Eliminar Duplicado</button>';
        } else {
            overlay += '<button class="rev-action-btn pendiente" onclick="event.stopPropagation();setRevState(\'' + libro + '\',' + index + ',\'pendiente\')" style="background:rgba(234,179,8,0.15);color:var(--rp-warning);border-color:rgba(234,179,8,0.35);">⏳ Pendiente</button>';
            overlay += '<button class="rev-action-btn revisado" onclick="event.stopPropagation();setRevState(\'' + libro + '\',' + index + ',\'revisado\')">✓ Revisado</button>';
            overlay += '<button class="rev-action-btn falta" onclick="event.stopPropagation();setRevState(\'' + libro + '\',' + index + ',\'falta\')">⚠ Falta Físico</button>';
        }
        overlay += '</div>';
        return overlay;
    }

    // Badge de estado revisión
    function buildRevBadge(estado) {
        var labels = { pendiente: '⏳ Pendiente', revisado: '✓ Revisado', falta: '⚠ Falta Físico', duplicado: '⊗ Duplicado', impreso: '🖨 Impreso' };
        return '<span class="rev-badge ' + estado + '">' + (labels[estado] || estado) + '</span>';
    }