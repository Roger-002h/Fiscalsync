// libros-iva/SujetoExcluido.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    function swEX(p,b){['ex-tab-doc','ex-tab-montos','ex-tab-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});['ex-btn-doc','ex-btn-montos','ex-btn-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // COMPRAS SUJETO EXCLUIDO CRUD
    // ══════════════════════════════════════════════
    function openExcluidoModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('ex_editIndex').value = index;
        ['ex_identificacion','ex_nombre','ex_fecha','ex_serie','ex_num'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['ex_monto','ex_retencion'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        document.getElementById('ex_tipo_doc').value = '1';
        document.getElementById('ex_tipo_op').value = '1';
        document.getElementById('ex_clasif').value = '1';
        document.getElementById('ex_sector').value = '1';
        document.getElementById('ex_tipo_costo').value = '1';
        swEX('ex-tab-doc','ex-btn-doc');
        if (index !== -1) {
            var r = excluidoRecords[index];
            document.getElementById('excluidoModalTitle').innerText = 'Editar Registro — Sujeto Excluido';
            document.getElementById('ex_tipo_doc').value = r.tipoDoc;
            document.getElementById('ex_identificacion').value = r.identificacion;
            document.getElementById('ex_nombre').value = r.nombre;
            document.getElementById('ex_fecha').value = r.fecha;
            document.getElementById('ex_serie').value = r.serie;
            document.getElementById('ex_num').value = r.numDoc;
            document.getElementById('ex_monto').value = r.monto;
            document.getElementById('ex_retencion').value = r.retencion || '0.00';
            document.getElementById('ex_tipo_op').value = r.tipoOp;
            document.getElementById('ex_clasif').value = r.clasif;
            document.getElementById('ex_sector').value = r.sector;
            document.getElementById('ex_tipo_costo').value = r.tipoCosto;
        } else {
            document.getElementById('excluidoModalTitle').innerText = 'Nuevo Registro — Sujeto Excluido';
        }
        _setModalMode('ex', index !== -1, excluidoRecords, index);
        document.getElementById('excluidoModalForm').style.display='flex'; document.getElementById('excluidoModalForm').classList.add('modal-open');
    }
    function closeExcluidoModal() { _cerrarModalAnimado('excluidoModalForm'); }
    function navExcluidoRecord(delta) {
        var cur = parseInt(document.getElementById('ex_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= excluidoRecords.length) return;
        var activeBtn = ['ex-btn-doc','ex-btn-montos','ex-btn-clasif'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'ex-btn-doc':'ex-tab-doc','ex-btn-montos':'ex-tab-montos','ex-btn-clasif':'ex-tab-clasif'};
        saveExcluidoRecord();
        openExcluidoModal(next);
        if (activeBtn && tabMap[activeBtn]) swEX(tabMap[activeBtn], activeBtn);
    }
    function calcExcluido() {
        // Cálculo manual — el usuario ingresa el valor de retención directamente
    }
    function saveExcluidoRecord() {
        var index = document.getElementById('ex_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };
        var r = {
            tipoDoc: s('ex_tipo_doc'), identificacion: s('ex_identificacion'), nombre: s('ex_nombre'),
            fecha: s('ex_fecha'), serie: s('ex_serie'), numDoc: s('ex_num'),
            monto: n('ex_monto'), retencion: n('ex_retencion'),
            tipoOp: s('ex_tipo_op'), clasif: s('ex_clasif'), sector: s('ex_sector'), tipoCosto: s('ex_tipo_costo')
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoEx = esDocumentoDuplicado('excluido', r, excluidoRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoEx) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoEx, 'error'); return; }
        if (index === '-1') {
            excluidoRecords.push(r);
            saveCurrentMonthData();
            renderExcluidoTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openExcluidoModal(-1);
        } else {
            excluidoRecords[index] = r;
            saveCurrentMonthData();
            renderExcluidoTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('ex-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + excluidoRecords.length;
        }
    }
    function deleteExcluidoRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { excluidoRecords.splice(index, 1); saveCurrentMonthData(); renderExcluidoTable(); });
    }
    function renderExcluidoTable() {
        var tbody = document.getElementById('excluidoTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.excluido ? loadRevStates('excluido') : {};
        var duplicados = _revisionActive.excluido ? detectarDuplicados('excluido', excluidoRecords) : {};
        if (_revisionActive.excluido) updateRevStats('excluido', revStates, duplicados, excluidoRecords.length);
        else clearRevStats('excluido');
        excluidoRecords.forEach(function(r, i) {
            var esAnulado = isRegistroAnulado('excluido', i);
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.excluido) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else if (esAnulado) {
                row.className = 'border-b border-zinc-700/40 transition-colors';
                row.style.cssText = 'background:rgba(113,113,122,0.08);border-left:3px solid var(--rp-text-secondary);text-decoration:line-through;opacity:0.55;';
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var docIdEx = r.numDoc || '';
            var anuBadgeEx = esAnulado && !_revisionActive.excluido
                ? '<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:800;letter-spacing:0.07em;color:#fff;background:var(--rp-text-secondary);border-radius:5px;padding:2px 7px;text-decoration:none;vertical-align:middle;">✕ ANULADO</span>' +
                  (docIdEx ? '<span style="display:block;font-size:9px;color:var(--rp-text-secondary);margin-top:2px;text-decoration:none;font-family:monospace;letter-spacing:0.03em;" title="Documento anulado: ' + docIdEx + '">' + docIdEx + '</span>' : '')
                : '';
            var revBadgeHtml   = _revisionActive.excluido ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.excluido ? buildRevOverlay('excluido', i, revEstado === 'duplicado') : '';
            var btnAnularEx = esAnulado
                ? '<button onclick="toggleAnulado(\'excluido\',' + i + ')" class="p-1.5 transition" style="color:var(--rp-success);background:rgba(34,197,94,0.1);border-radius:6px;border:1px solid rgba(34,197,94,0.3);" onmouseover="this.style.background=\'rgba(34,197,94,0.2)\'" onmouseout="this.style.background=\'rgba(34,197,94,0.1)\'" title="Reactivar documento (des-anular)"><i data-lucide="rotate-ccw" class="w-4"></i></button>'
                : '<button onclick="toggleAnulado(\'excluido\',' + i + ')" class="p-1.5 transition" style="color:var(--rp-text-secondary);" onmouseover="this.style.color=\'var(--rp-error)\'" onmouseout="this.style.color=\'var(--rp-text-secondary)\'" title="Anular documento"><i data-lucide="ban" class="w-4"></i></button>';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + r.identificacion + '</td>' +
                '<td class="px-4 py-3 text-xs text-white">' + r.nombre + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.serie + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap" style="position:relative;">' + r.numDoc + anuBadgeEx + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.monto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.retencion) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoOp) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.clasif) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.sector) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoCosto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">5</td>' +
                '<td class="px-4 py-3 text-xs sticky col-acciones" style="right:148px;background:' + (esAnulado && !_revisionActive.excluido ? 'rgba(15,15,17,0.97)' : 'var(--rp-surface)') + ';">' +
                '<div class="flex gap-2">' +
                '<button onclick="openExcluidoModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                btnAnularEx +
                '<button onclick="deleteExcluidoRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // Combina el resultado de la consulta pública (Factura de Sujeto
    // Excluido) + el proveedor elegido/creado en el teléfono, y GUARDA
    // DIRECTO el registro en el Libro de Compras a Sujetos Excluidos —
    // Anexo 5, sin abrir el modal "Nuevo Registro — Sujeto Excluido".
    // Mapeo (ver detalle acordado):
    //   Tipo de DTE (Factura de Sujeto Excluido)  -> Tipo de Documento (14, fijo)
    //   Fecha y Hora de Generación                 -> Fecha de Emisión
    //   Código de Generación                       -> Número de Documento
    //   Sello de Recepción                         -> Serie del Documento
    //   Monto Total de la Operación                -> Monto de la Operación
    //   Retención renta                            -> Retención IVA (13%) — Manual
    // NIT/DUI y Nombre del Sujeto Excluido NO vienen en la consulta pública
    // (no los expone Hacienda) — se toman del MISMO catálogo de Proveedores
    // que ya usa Compras, eligiéndolo/creándolo en el teléfono en la misma
    // pantalla que usa el flujo de Compras. El "Tipo de Documento" del
    // Sujeto Excluido (1-NIT / 2-DUI / 3-Otro, el select del modal) se
    // deduce del dato disponible en el proveedor elegido: NIT si lo tiene,
    // si no DUI, si no "Otro".
    // Cambio 03: ya no se guarda automáticamente ni el Sujeto Excluido se
    // elige/crea en el teléfono (Hacienda tampoco expone su NIT/DUI/nombre
    // en la consulta pública). Se abre el modal "Nuevo Registro — Sujeto
    // Excluido" con los datos del documento precargados; identificación,
    // nombre y clasificación se dejan en blanco/por defecto para que el
    // usuario los complete en esta misma pantalla (mismo guardado que ya
    // tiene el modal manual, incluida su clasificación en el catálogo de
    // Proveedores).
    // Corrección 01: ya no se abre el modal "Nuevo Registro — Sujeto
    // Excluido" — se abre la pantalla independiente "Documentos Escaneados".
    function _autocompletarExcluidoDesdeQR(combinado) {
        if (!combinado) return;
        if (_rechazarEscaneoSinEmpresaActiva()) return;

        // Corrección Bug 01 (se mantiene): mismo criterio que en los demás anexos.
        var _dupPeriodoEx = _codigoGenYaExisteEnLibro('excluido', normalizeUUID(combinado.codGen || ''), excluidoRecords);
        if (_dupPeriodoEx) {
            showToast('Documento ya procesado.', 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: 'Documento ya procesado.' });
            }
            return;
        }

        // Cambio 03 — Control de tipos de documento permitidos por módulo.
        // A diferencia de antes, Sujeto Excluido YA participa de este
        // control: se compara el texto real detectado (normalmente
        // "FACTURA DE SUJETO EXCLUIDO") contra lo configurado en Admin
        // para este anexo, igual que en los demás módulos.
        if (!qrScanTipoPermitido('excluido', combinado.tipoDteTexto)) {
            var _msgTipoEx = 'Este tipo de documento (' + (combinado.tipoDteTexto || combinado.tipoDocMapeado) + ') no está permitido para escaneo en Sujeto Excluido — revísalo en Admin › Escaneo QR.';
            showToast(_msgTipoEx, 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: _msgTipoEx });
            }
            return;
        }

        // Cambio 05 — Modo Admin "Resumen de Escaneo": en la PC
        // (comportamiento de siempre) o en el teléfono vinculado.
        if (resumenEscaneoModoLoad() === 'celular') {
            _enviarResumenACelular('excluido', combinado);
        } else {
            openQrDocModal('excluido', combinado);
        }
    }

    // ── Aplicar datos de proveedor al modal de Compras a Sujeto Excluido ──
    function _applyProveedorToExcluidoModal(prov) {
        if (!prov) return;
        if (prov.nombre) document.getElementById('ex_nombre').value = prov.nombre;
        document.getElementById('ex_tipo_doc').value = prov.tipoDocEx || document.getElementById('ex_tipo_doc').value;
        if (prov.tipoOpEx) document.getElementById('ex_tipo_op').value = prov.tipoOpEx;
        if (prov.clasif)   document.getElementById('ex_clasif').value = prov.clasif;
        if (prov.sector)   document.getElementById('ex_sector').value = prov.sector;
        if (prov.tipoCosto) document.getElementById('ex_tipo_costo').value = prov.tipoCosto;
    }

    function onExcluidoIdChange() {
        var idVal = document.getElementById('ex_identificacion').value.trim();
        var listEl = document.getElementById('ex_ac_list');
        if (!idVal) { acClose('ex_ac_list'); return; }
        var provs = loadProveedores().filter(function(p) { return proveedorTieneUso(p, 'excluido'); });
        var matches = provs.filter(function(p) {
            return (p.nit && p.nit.indexOf(idVal) !== -1) ||
                   (p.dui && p.dui.indexOf(idVal) !== -1) ||
                   (p.nrc && p.nrc.indexOf(idVal) !== -1) ||
                   (p.nombre && p.nombre.toLowerCase().indexOf(idVal.toLowerCase()) !== -1);
        });
        var exact = provs.find(function(p) {
            return (p.nit && p.nit === idVal) || (p.dui && p.dui === idVal) || (p.nrc && p.nrc === idVal);
        });
        if (exact) { _applyProveedorToExcluidoModal(exact); }
        if (matches.length === 0 || (matches.length === 1 && exact)) { acClose('ex_ac_list'); return; }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(p) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (p.nit || p.dui || p.nrc || '') + '</span><span class="ac-name">' + (p.nombre || '<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                document.getElementById('ex_identificacion').value = p.nit || p.dui || p.nrc || '';
                _applyProveedorToExcluidoModal(p);
                acClose('ex_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }