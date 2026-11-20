// inventario-fisico/InventarioFisico.js
// ══════════════════════════════════════════════════════════════════════
// AGREGADO 01 — ANEXO ESPECIAL: "Inventario Físico de Bienes de Activo
// Realizable o Corriente".
//
// Anexo ANUAL (no mensual): los datos se guardan por empresa + ejercicio
// fiscal en la clave  fs_inv_v<APP_VERSION>_<empresaId>_<año>,  por lo que
// NO dependen del selector de mes ni de saveCurrentMonthData().
//
// Estructura del archivo exportado (9 columnas, SIN encabezados):
//   A Denominación y descripción (texto, máx 50)
//   B Código de inventario        (texto, máx 25)
//   C Unidad de medida            (texto o número, máx 25)
//   D Total de unidades           (12 enteros, 10 decimales)
//   E Costo unitario neto sin IVA (12 enteros, 10 decimales)
//   F Costo total = D * E         (12 enteros, 10 decimales; editable)
//   G Categoría del bien          (01-04)
//   H Referencia en libros        (01-03)
//   I Ejercicio fiscal            (4 dígitos)
//
// Reutiliza: fsStore, fsConfirm, showToast, escHtml, filterTable,
// buildCSV/downloadCSV (ImportacionCSV.js), _setModalMode y
// _cerrarModalAnimado (mismos helpers que usa Quincena25).
// ══════════════════════════════════════════════════════════════════════

    var INV_CATEGORIAS  = { '01': 'Productos terminados', '02': 'Productos en proceso', '03': 'Materia prima', '04': 'Bienes para la construcción' };
    var INV_REFERENCIAS = { '01': 'Costos', '02': 'Retaceos', '03': 'Compras locales' };

    // ── Persistencia anual por empresa ──
    function inventarioKey(empId, anio) {
        return 'fs_inv_v' + APP_VERSION + '_' + empId + '_' + anio;
    }

    function _invLeerAnio(empId, anio) {
        var raw = fsStore.getItem(inventarioKey(empId, anio));
        if (!raw) return [];
        try { var d = JSON.parse(raw); return Array.isArray(d) ? d : []; } catch (e) { return []; }
    }

    function inventarioCargar() {
        if (inventarioAnio === null) inventarioAnio = currentYear;
        inventarioRecords = activeEmpresaId ? _invLeerAnio(activeEmpresaId, inventarioAnio) : [];
    }

    function inventarioGuardar() {
        if (!activeEmpresaId) return;
        try { fsStore.setItem(inventarioKey(activeEmpresaId, inventarioAnio), JSON.stringify(inventarioRecords)); }
        catch (e) { console.warn('No se pudo guardar el inventario', e); }
    }

    function inventarioContar() { inventarioCargar(); return inventarioRecords.length; }

    // ── Utilidades numéricas ──
    function _invNumStr(n) {            // número -> texto sin ceros sobrantes (hasta 10 decimales)
        var s = (Number(n) || 0).toFixed(10).replace(/\.?0+$/, '');
        return s === '' ? '0' : s;
    }
    function _invFmtExport(n) {         // para el CSV: mínimo 2 decimales, máximo 10
        var p = (Number(n) || 0).toFixed(10).split('.');
        var dec = p[1].replace(/0+$/, '');
        while (dec.length < 2) dec += '0';
        return p[0] + '.' + dec;
    }
    function _invMoneda(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function _invEnterosOk(n) { return Math.floor(Math.abs(n)).toString().length <= 12; }
    function _invCalcTotal(d, e) { return parseFloat((d * e).toFixed(10)); }

    // Solo dígitos y un punto; máx 12 enteros y 10 decimales mientras se escribe
    function _invSanitizarDecimal(el) {
        var v = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
        var p = v.split('.');
        var ent = p[0].slice(0, 12);
        v = p.length > 1 ? ent + '.' + p.slice(1).join('').slice(0, 10) : ent;
        if (el.value !== v) el.value = v;
    }

    // ── Cálculo automático de F (se respeta el valor manual) ──
    function onInventarioDEInput(el) {
        _invSanitizarDecimal(el);
        if (document.getElementById('inventario_fManual').value === '1') return;
        _invRecalcularTotalModal();
    }

    function _invRecalcularTotalModal() {
        var dStr = document.getElementById('inventario_unidades').value;
        var eStr = document.getElementById('inventario_costoUnit').value;
        var out = document.getElementById('inventario_costoTotal');
        if (dStr === '' || eStr === '') { out.value = ''; return; }
        out.value = _invNumStr(_invCalcTotal(parseFloat(dStr) || 0, parseFloat(eStr) || 0));
    }

    function onInventarioTotalInput(el) {
        _invSanitizarDecimal(el);
        document.getElementById('inventario_fManual').value = '1';
    }

    function inventarioRecalcularTotal() {
        document.getElementById('inventario_fManual').value = '0';
        _invRecalcularTotalModal();
    }

    // ── Pantalla ──
    function inventarioFisicoOnEnter() {
        if (inventarioAnio === null) inventarioAnio = currentYear;
        var inp = document.getElementById('inventario_anioInput');
        if (inp) inp.value = inventarioAnio;
        inventarioCargar();
        renderInventarioTable();
    }

    function inventarioCambiarAnio() {
        var inp = document.getElementById('inventario_anioInput');
        var y = parseInt(inp.value, 10);
        if (!(y >= 2000 && y <= 2100)) {
            showToast('El ejercicio fiscal debe tener 4 dígitos (2000-2100)', 'error');
            inp.value = inventarioAnio;
            return;
        }
        inventarioAnio = y;
        inventarioCargar();
        renderInventarioTable();
    }

    function renderInventarioTable() {
        var tbody = document.getElementById('inventarioTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        var total = 0;
        inventarioRecords.forEach(function(r, i) {
            total += Number(r.costoTotal) || 0;
            var row = document.createElement('tr');
            row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs text-white">' + escHtml(r.denominacion) + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + escHtml(r.codigo) + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + escHtml(r.unidad) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right font-mono">' + _invNumStr(r.unidades) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right font-mono">' + _invNumStr(r.costoUnit) + '</td>' +
                '<td class="px-4 py-3 text-xs text-right font-mono text-blue-500">' + _invNumStr(r.costoTotal) + (r.fManual ? ' <span title="Valor ingresado manualmente" class="text-amber-500">*</span>' : '') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + escHtml(r.categoria) + ' — ' + escHtml(INV_CATEGORIAS[r.categoria] || '') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + escHtml(r.referencia) + ' — ' + escHtml(INV_REFERENCIAS[r.referencia] || '') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500 font-mono">' + inventarioAnio + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950 col-acciones">' +
                '<div class="flex gap-2">' +
                '<button onclick="openInventarioModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteInventarioRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        var st = document.getElementById('inventarioStats');
        if (st) st.textContent = inventarioRecords.length + ' bien(es) — Costo total del inventario: ' + _invMoneda(total);
        if (typeof filterTable === 'function') filterTable('inventario');
        lucide.createIcons();
    }

    // ── Modal alta / edición ──
    function openInventarioModal(index) {
        if (!activeEmpresaId) { showToast('No hay una empresa activa seleccionada', 'error'); return; }
        if (index === undefined) index = -1;
        document.getElementById('inventario_editIndex').value = index;
        ['denominacion', 'codigo', 'unidad', 'unidades', 'costoUnit', 'costoTotal'].forEach(function(k) {
            document.getElementById('inventario_' + k).value = '';
        });
        document.getElementById('inventario_fManual').value = '0';
        document.getElementById('inventario_categoria').value = '';
        document.getElementById('inventario_referencia').value = '';
        document.getElementById('inventario_ejercicio').value = inventarioAnio;

        if (index !== -1) {
            var r = inventarioRecords[index];
            document.getElementById('inventarioModalTitle').innerText = 'Editar Bien — Inventario Físico';
            document.getElementById('inventario_denominacion').value = r.denominacion || '';
            document.getElementById('inventario_codigo').value       = r.codigo || '';
            document.getElementById('inventario_unidad').value       = r.unidad || '';
            document.getElementById('inventario_unidades').value     = _invNumStr(r.unidades);
            document.getElementById('inventario_costoUnit').value    = _invNumStr(r.costoUnit);
            document.getElementById('inventario_costoTotal').value   = _invNumStr(r.costoTotal);
            document.getElementById('inventario_fManual').value      = r.fManual ? '1' : '0';
            document.getElementById('inventario_categoria').value    = r.categoria || '';
            document.getElementById('inventario_referencia').value   = r.referencia || '';
        } else {
            document.getElementById('inventarioModalTitle').innerText = 'Nuevo Bien — Inventario Físico';
        }
        _setModalMode('inventario', index !== -1, inventarioRecords, index);
        document.getElementById('inventarioModalForm').style.display = 'flex';
        document.getElementById('inventarioModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeInventarioModal() { _cerrarModalAnimado('inventarioModalForm'); }

    function navInventarioRecord(delta) {
        var cur = parseInt(document.getElementById('inventario_editIndex').value, 10);
        var next = cur + delta;
        if (next < 0 || next >= inventarioRecords.length) return;
        if (!saveInventarioRecord()) return;
        openInventarioModal(next);
    }

    function _invValidaNum(str, nombre) {
        if (!/^\d{1,12}(\.\d{1,10})?$/.test(str)) return { error: nombre + ': ingrese un número válido (hasta 12 enteros y 10 decimales)' };
        return { n: parseFloat(str) };
    }

    // Devuelve true si guardó correctamente
    function saveInventarioRecord() {
        var index = document.getElementById('inventario_editIndex').value;
        var s = function(id) { return document.getElementById(id).value.trim(); };

        var denominacion = s('inventario_denominacion').replace(/[;"]/g, ' ').substring(0, 50);
        var codigo       = s('inventario_codigo').replace(/[;"]/g, ' ').substring(0, 25);
        var unidad       = s('inventario_unidad').replace(/[;"]/g, ' ').substring(0, 25);
        if (!denominacion) { showToast('La denominación del bien es obligatoria', 'error'); return false; }
        if (!codigo)       { showToast('El código de inventario es obligatorio', 'error'); return false; }
        if (!unidad)       { showToast('La unidad de medida es obligatoria', 'error'); return false; }

        var vd = _invValidaNum(s('inventario_unidades'), 'Total de unidades');
        if (vd.error) { showToast(vd.error, 'error'); return false; }
        var ve = _invValidaNum(s('inventario_costoUnit'), 'Costo unitario');
        if (ve.error) { showToast(ve.error, 'error'); return false; }

        var fManual = document.getElementById('inventario_fManual').value === '1';
        var fStr = s('inventario_costoTotal');
        var total;
        if (fManual && fStr !== '') {
            var vf = _invValidaNum(fStr, 'Costo total');
            if (vf.error) { showToast(vf.error, 'error'); return false; }
            total = vf.n;
        } else {
            fManual = false;
            total = _invCalcTotal(vd.n, ve.n);
        }
        if (!_invEnterosOk(total)) { showToast('Costo total: excede 12 enteros', 'error'); return false; }

        var categoria  = s('inventario_categoria');
        var referencia = s('inventario_referencia');
        if (!INV_CATEGORIAS[categoria])   { showToast('Seleccione la categoría del bien', 'error'); return false; }
        if (!INV_REFERENCIAS[referencia]) { showToast('Seleccione la referencia en libros', 'error'); return false; }

        var r = { denominacion: denominacion, codigo: codigo, unidad: unidad, unidades: vd.n, costoUnit: ve.n,
                  costoTotal: total, fManual: fManual, categoria: categoria, referencia: referencia };

        var editIdx = index === '-1' ? -1 : parseInt(index, 10);
        var dup = inventarioRecords.some(function(x, i) {
            return i !== editIdx && String(x.codigo).toLowerCase() === codigo.toLowerCase() &&
                   x.categoria === categoria && x.referencia === referencia;
        });
        if (dup) { showToast('Ya existe un registro con ese código, categoría y referencia en este ejercicio', 'error'); return false; }

        if (editIdx === -1) {
            inventarioRecords.push(r);
            inventarioGuardar();
            renderInventarioTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openInventarioModal(-1);
        } else {
            inventarioRecords[editIdx] = r;
            inventarioGuardar();
            renderInventarioTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('inventario-nav-pos');
            if (pos) pos.innerText = (editIdx + 1) + ' / ' + inventarioRecords.length;
        }
        return true;
    }

    function deleteInventarioRecord(index) {
        fsConfirm('¿Desea eliminar este registro?', function() {
            inventarioRecords.splice(index, 1);
            inventarioGuardar();
            renderInventarioTable();
        });
    }

    function inventarioBorrarTodo() {
        if (!activeEmpresaId) { showToast('No hay una empresa activa seleccionada', 'error'); return; }
        if (!inventarioRecords.length) { showToast('No hay registros para borrar', 'error'); return; }
        fsConfirm('¿Desea borrar TODO el Inventario Físico del ejercicio ' + inventarioAnio + ' de esta empresa?', function() {
            inventarioRecords = [];
            inventarioGuardar();
            renderInventarioTable();
            showToast('Inventario del ejercicio ' + inventarioAnio + ' borrado', 'success');
        });
    }

    // ── Exportación (la usa exportCSV('inventario') en ImportacionCSV.js) ──
    function inventarioFilasExport() {
        if (!activeEmpresaId) { showToast('No hay una empresa activa seleccionada', 'error'); return null; }
        inventarioCargar();
        if (!inventarioRecords.length) { showToast('No hay registros de inventario en el ejercicio ' + inventarioAnio, 'error'); return null; }
        var rows = inventarioRecords.map(function(r) { return [
            r.denominacion || '',
            r.codigo || '',
            r.unidad || '',
            _invFmtExport(r.unidades),
            _invFmtExport(r.costoUnit),
            _invFmtExport(r.costoTotal),
            r.categoria || '',
            r.referencia || '',
            String(inventarioAnio)
        ]; });
        return { rows: rows, anio: inventarioAnio };
    }

    // ── Importación desde CSV (solo .csv) ──
    function inventarioAbrirImportar() {
        if (!activeEmpresaId) { showToast('No hay una empresa activa seleccionada', 'error'); return; }
        var input = document.getElementById('inventarioCsvInput');
        if (input) input.click();
    }

    function _invParseLinea(line, delim) {
        var out = [], cur = '', q = false;
        for (var i = 0; i < line.length; i++) {
            var c = line[i];
            if (q) {
                if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += c;
            } else if (c === '"') q = true;
            else if (c === delim) { out.push(cur); cur = ''; }
            else cur += c;
        }
        out.push(cur);
        return out.map(function(x) { return x.trim(); });
    }

    function _invNumCsv(v, coma) {
        v = String(v).trim();
        if (coma) v = v.replace(',', '.');
        return /^\d{1,12}(\.\d{1,10})?$/.test(v) ? parseFloat(v) : null;
    }

    function _invFilaCsv(c, coma) {
        if (c.length < 9) return { error: 'tiene ' + c.length + ' columnas (se esperan 9)' };
        var den = c[0], cod = c[1], uni = c[2];
        if (!den || den.length > 50) return { error: 'columna A vacía o mayor a 50 caracteres' };
        if (!cod || cod.length > 25) return { error: 'columna B vacía o mayor a 25 caracteres' };
        if (!uni || uni.length > 25) return { error: 'columna C vacía o mayor a 25 caracteres' };
        var d = _invNumCsv(c[3], coma), e = _invNumCsv(c[4], coma);
        if (d === null) return { error: 'columna D no es un número válido' };
        if (e === null) return { error: 'columna E no es un número válido' };
        var calc = _invCalcTotal(d, e), f = calc, manual = false;
        if (String(c[5]).trim() !== '') {
            f = _invNumCsv(c[5], coma);
            if (f === null) return { error: 'columna F no es un número válido' };
            manual = Math.abs(f - calc) > 0.000001;
        }
        if (!_invEnterosOk(f)) return { error: 'columna F excede 12 enteros' };
        var g = String(c[6]).padStart(2, '0'), h = String(c[7]).padStart(2, '0');
        if (!INV_CATEGORIAS[g])  return { error: 'columna G (categoría) debe ser 01-04' };
        if (!INV_REFERENCIAS[h]) return { error: 'columna H (referencia) debe ser 01-03' };
        if (!/^\d{4}$/.test(c[8])) return { error: 'columna I (ejercicio) debe tener 4 dígitos' };
        return { anio: parseInt(c[8], 10), rec: { denominacion: den.replace(/[;"]/g, ' '), codigo: cod.replace(/[;"]/g, ' '),
            unidad: uni.replace(/[;"]/g, ' '), unidades: d, costoUnit: e, costoTotal: f, fManual: manual, categoria: g, referencia: h } };
    }

    function handleInventarioCsvFile(file) {
        var inputEl = document.getElementById('inventarioCsvInput');
        var limpiar = function() { if (inputEl) inputEl.value = ''; };
        if (!file) return;
        if (!/\.csv$/i.test(file.name)) { showToast('Solo se permiten archivos .csv', 'error'); limpiar(); return; }

        var leer = function(enc, cb) {
            var rd = new FileReader();
            rd.onload = function(ev) { cb(ev.target.result); };
            rd.onerror = function() { showToast('No se pudo leer el archivo seleccionado', 'error'); limpiar(); };
            rd.readAsText(file, enc);
        };
        leer('utf-8', function(txt) {
            if (txt.indexOf('\uFFFD') !== -1) { leer('windows-1252', _procesar); } else { _procesar(txt); }
        });

        function _procesar(txt) {
            txt = txt.replace(/^\uFEFF/, '');
            var lines = txt.split(/\r?\n/).filter(function(l) { return l.trim() !== ''; });
            if (!lines.length) { showToast('El archivo está vacío', 'error'); limpiar(); return; }
            var delim = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
            var coma = delim === ';';
            var porAnio = {}, errores = [], total = 0;
            lines.forEach(function(line, idx) {
                var cols = _invParseLinea(line, delim);
                // Tolera una fila de encabezados (el formato oficial no los lleva)
                if (idx === 0 && _invNumCsv(cols[3] || '', coma) === null && cols.length >= 9) return;
                var res = _invFilaCsv(cols, coma);
                if (res.error) { errores.push('Fila ' + (idx + 1) + ': ' + res.error); return; }
                (porAnio[res.anio] = porAnio[res.anio] || []).push(res.rec);
                total++;
            });
            if (!total) {
                showToast('No se importó ningún registro', 'error', { title: 'Importación de Inventario', details: errores.slice(0, 5).join(' | ') });
                limpiar(); return;
            }
            var anios = Object.keys(porAnio).sort().join(', ');
            var msg = 'Se importarán ' + total + ' registro(s) del Inventario Físico (ejercicio ' + anios + ') hacia la empresa activa.' +
                      (errores.length ? '\n' + errores.length + ' fila(s) con error serán omitidas.' : '') +
                      '\nLos registros con el mismo código, categoría y referencia ya existentes no se duplican.\n¿Deseas continuar?';
            fsConfirm(msg, function() {
                var agregados = 0, omitidos = 0;
                Object.keys(porAnio).forEach(function(y) {
                    var lista = _invLeerAnio(activeEmpresaId, y);
                    porAnio[y].forEach(function(r) {
                        var existe = lista.some(function(x) {
                            return String(x.codigo).toLowerCase() === r.codigo.toLowerCase() && x.categoria === r.categoria && x.referencia === r.referencia;
                        });
                        if (existe) { omitidos++; return; }
                        lista.push(r); agregados++;
                    });
                    try { fsStore.setItem(inventarioKey(activeEmpresaId, y), JSON.stringify(lista)); } catch (e) { console.warn(e); }
                });
                inventarioCargar();
                renderInventarioTable();
                showToast(agregados + ' registro(s) importados' + (omitidos ? ' (' + omitidos + ' ya existían)' : '') + (errores.length ? ' — ' + errores.length + ' con error' : ''),
                    agregados ? 'success' : 'error',
                    errores.length ? { title: 'Importación de Inventario', details: errores.slice(0, 5).join(' | ') } : undefined);
                limpiar();
            });
        }
    }
