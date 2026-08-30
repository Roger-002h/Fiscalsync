// proveedores/Proveedores.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // Registra en el catálogo de proveedores, en un solo lote, todos los NIT/NRC
    // presentes en `records` que aún no existan (misma lógica de coincidencia y
    // de completado de datos que autoRegistrarProveedor, pero con una sola
    // lectura y una sola escritura a localStorage, en vez de una por registro).
    // AGREGADO — CAMBIO 02: `tipoVal` (compras/retenido/excluido) identifica el
    // anexo desde el que se importa, para marcar automáticamente ese anexo en
    // la clasificación `usos` del proveedor (sin afectar Compras, cuyo
    // comportamiento previo — proveedor sin `usos` — se preserva igual).
    function _autoRegistrarProveedoresBatch(records, tipoVal) {
        if (!activeEmpresaId) return 0;
        var usoAnexoMap = { compras: 'compras', retenido: 'retenido', excluido: 'excluido' };
        var usoAnexo = usoAnexoMap[tipoVal] || null;
        var list = loadProveedores();
        var byNit = {}, byNrc = {};
        list.forEach(function(p, i) {
            var pNit = p.nit ? String(p.nit).trim() : '';
            var pNrc = p.nrc ? String(p.nrc).trim() : '';
            if (pNit) byNit[pNit] = i;
            if (pNrc) byNrc[pNrc] = i;
        });
        var nuevos = 0;
        var cambiado = false;
        records.forEach(function(r) {
            var nitProv = (r.nit || r.identificacion || '').toString().trim();
            var nrcProv = (r.nrc || '').toString().trim();
            if (!nitProv) return;
            var idx = (nitProv && byNit[nitProv] !== undefined) ? byNit[nitProv] :
                      (nrcProv && byNrc[nrcProv] !== undefined) ? byNrc[nrcProv] : -1;
            if (idx !== -1) {
                var pExist = list[idx];
                if (!pExist.nit && nitProv)   { pExist.nit = nitProv; cambiado = true; }
                if (!pExist.nrc && nrcProv)   { pExist.nrc = nrcProv; cambiado = true; }
                if (!pExist.dui && r.dui)     { pExist.dui = r.dui; cambiado = true; }
                if (!pExist.nombre && r.nombre) { pExist.nombre = r.nombre; cambiado = true; }
                if (usoAnexo) {
                    var usosExist = proveedorUsosEfectivos(pExist);
                    if (usosExist.indexOf(usoAnexo) === -1) { usosExist.push(usoAnexo); pExist.usos = usosExist; cambiado = true; }
                }
            } else {
                var nuevoProv = { nit: nitProv, nrc: nrcProv, dui: r.dui || '', nombre: r.nombre || '', clasif: '', sector: '', tipoCosto: '' };
                if (usoAnexo) nuevoProv.usos = [usoAnexo];
                list.push(nuevoProv);
                var newIdx = list.length - 1;
                if (nitProv) byNit[nitProv] = newIdx;
                if (nrcProv) byNrc[nrcProv] = newIdx;
                nuevos++;
                cambiado = true;
            }
        });
        if (cambiado) saveProveedores(list);
        return nuevos;
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO: PROVEEDORES — CATÁLOGO POR EMPRESA
    // Almacenamiento: fs_proveedores_<empresaId> en localStorage
    // Independiente por empresa; clasif/sector/tipoCosto opcionales
    // ══════════════════════════════════════════════════════════════════

    function proveedoresKey() {
        return activeEmpresaId ? 'fs_prov_v' + APP_VERSION + '_' + activeEmpresaId : null;
    }

    function loadProveedores() {
        var k = proveedoresKey();
        if (!k) return [];
        var raw = fsStore.getItem(k);
        if (!raw) return [];
        try { return JSON.parse(raw); } catch(e) { return []; }
    }

    function saveProveedores(list) {
        var k = proveedoresKey();
        if (!k) return;
        try { fsStore.setItem(k, JSON.stringify(list)); } catch(e) { console.warn('localStorage full', e); }

        // Cambio — Actualización en tiempo real del Catálogo de Proveedores
        // dentro del módulo de Escaneo: este es el ÚNICO punto por el que
        // pasa cualquier cambio al catálogo (alta/edición/eliminación manual
        // desde la computadora, importación de JSON, auto-registro al
        // guardar una Compra, o los flujos que ya vienen del teléfono), así
        // que reenviar aquí el catálogo actualizado cubre todos los casos
        // sin duplicar esta llamada en cada función que guarda proveedores.
        // Si el módulo de Escaneo no está corriendo, el propio handler
        // 'qr-actualizar-catalogo' (main.js) lo ignora sin hacer nada — es
        // seguro llamarlo siempre. No cambia la lógica de creación/
        // almacenamiento de proveedores, solo notifica al teléfono si ya
        // está conectado.
        if (window.qrScan && window.qrScan.actualizarCatalogo) window.qrScan.actualizarCatalogo(list);
    }

    // Registra un proveedor si no existe (por NIT). Devuelve true si fue agregado.
    // FIX BUG: acepta opcionalmente clasif/sector/tipoCosto para que, cuando el
    // proveedor se registra (o ya existe pero aún no tiene clasificación) desde
    // el mismo proceso de guardado de un registro de Compras, la clasificación
    // asignada en ese momento quede reflejada de inmediato en el catálogo,
    // sin necesidad de un paso adicional.
    // Cambio 01 (ampliación): se agregan tres parámetros opcionales al final
    // — usos, tipoDocEx, tipoOpEx — para que un proveedor creado desde el
    // teléfono en Escanear Retención o Escanear Compras a Sujeto Excluido
    // quede guardado en la clasificación (anexo) correcta del Catálogo de
    // Proveedores, en vez de registrarse siempre como si fuera de Compras.
    // Los llamados existentes que no envían estos parámetros no cambian de
    // comportamiento (quedan como antes, undefined).
    function autoRegistrarProveedor(nit, nombre, dui, nrc, clasif, sector, tipoCosto, usos, tipoDocEx, tipoOpEx) {
        // CORRECCIÓN: antes exigía NIT sí o sí, así que un Sujeto Excluido
        // identificado solo por DUI (sin NIT/NRC — el caso normal en el
        // Libro de Sujetos Excluidos) nunca se registraba en el catálogo,
        // y por lo tanto nunca se le podía "recordar" su clasificación en
        // escaneos posteriores. Ahora basta con tener NIT, NRC o DUI.
        var nitNorm = nit ? String(nit).trim() : '';
        var nrcNorm = nrc ? String(nrc).trim() : '';
        var duiNorm = dui ? String(dui).trim() : '';
        if ((!nitNorm && !nrcNorm && !duiNorm) || !activeEmpresaId) return false;
        var list = loadProveedores();
        // AGREGADO NUEVO: normalizar y comparar también por NRC y por DUI, no
        // solo por NIT exacto, para evitar registros duplicados del mismo
        // proveedor cuando el NIT viene con formato distinto (espacios,
        // mayúsc./minúsc.) entre JSON, o cuando el proveedor solo tiene DUI
        // (Sujeto Excluido persona natural, sin NIT/NRC).
        var idx = list.findIndex(function(p) {
            var pNit = p.nit ? String(p.nit).trim() : '';
            var pNrc = p.nrc ? String(p.nrc).trim() : '';
            var pDui = p.dui ? String(p.dui).trim() : '';
            return (nitNorm && pNit && pNit === nitNorm) || (nrcNorm && pNrc && pNrc === nrcNorm) || (duiNorm && pDui && pDui === duiNorm);
        });
        if (idx !== -1) {
            // Proveedor ya existe: no crear duplicado, solo completar datos faltantes
            var pExist = list[idx];
            var cambiado = false;
            if (!pExist.nit && nitNorm)   { pExist.nit = nitNorm; cambiado = true; }
            if (!pExist.nrc && nrcNorm)   { pExist.nrc = nrcNorm; cambiado = true; }
            if (!pExist.dui && duiNorm)   { pExist.dui = duiNorm; cambiado = true; }
            if (!pExist.nombre && nombre) { pExist.nombre = nombre; cambiado = true; }
            if (!pExist.clasif && clasif)       { pExist.clasif = clasif; cambiado = true; }
            if (!pExist.sector && sector)       { pExist.sector = sector; cambiado = true; }
            if (!pExist.tipoCosto && tipoCosto) { pExist.tipoCosto = tipoCosto; cambiado = true; }
            // Cambio 01: si el proveedor ya existe pero todavía no tiene anexo
            // (usos) asignado, o le falta Tipo de Documento / Tipo de Operación
            // de Sujeto Excluido, se completan igual que los demás campos —
            // sin pisar valores que el usuario ya haya configurado.
            if (usos && usos.length && !(pExist.usos && pExist.usos.length)) { pExist.usos = usos.slice(); cambiado = true; }
            if (!pExist.tipoDocEx && tipoDocEx) { pExist.tipoDocEx = tipoDocEx; cambiado = true; }
            if (!pExist.tipoOpEx && tipoOpEx)   { pExist.tipoOpEx = tipoOpEx; cambiado = true; }
            if (cambiado) saveProveedores(list);
            return false;
        }
        var nuevoRegistro = { nit: nitNorm, nrc: nrcNorm, dui: duiNorm, nombre: nombre || '', clasif: clasif || '', sector: sector || '', tipoCosto: tipoCosto || '' };
        if (usos && usos.length) nuevoRegistro.usos = usos.slice();
        if (tipoDocEx) nuevoRegistro.tipoDocEx = tipoDocEx;
        if (tipoOpEx)  nuevoRegistro.tipoOpEx  = tipoOpEx;
        list.push(nuevoRegistro);
        saveProveedores(list);
        return true;
    }

    // Muestra el hint de proveedor vinculado en el tab clasificación de compras
    function mostrarHintProveedor(nit) {
        var hintEl = document.getElementById('cp_proveedor_hint');
        var hintTxt = document.getElementById('cp_proveedor_hint_text');
        if (!hintEl || !hintTxt) return;
        if (!nit || !activeEmpresaId) { hintEl.style.display = 'none'; return; }
        var prov = buscarProveedorPorId(nit);
        if (prov) {
            var clasifLabel = prov.clasif ? prov.clasif : '—';
            hintTxt.innerText = 'Proveedor en catálogo: ' + (prov.nombre || prov.nit) + ' · Clasif: ' + clasifLabel;
            hintEl.style.display = 'flex';
        } else {
            hintEl.style.display = 'none';
        }
    }

    // Cambio 01 (ampliación): aplica al catálogo real de Proveedores (mismo
    // storage que usa openProveedorModal/saveProveedorRecord) una edición
    // hecha desde el teléfono. proveedorEditado: { nitOriginal, nit, nrc, dui,
    // nombre, clasif, sector, tipoCosto } — nitOriginal identifica el registro
    // a modificar (puede diferir de nit si también se corrigió el NIT).
    // No abre ningún modal ni toca el flujo de escaneo; solo reutiliza
    // loadProveedores/saveProveedores/aplicarClasifProveedorACompras, que ya
    // usa el resto del programa, para no duplicar lógica de negocio.
    function _aplicarEdicionProveedorDesdeQR(proveedorEditado) {
        if (!proveedorEditado || !activeEmpresaId) return;
        var nitBuscar = (proveedorEditado.nitOriginal || proveedorEditado.nit || '').trim();
        if (!nitBuscar) return;

        var list = loadProveedores();
        var idx = list.findIndex(function(p) {
            var pNit = p.nit ? String(p.nit).trim() : '';
            var pNrc = p.nrc ? String(p.nrc).trim() : '';
            return (pNit && pNit === nitBuscar) || (pNrc && pNrc === nitBuscar);
        });
        // El teléfono solo puede editar proveedores que YA están en el catálogo
        // sincronizado — si no se encuentra, no hay nada que actualizar.
        if (idx === -1) return;

        var nit       = (proveedorEditado.nit || list[idx].nit || '').trim();
        var nrc       = (proveedorEditado.nrc !== undefined ? proveedorEditado.nrc : list[idx].nrc) || '';
        var dui       = (proveedorEditado.dui !== undefined ? proveedorEditado.dui : list[idx].dui) || '';
        var nombre    = (proveedorEditado.nombre !== undefined ? proveedorEditado.nombre : list[idx].nombre) || '';
        var clasif    = (proveedorEditado.clasif !== undefined ? proveedorEditado.clasif : list[idx].clasif) || '';
        var sector    = (proveedorEditado.sector !== undefined ? proveedorEditado.sector : list[idx].sector) || '';
        var tipoCosto = (proveedorEditado.tipoCosto !== undefined ? proveedorEditado.tipoCosto : list[idx].tipoCosto) || '';

        list[idx].nit = nit;
        list[idx].nrc = nrc;
        list[idx].dui = dui;
        list[idx].nombre = nombre;
        list[idx].clasif = clasif;
        list[idx].sector = sector;
        list[idx].tipoCosto = tipoCosto;
        saveProveedores(list);

        // Propaga la nueva clasificación a los registros de Compras del mes
        // activo que coincidan con este proveedor — misma función que ya usa
        // saveProveedorRecord() al editar desde la computadora.
        if (nit) {
            var actualizados = aplicarClasifProveedorACompras(nit, clasif, sector, tipoCosto);
            if (actualizados > 0) {
                saveCurrentMonthData();
                renderComprasTable();
            }
        }

        // Si la tabla de Proveedores está visible en este momento, se refresca.
        if (typeof renderProveedoresTable === 'function') renderProveedoresTable();

        // Reenvía el catálogo ya actualizado al teléfono, para que quede
        // sincronizado si el usuario sigue escaneando documentos de este
        // mismo proveedor en la misma sesión.
        if (window.qrScan && window.qrScan.actualizarCatalogo) window.qrScan.actualizarCatalogo(loadProveedores());

        showToast('Proveedor actualizado desde el teléfono', 'success');
    }

    // Guarda la clasificación actual del modal de compras en el catálogo de proveedores
    function guardarClasifEnProveedor() {
        var nit = document.getElementById('cp_nit').value.trim();
        var nrcVal = document.getElementById('cp_nrc').value.trim();
        var busqueda = nit || nrcVal;
        if (!busqueda || !activeEmpresaId) { showToast('No hay NIT/NRC de proveedor en este registro', 'error'); return; }
        var list = loadProveedores();
        var idx = list.findIndex(function(p) { return (p.nit && p.nit === busqueda) || (p.nrc && p.nrc === busqueda); });
        var clasif    = document.getElementById('cp_clasif').value;
        var sector    = document.getElementById('cp_sector').value;
        var tipoCosto = document.getElementById('cp_tipo_costo').value;
        if (idx !== -1) {
            list[idx].clasif    = clasif;
            list[idx].sector    = sector;
            list[idx].tipoCosto = tipoCosto;
        } else {
            var nombre = document.getElementById('cp_nombre').value.trim();
            var duiG   = document.getElementById('cp_dui').value.trim();
            list.push({ nit: nit, nrc: nrcVal, dui: duiG, nombre: nombre, clasif: clasif, sector: sector, tipoCosto: tipoCosto });
        }
        saveProveedores(list);
        // AGREGADO NUEVO: propagar a todos los registros de compras del mes
        var actualizados = aplicarClasifProveedorACompras(nit, clasif, sector, tipoCosto);
        if (actualizados > 0) {
            saveCurrentMonthData();
            renderComprasTable();
        }
        renderProveedoresTable();
        mostrarHintProveedor(nit);
        showToast('Clasificación actualizada' + (actualizados > 0 ? ' · ' + actualizados + ' registro(s) de compras sincronizados' : ''), 'success');
    }

    // ── Render tabla de proveedores ──
    var CLASIF_LABELS = {
        '': '— Sin clasificar —', '1': '1 — Costo', '2': '2 — Gasto',
        '8': '8 — Más de 1 anexo', '9': '9 — Excepciones', '0': '0 — Anterior feb 2024'
    };
    var SECTOR_LABELS = {
        '': '— Sin clasificar —', '1': '1 — Industria', '2': '2 — Comercio',
        '3': '3 — Agropecuaria', '4': '4 — Servicios/Prof.', '8': '8 — Más de 1 anexo',
        '9': '9 — Excepciones', '0': '0 — Anterior feb 2024'
    };
    var COSTO_LABELS = {
        '': '— Sin clasificar —', '1': '1 — Gasto Venta', '2': '2 — Gasto Admin.',
        '3': '3 — Gasto Financiero', '4': '4 — Costo Imp./Intern.', '5': '5 — Costo Interno',
        '6': '6 — CIF', '7': '7 — Mano de obra', '8': '8 — Más de 1 anexo',
        '9': '9 — Excepciones', '0': '0 — Anterior feb 2024'
    };

    // AGREGADO — CAMBIO 02: clasificación de proveedores por anexo de uso
    var USO_ANEXO_LABELS = { compras: 'Compras', retenido: 'IVA Retenido', excluido: 'Sujeto Excluido' };
    var USO_ANEXO_BADGE_CLASS = {
        compras:  'background:rgba(139,92,246,0.12);color:var(--rp-violet-soft);border:1px solid rgba(139,92,246,0.3);',
        retenido: 'background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);',
        excluido: 'background:rgba(34,197,94,0.12);color:var(--rp-success);border:1px solid rgba(34,197,94,0.3);'
    };
    // Lista efectiva de anexos de un proveedor. Los proveedores existentes antes de
    // este cambio no tienen `usos` guardado — se tratan como "Compras" para no
    // alterar el funcionamiento actual de ese anexo (compatibilidad retroactiva).
    function proveedorUsosEfectivos(p) {
        if (!p) return [];
        return (p.usos && p.usos.length) ? p.usos : ['compras'];
    }
    function proveedorTieneUso(p, uso) {
        return proveedorUsosEfectivos(p).indexOf(uso) !== -1;
    }
    function _renderUsoBadges(p) {
        return proveedorUsosEfectivos(p).map(function(u) {
            return '<span style="display:inline-block;font-size:9px;font-weight:600;padding:2px 7px;border-radius:5px;margin:1px 3px 1px 0;' + (USO_ANEXO_BADGE_CLASS[u] || '') + '">' + (USO_ANEXO_LABELS[u] || u) + '</span>';
        }).join('');
    }

    function renderProveedoresTable() {
        var tbody = document.getElementById('proveedoresTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        var countEl = document.getElementById('proveedorCount');
        var searchVal = (document.getElementById('proveedorSearch') ? document.getElementById('proveedorSearch').value.toLowerCase() : '');
        var list = loadProveedores();
        var filtered = list.filter(function(p) {
            if (!searchVal) return true;
            return (p.nit||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (p.nrc||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (p.nombre||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   (CLASIF_LABELS[p.clasif]||'').toLowerCase().indexOf(searchVal) !== -1 ||
                   proveedorUsosEfectivos(p).some(function(u) { return (USO_ANEXO_LABELS[u]||'').toLowerCase().indexOf(searchVal) !== -1; });
        });
        if (countEl) countEl.innerText = list.length + ' proveedor' + (list.length !== 1 ? 'es' : '');

        if (!filtered.length) {
            var emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="6" class="px-4 py-8 text-center text-xs text-zinc-600 italic">' +
                (list.length ? 'Sin resultados para la búsqueda.' : 'No hay proveedores registrados. Importa compras JSON o agrega manualmente.') + '</td>';
            tbody.appendChild(emptyRow);
            lucide.createIcons();
            return;
        }

        // índice real para operar sobre list[]
        filtered.forEach(function(p) {
            var realIdx = list.indexOf(p);
            var clasifColor = p.clasif ? 'text-white' : 'text-zinc-600';
            // CAMBIO 06: un proveedor que pertenece EXCLUSIVAMENTE al anexo
            // "IVA Retenido" no usa Clasificación ni Tipo Costo/Gasto (esos
            // datos son de Compras / Compras a Sujeto Excluido) — esas
            // columnas deben quedar completamente vacías, sin ningún texto
            // de relleno ("— Sin clasificar —", "—", etc.).
            var _usosP = proveedorUsosEfectivos(p);
            var esSoloRetenido = (_usosP.length === 1 && _usosP[0] === 'retenido');
            var row = document.createElement('tr');
            row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs font-mono text-white">' + (p.nit || '—') + (p.nrc ? '<br><span class="text-zinc-500">NRC: ' + p.nrc + '</span>' : '') + (p.dui ? '<br><span class="text-zinc-600">DUI: ' + p.dui + '</span>' : '') + '</td>' +
                '<td class="px-4 py-3 text-xs text-white font-medium">' + (p.nombre || '<span class="text-zinc-600 italic">Sin nombre</span>') + '</td>' +
                '<td class="px-4 py-3 text-xs">' + _renderUsoBadges(p) + '</td>' +
                '<td class="px-4 py-3 text-xs ' + clasifColor + '">' + (esSoloRetenido ? '' : (CLASIF_LABELS[p.clasif] || '<span class="text-zinc-600 italic">—</span>')) + '</td>' +
                '<td class="px-4 py-3 text-xs ' + clasifColor + '">' + (esSoloRetenido ? '' : (COSTO_LABELS[p.tipoCosto] || '<span class="text-zinc-600 italic">—</span>')) + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950">' +
                '<div class="flex gap-2">' +
                '<button onclick="openProveedorModal(' + realIdx + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteProveedorRecord(' + realIdx + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // ── CRUD Proveedor ──
    function openProveedorModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('prov_editIndex').value = index;
        document.getElementById('prov_nit').value = '';
        document.getElementById('prov_nrc').value = '';
        document.getElementById('prov_dui').value = '';
        document.getElementById('prov_nombre').value = '';
        document.getElementById('prov_clasif').value = '';
        document.getElementById('prov_tipo_costo').value = '';
        // AGREGADO — CAMBIO 02: reset de clasificación por anexo de uso
        document.getElementById('prov_uso_compras').checked = false;
        document.getElementById('prov_uso_retenido').checked = false;
        document.getElementById('prov_uso_excluido').checked = false;
        document.getElementById('prov_tipo_doc_ex').value = '1';
        document.getElementById('prov_tipo_op_ex').value = '';
        var navEl = document.getElementById('prov-footer-nav');
        var posEl = document.getElementById('prov-nav-pos');
        if (index !== -1) {
            var list = loadProveedores();
            var p = list[index];
            if (!p) return;
            document.getElementById('proveedorModalTitle').innerText = 'Editar Proveedor';
            document.getElementById('prov_nit').value = p.nit || '';
            document.getElementById('prov_nrc').value = p.nrc || '';
            document.getElementById('prov_dui').value = p.dui || '';
            document.getElementById('prov_nombre').value = p.nombre || '';
            document.getElementById('prov_clasif').value = p.clasif || '';
            document.getElementById('prov_tipo_costo').value = p.tipoCosto || '';
            // AGREGADO — CAMBIO 02/05: cargar el anexo de uso del proveedor.
            // Un proveedor solo pertenece a un único anexo; si un registro
            // antiguo (previo al CAMBIO 05) tuviera más de uno guardado, se
            // conserva únicamente el primero para respetar la restricción.
            var usosP = proveedorUsosEfectivos(p);
            document.getElementById('prov_uso_compras').checked  = usosP[0] === 'compras';
            document.getElementById('prov_uso_retenido').checked = usosP[0] === 'retenido';
            document.getElementById('prov_uso_excluido').checked = usosP[0] === 'excluido';
            document.getElementById('prov_tipo_doc_ex').value = p.tipoDocEx || '1';
            document.getElementById('prov_tipo_op_ex').value  = p.tipoOpEx || '';
            // Mostrar navegación y posición
            if (navEl) navEl.style.display = 'flex';
            if (posEl) posEl.innerText = (index + 1) + ' / ' + list.length;
        } else {
            document.getElementById('proveedorModalTitle').innerText = 'Nuevo Proveedor';
            // Por defecto, un proveedor nuevo se marca para Compras (comportamiento histórico)
            document.getElementById('prov_uso_compras').checked = true;
            if (navEl) navEl.style.display = 'none';
            if (posEl) posEl.innerText = '';
        }
        // CAMBIO 03: al abrir el modal (nuevo o edición) se filtran las opciones
        // de Tipo de Costo/Gasto según la Clasificación ya cargada, para que el
        // select nunca muestre opciones inválidas para esa clasificación.
        filtrarTipoCostoPorClasif();
        toggleProveedorUsoFields();
        document.getElementById('proveedorModalForm').style.display = 'flex';
        document.getElementById('proveedorModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    // ═══ CAMBIO 03 — Regla de validación "Clasificación" ↔ "Tipo de Costo/Gasto" ═══
    // Mapa de valores permitidos de Tipo de Costo/Gasto para cada Clasificación.
    // Cuando la Clasificación es "" (Sin clasificar) no se restringe el listado,
    // ya que esa combinación no forma parte de las reglas solicitadas.
    var CLASIF_TIPO_COSTO_MAP = {
        '1': ['4', '5', '6', '7'],
        '2': ['1', '2', '3', '7'],
        '8': ['8'],
        '9': ['9'],
        '0': ['0']
    };

    // Catálogo completo de opciones de Tipo de Costo/Gasto, usado para
    // reconstruir el <select> ya filtrado según la Clasificación elegida.
    var TIPO_COSTO_OPTIONS_FULL = [
        { value: '1', label: '1 — Gasto de Venta sin Donación' },
        { value: '2', label: '2 — Gasto de Administración sin Donación' },
        { value: '3', label: '3 — Gastos Financieros sin Donación' },
        { value: '4', label: '4 — Costo Art. Producidos/Comprados Imp./Intern.' },
        { value: '5', label: '5 — Costo Art. Producidos/Comprados Interno' },
        { value: '6', label: '6 — Costo Indirectos de Fabricación' },
        { value: '7', label: '7 — Mano de obra' },
        { value: '8', label: '8 — Operaciones informadas en más de 1 anexo' },
        { value: '9', label: '9 — Excepciones' },
        { value: '0', label: '0 — Periodos anteriores a febrero de 2024' }
    ];

    // Actualiza dinámicamente las opciones visibles de "Tipo de Costo/Gasto"
    // en el formulario de Proveedores según la "Clasificación" seleccionada.
    // Si el valor previamente elegido en Tipo de Costo/Gasto ya no es válido
    // para la nueva Clasificación, se limpia (vuelve a "— Sin clasificar —")
    // para evitar dejar armada una combinación inválida en el formulario.
    function filtrarTipoCostoPorClasif() {
        var clasifSel    = document.getElementById('prov_clasif');
        var tipoCostoSel = document.getElementById('prov_tipo_costo');
        if (!clasifSel || !tipoCostoSel) return;
        var clasif     = clasifSel.value;
        var permitidos = CLASIF_TIPO_COSTO_MAP[clasif] || null; // null = sin restricción
        var valorActual = tipoCostoSel.value;
        var html = '<option value="">— Sin clasificar —</option>';
        TIPO_COSTO_OPTIONS_FULL.forEach(function(opt) {
            if (!permitidos || permitidos.indexOf(opt.value) !== -1) {
                html += '<option value="' + opt.value + '">' + opt.label + '</option>';
            }
        });
        tipoCostoSel.innerHTML = html;
        tipoCostoSel.value = (permitidos && valorActual && permitidos.indexOf(valorActual) === -1) ? '' : valorActual;
    }

    // AGREGADO — CAMBIO 05: fuerza que un proveedor solo pueda pertenecer a
    // un único anexo. Al marcar una tarjeta, desmarca las otras dos —
    // comportamiento tipo "radio" reutilizando el estilo visual de las
    // tarjetas (anexo-card-item), que hasta el CAMBIO 02 permitían selección
    // múltiple. No se puede dejar el formulario sin ningún anexo marcado.
    function selectProveedorUso(uso) {
        document.getElementById('prov_uso_compras').checked  = (uso === 'compras');
        document.getElementById('prov_uso_retenido').checked = (uso === 'retenido');
        document.getElementById('prov_uso_excluido').checked = (uso === 'excluido');
        toggleProveedorUsoFields();
    }

    // AGREGADO — CAMBIO 02: muestra/oculta las secciones de clasificación
    // según el anexo marcado en "Usar en (Anexos)", y sincroniza el estado
    // visual (clase .checked) de las tarjetas de selección.
    function toggleProveedorUsoFields() {
        var usaCompras  = document.getElementById('prov_uso_compras').checked;
        var usaExcluido = document.getElementById('prov_uso_excluido').checked;
        var clasifSection   = document.getElementById('prov_clasif_section');
        var excluidoFields  = document.getElementById('prov_excluido_fields');
        if (clasifSection)  clasifSection.style.display  = (usaCompras || usaExcluido) ? '' : 'none';
        if (excluidoFields) excluidoFields.style.display = usaExcluido ? '' : 'none';
        ['prov_uso_compras','prov_uso_retenido','prov_uso_excluido'].forEach(syncAnexoCard);
    }

    function closeProveedorModal() {
        _cerrarModalAnimado('proveedorModalForm');
    }

    function saveProveedorRecord(silent) {
        var index  = parseInt(document.getElementById('prov_editIndex').value);
        var nit    = document.getElementById('prov_nit').value.trim();
        var nrc    = document.getElementById('prov_nrc').value.trim();
        var dui    = document.getElementById('prov_dui').value.trim();
        var nombre = document.getElementById('prov_nombre').value.trim();
        var clasif    = document.getElementById('prov_clasif').value;
        var sector    = (function(){ var list = loadProveedores(); if(!isNaN(parseInt(document.getElementById("prov_editIndex").value)) && parseInt(document.getElementById("prov_editIndex").value) !== -1) { var p = list[parseInt(document.getElementById("prov_editIndex").value)]; return p ? (p.sector||"") : ""; } var emp = empresas.find(function(e){ return e.id === activeEmpresaId; }); return emp ? (emp.sector||"") : ""; })();
        var tipoCosto = document.getElementById('prov_tipo_costo').value;
        // AGREGADO — CAMBIO 02: clasificación de proveedores por anexo de uso
        var usos = [];
        if (document.getElementById('prov_uso_compras').checked)  usos.push('compras');
        if (document.getElementById('prov_uso_retenido').checked) usos.push('retenido');
        if (document.getElementById('prov_uso_excluido').checked) usos.push('excluido');
        var tipoDocEx = document.getElementById('prov_tipo_doc_ex').value;
        var tipoOpEx  = document.getElementById('prov_tipo_op_ex').value;

        // CAMBIO 06: los proveedores que pertenecen EXCLUSIVAMENTE al anexo
        // "IVA Retenido" no usan Clasificación ni Tipo Costo/Gasto (esos
        // campos aplican a Compras / Compras a Sujeto Excluido) — se fuerzan
        // vacíos al guardar, tanto al crear como al editar, aunque el select
        // oculto conserve algún valor previo sin que el usuario lo haya visto.
        var esSoloRetenido = (usos.length === 1 && usos[0] === 'retenido');
        if (esSoloRetenido) {
            clasif = '';
            tipoCosto = '';
        }

        // CAMBIO 03: valida que la combinación Clasificación / Tipo de Costo-Gasto
        // sea una de las permitidas antes de guardar. Aplica tanto al agregar un
        // proveedor nuevo como al editar uno existente; si el proveedor es
        // exclusivamente de "IVA Retenido" (esSoloRetenido) estos campos no
        // aplican y ya quedaron forzados a vacío arriba, así que se omite.
        if (!esSoloRetenido && clasif) {
            var tipoCostoPermitidos = CLASIF_TIPO_COSTO_MAP[clasif];
            if (tipoCostoPermitidos && tipoCostoPermitidos.indexOf(tipoCosto) === -1) {
                showToast('El Tipo de Costo/Gasto seleccionado no es válido para la Clasificación elegida', 'error');
                return false;
            }
        }

        if (!nit && !nombre) { showToast('Ingresa al menos el NIT/NRC o el nombre', 'error'); return false; }

        var list = loadProveedores();

        // AGREGADO — Cambio 02: recordar el NIT anterior del proveedor (solo
        // aplica al editar un registro existente) para poder sincronizar ese
        // dato en los anexos si el usuario lo corrige. No afecta la lógica
        // de clasificación, que sigue igual.
        var nitAnterior = '';

        if (isNaN(index) || index === -1) {
            // Verificar duplicado por NIT
            if (nit && list.some(function(p) { return p.nit === nit; })) {
                showToast('Ya existe un proveedor con ese NIT/NRC', 'error');
                return false;
            }
            list.push({ nit: nit, nrc: nrc, dui: dui, nombre: nombre, clasif: clasif, sector: sector, tipoCosto: tipoCosto, usos: usos, tipoDocEx: tipoDocEx, tipoOpEx: tipoOpEx });
        } else {
            if (!list[index]) return false;
            nitAnterior = (list[index].nit || '').trim();
            list[index].nit = nit;
            list[index].nrc = nrc;
            list[index].dui = dui;
            list[index].nombre = nombre;
            list[index].clasif = clasif;
            list[index].sector = sector;
            list[index].tipoCosto = tipoCosto;
            list[index].usos = usos;
            list[index].tipoDocEx = tipoDocEx;
            list[index].tipoOpEx = tipoOpEx;
        }

        saveProveedores(list);

        // AGREGADO NUEVO: propagar clasificación automáticamente a todos los registros
        // de compras que coincidan con este NIT
        if (nit) {
            var actualizados = aplicarClasifProveedorACompras(nit, clasif, sector, tipoCosto);
            if (actualizados > 0) {
                saveCurrentMonthData();
                renderComprasTable();
            }
        }

        // AGREGADO — Cambio 02: si el NIT del proveedor cambió, sincronizar el
        // nuevo NIT en los anexos (Compras, IVA Retenido, Sujeto Excluido) que
        // ya tenían registrado el NIT anterior. Solo toca el campo NIT — no
        // modifica clasificación, sector ni tipo de costo/gasto.
        if (nitAnterior && nit && nitAnterior !== nit) {
            var anexosActualizados = aplicarNuevoNitProveedorAAnexos(nitAnterior, nit);
            if (anexosActualizados > 0) {
                saveCurrentMonthData();
                renderComprasTable();
                renderRetenidoTable();
                renderExcluidoTable();
            }
        }

        renderProveedoresTable();

        if (!silent) {
            closeProveedorModal();
            showToast(isNaN(index) || index === -1 ? 'Proveedor agregado' : 'Proveedor actualizado', 'success');
        } else {
            showToast('Cambios guardados', 'success');
        }
        return true;
    }

    // AGREGADO — Cambio 02: cuando se corrige el NIT de un proveedor desde el
    // Directorio, actualizar ese mismo dato en los anexos del mes actual que
    // ya lo tenían registrado con el NIT anterior (Compras, IVA Retenido y
    // Compras a Sujeto Excluido — los tres anexos que usan datos del
    // proveedor). Únicamente se toca el campo de identificación/NIT; no se
    // modifica clasificación, sector ni tipo de costo/gasto de los registros.
    function aplicarNuevoNitProveedorAAnexos(nitAnterior, nitNuevo) {
        if (!nitAnterior || !nitNuevo || nitAnterior === nitNuevo) return 0;
        var count = 0;

        comprasRecords.forEach(function(r) {
            var coincide = false;
            if (r.nit === nitAnterior) { r.nit = nitNuevo; coincide = true; }
            if (r.nrc === nitAnterior) { r.nrc = nitNuevo; coincide = true; }
            if (coincide) count++;
        });

        retenidoRecords.forEach(function(r) {
            if (r.nit === nitAnterior) {
                r.nit = nitNuevo;
                count++;
            }
        });

        // Sujeto Excluido guarda el dato en "identificacion" (puede ser NIT,
        // DUI o NRC según el caso) — solo se actualiza cuando ese valor
        // coincide con el NIT anterior, para no tocar registros identificados
        // por DUI.
        excluidoRecords.forEach(function(r) {
            if (r.identificacion === nitAnterior) {
                r.identificacion = nitNuevo;
                count++;
            }
        });

        return count;
    }

    function navProveedorRecord(delta) {
        var cur = parseInt(document.getElementById('prov_editIndex').value);
        if (isNaN(cur) || cur === -1) return;
        // Guardar cambios del registro actual en silencio
        saveProveedorRecord(true);
        var list = loadProveedores();
        var next = cur + delta;
        if (next < 0 || next >= list.length) {
            showToast(delta < 0 ? 'Ya estás en el primer proveedor' : 'Ya estás en el último proveedor', 'error');
            return;
        }
        openProveedorModal(next);
    }

    function deleteProveedorRecord(index) {
        fsConfirm('¿Eliminar este proveedor del catálogo?\n\nSolo se elimina del catálogo, no afecta los registros de compras existentes.', function() {
            var list = loadProveedores();
            list.splice(index, 1);
            saveProveedores(list);
            renderProveedoresTable();
            showToast('Proveedor eliminado del catálogo', 'success');
        });
    }

    // Buscar proveedor por NIT o NRC — devuelve el objeto proveedor o null
    function buscarProveedorPorId(val) {
        if (!val || !activeEmpresaId) return null;
        var list = loadProveedores();
        return list.find(function(p) {
            return (p.nit && p.nit === val) || (p.nrc && p.nrc === val);
        }) || null;
    }