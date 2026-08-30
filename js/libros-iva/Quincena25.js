// libros-iva/Quincena25.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════
    // AGREGADO 01: QUINCENA VEINTICINCO CRUD
    // ══════════════════════════════════════════════

    // NIT/DUI son mutuamente excluyentes — al escribir uno se limpia el otro
    function onQuincena25NitInput() {
        var nitEl = document.getElementById('quincena25_nit');
        nitEl.value = nitEl.value.replace(/[^0-9]/g, '').slice(0, 14);
        if (nitEl.value) document.getElementById('quincena25_dui').value = '';
    }
    function onQuincena25DuiInput() {
        var duiEl = document.getElementById('quincena25_dui');
        duiEl.value = duiEl.value.replace(/[^0-9]/g, '').slice(0, 9);
        if (duiEl.value) document.getElementById('quincena25_nit').value = '';
    }

    function openQuincena25Modal(index) {
        if (index === undefined) index = -1;
        document.getElementById('quincena25_editIndex').value = index;
        document.getElementById('quincena25_nombre').value = '';
        document.getElementById('quincena25_nit').value = '';
        document.getElementById('quincena25_dui').value = '';
        document.getElementById('quincena25_fecha').value = '';
        document.getElementById('quincena25_salario').value = '0.00';
        document.getElementById('quincena25_monto').value = '0.00';

        // Auto-fill período con mes/año actual
        var periodoDefault = String(currentMonth + 1).padStart(2,'0') + String(currentYear);
        document.getElementById('quincena25_periodo').value = periodoDefault;

        if (index !== -1) {
            var r = quincena25Records[index];
            document.getElementById('quincena25ModalTitle').innerText = 'Editar Registro — Quincena Veinticinco';
            document.getElementById('quincena25_nombre').value  = r.nombre || '';
            document.getElementById('quincena25_nit').value     = r.nit || '';
            document.getElementById('quincena25_dui').value     = r.dui || '';
            document.getElementById('quincena25_fecha').value   = _isoFromDdmmyyyy(r.fechaPago);
            document.getElementById('quincena25_salario').value = r.salarioNominal || 0;
            document.getElementById('quincena25_monto').value   = r.montoQuincena || 0;
            document.getElementById('quincena25_periodo').value = r.periodo || '';
        } else {
            document.getElementById('quincena25ModalTitle').innerText = 'Nuevo Registro — Quincena Veinticinco';
        }
        _setModalMode('quincena25', index !== -1, quincena25Records, index);
        document.getElementById('quincena25ModalForm').style.display='flex'; document.getElementById('quincena25ModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeQuincena25Modal() { _cerrarModalAnimado('quincena25ModalForm'); }

    function navQuincena25Record(delta) {
        var cur = parseInt(document.getElementById('quincena25_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= quincena25Records.length) return;
        saveQuincena25Record();
        openQuincena25Modal(next);
    }

    function saveQuincena25Record() {
        var index = document.getElementById('quincena25_editIndex').value;
        var s = function(id) { return document.getElementById(id).value.trim(); };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        // APELLIDOS Y NOMBRES: mayúsculas, sin comas ni comillas, máx 100 caracteres
        var nombre = s('quincena25_nombre').toUpperCase().replace(/[",]/g, '').substring(0, 100);
        if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }

        var nit = s('quincena25_nit').replace(/[^0-9]/g, '').slice(0, 14);
        var dui = s('quincena25_dui').replace(/[^0-9]/g, '').slice(0, 9);
        if (nit && dui) { showToast('NIT y DUI son excluyentes — solo uno puede tener información', 'error'); return; }
        if (!nit && !dui) { showToast('Debe indicar NIT o DUI', 'error'); return; }

        var fechaIso = s('quincena25_fecha');
        if (!fechaIso) { showToast('La fecha de pago es obligatoria', 'error'); return; }
        var fechaPago = formatFecha(fechaIso); // -> dd/mm/aaaa

        var periodo = s('quincena25_periodo').replace(/[^0-9]/g, '').slice(0, 6);
        if (periodo.length !== 6) { showToast('El período debe tener formato MMAAAA (6 dígitos)', 'error'); return; }

        var r = {
            nombre:         nombre,
            nit:             nit,
            dui:             dui,
            fechaPago:       fechaPago,
            salarioNominal:  n('quincena25_salario'),
            montoQuincena:   n('quincena25_monto'),
            periodo:         periodo
        };

        var _dupPeriodoQ25 = esDocumentoDuplicado('quincena25', r, quincena25Records, index === '-1' ? null : parseInt(index));
        if (_dupPeriodoQ25) { showToast('Documento duplicado — ya existe un registro idéntico en ' + _dupPeriodoQ25, 'error'); return; }

        if (index === '-1') {
            quincena25Records.push(r);
            saveCurrentMonthData();
            renderQuincena25Table();
            syncEmpleadoDesdeQuincena25(r); // CORRECCIÓN 01: crea o actualiza el empleado en el catálogo
            showToast('Registro guardado — listo para el siguiente', 'success');
            openQuincena25Modal(-1);
        } else {
            quincena25Records[index] = r;
            saveCurrentMonthData();
            renderQuincena25Table();
            syncEmpleadoDesdeQuincena25(r); // CORRECCIÓN 01: crea o actualiza el empleado en el catálogo
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('quincena25-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + quincena25Records.length;
        }
    }

    function deleteQuincena25Record(index) {
        fsConfirm('¿Desea eliminar este registro?', function() { quincena25Records.splice(index, 1); saveCurrentMonthData(); renderQuincena25Table(); });
    }

    function renderQuincena25Table() {
        var tbody = document.getElementById('quincena25TableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        quincena25Records.forEach(function(r, i) {
            var row = document.createElement('tr');
            row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs text-white">' + (r.nombre || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + (r.nit || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-600">' + (r.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500 font-mono">' + (r.fechaPago || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(r.salarioNominal) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right text-blue-500">' + f(r.montoQuincena) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500 font-mono">' + (r.periodo || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950 col-acciones">' +
                '<div class="flex gap-2">' +
                '<button onclick="openQuincena25Modal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteQuincena25Record(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // Adaptador: normaliza un registro de Quincena Veinticinco al formato de Empleados
    // (este anexo no maneja domiciliado/país/código de ingreso/clasificación tributaria,
    // por lo que esos campos se dejan sin tocar si el empleado ya existe)
    function syncEmpleadoDesdeQuincena25(r) {
        syncEmpleadoDesdeAnexo({
            nombre:  r.nombre,
            nit:     r.nit,
            dui:     r.dui,
            salario: r.salarioNominal
        });
    }

    // ── Aplicar datos de empleado al modal de Quincena Veinticinco ──
    function _applyEmpleadoToQuincena25Modal(emp) {
        if (!emp) return;
        document.getElementById('quincena25_nombre').value = emp.nombre || '';
        document.getElementById('quincena25_nit').value    = emp.nit || '';
        document.getElementById('quincena25_dui').value    = emp.dui || '';
        if (emp.salario) document.getElementById('quincena25_salario').value = emp.salario;
    }

    // ══════════════════════════════════════════════════════════════════
    // AUTO-COMPLETAR NOMBRE DE EMPLEADO (predictivo) — Quincena Veinticinco
    // ══════════════════════════════════════════════════════════════════
    function onQuincena25NombreChange() {
        var val = document.getElementById('quincena25_nombre').value.trim();
        var listEl = document.getElementById('quincena25_ac_list');
        if (!val) { acClose('quincena25_ac_list'); return; }
        var empleados = loadEmpleados();
        var matches = empleados.filter(function(e) {
            return (e.nombre && e.nombre.toLowerCase().indexOf(val.toLowerCase()) !== -1) ||
                   (e.nit && e.nit.indexOf(val) !== -1) ||
                   (e.dui && e.dui.indexOf(val) !== -1);
        });
        var exact = empleados.find(function(e) { return e.nombre && e.nombre.toLowerCase() === val.toLowerCase(); });
        if (matches.length === 0 || (matches.length === 1 && exact)) {
            if (exact) _applyEmpleadoToQuincena25Modal(exact);
            acClose('quincena25_ac_list');
            return;
        }
        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(e) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (e.nit||e.dui||'') + '</span><span class="ac-name">' + (e.nombre||'<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() {
                _applyEmpleadoToQuincena25Modal(e);
                acClose('quincena25_ac_list');
            };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }