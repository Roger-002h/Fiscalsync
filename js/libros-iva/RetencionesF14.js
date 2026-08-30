// libros-iva/RetencionesF14.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.


    // AGREGADO NUEVO: Tabs F14
    function swF14(p,b){['f14-tab-sujeto','f14-tab-montos','f14-tab-deduc','f14-tab-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});['f14-btn-sujeto','f14-btn-montos','f14-btn-deduc','f14-btn-clasif'].forEach(function(i){document.getElementById(i).classList.remove('active');});document.getElementById(p).classList.add('active');document.getElementById(b).classList.add('active');}

    // ══════════════════════════════════════════════
    // AGREGADO NUEVO: RETENCIONES F14 CRUD
    // ══════════════════════════════════════════════
    function openF14Modal(index) {
        if (index === undefined) index = -1;
        document.getElementById('f14_editIndex').value = index;
        ['f14_pais','f14_nombre','f14_nit','f14_dui','f14_periodo'].forEach(function(id) { document.getElementById(id).value = ''; });
        ['f14_devengado','f14_bonificacion','f14_retenido','f14_aguinaldo_exento','f14_aguinaldo_gravado',
         'f14_afp','f14_isss','f14_inpep','f14_ipsfa','f14_cefafa','f14_bienestar','f14_isss_ivm'].forEach(function(id) { document.getElementById(id).value = '0.00'; });
        document.getElementById('f14_domiciliado').value = '1';
        document.getElementById('f14_cod_ingreso').value = '01';
        document.getElementById('f14_tipo_op').value = '1';
        document.getElementById('f14_clasif').value = '2';
        document.getElementById('f14_sector').value = '4';
        document.getElementById('f14_tipo_costo').value = '2';
        swF14('f14-tab-sujeto','f14-btn-sujeto');

        // Auto-fill período con mes/año actual
        var periodoDefault = String(currentMonth + 1).padStart(2,'0') + String(currentYear);
        document.getElementById('f14_periodo').value = periodoDefault;

        if (index !== -1) {
            var r = f14Records[index];
            document.getElementById('f14ModalTitle').innerText = 'Editar Registro — Retenciones F14';
            document.getElementById('f14_domiciliado').value = r.domiciliado || '1';
            document.getElementById('f14_pais').value = r.pais || '';
            document.getElementById('f14_nombre').value = r.nombre || '';
            document.getElementById('f14_nit').value = r.nit || '';
            document.getElementById('f14_dui').value = r.dui || '';
            document.getElementById('f14_cod_ingreso').value = r.codIngreso || '01';
            document.getElementById('f14_devengado').value = r.devengado || 0;
            document.getElementById('f14_bonificacion').value = r.bonificacion || 0;
            document.getElementById('f14_retenido').value = r.retenido || 0;
            document.getElementById('f14_aguinaldo_exento').value = r.aguinaldoExento || 0;
            document.getElementById('f14_aguinaldo_gravado').value = r.aguinaldoGravado || 0;
            document.getElementById('f14_afp').value = r.afp || 0;
            document.getElementById('f14_isss').value = r.isss || 0;
            document.getElementById('f14_inpep').value = r.inpep || 0;
            document.getElementById('f14_ipsfa').value = r.ipsfa || 0;
            document.getElementById('f14_cefafa').value = r.cefafa || 0;
            document.getElementById('f14_bienestar').value = r.bienestar || 0;
            document.getElementById('f14_isss_ivm').value = r.isssIvm || 0;
            document.getElementById('f14_tipo_op').value = r.tipoOp || '1';
            document.getElementById('f14_clasif').value = r.clasif || '2';
            document.getElementById('f14_sector').value = r.sector || '4';
            document.getElementById('f14_tipo_costo').value = r.tipoCosto || '2';
            document.getElementById('f14_periodo').value = r.periodo || '';
        } else {
            document.getElementById('f14ModalTitle').innerText = 'Nuevo Registro — Retenciones F14';
        }
        _setModalMode('f14', index !== -1, f14Records, index);
        document.getElementById('f14ModalForm').style.display='flex'; document.getElementById('f14ModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeF14Modal() { _cerrarModalAnimado('f14ModalForm'); }
    function navF14Record(delta) {
        var cur = parseInt(document.getElementById('f14_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= f14Records.length) return;
        var activeBtn = ['f14-btn-sujeto','f14-btn-montos','f14-btn-deduc','f14-btn-clasif'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'f14-btn-sujeto':'f14-tab-sujeto','f14-btn-montos':'f14-tab-montos','f14-btn-deduc':'f14-tab-deduc','f14-btn-clasif':'f14-tab-clasif'};
        saveF14Record();
        openF14Modal(next);
        if (activeBtn && tabMap[activeBtn]) swF14(tabMap[activeBtn], activeBtn);
    }

    function saveF14Record() {
        var index = document.getElementById('f14_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var nombre = s('f14_nombre').trim();
        if (!nombre) { showToast('El nombre es obligatorio', 'error'); swF14('f14-tab-sujeto','f14-btn-sujeto'); return; }

        var r = {
            domiciliado:     s('f14_domiciliado'),
            pais:            s('f14_pais'),
            nombre:          nombre,
            nit:             s('f14_nit'),
            dui:             s('f14_dui'),
            codIngreso:      s('f14_cod_ingreso'),
            devengado:       n('f14_devengado'),
            bonificacion:    n('f14_bonificacion'),
            retenido:        n('f14_retenido'),
            aguinaldoExento: n('f14_aguinaldo_exento'),
            aguinaldoGravado:n('f14_aguinaldo_gravado'),
            afp:             n('f14_afp'),
            isss:            n('f14_isss'),
            inpep:           n('f14_inpep'),
            ipsfa:           n('f14_ipsfa'),
            cefafa:          n('f14_cefafa'),
            bienestar:       n('f14_bienestar'),
            isssIvm:         n('f14_isss_ivm'),
            tipoOp:          s('f14_tipo_op'),
            clasif:          s('f14_clasif'),
            sector:          s('f14_sector'),
            tipoCosto:       s('f14_tipo_costo'),
            periodo:         s('f14_periodo')
        };

        // CAMBIO 02/03: validación de documentos duplicados (misma lógica docFingerprint
        // que ya usa el sistema para JSON), ahora también para el registro manual.
        var _dupPeriodoF14 = esDocumentoDuplicado('f14', r, f14Records, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoF14) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoF14, 'error'); return; }

        if (index === '-1') {
            f14Records.push(r);
            saveCurrentMonthData();
            renderF14Table();
            syncEmpleadoDesdeF14(r); // CORRECCIÓN 01/02: crea o actualiza el empleado en el catálogo
            showToast('Registro guardado — listo para el siguiente', 'success');
            openF14Modal(-1);
        } else {
            f14Records[index] = r;
            saveCurrentMonthData();
            renderF14Table();
            syncEmpleadoDesdeF14(r); // CORRECCIÓN 01/02: crea o actualiza el empleado en el catálogo
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('f14-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + f14Records.length;
        }
    }

    function deleteF14Record(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { f14Records.splice(index, 1); saveCurrentMonthData(); renderF14Table(); });
    }

    function renderF14Table() {
        var tbody = document.getElementById('f14TableBody');
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        var revStates  = _revisionActive.f14 ? loadRevStates('f14') : {};
        var duplicados = _revisionActive.f14 ? detectarDuplicados('f14', f14Records) : {};
        if (_revisionActive.f14) updateRevStats('f14', revStates, duplicados, f14Records.length);
        else clearRevStats('f14');
        f14Records.forEach(function(r, i) {
            var domLabel = r.domiciliado === '1' ? 'Dom.' : 'No Dom.';
            var row = document.createElement('tr');
            var revEstado = null;
            if (_revisionActive.f14) {
                if (duplicados[i]) { revEstado = 'duplicado'; }
                else { revEstado = revStates[i] || 'pendiente'; }
                row.className = 'rev-row border-b border-zinc-900/50 transition-colors rev-' + revEstado;
            } else {
                row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            }
            var revBadgeHtml   = _revisionActive.f14 ? buildRevBadge(revEstado) : '';
            var revOverlayHtml = _revisionActive.f14 ? buildRevOverlay('f14', i, revEstado === 'duplicado') : '';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs">' + domLabel + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + (r.pais || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-white">' + (r.nombre || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono" style="position:relative;">' + (r.nit || '—') + revBadgeHtml + revOverlayHtml + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.codIngreso) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.devengado) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.bonificacion) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.retenido) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.aguinaldoExento) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.aguinaldoGravado) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.afp) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.isss) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.inpep) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.ipsfa) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.cefafa) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.bienestar) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.isssIvm) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoOp) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.clasif) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.sector) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + extractNum(r.tipoCosto) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500 font-mono">' + (r.periodo || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950 col-acciones">' +
                '<div class="flex gap-2">' +
                '<button onclick="openF14Modal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteF14Record(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // Adaptador: normaliza un registro de Retenciones F14 al formato de Empleados
    function syncEmpleadoDesdeF14(r) {
        syncEmpleadoDesdeAnexo({
            domiciliado: r.domiciliado,
            pais:        r.pais,
            nombre:      r.nombre,
            nit:         r.nit,
            dui:         r.dui,
            codIngreso:  r.codIngreso,
            salario:     r.devengado,
            tipoOp:      r.tipoOp,
            clasif:      r.clasif,
            sector:      r.sector,
            tipoCosto:   r.tipoCosto
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // AUTO-COMPLETAR NOMBRE DE EMPLEADO (predictivo) — Retenciones F14
    // Reutiliza los helpers genéricos acClose()/acKeyDown() ya existentes.
    // ══════════════════════════════════════════════════════════════════
    function onF14NombreChange() {
        var val = document.getElementById('f14_nombre').value.trim();
        var listEl = document.getElementById('f14_ac_list');
        if (!val) { acClose('f14_ac_list'); return; }
        var empleados = loadEmpleados();
        var matches = empleados.filter(function(e) {
            return (e.nombre && e.nombre.toLowerCase().indexOf(val.toLowerCase()) !== -1) ||
                   (e.nit && e.nit.indexOf(val) !== -1) ||
                   (e.dui && e.dui.indexOf(val) !== -1);
        });
        var exact = empleados.find(function(e) { return e.nombre && e.nombre.toLowerCase() === val.toLowerCase(); });
        if (matches.length === 0 || (matches.length === 1 && exact)) {
            if (exact) _applyEmpleadoToF14Modal(exact);
            acClose('f14_ac_list');
            return;
        }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(e) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (e.nit||e.dui||'') + '</span><span class="ac-name">' + (e.nombre||'<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                _applyEmpleadoToF14Modal(e);
                acClose('f14_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }