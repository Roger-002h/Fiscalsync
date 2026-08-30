// parametros/Parametros.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 6 — EDITOR DE PARÁMETROS / LISTAS DESPLEGABLES
    // Permite al admin agregar, editar y eliminar opciones de todos los selects.
    // Los cambios se persisten en fsStore y se aplican dinámicamente a todos los selects.
    // ══════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 6 — EDITOR DE PARÁMETROS POR LIBRO CONTABLE
    // Navegación: columna izquierda = libro, sub-tabs = listas del libro.
    // ══════════════════════════════════════════════════════════════════

    // Definición de libros y sus listas
    var PARAM_LIBROS = [
        {
            id: 'compras', label: 'Compras', color: 'var(--rp-violet-soft)',
            listas: [
                {group:'tipoDteCompras', label:'Tipo de DTE'},
                {group:'claseDebito',    label:'Clase'},
                {group:'tipoOp_compras', label:'Tipo de Operación'},
                {group:'clasif',         label:'Clasificación'},
                {group:'sector',         label:'Sector'},
                {group:'tipoCosto',      label:'Tipo de Costo/Gasto'}
            ]
        },
        {
            id: 'debito', label: 'Ventas Débito (CCF)', color: 'var(--rp-accent)',
            listas: [
                {group:'tipoDteDebito',  label:'Tipo de DTE'},
                {group:'claseDebito',    label:'Clase'},
                {group:'tipoOp_compras', label:'Tipo de Operación'},
                {group:'tipoIng',        label:'Tipo de Ingreso'},
                {group:'clasif',         label:'Clasificación'},
                {group:'sector',         label:'Sector'},
                {group:'tipoCosto',      label:'Tipo de Costo/Gasto'}
            ]
        },
        {
            id: 'cf', label: 'Ventas CF', color: 'var(--rp-success)',
            listas: [
                {group:'tipoDteCf',      label:'Tipo de DTE'},
                {group:'claseDebito',    label:'Clase'},
                {group:'tipoOp_compras', label:'Tipo de Operación'},
                {group:'tipoIng',        label:'Tipo de Ingreso'},
                {group:'clasif',         label:'Clasificación'},
                {group:'sector',         label:'Sector'},
                {group:'tipoCosto',      label:'Tipo de Costo/Gasto'}
            ]
        },
        {
            id: 'excluido', label: 'Sujeto Excluido', color: 'var(--rp-warning)',
            listas: [
                {group:'tipoDocExcluido', label:'Tipo de Documento'},
                {group:'tipoOp_compras',  label:'Tipo de Operación'},
                {group:'clasif',          label:'Clasificación'},
                {group:'sector',          label:'Sector'},
                {group:'tipoCosto',       label:'Tipo de Costo/Gasto'}
            ]
        },
        {
            id: 'f14', label: 'F-14 (Renta)', color: 'var(--rp-error)',
            listas: [
                {group:'domiciliado',    label:'Domiciliado'},
                {group:'codIngreso',     label:'Código de Ingreso'},
                {group:'tipoOp_compras', label:'Tipo de Operación'},
                {group:'clasif',         label:'Clasificación'},
                {group:'sector',         label:'Sector'},
                {group:'tipoCosto',      label:'Tipo de Costo/Gasto'}
            ]
        },
        {
            id: 'anulados', label: 'Anulados', color: 'var(--rp-text-secondary)',
            listas: [
                {group:'tipoDteAnulados', label:'Tipo de Documento'},
                {group:'claseAnulados',   label:'Clase de Documento'},
                {group:'tipoDetalle',     label:'Tipo de Detalle'}
            ]
        },
        {
            id: 'empresa', label: 'Empresa', color: '#06b6d4',
            listas: [
                {group:'tipoIng', label:'Tipo de Ingreso'},
                {group:'sector',  label:'Sector'}
            ]
        }
    ];

    var PARAM_DEFAULTS = {
        clasif: [
            {v:'1',l:'1 — Costo'},{v:'2',l:'2 — Gasto'},
            {v:'8',l:'8 — Más de 1 anexo'},{v:'9',l:'9 — Excepciones'},
            {v:'0',l:'0 — Anterior feb 2024'}
        ],
        sector: [
            {v:'1',l:'1 — Industria'},{v:'2',l:'2 — Comercio'},
            {v:'3',l:'3 — Agropecuaria'},{v:'4',l:'4 — Servicios/Prof.'},
            {v:'8',l:'8 — Más de 1 anexo'},{v:'9',l:'9 — Excepciones'},
            {v:'0',l:'0 — Anterior feb 2024'}
        ],
        tipoCosto: [
            {v:'1',l:'1 — Gasto de Venta sin Donación'},{v:'2',l:'2 — Gasto de Administración sin Donación'},
            {v:'3',l:'3 — Gastos Financieros sin Donación'},{v:'4',l:'4 — Costo Art. Producidos/Comprados Imp./Intern.'},
            {v:'5',l:'5 — Costo Art. Producidos/Comprados Interno'},{v:'6',l:'6 — Costo Indirectos de Fabricación'},
            {v:'7',l:'7 — Mano de obra'},{v:'8',l:'8 — Más de 1 anexo'},
            {v:'9',l:'9 — Excepciones'},{v:'0',l:'0 — Anterior feb 2024'}
        ],
        tipoOp_compras: [
            {v:'0',l:'0 — Periodo Anterior Enero 2025'},{v:'1',l:'1 — Gravada'},
            {v:'2',l:'2 — No Gravada o Exento'},{v:'3',l:'3 — Excluido o no Constituye Renta'},
            {v:'4',l:'4 — Mixta (operación gravada y exenta en mismo doc.)'},
            {v:'12',l:'12 — Ingresos sujetos de retención en F910'},
            {v:'13',l:'13 — Sujetos pasivos excluidos (art. 6 LISR)'}
        ],
        tipoIng: [
            {v:'1',l:'1 — Profesiones, Artes y Oficios'},{v:'2',l:'2 — Actividades de Servicios'},
            {v:'3',l:'3 — Actividades Comerciales'},{v:'4',l:'4 — Actividades Industriales'},
            {v:'5',l:'5 — Actividades Agropecuarias'},{v:'6',l:'6 — Utilidades y Dividendos'},
            {v:'7',l:'7 — Exportaciones de bienes'},
            {v:'8',l:'8 — Serv. Realizados en el Exterior y Utilizados en El Salvador'},
            {v:'9',l:'9 — Exportaciones de servicios'},{v:'10',l:'10 — Otras Rentas Gravables'},
            {v:'12',l:'12 — Ingresos sujetos de retención en F910'}
        ],
        tipoDteDebito:  [{v:'03',l:'03 — Comprobante de Crédito Fiscal'},{v:'05',l:'05 — Nota de Crédito'},{v:'06',l:'06 — Nota de Débito'}],
        tipoDteCf:      [{v:'01',l:'01 — Factura Consumidor Final'},{v:'02',l:'02 — Factura de Venta Simplificada'},{v:'05',l:'05 — Nota de Crédito'},{v:'10',l:'10 — Tiquetes Máquinas Registradora'},{v:'11',l:'11 — Factura de Exportación'}],
        tipoDteCompras: [
            {v:'03',l:'03 — Comprobante de Crédito Fiscal'},{v:'05',l:'05 — Nota de Crédito'},{v:'06',l:'06 — Nota de Débito'},
            {v:'07',l:'07 — Comprobante de Retención'},{v:'08',l:'08 — Comprobante de Liquidación'},
            {v:'09',l:'09 — Documento Contable de Liquidación'},{v:'10',l:'10 — Tiquetes Máquinas Registradora'},
            {v:'11',l:'11 — Facturas de Exportación'},{v:'12',l:'12 — Declaración de Mercancías'},{v:'13',l:'13 — Mandamiento de Ingreso'}
        ],
        tipoDteAnulados: [
            {v:'01',l:'01 — Factura Consumidor Final'},{v:'02',l:'02 — Factura de Venta Simplificada'},
            {v:'03',l:'03 — Comprobante de Crédito Fiscal'},{v:'04',l:'04 — Nota de Remisión'},
            {v:'05',l:'05 — Nota de Crédito'},{v:'06',l:'06 — Nota de Débito'},
            {v:'07',l:'07 — Comprobante de Retención'},{v:'08',l:'08 — Comprobante de Liquidación'},
            {v:'09',l:'09 — Documento Contable de Liquidación'},{v:'10',l:'10 — Tiquetes Máquinas Registradora'},
            {v:'11',l:'11 — Facturas de Exportación'},{v:'14',l:'14 — Factura de Sujeto Excluido'}
        ],
        tipoDocExcluido: [{v:'1',l:'1 — NIT'},{v:'2',l:'2 — DUI'},{v:'3',l:'3 — Otro Documento'}],
        claseDebito:     [{v:'1',l:'1 — Impreso por Imprenta'},{v:'2',l:'2 — Formulario Único'},{v:'4',l:'4 — DTE'}],
        domiciliado:     [{v:'1',l:'1 — Domiciliado'},{v:'2',l:'2 — No Domiciliado'}],
        codIngreso: [
            {v:'01',l:'01 — Servicios de carácter permanente'},{v:'05',l:'05 — Rentas P.J. dom. depósitos de dinero'},
            {v:'06',l:'06 — Rentas P.J. dom. títulos valores'},{v:'07',l:'07 — Retenciones por activ. agropecuarias'},
            {v:'08',l:'08 — Retenciones por juicios ejecutivos'},{v:'09',l:'09 — Otras retenciones'},
            {v:'11',l:'11 — Servicios sin dependencia laboral'},{v:'19',l:'19 — Costos y gastos sujetos a retención y entero'},
            {v:'20',l:'20 — Valores garantizados por seguro dotal u otros'},{v:'21',l:'21 — Otros servicios sin dependencia laboral'},
            {v:'22',l:'22 — Transf. bienes intangibles P.N. domiciliadas'},{v:'23',l:'23 — Transf. bienes intangibles P.J. domiciliadas'},
            {v:'24',l:'24 — Uso/concesión bienes tang. e intang. P.N. dom.'},{v:'25',l:'25 — Uso/concesión bienes tang. e intang. P.J. dom.'},
            {v:'26',l:'26 — Op. renta y asimiladas a rentas domiciliadas'},{v:'27',l:'27 — Ret. arrendamiento P.N.'},
            {v:'28',l:'28 — Rentas P.N. dom. títulos valores'},{v:'29',l:'29 — Premios/ganancia dom. concursos, rifas, etc.'},
            {v:'30',l:'30 — Rentas no dom. rendimiento capital, títulos'},{v:'31',l:'31 — Uso/concesión bienes tang. e intang. no dom.'},
            {v:'32',l:'32 — Transf. bienes intangibles no domiciliadas'},{v:'33',l:'33 — Rentas obtenidas en país por no domiciliadas'},
            {v:'34',l:'34 — Servicios utilizados en país, origen exterior'},{v:'35',l:'35 — Pagos a casa matriz (no dom.) filiales/sucurs.'},
            {v:'36',l:'36 — Transporte internacional no domiciliados'},{v:'37',l:'37 — Aseguradoras/reaseguradoras no domiciliados'},
            {v:'38',l:'38 — Financiamiento inst. financieras no dom.'},{v:'39',l:'39 — Op. intangibles o uso concesión no dom.'},
            {v:'40',l:'40 — Rentas paraísos fiscales'},{v:'41',l:'41 — Premios/ganancias no dom. concursos, rifas'},
            {v:'42',l:'42 — Otras retenciones'},{v:'43',l:'43 — Pago/acreditación utilidades socios dom.'},
            {v:'44',l:'44 — Pago/acreditación utilidades no domiciliados'},{v:'45',l:'45 — Pago/acreditación disminución capital'},
            {v:'46',l:'46 — Préstamos, mutuos, anticipos, financiamientos'},{v:'47',l:'47 — Rentas P.N. dom. intereses, premios depósitos'},
            {v:'48',l:'48 — Indemnizaciones por daños'},{v:'49',l:'49 — Ingresos remuneraciones inversionistas'},
            {v:'80',l:'80 — Serv. permanente sin contrib. sociales (jubilados)'},{v:'81',l:'81 — Serv. permanente sin retención jubilados/pens.'},
            {v:'82',l:'82 — Pago sueldos caídos con retención'},{v:'83',l:'83 — Pago sueldos caídos sin retención'},
            {v:'84',l:'84 — Pago de dietas'},{v:'85',l:'85 — Indemnizaciones laborales'}
        ],
        tipoDetalle: [{v:'A',l:'A — Anulados / Invalidados'},{v:'D',l:'D — DTE Invalidado'},{v:'X',l:'X — Extraviados'}],
        claseAnulados: [{v:'1',l:'1 — Impreso por Imprenta'},{v:'2',l:'2 — Formulario Único'},{v:'4',l:'4 — DTE'}]
    };

    var PARAM_SELECT_IDS = {
        clasif:         ['cp_clasif','ex_clasif','f14_clasif'],
        sector:         ['cp_sector','ex_sector','f14_sector','emp_sector'],
        tipoCosto:      ['cp_tipo_costo','ex_tipo_costo','f14_tipo_costo'],
        tipoOp_compras: ['d_tipo_op','cf_tipo_op','cp_tipo_op','ex_tipo_op','f14_tipo_op'],
        tipoIng:        ['d_tipo_ing','cf_tipo_ing','emp_tipo_ing'],
        tipoDteDebito:  ['d_tipo_doc'],
        tipoDteCf:      ['cf_tipo_doc'],
        tipoDteCompras: ['cp_tipo_doc'],
        tipoDocExcluido:['ex_tipo_doc'],
        claseDebito:    ['d_clase','cf_clase','cp_clase'],
        domiciliado:    ['f14_domiciliado'],
        codIngreso:     ['f14_cod_ingreso'],
        tipoDetalle:    ['an_tipo_detalle'],
        tipoDteAnulados:['an_tipo_doc'],
        claseAnulados:  ['an_clase']
    };

    var PARAM_STORAGE_KEY = 'fs_params_v1.0.9';
    var _paramActiveLibro = 'compras';
    var _paramActiveGroup = 'tipoDteCompras';
    var _paramEditorData  = [];

    function paramLoadAll() {
        var raw = fsStore.getItem(PARAM_STORAGE_KEY);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch(e) { return null; }
    }

    function paramSaveAllData(data) {
        fsStore.setItem(PARAM_STORAGE_KEY, JSON.stringify(data));
    }

    function paramGetGroup(group) {
        var all = paramLoadAll();
        if (all && all[group]) return all[group];
        return JSON.parse(JSON.stringify(PARAM_DEFAULTS[group] || []));
    }

    function paramApplyToSelects(group, options) {
        var ids = PARAM_SELECT_IDS[group] || [];
        ids.forEach(function(selId) {
            var sel = document.getElementById(selId);
            if (!sel) return;
            var curVal = sel.value;
            sel.innerHTML = '';
            options.forEach(function(opt) {
                var o = document.createElement('option');
                o.value = opt.v;
                o.textContent = opt.l;
                sel.appendChild(o);
            });
            if (options.some(function(o) { return o.v === curVal; })) sel.value = curVal;
        });
    }

    function paramApplyAll() {
        Object.keys(PARAM_DEFAULTS).forEach(function(group) {
            paramApplyToSelects(group, paramGetGroup(group));
        });
        var cl = paramGetGroup('clasif');
        var sl = paramGetGroup('sector');
        var tl = paramGetGroup('tipoCosto');
        CLASIF_LABELS = {'': '— Sin clasificar —'};
        cl.forEach(function(o) { CLASIF_LABELS[o.v] = o.l; });
        SECTOR_LABELS = {'': '— Sin clasificar —'};
        sl.forEach(function(o) { SECTOR_LABELS[o.v] = o.l; });
        COSTO_LABELS = {'': '— Sin clasificar —'};
        tl.forEach(function(o) { COSTO_LABELS[o.v] = o.l; });
    }

    // ── Render columna izquierda (libros) ──
    function _renderParamLibroNav() {
        var nav = document.getElementById('paramLibroNav');
        if (!nav) return;
        nav.innerHTML = '';
        PARAM_LIBROS.forEach(function(libro) {
            var btn = document.createElement('button');
            var isActive = libro.id === _paramActiveLibro;
            btn.style.cssText = 'width:100%;text-align:left;padding:9px 12px;font-size:12px;font-weight:600;border:none;border-radius:8px;cursor:pointer;font-family:\'Inter\',sans-serif;transition:all .15s;line-height:1.3;' +
                (isActive
                    ? 'background:var(--rp-border);color:' + libro.color + ';border-left:3px solid ' + libro.color + ';'
                    : 'background:transparent;color:var(--rp-text-secondary);border-left:3px solid transparent;');
            btn.textContent = libro.label;
            btn.onmouseover = function() { if (libro.id !== _paramActiveLibro) { this.style.color='var(--rp-text-secondary)'; this.style.background='var(--rp-inset)'; } };
            btn.onmouseout  = function() { if (libro.id !== _paramActiveLibro) { this.style.color='var(--rp-text-secondary)'; this.style.background='transparent'; } };
            btn.onclick = (function(lb) { return function() { paramSelectLibro(lb.id); }; })(libro);
            nav.appendChild(btn);
        });
    }

    // ── Render sub-tabs (listas del libro activo) ──
    function _renderParamListNav() {
        var nav = document.getElementById('paramListNav');
        if (!nav) return;
        nav.innerHTML = '';
        var libro = PARAM_LIBROS.find(function(l) { return l.id === _paramActiveLibro; });
        if (!libro) return;
        libro.listas.forEach(function(lista) {
            var btn = document.createElement('button');
            var isActive = lista.group === _paramActiveGroup;
            btn.style.cssText = 'padding:6px 14px;font-size:11px;font-weight:600;border-radius:7px;cursor:pointer;font-family:\'Inter\',sans-serif;transition:all .15s;white-space:nowrap;' +
                (isActive
                    ? 'background:var(--rp-border);color:var(--rp-text-primary);border:1px solid var(--rp-text-secondary);'
                    : 'background:transparent;color:var(--rp-text-secondary);border:1px solid transparent;');
            btn.textContent = lista.label;
            btn.onmouseover = function() { if (lista.group !== _paramActiveGroup) { this.style.color='var(--rp-text-secondary)'; } };
            btn.onmouseout  = function() { if (lista.group !== _paramActiveGroup) { this.style.color='var(--rp-text-secondary)'; } };
            btn.onclick = (function(g) { return function() { paramSelectGroup(g); }; })(lista.group);
            nav.appendChild(btn);
        });
        // Actualizar label
        var labelEl = document.getElementById('paramListLabel');
        if (labelEl) {
            var cur = libro.listas.find(function(l) { return l.group === _paramActiveGroup; });
            labelEl.textContent = libro.label + ' › ' + (cur ? cur.label : '');
        }
    }

    function paramSelectLibro(libroId) {
        _paramActiveLibro = libroId;
        var libro = PARAM_LIBROS.find(function(l) { return l.id === libroId; });
        if (libro && libro.listas.length) _paramActiveGroup = libro.listas[0].group;
        _renderParamLibroNav();
        _renderParamListNav();
        _loadParamEditorData();
        _renderParamRows();
    }

    function paramSelectGroup(group) {
        _paramActiveGroup = group;
        _renderParamListNav();
        _loadParamEditorData();
        _renderParamRows();
    }

    function renderParamEditor() {
        // Inicializar con primer libro si no hay selección
        if (!_paramActiveLibro) _paramActiveLibro = 'compras';
        var libro = PARAM_LIBROS.find(function(l) { return l.id === _paramActiveLibro; });
        if (libro && libro.listas.length && !_paramActiveGroup) _paramActiveGroup = libro.listas[0].group;
        _renderParamLibroNav();
        _renderParamListNav();
        _loadParamEditorData();
        _renderParamRows();
    }

    function _loadParamEditorData() {
        _paramEditorData = JSON.parse(JSON.stringify(paramGetGroup(_paramActiveGroup)));
    }

    function _renderParamRows() {
        var body = document.getElementById('paramEditorBody');
        if (!body) return;
        body.innerHTML = '';
        if (!_paramEditorData.length) {
            body.innerHTML = '<p style="font-size:12px;color:var(--rp-text-secondary);padding:16px 0;">Sin opciones. Usa «Nueva opción» para agregar.</p>';
            return;
        }
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        _paramEditorData.forEach(function(opt, i) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;background:var(--rp-inset);border:1px solid var(--rp-border-strong);border-radius:8px;padding:8px 10px;';
            row.innerHTML =
                '<input type="text" value="' + _esc(opt.v) + '" placeholder="Código" ' +
                'style="width:72px;background:var(--rp-border);border:1px solid var(--rp-border-strong);border-radius:6px;color:var(--rp-text-primary);font-size:12px;font-family:\'Inter\',sans-serif;padding:6px 9px;" ' +
                'oninput="paramEditVal(' + i + ',\'v\',this.value)">' +
                '<input type="text" value="' + _esc(opt.l) + '" placeholder="Etiqueta" ' +
                'style="flex:1;background:var(--rp-border);border:1px solid var(--rp-border-strong);border-radius:6px;color:var(--rp-text-primary);font-size:12px;font-family:\'Inter\',sans-serif;padding:6px 9px;" ' +
                'oninput="paramEditVal(' + i + ',\'l\',this.value)">' +
                '<button onclick="paramMoveRow(' + i + ',-1)" title="Subir" style="padding:5px 8px;background:transparent;border:1px solid var(--rp-border-strong);color:var(--rp-text-secondary);border-radius:6px;cursor:pointer;font-size:13px;line-height:1;" onmouseover="this.style.color=\'#fff\'" onmouseout="this.style.color=\'var(--rp-text-secondary)\'">↑</button>' +
                '<button onclick="paramMoveRow(' + i + ',1)" title="Bajar" style="padding:5px 8px;background:transparent;border:1px solid var(--rp-border-strong);color:var(--rp-text-secondary);border-radius:6px;cursor:pointer;font-size:13px;line-height:1;" onmouseover="this.style.color=\'#fff\'" onmouseout="this.style.color=\'var(--rp-text-secondary)\'">↓</button>' +
                '<button onclick="paramDeleteRow(' + i + ')" title="Eliminar" style="padding:5px 8px;background:transparent;border:1px solid rgba(248,113,113,0.3);color:var(--rp-error);border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;line-height:1;" onmouseover="this.style.borderColor=\'rgba(248,113,113,0.8)\'" onmouseout="this.style.borderColor=\'rgba(248,113,113,0.3)\'">✕</button>';
            wrap.appendChild(row);
        });
        body.appendChild(wrap);
    }

    function paramEditVal(idx, field, val) {
        if (_paramEditorData[idx]) _paramEditorData[idx][field] = val;
    }

    function paramDeleteRow(idx) {
        _paramEditorData.splice(idx, 1);
        _renderParamRows();
    }

    function paramMoveRow(idx, dir) {
        var newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= _paramEditorData.length) return;
        var tmp = _paramEditorData[idx];
        _paramEditorData[idx] = _paramEditorData[newIdx];
        _paramEditorData[newIdx] = tmp;
        _renderParamRows();
    }

    function paramAddOption() {
        _paramEditorData.push({v:'', l:''});
        _renderParamRows();
        var body = document.getElementById('paramEditorBody');
        if (body) setTimeout(function() { body.scrollTop = body.scrollHeight; }, 50);
    }

    function paramSaveAll() {
        var group = _paramActiveGroup;
        var clean = _paramEditorData.filter(function(o) { return o.v !== '' || o.l !== ''; });
        if (!clean.length) { showToast('Agrega al menos una opción', 'error'); return; }
        // Animación de pulso en el botón al hacer clic
        var btn = document.getElementById('paramSaveBtn');
        if (btn) {
            btn._saving = true;
            btn.classList.remove('param-save-pulse');
            void btn.offsetWidth; // reflow para reiniciar animación
            btn.classList.add('param-save-pulse');
            btn.style.background = 'var(--rp-text-primary)';
            setTimeout(function() {
                btn.classList.remove('param-save-pulse');
                btn.style.background = '#fff';
                btn._saving = false;
            }, 400);
        }
        // Diálogo de confirmación antes de guardar
        fsConfirm('¿Guardar los cambios en esta lista de parámetros?\n\nLos cambios se aplicarán de inmediato al sistema.', function() {
            var all = paramLoadAll() || {};
            all[group] = clean;
            paramSaveAllData(all);
            paramApplyToSelects(group, clean);
            if (group === 'clasif')    { CLASIF_LABELS = {'': '— Sin clasificar —'}; clean.forEach(function(o){ CLASIF_LABELS[o.v]=o.l; }); }
            else if (group === 'sector')    { SECTOR_LABELS = {'': '— Sin clasificar —'}; clean.forEach(function(o){ SECTOR_LABELS[o.v]=o.l; }); }
            else if (group === 'tipoCosto') { COSTO_LABELS  = {'': '— Sin clasificar —'}; clean.forEach(function(o){ COSTO_LABELS[o.v]=o.l; });  }
            renderAllTables();
            showToast('Cambios guardados y aplicados', 'success');
            _loadParamEditorData();
            _renderParamRows();
        });
    }

    function paramResetGroup() {
        var group = _paramActiveGroup;
        fsConfirm('¿Restaurar opciones por defecto de esta lista?', function() {
            var all = paramLoadAll() || {};
            delete all[group];
            paramSaveAllData(all);
            paramApplyToSelects(group, PARAM_DEFAULTS[group] || []);
            if (group === 'clasif')    { CLASIF_LABELS = {'': '— Sin clasificar —'}; (PARAM_DEFAULTS.clasif||[]).forEach(function(o){ CLASIF_LABELS[o.v]=o.l; }); }
            if (group === 'sector')    { SECTOR_LABELS = {'': '— Sin clasificar —'}; (PARAM_DEFAULTS.sector||[]).forEach(function(o){ SECTOR_LABELS[o.v]=o.l; }); }
            if (group === 'tipoCosto') { COSTO_LABELS  = {'': '— Sin clasificar —'}; (PARAM_DEFAULTS.tipoCosto||[]).forEach(function(o){ COSTO_LABELS[o.v]=o.l; }); }
            renderAllTables();
            showToast('Lista restaurada a valores por defecto', 'success');
            _loadParamEditorData();
            _renderParamRows();
        });
    }