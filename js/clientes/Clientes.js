// clientes/Clientes.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // Combina el resultado de la consulta pública + el cliente elegido/creado
    // en el teléfono + si la venta es exenta o no, y GUARDA DIRECTO el
    // registro en el Libro de Ventas — Crédito Fiscal (Anexo 1), sin abrir el
    // modal "Nuevo Registro — Crédito Fiscal". Mapeo (ver detalle acordado):
    //   Tipo de DTE (Comprobante de Crédito Fiscal/Nota de Crédito) -> Tipo de Documento (03/05)
    //   Fecha y Hora de Generación                                 -> Fecha de Emisión
    //   Número de Control                                          -> N° Resolución, N° Control Interno
    //   Sello de Recepción                                         -> Serie de Documento
    //   Código de Generación                                       -> N° Documento
    //   Monto Total de la Operación                                -> Ventas Gravadas Locales (o Ventas
    //                                                                  Exentas si el usuario marcó "exenta"
    //                                                                  en el teléfono antes de enviar)
    // Reutiliza la MISMA lógica de catálogo de clientes (autoRegistrarCliente)
    // y de duplicados (esDocumentoDuplicado) que ya usa el registro manual
    // (saveDebitoRecord), sin tocar la UI del modal.
    // Cambio 01 (ampliación): aplica al catálogo real de Clientes (mismo
    // storage que usa openClienteModal/saveClienteRecord) una edición hecha
    // desde el teléfono (flujo Ventas — Crédito Fiscal). clienteEditado:
    // { nitOriginal, nit, nrc, nombre, tipoOp, tipoIng } — nitOriginal
    // identifica el registro a modificar (puede diferir de nit si también
    // se corrigió el NIT). No abre ningún modal ni toca el flujo de escaneo.
    function _aplicarEdicionClienteDesdeQR(clienteEditado) {
        if (!clienteEditado || !activeEmpresaId) return;
        var nitBuscar = (clienteEditado.nitOriginal || clienteEditado.nit || '').trim();
        if (!nitBuscar) return;

        var list = loadClientes();
        var idx = list.findIndex(function(c) {
            var cNit = c.nit ? String(c.nit).trim() : '';
            var cNrc = c.nrc ? String(c.nrc).trim() : '';
            return (cNit && cNit === nitBuscar) || (cNrc && cNrc === nitBuscar);
        });
        // El teléfono solo puede editar clientes que YA están en el catálogo
        // sincronizado — si no se encuentra, no hay nada que actualizar.
        if (idx === -1) return;

        var nit     = (clienteEditado.nit || list[idx].nit || '').trim();
        var nrc     = (clienteEditado.nrc !== undefined ? clienteEditado.nrc : list[idx].nrc) || '';
        var nombre  = (clienteEditado.nombre !== undefined ? clienteEditado.nombre : list[idx].nombre) || '';
        var tipoOp  = (clienteEditado.tipoOp !== undefined ? clienteEditado.tipoOp : list[idx].tipoOp) || '';
        var tipoIng = (clienteEditado.tipoIng !== undefined ? clienteEditado.tipoIng : list[idx].tipoIng) || '';

        list[idx].nit = nit;
        list[idx].nrc = nrc;
        list[idx].nombre = nombre;
        list[idx].tipoOp = tipoOp;
        list[idx].tipoIng = tipoIng;
        saveClientes(list);

        // Propaga la nueva clasificación a los registros de Ventas — Crédito
        // Fiscal (debitoRecords) del mes activo que coincidan con este cliente —
        // mismo criterio que ya usa aplicarCodificacionDebito().
        if (nit) {
            var actualizadosCli = 0;
            debitoRecords.forEach(function(r) {
                var rNit = (r.nit || r.nrc || '').trim();
                if (rNit === nit || rNit === nrc) {
                    if (tipoOp)  { r.tipoOp  = tipoOp;  actualizadosCli++; }
                    if (tipoIng) { r.tipoIng = tipoIng; }
                }
            });
            if (actualizadosCli > 0) {
                saveCurrentMonthData();
                renderDebitoTable();
            }
        }

        // Si la tabla de Clientes está visible en este momento, se refresca.
        if (typeof renderClientesTable === 'function') renderClientesTable();

        // Reenvía el catálogo ya actualizado al teléfono, para que quede
        // sincronizado si el usuario sigue escaneando documentos de este
        // mismo cliente en la misma sesión.
        if (window.qrScan && window.qrScan.actualizarClientes) window.qrScan.actualizarClientes(loadClientes());

        showToast('Cliente actualizado desde el teléfono', 'success');
    }

    // ══════════════════════════════════════════════════════════════════
    // CLIENTES — CATÁLOGO POR EMPRESA
    // ══════════════════════════════════════════════════════════════════
    function clientesKey() {
        return activeEmpresaId ? 'fs_clientes_v' + APP_VERSION + '_' + activeEmpresaId : null;
    }

    function loadClientes() {
        var k = clientesKey();
        if (!k) return [];
        var raw = fsStore.getItem(k);
        if (!raw) return [];
        try { return JSON.parse(raw); } catch(e) { return []; }
    }

    function saveClientes(list) {
        var k = clientesKey();
        if (!k) return;
        try { fsStore.setItem(k, JSON.stringify(list)); } catch(e) {}
    }

    // Registrar cliente automáticamente si no existe (por NIT/identificador). Retorna true si fue agregado.
    function autoRegistrarCliente(nit, nombre, nrc) {
        if (!nit || !activeEmpresaId) return false;
        var list = loadClientes();
        var existe = list.some(function(c) { return c.nit === nit; });
        if (existe) return false;
        list.push({ nit: nit, nrc: nrc || '', nombre: nombre || '' });
        saveClientes(list);
        return true;
    }

    // Buscar cliente por NIT, DUI o NRC — devuelve el objeto cliente o null
    function buscarClientePorId(val) {
        if (!val || !activeEmpresaId) return null;
        var list = loadClientes();
        return list.find(function(c) {
            return (c.nit && c.nit === val) || (c.nrc && c.nrc === val);
        }) || null;
    }

    function renderClientesTable() {
        var tbody = document.getElementById('clientesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        var countEl = document.getElementById('clienteCount');
        var searchVal = (document.getElementById('clienteSearch') ? document.getElementById('clienteSearch').value.toLowerCase() : '');
        var list = loadClientes();
        var filtered = list.filter(function(c) {
            if (!searchVal) return true;
            return (c.nit||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (c.nrc||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (c.nombre||'').toLowerCase().indexOf(searchVal) !== -1;
        });
        if (countEl) countEl.innerText = list.length + ' cliente' + (list.length !== 1 ? 's' : '');

        if (!filtered.length) {
            var emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="3" class="px-4 py-8 text-center text-xs text-zinc-600 italic">' +
                (list.length ? 'Sin resultados para la búsqueda.' : 'No hay clientes registrados. Agrégalos manualmente.') + '</td>';
            tbody.appendChild(emptyRow);
            lucide.createIcons();
            return;
        }

        filtered.forEach(function(c) {
            var realIdx = list.indexOf(c);
            var row = document.createElement('tr');
            row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            var tipoOpLabel = c.tipoOp ? c.tipoOp : '<span class="text-zinc-700 italic">—</span>';
            var tipoIngLabel = c.tipoIng ? c.tipoIng : '<span class="text-zinc-700 italic">—</span>';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs font-mono text-white">' + (c.nit || '—') + (c.nrc ? '<br><span class="text-zinc-500">NRC: ' + c.nrc + '</span>' : '') + '</td>' +
                '<td class="px-4 py-3 text-xs text-white font-medium">' + (c.nombre || '<span class="text-zinc-600 italic">Sin nombre</span>') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-400 font-mono">' + tipoOpLabel + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-400 font-mono">' + tipoIngLabel + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950">' +
                '<div class="flex gap-2">' +
                '<button onclick="openClienteModal(' + realIdx + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteClienteRecord(' + realIdx + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    function openClienteModal(index) {
        if (index === undefined) index = -1;
        var list = loadClientes();
        document.getElementById('cliente_editIndex').value = index;
        document.getElementById('cliente_nit').value    = '';
        document.getElementById('cliente_nrc').value    = '';
        document.getElementById('cliente_nombre').value  = '';
        document.getElementById('cliente_tipoOp').value  = '';
        document.getElementById('cliente_tipoIng').value = '';
        if (index !== -1) {
            var c = list[index];
            if (!c) return;
            document.getElementById('clienteModalTitle').innerText = 'Editar Cliente';
            document.getElementById('cliente_nit').value    = c.nit    || '';
            document.getElementById('cliente_nrc').value    = c.nrc    || '';
            document.getElementById('cliente_nombre').value = c.nombre || '';
            document.getElementById('cliente_tipoOp').value  = c.tipoOp  || '';
            document.getElementById('cliente_tipoIng').value = c.tipoIng || '';
        } else {
            document.getElementById('clienteModalTitle').innerText = 'Nuevo Cliente';
        }
        _setModalMode('cliente', index !== -1, list, index);
        document.getElementById('clienteModalForm').style.display = 'flex';
        document.getElementById('clienteModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function navClienteRecord(delta) {
        var cur  = parseInt(document.getElementById('cliente_editIndex').value);
        var list = loadClientes();
        var next = cur + delta;
        if (next < 0 || next >= list.length) return;
        saveClienteRecord();
        openClienteModal(next);
    }

    function closeClienteModal() {
        _cerrarModalAnimado('clienteModalForm');
    }

    function saveClienteRecord() {
        var index  = parseInt(document.getElementById('cliente_editIndex').value);
        var nit    = document.getElementById('cliente_nit').value.trim();
        var nrc    = document.getElementById('cliente_nrc').value.trim();
        var nombre = document.getElementById('cliente_nombre').value.trim();
        var tipoOp  = document.getElementById('cliente_tipoOp').value;
        var tipoIng = document.getElementById('cliente_tipoIng').value;
        if (!nit && !nrc && !nombre) { showToast('Ingresa al menos el identificador o el nombre', 'error'); return; }
        var list = loadClientes();
        if (isNaN(index) || index === -1) {
            if (nit && list.some(function(c) { return c.nit === nit; })) {
                showToast('Ya existe un cliente con ese identificador', 'error'); return;
            }
            list.push({ nit: nit, nrc: nrc, nombre: nombre, tipoOp: tipoOp, tipoIng: tipoIng });
            showToast('Cliente agregado', 'success');
        } else {
            if (!list[index]) return;
            list[index].nit    = nit;
            list[index].nrc    = nrc;
            list[index].nombre = nombre;
            list[index].tipoOp  = tipoOp;
            list[index].tipoIng = tipoIng;
            showToast('Cliente actualizado', 'success');
        }
        saveClientes(list);
        renderClientesTable();
        closeClienteModal();
    }

    function deleteClienteRecord(index) {
        fsConfirm('¿Eliminar este cliente del catálogo?', function() {
            var list = loadClientes();
            list.splice(index, 1);
            saveClientes(list);
            renderClientesTable();
            showToast('Cliente eliminado', 'success');
        });
    }