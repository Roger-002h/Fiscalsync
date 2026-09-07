// consulta-dte/ConsultaDTE.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // IMPLEMENTACIÓN 02 — Admin > Sistema > "Consulta DTE" (Slide)
    // Controla ÚNICAMENTE la visibilidad de los botones "Consulta DTE" y
    // de la columna "Estado DGII" de Libros IVA (vía la clase
    // body.fs-consulta-dte-oculta + reglas CSS definidas arriba). No toca
    // handlers IPC, la consulta al Ministerio, ni la lógica de Modo
    // Revisión que también muestra/oculta estos mismos elementos — ambas
    // conviven porque Modo Revisión usa style.display/clases en la propia
    // tabla y esta clase usa !important por CSS a nivel de body.
    // Persistencia: reutiliza fsStore (mismo sistema de almacenamiento que
    // ya usa el resto de FiscalSync) — sobrevive a cerrar y reabrir la app.
    // Compatibilidad: si la clave todavía no existe (instalaciones ya
    // instaladas antes de este cambio), el valor por defecto es ON.
    // ══════════════════════════════════════════════════════════════════
    var FS_CONSULTA_DTE_KEY = 'fs_consulta_dte_visible';

    function adminConsultaDteVisibleActual() {
        var raw = fsStore.getItem(FS_CONSULTA_DTE_KEY);
        if (raw === null || raw === undefined || raw === '') return true; // DEFAULT = ON
        return raw === true || raw === 'true';
    }

    // Aplica inmediatamente el estado actual a la interfaz (clase en <body>).
    // Se llama al iniciar la app y cada vez que el admin cambia el Slide —
    // no requiere reiniciar FiscalSync.
    function adminAplicarVisibilidadConsultaDte() {
        var visible = adminConsultaDteVisibleActual();
        document.body.classList.toggle('fs-consulta-dte-oculta', !visible);
    }

    // Sincroniza el checkbox del Slide con el valor guardado — se llama
    // cada vez que se abre la pestaña Sistema del panel Admin.
    function adminSyncConsultaDteToggleUI() {
        var chk = document.getElementById('adminToggleConsultaDte');
        if (chk) chk.checked = adminConsultaDteVisibleActual();
    }

    // Handler del onchange del Slide.
    function adminSetConsultaDteVisible(visible) {
        fsStore.setItem(FS_CONSULTA_DTE_KEY, !!visible);
        adminAplicarVisibilidadConsultaDte();
        showToast(visible ? 'Consulta DTE (botones y columna Estado DGII) visible en Libros IVA' : 'Consulta DTE (botones y columna Estado DGII) oculta en Libros IVA', 'success');
    }

    // ══════════════════════════════════════════════════════════════════
    // Admin > Sistema > Intervalo de Consulta DTE
    // Hacienda flexibilizó el límite: antes eran 15s fijos entre cada
    // consulta, ahora acepta un mínimo de 5s. En vez de dejarlo fijo en el
    // código, se guarda como configuración editable desde el panel Admin
    // (misma persistencia fsStore que el resto de ajustes de Sistema), para
    // poder ajustarlo sin tocar código si Hacienda vuelve a cambiar el
    // límite en el futuro.
    // Compatibilidad: si la clave todavía no existe (instalaciones ya
    // instaladas antes de este cambio), el valor por defecto es 5.
    // ══════════════════════════════════════════════════════════════════
    var FS_CONSULTA_DTE_INTERVALO_KEY = 'fs_consulta_dte_intervalo_segundos';
    var DGII_SEGUNDOS_ENTRE_CONSULTAS_DEFAULT = 5;

    function adminConsultaDteIntervaloActual() {
        var raw = fsStore.getItem(FS_CONSULTA_DTE_INTERVALO_KEY);
        var n = parseInt(raw, 10);
        if (isNaN(n) || n < 1) return DGII_SEGUNDOS_ENTRE_CONSULTAS_DEFAULT; // DEFAULT = 5
        return n;
    }

    // Sincroniza el input numérico del panel Sistema con el valor guardado
    // — se llama cada vez que se abre la pestaña Sistema del panel Admin.
    function adminSyncConsultaDteIntervaloUI() {
        var input = document.getElementById('adminConsultaDteIntervalo');
        if (input) input.value = adminConsultaDteIntervaloActual();
    }

    // Handler del onchange/blur del input numérico.
    function adminSetConsultaDteIntervalo(segundos) {
        var n = parseInt(segundos, 10);
        if (isNaN(n) || n < 1) {
            showToast('El intervalo debe ser un número entero de al menos 1 segundo', 'error');
            adminSyncConsultaDteIntervaloUI();
            return;
        }
        fsStore.setItem(FS_CONSULTA_DTE_INTERVALO_KEY, n);
        showToast('Intervalo de Consulta DTE actualizado a ' + n + (n === 1 ? ' segundo' : ' segundos'), 'success');
    }

    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 9 — Verificación de Estado DGII
    // Consulta el estado oficial de cada DTE en el Ministerio de Hacienda
    // (admin.factura.gob.sv/consultaPublica), documento por documento,
    // actualizando en vivo la columna "Estado DGII" de cada libro.
    // Es puramente informativo: no participa en cálculos, CSV ni impresión,
    // y no altera ningún campo ni funcionalidad existente del sistema.
    // ══════════════════════════════════════════════════════════════════
    var _dgiiConfig = {
        compras: { getRecords: function () { return comprasRecords; }, codField: 'numDoc', tbodyId: 'comprasTableBody', render: function () { renderComprasTable(); } },
        debito:  { getRecords: function () { return debitoRecords;  }, codField: 'numDoc', tbodyId: 'debitoTableBody',  render: function () { renderDebitoTable();  } },
        cf:      { getRecords: function () { return cfRecords;      }, codField: 'docDel', tbodyId: 'cfTableBody',      render: function () { renderCfTable();      } },
        // CAMBIO 02 — Compras a Sujeto Excluido (Anexo 5): reutiliza exactamente
        // la misma lógica de Consulta DTE (mismo botón, proceso, validaciones y
        // mensajes que en los demás anexos). Regla especial de este anexo: la
        // consulta debe limitarse ÚNICAMENTE a verificar y mostrar el estado del
        // documento (Transmitido / Invalidado / Con Evento / No encontrado /
        // Documento Físico / Error), sin ejecutar ninguna acción adicional. Esto
        // ya se cumple de forma natural porque el completado automático de
        // "Sello de Recepción" dentro de procesarDocumento() está condicionado
        // explícitamente a libro === 'compras' — para 'excluido' esa rama nunca
        // se ejecuta, así que no se completan ni actualizan campos del registro.
        excluido: { getRecords: function () { return excluidoRecords; }, codField: 'numDoc', tbodyId: 'excluidoTableBody', render: function () { renderExcluidoTable(); } },
        // Cambio 04 — IVA Percibido (Anexo 8), IVA Retenido (Anexo 7) y Anticipo a
        // Cuenta (Anexo 6): reutilizan exactamente la misma lógica de Consulta DTE
        // (mismo botón, proceso, validaciones y mensajes que en los demás anexos).
        // En estos tres libros, igual que en Compras/Débito/CF/Excluido, el campo
        // "N° Documento" (numDoc) contiene el codigoGeneracion del DTE.
        percibido: { getRecords: function () { return percibidoRecords; }, codField: 'numDoc', tbodyId: 'percibidoTableBody', render: function () { renderPercibidoTable(); } },
        retenido:  { getRecords: function () { return retenidoRecords;  }, codField: 'numDoc', tbodyId: 'retenidoTableBody',  render: function () { renderRetenidoTable();  } },
        anticipo:  { getRecords: function () { return anticipoRecords;  }, codField: 'numDoc', tbodyId: 'anticipoTableBody',  render: function () { renderAnticipoTable();  } }
    };

    var _dgiiEnCurso   = false;
    var _dgiiCancelar  = false;
    // ARREGLO 01 (puntos 19-21) — posición (dentro de la cola real visual)
    // del documento que se está procesando en este momento. La usan
    // dgiiMostrarReintento()/dgiiOcultarReintento() para reflejar el
    // reintento también en el ítem correspondiente de la lista "Ver
    // proceso", sin tener que pasar el dato a través de la señal IPC
    // 'dgii-reintento' (que main.js ya envía sin ese contexto).
    var _dgiiPosActualEnCola = -1;

    function dgiiEstadoLabel(code) {
        var map = {
            TRANSMITIDO:    'Transmitido',
            INVALIDADO:     'Invalidado',
            RECHAZADO:      'Rechazado',
            CON_EVENTO:     'Con Evento',
            NO_ENCONTRADO:  'No encontrado',
            ERROR:          'Error de consulta',
            FISICO:         'Documento Físico',
            SIN_VERIFICAR:  'Sin verificar'
        };
        return map[code] || 'Sin verificar';
    }

    // Construye el badge visual para la columna "Estado DGII".
    // estadoObj = { code, ts } — si es undefined/null se muestra "Sin verificar".
    function dgiiBadgeHtml(estadoObj) {
        var code  = (estadoObj && estadoObj.code) || 'SIN_VERIFICAR';
        var dot   = 'dgii-dot-' + code.toLowerCase();
        var label = dgiiEstadoLabel(code);
        var title;
        if (code === 'FISICO') {
            title = ' title="Documento físico — no tiene código de generación, no es un DTE electrónico y no se consulta en el Ministerio de Hacienda"';
        } else if (estadoObj && estadoObj.ts) {
            title = ' title="Última verificación: ' + new Date(estadoObj.ts).toLocaleString() + '"';
        } else {
            title = ' title="Aún no se ha verificado este documento"';
        }
        return '<span class="dgii-badge"' + title + '><span class="dgii-dot ' + dot + '"></span>' + label + '</span>';
    }

    // Rediseño (Cambio 01): además del texto largo de siempre (dgiiProgressText,
    // que se conserva tal cual para no romper nada que dependa de él) ahora
    // también actualiza el porcentaje grande y el contador "X / Y" del nuevo
    // diseño, y oculta el aviso de "Reintentando documento…" — si este
    // documento se acaba de completar, ya no está en reintento.
    var _dgiiActual = 0;
    var _dgiiTotalActual = 0;

    function dgiiActualizarProgreso(actual, total) {
        _dgiiActual = actual;
        _dgiiTotalActual = total;
        var texto = document.getElementById('dgiiProgressText');
        if (texto) texto.innerText = actual + ' de ' + total + ' documentos revisados';
        var pct = total > 0 ? Math.round((actual / total) * 100) : 0;
        var fill = document.getElementById('dgiiProgressFill');
        if (fill) fill.style.width = pct + '%';
        var pctText = document.getElementById('dgiiPercentText');
        if (pctText) pctText.innerText = pct + '%';
        var countText = document.getElementById('dgiiCountNum');
        if (countText) countText.innerText = actual + ' / ' + total;
        // Anillo circular (r=50 → circunferencia = 2π·50 ≈ 314.159)
        var ring = document.getElementById('dgiiRingFill');
        if (ring) {
            var circunferencia = 314.159;
            ring.style.strokeDashoffset = circunferencia * (1 - pct / 100);
        }
        dgiiOcultarReintento();
        var restantes = Math.max(total - actual, 0);
        var sub = document.getElementById('dgiiSubStatusText');
        if (sub) sub.innerText = restantes > 0 ? ('Restantes: ' + restantes + ' pendientes') : 'Finalizando…';

        // AGREGADO — Notificación persistente (punto 22): mismo progreso que
        // recibe el modal principal, reflejado también en #dgiiBgNotif.
        if (typeof dgiiBgNotifActualizar === 'function') dgiiBgNotifActualizar(actual, total);
    }

    // Corrección (Cambio 01): antes el modal se abría sin reiniciar el
    // porcentaje/contador, así que durante los primeros segundos (mientras
    // se resuelve la consulta del primer documento) se seguían viendo el
    // porcentaje y la cantidad de la verificación ANTERIOR.
    //
    // ARREGLO 01 (punto 1) — "Eliminar la pantalla de carga antigua": esta
    // función ya NO abre el modal #dgiiProgressModal automáticamente al
    // iniciar la Consulta DTE (antes agregaba la clase "dgii-open" aquí
    // mismo). Renombrada de dgiiAbrirModal() a dgiiInicializarProceso() para
    // reflejar lo que realmente hace ahora: reinicia todo el estado visual
    // (título, contadores, botones, resumen oculto) a 0/total de forma
    // síncrona ANTES de que arranque cualquier consulta, y muestra
    // únicamente la nueva notificación persistente (#dgiiBgNotif). El modal
    // solo se abre explícitamente cuando el usuario pulsa "Ver proceso →"
    // (ver dgiiVerProcesoAbrir(), antes dgiiReabrirModal — ver ARREGLO 02
    // punto 9), así que nunca coexisten la
    // pantalla de carga antigua y la notificación persistente: solo puede
    // haber, como mucho, una de las dos visibles a la vez, nunca ambas.
    function dgiiInicializarProceso(total) {
        var box = document.getElementById('dgiiSummaryBox');
        if (box) box.style.display = 'none';
        var wrap = document.getElementById('dgiiProgressWrap');
        if (wrap) wrap.style.display = '';
        var btnCancelar = document.getElementById('dgiiBtnCancelar');
        if (btnCancelar) { btnCancelar.style.display = ''; btnCancelar.disabled = false; }
        var btnCerrar = document.getElementById('dgiiBtnCerrar');
        if (btnCerrar) btnCerrar.style.display = 'none';
        // AGREGADO — botón "Ocultar" (punto 28): solo visible mientras el
        // proceso está activo, junto con "Cancelar".
        var btnOcultar = document.getElementById('dgiiBtnOcultar');
        if (btnOcultar) btnOcultar.style.display = '';

        // Encabezado: título/subtítulo por defecto, pill final oculta,
        // icono de vuelta al escudo azul.
        var titulo = document.getElementById('dgiiSumTitle');
        if (titulo) titulo.innerText = 'Verificación de Estado DGII';
        var sub = document.getElementById('dgiiHeaderSub');
        if (sub) sub.style.display = '';
        var estadoFinal = document.getElementById('dgiiStatusLabel');
        if (estadoFinal) estadoFinal.style.display = 'none';
        var icon = document.getElementById('dgiiHeaderIcon');
        if (icon) { icon.className = 'dgii-header-icon'; icon.innerHTML = '<i data-lucide="shield"></i>'; }

        var errEl = document.getElementById('dgiiUltimoError');
        if (errEl) errEl.innerText = '';
        dgiiOcultarReintento();
        dgiiActualizarProgreso(0, total || 0);
        // ARREGLO 02 (puntos 8-14) — al arrancar un lote nuevo todavía no hay
        // ninguna muestra real de tiempo de consulta, así que se muestra
        // "Calculando…" en vez de un número inventado hasta que termine la
        // primera consulta real y dgiiActualizarTiempoEstimado() tenga datos
        // reales con los que trabajar.
        ['dgiiTiempoRestanteText', 'dgiiBgTiempoRestante', 'dgiiBgMiniTiempo'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.innerText = 'Calculando…';
        });
        // ARREGLO 01 (puntos 19-21) — limpia la lista visual de la cola real;
        // se vuelve a poblar justo después, en dgiiIniciarVerificacion, con
        // los documentos que realmente entrarán a la cola de este lote.
        if (typeof dgiiColaInicializar === 'function') dgiiColaInicializar();
        if (window.lucide) lucide.createIcons();

        // AGREGADO — Notificación persistente (puntos 19-20): aparece al
        // iniciar la Consulta DTE y permanece visible aunque el usuario no
        // haya abierto (ni oculte) el modal #dgiiProgressModal — que, desde
        // ARREGLO 01, ya no se abre solo. Es la ÚNICA representación visual
        // que aparece automáticamente al iniciar el proceso.
        if (typeof dgiiBgNotifMostrar === 'function') {
            dgiiBgNotifMostrar();
            dgiiBgNotifExpandir();
            // REDISEÑO FINAL — un lote nuevo siempre arranca en la cara
            // "resumen" del módulo, nunca en la cara "cola" de un lote
            // anterior que pudiera haber quedado abierta.
            var _bgCont = document.getElementById('dgiiBgNotif');
            if (_bgCont) _bgCont.classList.remove('dgii-bg-queue-mode');
            var _docCode = document.getElementById('dgiiBgCurrentDocCode');
            if (_docCode) _docCode.textContent = '—';
            dgiiBgNotifSetEstado('procesando');
            dgiiBgNotifActualizar(0, total || 0);
        }
        // REDISEÑO FINAL (sección 5) — arranca el reflejo, de solo lectura,
        // del documento en curso en la vista abierta del módulo.
        if (typeof dgiiBgNotifIniciarSyncDoc === 'function') dgiiBgNotifIniciarSyncDoc();
    }

    // ARREGLO 02 (punto 9, 26) — pantalla dedicada para "Ver proceso →".
    //
    // Antes, "Ver proceso" simplemente reabría el mismo modal que arranca un
    // lote nuevo (dgiiReabrirModal → #dgiiProgressModal), reutilizando su
    // función tal cual. Ahora tiene su propio punto de entrada con nombre
    // propio (dgiiVerProcesoAbrir), que deja explícito que es una vista
    // dedicada a VISUALIZAR el proceso real que ya está en curso — nunca
    // arranca nada, nunca reinicia el progreso ni la cola (punto 26: "no
    // debe reiniciar la cola; no debe volver a consultar; no debe duplicar
    // documentos; no debe poner el contador en 0; no debe crear otro proceso
    // paralelo" — de hecho no toca `_dgiiEnCurso`, `colaTurnos` ni ningún
    // otro estado del motor de consulta, solo hace visible el DOM).
    //
    // Sigue usando el mismo elemento #dgiiProgressModal/.dgii-progress-card
    // que ya tiene exactamente el ancho, alto, bordes y estética pedidos
    // (punto 9: "el mismo ancho; el mismo alto; la misma presencia visual;
    // el mismo estilo... que Consulta DTE — Procesando en segundo plano") —
    // no se recrea una segunda tarjeta con estilos duplicados (punto 28: no
    // rehacer completamente la base existente), pero deja de estar acoplado
    // conceptualmente al flujo de "abrir para EMPEZAR un lote" — ese flujo
    // (dgiiInicializarProceso) ya no abre este modal en absoluto desde
    // ARREGLO 01, así que #dgiiProgressModal ahora solo se abre desde aquí.
    function dgiiVerProcesoAbrir() {
        var m = document.getElementById('dgiiProgressModal');
        if (!m) return;
        m.classList.remove('dgii-closing');
        m.classList.add('dgii-open');
        // Refleja de inmediato el tiempo estimado ya calculado (si el lote
        // llevaba rato corriendo en segundo plano, no hay que esperar al
        // próximo tick para verlo).
        var elModal = document.getElementById('dgiiTiempoRestanteText');
        if (elModal && typeof _dgiiUltimoTiempoRestanteMs === 'number') {
            elModal.innerText = _dgiiEnCurso ? dgiiFormatoTiempoRestante(_dgiiUltimoTiempoRestanteMs) : elModal.innerText;
        }
        if (window.lucide) lucide.createIcons();
    }

    function dgiiCerrarModal() {
        var m = document.getElementById('dgiiProgressModal');
        if (!m) return;
        // AJUSTADO — Cambio 07 (5ta vuelta): cierre animado (ver CSS de
        // #dgiiProgressModal.dgii-closing). Se agrega "dgii-closing" para
        // que se vea el fundido/pop de salida y, recién cuando termina, se
        // quita "dgii-open" (que es lo que controla la visibilidad real).
        m.classList.add('dgii-closing');
        m.classList.remove('dgii-open');
        setTimeout(function() { m.classList.remove('dgii-closing'); }, 150);
    }

    function dgiiCancelarVerificacion() {
        _dgiiCancelar = true;
        var btnCancelar = document.getElementById('dgiiBtnCancelar');
        if (btnCancelar) { btnCancelar.disabled = true; }
        var live = document.getElementById('dgiiLiveStatus');
        if (live) { live.className = 'dgii-well-live'; live.innerHTML = '<span class="dgii-spin"></span> Cancelando…'; }
        if (window.fiscalAPI && window.fiscalAPI.cancelarVerificacionDTE) {
            window.fiscalAPI.cancelarVerificacionDTE();
        }
    }

    // AGREGADO — Indicador visual de reintento (Cambio 01): solo cambia lo
    // que se MUESTRA en pantalla. La lógica real de reintentos (cuándo se
    // reintenta, cuántas veces, con qué condición) vive intacta en main.js
    // (ver 'verificar-dte-mh') y no se toca en absoluto aquí.
    function dgiiMostrarReintento() {
        var live = document.getElementById('dgiiLiveStatus');
        if (live) { live.className = 'dgii-well-live dgii-well-live-retry'; live.innerHTML = '<span class="dgii-spin"></span> Reintentando documento…'; }
        var sub = document.getElementById('dgiiSubStatusText');
        if (sub) sub.innerText = 'Obteniendo respuesta del servidor DGII';

        // AGREGADO — Notificación persistente: refleja el mismo aviso de
        // reintento en #dgiiBgNotif, aunque el usuario haya ocultado el modal.
        if (typeof dgiiBgNotifSetEstado === 'function') dgiiBgNotifSetEstado('reintentando');
        // ARREGLO 01 (puntos 19-21) — refleja el mismo reintento en el ítem
        // de la cola visual que se está procesando ahora mismo.
        if (typeof dgiiColaSetEstado === 'function' && _dgiiPosActualEnCola >= 0) {
            dgiiColaSetEstado(_dgiiPosActualEnCola, 'REINTENTO');
        }
    }

    function dgiiOcultarReintento() {
        var badge = document.getElementById('dgiiRetryBadge');
        if (badge) badge.style.display = 'none';
        var live = document.getElementById('dgiiLiveStatus');
        if (live && live.classList.contains('dgii-well-live-retry')) {
            live.className = 'dgii-well-live';
            live.innerHTML = '<span class="dgii-spin"></span> Verificando documentos…';
            var restantes = Math.max(_dgiiTotalActual - _dgiiActual, 0);
            var sub = document.getElementById('dgiiSubStatusText');
            if (sub) sub.innerText = restantes > 0 ? ('Restantes: ' + restantes + ' pendientes') : 'Finalizando…';
        }
        // AGREGADO — Notificación persistente: vuelve al estado "procesando"
        // una vez que el reintento terminó (mismo criterio que el modal
        // principal: solo si estaba mostrando el aviso de reintento).
        if (typeof dgiiBgNotifSetEstado === 'function' && _dgiiBgEstado === 'reintentando') {
            dgiiBgNotifSetEstado('procesando');
        }
        // ARREGLO 01 — el ítem de la cola vuelve a "Verificando..." si seguía
        // marcado como reintento (el resultado final, cuando llegue, lo
        // reemplaza por su estado RESUELTO_*/ERROR real — ver procesarDocumento).
        if (typeof dgiiColaSetEstado === 'function' && _dgiiPosActualEnCola >= 0 &&
            _dgiiColaVisual[_dgiiPosActualEnCola] && _dgiiColaVisual[_dgiiPosActualEnCola].estado === 'REINTENTO') {
            dgiiColaSetEstado(_dgiiPosActualEnCola, 'EN_PROCESO');
        }
    }

    // Escucha el aviso de reintento que manda main.js (ver preload.js /
    // onReintentoDTE) — se registra una sola vez, igual que el resto de
    // listeners de window.fiscalAPI en este archivo.
    if (window.fiscalAPI && window.fiscalAPI.onReintentoDTE) {
        window.fiscalAPI.onReintentoDTE(function () {
            dgiiMostrarReintento();
        });
    }

    // AGREGADO — "Hacienda no disponible" (punto 24): refleja en el modal
    // principal Y en la notificación persistente el mismo aviso real que
    // manda main.js cuando detecta varios documentos SEGUIDOS fallando tras
    // su reintento (ver 'dgii-hacienda-no-disponible' / '...-disponible' en
    // main.js/preload.js). No es una simulación: es el mismo evento que ya
    // dispara la pausa real del lote del lado del proceso principal.
    function dgiiMostrarHaciendaNoDisponible(segundos) {
        var live = document.getElementById('dgiiLiveStatus');
        if (live) {
            live.className = 'dgii-well-live dgii-well-live-retry';
            live.innerHTML = '<span class="dgii-spin"></span> Esperando disponibilidad de Hacienda';
        }
        var sub = document.getElementById('dgiiSubStatusText');
        if (sub) sub.innerText = 'El proceso continuará automáticamente.';
        if (typeof dgiiBgNotifSetEstado === 'function') dgiiBgNotifSetEstado('hacienda_no_disponible', { countdown: segundos });
    }

    function dgiiOcultarHaciendaNoDisponible() {
        if (typeof dgiiBgNotifSetEstado === 'function' && _dgiiBgEstado === 'hacienda_no_disponible') {
            dgiiBgNotifSetEstado('reanudando');
            // Vuelve a "procesando" un instante después, igual que hace el
            // modal principal al reflejar el siguiente documento completado.
            setTimeout(function () {
                if (_dgiiBgEstado === 'reanudando') dgiiBgNotifSetEstado('procesando');
            }, 1500);
        }
        dgiiOcultarReintento();
    }

    if (window.fiscalAPI && window.fiscalAPI.onHaciendaNoDisponible) {
        window.fiscalAPI.onHaciendaNoDisponible(function (data) {
            dgiiMostrarHaciendaNoDisponible(data && data.segundos ? data.segundos : null);
        });
    }
    if (window.fiscalAPI && window.fiscalAPI.onHaciendaDisponible) {
        window.fiscalAPI.onHaciendaDisponible(function () {
            dgiiOcultarHaciendaNoDisponible();
        });
    }

    function dgiiActualizarCeldaEnVivo(libro, index, estadoObj) {
        var cfg = _dgiiConfig[libro];
        if (!cfg) return;
        var tbody = document.getElementById(cfg.tbodyId);
        if (!tbody) return;
        var row = tbody.children[index];
        if (!row) return;
        var celda = row.querySelector('.dgii-col-td');
        if (celda) celda.innerHTML = dgiiBadgeHtml(estadoObj);
    }

    // ══════════════════════════════════════════════════════════════════
    // ARREGLO 01 (puntos 19-22) — COLA REAL VISUAL para el panel "Ver
    // proceso". No es una lista simulada ni independiente: se construye una
    // sola vez por lote, con exactamente los mismos documentos e índices que
    // usa el motor de consulta (ver `indicesPendientes`/`_itemsCola` en
    // dgiiIniciarVerificacion), y se actualiza en vivo, ítem por ítem, según
    // ese mismo motor va resolviendo cada documento — nunca al revés.
    // ══════════════════════════════════════════════════════════════════
    var _dgiiColaVisual = []; // [{ label, estado, detalle }], índice = posición en la cola real

    // AJUSTADO — íconos como SVG inline (mismo patrón stroke="currentColor"
    // que el resto de íconos de FiscalSync) en vez de emojis, para que se
    // vean consistentes entre sistema operativo/fuente y con el resto de la
    // interfaz. Cada svg hereda el color de texto de su fila vía "currentColor"
    // (ver CSS .dgii-cola-resuelto/.dgii-cola-proceso/etc.), así que no llevan
    // color propio.
    var DGII_COLA_ICONS = {
        check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
        dot:    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>',
        clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
        alert:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5H2.5L12 3.5z"/><path d="M12 10v4"/><circle cx="12" cy="16.7" r="0.9" fill="currentColor" stroke="none"/></svg>'
    };

    function dgiiColaEstadoInfo(estado) {
        switch (estado) {
            case 'RESUELTO_TRANSMITIDO': return { icon: DGII_COLA_ICONS.check, clase: 'dgii-cola-resuelto',   texto: 'Transmitido' };
            case 'RESUELTO_INVALIDADO':  return { icon: DGII_COLA_ICONS.check, clase: 'dgii-cola-resuelto',   texto: 'Invalidado' };
            case 'RESUELTO_FISICO':      return { icon: DGII_COLA_ICONS.check, clase: 'dgii-cola-resuelto',   texto: 'Documento Físico' };
            case 'RESUELTO_OTRO':        return { icon: DGII_COLA_ICONS.check, clase: 'dgii-cola-resuelto',   texto: 'Resuelto' };
            case 'EN_PROCESO':           return { icon: DGII_COLA_ICONS.dot,   clase: 'dgii-cola-proceso',    texto: 'Verificando...' };
            case 'ESPERANDO':            return { icon: DGII_COLA_ICONS.clock, clase: 'dgii-cola-pendiente', texto: 'Esperando ' + adminConsultaDteIntervaloActual() + ' segundos...' };
            // ARREGLO 02 (puntos 3, 5, 11) — un documento que falló su
            // PRIMER intento y todavía tiene derecho a un reintento ya NO se
            // muestra como "Error": se muestra como "Pendiente de reintento"
            // (documento visualmente distinto de un "Error de consulta"
            // definitivo, aunque comparta la misma familia de color de
            // aviso) y permanece así, esperando su turno real en la cola,
            // hasta que le toque procesarse de nuevo.
            case 'PENDIENTE_REINTENTO':  return { icon: DGII_COLA_ICONS.alert, clase: 'dgii-cola-reintento', texto: 'Pendiente de reintento' };
            // "Reintentando..." se usa ÚNICAMENTE mientras se está
            // ejecutando la consulta del segundo (y último) intento de este
            // documento — es decir, cuando le llegó su turno real en la cola.
            case 'REINTENTO':            return { icon: DGII_COLA_ICONS.alert, clase: 'dgii-cola-reintento', texto: 'Reintentando...' };
            // El estado final "Error de consulta" (ver dgiiEstadoLabel) solo
            // se usa cuando el documento ya consumió su único reintento y
            // sigue sin poder resolverse (punto 5 de ARREGLO 02) — nunca
            // antes. No se usa "Error" cuando el problema es indisponibilidad
            // de Hacienda a nivel de LOTE (punto 21 de ARREGLO 01) — ese caso
            // se refleja aparte, en la notificación persistente y el modal
            // (ver dgiiMostrarHaciendaNoDisponible), no en el ítem del
            // documento, que permanece en su estado de proceso/reintento
            // mientras dura la pausa.
            case 'ERROR':                return { icon: DGII_COLA_ICONS.alert, clase: 'dgii-cola-reintento', texto: 'Error de consulta' };
            default:                     return { icon: DGII_COLA_ICONS.clock, clase: 'dgii-cola-pendiente', texto: 'Pendiente' };
        }
    }

    function dgiiColaFilaHtml(pos, item) {
        var info = dgiiColaEstadoInfo(item.estado);
        var texto = item.detalle || info.texto;
        return '<div class="dgii-cola-item ' + info.clase + '" id="dgiiColaItem_' + pos + '">' +
                 '<span class="dgii-cola-icon">' + info.icon + '</span>' +
                 '<span class="dgii-cola-label">' + item.label + '</span>' +
                 '<span class="dgii-cola-detalle">' + texto + '</span>' +
               '</div>';
    }

    // Limpia la lista (llamada desde dgiiInicializarProceso, antes de que se
    // conozca la cola real del nuevo lote).
    function dgiiColaInicializar() {
        _dgiiColaVisual = [];
        var cont = document.getElementById('dgiiQueueList');
        if (cont) cont.innerHTML = '';
        var vacio = document.getElementById('dgiiQueueEmpty');
        if (vacio) vacio.style.display = '';
    }

    // Puebla la lista con la cola real de este lote (una sola vez).
    function dgiiColaPoblar(items) {
        _dgiiColaVisual = items || [];
        var cont = document.getElementById('dgiiQueueList');
        if (!cont) return;
        var html = '';
        for (var i = 0; i < _dgiiColaVisual.length; i++) html += dgiiColaFilaHtml(i, _dgiiColaVisual[i]);
        cont.innerHTML = html;
        var vacio = document.getElementById('dgiiQueueEmpty');
        if (vacio) vacio.style.display = 'none';
    }

    // Actualiza en vivo un único ítem (punto 22) sin volver a construir toda
    // la lista — importante para no perder fluidez con cientos de documentos.
    function dgiiColaSetEstado(pos, estado, detalle) {
        if (!_dgiiColaVisual[pos]) return;
        _dgiiColaVisual[pos].estado = estado;
        _dgiiColaVisual[pos].detalle = detalle || '';
        var el = document.getElementById('dgiiColaItem_' + pos);
        if (!el) return;
        var info = dgiiColaEstadoInfo(estado);
        el.className = 'dgii-cola-item ' + info.clase;
        var iconEl = el.querySelector('.dgii-cola-icon');
        if (iconEl) iconEl.innerHTML = info.icon;
        var detEl = el.querySelector('.dgii-cola-detalle');
        if (detEl) detEl.textContent = detalle || info.texto;
        // Mantiene el documento en curso visible dentro del scroll de la lista.
        if (estado === 'EN_PROCESO' && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }

    // ══════════════════════════════════════════════════════════════════
    // ARREGLO 02 (puntos 8-14, 19-21) — TIEMPO ESTIMADO RESTANTE.
    //
    // Se calcula de forma dinámica, nunca con un valor fijo inventado:
    // turnosRestantes × (tiempo promedio real de consulta + intervalo
    // obligatorio configurado en Admin > Sistema — ver
    // adminConsultaDteIntervaloActual()), más lo que quede del intervalo
    // en curso si el proceso está esperando ahora mismo. `turnosRestantes` es simplemente
    // `colaTurnos.length` — la MISMA cola real que usa correrColaSecuencial,
    // así que cualquier reintento pendiente ya está contado automáticamente
    // (un reintento es un turno más en esa cola, ver ARREGLO 02 punto 4) sin
    // necesidad de sumarlo aparte. El promedio se recalcula con cada
    // consulta real que termina, así que la precisión mejora conforme
    // avanza el lote (punto 13).
    // ══════════════════════════════════════════════════════════════════
    function dgiiFormatoTiempoRestante(ms) {
        if (!(ms > 0)) return '0 s';
        var segTotales = Math.round(ms / 1000);
        var min = Math.floor(segTotales / 60);
        var seg = segTotales % 60;
        if (min <= 0) return seg + ' s';
        return min + ' min ' + (seg < 10 ? '0' : '') + seg + ' s';
    }

    // esperaActualMs: milisegundos que quedan del intervalo EN CURSO
    // (0 si no se está esperando en este instante — ver dgiiEsperarIntervaloObligatorio).
    // total/completados: para poder mostrar "Finalizando…" cuando ya no hay nada pendiente.
    // colaReal: la cola real de turnos pendientes (colaTurnos) del lote actual.
    // promedioMs: tiempo promedio real de consulta (dinámico, ver _dgiiTiempoPromedioMs).
    function dgiiCalcularTiempoRestanteMs(esperaActualMs, colaReal, promedioMs) {
        var turnosRestantes = (colaReal && colaReal.length) || 0;
        if (turnosRestantes === 0) return Math.max(esperaActualMs || 0, 0);
        var porTurno = (promedioMs || 4000) + (adminConsultaDteIntervaloActual() * 1000);
        return (turnosRestantes * porTurno) + Math.max(esperaActualMs || 0, 0);
    }

    var _dgiiUltimoTiempoRestanteMs = 0;

    function dgiiActualizarTiempoEstimado(esperaActualMs, total, completados, colaReal, promedioMs) {
        var restantes = (total || 0) - (completados || 0);
        var ms = restantes > 0 ? dgiiCalcularTiempoRestanteMs(esperaActualMs, colaReal, promedioMs) : 0;
        _dgiiUltimoTiempoRestanteMs = ms;
        var texto = restantes > 0 ? dgiiFormatoTiempoRestante(ms) : 'Finalizando…';

        // Modal "Ver proceso" (expandido)
        var elModal = document.getElementById('dgiiTiempoRestanteText');
        if (elModal) elModal.innerText = texto;

        // Notificación persistente — vista expandida (punto 20)
        var elBg = document.getElementById('dgiiBgTiempoRestante');
        if (elBg) elBg.innerText = restantes > 0 ? ('Tiempo restante: ' + texto) : 'Finalizando…';

        // Notificación persistente — vista minimizada, rediseñada (puntos 11, 21)
        var elMini = document.getElementById('dgiiBgMiniTiempo');
        if (elMini) elMini.innerText = restantes > 0 ? ('≈ ' + dgiiFormatoTiempoRestante(ms)) : 'Finalizando…';
    }

    function dgiiMostrarResumen(resumen, total, cancelado) {
        dgiiOcultarReintento();
        // REDISEÑO FINAL — el lote terminó: detiene el reflejo del
        // documento en curso (sección 5) y regresa el módulo compacto a su
        // cara "resumen" (si el usuario se había quedado viendo la cola).
        if (typeof dgiiBgNotifDetenerSyncDoc === 'function') dgiiBgNotifDetenerSyncDoc();
        var _bgContFin = document.getElementById('dgiiBgNotif');
        if (_bgContFin) _bgContFin.classList.remove('dgii-bg-queue-mode');
        // ARREGLO 02 — el lote terminó (completo o cancelado): ya no hay
        // ningún tiempo restante que estimar.
        ['dgiiTiempoRestanteText', 'dgiiBgTiempoRestante', 'dgiiBgMiniTiempo'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.innerText = cancelado ? 'Cancelado' : '0 s';
        });
        var wrap = document.getElementById('dgiiProgressWrap');
        if (wrap) wrap.style.display = 'none';
        var btnCancelar = document.getElementById('dgiiBtnCancelar');
        if (btnCancelar) btnCancelar.style.display = 'none';
        var btnCerrar = document.getElementById('dgiiBtnCerrar');
        if (btnCerrar) btnCerrar.style.display = '';
        // AGREGADO — botón "Ocultar" (punto 28): ya no aplica una vez que el
        // lote terminó/se canceló — "Cerrar" pasa a ser la única acción.
        var btnOcultar = document.getElementById('dgiiBtnOcultar');
        if (btnOcultar) btnOcultar.style.display = 'none';

        var box = document.getElementById('dgiiSummaryBox');
        if (!box) return;
        box.style.display = '';

        document.getElementById('dgiiSumTitle').innerText = cancelado ? 'Verificación Cancelada' : 'Verificación Completa';

        // Encabezado: se oculta el subtítulo de "proceso en segundo plano" y
        // se muestra la pill final (verde si terminó bien, gris si se canceló).
        var sub = document.getElementById('dgiiHeaderSub');
        if (sub) sub.style.display = 'none';
        var icon = document.getElementById('dgiiHeaderIcon');
        if (icon) {
            icon.className = 'dgii-header-icon ' + (cancelado ? 'dgii-icon-cancel' : 'dgii-icon-success');
            icon.innerHTML = cancelado ? '<i data-lucide="x"></i>' : '<i data-lucide="check"></i>';
        }
        var estadoFinal = document.getElementById('dgiiStatusLabel');
        if (estadoFinal) {
            estadoFinal.style.display = 'inline-flex';
            estadoFinal.className = 'dgii-v2-status' + (cancelado ? ' dgii-v2-status-cancel' : '');
            estadoFinal.innerHTML = cancelado
                ? '<i data-lucide="x"></i> Proceso Cancelado'
                : '<i data-lucide="check"></i> Proceso Finalizado';
        }

        document.getElementById('dgiiSumTotal').innerText          = total;
        document.getElementById('dgiiSumTransmitidos').innerText   = resumen.transmitidos;
        document.getElementById('dgiiSumInvalidados').innerText    = resumen.invalidados;
        document.getElementById('dgiiSumFisicos').innerText        = resumen.fisicos;
        document.getElementById('dgiiSumErrores').innerText        = resumen.errores;

        if (window.lucide) lucide.createIcons();

        // AGREGADO — Notificación persistente (punto 29-F): refleja el mismo
        // cierre de lote (completado o cancelado) que acaba de mostrar el
        // modal principal, y programa su auto-ocultado.
        if (typeof dgiiBgNotifFinalizar === 'function') dgiiBgNotifFinalizar(resumen, total, cancelado);
    }

    // Normaliza cualquier formato de fecha soportado por la app (YYYY-MM-DD,
    // DD/MM/YYYY, D/M/YYYY, con o sin ceros a la izquierda, separador '/' o '-')
    // al formato estricto YYYY-MM-DD con ceros a la izquierda, que es el que
    // espera window.fiscalAPI.verificarEstadoDTE (ver preload.js). Devuelve ''
    // si la fecha no se pudo interpretar.
    function dgiiNormalizarFechaISO(val) {
        if (!val) return '';
        var s = val.toString().trim();
        var day, month, year;

        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
            var parts = s.split('-');
            year = parts[0]; month = parts[1]; day = parts[2];
        } else if (s.indexOf('/') !== -1) {
            var p = s.split('/');
            if (p[0].length === 4) { year = p[0]; month = p[1]; day = p[2]; }
            else { day = p[0]; month = p[1]; year = p[2]; }
        } else if (s.indexOf('-') !== -1) {
            var p2 = s.split('-');
            if (p2[0].length === 4) { year = p2[0]; month = p2[1]; day = p2[2]; }
            else { day = p2[0]; month = p2[1]; year = p2[2]; }
        } else {
            return '';
        }

        day = String(day).trim().padStart(2, '0');
        month = String(month).trim().padStart(2, '0');
        year = String(year).trim();

        if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return '';
        return year + '-' + month + '-' + day;
    }

    // Punto de entrada — llamado desde el botón "Consulta DTE" de cada libro
    function dgiiIniciarVerificacion(libro) {
        if (_dgiiEnCurso) { showToast('Ya hay una verificación en curso', 'error'); return; }
        if (!window.fiscalAPI || !window.fiscalAPI.verificarEstadoDTE) {
            showToast('La verificación de Estado DGII solo está disponible en la aplicación de escritorio', 'error');
            return;
        }
        var cfg = _dgiiConfig[libro];
        if (!cfg) return;
        var records = cfg.getRecords();
        if (!records.length) { showToast('No hay documentos en este libro', 'error'); return; }

        // ARREGLO 01 (puntos 3, 13, 23) — un documento con resultado válido
        // (Transmitido o Invalidado) de una consulta anterior se considera
        // RESUELTO y no vuelve a entrar a la cola, aunque el usuario ejecute
        // Consulta DTE de nuevo más tarde. La cola real solo contiene los
        // índices (dentro de `records`) que de verdad necesitan consulta:
        // nunca consultados, pendientes, o con error pendiente de reintento.
        // `indicesPendientes[pos]` traduce cada posición de la cola visual
        // a su índice real dentro de `records` (y de la tabla del libro).
        var indicesPendientes = [];
        for (var _i = 0; _i < records.length; _i++) {
            var _codeActual = records[_i].estadoDGII && records[_i].estadoDGII.code;
            if (_codeActual === 'TRANSMITIDO' || _codeActual === 'INVALIDADO') continue;
            indicesPendientes.push(_i);
        }
        if (!indicesPendientes.length) {
            showToast('Todos los documentos de este libro ya están resueltos (Transmitido/Invalidado) — no hay nada que consultar.', 'success');
            return;
        }

        _dgiiEnCurso  = true;
        _dgiiCancelar = false;
        if (window.fiscalAPI.resetCancelacionDTE) window.fiscalAPI.resetCancelacionDTE();

        // CAMBIO 01 — Corrección de actualización: 'total' se calcula ANTES
        // de reiniciar el estado visual para poder reiniciar el porcentaje y
        // el contador a 0/total de inmediato (ver dgiiInicializarProceso),
        // en vez de dejar visibles por unos segundos el porcentaje y la
        // cantidad de la verificación anterior mientras se resuelve la
        // primera consulta. ARREGLO 01 (punto 23): `total` ahora es la
        // cantidad REAL de documentos pendientes, no records.length.
        var total       = indicesPendientes.length;
        var resumen     = { transmitidos: 0, invalidados: 0, conEvento: 0, noEncontrados: 0, fisicos: 0, errores: 0 };
        var completados = 0;
        dgiiInicializarProceso(total);

        // ARREGLO 01 (puntos 19-21) — puebla la cola visual real del panel
        // "Ver proceso" con exactamente los documentos que van a consultarse
        // en este lote, en el mismo orden en que se procesarán.
        var _itemsCola = indicesPendientes.map(function (idxReal) {
            var reg = records[idxReal];
            var etiqueta = (reg[cfg.codField] || '').trim() || ('Documento ' + (idxReal + 1));
            return { label: etiqueta, estado: 'PENDIENTE', detalle: '' };
        });
        if (typeof dgiiColaPoblar === 'function') dgiiColaPoblar(_itemsCola);

        // AGREGADO NUEVO: contadores para la notificación de Sellos de Recepción
        // completados automáticamente (Compras + IVA Percibido — Anexo 8) durante
        // este lote de Consultar DTE.
        var sellosAgregados      = 0;
        var percibidoActualizado = false;

        // ══════════════════════════════════════════════════════════════
        // ARREGLO 02 (puntos 2-7, 17, 31) — REGLA CRÍTICA DEL REINTENTO.
        //
        // `colaTurnos` reemplaza al antiguo contador `siguiente` (que solo
        // avanzaba de 0 a total-1 una sola vez). Ahora es una cola REAL de
        // turnos pendientes: arranca con una posición por cada documento
        // (0..total-1, en orden), y cuando un documento falla su PRIMER
        // intento, su posición se vuelve a agregar al FINAL de esta misma
        // cola — nunca se reintenta dentro de la misma llamada. Así, el
        // reintento es, ni más ni menos, un turno más dentro de la cola
        // real, y pasa obligatoriamente por correrColaSecuencial(), que es
        // quien garantiza los 15 segundos también para ese turno.
        //
        // `_dgiiIntentos[pos]` cuenta cuántas veces ya se consultó la
        // posición `pos` (0 = todavía no se ha intentado ni una vez; 1 = ya
        // consumió su primer intento y lo que viene es su único reintento).
        // Con esto se decide, sin ambigüedad, si un ERROR debe volver a la
        // cola como "Pendiente de reintento" (intentos === 0) o si ya es un
        // resultado FINAL "Error de consulta" (intentos >= 1, el reintento
        // también falló). Nunca se crea un segundo registro visual para el
        // mismo documento (punto 7): `pos` es siempre el mismo índice del
        // ítem ya existente en `_dgiiColaVisual`, tanto en su primer intento
        // como en su reintento.
        // ══════════════════════════════════════════════════════════════
        var colaTurnos    = indicesPendientes.map(function (_, pos) { return pos; });
        var _dgiiIntentos = indicesPendientes.map(function () { return 0; });

        // ARREGLO 02 (puntos 8, 12-14) — el contador "X / Y" y el tiempo
        // estimado deben reflejar el progreso REAL: un documento con su
        // primer intento fallido y "Pendiente de reintento" NO cuenta como
        // completado todavía (`completados` solo avanza en la función
        // `finalizarDocumento`, más abajo, cuando el resultado ya es
        // definitivo — éxito, físico, o error tras consumir el reintento).
        // `total` (denominador) sigue siendo la cantidad de documentos
        // ÚNICOS del lote — nunca la cantidad de turnos, que puede ser mayor
        // si hay reintentos.

        // ARREGLO 02 (puntos 8, 9, 12-14) — tiempo promedio real de consulta
        // (para el cálculo del tiempo estimado restante). Arranca con una
        // estimación razonable (4s) y se recalcula, como promedio simple,
        // con cada consulta REAL contra Hacienda que termine (se excluyen a
        // propósito los documentos "Físicos" y los que ni siquiera llegan a
        // consultarse por falta de fecha, ya que esos se resuelven al
        // instante y no reflejan el tiempo real de respuesta del Ministerio
        // — incluirlos distorsionaría el promedio hacia abajo).
        var _dgiiTiempoPromedioMs = 4000;
        var _dgiiMuestrasTiempo   = 0;

        // Consulta un único documento (índice idx) usando el carril indicado.
        function procesarDocumento(pos, slot) {
            var idx = indicesPendientes[pos]; // índice real dentro de `records`
            var esReintento = _dgiiIntentos[pos] > 0;
            _dgiiPosActualEnCola = pos;
            if (esReintento) {
                // ARREGLO 02 (puntos 5, 11) — le llegó su turno real como
                // reintento: se refleja igual que cualquier otro reintento ya
                // conocido por la interfaz (aviso en el modal, en la
                // notificación persistente, y el ítem de la cola pasa de
                // "Pendiente de reintento" a "Reintentando...").
                dgiiMostrarReintento();
            } else {
                dgiiColaSetEstado(pos, 'EN_PROCESO');
                // ARREGLO 01 — vuelve a "Verificando documentos…" / "procesando"
                // al arrancar cada documento, saliendo del texto de cuenta
                // regresiva que dejó el intervalo de 15s del documento anterior
                // (ver dgiiEsperarIntervaloObligatorio).
                var _liveInicio = document.getElementById('dgiiLiveStatus');
                if (_liveInicio) { _liveInicio.className = 'dgii-well-live'; _liveInicio.innerHTML = '<span class="dgii-spin"></span> Verificando documentos…'; }
                var _subInicio = document.getElementById('dgiiSubStatusText');
                if (_subInicio) { var _restantesInicio = Math.max(total - completados, 0); _subInicio.innerText = _restantesInicio > 0 ? ('Restantes: ' + _restantesInicio + ' pendientes') : 'Finalizando…'; }
                if (typeof dgiiBgNotifSetEstado === 'function') dgiiBgNotifSetEstado('procesando');
            }
            var r = records[idx];
            var codigoGeneracion = (r[cfg.codField] || '').trim();
            var fechaRaw         = (r.fecha || '').trim();
            // Normalizar siempre a YYYY-MM-DD antes de consultar (formato que espera
            // verificarEstadoDTE, ver preload.js). r.fecha puede venir guardada en
            // distintos formatos según el origen del documento (YYYY-MM-DD crudo del
            // JSON del DTE, DD/MM/YYYY de captura manual, con o sin ceros a la izquierda),
            // así que sin esta normalización algunos documentos fallaban la consulta
            // aunque el DTE estuviera correctamente transmitido.
            var fechaGeneracion  = fechaRaw ? dgiiNormalizarFechaISO(fechaRaw) : '';

            // Sin código de generación, o con un código demasiado corto para ser un
            // UUID real de DTE (los documentos físicos agregados manualmente suelen
            // tener códigos de menos de 10 caracteres), no es un DTE electrónico —
            // es un documento físico. No se contacta al Ministerio: se marca
            // directamente como "Documento Físico".
            var esFisico = !codigoGeneracion || codigoGeneracion.length < 10;

            // ARREGLO 02 (puntos 12-14) — mide cuánto tarda esta consulta
            // REAL contra Hacienda (nunca las resoluciones instantáneas de
            // "Documento Físico" o "sin fecha") para ir afinando el promedio
            // usado en el cálculo del tiempo estimado restante.
            var _dgiiMideTiempoReal = !esFisico && !!fechaGeneracion;
            var _dgiiInicioConsulta = Date.now();

            var promesa;
            if (esFisico) {
                promesa = Promise.resolve({ estado: 'FISICO' });
            } else if (!fechaGeneracion) {
                promesa = Promise.resolve({ estado: 'ERROR', error: 'Documento sin fecha de generación' });
            } else {
                promesa = window.fiscalAPI.verificarEstadoDTE(fechaGeneracion, codigoGeneracion, slot)
                    .catch(function (e) { return { estado: 'ERROR', error: (e && e.message) || 'Error de comunicación' }; });
            }

            return promesa.then(function (resultado) {
                try {
                    if (_dgiiMideTiempoReal) {
                        var _dur = Date.now() - _dgiiInicioConsulta;
                        _dgiiMuestrasTiempo++;
                        _dgiiTiempoPromedioMs = (_dgiiMuestrasTiempo === 1)
                            ? _dur
                            : (_dgiiTiempoPromedioMs * (_dgiiMuestrasTiempo - 1) + _dur) / _dgiiMuestrasTiempo;
                    }

                    var code = (resultado && resultado.estado) || 'ERROR';

                    // ══════════════════════════════════════════════════════
                    // ARREGLO 02 — REGLA CRÍTICA DEL REINTENTO (puntos 2-7,
                    // 17, 31): si la consulta falló Y este documento todavía
                    // no ha consumido su único reintento (_dgiiIntentos[pos]
                    // === 0), el resultado NO es definitivo todavía. Se
                    // marca "Pendiente de reintento", se incrementa su
                    // contador de intentos, y su posición vuelve a
                    // encolarse al FINAL de `colaTurnos` para procesarse
                    // como un turno normal más adelante — nunca aquí mismo,
                    // nunca sin sus 15 segundos de por medio. `completados`
                    // NO avanza en este caso (todavía no es un resultado
                    // final) y `r.estadoDGII` tampoco se toca (se conserva
                    // el estado anterior, si lo había, hasta tener un
                    // resultado definitivo).
                    // ══════════════════════════════════════════════════════
                    if (code === 'ERROR' && _dgiiIntentos[pos] === 0 && !_dgiiCancelar) {
                        _dgiiIntentos[pos] = 1;
                        dgiiColaSetEstado(pos, 'PENDIENTE_REINTENTO');
                        colaTurnos.push(pos);
                        var _errElPend = document.getElementById('dgiiUltimoError');
                        if (_errElPend) _errElPend.innerText = (resultado && resultado.error) ? ('Último aviso: ' + resultado.error) : '';
                        // El turno adicional que se acaba de agregar aumenta
                        // el tiempo estimado restante de inmediato (punto 5,
                        // CASO 5 de los criterios de aceptación).
                        if (typeof dgiiActualizarTiempoEstimado === 'function') dgiiActualizarTiempoEstimado(0, total, completados, colaTurnos, _dgiiTiempoPromedioMs);
                        return;
                    }

                    // A partir de aquí el resultado SÍ es definitivo — o bien
                    // tuvo éxito, o bien ya consumió su reintento y sigue en
                    // ERROR (punto 5: "Error de consulta" solo se usa cuando
                    // el documento ya no tiene ninguna otra oportunidad
                    // válida de consulta).
                    r.estadoDGII = { code: code, ts: Date.now() };

                    if      (code === 'TRANSMITIDO')   resumen.transmitidos++;
                    else if (code === 'INVALIDADO')    resumen.invalidados++;
                    else if (code === 'RECHAZADO')     resumen.invalidados++;
                    else if (code === 'CON_EVENTO')    resumen.conEvento++;
                    else if (code === 'NO_ENCONTRADO') resumen.noEncontrados++;
                    else if (code === 'FISICO')        resumen.fisicos++;
                    else                                resumen.errores++;

                    // Completar automáticamente el Sello de Recepción — SOLO Libro de
                    // Compras, y SOLO si el campo está vacío. Si ya trae un valor (por
                    // ejemplo, cargado desde la importación de un .json), se respeta tal
                    // cual y no se sobrescribe. La función de importación de .json que
                    // llena este mismo campo no se toca ni se modifica: esto es
                    // puramente complementario y corre después de la verificación de
                    // estado, que siempre se ejecuta igual que antes.
                    if (libro === 'compras' && resultado && resultado.selloRecepcion) {
                        var selloActual = (r.selloRecepcion || '').trim();
                        if (!selloActual) {
                            r.selloRecepcion = resultado.selloRecepcion.trim();
                            sellosAgregados++;
                        }

                        // AGREGADO NUEVO: reutilizar el mismo Sello de Recepción obtenido
                        // arriba para completar el registro vinculado en el Libro de IVA
                        // Percibido — Anexo 8 (campo "Serie de Documento"), ya que ambos
                        // registros pertenecen al mismo documento. No se crea ninguna forma
                        // nueva de obtener el dato: se reutiliza exactamente el valor ya
                        // resuelto por Consultar DTE. Se ubica el registro de Percibido
                        // vinculado mediante _percLinkId/_fromCompraLinkId (el mismo enlace
                        // que ya usa syncPercibidoFromCompra) y solo se completa si su
                        // "Serie de Documento" está vacía, sin tocar la lógica de generación
                        // automática del registro de Percibido.
                        var percVinculado = null;
                        if (r._percLinkId) {
                            percVinculado = percibidoRecords.find(function (p) { return p._fromCompraLinkId === r._percLinkId; });
                        }
                        // RESPALDO: hay compras (registros más antiguos, o casos donde el
                        // vínculo no se generó al importar) que no traen _percLinkId aunque
                        // sí tengan su percibido correspondiente en la otra tabla. En ese caso
                        // se usa el código de generación del DTE (numDoc), que es el mismo en
                        // ambos registros por tratarse del mismo documento, para ubicar el
                        // percibido y completar su "Serie de Documento" igual que arriba.
                        if (!percVinculado && r.numDoc) {
                            percVinculado = percibidoRecords.find(function (p) { return p.numDoc && p.numDoc === r.numDoc; });
                        }
                        if (percVinculado && !(percVinculado.serie || '').trim()) {
                            percVinculado.serie = r.selloRecepcion;
                            percibidoActualizado = true;
                            sellosAgregados++;
                        }
                    }

                    // Cambio 05 — Libro de IVA Percibido: cuando la Consulta DTE se
                    // ejecuta directamente desde este anexo, "r" ya es el propio
                    // registro de Percibido, así que se completa su campo "Serie Doc."
                    // (mismo campo "serie" que usa Compras) con el Sello de Recepción
                    // obtenido de la consulta — exactamente la misma lógica y la misma
                    // fuente de dato (resultado.selloRecepcion) que ya usa Compras,
                    // solo que aplicada directamente sobre el registro consultado, y
                    // únicamente si el campo está vacío. No interfiere con la rama de
                    // 'compras' de arriba: ambas conviven de forma independiente.
                    if (libro === 'percibido' && resultado && resultado.selloRecepcion) {
                        var serieActualPerc = (r.serie || '').trim();
                        if (!serieActualPerc) {
                            r.serie = resultado.selloRecepcion.trim();
                            percibidoActualizado = true;
                            sellosAgregados++;
                        }
                    }

                    dgiiActualizarCeldaEnVivo(libro, idx, r.estadoDGII);
                    completados++;
                    dgiiActualizarProgreso(completados, total);
                    // ARREGLO 02 (puntos 8-14) — recalcula el tiempo estimado
                    // restante con cada resultado final: baja conforme se
                    // completan documentos, y ya refleja el promedio real
                    // actualizado (ver _dgiiTiempoPromedioMs arriba).
                    if (typeof dgiiActualizarTiempoEstimado === 'function') dgiiActualizarTiempoEstimado(0, total, completados, colaTurnos, _dgiiTiempoPromedioMs);

                    // ARREGLO 01 (puntos 19-21) — refleja el resultado final de este
                    // documento en su ítem de la cola visual ("Ver proceso").
                    var _colaEstado = (code === 'TRANSMITIDO') ? 'RESUELTO_TRANSMITIDO'
                        : (code === 'INVALIDADO' || code === 'RECHAZADO') ? 'RESUELTO_INVALIDADO'
                        : (code === 'FISICO') ? 'RESUELTO_FISICO'
                        : (code === 'ERROR') ? 'ERROR'
                        : 'RESUELTO_OTRO';
                    dgiiColaSetEstado(pos, _colaEstado, dgiiEstadoLabel(code));

                    var errEl = document.getElementById('dgiiUltimoError');
                    if (errEl) errEl.innerText = (resultado && resultado.error) ? ('Último aviso: ' + resultado.error) : '';

                    // Persistir cada 5 documentos (y siempre en el último) para no saturar el disco
                    if (completados % 5 === 0 || completados === total) saveCurrentMonthData();
                } catch (errInterno) {
                    console.error('[DGII] Error procesando documento', idx, errInterno);
                    // CORRECCIÓN: antes, un error interno (excepción de JS, distinto
                    // de un error de consulta contra Hacienda) dejaba la columna
                    // "Estado DGII" sin ningún cambio y sin aviso visible para el
                    // usuario — solo quedaba registrado en consola y en un campo de
                    // texto oculto del modal. Ahora se refleja igual que cualquier
                    // otro resultado definitivo de error, para que la columna nunca
                    // se quede "congelada" en silencio.
                    r.estadoDGII = { code: 'ERROR', ts: Date.now() };
                    dgiiActualizarCeldaEnVivo(libro, idx, r.estadoDGII);
                    resumen.errores++;
                    completados++;
                    dgiiActualizarProgreso(completados, total);
                    dgiiColaSetEstado(pos, 'ERROR', 'Error interno');
                    var errEl2 = document.getElementById('dgiiUltimoError');
                    if (errEl2) errEl2.innerText = 'Error interno procesando el documento ' + (idx + 1) + ': ' + errInterno.message;
                }
            }).catch(function (errFatal) {
                console.error('[DGII] Error fatal en la cadena de verificación:', errFatal);
                var errEl3 = document.getElementById('dgiiUltimoError');
                if (errEl3) errEl3.innerText = 'Error inesperado: ' + (errFatal && errFatal.message ? errFatal.message : errFatal);
                // CORRECCIÓN: mismo caso que el catch (errInterno) de arriba —
                // sin esto, un fallo inesperado en la cadena de promesas dejaba
                // la columna "Estado DGII" sin cambios y sin aviso visible.
                r.estadoDGII = { code: 'ERROR', ts: Date.now() };
                dgiiActualizarCeldaEnVivo(libro, idx, r.estadoDGII);
                resumen.errores++;
                completados++;
                dgiiActualizarProgreso(completados, total);
                dgiiColaSetEstado(pos, 'ERROR', 'Error interno');
            });
        }

        // ARREGLO 01 (puntos 4-6, 29-30) — REGLA CRÍTICA: un único documento a
        // la vez (nunca en paralelo — reemplaza el antiguo sistema de
        // "carriles" en paralelo) y SIEMPRE los segundos completos de espera
        // que indique adminConsultaDteIntervaloActual() (por defecto 5,
        // configurable desde Admin > Sistema — ver bloque más arriba)
        // DESPUÉS de que termina cada consulta (nunca antes, y nunca como
        // parte del tiempo que tarda Hacienda en responder) antes de iniciar
        // la siguiente. Sustituye por completo a la antigua pausa fija de
        // 700ms y a la "pausa programada" cada 25 documentos — ambas quedan
        // reemplazadas por este único intervalo obligatorio.
        //
        // ARREGLO 02 (punto 1, 16) — este mismo intervalo aplica IGUAL para
        // los reintentos: al ser un turno más de `colaTurnos`, un reintento
        // pasa exactamente por esta misma espera, nunca por un atajo.
        var DGII_SEGUNDOS_ENTRE_CONSULTAS = adminConsultaDteIntervaloActual();

        // Cuenta regresiva real (no solo animación) de los segundos
        // obligatorios entre una consulta y la siguiente (punto 6). Se
        // refleja tanto en la notificación persistente como en el modal
        // "Ver proceso", y se corta de inmediato si el usuario cancela.
        function dgiiEsperarIntervaloObligatorio() {
            return new Promise(function (resolve) {
                var restante = DGII_SEGUNDOS_ENTRE_CONSULTAS;
                function tick() {
                    if (_dgiiCancelar) { resolve(); return; }
                    if (typeof dgiiBgNotifSetEstado === 'function') {
                        dgiiBgNotifSetEstado('esperando_entre_consultas', { countdown: restante, countdownLabel: 'Próxima consulta' });
                    }
                    var live = document.getElementById('dgiiLiveStatus');
                    if (live) { live.className = 'dgii-well-live'; live.innerHTML = '<span class="dgii-spin"></span> Esperando antes de continuar'; }
                    var sub = document.getElementById('dgiiSubStatusText');
                    if (sub) sub.innerText = 'Próxima consulta: ' + restante + ' segundos';
                    // ARREGLO 02 (punto 10, CASO 5) — el tiempo estimado
                    // restante también se actualiza en vivo durante esta
                    // cuenta regresiva, no solo al terminar cada documento.
                    if (typeof dgiiActualizarTiempoEstimado === 'function') dgiiActualizarTiempoEstimado(restante * 1000, total, completados, colaTurnos, _dgiiTiempoPromedioMs);
                    if (restante <= 0) { resolve(); return; }
                    setTimeout(function () { restante--; tick(); }, 1000);
                }
                tick();
            });
        }

        // Procesa la cola real, EN ORDEN y de a un documento a la vez —
        // nunca dos consultas simultáneas, nunca la siguiente antes de que
        // termine (consulta + 15s) la anterior.
        //
        // ARREGLO 02 — ya no recorre un rango fijo [0, total): saca el
        // siguiente turno de `colaTurnos`, que puede haber crecido con
        // reintentos agregados al final por procesarDocumento(). Termina
        // cuando esa cola queda realmente vacía (todos los documentos,
        // incluyendo sus reintentos, ya tienen resultado final) o si se
        // cancela.
        function correrColaSecuencial() {
            if (_dgiiCancelar || colaTurnos.length === 0) return Promise.resolve();
            var pos = colaTurnos.shift();
            return procesarDocumento(pos, 0).then(function () {
                if (_dgiiCancelar || colaTurnos.length === 0) return;
                // Los 15 segundos empiezan a contar cuando termina esta
                // consulta (ya se recibió y guardó el resultado arriba), no
                // antes — así el tiempo de respuesta de Hacienda nunca
                // cuenta como parte del intervalo obligatorio.
                return dgiiEsperarIntervaloObligatorio().then(correrColaSecuencial);
            });
        }

        correrColaSecuencial().then(function () {
            _dgiiEnCurso = false;
            cfg.render(); // re-render final para asegurar consistencia total con los datos guardados
            // AGREGADO NUEVO: si se completó algún registro de IVA Percibido —
            // Anexo 8 (campo Serie de Documento) durante el lote, refrescar su
            // tabla también para que quede visualmente consistente.
            if (percibidoActualizado && typeof renderPercibidoTable === 'function') renderPercibidoTable();
            dgiiMostrarResumen(resumen, total, _dgiiCancelar);

            // AGREGADO NUEVO: notificación de resultado del completado automático
            // de Sellos de Recepción (Libro de Compras) y su reflejo en Serie de
            // Documento (IVA Percibido — Anexo 8). Se muestra solo al finalizar el
            // lote completo, no en cada documento individual.
            if (!_dgiiCancelar) {
                if (sellosAgregados > 0) {
                    showToast('Sellos de Recepción actualizados correctamente.', 'success');
                } else {
                    showToast('No fue necesario actualizar Sellos de Recepción. Todos los documentos ya contienen esta información.', 'success');
                }
            }

            // Persistir cambios finales (incluye los Sellos de Recepción de Compras
            // y las Series de Documento de IVA Percibido completadas en este lote).
            saveCurrentMonthData();

            // Cerrar las ventanas ocultas del Ministerio al terminar el lote —
            // no quedan abiertas en segundo plano sin necesidad. La próxima vez
            // que se presione "Consulta DTE" se vuelven a crear desde cero.
            if (window.fiscalAPI.cerrarVentanasDTE) window.fiscalAPI.cerrarVentanasDTE();
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // NOTIFICACIÓN PERSISTENTE — CONSULTA DTE EN SEGUNDO PLANO
    // (Puntos 19 a 32 de la especificación)
    //
    // Componente independiente del sistema de Toast existente
    // (showToast() / #notifCenter / _notifAdd(), más arriba en este mismo
    // archivo). No modifica ni una sola línea de esas funciones, ni de su
    // cola, estilos o animaciones. Vive en su propio contenedor
    // (#dgiiBgNotif) y su propio conjunto de funciones, todas con el
    // prefijo dgiiBgNotif*, más el punto de entrada
    // showDgiiBackgroundNotification() pedido en la especificación.
    //
    // Se conecta al proceso REAL de Consulta DTE (el mismo _dgiiEnCurso /
    // dgiiIniciarVerificacion de arriba) mediante llamadas puntuales,
    // agregadas ya en dgiiInicializarProceso(), dgiiActualizarProgreso(),
    // dgiiMostrarReintento()/dgiiOcultarReintento() y dgiiMostrarResumen():
    // no crea un segundo proceso, ni una segunda cola, ni una segunda
    // instancia de Consulta DTE (punto 27) — solo refleja visualmente el
    // mismo estado que ya usa el modal principal.
    //
    // Nota de alcance: el motor actual de Consulta DTE (ver main.js,
    // 'verificar-dte-mh') resuelve cada documento como TRANSMITIDO /
    // INVALIDADO / CON_EVENTO / NO_ENCONTRADO / FISICO / ERROR, con un único
    // reintento automático por documento y una pausa fija de 700ms entre
    // consultas — todavía no distingue específicamente una "pausa
    // programada" ni una caída general de disponibilidad del Ministerio de
    // Hacienda como un estado propio (hoy ambos casos, de ocurrir, se
    // reflejarían como reintentos/errores por documento). Por eso, además
    // de conectar los estados que sí existen hoy (procesando, reintentando,
    // completado, cancelado), este componente expone también
    // dgiiBgNotifSetEstado('pausa_programada' | 'hacienda_no_disponible',
    // opts) como una API lista para usarse el día que esa lógica se agregue
    // al motor, sin tener que tocar de nuevo esta notificación.
    // ══════════════════════════════════════════════════════════════════

    var _dgiiBgVisible    = false;
    var _dgiiBgMinimized  = false;
    var _dgiiBgEstado     = 'procesando';
    var _dgiiBgAutoHideTO = null;
    var _dgiiBgLibroActivo = null;

    // Punto de entrada genérico pedido por la especificación (punto 19).
    // opts admite: { estado, actual, total, mensaje, nota, countdown,
    // countdownLabel, minimizado }. Todos los campos son opcionales; si no
    // se especifican, se conserva el valor mostrado actualmente.
    function showDgiiBackgroundNotification(opts) {
        opts = opts || {};
        dgiiBgNotifMostrar();
        if (typeof opts.total === 'number') {
            dgiiBgNotifActualizar(typeof opts.actual === 'number' ? opts.actual : _dgiiActual, opts.total);
        }
        if (opts.estado) dgiiBgNotifSetEstado(opts.estado, opts);
        if (opts.minimizado) dgiiBgNotifMinimizar(); else if (opts.minimizado === false) dgiiBgNotifExpandir();
    }

    function _dgiiBgEl(id) { return document.getElementById(id); }

    // Muestra la tarjeta (con animación de entrada) si todavía no está visible.
    function dgiiBgNotifMostrar() {
        var cont = _dgiiBgEl('dgiiBgNotif');
        if (!cont) return;
        if (_dgiiBgAutoHideTO) { clearTimeout(_dgiiBgAutoHideTO); _dgiiBgAutoHideTO = null; }
        cont.classList.remove('dgii-bg-out');
        cont.classList.add('dgii-bg-show');
        // requestAnimationFrame para que la transición de entrada se dispare
        // (mismo patrón que usa _notifAdd() para las tarjetas del Toast).
        requestAnimationFrame(function () { cont.classList.add('dgii-bg-in'); });
        _dgiiBgVisible = true;
    }

    // Oculta la tarjeta con animación de salida. NO cancela ni detiene nada
    // del proceso — solo deja de mostrarse el indicador (se usa al terminar
    // + auto-ocultar, ver dgiiBgNotifFinalizar).
    function dgiiBgNotifOcultar() {
        var cont = _dgiiBgEl('dgiiBgNotif');
        if (!cont) return;
        cont.classList.remove('dgii-bg-in');
        cont.classList.add('dgii-bg-out');
        setTimeout(function () {
            cont.classList.remove('dgii-bg-show', 'dgii-bg-out', 'dgii-bg-minimized');
            _dgiiBgVisible = false;
            _dgiiBgMinimized = false;
        }, 220);
    }

    // Botón "−" (punto 25): minimiza a un indicador flotante compacto.
    // NO cancela, NO detiene la cola, NO destruye el proceso — solo oculta
    // visualmente el detalle. El proceso sigue corriendo exactamente igual.
    function dgiiBgNotifMinimizar() {
        var cont = _dgiiBgEl('dgiiBgNotif');
        if (!cont) return;
        cont.classList.add('dgii-bg-minimized');
        _dgiiBgMinimized = true;
    }

    // Click sobre el indicador minimizado (punto 26): expande de nuevo y
    // muestra el progreso/estado actualizado (los nodos ya se mantienen al
    // día aunque esté minimizado, ver dgiiBgNotifActualizar/SetEstado).
    function dgiiBgNotifExpandir() {
        var cont = _dgiiBgEl('dgiiBgNotif');
        if (!cont) return;
        cont.classList.remove('dgii-bg-minimized');
        _dgiiBgMinimized = false;
    }

    // REDISEÑO FINAL (puntos 13, 19-20) — "Ver proceso →" ya NO abre el
    // modal grande #dgiiProgressModal mientras el lote está corriendo:
    // transforma el MISMO módulo #dgiiBgNotif, internamente, de su cara
    // "resumen" a su cara "cola" (dgiiBgNotifMostrarCola). No reinicia la
    // consulta, no toca `_dgiiEnCurso`, `colaTurnos` ni ningún otro estado
    // del motor — solo cambia qué cara del mismo elemento está visible (ver
    // el bloque ".dgii-bg-face" en el <style>).
    //
    // Se conserva dgiiVerProcesoAbrir() (más arriba, sin modificar su
    // lógica) como respaldo únicamente para cuando el lote YA terminó: en
    // ese caso no hay "cola" que mostrar (el proceso ya no está en curso) y
    // "Ver proceso" vuelve a su comportamiento original de abrir el resumen
    // final completo.
    function dgiiBgNotifVerProceso() {
        if (_dgiiEnCurso) {
            dgiiBgNotifMostrarCola();
        } else {
            dgiiVerProcesoAbrir();
        }
    }

    // "Ver proceso →" (en curso): transforma el módulo a su cara "cola" con
    // una transición suave (ver CSS). Nunca reinicia nada — es únicamente
    // una vista sobre la cola real ya poblada por dgiiColaPoblar/SetEstado.
    function dgiiBgNotifMostrarCola() {
        var cont = _dgiiBgEl('dgiiBgNotif');
        if (!cont) return;
        cont.classList.remove('dgii-bg-minimized');
        cont.classList.add('dgii-bg-queue-mode');
    }

    // "← Volver al proceso": regresa el módulo a su cara "resumen", dentro
    // del mismo elemento — no cierra, no reinicia, no crea otro componente.
    function dgiiBgNotifVolverProceso() {
        var cont = _dgiiBgEl('dgiiBgNotif');
        if (!cont) return;
        cont.classList.remove('dgii-bg-queue-mode');
    }

    // ══════════════════════════════════════════════════════════════════
    // REDISEÑO FINAL (sección 5) — "Documento actual" dentro de la vista
    // abierta. Es puramente de LECTURA: solo observa las mismas variables
    // que ya mantiene el motor real (_dgiiPosActualEnCola/_dgiiColaVisual,
    // definidas junto a dgiiColaPoblar/dgiiColaSetEstado) para reflejar el
    // código del documento en curso — no agrega ningún dato nuevo, no
    // modifica esas variables ni las funciones que las actualizan.
    // ══════════════════════════════════════════════════════════════════
    var _dgiiUiSyncInterval = null;
    function dgiiBgNotifSyncCurrentDoc() {
        var el = _dgiiBgEl('dgiiBgCurrentDocCode');
        if (!el) return;
        if (typeof _dgiiPosActualEnCola === 'number' && _dgiiPosActualEnCola >= 0 &&
            typeof _dgiiColaVisual !== 'undefined' && _dgiiColaVisual[_dgiiPosActualEnCola]) {
            el.textContent = _dgiiColaVisual[_dgiiPosActualEnCola].label || '—';
        }
    }
    function dgiiBgNotifIniciarSyncDoc() {
        if (_dgiiUiSyncInterval) clearInterval(_dgiiUiSyncInterval);
        dgiiBgNotifSyncCurrentDoc();
        _dgiiUiSyncInterval = setInterval(dgiiBgNotifSyncCurrentDoc, 400);
    }
    function dgiiBgNotifDetenerSyncDoc() {
        if (_dgiiUiSyncInterval) { clearInterval(_dgiiUiSyncInterval); _dgiiUiSyncInterval = null; }
    }

    // Actualiza el conteo, porcentaje y barra de progreso — tanto en la
    // vista expandida como en el indicador minimizado, para que ambas
    // reflejen siempre el mismo dato en tiempo real (punto 22).
    function dgiiBgNotifActualizar(actual, total) {
        var pct = total > 0 ? Math.round((actual / total) * 100) : 0;
        var pctEl = _dgiiBgEl('dgiiBgPct'); if (pctEl) pctEl.innerText = pct + '%';
        var countEl = _dgiiBgEl('dgiiBgCount'); if (countEl) countEl.innerText = actual + ' / ' + total + ' documentos';
        var fillEl = _dgiiBgEl('dgiiBgFill'); if (fillEl) fillEl.style.width = pct + '%';
        // ARREGLO 02 (punto 21) — rediseño del estado minimizado: también
        // trae su propio porcentaje visible (antes solo mostraba "X / Y").
        var miniPct = _dgiiBgEl('dgiiBgMiniPct'); if (miniPct) miniPct.innerText = pct + '%';
        // REDISEÑO FINAL — mismo porcentaje reflejado en la cara "cola" del
        // módulo (cabecera de la cola), para no perder el dato al transformar
        // internamente la vista (punto 14 de la especificación).
        var queuePct = _dgiiBgEl('dgiiBgQueuePct'); if (queuePct) queuePct.innerText = pct + '%';
    }

    // Cambia el estado visual de la notificación (puntos 23, 24 y 29).
    // estado: 'procesando' | 'reintentando' | 'esperando_entre_consultas' |
    //         'pausa_programada' | 'hacienda_no_disponible' | 'reanudando'
    // opts: { countdown, countdownLabel } — segundos a mostrar cuando aplica.
    function dgiiBgNotifSetEstado(estado, opts) {
        opts = opts || {};
        _dgiiBgEstado = estado;

        var spin       = _dgiiBgEl('dgiiBgSpinIcon');
        var dot        = _dgiiBgEl('dgiiBgStatusDot');
        var statusText = _dgiiBgEl('dgiiBgStatusText');
        var note       = _dgiiBgEl('dgiiBgStatusNote');
        var countdownRow  = _dgiiBgEl('dgiiBgCountdownRow');
        var countdownNum  = _dgiiBgEl('dgiiBgCountdownNum');
        var countdownLbl  = _dgiiBgEl('dgiiBgCountdownLabel');
        var subtitle   = _dgiiBgEl('dgiiBgSubtitle');
        var fill       = _dgiiBgEl('dgiiBgFill');

        // Por defecto: icono girando a velocidad normal, sin nota especial,
        // sin contador visible, barra en color normal. Cada rama de abajo
        // ajusta solo lo que necesita.
        if (spin) spin.className = 'dgii-bg-spin';
        if (dot) dot.className = 'dgii-bg-status-dot';
        if (note) { note.style.display = 'none'; note.innerText = ''; }
        if (countdownRow) countdownRow.style.display = 'none';
        if (subtitle) subtitle.innerText = 'Procesando en segundo plano';
        if (fill) fill.classList.remove('dgii-bg-fill-waiting');

        if (estado === 'procesando') {
            if (statusText) statusText.innerText = 'Verificando documento...';

        } else if (estado === 'reintentando') {
            // Mapea el mismo aviso de reintento que ya usa el modal principal
            // (dgiiMostrarReintento(), disparado por window.fiscalAPI.onReintentoDTE
            // — ver main.js/preload.js). No es un estado nuevo del motor: es el
            // mismo reintento único por documento que ya existía.
            if (statusText) statusText.innerText = 'Reintentando documento...';

        } else if (estado === 'esperando_entre_consultas') {
            if (dot) dot.className = 'dgii-bg-status-dot dgii-bg-dot-waiting';
            if (statusText) statusText.innerText = 'Esperando antes de continuar';
            if (countdownRow && typeof opts.countdown === 'number') {
                countdownRow.style.display = 'flex';
                if (countdownLbl) countdownLbl.innerText = opts.countdownLabel || 'Próxima consulta';
                if (countdownNum) countdownNum.innerText = opts.countdown;
            }

        } else if (estado === 'pausa_programada') {
            if (dot) dot.className = 'dgii-bg-status-dot dgii-bg-dot-waiting';
            if (statusText) statusText.innerText = 'Pausa programada';
            if (countdownRow && typeof opts.countdown === 'number') {
                countdownRow.style.display = 'flex';
                if (countdownLbl) countdownLbl.innerText = 'Continuará en';
                if (countdownNum) countdownNum.innerText = opts.countdown;
            }

        } else if (estado === 'hacienda_no_disponible') {
            // Punto 24: tratamiento visual diferenciado pero SIN rojo ni
            // palabras como "Error"/"Consulta fallida"/"Error de Hacienda".
            // El spinner gira más lento para transmitir espera, no actividad.
            if (spin) spin.className = 'dgii-bg-spin dgii-bg-spin-slow';
            if (dot) dot.className = 'dgii-bg-status-dot dgii-bg-dot-waiting';
            if (statusText) statusText.innerText = 'Esperando disponibilidad de Hacienda';
            if (note) { note.style.display = 'block'; note.innerText = 'El proceso continuará automáticamente.'; }
            if (fill) fill.classList.add('dgii-bg-fill-waiting');

        } else if (estado === 'reanudando') {
            if (statusText) statusText.innerText = 'Hacienda disponible — continuando';
        }
    }

    // Estado final (punto 29-F): completado o cancelado. Cambia el spinner
    // por un check (solo si terminó bien), muestra el resumen y programa el
    // auto-ocultado tras un tiempo razonable. Llamado desde
    // dgiiMostrarResumen(), justo cuando termina el mismo lote que ya
    // procesa el modal principal (no es un resultado aparte).
    function dgiiBgNotifFinalizar(resumen, total, cancelado) {
        var spinIcon  = _dgiiBgEl('dgiiBgSpinIcon');
        var checkIcon = _dgiiBgEl('dgiiBgCheckIcon');
        var title     = _dgiiBgEl('dgiiBgTitle');
        var subtitle  = _dgiiBgEl('dgiiBgSubtitle');
        var statusText = _dgiiBgEl('dgiiBgStatusText');
        var dot       = _dgiiBgEl('dgiiBgStatusDot');
        var note      = _dgiiBgEl('dgiiBgStatusNote');
        var countdownRow = _dgiiBgEl('dgiiBgCountdownRow');
        var miniSpin  = _dgiiBgEl('dgiiBgMiniSpin');

        if (countdownRow) countdownRow.style.display = 'none';
        if (title) title.innerText = 'Consulta DTE';

        if (cancelado) {
            if (spinIcon) spinIcon.style.display = 'none';
            if (checkIcon) checkIcon.style.display = 'none';
            if (miniSpin) miniSpin.style.display = 'none';
            if (subtitle) subtitle.innerText = 'Proceso cancelado';
            if (dot) dot.className = 'dgii-bg-status-dot';
            if (statusText) statusText.innerText = 'Verificación detenida por el usuario';
            if (note) note.style.display = 'none';
        } else {
            if (spinIcon) spinIcon.style.display = 'none';
            if (checkIcon) checkIcon.style.display = 'inline-flex';
            if (miniSpin) miniSpin.style.display = 'none';
            if (subtitle) subtitle.innerText = 'Verificación completada';
            if (dot) dot.className = 'dgii-bg-status-dot';
            if (statusText) statusText.innerText = '\u2713 ' + total + ' documentos procesados';
            if (note) note.style.display = 'none';
        }

        // Punto 29-F: "Después de un tiempo razonable, la notificación puede
        // desaparecer automáticamente." No se auto-oculta si está minimizada
        // y el usuario no ha vuelto a mirarla en ese momento — igual se
        // oculta pasado el tiempo, ya que el proceso ya terminó del todo.
        if (_dgiiBgAutoHideTO) clearTimeout(_dgiiBgAutoHideTO);
        _dgiiBgAutoHideTO = setTimeout(function () {
            dgiiBgNotifOcultar();
        }, cancelado ? 4000 : 6000);
    }