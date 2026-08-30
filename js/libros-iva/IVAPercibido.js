// libros-iva/IVAPercibido.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // CORRECCIÓN — Libro de Compras impreso: el valor de la columna "IVA
    // Percibido" debe obtenerse EXCLUSIVAMENTE del Libro de IVA Percibido
    // (Anexo 8, percibidoRecords), asociando el documento de Compras con su
    // registro correspondiente por número de documento (numDoc / código de
    // generación — misma clave que usa detectarPercibidoDeCompra() al vincular
    // ambos registros desde un mismo .json). No se debe leer ningún campo
    // propio del registro de Compras (ni de .csv, ni de .json, ni manual).
    // ══════════════════════════════════════════════════════════════════
    function buscarIvaPercibidoAnexo8(r) {
        var nd = normalizeUUID(r.numDoc || '');
        if (!nd) return 0;
        var match = (percibidoRecords || []).find(function(p) {
            return normalizeUUID(p.numDoc || '') === nd;
        });
        return match ? (parseFloat(match.iva) || 0) : 0;
    }
    // Tabs Percibido, Retenido, Anticipo
    function swPERC(p,b){['perc-tab-agente','perc-tab-doc','perc-tab-montos'].forEach(function(i){document.getElementById(i).classList.remove('active');});['perc-btn-agente','perc-btn-doc','perc-btn-montos'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // IVA PERCIBIDO CRUD
    // ══════════════════════════════════════════════
    function openPercibidoModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('perc_editIndex').value = index;
        ['perc_nit','perc_dui','perc_fecha','perc_serie','perc_num'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['perc_monto','perc_iva'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        document.getElementById('perc_tipo_doc').value = '03';
        clearFieldError('perc_nit', 'perc_nit_error');
        clearFieldError('perc_dui', 'perc_dui_error');
        swPERC('perc-tab-agente','perc-btn-agente');
        if (index !== -1) {
            var r = percibidoRecords[index];
            document.getElementById('percibidoModalTitle').innerText = 'Editar Registro — Percibido';
            document.getElementById('perc_nit').value = r.nit;
            document.getElementById('perc_dui').value = r.dui;
            document.getElementById('perc_fecha').value = r.fecha;
            document.getElementById('perc_tipo_doc').value = r.tipoDoc;
            document.getElementById('perc_serie').value = r.serie;
            document.getElementById('perc_num').value = r.numDoc;
            document.getElementById('perc_monto').value = r.monto;
            calcPercibido();
        } else {
            document.getElementById('percibidoModalTitle').innerText = 'Nuevo Registro — Percibido';
        }
        _setModalMode('perc', index !== -1, percibidoRecords, index);
        document.getElementById('percibidoModalForm').style.display='flex'; document.getElementById('percibidoModalForm').classList.add('modal-open');
    }
    function closePercibidoModal() { _cerrarModalAnimado('percibidoModalForm'); }
    function navPercibidoRecord(delta) {
        var cur = parseInt(document.getElementById('perc_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= percibidoRecords.length) return;
        var activeBtn = ['perc-btn-agente','perc-btn-doc','perc-btn-montos'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'perc-btn-agente':'perc-tab-agente','perc-btn-doc':'perc-tab-doc','perc-btn-montos':'perc-tab-montos'};
        savePercibidoRecord();
        openPercibidoModal(next);
        if (activeBtn && tabMap[activeBtn]) swPERC(tabMap[activeBtn], activeBtn);
    }
    function calcPercibido() {
        var monto = parseFloat(document.getElementById('perc_monto').value) || 0;
        document.getElementById('perc_iva').value = (monto * 0.01).toFixed(2);
    }
    function savePercibidoRecord() {
        var index = document.getElementById('perc_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var valid = true;
        var nitVal = s('perc_nit').trim();
        var duiVal = s('perc_dui').trim();

        if (nitVal && !isValidNit(nitVal)) { setFieldError('perc_nit', 'perc_nit_error'); valid = false; } else { clearFieldError('perc_nit', 'perc_nit_error'); }
        if (duiVal && !isValidDui(duiVal)) { setFieldError('perc_dui', 'perc_dui_error'); valid = false; } else { clearFieldError('perc_dui', 'perc_dui_error'); }
        if (!valid) { showToast('Corrige los campos con formato incorrecto', 'error'); return; }

        var r = {
            nit: s('perc_nit'), dui: s('perc_dui'), fecha: s('perc_fecha'),
            tipoDoc: s('perc_tipo_doc'), serie: s('perc_serie'), numDoc: s('perc_num'),
            monto: n('perc_monto'), iva: n('perc_iva')
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoPerc = esDocumentoDuplicado('percibido', r, percibidoRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoPerc) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoPerc, 'error'); return; }
        if (index === '-1') {
            percibidoRecords.push(r);
            saveCurrentMonthData();
            renderPercibidoTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openPercibidoModal(-1);
        } else {
            percibidoRecords[index] = r;
            saveCurrentMonthData();
            renderPercibidoTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('perc-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + percibidoRecords.length;
        }
    }
    function deletePercibidoRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { percibidoRecords.splice(index, 1); saveCurrentMonthData(); renderPercibidoTable(); });
    }
    function renderPercibidoTable() {
        var tbody = document.getElementById('percibidoTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.percibido ? loadRevStates('percibido') : {};
        var duplicados = _revisionActive.percibido ? detectarDuplicados('percibido', percibidoRecords) : {};
        if (_revisionActive.percibido) updateRevStats('percibido', revStates, duplicados, percibidoRecords.length);
        else clearRevStats('percibido');
        percibidoRecords.forEach(function(r, i) {
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.percibido) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var revBadgeHtml   = _revisionActive.percibido ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.percibido ? buildRevOverlay('percibido', i, revEstado === 'duplicado') : '';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs font-mono">' + r.nit + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.serie + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap" style="position:relative;">' + r.numDoc + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.monto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.iva) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">8</td>' +
                '<td class="px-4 py-3 text-xs sticky col-acciones" style="right:148px;background:var(--rp-surface);">' +
                '<div class="flex gap-2">' +
                '<button onclick="openPercibidoModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deletePercibidoRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }