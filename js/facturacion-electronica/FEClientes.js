// facturacion-electronica/FEClientes.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ════════════════════════════════════════════════════════════════════
    // Implementación 02 — Facturación Electrónica: CLIENTES
    // ────────────────────────────────────────────────────────────────────
    // Reemplaza al botón flotante (FAB) que antes inyectaba la extensión
    // de Chrome directo sobre admin.factura.gob.sv. Ahora es un dropdown
    // que vive en el DOM de la app (#feClientesDropdown, dentro de
    // #facturacionElecWebviewContainer) — el <webview> nunca se toca ni
    // se le inyecta nada; el llenado se hace desde afuera con
    // webview.executeJavaScript(), igual que el resto del programa ya usa
    // ese mismo mecanismo para otras automatizaciones sobre Hacienda.
    //
    // Almacenamiento: JSON en disco por empresa (fiscalAPI.leerClientesFE/
    // guardarClientesFE, ver main.js) — independiente del catálogo de
    // "Clientes" de Gestión/Escaneo QR (Libro de Ventas).
    // ════════════════════════════════════════════════════════════════════

    var _feClientesCache = [];

    function _feClientesToggleDropdown(ev) {
        if (ev) ev.stopPropagation();
        var dd = document.getElementById('feClientesDropdown');
        if (!dd) return;
        var abriendo = !dd.classList.contains('open');
        if (abriendo) {
            _feClientesAbrirDropdown();
        } else {
            _feClientesCerrarDropdown();
        }
    }

    function _feClientesAbrirDropdown() {
        var dd = document.getElementById('feClientesDropdown');
        if (!dd) return;
        // AGREGADO NUEVO (Cambio 01 — Separar Registro de Clientes del
        // Listado): al abrir el panel siempre se parte desde la vista de
        // Lista de Clientes (por si había quedado en la vista de
        // Registrar/Editar de una apertura anterior).
        _feClientesMostrarVista('lista');
        document.getElementById('feClientesBuscar').value = "";
        dd.classList.add('open');
        _feClientesCargar();
        _feCorreoActualizarPosicion();  // AGREGADO (Cambio 03, Caso 2)
        _feConfigActualizarPosicion();  // AGREGADO (Cambio 03, Caso 2)
    }

    function _feClientesCerrarDropdown() {
        var dd = document.getElementById('feClientesDropdown');
        if (dd) dd.classList.remove('open');
        _feCorreoActualizarPosicion();  // AGREGADO (Cambio 03, Caso 2)
        _feConfigActualizarPosicion();  // AGREGADO (Cambio 03, Caso 2)
    }

    // Cierra el dropdown al hacer clic fuera de él (pero no al hacer clic
    // en el propio botón que lo abre, ni dentro del panel).
    document.addEventListener('click', function(e) {
        var dd = document.getElementById('feClientesDropdown');
        var btn = document.getElementById('btnFeClientes');
        if (!dd || !dd.classList.contains('open')) return;
        if (dd.contains(e.target) || (btn && btn.contains(e.target))) return;
        _feClientesCerrarDropdown();
    });

    function _feClientesEmpresaActual() {
        var empresaId = _facturacionElecActiva && _facturacionElecActiva.empresaId;
        if (!empresaId) return null;
        var emp = (typeof empresas !== 'undefined') ? empresas.find(function(e) { return e.id === empresaId; }) : null;
        return { id: empresaId, nombre: emp ? (emp.nombre || emp.razonSocial || String(empresaId)) : String(empresaId) };
    }

    function _feClientesCargar() {
        var ctx = _feClientesEmpresaActual();
        if (!ctx || !window.fiscalAPI || !window.fiscalAPI.leerClientesFE) { _feClientesCache = []; _feClientesRender(); return; }
        window.fiscalAPI.leerClientesFE(ctx.id).then(function(res) {
            _feClientesCache = (res && res.ok && Array.isArray(res.clientes)) ? res.clientes : [];
            _feClientesRender();
        });
    }

    function _feClientesPersistir(callback) {
        var ctx = _feClientesEmpresaActual();
        if (!ctx || !window.fiscalAPI || !window.fiscalAPI.guardarClientesFE) return;
        window.fiscalAPI.guardarClientesFE(ctx.id, _feClientesCache).then(function() {
            if (callback) callback();
        });
    }

    function _feClientesRender(filtro) {
        var div = document.getElementById('feClientesLista');
        if (!div) return;
        filtro = (filtro || document.getElementById('feClientesBuscar').value || "").toLowerCase();
        var modoActual = _feDetectarModoPorUrlWebview();
        var vis = _feClientesCache.filter(function(c) {
            return ((c.nom || "") + (c.num || "")).toLowerCase().indexOf(filtro) !== -1;
        });
        if (!vis.length) {
            div.innerHTML = '<p style="text-align:center;color:var(--rp-text-secondary);font-size:12px;margin-top:10px;">Sin clientes' + (filtro ? ' que coincidan' : '') + '.</p>';
            return;
        }
        div.innerHTML = vis.map(function(c) {
            var idx = _feClientesCache.indexOf(c);
            var modos = _feModosDe(c);
            var badges = modos.map(function(m) {
                var tipo = FE_TIPOS_DOC[m] || { label: m || "N/D", color: "#94a3b8" };
                return '<span class="fe-cli-badge" style="background:' + tipo.color + ';" title="' + tipo.label + '">' + tipo.label + '</span>';
            }).join('');
            var puedeLlenar = !!modoActual && modos.indexOf(modoActual) !== -1;
            var tipoActual = modoActual ? (FE_TIPOS_DOC[modoActual] || { label: modoActual, color: "#22C55E" }) : null;
            var tituloDeshabilitado = !modoActual
                ? 'Abre esta acción desde una pantalla de Hacienda (Factura, CCF, FSE o Nota de Crédito)'
                : ('Este cliente no tiene habilitado ' + tipoActual.label);
            var btnFill = puedeLlenar
                ? '<button onclick="_feClientesLlenar(' + idx + ')" style="background:' + tipoActual.color + ';color:#fff;border:none;border-radius:7px;padding:6px 9px;font-weight:600;font-size:11px;cursor:pointer;">Llenar</button>'
                : '<button disabled title="' + tituloDeshabilitado + '" style="background:#cbd5e1;color:#f8fafc;border:none;border-radius:7px;padding:6px 9px;font-weight:600;font-size:11px;cursor:not-allowed;">Llenar</button>';
            return '<div class="fe-cli-item">' +
                '<div style="font-weight:700;font-size:12px;color:var(--rp-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + (c.nom || '') + '">' + (c.nom || '(sin nombre)') + '</div>' +
                '<div style="font-size:10px;opacity:.7;color:var(--rp-text-secondary);margin-bottom:5px;">' + (c.tDoc || '') + ': ' + (c.num || '') + '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:7px;">' + badges + '</div>' +
                '<div style="display:flex;gap:6px;">' +
                    '<button onclick="_feClientesEditar(' + idx + ')" style="background:var(--rp-surface);border:1px solid var(--rp-border-strong);color:var(--rp-text-secondary);border-radius:7px;padding:6px 9px;font-weight:600;font-size:11px;cursor:pointer;">Editar</button>' +
                    '<button onclick="_feClientesBorrar(' + idx + ')" style="background:#EF4444;color:#fff;border:none;border-radius:7px;padding:6px 9px;font-weight:600;font-size:11px;cursor:pointer;">Borrar</button>' +
                    btnFill +
                '</div>' +
            '</div>';
        }).join('');
    }

    function _feClientesBorrar(idx) {
        // Corrección 02 — el confirm() nativo aquí era el causante del
        // congelamiento del teclado en toda la aplicación tras eliminar un
        // cliente (mismo problema, ya resuelto en otros lugares, que
        // motivó la creación de fsConfirm/fsAlert: un diálogo nativo del
        // sistema sobre una ventana con <webview> activo deja el teclado
        // bloqueado hasta reiniciar el programa). Se reemplaza por
        // fsConfirm, el modal propio ya usado por deleteClienteRecord.
        fsConfirm('¿Borrar este cliente?', function() {
            _feClientesCache.splice(idx, 1);
            _feClientesPersistir(function() { _feClientesRender(); });
        });
    }

    // Corrección 01 — Autocomplete de Actividad Económica: reutiliza el
    // catálogo ACTIVIDADES_ECONOMICAS (actividades.js) para mostrar una
    // lista en cascada de coincidencias mientras se escribe, igual que ya
    // funcionaba en la extensión de Chrome retirada. Se inicializa UNA
    // sola vez (el input y el dropdown son elementos fijos del DOM de la
    // app, no se recrean cada vez que se abre el formulario).
    (function _feInitActividadAutocomplete() {
        var input = document.getElementById('fecli_actividad');
        var dropdown = document.getElementById('fecli_actividad_dropdown');
        if (!input || !dropdown) return;
        var selectedIndex = -1;

        function highlight(text, query) {
            if (!query) return text;
            var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
        }

        function renderDropdown(query) {
            if (typeof ACTIVIDADES_ECONOMICAS === 'undefined') return;
            var q = query.trim().toLowerCase();
            var resultados = q
                ? ACTIVIDADES_ECONOMICAS.filter(function(a) { return a.toLowerCase().indexOf(q) !== -1; }).slice(0, 80)
                : ACTIVIDADES_ECONOMICAS.slice(0, 80);
            if (!resultados.length) {
                dropdown.innerHTML = '<div class="fe-cli-autocomplete-item" style="color:var(--rp-text-secondary);">Sin resultados</div>';
            } else {
                dropdown.innerHTML = resultados.map(function(a, i) {
                    return '<div class="fe-cli-autocomplete-item" data-value="' + a.replace(/"/g, '&quot;') + '" data-idx="' + i + '">' + highlight(a, q) + '</div>';
                }).join('');
            }
            selectedIndex = -1;
            dropdown.classList.add('open');
            Array.prototype.slice.call(dropdown.querySelectorAll('.fe-cli-autocomplete-item')).forEach(function(item) {
                item.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    input.value = item.dataset.value;
                    dropdown.classList.remove('open');
                });
            });
        }

        input.addEventListener('input', function() { renderDropdown(input.value); });
        input.addEventListener('focus', function() { renderDropdown(input.value); });
        input.addEventListener('keydown', function(e) {
            var items = dropdown.querySelectorAll('.fe-cli-autocomplete-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, items.length - 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); }
            else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); input.value = items[selectedIndex].dataset.value; dropdown.classList.remove('open'); return; }
            else if (e.key === 'Escape') { dropdown.classList.remove('open'); return; }
            items.forEach(function(item, i) { item.classList.toggle('selected', i === selectedIndex); });
            if (selectedIndex >= 0) items[selectedIndex].scrollIntoView({ block: 'nearest' });
        });
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('open');
        });
    })();

    // AGREGADO NUEVO (Cambio 01 — Separar Registro de Clientes del Listado):
    // el panel de Clientes ahora funciona como dos vistas independientes
    // dentro del mismo módulo — 'lista' (Lista de Clientes) y 'form'
    // (Registrar/Editar Cliente) — que se muestran una a la vez en vez de
    // aparecer una debajo de la otra. Esta función centraliza ese cambio.
    function _feClientesMostrarVista(vista) {
        var listaSection = document.getElementById('feClientesListaSection');
        var formSection = document.getElementById('feClientesForm');
        var headerAcciones = document.getElementById('feClientesHeaderAcciones');
        if (!listaSection || !formSection) return;
        if (vista === 'form') {
            listaSection.classList.add('hidden');
            formSection.classList.remove('hidden');
            if (headerAcciones) headerAcciones.classList.add('hidden');
        } else {
            formSection.classList.add('hidden');
            listaSection.classList.remove('hidden');
            if (headerAcciones) headerAcciones.classList.remove('hidden');
        }
    }

    function _feClientesNuevo() {
        // AGREGADO NUEVO (Corrección 04): título del bloque/tarjeta del
        // formulario, para dejar claro que se está registrando un cliente
        // nuevo (distinto del título al editar, ver _feClientesEditar).
        var _feTituloForm = document.getElementById('fecli_form_titulo');
        if (_feTituloForm) _feTituloForm.textContent = 'Registrar Cliente';
        document.getElementById('fecli_index').value = -1;
        _feModosConfigurados = [];
        _feModoActivo = null;
        _feDatosPorModo = {};
        _feRenderChipsModo(_feModosConfigurados, _feModoActivo);
        _feCargarModoActivoEnCampos();
        _feActualizarVisibilidadCampos(_feModosConfigurados, _feModoActivo);
        _feLlenarDeptos();
        document.getElementById('fecli_nombre').value = "";
        document.getElementById('fecli_depto').value = "06";
        _feActualizarMunicipios("06");
        document.getElementById('fecli_complemento').value = "";
        document.getElementById('fecli_tel').value = "";
        document.getElementById('fecli_correo').value = "";
        _feClientesMostrarVista('form');
    }

    function _feClientesEditar(idx) {
        var c = _feClientesCache[idx];
        if (!c) return;
        // AGREGADO NUEVO (Corrección 04): título del bloque/tarjeta del
        // formulario cuando se está editando un cliente existente.
        var _feTituloForm = document.getElementById('fecli_form_titulo');
        if (_feTituloForm) _feTituloForm.textContent = 'Editar Cliente';
        var modos = _feModosDe(c);

        // AJUSTADO (Corrección 02 — Orden y selección de documentos): al
        // editar, los botones de arriba deben poder mostrar/llenar los
        // datos de CUALQUIER tipo de documento que el cliente ya tenga
        // guardado en "porModo", no solo los que quedaron marcados como
        // VÁLIDOS (c.modos) la última vez que se guardó — esos dos
        // conceptos ya son independientes: "modos" define en qué
        // documentos es válido el cliente; "porModo" conserva los datos
        // digitados para cada tipo de documento que se haya llegado a
        // configurar.
        var modosConDatos = modos.slice();
        if (c.porModo) {
            Object.keys(c.porModo).forEach(function(m) {
                if (modosConDatos.indexOf(m) === -1) modosConDatos.push(m);
            });
        }
        document.getElementById('fecli_index').value = idx;

        // AGREGADO NUEVO (Corrección 01): reconstruye los datos propios de
        // cada tipo de documento habilitado para este cliente. Si ya se
        // guardó con el formato nuevo (c.porModo) se usa tal cual; si es un
        // cliente guardado ANTES de este cambio (con los campos "planos"
        // compartidos entre todos sus tipos de documento), se toma ese
        // mismo valor como punto de partida para cada tipo que tenía
        // habilitado — desde este momento cada uno queda independiente.
        _feModosConfigurados = modosConDatos.slice();
        _feDatosPorModo = {};
        modosConDatos.forEach(function(m) {
            if (c.porModo && c.porModo[m]) {
                _feDatosPorModo[m] = c.porModo[m];
            } else {
                _feDatosPorModo[m] = {
                    tDoc: c.tDoc || "",
                    num: c.num || "",
                    nitCcf: c.nitCcf || (c.tDoc === "36" ? (c.num || "") : ""),
                    nrc: c.nrc || "",
                    nomCom: c.nomCom || "",
                    act: c.act || "",
                    actFse: c.actFse || ""
                };
            }
        });
        _feModoActivo = modosConDatos.length ? modosConDatos[0] : null;

        _feRenderChipsModo(_feModosConfigurados, _feModoActivo);
        _feCargarModoActivoEnCampos();
        _feActualizarVisibilidadCampos(_feModosConfigurados, _feModoActivo);
        _feLlenarDeptos();
        document.getElementById('fecli_nombre').value = c.nom || "";
        document.getElementById('fecli_depto').value = c.dep || "06";
        _feActualizarMunicipios(c.dep || "06", c.mun, c.dis);
        document.getElementById('fecli_complemento').value = c.com || "";
        document.getElementById('fecli_tel').value = c.tel || "";
        document.getElementById('fecli_correo').value = c.cor || "";
        _feClientesMostrarVista('form');
    }

    function _feClientesCancelarForm() {
        _feClientesMostrarVista('lista');
    }

    // AJUSTADO (Corrección 02 — Orden y selección de documentos): guardar ya
    // no persiste el cliente de una vez. Primero se valida el formulario
    // (nombre y que haya al menos un tipo de documento configurado con
    // datos) y luego se abre fecliValidezModal para preguntar en qué
    // documentos debe quedar VÁLIDO el cliente. El guardado real ocurre en
    // _feClientesGuardarFormFinal, una vez confirmada esa selección.
    function _feClientesGuardarForm() {
        // Guarda en memoria lo digitado para el tipo de documento activo
        // antes de armar el registro final del cliente.
        _feGuardarModoActivoEnMemoria();
        var modos = _feModosConfigurados.slice();
        var nombre = document.getElementById('fecli_nombre').value.trim();
        // Corrección 02 — alert() nativo reemplazado por fsAlert (mismo
        // motivo que en _feClientesBorrar: evita el bloqueo de teclado).
        if (!nombre) { fsAlert('El nombre es obligatorio.'); return; }
        if (!modos.length) { fsAlert('Selecciona al menos un tipo de documento aplicable.'); return; }
        _feAbrirModalValidez();
    }

    // AJUSTADO (Corrección 02): arma y persiste el registro del cliente,
    // usando "modosValidos" (confirmado en fecliValidezModal) para definir
    // en qué documentos queda VÁLIDO/habilitado. Los datos propios de cada
    // tipo de documento ("porModo") se siguen guardando para TODOS los
    // tipos configurados en el formulario (_feModosConfigurados), se hayan
    // marcado o no como válidos — así no se pierde nada de lo ya llenado
    // si luego se vuelve a habilitar ese documento.
    // AGREGADO NUEVO (Cambio 01 — Actualizar clientes importados): se
    // extrae de _feClientesGuardarFormFinal la construcción del objeto
    // "cliente" final a partir de lo que esté AHORA MISMO cargado en el
    // formulario (_feModosConfigurados / _feDatosPorModo y los campos
    // comunes del DOM), sin tocar _feClientesCache ni persistir nada. Así,
    // tanto el Guardar manual (un cliente a la vez) como el botón
    // "Actualizar clientes importados" (todos, uno por uno, ver
    // _feClientesActualizarTodos) ejecutan EXACTAMENTE el mismo cálculo,
    // sin duplicar la lógica.
    function _feConstruirClienteDesdeFormulario(modosValidos) {
        var nombre = document.getElementById('fecli_nombre').value.trim();

        // AGREGADO NUEVO (Corrección 01): cada tipo de documento guarda sus
        // propios datos (Tipo Doc/Número, NIT CCF, NRC, Nombre comercial,
        // Actividad económica) de forma independiente en "porModo", sin
        // mezclarse con los de los demás tipos de documento del mismo
        // cliente.
        var porModo = {};
        _feModosConfigurados.forEach(function(m) {
            var d = _feDatosPorModo[m] || {};
            porModo[m] = {
                tDoc: d.tDoc || "",
                num: d.num || "",
                nitCcf: d.nitCcf || "",
                nrc: d.nrc || "",
                nomCom: d.nomCom || "",
                act: d.act || "",
                actFse: d.actFse || ""
            };
        });
        // Tipo de documento "principal" — sus datos se replican también en
        // los campos "planos" de nivel superior (tDoc/num/nitCcf/nrc/
        // nomCom/act/actFse) para no romper la exportación/importación CSV
        // existente, que no conoce la nueva estructura "porModo". El
        // detalle real e independiente de cada tipo de documento vive
        // únicamente en "porModo".
        //
        // Corrección 05 — Crédito Fiscal (CCF) se identifica solo con el
        // NIT del campo "NIT (para Crédito Fiscal)"; NUNCA usa Tipo
        // Doc/Número. Antes, cuando había selección múltiple de tipos de
        // documento y CCF estaba entre los válidos, SIEMPRE se elegía como
        // "modoPrincipal" — y como CCF no tiene Tipo Doc/Número, esos
        // campos quedaban vacíos ("") a nivel superior, sobrescribiendo/
        // perdiendo los que sí aplicaban y estaban llenos para los demás
        // tipos configurados (p. ej. Consumidor Final). Ahora se prioriza
        // como principal el primer tipo VÁLIDO que sí use Tipo Doc/Número;
        // CCF solo se usa como principal cuando es el ÚNICO tipo válido del
        // cliente, y en ese caso sigue sin exigir ni mostrar esos campos
        // (ver necesitaTipoNum en _feActualizarVisibilidadCampos).
        var modoPrincipal = modosValidos[0];
        for (var mvi = 0; mvi < modosValidos.length; mvi++) {
            if (modosValidos[mvi] !== "CCF") { modoPrincipal = modosValidos[mvi]; break; }
        }
        var dPrincipal = porModo[modoPrincipal] || {};
        // El NIT de Crédito Fiscal se toma siempre de los propios datos de
        // CCF (si el cliente lo tiene configurado, esté o no marcado como
        // "modoPrincipal"), en vez de depender de cuál tipo haya quedado
        // como principal arriba — así queda disponible igual sin afectar
        // ni ser afectado por el Tipo Doc/Número de los demás tipos.
        var nitCcfPrincipal = (porModo.CCF && porModo.CCF.nitCcf) || dPrincipal.nitCcf || "";
        return {
            modos: modosValidos,
            nom: nombre,
            tDoc: dPrincipal.tDoc,
            num: dPrincipal.num,
            nitCcf: nitCcfPrincipal,
            nrc: dPrincipal.nrc,
            nomCom: dPrincipal.nomCom,
            act: dPrincipal.act,
            actFse: dPrincipal.actFse,
            porModo: porModo,
            dep: document.getElementById('fecli_depto').value,
            mun: document.getElementById('fecli_municipio').value,
            dis: document.getElementById('fecli_distrito').value,
            com: document.getElementById('fecli_complemento').value.trim(),
            tel: document.getElementById('fecli_tel').value.trim(),
            cor: document.getElementById('fecli_correo').value.trim()
        };
    }

    function _feClientesGuardarFormFinal(modosValidos) {
        var idx = parseInt(document.getElementById('fecli_index').value, 10);
        var cliente = _feConstruirClienteDesdeFormulario(modosValidos);
        if (idx >= 0) { _feClientesCache[idx] = cliente; } else { _feClientesCache.push(cliente); }
        _feClientesPersistir(function() {
            _feClientesMostrarVista('lista');
            _feClientesRender();
        });
    }

    // ════════════════════════════════════════════════════════════════════
    // Cambio 01 — Actualizar clientes importados
    // ────────────────────────────────────────────────────────────────────
    // Recorre TODOS los clientes ya registrados y le aplica a cada uno,
    // automáticamente y en segundo plano, el MISMO proceso que ocurre al
    // entrar a ese cliente, presionar "Editar" y luego "Guardar cambios":
    // reutiliza _feClientesEditar (repuebla el formulario con los datos de
    // ese cliente, igual que "Editar") y _feConstruirClienteDesdeFormulario
    // (recalcula el registro final con esos mismos datos ya cargados,
    // igual que "Guardar cambios"), cliente por cliente, sin abrir el
    // formulario visualmente para el usuario ni pedir confirmación por
    // cada uno. No cambia qué documentos quedan válidos ni ningún dato que
    // el propio Editar → Guardar no cambiaría por sí mismo — solo vuelve a
    // calcular/normalizar cada registro con la lógica ACTUAL del programa
    // (por ejemplo, ya no arrastra el Tipo Doc/Número vacío de Crédito
    // Fiscal sobre los demás tipos de documento, ver Corrección 05), lo
    // cual es especialmente útil justo después de importar un catálogo de
    // clientes desde CSV.
    // ════════════════════════════════════════════════════════════════════
    function _feClientesActualizarTodos() {
        var ctx = _feClientesEmpresaActual();
        if (!ctx) return;
        var total = _feClientesCache.length;
        if (!total) { fsAlert('No hay clientes registrados para actualizar.'); return; }

        // Se recuerda en qué vista estaba el panel (Lista o
        // Registrar/Editar Cliente) antes de iniciar, para dejarlo igual
        // al terminar — el proceso repuebla el formulario internamente
        // para cada cliente, pero eso no debe notarse como un cambio de
        // pantalla para quien presionó el botón.
        var formSection = document.getElementById('feClientesForm');
        var vistaOriginal = (formSection && !formSection.classList.contains('hidden')) ? 'form' : 'lista';

        for (var i = 0; i < total; i++) {
            // "modos" (los tipos de documento en los que el cliente ya
            // está marcado como VÁLIDO) no lo decide este proceso — se
            // conserva tal cual estaba, exactamente igual que si el
            // usuario editara y guardara sin tocar el toggle de "Tipo(s)
            // de Documento que aplican a este cliente".
            var modosValidos = _feModosDe(_feClientesCache[i]).slice();
            _feClientesEditar(i);
            if (!modosValidos.length) modosValidos = _feModosConfigurados.slice();
            _feClientesCache[i] = _feConstruirClienteDesdeFormulario(modosValidos);
        }

        _feClientesMostrarVista(vistaOriginal);
        _feClientesPersistir(function() {
            _feClientesRender();
            if (typeof showToast === 'function') {
                showToast('Clientes actualizados: ' + total, 'success');
            }
        });
    }

    // ── Importar / Exportar CSV (diálogos nativos de Electron) ──────────
    function _feClientesImportar() {
        var ctx = _feClientesEmpresaActual();
        if (!ctx || !window.fiscalAPI || !window.fiscalAPI.importarClientesFE) return;
        window.fiscalAPI.importarClientesFE(ctx.id).then(function(res) {
            if (res && res.canceled) return;
            // CORRECCIÓN 01: idem — mismo alert() nativo reemplazado por
            // fsAlert() para no bloquear el teclado en el caso de error.
            if (res && res.error) { fsAlert(res.error); return; }
            if (res && res.ok) {
                _feClientesCache = res.clientes || [];
                _feClientesRender();
                var resumen = 'Importación completada\n\n' +
                    'Clientes procesados: ' + (res.procesados || 0) + '\n' +
                    'Clientes nuevos: ' + (res.nuevos || 0) + '\n' +
                    'Clientes actualizados: ' + (res.actualizados || 0) + '\n' +
                    'Errores: ' + (res.errores || 0);
                if (res.errores && res.detalleErrores && res.detalleErrores.length) {
                    resumen += '\n\nFilas con problemas:\n' + res.detalleErrores.map(function(e) {
                        return '  Fila ' + e.fila + ': ' + e.motivo;
                    }).join('\n');
                }
                // CORRECCIÓN 01: se reemplaza el alert() nativo por un modal
                // propio (fsAlert) porque, tras el diálogo nativo de
                // selección de archivo (dialog.showOpenDialog en main.js),
                // un alert() nativo dejaba el teclado bloqueado en toda la
                // aplicación hasta reiniciarla.
                fsAlert(resumen);
            }
        });
    }

    function _feClientesExportar() {
        var ctx = _feClientesEmpresaActual();
        if (!ctx || !window.fiscalAPI || !window.fiscalAPI.exportarClientesFE) return;
        window.fiscalAPI.exportarClientesFE(ctx.id, ctx.nombre).then(function(res) {
            if (res && res.canceled) return;
            // Corrección 02 — alert() nativo reemplazado por fsAlert.
            if (res && res.error) { fsAlert(res.error); return; }
            if (res && res.ok) showToast && showToast('Clientes exportados: ' + res.path, 'success');
        });
    }

    // ── Llenado en Hacienda vía webview.executeJavaScript ───────────────
    // IMPORTANTE: esto NO usa un preload dentro del <webview> — main.js
    // fuerza `webPreferences.preload = undefined` en 'will-attach-webview'
    // como candado de seguridad (el webview carga el portal real de
    // Hacienda con la sesión del usuario) y ese candado no se toca. En su
    // lugar se ejecuta el script DESDE AFUERA con el método nativo
    // `<webview>.executeJavaScript()`, exactamente el mismo mecanismo que
    // main.js ya usa (allá vía win.webContents.executeJavaScript) para
    // otras automatizaciones sobre admin.factura.gob.sv.
    function _feClientesLlenar(idx) {
        var c = _feClientesCache[idx];
        var wv = _facturacionElecActiva.webview;
        if (!c || !wv || !wv.executeJavaScript) return;
        var modo = _feDetectarModoPorUrlWebview();
        if (!modo) return;

        // AGREGADO NUEVO (Corrección 01): se llenan solo los datos propios
        // del tipo de documento que está abierto ahora mismo en Hacienda
        // (c.porModo[modo]), no una mezcla de los distintos tipos de
        // documento que tenga configurados el cliente. Si el cliente se
        // guardó ANTES de este cambio (sin c.porModo), se usa el propio
        // cliente `c` como estaban antes (sus campos planos), igual que
        // funcionaba previamente.
        var datosModo = (c.porModo && c.porModo[modo]) ? c.porModo[modo] : c;
        var cParaLlenar = {
            nom: c.nom, cor: c.cor, tel: c.tel, dep: c.dep, mun: c.mun, dis: c.dis, com: c.com,
            tDoc: datosModo.tDoc || "",
            num: datosModo.num || "",
            nitCcf: datosModo.nitCcf || (datosModo.tDoc === "36" ? (datosModo.num || "") : ""),
            nrc: datosModo.nrc || "",
            nomCom: datosModo.nomCom || "",
            act: datosModo.act || "",
            actFse: datosModo.actFse || ""
        };

        var datosJson = JSON.stringify({ c: cParaLlenar, modo: modo });

        var fillScript = '(function(){' +
            'var datos = ' + datosJson + ';' +
            'var c = datos.c; var modo = datos.modo;' +
            'var actividadParaLlenar = modo === "FSE" ? (c.actFse || c.act) : c.act;' +
            // Corrección 04 — CAUSA RAÍZ del campo "Distrito" vacío de forma
            // intermitente, específicamente en Consumidor Final: find()
            // solo excluía los campos del EMISOR en el último recurso (el
            // fallback por [formcontrolname]), pero el primer intento —
            // document.getElementById(selector) || document.querySelector
            // ('[id*="' + selector + '"]') — no aplicaba ese mismo filtro.
            // El formulario de Consumidor Final en el portal de Hacienda
            // incluye, además del campo de distrito del receptor, uno del
            // EMISOR cuyo id también contiene "distrito" (de solo lectura,
            // precargado desde el certificado); ese era el que a veces
            // encontraba primero — el orden en que el navegador devuelve
            // los nodos del DOM no es determinístico frente a cargas
            // asíncronas del portal, de ahí la intermitencia — y al
            // intentar asignarle el valor, el campo real del receptor
            // quedaba sin llenar. Ahora se descarta cualquier candidato del
            // emisor en TODAS las rutas de búsqueda por igual, no solo en
            // la última.
            'function find(selector) {' +
                'function esEmisor(el) {' +
                    'var idFc = ((el.id || "") + " " + (el.getAttribute("formcontrolname") || "")).toLowerCase();' +
                    'return idFc.indexOf("emisor") !== -1;' +
                '}' +
                'var exacto = document.getElementById(selector);' +
                'if (exacto && !esEmisor(exacto)) return exacto;' +
                'var porId = document.querySelectorAll("[id*=\\"" + selector + "\\"]");' +
                'for (var i = 0; i < porId.length; i++) {' +
                    'if (!esEmisor(porId[i])) return porId[i];' +
                '}' +
                'var byControl = document.querySelectorAll("[formcontrolname=\\"" + selector + "\\"]");' +
                'for (var j = 0; j < byControl.length; j++) {' +
                    'if (!esEmisor(byControl[j])) return byControl[j];' +
                '}' +
                // Último recurso: si el único candidato encontrado
                // pertenece al emisor (formulario sin un campo de receptor
                // separado para este selector), se devuelve igual — para
                // no romper ningún caso en el que este filtro resulte
                // demasiado estricto.
                'return exacto || porId[0] || byControl[0] || null;' +
            '}' +
            'function set(el, val) {' +
                'if (!el || val === undefined || val === null) return;' +
                'var proto = Object.getPrototypeOf(el);' +
                'var d = Object.getOwnPropertyDescriptor(proto, "value");' +
                'var setter = d && d.set;' +
                'if (setter) setter.call(el, val); else el.value = val;' +
                '["input","change","blur"].forEach(function(ev){ el.dispatchEvent(new Event(ev, { bubbles: true })); });' +
            '}' +
            'function wait(sel) {' +
                'return new Promise(function(r) {' +
                    'var el = find(sel); if (el) return r(el);' +
                    'var counter = 0;' +
                    'var interval = setInterval(function() {' +
                        'var target = find(sel); counter++;' +
                        'if (target || counter > 15) { clearInterval(interval); r(target); }' +
                    '}, 200);' +
                '});' +
            '}' +
            // Corrección 01 — CAUSA RAÍZ del campo "Distrito" vacío de forma
            // intermitente: el <select> de municipio/distrito ya existe en
            // el DOM desde el inicio (por eso wait() lo encontraba de
            // inmediato), pero sus <option> las llena el portal de Hacienda
            // de forma asíncrona (vía su propia llamada al backend) recién
            // DESPUÉS de disparar el evento "change" del campo anterior
            // (departamento → municipio → distrito). set() asignaba el
            // valor con un setTimeout de 400ms fijo que no tiene relación
            // con cuánto tarde esa carga real: a veces alcanzaba, a veces
            // no, y si no alcanzaba, el valor no coincidía con ninguna
            // <option> todavía cargada y el campo quedaba vacío. Se
            // reemplaza por una espera real de las opciones del propio
            // <select> antes de asignar su valor.
            'function waitForOption(sel, val) {' +
                'return new Promise(function(r) {' +
                    'function tieneOpcion() {' +
                        'if (!sel || !val) return true;' +
                        'for (var i = 0; i < sel.options.length; i++) {' +
                            'if (sel.options[i].value === val) return true;' +
                        '}' +
                        'return false;' +
                    '}' +
                    'if (tieneOpcion()) return r(true);' +
                    'var counter = 0;' +
                    'var interval = setInterval(function() {' +
                        'counter++;' +
                        'if (tieneOpcion() || counter > 20) { clearInterval(interval); r(tieneOpcion()); }' +
                    '}, 150);' +
                '});' +
            '}' +
            '(async function flow(){' +
                'if (modo === "CCF") {' +
                    'var nitParaCcf = c.nitCcf || (c.tDoc === "36" ? c.num : "");' +
                    'var tDoc = await wait("tipoDocumento"); if (tDoc) set(tDoc, "36");' +
                    'var elNit = await wait("nit");' +
                    'if (elNit && nitParaCcf) set(elNit, nitParaCcf);' +
                '} else {' +
                    'var tDoc2 = await wait("tipoDocumento"); if (tDoc2) set(tDoc2, c.tDoc);' +
                    'var docField = c.tDoc === "13" ? "dui" : "nit";' +
                    'var elDoc = await wait(docField); if (elDoc) set(elDoc, c.num);' +
                '}' +
                'var elNomByPlaceholder = ' +
                    'document.querySelector(\'input[placeholder="Nombre completo del receptor"]\') || ' +
                    'document.querySelector(\'input[placeholder="Nombre del receptor"]\') || ' +
                    'document.querySelector(\'input[placeholder*="receptor" i][placeholder*="nombre" i]\') || ' +
                    'document.querySelector(\'input[placeholder="Nombre completo del cliente"]\') || ' +
                    'document.querySelector(\'input[placeholder*="cliente" i][placeholder*="nombre" i]\');' +
                'var elNom = elNomByPlaceholder || await wait("nombre") || await wait("razonSocial");' +
                'if (elNom) set(elNom, c.nom);' +
                'var elCor = document.getElementById("CorreoReceptor") || find("correoReceptor") || find("correo");' +
                'if (elCor) set(elCor, c.cor);' +
                'var elTel = document.getElementById("TelefonoReceptor") || find("telefonoReceptor") || find("telefono");' +
                'if (elTel) set(elTel, c.tel);' +
                'if (c.nrc && (modo === "CCF" || modo === "NC" || modo === "FCF")) {' +
                    'var elNrc = document.querySelector(\'[formcontrolname="nrc"]\');' +
                    'if (elNrc) set(elNrc, c.nrc);' +
                '}' +
                'if (modo === "CCF" || modo === "NC") { set(find("nombreComercial"), c.nomCom); }' +
                'if (actividadParaLlenar) {' +
                    'if (modo === "FSE") {' +
                        'var candidatos = ["descActividad","actividadEconomica","actividad_economica","descripcionActividad","actividadDescripcion","giro","actividadFse"];' +
                        'var elDescAct = null;' +
                        'for (var i = 0; i < candidatos.length; i++) {' +
                            'elDescAct = document.getElementById(candidatos[i]) || find(candidatos[i]);' +
                            'if (elDescAct) break;' +
                        '}' +
                        'if (!elDescAct) {' +
                            'elDescAct = document.querySelector(' +
                                '\'textarea[formcontrolname*="ctividad" i]:not([id*="emisor" i]), \' + ' +
                                '\'input[formcontrolname*="ctividad" i]:not([id*="emisor" i]), \' + ' +
                                '\'textarea[placeholder*="actividad" i], input[placeholder*="actividad" i]\'' +
                            ');' +
                        '}' +
                        'if (elDescAct) set(elDescAct, actividadParaLlenar);' +
                    '} else {' +
                        'var combo = document.querySelector(\'input[role="combobox"]\');' +
                        'if (combo) {' +
                            'combo.focus();' +
                            'var proto = Object.getPrototypeOf(combo);' +
                            'var d = Object.getOwnPropertyDescriptor(proto, "value");' +
                            'var setter = d && d.set;' +
                            'var texto = actividadParaLlenar; var i = 0;' +
                            'var typeChar = function() {' +
                                'if (i <= texto.length) {' +
                                    'var partial = texto.slice(0, i);' +
                                    'if (setter) setter.call(combo, partial); else combo.value = partial;' +
                                    'combo.dispatchEvent(new Event("input", { bubbles: true }));' +
                                    'combo.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));' +
                                    'i++;' +
                                    'if (i <= texto.length) setTimeout(typeChar, 30);' +
                                    'else { setTimeout(function() { var opt = document.querySelector(".ng-option, mat-option, [role=\\"option\\"]"); if (opt) opt.click(); }, 700); }' +
                                '}' +
                            '};' +
                            'setTimeout(typeChar, 200);' +
                        '}' +
                    '}' +
                '}' +
                'var dep = await wait("departamento");' +
                'if (dep) {' +
                    'set(dep, c.dep);' +
                    'var mun = await wait("municipio");' +
                    'if (mun) {' +
                        'await waitForOption(mun, c.mun);' +
                        'set(mun, c.mun);' +
                        'var dis = await wait("distrito");' +
                        'if (dis) {' +
                            'await waitForOption(dis, c.dis);' +
                            'set(dis, c.dis);' +
                        '}' +
                    '}' +
                    'var com = await wait("complemento") || await wait("direccion"); if (com) set(com, c.com);' +
                '}' +
            '})();' +
            'return true;' +
        '})();';

        wv.executeJavaScript(fillScript, true).catch(function(e) {
            console.warn('[Facturación Electrónica][Clientes] Error al llenar el formulario:', e);
        });
        _feClientesCerrarDropdown();
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO (Cambio 01 — Incluir clientes de Facturación Electrónica
    // en el Backup): este catálogo vive en disco por empresa
    // (fiscalAPI.leerClientesFE / guardarClientesFE, ver main.js) y es
    // completamente independiente del catálogo de Clientes de Gestión
    // (claves 'fs_clientes_v...' de localStorage) — nunca se combinan.
    // Estas claves con prefijo FE_CLIENTES_BACKUP_PREFIX solo se usan
    // para transportar ese catálogo dentro del archivo de Backup/Restore.
    // ══════════════════════════════════════════════════════════════════
    var FE_CLIENTES_BACKUP_PREFIX = 'fs_feclientes_v' + APP_VERSION + '_emp_';

    function _feClientesBackupRecolectar() {
        // Devuelve una Promise que resuelve a { clave: arrayDeClientes }
        // con los Clientes de Facturación Electrónica de todas las
        // empresas, para incorporarlos al Backup completo.
        if (!window.fiscalAPI || !window.fiscalAPI.leerClientesFE || !Array.isArray(empresas) || !empresas.length) {
            return Promise.resolve({});
        }
        var out = {};
        var promesas = empresas.map(function(emp) {
            return window.fiscalAPI.leerClientesFE(emp.id).then(function(res) {
                out[FE_CLIENTES_BACKUP_PREFIX + emp.id] = (res && res.ok && Array.isArray(res.clientes)) ? res.clientes : [];
            }).catch(function() {
                out[FE_CLIENTES_BACKUP_PREFIX + emp.id] = [];
            });
        });
        return Promise.all(promesas).then(function() { return out; });
    }

    function _feClientesBackupRestaurar(data) {
        // Recorre las claves del Backup restaurado que correspondan a
        // Clientes de Facturación Electrónica y las guarda en su propio
        // almacenamiento (fiscalAPI.guardarClientesFE), SIN convertirlas
        // en Clientes de Gestión ni sobrescribir ese catálogo.
        if (!window.fiscalAPI || !window.fiscalAPI.guardarClientesFE) return;
        Object.keys(data).forEach(function(key) {
            if (key.indexOf(FE_CLIENTES_BACKUP_PREFIX) === 0) {
                var empresaId = key.substring(FE_CLIENTES_BACKUP_PREFIX.length);
                var arr = Array.isArray(data[key]) ? data[key] : [];
                try { window.fiscalAPI.guardarClientesFE(empresaId, arr); } catch(e) {}
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // AUTOCOMPLETE GENÉRICO — Helpers compartidos
    // ══════════════════════════════════════════════════════════════════
    function acClose(listId) {
        var el = document.getElementById(listId);
        if (el) { el.classList.remove('open'); el.innerHTML = ''; }
    }
    function acKeyDown(e, listId) {
        var list = document.getElementById(listId);
        if (!list || !list.classList.contains('open')) return;
        var items = list.querySelectorAll('.autocomplete-item');
        var active = list.querySelector('.autocomplete-item.active');
        var idx = active ? Array.from(items).indexOf(active) : -1;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (active) active.classList.remove('active');
            var next = items[idx + 1] || items[0];
            if (next) next.classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (active) active.classList.remove('active');
            var prev = items[idx - 1] || items[items.length - 1];
            if (prev) prev.classList.add('active');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            var sel = list.querySelector('.autocomplete-item.active') || items[0];
            if (sel) sel.click();
        } else if (e.key === 'Escape') {
            acClose(listId);
        }
    }