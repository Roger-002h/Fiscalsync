// recorrido/Recorrido.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // NUEVA FUNCIÓN: RECORRER Y ACTUALIZAR DOCUMENTOS
    // Recorre automáticamente, en segundo plano, todos los documentos del
    // anexo activo (Compras / Ventas Crédito Fiscal / Ventas Consumidor
    // Final), reutilizando EXACTAMENTE la misma lógica que ya usan los
    // botones "Editar" (openXModal) y "Siguiente" (que internamente hace
    // saveXRecord + openXModal del próximo registro): por cada documento se
    // abre con la función Editar y se guarda con la función Guardar, sin
    // mostrar el formulario en pantalla ni alterar el orden de los
    // documentos. No se toca ningún cálculo, correlativo ni otro proceso
    // existente — solo se automatiza el recorrido manual.
    // ══════════════════════════════════════════════════════════════════
    var _recorridoEnCurso = false;
    var _recorridoSilencioso = false;
    var _recorridoConfig = {
        compras: { getRecords: function() { return comprasRecords; }, open: function(i) { openComprasModal(i); }, save: function() { saveComprasRecord(); }, modalId: 'comprasModalForm', nombre: 'Compras' },
        debito:  { getRecords: function() { return debitoRecords; },  open: function(i) { openDebitoModal(i); },  save: function() { saveDebitoRecord(); },  modalId: 'debitoModalForm', nombre: 'Ventas Crédito Fiscal' },
        cf:      { getRecords: function() { return cfRecords; },      open: function(i) { openCfModal(i); },      save: function() { saveCfRecord(); },      modalId: 'cfModalForm', nombre: 'Ventas Consumidor Final' }
    };

    function recorridoAbrirModal(nombreLibro) {
        var m = document.getElementById('recorridoProgressModal');
        if (m) m.classList.add('recorrido-open');
        var titulo = document.getElementById('recorridoLibroNombre');
        if (titulo) titulo.innerText = nombreLibro;
    }
    function recorridoActualizarProgreso(actual, total) {
        var texto = document.getElementById('recorridoProgressText');
        if (texto) texto.innerText = 'Documento ' + actual + ' de ' + total + '.';
        var pct = total > 0 ? Math.round((actual / total) * 100) : 0;
        var pctTxt = document.getElementById('recorridoProgressPct');
        if (pctTxt) pctTxt.innerText = pct + '% completado.';
        var fill = document.getElementById('recorridoProgressFill');
        if (fill) fill.style.width = pct + '%';
    }
    function recorridoCerrarModal() {
        var m = document.getElementById('recorridoProgressModal');
        if (m) m.classList.remove('recorrido-open');
    }

    function recorrerYActualizarDocumentos(libro) {
        if (_recorridoEnCurso) { showToast('Ya hay un recorrido de documentos en curso', 'error'); return; }
        var cfg = _recorridoConfig[libro];
        if (!cfg) return;
        var total = cfg.getRecords().length;
        if (!total) { showToast('No hay documentos en este anexo para recorrer', 'error'); return; }

        _recorridoEnCurso = true;
        _recorridoSilencioso = true;
        recorridoAbrirModal(cfg.nombre);
        recorridoActualizarProgreso(0, total);

        var idx = 0;
        var errores = 0;

        function procesarSiguiente() {
            // El total puede cambiar si un guardado agrega/quita registros vinculados
            // (p. ej. Compras -> IVA Percibido); se recalcula por seguridad.
            var totalActual = cfg.getRecords().length;
            if (idx >= totalActual) { terminar(); return; }
            try {
                // 1) Abrir el documento — misma lógica que el botón "Editar".
                cfg.open(idx);
                // 2) Ocultar el formulario de inmediato: el recorrido es en segundo
                //    plano, el usuario nunca debe ver el modal ni el cambio entre
                //    documentos.
                var modalEl = document.getElementById(cfg.modalId);
                if (modalEl) { modalEl.style.display = 'none'; modalEl.classList.remove('modal-open'); }
                // 3) Guardar — misma lógica que usa el botón "Siguiente" para
                //    actualizar el registro antes de pasar al próximo.
                cfg.save();
            } catch (e) {
                errores++;
                console.error('[Recorrer y Actualizar] Error en documento ' + (idx + 1) + ' de ' + cfg.nombre + ':', e);
            }
            idx++;
            recorridoActualizarProgreso(Math.min(idx, totalActual), totalActual);
            setTimeout(procesarSiguiente, 0);
        }

        function terminar() {
            _recorridoEnCurso = false;
            _recorridoSilencioso = false;
            recorridoCerrarModal();
            if (errores > 0) {
                showToast('Proceso finalizado con ' + errores + ' error(es) registrado(s) en la consola — el resto de los documentos se actualizó correctamente.', 'error');
            } else {
                showToast('Proceso finalizado. Todos los documentos fueron recorridos y actualizados correctamente.', 'success');
            }
        }

        setTimeout(procesarSiguiente, 0);
    }