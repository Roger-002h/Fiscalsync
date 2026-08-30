// libros-iva/IVARetenido.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    function swRET(p,b){['ret-tab-agente','ret-tab-doc','ret-tab-montos'].forEach(function(i){document.getElementById(i).classList.remove('active');});['ret-btn-agente','ret-btn-doc','ret-btn-montos'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // IVA RETENIDO CRUD
    // ══════════════════════════════════════════════
    function openRetenidoModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('ret_editIndex').value = index;
        ['ret_nit','ret_dui','ret_fecha','ret_serie','ret_num'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['ret_monto','ret_iva'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        document.getElementById('ret_tipo_doc').value = '03';
        document.getElementById('ret_nombre_agente').value = '';
        clearFieldError('ret_nit', 'ret_nit_error');
        clearFieldError('ret_dui', 'ret_dui_error');
        swRET('ret-tab-agente','ret-btn-agente');
        if (index !== -1) {
            var r = retenidoRecords[index];
            document.getElementById('retenidoModalTitle').innerText = 'Editar Registro — Retenido';
            document.getElementById('ret_nit').value = r.nit;
            document.getElementById('ret_dui').value = r.dui;
            document.getElementById('ret_fecha').value = r.fecha;
            document.getElementById('ret_tipo_doc').value = r.tipoDoc;
            document.getElementById('ret_serie').value = r.serie;
            document.getElementById('ret_num').value = r.numDoc;
            document.getElementById('ret_monto').value = r.monto;
            // AGREGADO — CAMBIO 02: nombre del agente es únicamente informativo
            document.getElementById('ret_nombre_agente').value = r._nombreAgente || '';
            calcRetenido();
        } else {
            document.getElementById('retenidoModalTitle').innerText = 'Nuevo Registro — Retenido';
        }
        _setModalMode('ret', index !== -1, retenidoRecords, index);
        document.getElementById('retenidoModalForm').style.display='flex'; document.getElementById('retenidoModalForm').classList.add('modal-open');
    }
    function closeRetenidoModal() { _cerrarModalAnimado('retenidoModalForm'); }
    function navRetenidoRecord(delta) {
        var cur = parseInt(document.getElementById('ret_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= retenidoRecords.length) return;
        var activeBtn = ['ret-btn-agente','ret-btn-doc','ret-btn-montos'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'ret-btn-agente':'ret-tab-agente','ret-btn-doc':'ret-tab-doc','ret-btn-montos':'ret-tab-montos'};
        saveRetenidoRecord();
        openRetenidoModal(next);
        if (activeBtn && tabMap[activeBtn]) swRET(tabMap[activeBtn], activeBtn);
    }
    function calcRetenido() {
        var monto = parseFloat(document.getElementById('ret_monto').value) || 0;
        document.getElementById('ret_iva').value = (monto * 0.01).toFixed(2);
    }
    function saveRetenidoRecord() {
        var index = document.getElementById('ret_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var valid = true;
        var nitVal = s('ret_nit').trim();
        var duiVal = s('ret_dui').trim();

        if (nitVal && !isValidNit(nitVal)) { setFieldError('ret_nit', 'ret_nit_error'); valid = false; } else { clearFieldError('ret_nit', 'ret_nit_error'); }
        if (duiVal && !isValidDui(duiVal)) { setFieldError('ret_dui', 'ret_dui_error'); valid = false; } else { clearFieldError('ret_dui', 'ret_dui_error'); }
        if (!valid) { showToast('Corrige los campos con formato incorrecto', 'error'); return; }

        var r = {
            nit: s('ret_nit'), dui: s('ret_dui'), fecha: s('ret_fecha'),
            tipoDoc: s('ret_tipo_doc'), serie: s('ret_serie'), numDoc: s('ret_num'),
            monto: n('ret_monto'), iva: n('ret_iva'),
            // AGREGADO — CAMBIO 02: campo únicamente informativo para identificar
            // al proveedor/agente en pantalla; no se incluye en el Anexo 7 ni en
            // ningún CSV/JSON/impresión de libro legal generado por el sistema.
            _nombreAgente: s('ret_nombre_agente')
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoRet = esDocumentoDuplicado('retenido', r, retenidoRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoRet) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoRet, 'error'); return; }
        if (index === '-1') {
            retenidoRecords.push(r);
            saveCurrentMonthData();
            renderRetenidoTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openRetenidoModal(-1);
        } else {
            retenidoRecords[index] = r;
            saveCurrentMonthData();
            renderRetenidoTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('ret-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + retenidoRecords.length;
        }
    }
    function deleteRetenidoRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { retenidoRecords.splice(index, 1); saveCurrentMonthData(); renderRetenidoTable(); });
    }
    function renderRetenidoTable() {
        var tbody = document.getElementById('retenidoTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.retenido ? loadRevStates('retenido') : {};
        var duplicados = _revisionActive.retenido ? detectarDuplicados('retenido', retenidoRecords) : {};
        if (_revisionActive.retenido) updateRevStats('retenido', revStates, duplicados, retenidoRecords.length);
        else clearRevStats('retenido');
        retenidoRecords.forEach(function(r, i) {
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.retenido) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var revBadgeHtml   = _revisionActive.retenido ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.retenido ? buildRevOverlay('retenido', i, revEstado === 'duplicado') : '';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs font-mono">' + r.nit + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.serie + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap" style="position:relative;">' + r.numDoc + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.monto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.iva) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">7</td>' +
                '<td class="px-4 py-3 text-xs sticky col-acciones" style="right:148px;background:var(--rp-surface);">' +
                '<div class="flex gap-2">' +
                '<button onclick="openRetenidoModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteRetenidoRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // Combina el resultado de la consulta pública (sin selección de proveedor/
    // cliente ni "exenta" en el teléfono) y GUARDA DIRECTO el registro en el
    // Libro de Retenciones de IVA — Anexo 7, sin abrir el modal "Nuevo
    // Registro — Retenido". Mapeo acordado:
    //   Tipo de DTE (Comprobante de Retención/Nota de Crédito/Nota de Débito)
    //                                           -> Tipo de Documento (07/05/06)
    //   Fecha y Hora de Generación              -> Fecha de Emisión
    //   Sello de Recepción                      -> Serie de Documento
    //   Código de Generación                    -> N° Documento
    //   Monto Total de la Operación             -> Monto Sujeto
    // NIT/DUI del Agente no vienen en la consulta pública (no los expone
    // Hacienda) — se toman del MISMO catálogo de Proveedores que ya usa
    // Compras, eligiéndolo/creándolo en el teléfono en la misma pantalla que
    // usa el flujo de Compras (el registro de Retenciones solo guarda NIT y
    // DUI, pero se registra/actualiza igual el proveedor completo en el
    // catálogo para que quede disponible en futuros escaneos).
    // Cambio 03: ya no se guarda automáticamente ni el proveedor/agente se
    // elige en el teléfono. Se abre el modal "Nuevo Registro — Retenido" con
    // los datos del documento precargados; el NIT/DUI del agente de
    // retención se deja en blanco para que el usuario lo busque/seleccione/
    // agregue en esta misma pantalla (mismo autocompletado y guardado que ya
    // tiene el modal manual).
    // Corrección 01: ya no se abre el modal "Nuevo Registro — Retenido" —
    // se abre la pantalla independiente "Documentos Escaneados".
    function _autocompletarRetencionDesdeQR(combinado) {
        if (!combinado) return;
        if (_rechazarEscaneoSinEmpresaActiva()) return;

        // Corrección Bug 01 (se mantiene): mismo criterio que en Compras/CF.
        var _dupPeriodoRet = _codigoGenYaExisteEnLibro('retenido', normalizeUUID(combinado.codGen || ''), retenidoRecords);
        if (_dupPeriodoRet) {
            showToast('Documento ya procesado.', 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: 'Documento ya procesado.' });
            }
            return;
        }

        // Cambio 03 — Control de tipos de documento permitidos por módulo.
        if (!qrScanTipoPermitido('retencion', combinado.tipoDteTexto)) {
            var _msgTipoRet = 'Este tipo de documento (' + (combinado.tipoDteTexto || combinado.tipoDocMapeado) + ') no está permitido para escaneo en Retención IVA — revísalo en Admin › Escaneo QR.';
            showToast(_msgTipoRet, 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: _msgTipoRet });
            }
            return;
        }

        // Cambio 05 — Modo Admin "Resumen de Escaneo": en la PC
        // (comportamiento de siempre) o en el teléfono vinculado.
        if (resumenEscaneoModoLoad() === 'celular') {
            _enviarResumenACelular('retencion', combinado);
        } else {
            openQrDocModal('retencion', combinado);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO — CAMBIO 02: AUTO-COMPLETAR DESDE PROVEEDORES (predictivo)
    // para los anexos IVA Retenido y Compras a Sujeto Excluido.
    // Reutiliza exactamente los mismos helpers de autocompletado genérico
    // (acKeyDown, acClose) ya usados en Compras y Clientes. Solo se
    // muestran/aplican proveedores del catálogo cuyo campo `usos` incluya
    // el anexo correspondiente (ver proveedorTieneUso).
    // ══════════════════════════════════════════════════════════════════

    // ── Aplicar datos de proveedor al modal de IVA Retenido ──
    function _applyProveedorToRetenidoModal(prov) {
        if (!prov) return;
        if (prov.nit) document.getElementById('ret_nit').value = prov.nit;
        if (prov.dui) document.getElementById('ret_dui').value = prov.dui;
        // Nombre del Agente: únicamente informativo, no forma parte del anexo
        document.getElementById('ret_nombre_agente').value = prov.nombre || '';
    }

    function onRetenidoNitChange() {
        var nitVal = document.getElementById('ret_nit').value.trim();
        var listEl = document.getElementById('ret_ac_list');
        if (!nitVal) { acClose('ret_ac_list'); document.getElementById('ret_nombre_agente').value = ''; return; }
        var provs = loadProveedores().filter(function(p) { return proveedorTieneUso(p, 'retenido'); });
        var matches = provs.filter(function(p) {
            return (p.nit && p.nit.indexOf(nitVal) !== -1) ||
                   (p.dui && p.dui.indexOf(nitVal) !== -1) ||
                   (p.nombre && p.nombre.toLowerCase().indexOf(nitVal.toLowerCase()) !== -1);
        });
        var exact = provs.find(function(p) {
            return (p.nit && p.nit === nitVal) || (p.dui && p.dui === nitVal);
        });
        if (exact) {
            _applyProveedorToRetenidoModal(exact);
        } else if (!_isCompleteId(nitVal)) {
            document.getElementById('ret_nombre_agente').value = '';
        }
        if (matches.length === 0 || (matches.length === 1 && exact)) { acClose('ret_ac_list'); return; }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(p) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (p.nit || p.dui || '') + '</span><span class="ac-name">' + (p.nombre || '<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                document.getElementById('ret_nit').value = p.nit || '';
                _applyProveedorToRetenidoModal(p);
                acClose('ret_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }