// escaneo-documentos/EscaneoDocumentos.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 01 — Escaneo de Documentos Físicos vía QR (Libro de Compras)
    // No modifica ninguna función existente (openComprasModal, loadProveedores,
    // autoRegistrarProveedor, onComprasNitChange, etc.) — solo las reutiliza
    // tal cual, reproduciendo eventos 'input'/'change' para que su propia
    // lógica de autocompletado (autocomplete de proveedor, cálculo de
    // totales) se dispare exactamente igual que si el usuario escribiera.
    // ══════════════════════════════════════════════════════════════════
    var _qrScanEstado = { activo: false, conectado: false, qrDataUrl: null };
    var _qrListenersRegistrados = false;
    // Cambio 01 (Escaneo de Documentos — control desde la PC): último tipo
    // de documento que el usuario eligió en la pantalla "Escaneo de
    // Documentos" (solo para resaltar el botón activo en esa pantalla — la
    // orden real que rige lo que hace el teléfono vive en qrPairingServer,
    // vía window.qrScan.ordenarEscaneo).
    var _libroSeleccionado = null;

    function _qrSetVal(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // CAMBIO — Actualización dinámica de empresa en el módulo de escaneos.
    // Se llama cada vez que la empresa activa cambia (al entrar a una
    // empresa o al volver a la pantalla de selección) para que, SI el
    // módulo de escaneo QR sigue abierto/minimizado en segundo plano, el
    // teléfono se actualice de inmediato — nombre de empresa, catálogo de
    // proveedores/clientes y etiquetas de clasificación — sin necesidad de
    // cerrar y volver a abrir el módulo. Si el módulo no está activo, no
    // hace nada (no lo abre ni lo modifica).
    // empresaIdParaCatalogos: id de la empresa cuyo catálogo debe leerse
    // (loadProveedores()/loadClientes() ya leen según activeEmpresaId, que
    // para este punto ya debe estar actualizado al nuevo valor).
    function _sincronizarEmpresaActivaQR() {
        if (!window.qrScan || !_qrScanEstado.activo || !window.qrScan.actualizarEmpresaActiva) return;
        var emp = activeEmpresaId ? empresas.find(function(e) { return e.id === activeEmpresaId; }) : null;
        var empresaNombre = emp ? (emp.razon || '') : '';
        window.qrScan.actualizarEmpresaActiva({
            proveedores: activeEmpresaId ? loadProveedores() : [],
            clientes: activeEmpresaId ? loadClientes() : [],
            empresaNombre: empresaNombre,
            clasifLabels: CLASIF_LABELS,
            sectorLabels: SECTOR_LABELS,
            costoLabels: COSTO_LABELS
        });
    }

    // Cambio 01 (Escaneo de Documentos — control desde la PC): levanta el
    // servidor de emparejamiento (si no estaba ya corriendo) y genera el QR
    // de vinculación. No abre ningún modal ni pantalla — eso lo decide quien
    // llame a esta función (abrirEscaneoDocumentosFisicos usa el modal
    // existente; la pantalla nueva de la barra lateral la muestra inline).
    // callback(ok) se llama una vez resuelto (ok=true si quedó listo/ya
    // estaba activo, ok=false si falló).
    function _iniciarSesionEscaneoQR(callback) {
        if (!window.qrScan) {
            showToast('El módulo de escaneo QR no está disponible en este entorno', 'error');
            if (callback) callback(false);
            return;
        }
        _registrarListenersQrScan();

        // Si ya había una sesión corriendo (el usuario la minimizó, o ya se
        // inició desde otra parte de la interfaz), no se reinicia el servidor.
        if (_qrScanEstado.activo) {
            if (callback) callback(true);
            return;
        }

        var emp = empresas.find(function(e) { return e.id === activeEmpresaId; });
        // Corrección: el campo real del nombre de la empresa en el objeto
        // 'empresas' es 'razon' (ver topbarEmpresaName, encabezados de
        // impresión, etc. — todos usan emp.razon). 'nombre'/'razonSocial'
        // no existen en este objeto, así que empresaNombre llegaba SIEMPRE
        // vacío al teléfono sin importar el empaquetado de argumentos.
        var empresaNombre = emp ? (emp.razon || '') : '';
        var proveedoresList = loadProveedores();
        var clientesList = loadClientes();

        // Corrección: 'iniciar-qr-scan' (main.js) espera UN SOLO objeto
        // { proveedores, clientes, empresaNombre, clasifLabels, sectorLabels,
        // costoLabels } — se llamaba con argumentos posicionales sueltos, así
        // que el handler nunca recibía 'empresaNombre' (por eso no aparecía
        // la empresa activa en el teléfono). Se arma el objeto explícitamente
        // para que coincida con lo que main.js realmente lee.
        window.qrScan.iniciar({
            proveedores: proveedoresList,
            clientes: clientesList,
            empresaNombre: empresaNombre,
            clasifLabels: CLASIF_LABELS,
            sectorLabels: SECTOR_LABELS,
            costoLabels: COSTO_LABELS
        }).then(function(res) {
            if (!res || !res.ok) {
                showToast((res && res.error) || 'No se pudo iniciar el módulo de escaneo.', 'error');
                if (callback) callback(false);
                return;
            }
            _qrScanEstado.activo = true;
            _qrScanEstado.qrDataUrl = res.qrDataUrl;
            // Cambio 02 — Asegura que main.js tenga, desde que arranca el
            // módulo, la copia vigente de "Tipos de Documento Permitidos"
            // (no solo a partir del primer guardado que haga el admin).
            _sincronizarTiposPermitidosQR();
            if (callback) callback(true);
        }).catch(function(e) {
            showToast((e && e.message) || 'Error desconocido al iniciar el módulo.', 'error');
            if (callback) callback(false);
        });
    }

    // Cambio 02 — Se eliminó el modal "Escanear Documentos Físicos"
    // (qrScanModal) por completo. abrirEscaneoDocumentosFisicos() ahora solo
    // arranca la sesión de emparejamiento (si no estaba activa) — el QR y el
    // estado de conexión siempre se muestran inline en esta misma pantalla,
    // vía _renderEscaneoDocScreen()/escaneoDocPairingArea. No hay ventana ni
    // overlay que abrir o cerrar.
    function abrirEscaneoDocumentosFisicos() {
        // CAMBIO — Ya no se exige empresa activa para ABRIR el módulo: ahora
        // vive en la pantalla principal (antes de entrar a una empresa), así
        // que el usuario debe poder generar el QR y vincular el teléfono de
        // una vez, sin tener que entrar primero a una empresa. Si en este
        // momento no hay ninguna activa, se inicia igual pero con catálogos
        // vacíos y sin nombre de empresa — en cuanto el usuario entre a una
        // empresa, _sincronizarEmpresaActivaQR() (llamada desde
        // ingresarEmpresa) actualiza el teléfono en caliente sin reabrir el
        // módulo. El guardado de cualquier documento escaneado sigue
        // protegido aparte por _rechazarEscaneoSinEmpresaActiva(), que
        // vuelve a comprobar activeEmpresaId en el momento real del guardado
        // — así que no hay riesgo de guardar un documento sin empresa.
        if (!window.qrScan) { showToast('El módulo de escaneo QR no está disponible en este entorno', 'error'); return; }

        _registrarListenersQrScan();

        if (_qrScanEstado.activo) {
            _renderEscaneoDocScreen();
            return;
        }

        _renderEscaneoDocScreen();
        _iniciarSesionEscaneoQR(function(ok) {
            if (!ok) showToast('No se pudo generar el código de vinculación.', 'error');
            _renderEscaneoDocScreen();
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // Cambio 01 — Escaneo de Documentos (control desde la PC)
    // Pantalla nueva de la barra lateral: vincula el teléfono (reutilizando
    // _qrScanEstado / window.qrScan tal cual) y permite elegir, desde la
    // computadora, qué tipo de documento debe escanear el teléfono a
    // continuación. El teléfono nunca elige nada por su cuenta — solo
    // recibe la orden y abre la cámara.
    // ══════════════════════════════════════════════════════════════════
    var LIBRO_ESCANEO_LABELS = {
        compras: 'Compras',
        cf: 'Venta Consumidor Final',
        ccf: 'Venta Crédito Fiscal',
        retencion: 'Retención IVA',
        excluido: 'Sujeto Excluido'
    };

    function _actualizarBotonesEscaneoDoc() {
        var botones = document.querySelectorAll('.escaneo-doc-btn');
        botones.forEach(function(btn) {
            btn.classList.toggle('activo', !!_libroSeleccionado && _libroSeleccionado === btn.getAttribute('data-libro'));
        });
    }

    // Redibuja la pantalla "Escaneo de Documentos": estado de vinculación
    // (sin vincular / esperando QR / conectado) + qué botón de tipo de
    // documento está resaltado como activo. Se llama cada vez que cambia el
    // estado de conexión del teléfono y al entrar a la pantalla — es segura
    // de llamar aunque la pantalla no esté visible en este momento (getElementById
    // simplemente no encuentra los nodos si el modal aún no se ha insertado,
    // aunque en este caso siempre existen en el DOM, solo ocultos).
    function _renderEscaneoDocScreen() {
        var dot = document.getElementById('escaneoDocConnDot');
        var txt = document.getElementById('escaneoDocConnTxt');
        var area = document.getElementById('escaneoDocPairingArea');
        if (!dot || !txt || !area) return;

        if (_qrScanEstado.activo && _qrScanEstado.conectado) {
            dot.style.background = 'var(--rp-cyan)';
            dot.style.boxShadow = '0 0 8px var(--rp-cyan)';
            txt.textContent = 'Teléfono conectado';
            area.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:38px;height:38px;border-radius:50%;background:rgba(45,212,191,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--rp-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
                '<div><p style="margin:0;color:var(--rp-text-heading);font-weight:600;font-size:13px;">Teléfono vinculado</p>' +
                '<p style="margin:0;color:var(--rp-text-secondary);font-size:11.5px;">Funciona como cámara/lector — elige un tipo de documento abajo para activarla.</p></div></div>' +
                '<button onclick="cerrarModuloEscaneo()" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(248,113,113,0.35);background:rgba(248,113,113,0.08);color:var(--rp-error);cursor:pointer;font-size:11.5px;font-weight:600;white-space:nowrap;">Desvincular</button>' +
                '</div>';
        } else if (_qrScanEstado.activo && _qrScanEstado.qrDataUrl) {
            dot.style.background = 'var(--rp-warning, #e0a857)';
            dot.style.boxShadow = 'none';
            txt.textContent = 'Esperando conexión…';
            // Cambio 02 — Sin modal: el QR de vinculación se muestra siempre
            // aquí, inline, dentro de la propia pantalla "Escaneo de
            // Documentos" (antes se ocultaba mientras el modal qrScanModal
            // estaba abierto, para no duplicarlo — ese modal ya no existe).
            area.innerHTML =
                '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">' +
                '<img src="' + _qrScanEstado.qrDataUrl + '" style="width:150px;height:150px;border-radius:10px;border:1px solid var(--rp-border-strong);background:#fff;padding:6px;flex-shrink:0;">' +
                '<div style="flex:1;min-width:220px;"><p style="margin:0 0 6px;color:var(--rp-text-heading);font-weight:600;font-size:13px;">Escanea este código con la cámara de tu teléfono</p>' +
                '<p style="margin:0;color:var(--rp-text-secondary);font-size:12px;line-height:1.5;">Debe estar en la misma red WiFi que esta computadora. En cuanto se vincule, el teléfono queda listo como cámara/lector — el tipo de documento que hayas elegido se le enviará automáticamente.</p></div></div>';
        } else {
            dot.style.background = 'var(--rp-text-secondary)';
            dot.style.boxShadow = 'none';
            txt.textContent = 'Teléfono no vinculado';
            area.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
                '<p style="margin:0;color:var(--rp-text-secondary);font-size:12.5px;max-width:440px;line-height:1.5;">Vincula tu teléfono para usarlo como cámara de escaneo. La cámara y el tipo de documento a escanear siempre se controlan desde esta pantalla.</p>' +
                '<button onclick="abrirEscaneoDocumentosFisicos()" style="padding:9px 16px;border-radius:8px;border:1px solid rgba(45,212,191,0.4);background:rgba(45,212,191,0.08);color:var(--rp-cyan);cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">Vincular teléfono</button>' +
                '</div>';
        }

        _actualizarBotonesEscaneoDoc();
    }

    // El usuario elige, desde la computadora, qué tipo de documento debe
    // escanear el teléfono a continuación. Si el teléfono todavía no se ha
    // vinculado, se inicia el emparejamiento primero (mostrando el QR
    // inline en esta misma pantalla) SIN perder la selección: la orden se
    // guarda igual (ordenarEscaneo la deja pendiente en qrPairingServer) y
    // se envía sola en cuanto el teléfono se conecte.
    function seleccionarTipoEscaneo(libro) {
        if (!window.qrScan) { showToast('El módulo de escaneo QR no está disponible en este entorno', 'error'); return; }
        if (!activeEmpresaId) { showToast('Selecciona una empresa activa antes de escanear documentos.', 'error'); return; }

        _libroSeleccionado = libro;
        _actualizarBotonesEscaneoDoc();

        function _enviarOrden() {
            window.qrScan.ordenarEscaneo(libro).then(function(res) {
                if (!res || !res.ok) {
                    showToast((res && res.error) || 'No se pudo enviar la orden al teléfono.', 'error');
                    return;
                }
                showToast(res.conectado
                    ? ('Instrucción enviada: escanear ' + (LIBRO_ESCANEO_LABELS[libro] || libro))
                    : 'Tipo de documento guardado — se enviará al teléfono en cuanto se vincule.', 'success');
            }).catch(function() {
                showToast('No se pudo enviar la orden al teléfono.', 'error');
            });
        }

        if (!_qrScanEstado.activo) {
            _renderEscaneoDocScreen();
            _iniciarSesionEscaneoQR(function(ok) {
                _renderEscaneoDocScreen();
                if (ok) _enviarOrden();
            });
            return;
        }

        _enviarOrden();
    }

    // Corrección 01: se eliminó el icono/botón flotante — el único acceso al
    // escaneo QR es ahora el módulo "Escaneo de Documentos" de la barra
    // lateral. Cambio 02: también se eliminó el modal de vinculación
    // (qrScanModal), así que "minimizar" ya no tiene ninguna ventana que
    // cerrar — se mantiene como no-op (en vez de borrar sus llamadas, que
    // aparecen en varios flujos de guardado/escaneo) para no tocar esa
    // lógica existente. El estado de la sesión sigue reflejándose siempre
    // en la pantalla "Escaneo de Documentos".
    function _minimizarModuloEscaneo() {
        // No-op: sin modal que cerrar.
    }

    function cerrarModuloEscaneo() {
        if (window.qrScan) window.qrScan.detener().catch(function() {});
        _qrScanEstado = { activo: false, conectado: false, qrDataUrl: null };
        _libroSeleccionado = null;
        _renderEscaneoDocScreen();
    }

    // Se registran una sola vez por sesión de la app (persisten aunque el
    // módulo se cierre y se reabra — son inertes mientras no hay sesión activa).
    function _registrarListenersQrScan() {
        if (_qrListenersRegistrados || !window.qrScan) return;
        _qrListenersRegistrados = true;

        window.qrScan.onEstadoConexion(function(data) {
            var estabaConectado = _qrScanEstado.conectado;
            _qrScanEstado.conectado = !!(data && data.conectado);

            // En cuanto el teléfono se conecta, se avisa con un toast. La
            // sesión sigue activa igual — solo se corta si el usuario
            // presiona "Desvincular"/"Cerrar módulo" o si se pierde la
            // conexión con el teléfono. El estado se ve siempre en esta
            // misma pantalla "Escaneo de Documentos" (sin modal, Cambio 02).
            if (_qrScanEstado.conectado && !estabaConectado) {
                showToast('Teléfono conectado — ya puedes escanear documentos', 'success');
            }
            _renderEscaneoDocScreen();
        });

        // Proveedor nuevo creado desde el teléfono: se registra con la MISMA
        // función que ya usa el resto del programa (autoRegistrarProveedor),
        // sin duplicar su lógica de deduplicación por NIT/NRC.
        window.qrScan.onProveedorNuevo(function(proveedor) {
            // CORRECCIÓN: antes se exigía proveedor.nit sí o sí, así que un
            // Sujeto Excluido creado en el teléfono con solo DUI o solo NRC
            // (permitido desde el cambio de validación de Sujeto Excluido)
            // nunca se registraba en el catálogo de la PC, aunque el
            // teléfono sí lo hubiera aceptado y el mensaje sí hubiera
            // llegado. autoRegistrarProveedor ya sabe manejar NIT, DUI o
            // NRC — basta con que llegue alguno de los tres.
            if (!proveedor || (!proveedor.nit && !proveedor.dui && !proveedor.nrc) || !activeEmpresaId) return;
            var empSector = '1';
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.sector) empSector = empActiva.sector;
            // Cambio 01: el teléfono ahora envía el anexo (usos) desde el que
            // se creó el proveedor — Compras, IVA Retenido o Sujeto Excluido.
            // Si no viene (versión anterior del teléfono, sin este campo), se
            // mantiene el comportamiento previo: se asume Compras.
            var usosNuevo = (proveedor.usos && proveedor.usos.length) ? proveedor.usos : ['compras'];
            // Clasificación / Sector / Tipo de Costo-Gasto solo existen en el
            // Catálogo de Proveedores para Compras y Sujeto Excluido — igual
            // que en el formulario del escritorio (toggleProveedorUsoFields).
            // Para IVA Retenido no aplican, así que no se les asigna un valor
            // por defecto.
            var usaClasif = usosNuevo.indexOf('compras') !== -1 || usosNuevo.indexOf('excluido') !== -1;
            var clasifFinal = proveedor.clasif || (usaClasif ? '1' : '');
            var sectorFinal = proveedor.sector || (usaClasif ? empSector : '');
            var tipoCostoFinal = proveedor.tipoCosto || (usaClasif ? '1' : '');
            autoRegistrarProveedor(proveedor.nit, proveedor.nombre, proveedor.dui, proveedor.nrc, clasifFinal, sectorFinal, tipoCostoFinal, usosNuevo, proveedor.tipoDocEx || '', proveedor.tipoOpEx || '');
            // Refresca el catálogo que tiene el teléfono, por si escanea otro
            // documento del mismo proveedor recién creado en este mismo lote.
            if (window.qrScan.actualizarCatalogo) window.qrScan.actualizarCatalogo(loadProveedores());
        });

        // Cliente nuevo creado desde el teléfono (flujo Ventas — Crédito
        // Fiscal): se registra con la MISMA función que ya usa el resto del
        // programa (autoRegistrarCliente), sin duplicar su lógica.
        window.qrScan.onClienteNuevo(function(cliente) {
            if (!cliente || !cliente.nit || !activeEmpresaId) return;
            var agregado = autoRegistrarCliente(cliente.nit, cliente.nombre, cliente.nrc);
            if (agregado) renderClientesTable();
            // Refresca el catálogo que tiene el teléfono, por si escanea otro
            // documento del mismo cliente recién creado en este mismo lote.
            if (window.qrScan.actualizarClientes) window.qrScan.actualizarClientes(loadClientes());
        });

        // Cambio 01 (ampliación): un proveedor YA EXISTENTE en el catálogo fue
        // editado desde el teléfono (nombre/NIT/NRC/DUI y/o clasificación
        // completa). Se aplica con la MISMA estructura que usa el catálogo de
        // Proveedores del escritorio, sin abrir ningún modal.
        window.qrScan.onProveedorEditado(function(proveedorEditado) {
            _aplicarEdicionProveedorDesdeQR(proveedorEditado);
        });

        // Cambio 01 (ampliación): un cliente YA EXISTENTE en el catálogo fue
        // editado desde el teléfono (flujo Ventas — Crédito Fiscal). Mismo
        // patrón que onProveedorEditado.
        window.qrScan.onClienteEditado(function(clienteEditado) {
            _aplicarEdicionClienteDesdeQR(clienteEditado);
        });

        window.qrScan.onDocumentoEscaneado(function(combinado) {
            _autocompletarComprasDesdeQR(combinado);
        });

        window.qrScan.onDocumentoEscaneadoCF(function(combinado) {
            _autocompletarVentaCFDesdeQR(combinado);
        });

        window.qrScan.onDocumentoEscaneadoCCF(function(combinado) {
            _autocompletarVentaCCFDesdeQR(combinado);
        });

        window.qrScan.onDocumentoEscaneadoRetencion(function(combinado) {
            _autocompletarRetencionDesdeQR(combinado);
        });

        window.qrScan.onDocumentoEscaneadoExcluido(function(combinado) {
            _autocompletarExcluidoDesdeQR(combinado);
        });

        // Cambio 05 (Resumen de Escaneo en el teléfono): el usuario
        // completó y envió desde el teléfono el resumen del documento
        // (Modo Admin: "Resumen en celular"). Se guarda con exactamente la
        // misma lógica que usa el modal de la PC (ver _guardarRegistroEscaneo).
        if (window.qrScan.onResumenCompletadoCelular) {
            window.qrScan.onResumenCompletadoCelular(function(payload) {
                _procesarResumenCompletadoCelular(payload);
            });
        }
    }

    // Combina el resultado de la consulta pública + el proveedor elegido/creado
    // en el teléfono, y GUARDA DIRECTO el registro en el Libro de Compras —
    // Anexo 3, sin abrir el modal "Nuevo Registro — Compras". Reutiliza la
    // MISMA lógica que saveComprasRecord() (validación, duplicados, catálogo
    // de proveedores, sincronización con IVA Percibido) para no duplicar
    // comportamiento ni reglas de negocio, pero sin tocar la UI del modal.
    // CAMBIO 05 — Validación de empresa activa antes de escanear: nunca se
    // debe procesar/guardar un documento escaneado sin una empresa
    // actualmente seleccionada en el escritorio (por ejemplo, si el usuario
    // volvió a la pantalla de selección de empresas con el módulo QR aún
    // abierto/minimizado en segundo plano). Se lee activeEmpresaId en el
    // momento del escaneo, nunca un valor guardado de antes. Devuelve true
    // (y ya avisó al usuario/teléfono) si el escaneo debe rechazarse.
    function _rechazarEscaneoSinEmpresaActiva() {
        if (activeEmpresaId) return false;
        showToast('No hay ninguna empresa activa — el documento escaneado no se guardó.', 'error');
        if (window.qrScan && window.qrScan.reportarResultado) {
            window.qrScan.reportarResultado({ ok: false, mensaje: 'No hay ninguna empresa activa en este momento.' });
        }
        _minimizarModuloEscaneo();
        return true;
    }

    // ══════════════════════════════════════════════════════════════════
    // Cambio 05 — RESUMEN DE ESCANEO EN EL TELÉFONO (Modo Admin: "Resumen
    // en celular"). La PC sigue siendo el centro de control (vinculación,
    // módulo, documentos permitidos, y toda la validación de los 5
    // _autocompletar...DesdeQR de arriba — duplicados, tipo permitido,
    // empresa activa — no cambia en nada). Lo único que cambia es que, en
    // vez de abrir el modal "Documento Escaneado" aquí mismo, el
    // documento ya validado se reenvía al teléfono para que el usuario lo
    // complete ahí; la PC recibe el resultado final y lo guarda con la
    // MISMA lógica de siempre (ver _guardarRegistroEscaneo).
    // ══════════════════════════════════════════════════════════════════

    // Envía el documento (ya validado) al teléfono vinculado. Si por
    // cualquier motivo no se pudo entregar (el teléfono se desconectó justo
    // en este instante, el módulo no está corriendo, etc.), se usa la PC
    // como respaldo — el documento nunca se pierde.
    function _enviarResumenACelular(libro, combinado) {
        if (!window.qrScan || !window.qrScan.enviarResumenCelular) {
            openQrDocModal(libro, combinado);
            return;
        }
        window.qrScan.enviarResumenCelular(libro, combinado).then(function(res) {
            if (!res || !res.ok) {
                showToast((res && res.error) || 'No se pudo enviar el documento al teléfono — se muestra en la computadora.', 'error');
                openQrDocModal(libro, combinado);
            }
            // Corrección 01 — IMPORTANTE: no se debe llamar aquí a
            // window.qrScan.reportarResultado() en el caso de éxito. Esa
            // llamada manda al teléfono un mensaje 'resultado-documento',
            // y el manejador de ese mensaje en app.js SIEMPRE navega a la
            // pantalla "Resultado" (mostrarPantalla('screenResultado')) sin
            // condición. Como 'mostrar-resumen' ya se le envió al teléfono
            // DENTRO de enviarResumenCelular() (ver qrPairingServer.js),
            // antes incluso de que esta promesa se resuelva, el teléfono ya
            // había pasado a la pantalla de Resumen — este segundo mensaje
            // lo sacaba de ahí inmediatamente, sin darle chance de
            // completarlo ni enviarlo de vuelta. main.js ya le manda al
            // teléfono un aviso genérico ("Documento recibido — revísalo en
            // tu computadora") apenas consulta el documento, que queda en
            // pantalla como mucho un instante hasta que 'mostrar-resumen'
            // lo reemplaza — no hace falta (ni conviene) mandar un segundo
            // aviso desde aquí.
        }).catch(function() {
            openQrDocModal(libro, combinado);
        });
    }

    // El usuario completó y envió desde el teléfono el resumen de un
    // documento. payload: { libro, combinado, campos, sel } — mismo
    // "campos"/"sel" que arma el modal de la PC (ver qrDocEnviar). Se
    // guarda con _guardarRegistroEscaneo (idéntica lógica en ambos modos)
    // y se informa el resultado de vuelta al teléfono, reutilizando el
    // mismo canal que ya usa el flujo de escaneo por cámara.
    function _procesarResumenCompletadoCelular(payload) {
        if (!payload || !payload.libro || !payload.combinado) return;
        if (_rechazarEscaneoSinEmpresaActiva()) return;

        var libro = payload.libro;
        var combinado = payload.combinado;
        var campos = payload.campos || {};
        campos.sel = payload.sel || null;

        var resultado = _guardarRegistroEscaneo(libro, combinado, campos);

        if (window.qrScan && window.qrScan.reportarResultado) {
            window.qrScan.reportarResultado({ ok: resultado.ok, mensaje: resultado.mensaje });
        }
        showToast(resultado.mensaje, resultado.ok ? 'success' : 'error');
    }

    // ══════════════════════════════════════════════════════════════════
    // Corrección 01 — PANTALLA INDEPENDIENTE "Documentos Escaneados"
    // Bandeja de recepción para los documentos que llegan desde el
    // escaneo QR del teléfono. Es un modal propio (qrDocModalForm, ver
    // HTML), separado de los modales "Nuevo Registro" de cada anexo —
    // pero reutiliza el catálogo de Proveedores/Clientes y
    // autoRegistrarProveedor/autoRegistrarCliente para no duplicar esa
    // lógica. Un mismo modal atiende los 5 libros; qrDocState.libro decide
    // qué mostrar y qué arma qrDocEnviar() al confirmar.
    // ══════════════════════════════════════════════════════════════════
    var qrDocState = {
        libro: null,       // 'compras' | 'cf' | 'ccf' | 'retencion' | 'excluido'
        combinado: null,   // resultado de la consulta pública + qr (fecha, codGen, estado, montoTotal, ...)
        sel: null          // proveedor/cliente elegido o agregado en esta pantalla
    };

    var QRDOC_LIBRO_INFO = {
        compras: {
            anexo: 'Libro de Compras — Anexo 3', titulo: 'Compras — Documento Escaneado',
            esCliente: false, sinTipoDoc: false, montoLabel: 'Monto (Compras Gravadas)',
            tiposDoc: [['03','03 — Comprobante de Crédito Fiscal'],['05','05 — Nota de Crédito'],['06','06 — Nota de Débito'],['11','11 — Facturas de Exportación'],['12','12 — Declaración de Mercancías'],['13','13 — Mandamiento de Ingreso']],
            tipoDocDefault: '03'
        },
        cf: {
            anexo: 'Ventas — Consumidor Final — Anexo 2', titulo: 'Consumidor Final — Documento Escaneado',
            esCliente: false, sinProveedor: true, sinTipoDoc: false, montoLabel: 'Monto (Ventas Gravadas)',
            tiposDoc: [['01','01 — Factura Consumidor Final'],['02','02 — Factura de Venta Simplificada'],['10','10 — Tiquetes Máquinas Registradora'],['11','11 — Facturas de Exportación']],
            tipoDocDefault: '01'
        },
        ccf: {
            anexo: 'Ventas — Crédito Fiscal — Anexo 1', titulo: 'Crédito Fiscal — Documento Escaneado',
            esCliente: true, sinTipoDoc: false, montoLabel: 'Monto (Ventas Gravadas)',
            tiposDoc: [['03','03 — Comprobante de Crédito Fiscal'],['05','05 — Nota de Crédito'],['06','06 — Nota de Débito']],
            tipoDocDefault: '03'
        },
        retencion: {
            anexo: 'Comprobantes de Retención — Anexo 7', titulo: 'Retención IVA — Documento Escaneado',
            esCliente: false, sinTipoDoc: false, montoLabel: 'Monto Sujeto a Retención',
            tiposDoc: [['07','07 — Comprobante de Retención'],['05','05 — Nota de Crédito'],['06','06 — Nota de Débito']],
            tipoDocDefault: '07'
        },
        excluido: {
            anexo: 'Compras a Sujeto Excluido — Anexo 5', titulo: 'Sujeto Excluido — Documento Escaneado',
            esCliente: false, sinTipoDoc: false, montoLabel: 'Monto de la Operación',
            tiposDoc: [['14','14 — Factura de Sujeto Excluido'],['05','05 — Nota de Crédito'],['06','06 — Nota de Débito']],
            tipoDocDefault: '14'
        }
    };

    // Traduce el texto real de "Tipo de DTE" a un código CAT-002. Delegado
    // por completo en cat002.js (misma función que usa main.js) — ya no
    // hay una copia local de esta lógica en index.html.
    function _cat002CodigoDesdeTexto(textoTipoDte) {
        return window.FiscalSyncCat002.cat002CodigoDesdeTexto(textoTipoDte);
    }

    // Punto único de validación — llamado desde los 5 _autocompletar...
    // DesdeQR justo antes de abrir el modal de Documento Escaneado. Recibe
    // el TEXTO REAL de "Tipo de DTE" (combinado.tipoDteTexto). Cambio 04:
    // un tipo desconocido para CAT-002 ahora también se rechaza aquí (antes
    // se dejaba pasar) — esta es la segunda capa, de respaldo, por si un
    // documento llegara a colarse antes de que main.js sincronizara la
    // configuración vigente; el rechazo principal y sus dos mensajes
    // distintos (desconocido / no habilitado) ocurren en main.js.
    function qrScanTipoPermitido(libro, tipoDteTexto) {
        var codigo = _cat002CodigoDesdeTexto(tipoDteTexto);
        if (!codigo) return false; // tipo desconocido para CAT-002 -> rechazar
        var permitidos = qrScanTiposLoad()[libro] || [];
        return permitidos.indexOf(codigo) !== -1;
    }

    // ══════════════════════════════════════════════════════════════════
    // Cambio 05 — RESUMEN DE ESCANEO: dónde se muestra y completa
    // (configurable desde Modo Admin, pestaña "Escaneo QR").
    //
    // La computadora sigue siendo SIEMPRE el centro de control de la
    // sesión de escaneo (vinculación por QR, selección de módulo,
    // documentos permitidos — nada de esto cambia). Esta configuración
    // decide únicamente dónde se muestra y completa el Resumen de un
    // documento YA escaneado y consultado en Hacienda:
    //   'pc'      — (por defecto) el modal "Documento Escaneado" se abre
    //               en la propia computadora, exactamente como hasta
    //               ahora (openQrDocModal).
    //   'celular' — el mismo resumen se envía al teléfono vinculado, que
    //               lo muestra y lo completa; la PC recibe al final el
    //               resultado y lo guarda.
    // Es una preferencia puramente local a este equipo (no depende de la
    // empresa activa), por eso se guarda aparte de "Tipos de Documento
    // Permitidos" y no se sincroniza a main.js: el teléfono nunca necesita
    // conocerla de antemano, solo recibe el resumen cuando corresponde
    // (ver _enviarResumenACelular).
    // ══════════════════════════════════════════════════════════════════
    var RESUMEN_MODO_STORAGE_KEY = 'fs_resumen_escaneo_modo_v1';

    function resumenEscaneoModoLoad() {
        var v = fsStore.getItem(RESUMEN_MODO_STORAGE_KEY);
        return (v === 'celular') ? 'celular' : 'pc';
    }

    function resumenEscaneoModoSave(modo) {
        var val = (modo === 'celular') ? 'celular' : 'pc';
        fsStore.setItem(RESUMEN_MODO_STORAGE_KEY, val);
        renderResumenModoSelector();
        showToast(val === 'celular'
            ? 'El Resumen de Escaneo ahora se completa en el teléfono'
            : 'El Resumen de Escaneo ahora se completa en esta computadora', 'success');
    }

    // Editor en Modo Admin (pestaña "Escaneo QR") — dos tarjetas
    // seleccionables, mismo patrón visual que el resto de Admin.
    function renderResumenModoSelector() {
        var wrap = document.getElementById('resumenModoSelector');
        if (!wrap) return;
        var actual = resumenEscaneoModoLoad();
        var OPCIONES = [
            { id: 'pc', titulo: 'Solo computadora', desc: 'El resumen se muestra y completa aquí, en la PC (comportamiento actual).' },
            { id: 'celular', titulo: 'Resumen en celular', desc: 'El teléfono vinculado muestra y completa el resumen; la PC recibe el resultado final.' }
        ];
        wrap.innerHTML = '';
        OPCIONES.forEach(function(op) {
            var activo = actual === op.id;
            var card = document.createElement('button');
            card.type = 'button';
            card.style.cssText = 'text-align:left;padding:14px;border-radius:10px;cursor:pointer;font-family:\'Inter\',sans-serif;transition:all .15s;' +
                (activo
                    ? 'border:1px solid var(--rp-accent);background:rgba(59,130,246,0.08);'
                    : 'border:1px solid var(--rp-border-strong);background:transparent;');
            card.innerHTML =
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                '<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (activo ? 'var(--rp-accent)' : 'var(--rp-text-secondary)') + ';"></span>' +
                '<span style="font-size:12.5px;font-weight:700;color:' + (activo ? 'var(--rp-accent)' : 'var(--rp-text-primary)') + ';">' + _esc(op.titulo) + '</span>' +
                '</div>' +
                '<p style="margin:0;font-size:11px;color:var(--rp-text-secondary);line-height:1.4;">' + _esc(op.desc) + '</p>';
            card.onclick = function() { resumenEscaneoModoSave(op.id); };
            wrap.appendChild(card);
        });
    }

    // Corrección 03 — Limpieza específica de "Retención renta": el valor
    // quedaba en el DOM (input oculto por CSS) después de enviar un
    // documento, así que si el siguiente documento escaneado NO traía este
    // dato, el campo seguía oculto pero con el valor viejo dentro. Si por
    // cualquier motivo el wrap volvía a mostrarse, el usuario veía el dato
    // del documento anterior. Este helper limpia el valor Y lo oculta, y se
    // llama tanto al preparar el modal para un nuevo escaneo (antes de
    // pintar los datos del documento entrante) como justo después de un
    // envío exitoso — así el campo nunca arrastra información entre
    // documentos. No modifica ningún otro campo del Resumen de la
    // operación ni su lógica de cálculo (ver poblarQrDocCamposAdicionales,
    // que sigue intacta para el resto de campos).
    function qrDocLimpiarRetencionRenta() {
        var wrap = document.getElementById('qrDoc_retencionRentaWrap');
        var input = document.getElementById('qrDoc_retencionRentaView');
        if (input) input.value = '';
        if (wrap) wrap.classList.add('hidden');
    }

    // Corrección 02 — Llena los campos adicionales del documento escaneado
    // (mismo estilo que "Sello de Recepción": label + input readonly,
    // dentro del grid "Datos del Documento"). Es exclusivamente
    // informativo: no toca qrDoc_monto, no participa en qrDocEnviar() ni
    // en la lógica de ningún anexo. Cada campo se muestra únicamente si
    // viene presente en el documento escaneado (combinado); si no viene,
    // su wrapper queda oculto. $0.00 SÍ cuenta como presente y se muestra.
    function poblarQrDocCamposAdicionales(combinado) {
        var campos = [
            { prop: 'ivaOperaciones', wrap: 'qrDoc_ivaOperacionesWrap',   input: 'qrDoc_ivaOperaciones' },
            { prop: 'ivaPercibido',   wrap: 'qrDoc_ivaPercibidoWrap',     input: 'qrDoc_ivaPercibidoView' },
            { prop: 'ivaRetenido',    wrap: 'qrDoc_ivaRetenidoWrap',      input: 'qrDoc_ivaRetenido' },
            { prop: 'retencionRenta', wrap: 'qrDoc_retencionRentaWrap',   input: 'qrDoc_retencionRentaView' },
            { prop: 'totalOperacion', wrap: 'qrDoc_totalOperacionWrap',  input: 'qrDoc_totalOperacion' }
        ];
        campos.forEach(function(c) {
            var presente = combinado && combinado[c.prop] !== undefined && combinado[c.prop] !== null && combinado[c.prop] !== '';
            var wrapEl = document.getElementById(c.wrap);
            if (presente) {
                document.getElementById(c.input).value = fMoney(parseFloat(combinado[c.prop]) || 0);
                wrapEl.classList.remove('hidden');
            } else {
                wrapEl.classList.add('hidden');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // Cambio 01 — FACTURA DE EXPORTACIÓN (código CAT-002 '11') en Compras
    // (Anexo 3) y Ventas Consumidor Final (Anexo 2): no lleva IVA, y
    // requiere indicar si la operación es un Bien o un Servicio para saber
    // a qué campo del anexo se envía el monto (ver detalle en qrDocEnviar).
    // Este bloque solo controla la UI del selector; el envío/guardado real
    // sigue viviendo en qrDocEnviar(), sin tocar el resto de tipos de
    // documento ni de anexos (Retención, Sujeto Excluido, Crédito Fiscal).
    // ══════════════════════════════════════════════════════════════════

    // true únicamente si el anexo activo es Compras o Consumidor Final Y el
    // "Tipo de Documento" elegido en el modal (automático o manual) es 11.
    function _qrDocEsFacturaExportacionActiva() {
        var libro = qrDocState.libro;
        if (libro !== 'compras' && libro !== 'cf') return false;
        var sel = document.getElementById('qrDoc_tipoDoc');
        return !!sel && sel.value === '11';
    }

    function _qrDocRenderBienServicioBotones() {
        var val = document.getElementById('qrDoc_bienServicio').value;
        var activoCss = 'padding:10px 0;font-size:12px;font-weight:600;border-radius:8px;border:1px solid var(--rp-accent);background:rgba(59,130,246,0.12);color:var(--rp-accent);cursor:pointer;transition:all 0.15s;letter-spacing:0.03em;';
        var inactivoCss = 'padding:10px 0;font-size:12px;font-weight:600;border-radius:8px;border:1px solid var(--rp-border-strong);background:transparent;color:var(--rp-text-secondary);cursor:pointer;transition:all 0.15s;letter-spacing:0.03em;';
        document.getElementById('qrDoc_bsBtn_bien').style.cssText = (val === 'bien') ? activoCss : inactivoCss;
        document.getElementById('qrDoc_bsBtn_servicio').style.cssText = (val === 'servicio') ? activoCss : inactivoCss;
    }

    // Única opción seleccionada a la vez (regla 7 del Cambio 01) — elegir
    // una desmarca automáticamente la otra, porque ambas comparten el mismo
    // input oculto qrDoc_bienServicio.
    function qrDocSelectBienServicio(val) {
        document.getElementById('qrDoc_bienServicio').value = val;
        _qrDocRenderBienServicioBotones();
    }

    // Punto único que decide si se muestra el selector Bien/Servicio y si se
    // oculta "Venta Exenta" (que no aplica a una Factura de Exportación).
    // Llamado desde openQrDocModal() al abrir el modal y desde
    // qrDocOnTipoDocChange() cada vez que el usuario cambia manualmente el
    // "Tipo de Documento" — cubre tanto el reconocimiento automático como
    // el caso "Tipo no reconocido automáticamente" en el que el usuario
    // elige 11 a mano.
    function _qrDocActualizarVisibilidadExportacion() {
        var libro = qrDocState.libro;
        var esExportacion = _qrDocEsFacturaExportacionActiva();

        var bsWrap = document.getElementById('qrDoc_bienServicioWrap');
        bsWrap.classList.toggle('hidden', !esExportacion);
        if (esExportacion) {
            document.getElementById('qrDoc_bienServicio').value = 'bien';
            _qrDocRenderBienServicioBotones();
        }

        // "Venta Exenta" solo existía para cf/ccf; ahora además se oculta
        // en cf mientras el documento sea Factura de Exportación (no se
        // deben llenar Exentas/Gravadas y Bien/Servicio a la vez).
        if (libro === 'cf' || libro === 'ccf') {
            var mostrarExenta = !esExportacion;
            document.getElementById('qrDoc_exentaWrap').classList.toggle('hidden', !mostrarExenta);
            if (!mostrarExenta) document.getElementById('qrDoc_exenta').checked = false;
        }

        // El label del monto se deja igual que para cualquier otro tipo de
        // documento (info.montoLabel) — el aviso de "no lleva IVA" queda
        // solo en el texto descriptivo del selector Bien/Servicio.
        var info = QRDOC_LIBRO_INFO[libro];
        if (info) {
            document.getElementById('qrDoc_montoLabel').innerText = info.montoLabel;
        }
    }

    // onchange del select "Tipo de Documento" — permite reaccionar cuando
    // el usuario lo cambia a mano (ej. tipo no reconocido automáticamente,
    // o corrige el tipo detectado) después de que el modal ya está abierto.
    function qrDocOnTipoDocChange() {
        _qrDocActualizarVisibilidadExportacion();
    }

    function openQrDocModal(libro, combinado) {
        var info = QRDOC_LIBRO_INFO[libro];
        if (!info) return;
        qrDocState.libro = libro;
        qrDocState.combinado = combinado;
        qrDocState.sel = null;

        // Corrección 03 — limpieza defensiva antes de pintar el documento
        // entrante: si el documento anterior tenía "Retención renta" y este
        // no, el campo no debe arrastrar el valor previo.
        qrDocLimpiarRetencionRenta();

        document.getElementById('qrDocAnexoLabel').innerText = info.anexo;
        document.getElementById('qrDocModalTitle').innerText = info.titulo;

        document.getElementById('qrDoc_fecha').textContent = combinado.fecha || '';
        document.getElementById('qrDoc_codGenView').textContent = combinado.codGen || '';
        document.getElementById('qrDoc_codGenView').title = combinado.codGen || '';
        document.getElementById('qrDoc_estado').textContent = combinado.estado || 'Sin verificar';

        // Cambio 05 (visual) — pastilla de estado del encabezado del ticket.
        // Puramente decorativa: reutiliza dgiiEstadoLabel() (ya existente) para
        // el texto y el propio código de estado (combinado.estado) para el color.
        // No sustituye ni toca qrDoc_estado (que sigue mostrando el valor crudo
        // igual que antes); no participa en ninguna validación ni en qrDocEnviar().
        (function() {
            var codigo = combinado.estado || 'SIN_VERIFICAR';
            var pill = document.getElementById('qrDoc_estadoPill');
            var txt = document.getElementById('qrDoc_estadoPillTxt');
            if (!pill || !txt) return;
            txt.innerText = (window.dgiiEstadoLabel ? dgiiEstadoLabel(codigo) : codigo);
            pill.classList.remove('warn', 'error');
            if (codigo === 'RECHAZADO' || codigo === 'ERROR' || codigo === 'INVALIDADO') {
                pill.classList.add('error');
            } else if (codigo !== 'TRANSMITIDO') {
                pill.classList.add('warn');
            }
        })();

        document.getElementById('qrDoc_sello').textContent = combinado.selloRecepcion || '';
        // Corrección 02 (Cambio 05) — Número de Control: el dato ya llegaba en
        // combinado.numeroControl (usado desde antes en qrDocEnviar más abajo para
        // armar los registros de Compras/Retención/Excluido) pero nunca se mostraba
        // en el modal. Se agrega aquí solo su despliegue, sin tocar de dónde viene
        // el dato ni cómo se usa en qrDocEnviar().
        document.getElementById('qrDoc_numControl').textContent = combinado.numeroControl || '';
        document.getElementById('qrDoc_monto').value = combinado.montoTotal || 0;
        document.getElementById('qrDoc_montoLabel').innerText = info.montoLabel;

        // Corrección 02 — Campos adicionales: solo visual, no altera
        // qrDoc_monto ni ningún otro campo/lógica existente.
        poblarQrDocCamposAdicionales(combinado);

        // Tipo de Documento — se repinta siempre con las opciones de este
        // anexo (info.tiposDoc), para que nunca arrastre las opciones de un
        // documento anterior de otro anexo/libro (ese arrastre era el bug
        // original). Sujeto Excluido admite: Factura de Sujeto Excluido,
        // Nota de Crédito y Nota de Débito.
        var tipoDocWrap = document.getElementById('qrDoc_tipoDoc').closest('div');
        var tipoSel = document.getElementById('qrDoc_tipoDoc');
        if (info.sinTipoDoc) {
            if (tipoDocWrap) tipoDocWrap.classList.add('hidden');
            tipoSel.innerHTML = '';
        } else {
            if (tipoDocWrap) tipoDocWrap.classList.remove('hidden');
            tipoSel.innerHTML = info.tiposDoc.map(function(t) { return '<option value="'+t[0]+'">'+t[1]+'</option>'; }).join('');
            tipoSel.value = combinado.tipoDocMapeado || info.tipoDocDefault;
        }

        var avisoEl = document.getElementById('qrDoc_avisoTipo');
        if (!combinado.tipoDocMapeado && !info.sinTipoDoc) {
            avisoEl.classList.remove('hidden');
            avisoEl.innerText = 'Tipo no reconocido automáticamente — verifica "Tipo de Documento" antes de enviar.';
        } else if (combinado.estado && combinado.estado !== 'TRANSMITIDO') {
            avisoEl.classList.remove('hidden');
            avisoEl.innerText = 'Estado en el Ministerio: ' + combinado.estado + '. Revísalo antes de enviar.';
        } else {
            avisoEl.classList.add('hidden');
        }

        // Sección Proveedor/Cliente
        document.getElementById('qrDoc_provLabel').innerText = info.esCliente ? 'Cliente' : (info.sinProveedor ? '' : 'Proveedor');
        var mostrarProv = !info.sinProveedor;
        ['qrDoc_provLabel','qrDoc_provBuscar','qrDoc_provElegido','qrDoc_provNuevoForm'].forEach(function(id) {
            var el = document.getElementById(id);
            if (!mostrarProv) { el.classList.add('hidden'); return; }
        });
        if (mostrarProv) {
            document.getElementById('qrDoc_provLabel').classList.remove('hidden');
            document.getElementById('qrDoc_provBuscar').classList.remove('hidden');
            document.getElementById('qrDoc_provElegido').classList.add('hidden');
            document.getElementById('qrDoc_provNuevoForm').classList.add('hidden');
            document.getElementById('qrDoc_provSearch').value = '';
            document.getElementById('qrDoc_provResults').innerHTML = '';
            document.getElementById('qrDoc_provBuscarLabel').innerText = info.esCliente
                ? 'Buscar cliente por nombre, NIT o NRC'
                : 'Buscar proveedor por nombre, NIT, NRC o DUI';
            // Cambio 01 — mismo criterio esCliente: el botón para registrar
            // uno nuevo y el botón de confirmación dentro del formulario
            // también deben decir "cliente" en Venta – Crédito Fiscal, para
            // que coincidan con el encabezado "Cliente". Solo texto, la
            // función (onclick) es la misma en ambos casos.
            document.getElementById('qrDoc_btnProvNuevo').innerText = info.esCliente
                ? '+ Agregar cliente nuevo'
                : '+ Agregar proveedor nuevo';
            document.getElementById('qrDoc_provNuevoForm').querySelector('button[onclick="qrDocUsarProveedorNuevo()"]').innerText = info.esCliente
                ? 'Usar este cliente'
                : 'Usar este proveedor';
            document.getElementById('qrDoc_pn_clasifWrap').classList.toggle('hidden', info.esCliente);
            document.getElementById('qrDoc_pn_sectorWrap').classList.toggle('hidden', info.esCliente);
            document.getElementById('qrDoc_pn_tipoCostoWrap').classList.toggle('hidden', info.esCliente);
            document.getElementById('qrDoc_pn_excluidoWrap').classList.toggle('hidden', libro !== 'excluido');
            document.getElementById('qrDoc_pn_dui').closest('div').classList.toggle('hidden', info.esCliente);
        } else {
            document.getElementById('qrDoc_provLabel').classList.add('hidden');
        }

        // "Venta Exenta" — solo aplica a CF y CCF (ambos usan "Gravadas" por
        // defecto; si el usuario marca "exenta", qrDocEnviar mueve el monto
        // al campo de exentas del anexo correspondiente). Cambio 01: esta
        // visibilidad ahora se calcula junto con la del selector Bien/
        // Servicio en _qrDocActualizarVisibilidadExportacion(), porque
        // ambas dependen del mismo criterio (tipo de documento actual).
        document.getElementById('qrDoc_exenta').checked = false;
        _qrDocActualizarVisibilidadExportacion();

        document.getElementById('qrDocModalForm').style.display = 'flex';
        document.getElementById('qrDocModalForm').classList.add('modal-open');
        if (window.lucide) lucide.createIcons();
    }

    function closeQrDocModal() {
        // Corrección 03 — se limpia también al cerrar (cubre el cierre que
        // ocurre justo después de un envío exitoso, ya que qrDocEnviar()
        // siempre termina llamando a closeQrDocModal()).
        qrDocLimpiarRetencionRenta();
        _cerrarModalAnimado('qrDocModalForm');
    }

    // ── Buscar proveedor/cliente por nombre, NIT, NRC o DUI ─────────────
    // Corrección 04 — El catálogo de Proveedores está clasificado por
    // anexo (`usos`: 'compras' | 'retenido' | 'excluido' — ver
    // proveedorTieneUso/proveedorUsosEfectivos, ya usado por los modales
    // manuales de Compras/Retención/Excluido). Esta búsqueda debe respetar
    // esa misma clasificación: al escanear un documento de Retención solo
    // deben aparecer proveedores marcados para 'retenido', y lo mismo para
    // Compras/Excluido — nunca proveedores que solo pertenecen a otro
    // anexo. QRDOC_LIBRO_INFO usa el código 'retencion' para ese libro,
    // mientras que el catálogo usa 'retenido' — de ahí el mapeo.
    var QRDOC_LIBRO_A_USO = { compras: 'compras', retencion: 'retenido', excluido: 'excluido' };

    function qrDocBuscarProveedor() {
        var info = QRDOC_LIBRO_INFO[qrDocState.libro];
        if (!info) return;
        var q = document.getElementById('qrDoc_provSearch').value.trim();
        var listEl = document.getElementById('qrDoc_provResults');
        if (!q) { acClose('qrDoc_provResults'); return; }

        var qNorm = q.toLowerCase();
        var catalogo = info.esCliente ? loadClientes() : loadProveedores();
        // Corrección 04 — filtra por el `uso` del anexo actual antes de
        // buscar por texto (los clientes de CCF no tienen este sistema de
        // clasificación, así que el filtro solo aplica a proveedores).
        var usoActual = QRDOC_LIBRO_A_USO[qrDocState.libro];
        if (!info.esCliente && usoActual) {
            catalogo = catalogo.filter(function(p) { return proveedorTieneUso(p, usoActual); });
        }
        var matches = catalogo.filter(function(p) {
            return (p.nombre && p.nombre.toLowerCase().indexOf(qNorm) !== -1) ||
                   (p.nit && p.nit.indexOf(q) !== -1) ||
                   (p.nrc && p.nrc.indexOf(q) !== -1) ||
                   (p.dui && p.dui.indexOf(q) !== -1);
        });
        if (!matches.length) { acClose('qrDoc_provResults'); return; }

        listEl.innerHTML = '';
        matches.slice(0, 8).forEach(function(p) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'autocomplete-item';
            item.innerHTML = '<span class="ac-id">' + (p.nit || p.nrc || p.dui || '') + '</span><span class="ac-name">' + (p.nombre || '<em style="color:var(--rp-text-secondary)">Sin nombre</em>') + '</span>';
            item.onclick = function() { qrDocSeleccionarProveedor(p); };
            listEl.appendChild(item);
        });
        listEl.classList.add('open');
    }

    function qrDocSeleccionarProveedor(p) {
        var info = QRDOC_LIBRO_INFO[qrDocState.libro];
        qrDocState.sel = p;
        acClose('qrDoc_provResults');
        document.getElementById('qrDoc_provBuscar').classList.add('hidden');
        document.getElementById('qrDoc_provNuevoForm').classList.add('hidden');
        document.getElementById('qrDoc_provElegido').classList.remove('hidden');
        document.getElementById('qrDoc_provElegidoK').innerText = info.esCliente ? 'Cliente seleccionado' : 'Proveedor seleccionado';
        var idTxt = p.nit || p.nrc || p.dui || '';
        document.getElementById('qrDoc_provElegidoTxt').innerText = (p.nombre || 'Sin nombre') + (idTxt ? ' — ' + idTxt : '');
    }

    function qrDocQuitarProveedor() {
        qrDocState.sel = null;
        document.getElementById('qrDoc_provElegido').classList.add('hidden');
        document.getElementById('qrDoc_provBuscar').classList.remove('hidden');
        document.getElementById('qrDoc_provSearch').value = '';
        document.getElementById('qrDoc_provSearch').focus();
    }

    function qrDocMostrarFormNuevoProveedor() {
        var info = QRDOC_LIBRO_INFO[qrDocState.libro];
        acClose('qrDoc_provResults');
        document.getElementById('qrDoc_provBuscar').classList.add('hidden');
        document.getElementById('qrDoc_provElegido').classList.add('hidden');
        document.getElementById('qrDoc_provNuevoForm').classList.remove('hidden');
        ['qrDoc_pn_nombre','qrDoc_pn_nit','qrDoc_pn_nrc','qrDoc_pn_dui'].forEach(function(id) { document.getElementById(id).value = ''; });
        var empSector = '1';
        if (activeEmpresaId) {
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.sector) empSector = empActiva.sector;
        }
        if (document.getElementById('qrDoc_pn_sector')) document.getElementById('qrDoc_pn_sector').value = empSector;
        if (document.getElementById('qrDoc_pn_clasif')) document.getElementById('qrDoc_pn_clasif').value = '1';
        if (document.getElementById('qrDoc_pn_tipoCosto')) document.getElementById('qrDoc_pn_tipoCosto').value = '1';
        document.getElementById('qrDoc_pn_nombre').focus();
    }

    function qrDocCancelarNuevoProveedor() {
        document.getElementById('qrDoc_provNuevoForm').classList.add('hidden');
        document.getElementById('qrDoc_provBuscar').classList.remove('hidden');
    }

    function qrDocUsarProveedorNuevo() {
        var info = QRDOC_LIBRO_INFO[qrDocState.libro];
        var nombre = document.getElementById('qrDoc_pn_nombre').value.trim();
        var nit = document.getElementById('qrDoc_pn_nit').value.trim();
        var nrc = document.getElementById('qrDoc_pn_nrc').value.trim();
        var dui = info.esCliente ? '' : document.getElementById('qrDoc_pn_dui').value.trim();

        if (nit && !isValidNitOrNrc(nit)) { showToast('El NIT no tiene un formato válido (0000-000000-000-0)', 'error'); return; }
        if (dui && !isValidDui(dui)) { showToast('El DUI no tiene un formato válido (00000000-0)', 'error'); return; }
        if (!nit && !nrc && !dui) { showToast('Ingresa al menos NIT, NRC o DUI', 'error'); return; }

        var p = { esNuevo: true, nombre: nombre, nit: nit, nrc: nrc };
        if (info.esCliente) {
            p.tipoOp = '1';
            p.tipoIng = (function() {
                var empActiva = activeEmpresaId ? empresas.find(function(e) { return e.id === activeEmpresaId; }) : null;
                return (empActiva && empActiva.tipoIng) || '1';
            })();
        } else {
            p.dui = dui;
            p.clasif = document.getElementById('qrDoc_pn_clasif').value;
            p.sector = document.getElementById('qrDoc_pn_sector').value;
            p.tipoCosto = document.getElementById('qrDoc_pn_tipoCosto').value;
            if (qrDocState.libro === 'excluido') {
                p.tipoDocEx = document.getElementById('qrDoc_pn_tipoDocEx').value;
                p.tipoOpEx = document.getElementById('qrDoc_pn_tipoOpEx').value;
            }
        }
        qrDocSeleccionarProveedor(p);
    }

    // ── Enviar: valida, arma el registro del anexo correspondiente y lo
    // guarda — exactamente el mismo esquema de registro que ya usa cada
    // libro (comprasRecords/cfRecords/debitoRecords/retenidoRecords/
    // excluidoRecords), y registra/actualiza el proveedor o cliente en su
    // catálogo real (autoRegistrarProveedor/autoRegistrarCliente), igual
    // que ya hacía el guardado manual de cada anexo. ──
    // ══════════════════════════════════════════════════════════════════
    // Cambio 05 — Punto único que arma y guarda el registro de un
    // documento escaneado en el anexo correspondiente. Es EXACTAMENTE la
    // misma lógica que antes vivía solo dentro de qrDocEnviar() (cálculos,
    // forma del registro, registro/actualización del proveedor o cliente
    // en su catálogo real) — se extrajo tal cual, sin cambiar una sola
    // fórmula, para poder reutilizarla desde DOS orígenes distintos sin
    // duplicar código:
    //   1) qrDocEnviar() — el usuario confirma en el modal "Documento
    //      Escaneado" de la PC (Modo Admin: "Solo computadora").
    //   2) _procesarResumenCompletadoCelular() — el usuario completó y
    //      envió el mismo resumen desde el teléfono (Modo Admin: "Resumen
    //      en celular").
    // 'campos' desacopla esta función de dónde vinieron los valores (DOM
    // en la PC, mensaje WebSocket del teléfono): { tipoDoc, monto,
    // esExenta, bienServicio, sel }. 'sel' es el proveedor/cliente elegido
    // o agregado (mismos campos que ya usaba qrDocState.sel).
    // Devuelve { ok, mensaje } — nunca lanza ni muestra el toast por su
    // cuenta, para que cada origen decida cómo informarlo (en la PC vía
    // showToast normal; hacia el teléfono vía window.qrScan.reportarResultado).
    // ══════════════════════════════════════════════════════════════════
    function _guardarRegistroEscaneo(libro, combinado, campos) {
        var info = QRDOC_LIBRO_INFO[libro];
        if (!info || !combinado) return { ok: false, mensaje: 'Datos del documento inválidos.' };

        campos = campos || {};
        var sel = campos.sel || null;

        if (!info.sinProveedor && !sel) {
            return { ok: false, mensaje: info.esCliente ? 'Falta seleccionar o agregar un cliente.' : 'Falta seleccionar o agregar un proveedor.' };
        }

        var fecha = combinado.fecha || '';
        var tipoDoc = info.sinTipoDoc ? '' : (campos.tipoDoc || info.tipoDocDefault);
        var monto = parseFloat(campos.monto) || 0;
        var esExenta = !!campos.esExenta;
        var bienServicioVal = campos.bienServicio || 'bien';
        var sello = combinado.selloRecepcion || '';
        var codGen = combinado.codGen || '';
        sel = sel || {};

        var empSector = '1', empTipoIng = '1';
        if (activeEmpresaId) {
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.sector) empSector = empActiva.sector;
            if (empActiva && empActiva.tipoIng) empTipoIng = empActiva.tipoIng;
        }

        var mensaje = '';

        if (libro === 'compras') {
            // Cambio 01 — FACTURA DE EXPORTACIÓN (tipoDoc '11'): no lleva
            // IVA, así que no se calcula crédito fiscal ni se envía a
            // "C. Internas Gravadas"; el monto va a "Importaciones Grav.
            // Bienes" o "Importaciones Grav. Servicios" según el selector
            // Bien/Servicio. Cualquier otro tipo de documento conserva
            // exactamente el cálculo previo (rama else).
            var esExportacionCp = (tipoDoc === '11');
            var credito = esExportacionCp ? 0 : monto * 0.13;
            var r = {
                fecha: fecha, clase: '4', tipoDoc: tipoDoc,
                numDoc: codGen, nit: (sel.nit || '').trim(), nrc: (sel.nrc || sel.nit || '').trim(),
                dui: (sel.dui || '').trim(), nombre: sel.nombre || '',
                intExentas: 0, internExentas: 0, impExentas: 0,
                intGravadas: esExportacionCp ? 0 : monto,
                internGrav: 0,
                impGrav: (esExportacionCp && bienServicioVal === 'bien') ? monto : 0,
                impServ: (esExportacionCp && bienServicioVal === 'servicio') ? monto : 0,
                credito: credito, total: esExportacionCp ? monto : (monto + credito),
                fovial: 0, cotrans: 0,
                tipoOp: '1', clasif: sel.clasif || '1', sector: sel.sector || empSector, tipoCosto: sel.tipoCosto || '1',
                selloRecepcion: sello, ivaPercibido: combinado.ivaPercibido || 0, _percLinkId: ''
            };
            comprasRecords.push(r);
            syncPercibidoFromCompra(r);
            saveCurrentMonthData();
            renderComprasTable();
            if (r.nit || r.nrc) { autoRegistrarProveedor(r.nit, r.nombre, r.dui, r.nrc, r.clasif, r.sector, r.tipoCosto, ['compras']); renderProveedoresTable(); }
            mensaje = 'Documento agregado al Libro de Compras ✓';

        } else if (libro === 'cf') {
            // Cambio 01 — FACTURA DE EXPORTACIÓN (tipoDoc '11'): no lleva
            // IVA; el monto va a "Exp. Fuera del Área C.A." (Bien) o
            // "Exportaciones de Servicios" (Servicio) según el selector,
            // en vez de Exentas/Gravadas. Cualquier otro tipo de documento
            // conserva exactamente el cálculo previo de exenta/gravada.
            var esExportacionCf = (tipoDoc === '11');
            var exentasVal = (!esExportacionCf && esExenta) ? monto : 0;
            var gravadasVal = (!esExportacionCf && !esExenta) ? monto : 0;
            var expFueraVal = (esExportacionCf && bienServicioVal === 'bien') ? monto : 0;
            var expServVal = (esExportacionCf && bienServicioVal === 'servicio') ? monto : 0;
            var r = {
                fecha: fecha, clase: '4', tipoDoc: tipoDoc,
                resolucion: combinado.numeroControl || '', serie: sello, maquina: '',
                ctrlDel: combinado.numeroControl || '', ctrlAl: combinado.numeroControl || '',
                docDel: codGen, docAl: codGen,
                exentas: exentasVal, exentaNosuj: 0, nosujetas: 0, gravadas: gravadasVal,
                expCa: 0, expFuera: expFueraVal, expServ: expServVal, zonas: 0, terceros: 0,
                total: exentasVal + gravadasVal + expFueraVal + expServVal, tipoOp: '1', tipoIng: empTipoIng
            };
            cfRecords.push(r);
            saveCurrentMonthData();
            renderCfTable();
            mensaje = 'Documento agregado a Consumidor Final ✓';

        } else if (libro === 'ccf') {
            var exentasValD = esExenta ? monto : 0;
            var gravadasValD = esExenta ? 0 : monto;
            var iva = gravadasValD * 0.13;
            var r = {
                fecha: fecha, clase: '4', tipoDoc: tipoDoc,
                resolucion: combinado.numeroControl || '', serie: sello, numDoc: codGen,
                nit: (sel.nit || '').trim(), nrc: (sel.nrc || sel.nit || '').trim(), dui: '', nombre: sel.nombre || '',
                ctrl: combinado.numeroControl || '',
                exentas: exentasValD, nosujetas: 0, gravadas: gravadasValD,
                iva: iva, tercero: 0, dfTercero: 0,
                total: gravadasValD + iva + exentasValD, tipoOp: sel.tipoOp || '1', tipoIng: sel.tipoIng || empTipoIng
            };
            debitoRecords.push(r);
            saveCurrentMonthData();
            renderDebitoTable();
            var nitCliente = (r.nit || r.nrc || '').trim();
            if (nitCliente) { var agregado = autoRegistrarCliente(nitCliente, r.nombre, r.nrc); if (agregado) renderClientesTable(); }
            mensaje = 'Documento agregado a Crédito Fiscal ✓';

        } else if (libro === 'retencion') {
            var r = {
                nit: (sel.nit || '').trim(), dui: (sel.dui || '').trim(), fecha: fecha,
                tipoDoc: tipoDoc, serie: sello, numDoc: codGen,
                monto: monto, iva: monto * 0.01,
                _nombreAgente: sel.nombre || ''
            };
            retenidoRecords.push(r);
            saveCurrentMonthData();
            renderRetenidoTable();
            if (r.nit || sel.nrc || r.dui) { autoRegistrarProveedor(r.nit, sel.nombre, r.dui, sel.nrc, sel.clasif || '1', sel.sector || empSector, sel.tipoCosto || '1', ['retenido']); renderProveedoresTable(); }
            mensaje = 'Documento agregado a Retenciones (Anexo 7) ✓';

        } else if (libro === 'excluido') {
            var nit = (sel.nit || '').trim(), dui = (sel.dui || '').trim();
            var identificacion = nit || dui || (sel.nrc || '').trim();
            var tipoDocSujeto = sel.tipoDocEx || (nit ? '1' : (dui ? '2' : '3'));
            var r = {
                tipoDoc: tipoDocSujeto, identificacion: identificacion, nombre: sel.nombre || '',
                fecha: fecha, serie: sello, numDoc: codGen,
                monto: monto, retencion: combinado.retencionRenta || 0,
                tipoOp: sel.tipoOpEx || '1', clasif: sel.clasif || '1', sector: sel.sector || empSector, tipoCosto: sel.tipoCosto || '1'
            };
            excluidoRecords.push(r);
            saveCurrentMonthData();
            renderExcluidoTable();
            if (nit || dui || sel.nrc) { autoRegistrarProveedor(nit, sel.nombre, dui, sel.nrc, r.clasif, r.sector, r.tipoCosto, ['excluido'], tipoDocSujeto, r.tipoOp); renderProveedoresTable(); }
            mensaje = 'Documento agregado a Sujeto Excluido (Anexo 5) ✓';
        } else {
            return { ok: false, mensaje: 'Anexo no reconocido.' };
        }

        return { ok: true, mensaje: mensaje };
    }

    // Modo Admin "Solo computadora" (por defecto) — el usuario confirma
    // aquí mismo, en el modal de la PC. Solo reúne los valores del DOM y
    // delega el guardado real a _guardarRegistroEscaneo (ver arriba).
    function qrDocEnviar() {
        var libro = qrDocState.libro;
        var info = QRDOC_LIBRO_INFO[libro];
        var combinado = qrDocState.combinado;
        if (!info || !combinado) return;

        if (!info.sinProveedor && !qrDocState.sel) {
            showToast(info.esCliente ? 'Selecciona o agrega un cliente antes de enviar' : 'Selecciona o agrega un proveedor antes de enviar', 'error');
            return;
        }

        var campos = {
            tipoDoc: info.sinTipoDoc ? '' : document.getElementById('qrDoc_tipoDoc').value,
            monto: document.getElementById('qrDoc_monto').value,
            esExenta: document.getElementById('qrDoc_exenta').checked,
            bienServicio: (document.getElementById('qrDoc_bienServicio') || {}).value || 'bien',
            sel: qrDocState.sel
        };

        var resultado = _guardarRegistroEscaneo(libro, combinado, campos);
        if (!resultado.ok) { showToast(resultado.mensaje, 'error'); return; }
        showToast(resultado.mensaje, 'success');
        closeQrDocModal();
    }