// escaneo-documentos/QrTipos.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 04 — CONTROL DE TIPOS DE DOCUMENTO PERMITIDOS POR MÓDULO DE
    // ESCANEO QR (configurable desde Modo Admin, pestaña "Escaneo QR"),
    // ahora sobre el catálogo oficial completo CAT-002 (13 tipos).
    //
    // Esta capa NO sustituye la validación existente: el mapeo automático
    // del Tipo de Documento (_mapearTipoDteQr* en main.js -> combinado.
    // tipoDocMapeado) sigue intacto y se usa igual que antes para
    // autocompletar el registro. El aviso "Tipo no reconocido
    // automáticamente" del modal de Documento Escaneado (openQrDocModal)
    // también sigue intacto — es un aviso distinto, sobre el mapeo
    // anexo-específico usado para autocompletar, no sobre el control de
    // permisos de esta sección.
    //
    // Fuente del tipo: el TEXTO REAL de "Tipo de DTE" (combinado.
    // tipoDteTexto, tal como lo devuelve la consulta pública de Hacienda —
    // esa extracción no se toca). Ese texto se traduce a un código CAT-002
    // usando el catálogo CENTRALIZADO en cat002.js (cargado más abajo con
    // <script src="cat002.js">, compartido con main.js vía require) —
    // nunca se repite el catálogo a mano en dos lugares.
    //
    // Cambio 04 — Denegación por defecto: a diferencia de Cambio 03 (donde
    // un tipo no reconocido simplemente no se bloqueaba), ahora:
    //   - Tipo DESCONOCIDO para CAT-002 (no está en el catálogo) -> SIEMPRE
    //     se rechaza. Nunca se asume válido solo porque no se identificó.
    //   - Tipo CONOCIDO pero no habilitado para el anexo (incluye "nunca
    //     configurado") -> se rechaza igual, con mensaje distinto.
    //   - Tipo CONOCIDO y habilitado para el anexo -> se permite.
    // "No configurado" nunca equivale a "permitido".
    //
    // Los tipos que ya funcionaban antes de este cambio (01-FACTURA,
    // 03-CCF, 05-NC, 07-RETENCIÓN, 14-EXCLUIDO) parten HABILITADOS por
    // defecto en todos los anexos, para no romper el comportamiento actual
    // (restricción explícita del Cambio 04). Los 8 tipos nuevos del
    // catálogo (04, 06, 08, 09, 11, 15, 17, 18) parten DESHABILITADOS — un
    // administrador debe habilitarlos explícitamente antes de que puedan
    // procesarse.
    //
    // Se mantiene: una única configuración (fuente única de verdad),
    // independiente por anexo, y el mismo mecanismo de rechazo ya probado
    // (nada se agrega al anexo, no queda estado temporal, el siguiente
    // escaneo funciona de inmediato) — ver los 5 _autocompletar...DesdeQR
    // más abajo y la validación espejo en main.js.
    // ══════════════════════════════════════════════════════════════════
    var QRSCAN_TIPOS_STORAGE_KEY = 'fs_qrscan_tipos_v3';

    // Módulos configurables desde Admin — mismo módulo/anexo que usa
    // QRDOC_LIBRO_INFO. "excluido" participa de este control igual que los
    // demás.
    var QRSCAN_MODULOS = [
        { id: 'compras',   label: 'Compras',                  anexo: 'Anexo 3', color: 'var(--rp-violet-soft)' },
        { id: 'cf',        label: 'Venta Consumidor Final',   anexo: 'Anexo 2', color: 'var(--rp-success)' },
        { id: 'ccf',       label: 'Venta Crédito Fiscal',     anexo: 'Anexo 1', color: 'var(--rp-accent)' },
        { id: 'retencion', label: 'Retención IVA',            anexo: 'Anexo 7', color: 'var(--rp-warning)' },
        { id: 'excluido',  label: 'Sujeto Excluido',          anexo: 'Anexo 5', color: 'var(--rp-text-secondary)' }
    ];

    // Catálogo CAT-002 completo (13 tipos) — proviene de cat002.js, fuente
    // única compartida con main.js. { id: código oficial, label: nombre }.
    var QRSCAN_TIPOS_DTE = window.FiscalSyncCat002.CAT_002.map(function(t) {
        return { id: t.codigo, label: t.nombre };
    });

    function qrScanTiposDefaults() {
        var HABILITADOS_POR_DEFECTO = ['01', '03', '05', '07', '14'];
        var out = {};
        QRSCAN_MODULOS.forEach(function(m) {
            out[m.id] = HABILITADOS_POR_DEFECTO.slice();
        });
        // Sujeto Excluido admite Factura de Sujeto Excluido (14), Nota de
        // Crédito (05) y Nota de Débito (06) — el selector "Tipo de
        // Documento" de ese anexo ahora ofrece exactamente esas 3 opciones
        // (ver QRDOC_LIBRO_INFO.excluido), así que 06 debe quedar habilitado
        // también por defecto (antes solo 14/05 quedaban habilitados).
        if (out.excluido) out.excluido = ['14', '05', '06'];
        return out;
    }

    // Trae la configuración previa del Cambio 03 (guardada por los 5
    // identificadores de texto FACTURA/CCF/NC/RETENCION/EXCLUIDO) y la
    // traduce a códigos CAT-002, para que un admin que ya había
    // configurado algo no tenga que rehacerlo. Si nunca hubo nada guardado
    // (instalación nueva o recién actualizada sin uso previo de Cambio
    // 03), se usan los defaults.
    var _QR_TIPOS_V2_A_CODIGO = { FACTURA: '01', CCF: '03', NC: '05', RETENCION: '07', EXCLUIDO: '14' };
    function _migrarTiposPermitidosV2() {
        var defaults = qrScanTiposDefaults();
        var raw = fsStore.getItem('fs_qrscan_tipos_v2');
        if (!raw) return defaults;
        var saved;
        try { saved = JSON.parse(raw); } catch (e) { return defaults; }
        if (!saved || typeof saved !== 'object') return defaults;
        var out = {};
        QRSCAN_MODULOS.forEach(function(m) {
            var previos = Array.isArray(saved[m.id]) ? saved[m.id] : null;
            if (!previos) { out[m.id] = defaults[m.id]; return; }
            out[m.id] = previos.map(function(idTexto) { return _QR_TIPOS_V2_A_CODIGO[idTexto]; }).filter(Boolean);
        });
        return out;
    }

    function qrScanTiposLoad() {
        var defaults = qrScanTiposDefaults();
        var raw = fsStore.getItem(QRSCAN_TIPOS_STORAGE_KEY);
        if (!raw) return _migrarTiposPermitidosV2();
        var saved;
        try { saved = JSON.parse(raw); } catch (e) { return defaults; }
        if (!saved || typeof saved !== 'object') return defaults;
        // Completa con los defaults cualquier módulo que aún no se
        // hubiera guardado nunca (ej. si se agrega un módulo nuevo más
        // adelante) — un módulo SÍ guardado (incluso como lista vacía)
        // se respeta tal cual, sin recibir el default por encima.
        Object.keys(defaults).forEach(function(id) {
            if (!Array.isArray(saved[id])) saved[id] = defaults[id];
        });
        return saved;
    }

    function qrScanTiposSave(data) {
        fsStore.setItem(QRSCAN_TIPOS_STORAGE_KEY, JSON.stringify(data));
        _sincronizarTiposPermitidosQR(data);
    }

    // Cambio 02 — Empuja la configuración vigente de "Tipos de Documento
    // Permitidos" al proceso principal (main.js), para que la validación
    // que ahí se agregó tenga siempre una copia al día y pueda bloquear un
    // documento no permitido ANTES de reenviarlo a esta pantalla. No
    // sustituye qrScanTipoPermitido() (se deja intacta como segunda capa):
    // esto solo mantiene sincronizada la copia que usa main.js.
    function _sincronizarTiposPermitidosQR(data) {
        if (!window.qrScan || !window.qrScan.actualizarTiposPermitidos) return;
        window.qrScan.actualizarTiposPermitidos(data || qrScanTiposLoad());
    }

    // ── Editor en Modo Admin (pestaña "Escaneo QR") ──────────────────
    var _qrTiposActivoModulo = 'compras';
    var _qrTiposEditorData = {}; // copia editable en memoria mientras el admin marca/desmarca, hasta Guardar


    function _renderQrTiposModuloNav() {
        var nav = document.getElementById('qrTiposModuloNav');
        if (!nav) return;
        nav.innerHTML = '';
        QRSCAN_MODULOS.forEach(function(m) {
            var btn = document.createElement('button');
            var isActive = m.id === _qrTiposActivoModulo;
            btn.style.cssText = 'width:100%;text-align:left;padding:9px 12px;font-size:12px;font-weight:600;border:none;border-radius:8px;cursor:pointer;font-family:\'Inter\',sans-serif;transition:all .15s;line-height:1.3;' +
                (isActive
                    ? 'background:var(--rp-border);color:' + m.color + ';border-left:3px solid ' + m.color + ';'
                    : 'background:transparent;color:var(--rp-text-secondary);border-left:3px solid transparent;');
            btn.innerHTML = m.label + '<br><span style="font-size:10px;font-weight:500;opacity:.7;">' + m.anexo + '</span>';
            btn.onclick = (function(mod) { return function() { qrTiposSelectModulo(mod.id); }; })(m);
            nav.appendChild(btn);
        });
    }

    function qrTiposSelectModulo(moduloId) {
        _qrTiposActivoModulo = moduloId;
        _renderQrTiposModuloNav();
        _loadQrTiposEditorData();
        _renderQrTiposRows();
    }

    function _loadQrTiposEditorData() {
        _qrTiposEditorData = JSON.parse(JSON.stringify(qrScanTiposLoad()));
    }

    function renderQrTiposEditor() {
        if (!_qrTiposActivoModulo) _qrTiposActivoModulo = 'compras';
        _renderQrTiposModuloNav();
        _loadQrTiposEditorData();
        _renderQrTiposRows();
    }

    function _renderQrTiposRows() {
        var body = document.getElementById('qrTiposEditorBody');
        var labelEl = document.getElementById('qrTiposModuloLabel');
        if (!body) return;
        var m = QRSCAN_MODULOS.find(function(x) { return x.id === _qrTiposActivoModulo; });
        if (labelEl && m) labelEl.textContent = m.label + ' › ' + m.anexo;
        body.innerHTML = '';

        // Cambio 04: catálogo CAT-002 completo (13 tipos), igual para
        // cualquier anexo — tabla con columnas Código / Documento / Estado
        // / Interruptor, para que el admin identifique de un vistazo qué
        // está autorizado sin tener que entrar a otra pantalla.
        var seleccionados = _qrTiposEditorData[_qrTiposActivoModulo] || [];
        var COLS = '58px 1fr 128px 46px';
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;border:1px solid var(--rp-border-strong);border-radius:10px;overflow:hidden;';

        var head = document.createElement('div');
        head.style.cssText = 'display:grid;grid-template-columns:' + COLS + ';align-items:center;gap:10px;padding:8px 14px;background:var(--rp-inset);border-bottom:1px solid var(--rp-border-strong);';
        head.innerHTML =
            '<span style="font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--rp-text-secondary);">CÓDIGO</span>' +
            '<span style="font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--rp-text-secondary);">DOCUMENTO — CAT-002</span>' +
            '<span style="font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--rp-text-secondary);">ESTADO</span>' +
            '<span></span>';
        wrap.appendChild(head);

        QRSCAN_TIPOS_DTE.forEach(function(t, i) {
            var marcado = seleccionados.indexOf(t.id) !== -1;
            var row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:' + COLS + ';align-items:center;gap:10px;padding:9px 14px;' + (i < QRSCAN_TIPOS_DTE.length - 1 ? 'border-bottom:1px solid var(--rp-border);' : '');
            row.innerHTML =
                '<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;font-weight:700;color:var(--rp-text-secondary);background:var(--rp-inset);border:1px solid var(--rp-border-strong);border-radius:6px;padding:2px 7px;display:inline-block;width:fit-content;">' + _esc(t.id) + '</span>' +
                '<span style="font-size:12.5px;color:var(--rp-text-primary);">' + _esc(t.label) + '</span>' +
                '<span style="font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:6px;color:' + (marcado ? 'var(--rp-success)' : 'var(--rp-text-secondary)') + ';"><span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0;"></span>' + (marcado ? 'Habilitado' : 'Deshabilitado') + '</span>' +
                '<label class="toggle-switch">' +
                '<input type="checkbox" ' + (marcado ? 'checked' : '') + ' onchange="qrTiposToggle(\'' + t.id + '\',this.checked)">' +
                '<span class="toggle-slider"></span>' +
                '</label>';
            wrap.appendChild(row);
        });
        body.appendChild(wrap);
    }

    function qrTiposToggle(codigo, marcado) {
        var lista = _qrTiposEditorData[_qrTiposActivoModulo] || [];
        var idx = lista.indexOf(codigo);
        if (marcado && idx === -1) lista.push(codigo);
        if (!marcado && idx !== -1) lista.splice(idx, 1);
        _qrTiposEditorData[_qrTiposActivoModulo] = lista;
        // Vuelve a pintar para que la columna "Estado" (texto + punto de
        // color) refleje el cambio de inmediato, sin esperar a Guardar.
        _renderQrTiposRows();
    }

    function qrTiposResetModulo() {
        _qrTiposEditorData[_qrTiposActivoModulo] = QRSCAN_TIPOS_DTE.map(function(t) { return t.id; });
        _renderQrTiposRows();
    }

    function qrTiposSaveModulo() {
        qrScanTiposSave(_qrTiposEditorData);
        var btn = document.getElementById('qrTiposSaveBtn');
        if (btn) {
            btn._saving = true;
            var original = btn.textContent;
            btn.textContent = 'Guardado ✓';
            btn.style.background = 'var(--rp-success)'; btn.style.color = '#fff';
            setTimeout(function() {
                btn.textContent = original;
                btn.style.background = '#fff'; btn.style.color = '#000';
                btn._saving = false;
            }, 1100);
        }
        showToast('Configuración de Escaneo QR guardada', 'success');
    }