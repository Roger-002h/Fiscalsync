// libros-iva/Compras.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    function swCP(p,b){['cp-tab-doc','cp-tab-montos','cp-tab-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});['cp-btn-doc','cp-btn-montos','cp-btn-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // COMPRAS CRUD
    // ══════════════════════════════════════════════
    function openComprasModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('cp_editIndex').value = index;
        document.getElementById('cp_perc_link_id').value = '';
        ['cp_fecha','cp_num','cp_sello','cp_nit','cp_nrc','cp_dui','cp_nombre'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['cp_int_exentas','cp_intern_exentas','cp_imp_exentas','cp_int_gravadas','cp_intern_grav','cp_imp_grav','cp_imp_serv','cp_credito','cp_total','cp_fovial','cp_cotrans','cp_iva_percibido','cp_total_visual'].forEach(function(id) { var f = document.getElementById(id); if (f) f.value = '0.00'; });
        document.getElementById('cp_clase').value = '1';
        document.getElementById('cp_tipo_doc').value = '03';
        document.getElementById('cp_tipo_op').value = '1';
        document.getElementById('cp_clasif').value = '1';
        // AGREGADO NUEVO: auto-fill sector desde empresa activa para registros nuevos
        var empSector = '1';
        if (activeEmpresaId) {
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.sector) empSector = empActiva.sector;
        }
        document.getElementById('cp_sector').value = empSector;
        document.getElementById('cp_tipo_costo').value = '1';
        clearFieldError('cp_nit', 'cp_nit_error');
        clearFieldError('cp_dui', 'cp_dui_error');
        // AGREGADO NUEVO: ocultar hint proveedor por defecto
        var hintEl = document.getElementById('cp_proveedor_hint');
        if (hintEl) hintEl.style.display = 'none';
        swCP('cp-tab-doc','cp-btn-doc');
        if (index !== -1) {
            var r = comprasRecords[index];
            document.getElementById('comprasModalTitle').innerText = 'Editar Registro — Compras';
            document.getElementById('cp_fecha').value = r.fecha;
            document.getElementById('cp_clase').value = r.clase;
            document.getElementById('cp_tipo_doc').value = r.tipoDoc;
            document.getElementById('cp_num').value = r.numDoc;
            document.getElementById('cp_sello').value = r.selloRecepcion || '';
            document.getElementById('cp_iva_percibido').value = r.ivaPercibido || '0.00';
            document.getElementById('cp_perc_link_id').value = r._percLinkId || '';
            document.getElementById('cp_nit').value = r.nit;
            document.getElementById('cp_nrc').value = r.nrc || '';
            document.getElementById('cp_dui').value = r.dui;
            document.getElementById('cp_nombre').value = r.nombre;
            document.getElementById('cp_int_exentas').value = r.intExentas;
            document.getElementById('cp_intern_exentas').value = r.internExentas;
            document.getElementById('cp_imp_exentas').value = r.impExentas;
            document.getElementById('cp_int_gravadas').value = r.intGravadas;
            document.getElementById('cp_intern_grav').value = r.internGrav;
            document.getElementById('cp_imp_grav').value = r.impGrav;
            document.getElementById('cp_imp_serv').value = r.impServ;
            document.getElementById('cp_tipo_op').value = r.tipoOp;
            document.getElementById('cp_clasif').value = r.clasif;
            document.getElementById('cp_sector').value = r.sector;
            document.getElementById('cp_tipo_costo').value = r.tipoCosto;
            document.getElementById('cp_fovial').value  = r.fovial  || '0.00';
            document.getElementById('cp_cotrans').value = r.cotrans || '0.00';
            // AGREGADO NUEVO: mostrar hint si hay proveedor vinculado
            if (r.nit) mostrarHintProveedor(r.nit);
            calcCompras();
        } else {
            document.getElementById('comprasModalTitle').innerText = 'Nuevo Registro — Compras';
        }
        _setModalMode('cp', index !== -1, comprasRecords, index);
        document.getElementById('comprasModalForm').style.display='flex'; document.getElementById('comprasModalForm').classList.add('modal-open');
    }
    function closeComprasModal() { _cerrarModalAnimado('comprasModalForm'); }
    function navComprasRecord(delta) {
        var cur = parseInt(document.getElementById('cp_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= comprasRecords.length) return;
        var activeBtn = ['cp-btn-doc','cp-btn-montos','cp-btn-clasif'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'cp-btn-doc':'cp-tab-doc','cp-btn-montos':'cp-tab-montos','cp-btn-clasif':'cp-tab-clasif'};
        saveComprasRecord();
        openComprasModal(next);
        if (activeBtn && tabMap[activeBtn]) swCP(tabMap[activeBtn], activeBtn);
    }
    function calcCompras() {
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };
        var totalExentas  = n('cp_int_exentas') + n('cp_intern_exentas') + n('cp_imp_exentas');
        var totalGravadas = n('cp_int_gravadas') + n('cp_intern_grav') + n('cp_imp_grav') + n('cp_imp_serv');
        // Crédito fiscal = IVA 13% sobre gravadas (editable si el doc tiene valor diferente)
        var credito = totalGravadas * 0.13;
        document.getElementById('cp_credito').value = credito.toFixed(2);
        // Total = exentas + gravadas + crédito (IVA)
        // FOVIAL y COTRANS son informativos — NO entran en el total
        var total = totalExentas + totalGravadas + credito;
        document.getElementById('cp_total').value = total.toFixed(2);
        calcTotalVisual();
    }
    function calcComprasTotal() {
        // Se llama cuando el usuario edita manualmente el crédito fiscal
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };
        var totalExentas  = n('cp_int_exentas') + n('cp_intern_exentas') + n('cp_imp_exentas');
        var totalGravadas = n('cp_int_gravadas') + n('cp_intern_grav') + n('cp_imp_grav') + n('cp_imp_serv');
        var credito = n('cp_credito');
        // Total = exentas + gravadas + crédito (IVA) — FOVIAL/COTRANS nunca suman
        var total = totalExentas + totalGravadas + credito;
        document.getElementById('cp_total').value = total.toFixed(2);
        calcTotalVisual();
    }
    function saveComprasRecord() {
        var index = document.getElementById('cp_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var valid = true;
        var nitVal = s('cp_nit').trim();
        var duiVal = s('cp_dui').trim();

        if (nitVal && !isValidNitOrNrc(nitVal)) { setFieldError('cp_nit', 'cp_nit_error'); valid = false; } else { clearFieldError('cp_nit', 'cp_nit_error'); }
        if (duiVal && !isValidDui(duiVal)) { setFieldError('cp_dui', 'cp_dui_error'); valid = false; } else { clearFieldError('cp_dui', 'cp_dui_error'); }
        if (!valid) { showToast('Corrige los campos con formato incorrecto', 'error'); swCP('cp-tab-doc','cp-btn-doc'); return; }

        var r = {
            fecha: s('cp_fecha'), clase: s('cp_clase'), tipoDoc: s('cp_tipo_doc'),
            numDoc: s('cp_num'), nit: s('cp_nit'), nrc: s('cp_nrc') || s('cp_nit'), dui: s('cp_dui'), nombre: s('cp_nombre'),
            intExentas: n('cp_int_exentas'), internExentas: n('cp_intern_exentas'), impExentas: n('cp_imp_exentas'),
            intGravadas: n('cp_int_gravadas'), internGrav: n('cp_intern_grav'),
            impGrav: n('cp_imp_grav'), impServ: n('cp_imp_serv'),
            credito: n('cp_credito'), total: n('cp_total'),
            fovial: n('cp_fovial'), cotrans: n('cp_cotrans'),
            tipoOp: s('cp_tipo_op'), clasif: s('cp_clasif'), sector: s('cp_sector'), tipoCosto: s('cp_tipo_costo'),
            // AGREGADO NUEVO: Sello de Recepción e IVA Percibido — información adicional del registro
            // de compra que alimenta automáticamente el Libro de IVA Percibido (Anexo 8), sin alterar
            // ningún cálculo ni la estructura existente del Libro de Compras.
            selloRecepcion: s('cp_sello'), ivaPercibido: n('cp_iva_percibido'),
            _percLinkId: s('cp_perc_link_id') || ''
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoCp = esDocumentoDuplicado('compras', r, comprasRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoCp) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoCp, 'error'); return; }
        if (index === '-1') {
            comprasRecords.push(r);
            syncPercibidoFromCompra(r);
            saveCurrentMonthData();
            renderComprasTable();
            var nitProv = (r.nit || r.nrc || '').trim();
            if (nitProv) {
                var added = autoRegistrarProveedor(r.nit || '', r.nombre || '', r.dui || '', r.nrc || '', r.clasif || '', r.sector || '', r.tipoCosto || '');
                if (added) { renderProveedoresTable(); showToast('Registro guardado · Proveedor agregado al catálogo', 'success'); }
                else { renderProveedoresTable(); showToast('Registro guardado — listo para el siguiente', 'success'); }
            } else {
                showToast('Registro guardado — listo para el siguiente', 'success');
            }
            openComprasModal(-1);
        } else {
            comprasRecords[index] = r;
            syncPercibidoFromCompra(r);
            saveCurrentMonthData();
            renderComprasTable();
            var nitProv = (r.nit || r.nrc || '').trim();
            if (nitProv) {
                var added = autoRegistrarProveedor(r.nit || '', r.nombre || '', r.dui || '', r.nrc || '', r.clasif || '', r.sector || '', r.tipoCosto || '');
                renderProveedoresTable();
            }
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('cp-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + comprasRecords.length;
        }
    }
    function deleteComprasRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() {
            var r = comprasRecords[index];
            // AGREGADO NUEVO: si el registro de compra eliminado tenía un registro
            // vinculado en el Libro de IVA Percibido (generado desde sus propios
            // campos Sello de Recepción / IVA Percibido), se elimina también para
            // no dejar información huérfana en ese libro.
            if (r && r._percLinkId) {
                var pIdx = percibidoRecords.findIndex(function(p) { return p._fromCompraLinkId === r._percLinkId; });
                if (pIdx !== -1) { percibidoRecords.splice(pIdx, 1); renderPercibidoTable(); }
            }
            comprasRecords.splice(index, 1); saveCurrentMonthData(); renderComprasTable();
        });
    }

    function renderComprasTable() {
        var tbody = document.getElementById('comprasTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.compras ? loadRevStates('compras') : {};
        var duplicados = _revisionActive.compras ? detectarDuplicados('compras', comprasRecords) : {};
        if (_revisionActive.compras) updateRevStats('compras', revStates, duplicados, comprasRecords.length);
        else clearRevStats('compras');
        comprasRecords.forEach(function(r, i) {
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.compras) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var revBadgeHtml   = _revisionActive.compras ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.compras ? buildRevOverlay('compras', i, revEstado === 'duplicado') : '';
            var dupMesBadge = r._dupMes ? '<span class="rev-badge-dupmes" title="Este documento ya fue registrado en ' + r._dupMes + '">⚠ ' + r._dupMes + '</span>' : '';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.clase) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap" style="position:relative;">' + r.numDoc + revBadgeHtml + dupMesBadge + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.nit + '</td>' +
                '<td class="px-4 py-3 text-xs text-white">' + r.nombre + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.intExentas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.internExentas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.impExentas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.intGravadas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.internGrav) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.impGrav) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.impServ) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.credito) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right font-bold text-white">' + f(r.total) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoOp) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.clasif) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.sector) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoCosto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">3</td>' +
                '<td class="px-4 py-3 text-xs sticky bg-zinc-950 col-acciones" style="right:148px;">' +
                '<div class="flex gap-2">' +
                '<button onclick="openComprasModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteComprasRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
        filterTable('compras');
    }

    // Cambio 03 (gestión trasladada a la computadora): ya NO se guarda el
    // registro automáticamente. El teléfono solo mandó el QR — 'combinado'
    // trae el resultado de la consulta pública (fecha, código de
    // generación, montos, tipo de documento), sin proveedor ninguno (eso lo
    // expone únicamente el Sello/QR del documento, no la consulta de
    // Hacienda). Se abre el modal "Nuevo Registro — Compras" ya existente
    // (mismo que usa el botón manual "+ Nuevo") con los campos del
    // documento precargados, y se deja el NIT/proveedor en blanco para que
    // el usuario lo busque/seleccione/agregue en esta misma pantalla —
    // reutilizando tal cual el autocompletado (onComprasNitChange) y el
    // guardado (saveComprasRecord, con su propio autoRegistrarProveedor y
    // validación de duplicados) que ya tiene el modal manual. El usuario
    // confirma con el mismo botón "Guardar" del modal.
    // Corrección 01: ya no se abre el modal "Nuevo Registro — Compras" — se
    // abre la pantalla independiente "Documentos Escaneados" (ver
    // openQrDocModal), donde el usuario selecciona/agrega el proveedor y
    // confirma con "Enviar". Esa pantalla es quien realmente arma y guarda
    // el registro en comprasRecords (ver qrDocEnviar).
    function _autocompletarComprasDesdeQR(combinado) {
        if (!combinado) return;
        if (_rechazarEscaneoSinEmpresaActiva()) return;

        // Corrección Bug 01 (se mantiene): si el documento ya fue registrado
        // en el Libro de Compras (manual, JSON, CSV o un escaneo previo), no
        // se abre la pantalla de nuevo — se avisa al usuario y, si el
        // teléfono sigue en pantalla, también ahí.
        var _dupPeriodoCp = _codigoGenYaExisteEnLibro('compras', normalizeUUID(combinado.codGen || ''), comprasRecords);
        if (_dupPeriodoCp) {
            showToast('Documento ya procesado.', 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: 'Documento ya procesado.' });
            }
            return;
        }

        // Cambio 03 — Control de tipos de documento permitidos por módulo.
        // Solo bloquea si el tipo SÍ se reconoció automáticamente (mapeo
        // existente) y no está en la lista configurada en Admin para este
        // módulo. Si no se reconoció (null), no se bloquea aquí — sigue el
        // flujo existente (aviso "Tipo no reconocido" en el modal).
        if (!qrScanTipoPermitido('compras', combinado.tipoDteTexto)) {
            var _msgTipoCp = 'Este tipo de documento (' + (combinado.tipoDteTexto || combinado.tipoDocMapeado) + ') no está permitido para escaneo en el módulo de Compras — revísalo en Admin › Escaneo QR.';
            showToast(_msgTipoCp, 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: _msgTipoCp });
            }
            return;
        }

        // Cambio 05 — Modo Admin "Resumen de Escaneo": en la PC
        // (comportamiento de siempre) o en el teléfono vinculado.
        if (resumenEscaneoModoLoad() === 'celular') {
            _enviarResumenACelular('compras', combinado);
        } else {
            openQrDocModal('compras', combinado);
        }
    }

    // AGREGADO NUEVO: aplica clasif/sector/tipoCosto a todos los registros de
    // compras del mes activo que coincidan con el NIT del proveedor
    function aplicarClasifProveedorACompras(nit, clasif, sector, tipoCosto) {
        if (!nit) return 0;
        var count = 0;
        comprasRecords.forEach(function(r) {
            if (r.nit === nit || r.nrc === nit) {
                if (clasif)    r.clasif    = clasif;
                if (sector)    r.sector    = sector;
                if (tipoCosto) r.tipoCosto = tipoCosto;
                count++;
            }
        });
        return count;
    }

    // ══════════════════════════════════════════════════════════════════
    // CODIFICACIÓN MASIVA DE COMPRAS CON DATOS DE PROVEEDORES
    // ══════════════════════════════════════════════════════════════════
    function codificarTodasLasCompras() {
        if (!activeEmpresaId) return;
        var provs = loadProveedores();
        if (!provs.length) { showToast('No hay proveedores en el catálogo', 'error'); return; }
        var codificados = 0;
        comprasRecords.forEach(function(r) {
            var nit = (r.nit || r.nrc || '').trim();
            if (!nit) return;
            var prov = provs.find(function(p) { return (p.nit && p.nit === nit) || (p.nrc && p.nrc === nit); });
            if (prov) {
                if (prov.nombre && !r.nombre) r.nombre = prov.nombre;
                if (prov.clasif) r.clasif = prov.clasif;
                if (prov.sector) r.sector = prov.sector;
                if (prov.tipoCosto) r.tipoCosto = prov.tipoCosto;
                codificados++;
            }
        });
        if (codificados > 0) {
            saveCurrentMonthData();
            renderComprasTable();
            showToast(codificados + ' compra(s) codificadas con datos de proveedores', 'success');
        } else {
            showToast('No se encontraron coincidencias de NIT en el catálogo', 'error');
        }
    }

    // ── Aplicar datos de proveedor al modal de compras ──
    function _applyProveedorToComprasModal(prov, idBusqueda) {
        if (!prov) return;
        if (prov.nombre) document.getElementById('cp_nombre').value = prov.nombre;
        if (prov.nit)    document.getElementById('cp_nit').value    = prov.nit;
        if (prov.nrc)    document.getElementById('cp_nrc').value    = prov.nrc;
        if (prov.dui)    document.getElementById('cp_dui').value    = prov.dui;
        if (prov.clasif)    document.getElementById('cp_clasif').value    = prov.clasif;
        if (prov.sector)    document.getElementById('cp_sector').value    = prov.sector;
        if (prov.tipoCosto) document.getElementById('cp_tipo_costo').value = prov.tipoCosto;
        mostrarHintProveedor(idBusqueda || prov.nit || prov.nrc || '');
    }

    // ══════════════════════════════════════════════════════════════════
    // AUTO-COMPLETAR NOMBRE EN COMPRAS DESDE PROVEEDORES (predictivo)
    // ══════════════════════════════════════════════════════════════════
    function onComprasNitChange() {
        var nitVal = document.getElementById('cp_nit').value.trim();
        var listEl = document.getElementById('cp_ac_list');
        if (!nitVal) { acClose('cp_ac_list');
            // 3.1: si NIT vacío, nombre solo se limpia si NRC también está vacío/incompleto
            var nrcFallback = document.getElementById('cp_nrc').value.trim();
            if (!nrcFallback || !_isCompleteNrc(nrcFallback)) document.getElementById('cp_nombre').value = '';
            return;
        }
        var provs = loadProveedores();
        // Búsqueda predictiva
        var matches = provs.filter(function(p) {
            return (p.nit && p.nit.indexOf(nitVal) !== -1) ||
                   (p.nrc && p.nrc.indexOf(nitVal) !== -1) ||
                   (p.dui && p.dui.indexOf(nitVal) !== -1) ||
                   (p.nombre && p.nombre.toLowerCase().indexOf(nitVal.toLowerCase()) !== -1);
        });
        // Si hay coincidencia exacta → completar directamente
        var exact = provs.find(function(p) {
            return (p.nit && p.nit === nitVal) || (p.nrc && p.nrc === nitVal) || (p.dui && p.dui === nitVal);
        });
        if (exact) {
            _applyProveedorToComprasModal(exact, nitVal);
        } else if (!_isCompleteId(nitVal)) {
            // Solo mostrar nombre completo si el ID está completo
            document.getElementById('cp_nombre').value = '';
        }
        // Mostrar dropdown
        if (matches.length === 0 || (matches.length === 1 && exact)) { acClose('cp_ac_list'); return; }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(p) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (p.nit||p.nrc||'') + (p.nrc && p.nit ? ' · NRC: '+p.nrc : '') + '</span><span class="ac-name">' + (p.nombre||'<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                document.getElementById('cp_nit').value = p.nit || p.nrc || '';
                _applyProveedorToComprasModal(p, p.nit || p.nrc || '');
                acClose('cp_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }

    // ── Campo NRC separado en compras ──
    function onComprasNrcChange() {
        var nrcVal = document.getElementById('cp_nrc').value.trim();
        var nitVal = document.getElementById('cp_nit').value.trim();
        var listEl = document.getElementById('cp_nrc_ac_list');
        if (!nrcVal) { acClose('cp_nrc_ac_list');
            // Si NIT también está vacío, limpiar nombre
            if (!nitVal) document.getElementById('cp_nombre').value = '';
            return;
        }
        var provs = loadProveedores();
        var matches = provs.filter(function(p) {
            return (p.nrc && p.nrc.indexOf(nrcVal) !== -1) ||
                   (p.nombre && p.nombre.toLowerCase().indexOf(nrcVal.toLowerCase()) !== -1);
        });
        var exact = provs.find(function(p) { return p.nrc && p.nrc === nrcVal; });
        if (exact) {
            _applyProveedorToComprasModal(exact, nrcVal);
        } else if (!nitVal && !_isCompleteNrc(nrcVal)) {
            // 3.1: si NIT vacío y NRC incompleto → quitar nombre
            document.getElementById('cp_nombre').value = '';
        }
        if (matches.length === 0 || (matches.length === 1 && exact)) { acClose('cp_nrc_ac_list'); return; }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(p) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">NRC: ' + (p.nrc||'') + (p.nit ? ' · NIT: '+p.nit : '') + '</span><span class="ac-name">' + (p.nombre||'<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                document.getElementById('cp_nrc').value = p.nrc || '';
                _applyProveedorToComprasModal(p, p.nrc || p.nit || '');
                acClose('cp_nrc_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }