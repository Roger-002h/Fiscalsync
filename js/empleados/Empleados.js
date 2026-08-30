// empleados/Empleados.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // AGREGADO 02: EMPLEADOS — CATÁLOGO POR EMPRESA
    // Almacenamiento: fs_empleados_v<VERSION>_<empresaId> en localStorage
    // Independiente por empresa. Usado para auto-completar Retenciones F14
    // y Quincena Veinticinco, reutilizando la misma lógica de autocompletado
    // ya empleada por Clientes/Proveedores.
    // ══════════════════════════════════════════════════════════════════

    function empleadosKey() {
        return activeEmpresaId ? 'fs_empleados_v' + APP_VERSION + '_' + activeEmpresaId : null;
    }

    function loadEmpleados() {
        var k = empleadosKey();
        if (!k) return [];
        var raw = fsStore.getItem(k);
        if (!raw) return [];
        try { return JSON.parse(raw); } catch(e) { return []; }
    }

    function saveEmpleados(list) {
        var k = empleadosKey();
        if (!k) return;
        try { fsStore.setItem(k, JSON.stringify(list)); } catch(e) { console.warn('localStorage full', e); }
    }

    function renderEmpleadosTable() {
        var tbody = document.getElementById('empleadosTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        var countEl = document.getElementById('empleadoCount');
        var searchVal = (document.getElementById('empleadoSearch') ? document.getElementById('empleadoSearch').value.toLowerCase() : '');
        var list = loadEmpleados();
        var filtered = list.filter(function(e) {
            if (!searchVal) return true;
            return (e.nit||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (e.dui||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (e.nombre||'').toLowerCase().indexOf(searchVal) !== -1;
        });
        if (countEl) countEl.innerText = list.length + ' empleado' + (list.length !== 1 ? 's' : '');

        if (!filtered.length) {
            var emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="7" class="px-4 py-8 text-center text-xs text-zinc-600 italic">' +
                (list.length ? 'Sin resultados para la búsqueda.' : 'No hay empleados registrados. Agrégalos manualmente.') + '</td>';
            tbody.appendChild(emptyRow);
            lucide.createIcons();
            return;
        }

        var f = function(n) { return '$' + (n || 0).toFixed(2); };
        filtered.forEach(function(e) {
            var realIdx = list.indexOf(e);
            var row = document.createElement('tr');
            row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            var domLabel = e.domiciliado === '2' ? 'No Dom.' : 'Dom.';
            var clasifParts = [e.tipoOp, e.clasif, e.sector, e.tipoCosto].filter(function(v){ return v; });
            var clasifLabel = clasifParts.length ? clasifParts.join(' / ') : '<span class="text-zinc-700 italic">—</span>';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs text-white font-medium">' + (e.nombre || '<span class="text-zinc-600 italic">Sin nombre</span>') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-zinc-300">' + (e.nit || e.dui || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-400">' + domLabel + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-400 font-mono">' + (e.codIngreso || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-right">' + f(e.salario) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-400 font-mono">' + clasifLabel + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950">' +
                '<div class="flex gap-2">' +
                '<button onclick="openEmpleadoModal(' + realIdx + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteEmpleadoRecord(' + realIdx + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // NIT/DUI mutuamente excluyentes en el catálogo de Empleados (igual regla que Quincena Veinticinco)
    function onEmpleadoNitInput() {
        var nitEl = document.getElementById('empleado_nit');
        if (nitEl.value.trim()) document.getElementById('empleado_dui').value = '';
    }
    function onEmpleadoDuiInput() {
        var duiEl = document.getElementById('empleado_dui');
        if (duiEl.value.trim()) document.getElementById('empleado_nit').value = '';
    }

    function openEmpleadoModal(index) {
        if (index === undefined) index = -1;
        var list = loadEmpleados();
        document.getElementById('empleado_editIndex').value = index;
        document.getElementById('empleado_domiciliado').value = '1';
        document.getElementById('empleado_pais').value       = '';
        document.getElementById('empleado_nombre').value     = '';
        document.getElementById('empleado_nit').value        = '';
        document.getElementById('empleado_dui').value        = '';
        document.getElementById('empleado_cod_ingreso').value = '01';
        document.getElementById('empleado_salario').value    = '0.00';
        document.getElementById('empleado_tipo_op').value    = '';
        document.getElementById('empleado_clasif').value     = '';
        document.getElementById('empleado_sector').value     = '';
        document.getElementById('empleado_tipo_costo').value = '';
        if (index !== -1) {
            var e = list[index];
            if (!e) return;
            document.getElementById('empleadoModalTitle').innerText = 'Editar Empleado';
            document.getElementById('empleado_domiciliado').value = e.domiciliado || '1';
            document.getElementById('empleado_pais').value        = e.pais || '';
            document.getElementById('empleado_nombre').value       = e.nombre || '';
            document.getElementById('empleado_nit').value          = e.nit || '';
            document.getElementById('empleado_dui').value          = e.dui || '';
            document.getElementById('empleado_cod_ingreso').value  = e.codIngreso || '01';
            document.getElementById('empleado_salario').value      = e.salario || 0;
            document.getElementById('empleado_tipo_op').value      = e.tipoOp || '';
            document.getElementById('empleado_clasif').value       = e.clasif || '';
            document.getElementById('empleado_sector').value       = e.sector || '';
            document.getElementById('empleado_tipo_costo').value   = e.tipoCosto || '';
        } else {
            document.getElementById('empleadoModalTitle').innerText = 'Nuevo Empleado';
        }
        _setModalMode('empleado', index !== -1, list, index);
        document.getElementById('empleadoModalForm').style.display = 'flex';
        document.getElementById('empleadoModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeEmpleadoModal() {
        _cerrarModalAnimado('empleadoModalForm');
    }

    function navEmpleadoRecord(delta) {
        var cur = parseInt(document.getElementById('empleado_editIndex').value);
        if (isNaN(cur) || cur === -1) return;
        saveEmpleadoRecord(true);
        var list = loadEmpleados();
        var next = cur + delta;
        if (next < 0 || next >= list.length) {
            showToast(delta < 0 ? 'Ya estás en el primer empleado' : 'Ya estás en el último empleado', 'error');
            return;
        }
        openEmpleadoModal(next);
    }

    function saveEmpleadoRecord(silent) {
        var index  = parseInt(document.getElementById('empleado_editIndex').value);
        var s = function(id) { return document.getElementById(id).value.trim(); };
        var n = function(id) { return parseFloat(document.getElementById(id).value) || 0; };

        var nombre = s('empleado_nombre');
        if (!nombre) { showToast('El nombre es obligatorio', 'error'); return false; }
        var nit = s('empleado_nit').replace(/[^0-9-]/g, '');
        var dui = s('empleado_dui').replace(/[^0-9-]/g, '');
        if (nit && dui) { showToast('NIT y DUI son excluyentes — solo uno puede tener información', 'error'); return false; }
        if (!nit && !dui) { showToast('Debe indicar NIT o DUI', 'error'); return false; }

        var r = {
            domiciliado: s('empleado_domiciliado') || '1',
            pais:        s('empleado_pais'),
            nombre:      nombre,
            nit:         nit,
            dui:         dui,
            codIngreso:  s('empleado_cod_ingreso') || '01',
            salario:     n('empleado_salario'),
            tipoOp:      s('empleado_tipo_op'),
            clasif:      s('empleado_clasif'),
            sector:      s('empleado_sector'),
            tipoCosto:   s('empleado_tipo_costo')
        };

        var list = loadEmpleados();
        if (isNaN(index) || index === -1) {
            var idField = nit || dui;
            if (idField && list.some(function(e) { return (e.nit && e.nit === idField) || (e.dui && e.dui === idField); })) {
                showToast('Ya existe un empleado con ese NIT/DUI', 'error'); return false;
            }
            list.push(r);
        } else {
            if (!list[index]) return false;
            list[index] = r;
        }
        saveEmpleados(list);
        renderEmpleadosTable();

        if (!silent) {
            closeEmpleadoModal();
            showToast(isNaN(index) || index === -1 ? 'Empleado agregado' : 'Empleado actualizado', 'success');
        } else {
            showToast('Cambios guardados', 'success');
        }
        return true;
    }

    function deleteEmpleadoRecord(index) {
        fsConfirm('¿Eliminar este empleado del catálogo?\n\nSolo se elimina del catálogo, no afecta los registros ya guardados en F14 o Quincena Veinticinco.', function() {
            var list = loadEmpleados();
            list.splice(index, 1);
            saveEmpleados(list);
            renderEmpleadosTable();
            showToast('Empleado eliminado del catálogo', 'success');
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // CORRECCIÓN 01/02: SINCRONIZACIÓN DE EMPLEADOS DESDE RETENCIONES F14
    // Y QUINCENA VEINTICINCO
    // Cuando el usuario crea o edita manualmente un registro en cualquiera
    // de estos dos anexos, el sistema busca al sujeto en el catálogo de
    // Empleados en dos pasos:
    //   1) Por NIT o DUI, comparando SOLO DÍGITOS (ignora guiones/espacios,
    //      para que "0210-150263-101-3" y "02101502631013" se reconozcan
    //      como el mismo número).
    //   2) Si no hubo coincidencia por identificador, por NOMBRE exacto
    //      (normalizado) — cubre el caso de un NIT/DUI mal tipeado, o de
    //      un empleado registrado una vez con NIT y otra con DUI.
    // Si encuentra coincidencia, ACTUALIZA (sin borrar campos que ese
    // anexo no maneja, p.ej. Quincena Veinticinco no maneja clasificación
    // tributaria). Si no encuentra nada, lo CREA. En ambos casos queda
    // disponible de inmediato para el autocompletado.
    // NOTA: la coincidencia por nombre asume que dos empleados distintos
    // no comparten exactamente el mismo nombre completo dentro de la
    // misma empresa; si eso llegara a pasar, avísame para desactivarlo.
    // ══════════════════════════════════════════════════════════════════
    function normalizarIdEmpleado(v) { return (v || '').replace(/\D/g, ''); }
    function normalizarNombreEmpleado(v) { return (v || '').trim().replace(/\s+/g, ' ').toUpperCase(); }

    function syncEmpleadoDesdeAnexo(datos) {
        var nitNorm    = normalizarIdEmpleado(datos.nit);
        var duiNorm    = normalizarIdEmpleado(datos.dui);
        var nombreNorm = normalizarNombreEmpleado(datos.nombre);

        var list = loadEmpleados();
        var idx = -1;

        // Paso 1: coincidencia por NIT/DUI (solo dígitos)
        if (nitNorm || duiNorm) {
            for (var i = 0; i < list.length; i++) {
                var eNit = normalizarIdEmpleado(list[i].nit);
                var eDui = normalizarIdEmpleado(list[i].dui);
                if ((nitNorm && eNit === nitNorm) || (duiNorm && eDui === duiNorm)) { idx = i; break; }
            }
        }
        // Paso 2: respaldo por nombre exacto
        if (idx === -1 && nombreNorm) {
            for (var j = 0; j < list.length; j++) {
                if (normalizarNombreEmpleado(list[j].nombre) === nombreNorm) { idx = j; break; }
            }
        }

        if (idx !== -1) {
            var e = list[idx];
            if (datos.nombre      !== undefined) e.nombre      = datos.nombre;
            // NIT y DUI son excluyentes: si llega uno con datos, reemplaza y limpia el otro
            if (datos.nit !== undefined && datos.nit) { e.nit = datos.nit; e.dui = ''; }
            else if (datos.dui !== undefined && datos.dui) { e.dui = datos.dui; e.nit = ''; }
            if (datos.domiciliado !== undefined) e.domiciliado = datos.domiciliado;
            if (datos.pais        !== undefined) e.pais        = datos.pais;
            if (datos.codIngreso  !== undefined) e.codIngreso  = datos.codIngreso;
            if (datos.salario     !== undefined) e.salario     = datos.salario;
            if (datos.tipoOp      !== undefined) e.tipoOp      = datos.tipoOp;
            if (datos.clasif      !== undefined) e.clasif      = datos.clasif;
            if (datos.sector      !== undefined) e.sector      = datos.sector;
            if (datos.tipoCosto   !== undefined) e.tipoCosto   = datos.tipoCosto;
        } else {
            if (!nitNorm && !duiNorm) return; // sin identificador ni coincidencia por nombre: no se crea
            list.push({
                domiciliado: datos.domiciliado || '1',
                pais:        datos.pais || '',
                nombre:      datos.nombre || '',
                nit:         datos.nit || '',
                dui:         datos.dui || '',
                codIngreso:  datos.codIngreso || '01',
                salario:     datos.salario || 0,
                tipoOp:      datos.tipoOp || '',
                clasif:      datos.clasif || '',
                sector:      datos.sector || '',
                tipoCosto:   datos.tipoCosto || ''
            });
        }
        saveEmpleados(list);
        renderEmpleadosTable();
    }

    // ── Aplicar datos de empleado al modal de Retenciones F14 ──
    function _applyEmpleadoToF14Modal(emp) {
        if (!emp) return;
        if (emp.domiciliado) document.getElementById('f14_domiciliado').value = emp.domiciliado;
        if (emp.pais)        document.getElementById('f14_pais').value    = emp.pais;
        document.getElementById('f14_nombre').value = emp.nombre || '';
        document.getElementById('f14_nit').value    = emp.nit || '';
        document.getElementById('f14_dui').value    = emp.dui || '';
        if (emp.codIngreso)  document.getElementById('f14_cod_ingreso').value = emp.codIngreso;
        if (emp.salario)     document.getElementById('f14_devengado').value = emp.salario;
        if (emp.tipoOp)      document.getElementById('f14_tipo_op').value    = emp.tipoOp;
        if (emp.clasif)      document.getElementById('f14_clasif').value    = emp.clasif;
        if (emp.sector)      document.getElementById('f14_sector').value    = emp.sector;
        if (emp.tipoCosto)   document.getElementById('f14_tipo_costo').value = emp.tipoCosto;
    }