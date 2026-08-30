// libros-iva/CreditoFiscal.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══ Memoria de Resolución/Serie activa para documentos manuales ══
    // Se mantiene entre aperturas del modal hasta que el usuario la borre o cambie
    var _cfActiveRes    = { resolucion: '', serie: '' };
    // ══ Última fecha usada en modo manual (para auto-incremento) ══
    var _cfLastManualDate = '';

    function calcularTotalesCf() {
        var totNosuj=0, totExentas=0, totGravadas=0, totExp=0, totTotal=0;
        var sorted = (cfRecords || []).slice().sort(function(a,b) { return (a.fecha||'').localeCompare(b.fecha||''); });

        sorted.forEach(function(r, i) {
            var isNC = esNotaCredito(r.tipoDoc);
            var sign = isNC ? -1 : 1;
            var exp = (r.expCa||0) + (r.expFuera||0) + (r.expServ||0);
            // Bug fix (Libros Impresos): "i" es el índice dentro del arreglo YA
            // ORDENADO por fecha, no el índice real dentro de cfRecords. Usar "i"
            // directamente en isRegistroAnulado() causaba que se marcara como
            // anulado un documento distinto al que realmente fue anulado cuando
            // el orden cronológico difería del orden de inserción (típico en
            // registros ingresados manualmente). Se busca el índice real con indexOf(r).
            var anulado = isRegistroAnulado('cf', cfRecords.indexOf(r));

            if (!anulado) {
                totNosuj   += (r.nosujetas||0) * sign;
                totExentas += (r.exentas||0)   * sign;
                totGravadas+= (r.gravadas||0)  * sign;
                totExp     += exp               * sign;
                totTotal   += (r.total||0)      * sign;
            }
        });

        var ivaCalculado = totGravadas * 13 / 113;
        return { nosuj: totNosuj, exentas: totExentas, gravadas: totGravadas, exp: totExp, total: totTotal, iva: ivaCalculado };
    }
    function swCF(p,b){['cf-tab-doc','cf-tab-montos','cf-tab-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});['cf-btn-doc','cf-btn-montos','cf-btn-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // CONSUMIDOR FINAL CRUD
    // ══════════════════════════════════════════════
    function openCfModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('cf_editIndex').value = index;
        ['cf_fecha','cf_resolucion','cf_serie','cf_maquina','cf_ctrl_del','cf_ctrl_al','cf_doc_del','cf_doc_al'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['cf_exentas','cf_exenta_nosuj','cf_nosujetas','cf_gravadas','cf_exp_ca','cf_exp_fuera','cf_exp_serv','cf_zonas','cf_terceros','cf_subtotal','cf_total'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        document.getElementById('cf_clase').value = '1';
        document.getElementById('cf_tipo_doc').value = '01';
        document.getElementById('cf_tipo_op').value = '1';
        // AGREGADO NUEVO: auto-fill tipoIng desde empresa activa para registros nuevos
        var empTipoIng = '1';
        if (activeEmpresaId) {
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.tipoIng) empTipoIng = empActiva.tipoIng;
        }
        document.getElementById('cf_tipo_ing').value = empTipoIng;
        swCF('cf-tab-doc','cf-btn-doc');
        if (index !== -1) {
            var r = cfRecords[index];
            document.getElementById('cfModalTitle').innerText = 'Editar Registro — Consumidor Final';
            document.getElementById('cf_fecha').value = r.fecha;
            document.getElementById('cf_clase').value = r.clase;
            document.getElementById('cf_tipo_doc').value = r.tipoDoc;
            document.getElementById('cf_resolucion').value = r.resolucion;
            document.getElementById('cf_serie').value = r.serie;
            document.getElementById('cf_maquina').value = r.maquina;
            document.getElementById('cf_ctrl_del').value = r.ctrlDel;
            document.getElementById('cf_ctrl_al').value = r.ctrlAl;
            document.getElementById('cf_doc_del').value = r.docDel;
            document.getElementById('cf_doc_al').value = r.docAl;
            document.getElementById('cf_exentas').value = r.exentas;
            document.getElementById('cf_exenta_nosuj').value = r.exentaNosuj;
            document.getElementById('cf_nosujetas').value = r.nosujetas;
            document.getElementById('cf_gravadas').value = r.gravadas;
            document.getElementById('cf_exp_ca').value = r.expCa;
            document.getElementById('cf_exp_fuera').value = r.expFuera;
            document.getElementById('cf_exp_serv').value = r.expServ;
            document.getElementById('cf_zonas').value = r.zonas;
            document.getElementById('cf_terceros').value = r.terceros;
            document.getElementById('cf_tipo_op').value = r.tipoOp;
            document.getElementById('cf_tipo_ing').value = r.tipoIng;
            calcCf();
        } else {
            document.getElementById('cfModalTitle').innerText = 'Nuevo Registro — Consumidor Final';
            // ═══ PERSISTENCIA Resolución/Serie + auto-fecha para manuales (clase != 4) ═══
            // Aplicar resolución/serie activa guardada
            if (_cfActiveRes.resolucion) {
                document.getElementById('cf_resolucion').value = _cfActiveRes.resolucion;
                document.getElementById('cf_serie').value      = _cfActiveRes.serie;
            }
            // Auto-incrementar fecha: si hay fecha manual previa, avanzar 1 día
            if (_cfLastManualDate) {
                try {
                    var parts = _cfLastManualDate.split('-');
                    var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                    d.setDate(d.getDate() + 1);
                    var pad2 = function(n){ return String(n).padStart(2,'0'); };
                    document.getElementById('cf_fecha').value = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
                } catch(e) {}
            }
        }
        _setModalMode('cf', index !== -1, cfRecords, index);
        renderResChips('cf');
        updateResPanelVisibility('cf');
        cancelResAddForm('cf');
        document.getElementById('cfModalForm').style.display='flex'; document.getElementById('cfModalForm').classList.add('modal-open');
    }
    function closeCfModal() {
        _cerrarModalAnimado('cfModalForm');
    }
    function navCfRecord(delta) {
        var cur = parseInt(document.getElementById('cf_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= cfRecords.length) return;
        var activeBtn = ['cf-btn-doc','cf-btn-montos','cf-btn-clasif'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'cf-btn-doc':'cf-tab-doc','cf-btn-montos':'cf-tab-montos','cf-btn-clasif':'cf-tab-clasif'};
        saveCfRecord();
        openCfModal(next);
        if (activeBtn && tabMap[activeBtn]) swCF(tabMap[activeBtn], activeBtn);
    }
    function calcCf() {
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };
        var subtotal = n('cf_exentas') + n('cf_exenta_nosuj') + n('cf_nosujetas') + n('cf_gravadas');
        var total = subtotal + n('cf_exp_ca') + n('cf_exp_fuera') + n('cf_exp_serv') + n('cf_zonas') + n('cf_terceros');
        document.getElementById('cf_subtotal').value = subtotal.toFixed(2);
        document.getElementById('cf_total').value = total.toFixed(2);
    }
    function saveCfRecord() {
        var index = document.getElementById('cf_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };
        var r = {
            fecha: s('cf_fecha'), clase: s('cf_clase'), tipoDoc: s('cf_tipo_doc'),
            resolucion: s('cf_resolucion'), serie: s('cf_serie'), maquina: s('cf_maquina'),
            ctrlDel: s('cf_ctrl_del'), ctrlAl: s('cf_ctrl_al'),
            docDel: s('cf_doc_del'), docAl: s('cf_doc_al'),
            exentas: n('cf_exentas'), exentaNosuj: n('cf_exenta_nosuj'),
            nosujetas: n('cf_nosujetas'), gravadas: n('cf_gravadas'),
            expCa: n('cf_exp_ca'), expFuera: n('cf_exp_fuera'), expServ: n('cf_exp_serv'),
            zonas: n('cf_zonas'), terceros: n('cf_terceros'),
            total: n('cf_total'), tipoOp: s('cf_tipo_op'), tipoIng: s('cf_tipo_ing')
        };
        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoCf = esDocumentoDuplicado('cf', r, cfRecords, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoCf) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoCf, 'error'); return; }
        if (index === '-1') {
            // ═══ Guardar resolución/serie activa y fecha para próximo manual ═══
            var claseVal = s('cf_clase');
            if (claseVal !== '4') {
                _cfActiveRes.resolucion = r.resolucion;
                _cfActiveRes.serie      = r.serie;
                if (r.fecha) _cfLastManualDate = r.fecha;
            }
            cfRecords.push(r);
            saveCurrentMonthData();
            renderCfTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openCfModal(-1);
        } else {
            // ═══ Si se editó, actualizar resolución/serie activa ═══
            if (r.clase !== '4') {
                _cfActiveRes.resolucion = r.resolucion;
                _cfActiveRes.serie      = r.serie;
            }
            cfRecords[index] = r;
            saveCurrentMonthData();
            renderCfTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('cf-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + cfRecords.length;
        }
    }
    function deleteCfRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { cfRecords.splice(index, 1); saveCurrentMonthData(); renderCfTable(); });
    }
    function renderCfTable() {
        var tbody = document.getElementById('cfTableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.cf ? loadRevStates('cf') : {};
        var duplicados = _revisionActive.cf ? detectarDuplicados('cf', cfRecords) : {};
        if (_revisionActive.cf) updateRevStats('cf', revStates, duplicados, cfRecords.length);
        else clearRevStats('cf');
        cfRecords.forEach(function(r, i) {
            var esAnulado = isRegistroAnulado('cf', i);
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.cf) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else if (esAnulado) {
                row.className = 'border-b border-zinc-700/40 transition-colors';
                row.style.cssText = 'background:rgba(113,113,122,0.08);border-left:3px solid var(--rp-text-secondary);text-decoration:line-through;opacity:0.55;';
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var docId = r.docDel || r.ctrlDel || r.resolucion || '';
            var anuBadge = esAnulado && !_revisionActive.cf
                ? '<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:800;letter-spacing:0.07em;color:#fff;background:var(--rp-text-secondary);border-radius:5px;padding:2px 7px;text-decoration:none;vertical-align:middle;">✕ ANULADO</span>' +
                  (docId ? '<span style="display:block;font-size:9px;color:var(--rp-text-secondary);margin-top:2px;text-decoration:none;font-family:monospace;letter-spacing:0.03em;" title="Documento anulado: ' + docId + '">' + docId + '</span>' : '')
                : '';
            var revBadgeHtml = _revisionActive.cf ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.cf ? buildRevOverlay('cf', i, revEstado === 'duplicado', 'start') : '';
            var btnAnular = esAnulado
                ? '<button onclick="toggleAnulado(\'cf\',' + i + ')" class="p-1.5 transition" style="color:var(--rp-success);background:rgba(34,197,94,0.1);border-radius:6px;border:1px solid rgba(34,197,94,0.3);" onmouseover="this.style.background=\'rgba(34,197,94,0.2)\'" onmouseout="this.style.background=\'rgba(34,197,94,0.1)\'" title="Reactivar documento (des-anular)"><i data-lucide="rotate-ccw" class="w-4"></i></button>'
                : '<button onclick="toggleAnulado(\'cf\',' + i + ')" class="p-1.5 transition" style="color:var(--rp-text-secondary);" onmouseover="this.style.color=\'var(--rp-error)\'" onmouseout="this.style.color=\'var(--rp-text-secondary)\'" title="Anular documento"><i data-lucide="ban" class="w-4"></i></button>';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs">' + r.fecha + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.clase) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs" style="position:relative;">' + r.resolucion + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs">' + r.serie + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">' + r.ctrlDel + anuBadge + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">' + r.ctrlAl + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono whitespace-nowrap">' + r.docDel + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono whitespace-nowrap">' + r.docAl + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.maquina || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.exentas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.exentaNosuj) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.nosujetas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.gravadas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.expCa) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.expFuera) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.expServ) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.zonas) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.terceros) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right font-bold text-white">' + f(r.total) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoOp) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoIng) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">2</td>' +
                '<td class="px-4 py-3 text-xs sticky col-acciones" style="right:148px;background:' + (esAnulado && !_revisionActive.cf ? 'rgba(15,15,17,0.97)' : 'var(--rp-surface)') + ';">' +
                '<div class="flex gap-2">' +
                '<button onclick="openCfModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                btnAnular +
                '<button onclick="deleteCfRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>' +
                '<td class="px-4 py-3 text-xs dgii-col-td" style="background:' + (esAnulado && !_revisionActive.cf ? 'rgba(15,15,17,0.97)' : 'var(--rp-surface)') + ';">' + dgiiBadgeHtml(r.estadoDGII) + '</td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
        filterTable('cf');
    }
    function aplicarCodificacionCf() {
        var clientes = loadClientes();
        if (!clientes.length) { showToast('No hay clientes en el catálogo', 'error'); return; }
        var aplicados = 0;
        cfRecords.forEach(function(r) {
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