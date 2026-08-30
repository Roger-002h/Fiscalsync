// libros-iva/Resoluciones.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // RESOLUCIONES / SERIES GUARDADAS
    // Almacena en localStorage las resoluciones y series para CF y Débito.
    // Solo se muestra en modo manual (clase != '4').
    // Clave: fs_resSeries_<empresaId>_<libro>   (libro: 'cf' | 'debito')
    // ══════════════════════════════════════════════════════════════════

    function resKey(libro) {
        return 'fs_res_v' + APP_VERSION + '_' + (activeEmpresaId || 'default') + '_' + libro;
    }

    function loadResList(libro) {
        try {
            var raw = fsStore.getItem(resKey(libro));
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    }

    function saveResList(libro, list) {
        try { fsStore.setItem(resKey(libro), JSON.stringify(list)); } catch(e) {}
    }

    function renderResChips(libro) {
        var list = loadResList(libro);
        var container = document.getElementById(libro + '_res_chips');
        var empty     = document.getElementById(libro + '_res_empty');
        if (!container) return;
        // Limpiar chips previos (dejar el span empty)
        Array.from(container.children).forEach(function(ch) {
            if (ch.id !== libro + '_res_empty') container.removeChild(ch);
        });
        if (!list.length) {
            if (empty) empty.style.display = '';
            return;
        }
        if (empty) empty.style.display = 'none';
        list.forEach(function(item, i) {
            var chip = document.createElement('span');
            chip.className = 'res-chip';
            chip.title = 'Clic para autocompletar';
            chip.innerHTML =
                '<span style="font-weight:600;">' + escHtml(item.resolucion) + '</span>' +
                (item.serie ? '<span style="color:var(--rp-text-secondary);">/</span><span>' + escHtml(item.serie) + '</span>' : '') +
                '<button class="res-chip-edit" title="Editar" onclick="event.stopPropagation();editResEntry(\'' + libro + '\',' + i + ')">✎</button>' +
                '<button class="res-chip-del" title="Eliminar" onclick="event.stopPropagation();deleteResEntry(\'' + libro + '\',' + i + ')">×</button>';
            chip.addEventListener('click', function() {
                applyResEntry(libro, item);
            });
            container.appendChild(chip);
        });
    }

    function applyResEntry(libro, item) {
        if (libro === 'd') {
            document.getElementById('d_resolucion').value = item.resolucion || '';
            document.getElementById('d_serie').value = item.serie || '';
            _dActiveRes.resolucion = item.resolucion || '';
            _dActiveRes.serie      = item.serie || '';
        } else {
            document.getElementById('cf_resolucion').value = item.resolucion || '';
            document.getElementById('cf_serie').value = item.serie || '';
            _cfActiveRes.resolucion = item.resolucion || '';
            _cfActiveRes.serie      = item.serie || '';
        }
        showToast('Resolución/Serie aplicada', 'success');
    }

    function toggleResAddForm(libro) {
        var form = document.getElementById(libro + '_res_add_form');
        var editIdx = document.getElementById(libro + '_res_edit_idx');
        if (!form) return;
        if (form.classList.contains('open')) {
            form.classList.remove('open');
        } else {
            document.getElementById(libro + '_res_new_resolucion').value = '';
            document.getElementById(libro + '_res_new_serie').value = '';
            if (editIdx) editIdx.value = '-1';
            form.classList.add('open');
            document.getElementById(libro + '_res_new_resolucion').focus();
        }
    }

    function cancelResAddForm(libro) {
        var form = document.getElementById(libro + '_res_add_form');
        if (form) form.classList.remove('open');
    }

    function saveResEntry(libro) {
        var resVal  = (document.getElementById(libro + '_res_new_resolucion').value || '').trim();
        var serieVal = (document.getElementById(libro + '_res_new_serie').value || '').trim();
        if (!resVal) { showToast('El N° Resolución es obligatorio', 'error'); return; }
        var editIdx = parseInt(document.getElementById(libro + '_res_edit_idx').value);
        var list = loadResList(libro);
        if (editIdx >= 0 && editIdx < list.length) {
            list[editIdx] = { resolucion: resVal, serie: serieVal };
            showToast('Resolución actualizada', 'success');
        } else {
            list.push({ resolucion: resVal, serie: serieVal });
            showToast('Resolución guardada', 'success');
        }
        saveResList(libro, list);
        renderResChips(libro);
        cancelResAddForm(libro);
    }

    function editResEntry(libro, i) {
        var list = loadResList(libro);
        if (i < 0 || i >= list.length) return;
        var item = list[i];
        var form = document.getElementById(libro + '_res_add_form');
        document.getElementById(libro + '_res_new_resolucion').value = item.resolucion || '';
        document.getElementById(libro + '_res_new_serie').value = item.serie || '';
        document.getElementById(libro + '_res_edit_idx').value = i;
        if (form && !form.classList.contains('open')) form.classList.add('open');
        document.getElementById(libro + '_res_new_resolucion').focus();
    }

    function deleteResEntry(libro, i) {
        fsConfirm('¿Eliminar esta resolución/serie guardada?', function() {
            var list = loadResList(libro);
            list.splice(i, 1);
            saveResList(libro, list);
            renderResChips(libro);
        });
    }

    // Determina si el modal está en modo manual (clase != '4')
    // El panel solo se muestra/oculta cuando el usuario cambia la clase.
    function updateResPanelVisibility(libro) {
        var claseEl = document.getElementById(libro === 'd' ? 'd_clase' : 'cf_clase');
        var panelWrap = document.getElementById(libro + '_res_panel_wrap');
        if (!claseEl || !panelWrap) return;
        panelWrap.style.display = (claseEl.value === '4') ? 'none' : '';
    }