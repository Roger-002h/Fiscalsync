// libros-iva/AnticipoCuenta.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    function swANT(p,b){['ant-tab-agente','ant-tab-doc','ant-tab-montos'].forEach(function(i){document.getElementById(i).classList.remove('active');});['ant-btn-agente','ant-btn-doc','ant-btn-montos'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // ANTICIPO A CUENTA CRUD
    // ══════════════════════════════════════════════
    function openAnticipoModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('ant_editIndex').value = index;
        ['ant_nit','ant_dui','ant_fecha','ant_serie','ant_num'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['ant_monto','ant_iva'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        clearFieldError('ant_nit', 'ant_nit_error');
        clearFieldError('ant_dui', 'ant_dui_error');
        swANT('ant-tab-agente','ant-btn-agente');
        if (index !== -1) {
            var r = anticipoRecords[index];
            document.getElementById('anticipoModalTitle').innerText = 'Editar Registro — Anticipo';
            document.getElementById('ant_nit').value = r.nit;
            document.getElementById('ant_dui').value = r.dui;
            document.getElementById('ant_fecha').value = r.fecha;
            document.getElementById('ant_serie').value = r.serie;
            document.getElementById('ant_num').value = r.numDoc;
            document.getElementById('ant_monto').value = r.monto;
            calcAnticipo();
        } else {
            document.getElementById('anticipoModalTitle').innerText = 'Nuevo Registro — Anticipo';
        }
        _setModalMode('ant', index !== -1, anticipoRecords, index);
        document.getElementById('anticipoModalForm').style.display='flex'; document.getElementById('anticipoModalForm').classList.add('modal-open');
    }
    function closeAnticipoModal() { _cerrarModalAnimado('anticipoModalForm'); }
    function navAnticipoRecord(delta) {
        var cur = parseInt(document.getElementById('ant_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= anticipoRecords.length) return;
        var activeBtn = ['ant-btn-agente','ant-btn-doc','ant-btn-montos'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'ant-btn-agente':'ant-tab-agente','ant-btn-doc':'ant-tab-doc','ant-btn-montos':'ant-tab-montos'};
        saveAnticipoRecord();
        openAnticipoModal(next);
        if (activeBtn && tabMap[activeBtn]) swANT(tabMap[activeBtn], activeBtn);
    }
    function calcAnticipo() {
        var monto = parseFloat(document.getElementById('ant_monto').value) || 0;
        document.getElementById('ant_iva').value = (monto * 0.02).toFixed(2);
    }
    function saveAnticipoRecord() {
        var index = document.getElementById('ant_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var valid = true;
        var nitVal = s('ant_nit').trim();
        var duiVal = s('ant_dui').trim();

        if (nitVal && !isValidNit(nitVal)) { setFieldError('ant_nit', 'ant_nit_error'); valid = false; } else { clearFieldError('ant_nit', 'ant_nit_error'); }
        if (duiVal && !isValidDui(duiVal)) { setFieldError('ant_dui', 'ant_dui_error'); valid = false; } else { clearFieldError('ant_dui', 'ant_dui_error'); }
        if (!valid) { showToast('Corrige los campos con formato incorrecto', 'error'); return; }

        var r = {
            nit: s('ant_nit'), dui: s('ant_dui'), fecha: s('ant_fecha'),
            serie: s('ant_serie'), numDoc: s('ant_num'),
            monto: n('ant_monto'), iva: n('ant_iva')
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoAnt = esDocumentoDuplicado('anticipo', r, anticipoRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoAnt) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoAnt, 'error'); return; }
        if (index === '-1') {
            anticipoRecords.push(r);
            saveCurrentMonthData();
            renderAnticipoTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openAnticipoModal(-1);
        } else {
            anticipoRecords[index] = r;
            saveCurrentMonthData();
            renderAnticipoTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('ant-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + anticipoRecords.length;
        }
    }
    function deleteAnticipoRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { anticipoRecords.splice(index, 1); saveCurrentMonthData(); renderAnticipoTable(); });
    }
    function renderAnticipoTable() {
        var tbody = document.getElementById('anticipoTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.anticipo ? loadRevStates('anticipo') : {};
        var duplicados = _revisionActive.anticipo ? detectarDuplicados('anticipo', anticipoRecords) : {};
        if (_revisionActive.anticipo) updateRevStats('anticipo', revStates, duplicados, anticipoRecords.length);
        else clearRevStats('anticipo');
        anticipoRecords.forEach(function(r, i) {
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.anticipo) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var revBadgeHtml   = _revisionActive.anticipo ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.anticipo ? buildRevOverlay('anticipo', i, revEstado === 'duplicado') : '';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs font-mono">' + r.nit + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.serie + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap" style="position:relative;">' + r.numDoc + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.monto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.iva) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">6</td>' +
                '<td class="px-4 py-3 text-xs sticky col-acciones" style="right:148px;background:var(--rp-surface);">' +
                '<div class="flex gap-2">' +
                '<button onclick="openAnticipoModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteAnticipoRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }