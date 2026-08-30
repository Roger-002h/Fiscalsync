// libros-legales/ConfigImpresion.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // Orientación de la hoja: el libro de Ventas a Consumidor Final se
    // imprime en formato vertical (portrait); los demás libros mantienen
    // el formato horizontal (landscape) que ya tenían.
    function getLlOrientacion(tipo) {
        return (tipo === 'cf') ? 'portrait' : 'landscape';
    }

    function pceColWidthsCss(tipo) {
        var arr = LL_COL_WIDTHS_PCT[tipo] || [];
        var tableId = LL_TABLE_IDS[tipo];
        var css = '';
        arr.forEach(function(w, i) {
            css += 'table#' + tableId + ' col:nth-child(' + (i + 1) + '){width:' + w + '%}';
        });
        return css;
    }

    function pceLibroPrintCss(pcfg, orientacion, colWidthsCss) {
        return '@page { size: letter ' + orientacion + '; margin-top: ' + pcfg.marginTopCm + 'cm; margin-bottom: ' + pcfg.marginBottomCm + 'cm; margin-left: ' + pcfg.marginLeftCm + 'cm; margin-right: ' + pcfg.marginRightCm + 'cm; }' +
            'body { font-family: Arial, sans-serif; background: #fff; color: #000; margin: 0; padding: 0; }' +
            '.ll-print-table { width: 100%; border-collapse: collapse; font-size: ' + (pcfg.fontSize + 1) + 'px; table-layout: fixed; page-break-inside: auto; margin-left: ' + pcfg.tableOffsetX + 'px; margin-top: ' + pcfg.tableOffsetY + 'px; }' +
            '.ll-print-table thead { display: table-header-group; }' +
            '.ll-print-table tfoot { display: table-row-group; }' +
            '.ll-print-table thead tr:not(.ll-libro-header-row) th { font-size: ' + pcfg.fontSize + 'px; padding: ' + pcfg.headerPaddingTop + 'px ' + pcfg.cellPaddingH + 'px; background: #fff; color: #000; border-bottom: 2px solid #000; white-space: normal; word-wrap: break-word; overflow-wrap: break-word; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; line-height: ' + pcfg.lineHeight + '; }' +
            '.ll-print-table tbody { page-break-inside: auto; }' +
            '.ll-print-table tbody tr { page-break-inside: avoid; break-inside: avoid; }' +
            '.ll-print-table tbody td { padding: ' + pcfg.rowPaddingV + 'px ' + pcfg.cellPaddingH + 'px; font-size: ' + pcfg.fontSize + 'px; border-bottom: 1px solid #ccc; white-space: normal; word-wrap: break-word; overflow-wrap: break-word; overflow: hidden; color: #000; line-height: ' + pcfg.lineHeight + '; }' +
            '.ll-print-table tfoot td { padding: ' + (pcfg.rowPaddingV + 2) + 'px ' + pcfg.cellPaddingH + 'px; border-top: 2px solid #000; font-size: ' + pcfg.fontSize + 'px; font-weight: 700; color: #000; line-height: ' + pcfg.lineHeight + '; }' +
            '.ll-print-table thead tr.ll-libro-header-row th { background: #fff !important; border: none !important; padding: 0 !important; }' +
            '.ll-print-header { display: none !important; }' +
            '.td-money { text-align: right; font-family: monospace; }' +
            '.td-total { font-weight: 700; }' +
            '.ll-libro-header-row { display: table-row; }' +
            '.ll-libro-header-cell { padding: ' + pcfg.headerPaddingTop + 'px 0 ' + pcfg.headerPaddingBottom + 'px 0; border-bottom: 2px solid #000; background: #fff !important; text-align: center; }' +
            '.ll-libro-header-inner { display: flex; flex-direction: column; align-items: center; gap: 4px; }' +
            '.ll-libro-header-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #000; letter-spacing: 0.04em; }' +
            '.ll-libro-header-empresa { font-size: 8px; font-weight: 600; color: #000; }' +
            '.ll-libro-header-datos { font-size: 7px; color: #222; }' +
            '.ll-firma-section { display: block; margin-top: 25px; page-break-inside: avoid; break-inside: avoid; }' +
            '.ll-print-table tfoot tr.ll-firma-row { page-break-inside: avoid; break-inside: avoid; }' +
            '.ll-print-table tfoot tr.ll-firma-row td { border-top: none; padding: 0; font-size: inherit; font-weight: normal; text-align: left; }' +
            (colWidthsCss || '');
    }

    // AGREGADO NUEVO (Cambio 04): caché en memoria de la configuración de impresión,
    // cargada una vez desde disco. _printConfigDefaults sirve de respaldo si algo falla.
    var _printConfigCache = null;
    var _printConfigDefaults = { marginTopCm:0.6, marginBottomCm:0.6, marginLeftCm:0.6, marginRightCm:0.6,
        headerPaddingTop:8, headerPaddingBottom:20, lineHeight:1.3, rowPaddingV:3, cellPaddingH:4,
        tableOffsetX:0, tableOffsetY:0, fontSize:7 };

    function getPrintConfigFor(tipo) {
        var all = _printConfigCache || {};
        return Object.assign({}, _printConfigDefaults, all[tipo] || {});
    }

    // Refresca la caché desde disco — se llama al iniciar la app y cada vez que se guarda algo nuevo
    function reloadPrintConfigCache() {
        if (!window.fiscalAPI || !window.fiscalAPI.getPrintConfig) return Promise.resolve();
        return window.fiscalAPI.getPrintConfig().then(function(res) {
            if (res && res.ok) {
                _printConfigCache = res.config;
                if (res.defaults) _printConfigDefaults = res.defaults;
            }
        });
    }

    // MODIFICADO (Cambio 04): antes solo fijaba la orientación de página; ahora
    // también aplica los márgenes de página y el resto de la configuración
    // guardada (espaciados, posiciones, tamaño de fuente) vía variables CSS.
    function setPrintOrientation(tipo) {
        var cfg = getPrintConfigFor(tipo);
        var styleEl = document.getElementById('llDynamicPageStyle');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'llDynamicPageStyle';
            document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = '@media print { @page { size: letter ' + getLlOrientacion(tipo) + '; ' +
            'margin-top: ' + cfg.marginTopCm + 'cm; margin-bottom: ' + cfg.marginBottomCm + 'cm; ' +
            'margin-left: ' + cfg.marginLeftCm + 'cm; margin-right: ' + cfg.marginRightCm + 'cm; } }';

        // Variables CSS leídas por las reglas .ll-print-table de la hoja de estilos estática
        var root = document.documentElement.style;
        root.setProperty('--pce-header-font', Math.max(4, cfg.fontSize - 1) + 'px');
        root.setProperty('--pce-header-pad-v', cfg.headerPaddingTop + 'px');
        root.setProperty('--pce-cell-pad-h', cfg.cellPaddingH + 'px');
        root.setProperty('--pce-row-pad-v', cfg.rowPaddingV + 'px');
        root.setProperty('--pce-font', cfg.fontSize + 'px');
        root.setProperty('--pce-line-height', cfg.lineHeight);
        root.setProperty('--pce-offset-x', cfg.tableOffsetX + 'px');
        root.setProperty('--pce-offset-y', cfg.tableOffsetY + 'px');
        root.setProperty('--pce-hdr-pad-top', cfg.headerPaddingTop + 'px');
        root.setProperty('--pce-hdr-pad-bottom', cfg.headerPaddingBottom + 'px');
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO (Cambio 04): EDITOR AVANZADO DE CONFIGURACIÓN DE IMPRESIÓN
    // Cada libro (compras/cf/ccf) tiene su propia configuración independiente.
    // Los cambios del formulario NO se guardan hasta presionar "Guardar cambios";
    // la vista previa sí se actualiza en vivo mientras se editan los valores.
    // ══════════════════════════════════════════════════════════════════

    var _pceLibroActivo = 'compras';
    var PCE_LIBRO_LABELS = { compras: 'Compras', cf: 'Consumidor Final', ccf: 'Crédito Fiscal' };
    var PCE_FIELDS = ['marginTopCm','marginBottomCm','marginLeftCm','marginRightCm',
        'headerPaddingTop','headerPaddingBottom','lineHeight','rowPaddingV','cellPaddingH',
        'tableOffsetX','tableOffsetY','fontSize'];

    function initPrintEditor() {
        reloadPrintConfigCache().then(function() {
            selectPceLibro(_pceLibroActivo);
        });
    }

    function selectPceLibro(tipo) {
        _pceLibroActivo = tipo;
        ['compras','cf','ccf'].forEach(function(t) {
            var btn = document.getElementById('pceLibroBtn-' + t);
            if (!btn) return;
            if (t === tipo) { btn.style.background = '#18181b'; btn.style.color = '#e4e4e7'; }
            else { btn.style.background = 'transparent'; btn.style.color = '#71717a'; }
        });
        pceLoadFormFromConfig(getPrintConfigFor(tipo));
        pceRenderPreview();
    }

    function pceLoadFormFromConfig(cfg) {
        PCE_FIELDS.forEach(function(field) {
            var el = document.getElementById('pce_' + field);
            if (el) el.value = cfg[field];
        });
    }

    function pceReadFormValues() {
        var out = {};
        PCE_FIELDS.forEach(function(field) {
            var el = document.getElementById('pce_' + field);
            var v = el ? parseFloat(el.value) : NaN;
            out[field] = isNaN(v) ? _printConfigDefaults[field] : v;
        });
        return out;
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO (Corrección 03): VISTA PREVIA PAGINADA REAL
    // Construye el libro de ejemplo con el MISMO HTML/CSS que usa la
    // impresión y el PDF reales (pceColWidthsCss / pceLibroPrintCss),
    // mide las alturas reales de cada fila en un iframe oculto del mismo
    // ancho que el área de contenido de la página, y con esas medidas
    // distribuye las filas en hojas físicas del tamaño real del papel —
    // respetando el encabezado repetido, los saltos de página, la
    // ubicación de la Firma y el Cuadro Resumen, y la numeración.
    // ══════════════════════════════════════════════════════════════════

    var PCE_PX_PER_CM      = 37.795275591; // 96dpi
    var PCE_PAPER_CM       = { w: 21.59, h: 27.94 }; // Carta / Letter
    var PCE_MUESTRA_FILAS  = 22; // registros de ejemplo — suficientes para forzar varias páginas
    var _pcePreviewDebounce = null;
    var _pcePreviewReqId    = 0;

    function pceColHeaderRowHtml(tipo) {
        var heads = {
            compras: ['No.','Fecha','Tipo Doc.','N° Documento / Cód. Generación','NRC','Proveedor',
                'Compras Exentas Internas','Compras Exentas Import.','Compras Gravadas Internas',
                'Compras Gravadas Import.','Crédito Fiscal','IVA Percibido','Total Compras','Compras a Sujetos Excluidos'],
            cf: ['No.','Fecha','Del','Al','Máq. Registradora','V. No Sujetas','V. Exentas','V. Gravadas','Exportaciones','Total Ventas Diarias'],
            ccf: ['No.','Fecha','Tipo Doc.','N° Correlativo / Cód. Generación','Nombre del Cliente','NRC',
                'V. No Sujetas','V. Exentas','V. Gravadas','Débito Fiscal','Total de Ventas']
        };
        var moneyFrom = { compras: 6, cf: 5, ccf: 6 };
        var arr = heads[tipo] || [];
        var html = '<tr>';
        arr.forEach(function(h, i) {
            html += '<th' + (i >= moneyFrom[tipo] ? ' style="text-align:right"' : '') + '>' + h + '</th>';
        });
        return html + '</tr>';
    }

    function pceTituloLibro(tipo) {
        return { compras: 'LIBRO DE COMPRAS', cf: 'LIBRO DE VENTAS A CONSUMIDOR FINAL',
                  ccf: 'LIBRO DE VENTAS A CONTRIBUYENTES (CRÉDITO FISCAL)' }[tipo] || '';
    }

    function pceHeaderBlockHtml(tipo) {
        return '<tr class="ll-libro-header-row"><th colspan="' + (LL_COLSPANS[tipo] || 1) + '" class="ll-libro-header-cell">' +
            '<div class="ll-libro-header-inner">' +
            '<span class="ll-libro-header-title">' + pceTituloLibro(tipo) + '</span>' +
            '<span class="ll-libro-header-empresa">Empresa de Ejemplo, S.A. de C.V.</span>' +
            '<span class="ll-libro-header-datos">NRC: 000000&nbsp;&nbsp;&nbsp;NIT: 0000-000000-000-0&nbsp;&nbsp;&nbsp;Período: Enero 2026</span>' +
            '</div></th></tr>';
    }

    function pceColgroupHtml(tipo) {
        var n = LL_COLSPANS[tipo] || 1;
        return '<colgroup>' + new Array(n + 1).join('<col>') + '</colgroup>';
    }

    function pceGenerarFilasMuestra(tipo) {
        var filas = [];
        var n = PCE_MUESTRA_FILAS;
        if (tipo === 'compras') {
            for (var i = 1; i <= n; i++) {
                filas.push('<tr>' +
                    '<td>' + i + '</td>' +
                    '<td>' + String(((i - 1) % 28) + 1).padStart(2,'0') + '/01/2026</td>' +
                    '<td>03</td>' +
                    '<td style="font-family:monospace;">DTE-' + (1000 + i) + '</td>' +
                    '<td>' + (100000 + i) + '</td>' +
                    '<td>Proveedor de Ejemplo ' + i + ', S.A. de C.V.</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(120.50) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money td-total">' + fMoney(15.67) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money" style="font-weight:700;">' + fMoney(136.17) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '</tr>');
            }
        } else if (tipo === 'cf') {
            for (var j = 1; j <= n; j++) {
                filas.push('<tr>' +
                    '<td>' + j + '</td>' +
                    '<td>' + String(((j - 1) % 28) + 1).padStart(2,'0') + '/01/2026</td>' +
                    '<td>' + (4000 + j) + '</td>' +
                    '<td>' + (4050 + j) + '</td>' +
                    '<td>M-00' + j + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(210.00) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money" style="font-weight:700;">' + fMoney(210.00) + '</td>' +
                    '</tr>');
            }
        } else { // ccf
            for (var k = 1; k <= n; k++) {
                filas.push('<tr>' +
                    '<td>' + k + '</td>' +
                    '<td>' + String(((k - 1) % 28) + 1).padStart(2,'0') + '/01/2026</td>' +
                    '<td>03</td>' +
                    '<td style="font-family:monospace;">DTE-' + (2000 + k) + '</td>' +
                    '<td>Cliente de Ejemplo ' + k + ', S.A. de C.V.</td>' +
                    '<td>' + (200000 + k) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(340.00) + '</td>' +
                    '<td class="td-money td-total">' + fMoney(44.20) + '</td>' +
                    '<td class="td-money" style="font-weight:700;">' + fMoney(384.20) + '</td>' +
                    '</tr>');
            }
        }
        return filas;
    }

    // Firma + Cuadro Resumen de ejemplo — mismo marcado que buildFirmaContentHtml /
    // buildResumenHtml reales, con datos ficticios para poder mostrarlos siempre.
    function pceFirmaResumenHtml(tipo) {
        var resumenHtml = '';
        if (tipo === 'cf' || tipo === 'ccf') {
            var thStyle  = 'border:1px solid #bbb;padding:3px 6px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:#f0f0f0;text-align:right;white-space:nowrap;';
            var thLStyle = 'border:1px solid #bbb;padding:3px 6px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:#f0f0f0;text-align:left;';
            var tdStyle  = 'border:1px solid #ddd;padding:3px 6px;font-size:7.5px;text-align:right;font-family:monospace;color:#222;';
            var tdLStyle = 'border:1px solid #ddd;padding:3px 6px;font-size:7.5px;color:#333;white-space:nowrap;';
            var tdTot    = 'border:1px solid #bbb;padding:3px 6px;font-size:7.5px;text-align:right;font-family:monospace;font-weight:700;color:#000;background:#f5f5f5;';
            var tdTotL   = 'border:1px solid #bbb;padding:3px 6px;font-size:7.5px;font-weight:700;color:#000;background:#f5f5f5;white-space:nowrap;';
            resumenHtml =
                '<div style="border:1px solid #aaa;border-radius:4px;padding:7px 9px;min-width:320px;max-width:360px;">' +
                '<p style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#000;margin-bottom:5px;border-bottom:1.5px solid #999;padding-bottom:3px;">Resumen del Período</p>' +
                '<table style="width:100%;border-collapse:collapse;"><thead><tr>' +
                '<th style="' + thLStyle + '">Nombre</th><th style="' + thStyle + '">V. Exenta</th>' +
                '<th style="' + thStyle + '">V. Gravada</th><th style="' + thStyle + '">IVA</th><th style="' + thStyle + '">Total</th>' +
                '</tr></thead><tbody>' +
                '<tr><td style="' + tdLStyle + '">Venta Consumidor Final</td><td style="' + tdStyle + '">' + fMoney(1200) + '</td><td style="' + tdStyle + '">' + fMoney(3400) + '</td><td style="' + tdStyle + '">' + fMoney(442) + '</td><td style="' + tdStyle + '">' + fMoney(5042) + '</td></tr>' +
                '<tr><td style="' + tdLStyle + '">Ventas Crédito Fiscal</td><td style="' + tdStyle + '">' + fMoney(800) + '</td><td style="' + tdStyle + '">' + fMoney(7480) + '</td><td style="' + tdStyle + '">' + fMoney(972.40) + '</td><td style="' + tdStyle + '">' + fMoney(9252.40) + '</td></tr>' +
                '<tr><td style="' + tdTotL + '">Total General</td><td style="' + tdTot + '">' + fMoney(2000) + '</td><td style="' + tdTot + '">' + fMoney(10880) + '</td><td style="' + tdTot + '">' + fMoney(1414.40) + '</td><td style="' + tdTot + '">' + fMoney(14294.40) + '</td></tr>' +
                '</tbody></table></div>';
        }
        return '<div style="margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end;">' +
            '<div style="width:280px;">' +
            '<div style="margin-bottom:6px;padding-bottom:0;height:30px;"></div>' +
            '<p style="font-size:12px;font-weight:600;color:#000;">F. ___________________</p>' +
            '<p style="font-size:12px;color:#333;margin-top:4px;">Nombre del Firmante (ejemplo)</p>' +
            '<p style="font-size:10px;color:#555;margin-top:2px;">Cargo (ejemplo)</p>' +
            '</div>' + resumenHtml + '</div>';
    }

    // Aplica los valores actuales del formulario (aún sin guardar) para regenerar
    // la vista previa paginada. Con "debounce" para no recalcular en cada pulsación.
    function pceRenderPreview() {
        clearTimeout(_pcePreviewDebounce);
        _pcePreviewDebounce = setTimeout(pceRenderPreviewPaginado, 150);
    }

    function pceRenderPreviewPaginado() {
        var tipo = _pceLibroActivo;
        var pcfg = pceReadFormValues();
        var orientacion = getLlOrientacion(tipo);
        var colWidthsCss = pceColWidthsCss(tipo);
        var css = pceLibroPrintCss(pcfg, orientacion, colWidthsCss);
        var colspan = LL_COLSPANS[tipo] || 1;
        var tableId = LL_TABLE_IDS[tipo];
        var colgroup = pceColgroupHtml(tipo);
        var headerRow = pceHeaderBlockHtml(tipo);
        var colHeadRow = pceColHeaderRowHtml(tipo);
        var filas = pceGenerarFilasMuestra(tipo);
        var firmaRowHtml = '<tr class="ll-firma-row"><td colspan="' + colspan + '">' + pceFirmaResumenHtml(tipo) + '</td></tr>';

        var pageWcm = orientacion === 'landscape' ? PCE_PAPER_CM.h : PCE_PAPER_CM.w;
        var pageHcm = orientacion === 'landscape' ? PCE_PAPER_CM.w : PCE_PAPER_CM.h;
        var contentWcm = pageWcm - pcfg.marginLeftCm - pcfg.marginRightCm;
        var contentHpx = (pageHcm - pcfg.marginTopCm - pcfg.marginBottomCm) * PCE_PX_PER_CM;

        // ── Paso 1: medir en un iframe oculto las alturas reales de cada fila,
        // usando exactamente el mismo ancho de contenido que tendrá la página real ──
        var measureFrame = document.getElementById('pceMeasureFrame');
        if (!measureFrame) {
            measureFrame = document.createElement('iframe');
            measureFrame.id = 'pceMeasureFrame';
            measureFrame.setAttribute('aria-hidden', 'true');
            measureFrame.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px;border:0;visibility:hidden;';
            document.body.appendChild(measureFrame);
        }

        var measureHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + css +
            'html,body{margin:0;padding:0;}' +
            'body{width:' + contentWcm + 'cm;}' +
            '</style></head><body>' +
            '<table class="ll-print-table" id="' + tableId + '">' + colgroup +
            '<thead>' + headerRow + colHeadRow + '</thead>' +
            '<tbody>' + filas.join('') + '</tbody>' +
            '<tfoot>' + firmaRowHtml + '</tfoot></table>' +
            '</body></html>';

        var reqId = ++_pcePreviewReqId;
        measureFrame.onload = function() {
            if (reqId !== _pcePreviewReqId) return; // ya hay una petición de vista previa más reciente
            try {
                var doc = measureFrame.contentDocument;
                var table = doc.getElementById(tableId);
                var theadRows = table.querySelectorAll('thead tr');
                var headerH = theadRows[0].getBoundingClientRect().height;
                var colHeadH = theadRows[1].getBoundingClientRect().height;
                var bodyRows = table.querySelectorAll('tbody tr');
                var rowHeights = Array.prototype.map.call(bodyRows, function(tr) { return tr.getBoundingClientRect().height; });
                var firmaRowEl = table.querySelector('tfoot tr.ll-firma-row');
                var firmaH = firmaRowEl ? firmaRowEl.getBoundingClientRect().height : 0;

                // ── Paso 2: distribuir filas en páginas según el espacio real disponible ──
                var repeatedHeaderH = headerH + colHeadH;
                var usablePerPage = contentHpx - repeatedHeaderH;
                var paginas = [[]];
                var restante = usablePerPage;
                rowHeights.forEach(function(h, i) {
                    if (h > restante && paginas[paginas.length - 1].length > 0) {
                        paginas.push([]);
                        restante = usablePerPage;
                    }
                    paginas[paginas.length - 1].push(i);
                    restante -= h;
                });
                if (firmaH > restante) paginas.push([]);
                var firmaPageIdx = paginas.length - 1;

                pceRenderPaginasFinal(tipo, pcfg, orientacion, css, tableId, colgroup, headerRow, colHeadRow, filas, firmaRowHtml, paginas, firmaPageIdx);
            } catch (e) {
                console.warn('Vista previa: no se pudo paginar', e);
            }
        };
        measureFrame.srcdoc = measureHtml;
    }

    // ── Paso 3: renderizar cada página como una "hoja" física a escala real ──
    function pceRenderPaginasFinal(tipo, pcfg, orientacion, css, tableId, colgroup, headerRow, colHeadRow, filas, firmaRowHtml, paginas, firmaPageIdx) {
        var wrap = document.getElementById('pceLivePreview');
        var wrapOuter = document.getElementById('pceLivePreviewWrap');
        var infoEl = document.getElementById('pcePreviewPagesInfo');
        if (!wrap) return;

        var pageWcm = orientacion === 'landscape' ? PCE_PAPER_CM.h : PCE_PAPER_CM.w;
        var pageHcm = orientacion === 'landscape' ? PCE_PAPER_CM.w : PCE_PAPER_CM.h;
        var pageWpx = pageWcm * PCE_PX_PER_CM;
        var pageHpx = pageHcm * PCE_PX_PER_CM;
        var totalPaginas = paginas.length;

        var previewWidthPx = (wrapOuter ? wrapOuter.clientWidth : 480) - 32;
        var scale = Math.max(0.18, Math.min(1, previewWidthPx / pageWpx));

        if (infoEl) infoEl.textContent = totalPaginas + (totalPaginas === 1 ? ' página' : ' páginas') + ' (' + PCE_MUESTRA_FILAS + ' registros de ejemplo) — ' + (orientacion === 'landscape' ? 'Horizontal' : 'Vertical');

        var html = '';
        paginas.forEach(function(indices, pIdx) {
            var isFirmaPage = (pIdx === firmaPageIdx);
            var bodyHtml = indices.map(function(i) { return filas[i]; }).join('');
            var footHtml = isFirmaPage ? firmaRowHtml : '';
            var tableHtml = '<table class="ll-print-table" id="' + tableId + '">' + colgroup +
                '<thead>' + headerRow + colHeadRow + '</thead>' +
                '<tbody>' + bodyHtml + '</tbody>' +
                '<tfoot>' + footHtml + '</tfoot></table>';

            var pageDoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + css +
                'html,body{margin:0;padding:0;}' +
                'body{width:' + pageWcm + 'cm;height:' + pageHcm + 'cm;box-sizing:border-box;' +
                'padding:' + pcfg.marginTopCm + 'cm ' + pcfg.marginRightCm + 'cm ' + pcfg.marginBottomCm + 'cm ' + pcfg.marginLeftCm + 'cm;' +
                'overflow:hidden;}</style></head><body>' + tableHtml + '</body></html>';

            html +=
                '<div style="margin-bottom:16px;">' +
                  '<div style="width:' + Math.round(pageWpx * scale) + 'px;height:' + Math.round(pageHpx * scale) + 'px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.45);border-radius:2px;background:#fff;">' +
                    '<iframe title="Página ' + (pIdx + 1) + '" scrolling="no" style="width:' + pageWpx + 'px;height:' + pageHpx + 'px;border:0;transform:scale(' + scale + ');transform-origin:top left;" srcdoc="' + pageDoc.replace(/"/g, '&quot;') + '"></iframe>' +
                  '</div>' +
                  '<p style="text-align:center;font-size:9.5px;color:#71717a;margin-top:6px;">Página ' + (pIdx + 1) + ' de ' + totalPaginas + '</p>' +
                '</div>';
        });

        wrap.innerHTML = html;
    }

    function pceGuardarActual() {
        var tipo = _pceLibroActivo;
        var values = pceReadFormValues();
        window.fiscalAPI.setPrintConfig(tipo, values).then(function(res) {
            if (res && res.ok) {
                // Actualiza la caché en memoria para que impresión/PDF usen el valor recién guardado
                if (!_printConfigCache) _printConfigCache = {};
                _printConfigCache[tipo] = res.config;
                showToast('Configuración de impresión guardada — ' + PCE_LIBRO_LABELS[tipo], 'success');
            } else {
                showToast('No se pudo guardar la configuración', 'error');
            }
        });
    }

    function pceResetActual() {
        var tipo = _pceLibroActivo;
        fsConfirm('¿Restablecer el diseño original de impresión para "' + PCE_LIBRO_LABELS[tipo] + '"?\n\nSe perderán las personalizaciones de este libro.', function() {
            window.fiscalAPI.resetPrintConfig(tipo).then(function(res) {
                if (res && res.ok) {
                    if (!_printConfigCache) _printConfigCache = {};
                    _printConfigCache[tipo] = res.config;
                    pceLoadFormFromConfig(res.config);
                    pceRenderPreview();
                    showToast('Diseño original restaurado — ' + PCE_LIBRO_LABELS[tipo], 'success');
                } else {
                    showToast('No se pudo restablecer la configuración', 'error');
                }
            });
        });
    }