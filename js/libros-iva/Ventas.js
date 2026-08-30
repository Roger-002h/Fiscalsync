// libros-iva/Ventas.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    var _dActiveRes     = { resolucion: '', serie: '' };
    var _dLastManualDate  = '';

    function calcularTotalesCcf() {
        var totNosuj=0, totExentas=0, totGravadas=0, totIva=0, totTotal=0;
        var sorted = (debitoRecords || []).slice().sort(function(a,b) { return (a.fecha||'').localeCompare(b.fecha||''); });

        sorted.forEach(function(r, i) {
            var isNC = esNotaCredito(r.tipoDoc);
            var sign = isNC ? -1 : 1;
            // Bug fix (Libros Impresos): usar el índice real en debitoRecords
            // (no el del arreglo ordenado) para no marcar como anulado un
            // documento distinto — ver nota equivalente en calcularTotalesCf().
            var anulado = isRegistroAnulado('debito', debitoRecords.indexOf(r));

            if (!anulado) {
                totNosuj   += (r.nosujetas||0) * sign;
                totExentas += (r.exentas||0)   * sign;
                totGravadas+= (r.gravadas||0)  * sign;
                totIva     += (r.iva||0)        * sign;
                totTotal   += (r.total||0)      * sign;
            }
        });

        return { nosuj: totNosuj, exentas: totExentas, gravadas: totGravadas, iva: totIva, total: totTotal };
    }


    // ══════════════════════════════════════════════
    // TABS
    // ══════════════════════════════════════════════
    function swD(p,b){['d-tab-doc','d-tab-montos','d-tab-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});['d-btn-doc','d-btn-montos','d-btn-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    function openDebitoModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('d_editIndex').value = index;
        ['d_fecha','d_resolucion','d_serie','d_num','d_nit','d_nrc_field','d_dui','d_nombre','d_ctrl'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['d_exentas','d_nosujetas','d_gravadas','d_tercero','d_df_tercero','d_iva','d_subtotal','d_total'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        document.getElementById('d_clase').value = '1';
        document.getElementById('d_tipo_doc').value = '03';
        document.getElementById('d_tipo_op').value = '1';
        // AGREGADO NUEVO: auto-fill tipoIng desde empresa activa para registros nuevos
        var empTipoIng = '1';
        if (activeEmpresaId) {
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.tipoIng) empTipoIng = empActiva.tipoIng;
        }
        document.getElementById('d_tipo_ing').value = empTipoIng;
        clearFieldError('d_nit', 'd_nit_error');
        clearFieldError('d_dui', 'd_dui_error');
        swD('d-tab-doc','d-btn-doc');
        if (index !== -1) {
            var r = debitoRecords[index];
            document.getElementById('debitoModalTitle').innerText = 'Editar Registro — Crédito Fiscal';
            document.getElementById('d_fecha').value = r.fecha;
            document.getElementById('d_clase').value = r.clase;
            document.getElementById('d_tipo_doc').value = r.tipoDoc;
            document.getElementById('d_resolucion').value = r.resolucion;
            document.getElementById('d_serie').value = r.serie;
            document.getElementById('d_num').value = r.numDoc;
            document.getElementById('d_nit').value = r.nit;
            document.getElementById('d_nrc_field').value = r.nrc || '';
            document.getElementById('d_dui').value = r.dui;
            document.getElementById('d_nombre').value = r.nombre;
            document.getElementById('d_ctrl').value = r.ctrl;
            document.getElementById('d_exentas').value = r.exentas;
            document.getElementById('d_nosujetas').value = r.nosujetas;
            document.getElementById('d_gravadas').value = r.gravadas;
            document.getElementById('d_tercero').value = r.tercero;
            document.getElementById('d_df_tercero').value = r.dfTercero;
            document.getElementById('d_tipo_op').value = r.tipoOp;
            document.getElementById('d_tipo_ing').value = r.tipoIng;
            calcDebito();
        } else {
            document.getElementById('debitoModalTitle').innerText = 'Nuevo Registro — Crédito Fiscal';
            // ═══ PERSISTENCIA Resolución/Serie + auto-fecha para manuales (clase != 4) ═══
            if (_dActiveRes.resolucion) {
                document.getElementById('d_resolucion').value = _dActiveRes.resolucion;
                document.getElementById('d_serie').value      = _dActiveRes.serie;
            }
            // Auto-incrementar fecha
            if (_dLastManualDate) {
                try {
                    var parts = _dLastManualDate.split('-');
                    var dd = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                    dd.setDate(dd.getDate() + 1);
                    var pad2d = function(n){ return String(n).padStart(2,'0'); };
                    document.getElementById('d_fecha').value = dd.getFullYear() + '-' + pad2d(dd.getMonth()+1) + '-' + pad2d(dd.getDate());
                } catch(e) {}
            }
        }
        _setModalMode('debito', index !== -1, debitoRecords, index);
        renderResChips('d');
        updateResPanelVisibility('d');
        cancelResAddForm('d');
        document.getElementById('debitoModalForm').style.display='flex'; document.getElementById('debitoModalForm').classList.add('modal-open');
    }
    function closeDebitoModal() {
        _cerrarModalAnimado('debitoModalForm');
    }
    function navDebitoRecord(delta) {
        var cur = parseInt(document.getElementById('d_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= debitoRecords.length) return;
        var activeBtn = ['d-btn-doc','d-btn-montos','d-btn-clasif'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'d-btn-doc':'d-tab-doc','d-btn-montos':'d-tab-montos','d-btn-clasif':'d-tab-clasif'};
        saveDebitoRecord();
        openDebitoModal(next);
        if (activeBtn && tabMap[activeBtn]) swD(tabMap[activeBtn], activeBtn);
    }

    function calcDebito() {
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };
        var iva = n('d_gravadas') * 0.13;
        var subtotal = n('d_gravadas') + iva + n('d_exentas') + n('d_nosujetas');
        var total = subtotal + n('d_tercero') + n('d_df_tercero');
        document.getElementById('d_iva').value = iva.toFixed(2);
        document.getElementById('d_subtotal').value = subtotal.toFixed(2);
        document.getElementById('d_total').value = total.toFixed(2);
    }

    function saveDebitoRecord() {
        var index = document.getElementById('d_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var valid = true;
        var nitVal = s('d_nit').trim();
        var duiVal = s('d_dui').trim();

        if (nitVal && !isValidNitOrNrc(nitVal)) { setFieldError('d_nit', 'd_nit_error'); valid = false; } else { clearFieldError('d_nit', 'd_nit_error'); }
        if (duiVal && !isValidDui(duiVal)) { setFieldError('d_dui', 'd_dui_error'); valid = false; } else { clearFieldError('d_dui', 'd_dui_error'); }
        if (!valid) { showToast('Corrige los campos con formato incorrecto', 'error'); swD('d-tab-doc','d-btn-doc'); return; }

        var r = {
            fecha: s('d_fecha'), clase: s('d_clase'), tipoDoc: s('d_tipo_doc'),
            resolucion: s('d_resolucion'), serie: s('d_serie'), numDoc: s('d_num'),
            nit: s('d_nit'), nrc: s('d_nrc_field') || s('d_nit'), dui: s('d_dui'), nombre: s('d_nombre'), ctrl: s('d_ctrl'),
            exentas: n('d_exentas'), nosujetas: n('d_nosujetas'), gravadas: n('d_gravadas'),
            iva: n('d_iva'), tercero: n('d_tercero'), dfTercero: n('d_df_tercero'),
            total: n('d_total'), tipoOp: s('d_tipo_op'), tipoIng: s('d_tipo_ing')
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoD = esDocumentoDuplicado('debito', r, debitoRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoD) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoD, 'error'); return; }
        if (index === '-1') {
            // ═══ Guardar resolución/serie activa y fecha para próximo manual ═══
            var claseValD = s('d_clase');
            if (claseValD !== '4') {
                _dActiveRes.resolucion = r.resolucion;
                _dActiveRes.serie      = r.serie;
                if (r.fecha) _dLastManualDate = r.fecha;
            }
            debitoRecords.push(r);
            saveCurrentMonthData();
            renderDebitoTable();
            // AGREGADO NUEVO: auto-registrar cliente si tiene NIT y no está en el catálogo
            var nitDebito = (r.nit || r.nrc || '').trim();
            if (nitDebito) {
                var clienteAgregado = autoRegistrarCliente(nitDebito, r.nombre || '', r.nrc || '');
                if (clienteAgregado) renderClientesTable();
            }
            showToast('Registro guardado — listo para el siguiente', 'success');
            // Reset para nuevo registro
            openDebitoModal(-1);
        } else {
            // ═══ Si se editó, actualizar resolución/serie activa ═══
            if (r.clase !== '4') {
                _dActiveRes.resolucion = r.resolucion;
                _dActiveRes.serie      = r.serie;
            }
            debitoRecords[index] = r;
            saveCurrentMonthData();
            renderDebitoTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('debito-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + debitoRecords.length;
        }
    }
    function deleteDebitoRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { debitoRecords.splice(index, 1); saveCurrentMonthData(); renderDebitoTable(); });
    }
    function renderDebitoTable() {
        var tbody = document.getElementById('debitoTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.debito ? loadRevStates('debito') : {};
        var duplicados = _revisionActive.debito ? detectarDuplicados('debito', debitoRecords) : {};
        if (_revisionActive.debito) updateRevStats('debito', revStates, duplicados, debitoRecords.length);
        else clearRevStats('debito');
        debitoRecords.forEach(function(r, i) {
            var esAnulado = isRegistroAnulado('debito', i);
            var row = document.createElement('tr');
            // Estado de revisión
            var revEstado = null;
            if (_revisionActive.debito) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else if (esAnulado) {
                row.className = 'border-b border-zinc-700/40 transition-colors';
                row.style.cssText = 'background:rgba(113,113,122,0.08);border-left:3px solid var(--rp-text-secondary);text-decoration:line-through;opacity:0.55;';
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var docId = r.numDoc || r.resolucion || '';
            var anuBadge = esAnulado && !_revisionActive.debito
                ? '<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:800;letter-spacing:0.07em;color:#fff;background:var(--rp-text-secondary);border-radius:5px;padding:2px 7px;text-decoration:none;vertical-align:middle;">✕ ANULADO</span>' +
                  (docId ? '<span style="display:block;font-size:9px;color:var(--rp-text-secondary);margin-top:2px;text-decoration:none;font-family:monospace;letter-spacing:0.03em;" title="Documento anulado: ' + docId + '">' + docId + '</span>' : '')
                : '';
            var revBadgeHtml = _revisionActive.debito ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.debito ? buildRevOverlay('debito', i, revEstado === 'duplicado', 'start') : '';
            var btnAnular = esAnulado
                ? '<button onclick="toggleAnulado(\'debito\',' + i + ')" class="p-1.5 transition" style="color:var(--rp-success);background:rgba(34,197,94,0.1);border-radius:6px;border:1px solid rgba(34,197,94,0.3);" onmouseover="this.style.background=\'rgba(34,197,94,0.2)\'" onmouseout="this.style.background=\'rgba(34,197,94,0.1)\'" title="Reactivar documento (des-anular)"><i data-lucide="rotate-ccw" class="w-4"></i></button>'
                : '<button onclick="toggleAnulado(\'debito\',' + i + ')" class="p-1.5 transition" style="color:var(--rp-text-secondary);" onmouseover="this.style.color=\'var(--rp-error)\'" onmouseout="this.style.color=\'var(--rp-text-secondary)\'" title="Anular documento"><i data-lucide="ban" class="w-4"></i></button>';
            var dupMesBadgeD = r._dupMes ? '<span class="rev-badge-dupmes" title="Este documento ya fue registrado en ' + r._dupMes + '">⚠ ' + r._dupMes + '</span>' : '';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.clase) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs" style="position:relative;">' + r.resolucion + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.serie + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">' + r.numDoc + anuBadge + dupMesBadgeD + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.ctrl || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.nit + '</td>' +
                '<td class="px-4 py-3 text-xs text-white">' + r.nombre + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.exentas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.nosujetas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.gravadas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.iva) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.tercero) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.dfTercero) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right font-bold text-white">' + f(r.total) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoOp) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoIng) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">1</td>' +
                '<td class="px-4 py-3 text-xs sticky col-acciones" style="right:148px;background:' + (esAnulado && !_revisionActive.debito ? 'rgba(15,15,17,0.97)' : 'var(--rp-surface)') + ';">' +
                '<div class="flex gap-2">' +
                '<button onclick="openDebitoModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                btnAnular +
                '<button onclick="deleteDebitoRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td" style="background:' + (esAnulado && !_revisionActive.debito ? 'rgba(15,15,17,0.97)' : 'var(--rp-surface)') + ';">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
        filterTable('debito');
    }

    // Cambio 03: ya no se guarda automáticamente ni el cliente/"exenta" se
    // eligen en el teléfono. Se abre el modal "Nuevo Registro — Crédito
    // Fiscal" con los datos del documento precargados (monto por defecto en
    // "Gravadas" — si la venta era exenta, el usuario mueve el monto al
    // campo "Exentas"); el NIT del cliente se deja en blanco para que el
    // usuario lo busque/seleccione/agregue en esta misma pantalla (mismo
    // autocompletado y guardado que ya tiene el modal manual).
    // Corrección 01: ya no se abre el modal "Nuevo Registro — Crédito
    // Fiscal" — se abre la pantalla independiente "Documentos Escaneados".
    function _autocompletarVentaCCFDesdeQR(combinado) {
        if (!combinado) return;
        if (_rechazarEscaneoSinEmpresaActiva()) return;

        // Corrección Bug 01 (se mantiene): mismo criterio que en Compras.
        var _dupPeriodoD = _codigoGenYaExisteEnLibro('debito', normalizeUUID(combinado.codGen || ''), debitoRecords);
        if (_dupPeriodoD) {
            showToast('Documento ya procesado.', 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: 'Documento ya procesado.' });
            }
            return;
        }

        // Cambio 03 — Control de tipos de documento permitidos por módulo.
        if (!qrScanTipoPermitido('ccf', combinado.tipoDteTexto)) {
            var _msgTipoCcf = 'Este tipo de documento (' + (combinado.tipoDteTexto || combinado.tipoDocMapeado) + ') no está permitido para escaneo en Ventas — Crédito Fiscal — revísalo en Admin › Escaneo QR.';
            showToast(_msgTipoCcf, 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: _msgTipoCcf });
            }
            return;
        }

        // Cambio 05 — Modo Admin "Resumen de Escaneo": en la PC
        // (comportamiento de siempre) o en el teléfono vinculado.
        if (resumenEscaneoModoLoad() === 'celular') {
            _enviarResumenACelular('ccf', combinado);
        } else {
            openQrDocModal('ccf', combinado);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // APLICAR CODIFICACIÓN DE CLIENTES AL LIBRO VENTAS A CRÉDITO FISCAL
    // Recorre todos los cfRecords y aplica tipoOp/tipoIng del catálogo
    // de clientes cuando el NIT del registro coincide con uno registrado.
    // ══════════════════════════════════════════════════════════════════
    function aplicarCodificacionDebito() {
        var clientes = loadClientes();
        if (!clientes.length) { showToast('No hay clientes en el catálogo', 'error'); return; }
        var aplicados = 0;
        debitoRecords.forEach(function(r) {
            var nit = (r.nit || r.nrc || '').trim();
            if (!nit) return;
            var cliente = clientes.find(function(c) { return c.nit === nit || (c.nrc && c.nrc === nit); });
            if (cliente) {
                var cambio = false;
                if (cliente.tipoOp  && r.tipoOp  !== cliente.tipoOp)  { r.tipoOp  = cliente.tipoOp;  cambio = true; }
                if (cliente.tipoIng && r.tipoIng !== cliente.tipoIng) { r.tipoIng = cliente.tipoIng; cambio = true; }
                if (cambio) aplicados++;
            }
        });
        if (!aplicados) { showToast('Sin cambios — ningún NIT coincide o la codificación ya está aplicada', 'success'); return; }
        saveCurrentMonthData();
        renderAllTables();
        showToast(aplicados + ' registro(s) actualizados con la codificación del catálogo', 'success');
    }

    // ── Aplicar datos de cliente al modal de débito/CF ──
    function _applyClienteToDebitoModal(cli) {
        if (!cli) return;
        if (cli.nombre)  document.getElementById('d_nombre').value = cli.nombre;
        if (cli.nit)     document.getElementById('d_nit').value    = cli.nit;
        if (cli.nrc)     document.getElementById('d_nrc_field').value = cli.nrc;
        if (cli.dui)     document.getElementById('d_dui').value    = cli.dui || '';
        if (cli.tipoOp)  { var el = document.getElementById('d_tipo_op');  if (el) el.value = cli.tipoOp; }
        if (cli.tipoIng) { var el2 = document.getElementById('d_tipo_ing'); if (el2) el2.value = cli.tipoIng; }
    }

    // ══════════════════════════════════════════════════════════════════
    // AUTO-COMPLETAR NOMBRE EN CRÉDITO FISCAL DESDE CLIENTES (predictivo)
    // ══════════════════════════════════════════════════════════════════
    function onDebitoNitChange() {
        var nitVal = document.getElementById('d_nit').value.trim();
        var listEl = document.getElementById('d_ac_list');
        if (!nitVal) { acClose('d_ac_list');
            // 3.2: si NIT vacío, nombre solo se limpia si NRC también está vacío/incompleto
            var nrcFallbackD = document.getElementById('d_nrc_field').value.trim();
            if (!nrcFallbackD || !_isCompleteNrc(nrcFallbackD)) document.getElementById('d_nombre').value = '';
            return;
        }
        var clientes = loadClientes();
        var matches = clientes.filter(function(c) {
            return (c.nit && c.nit.indexOf(nitVal) !== -1) ||
                   (c.nrc && c.nrc.indexOf(nitVal) !== -1) ||
                   (c.nombre && c.nombre.toLowerCase().indexOf(nitVal.toLowerCase()) !== -1);
        });
        var exact = clientes.find(function(c) {
            return (c.nit && c.nit === nitVal) || (c.nrc && c.nrc === nitVal) || (c.dui && c.dui === nitVal);
        });
        if (exact) {
            _applyClienteToDebitoModal(exact);
        } else if (!_isCompleteId(nitVal)) {
            document.getElementById('d_nombre').value = '';
        }
        if (matches.length === 0 || (matches.length === 1 && exact)) { acClose('d_ac_list'); return; }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(c) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (c.nit||c.nrc||'') + (c.nrc && c.nit ? ' · NRC: '+c.nrc : '') + '</span><span class="ac-name">' + (c.nombre||'<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                _applyClienteToDebitoModal(c);
                acClose('d_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }

    // ── Campo NRC separado en débito/CF ──
    function onDebitoNrcChange() {
        var nrcVal = document.getElementById('d_nrc_field').value.trim();
        var nitVal = document.getElementById('d_nit').value.trim();
        var listEl = document.getElementById('d_nrc_ac_list');
        if (!nrcVal) { acClose('d_nrc_ac_list');
            // Si NIT también está vacío, limpiar nombre
            if (!nitVal) document.getElementById('d_nombre').value = '';
            return;
        }
        var clientes = loadClientes();
        var matches = clientes.filter(function(c) {
            return (c.nrc && c.nrc.indexOf(nrcVal) !== -1) ||
                   (c.nombre && c.nombre.toLowerCase().indexOf(nrcVal.toLowerCase()) !== -1);
        });
        var exact = clientes.find(function(c) { return c.nrc && c.nrc === nrcVal; });
        if (exact) {
            _applyClienteToDebitoModal(exact);
        } else if (!nitVal && !_isCompleteNrc(nrcVal)) {
            // 3.2: si NIT vacío y NRC incompleto → quitar nombre
            document.getElementById('d_nombre').value = '';
        }
        if (matches.length === 0 || (matches.length === 1 && exact)) { acClose('d_nrc_ac_list'); return; }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(c) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">NRC: ' + (c.nrc||'') + (c.nit ? ' · NIT: '+c.nit : '') + '</span><span class="ac-name">' + (c.nombre||'<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                _applyClienteToDebitoModal(c);
                acClose('d_nrc_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }