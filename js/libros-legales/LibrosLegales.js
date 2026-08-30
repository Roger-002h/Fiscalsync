// libros-legales/LibrosLegales.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    let currentPrintType = '';
    // ══ AGREGADO NUEVO: modo del modal de firma — 'print' (Imprimir Libro) o 'pdf' (Descargar PDF) ══
    var _firmaModalMode = 'print';
    // Totales para el resumen imprimible de ventas
    var _llTotalesCf  = { gravadas: 0, iva: 0, total: 0 };
    var _llTotalesCcf = { gravadas: 0, iva: 0, total: 0 };

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO: PERSISTENCIA DE FIRMA DE LIBROS LEGALES
    // Guarda el nombre y cargo del firmante para no volver a preguntarlo,
    // permitiendo editarlo cuando el usuario lo desee.
    // ══════════════════════════════════════════════════════════════════
    function getFirmaConfigKey() {
        return 'fs_firma_' + (activeEmpresaId || 'default');
    }

    function getFirmaConfig() {
        try {
            var raw = fsStore.getItem(getFirmaConfigKey());
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (obj && obj.nombre) return obj;
            return null;
        } catch(e) { return null; }
    }

    function saveFirmaConfig(nombre, cargo) {
        try { fsStore.setItem(getFirmaConfigKey(), JSON.stringify({ nombre: nombre || '', cargo: cargo || '' })); } catch(e) {}
    }

    // ══════════════════════════════════════════════
    // LIBROS LEGALES — FUNCIONES
    // ══════════════════════════════════════════════

    function updateLibrosLegalesCounts() {
        document.getElementById('ll-count-compras').innerText = comprasRecords.length;
        document.getElementById('ll-count-cf').innerText      = cfRecords.length;
        document.getElementById('ll-count-ccf').innerText     = debitoRecords.length;
    }

    function resetLibrosLegalesView() {
        document.getElementById('llSelectorView').classList.remove('hidden');
        ['ll-compras','ll-cf','ll-ccf'].forEach(function(id) { document.getElementById(id).classList.add('hidden'); });
    }

    // AGREGADO NUEVO: refresca el Libro Legal (vista de impresión) que esté
    // actualmente abierto — evita que se quede mostrando los datos del mes
    // anterior después de cambiar de período con el selector de mes.
    // Se llama automáticamente cada vez que cambia currentMonth/currentYear.
    function refreshOpenLibroLegal() {
        var selectorView = document.getElementById('llSelectorView');
        if (!selectorView || !selectorView.classList.contains('hidden')) return; // no hay ningún libro abierto

        var comprasEl = document.getElementById('ll-compras');
        var cfEl      = document.getElementById('ll-cf');
        var ccfEl     = document.getElementById('ll-ccf');

        if (comprasEl && !comprasEl.classList.contains('hidden'))      renderLLCompras();
        else if (cfEl && !cfEl.classList.contains('hidden'))           renderLLCf();
        else if (ccfEl && !ccfEl.classList.contains('hidden'))         renderLLCcf();
    }

    function openLibroLegal(viewId) {
        document.getElementById('llSelectorView').classList.add('hidden');
        ['ll-compras','ll-cf','ll-ccf'].forEach(function(id) { document.getElementById(id).classList.add('hidden'); });
        document.getElementById(viewId).classList.remove('hidden');

        if (viewId === 'll-compras') renderLLCompras();
        if (viewId === 'll-cf') renderLLCf();
        if (viewId === 'll-ccf') renderLLCcf();

        lucide.createIcons();
    }

    function closeLibroLegal() {
        resetLibrosLegalesView();
        updateLibrosLegalesCounts();
    }

    function renderLLCompras() {
        var tbody = document.getElementById('llComprasBody');
        var tfoot = document.getElementById('llComprasFoot');
        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        var totIntExentas=0, totImpExentas=0, totIntGravadas=0, totImpGravadas=0, totCredito=0,
            totIvaPercibido=0, totTotal=0, totExcluidos=0;
        // CORRECCIÓN: acumulador en centavos (enteros) para el total de Crédito Fiscal —
        // evita el arrastre de errores de redondeo en punto flotante (ver más abajo).
        var totCreditoCentavos = 0;

        // AGREGADO NUEVO: las Compras a Sujetos Excluidos (Anexo 5) se agregan como
        // filas propias dentro del Libro de Compras impreso (no se calculan a partir
        // de documentos de Crédito Fiscal, ya que corresponden a un documento
        // independiente — DTE-14 / FSE). Se marcan con _esExcluido para distinguirlas
        // al momento de construir cada fila, y se combinan con las compras normales
        // para respetar el orden cronológico del libro.
        // CORRECCIÓN 02: se excluyen del Libro de Compras Impreso los registros de
        // Sujeto Excluido que ya fueron anulados (isRegistroAnulado), usando su
        // índice original dentro de excluidoRecords — sin tocar la lógica de
        // anulación ni el anexo de Sujeto Excluido, solo esta construcción de filas.
        var filasExcluido = (excluidoRecords || [])
            .map(function(r, idx) { return { r: r, idx: idx }; })
            .filter(function(o) { return !isRegistroAnulado('excluido', o.idx); })
            .map(function(o) {
                var r = o.r;
                return { _esExcluido: true, fecha: r.fecha, tipoDoc: r.tipoDoc, numDoc: r.numDoc, monto: r.monto,
                         identificacion: r.identificacion, nombre: r.nombre };
            });

        var sorted = comprasRecords.concat(filasExcluido)
            .sort(function(a,b) { return (a.fecha||'').localeCompare(b.fecha||''); });

        sorted.forEach(function(r, i) {
            var tr = document.createElement('tr');

            if (r._esExcluido) {
                // AGREGADO NUEVO: fila de Compra a Sujeto Excluido — TIPO DOC siempre "14"
                // (código de Documento de Sujeto Excluido); NRC muestra el campo
                // "NIT / DUI / Otro" y Proveedor el "Nombre Sujeto Excluido" del
                // documento. Las columnas de compras gravadas/exentas, crédito fiscal,
                // IVA Percibido y Total Compras no aplican a este tipo de documento y
                // se muestran en $0.00 (no afectan ningún cálculo); únicamente la
                // columna "Compras a Sujetos Excluidos" recibe el Monto de la Operación.
                totExcluidos += (r.monto||0);
                tr.innerHTML =
                    '<td>' + (i+1) + '</td>' +
                    '<td>' + formatFecha(r.fecha) + '</td>' +
                    '<td>14</td>' +
                    '<td style="font-family:monospace;">' + (r.numDoc||'—') + '</td>' +
                    '<td>' + (r.identificacion||'—') + '</td>' +
                    '<td>' + (r.nombre||'—') + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money">' + fMoney(0) + '</td>' +
                    '<td class="td-money" style="font-weight:700;">' + fMoney(r.monto||0) + '</td>';
                tbody.appendChild(tr);
                return;
            }

            var isNC = esNotaCredito(r.tipoDoc);
            var sign = isNC ? -1 : 1;

            var impExentas = (r.internExentas||0) + (r.impExentas||0);
            var impGravadas = (r.internGrav||0) + (r.impGrav||0) + (r.impServ||0);
            // CORRECCIÓN: el IVA Percibido que se imprime aquí se busca en el Anexo 8
            // (percibidoRecords) por número de documento, no se lee del registro de Compras.
            var ivaPercibido = buscarIvaPercibidoAnexo8(r);
            var totalConPercibido = (r.total||0) + ivaPercibido;

            totIntExentas += (r.intExentas||0) * sign;
            totImpExentas += impExentas * sign;
            totIntGravadas += (r.intGravadas||0) * sign;
            totImpGravadas += impGravadas * sign;
            // CORRECCIÓN: el total de "Crédito Fiscal" se acumulaba sumando directamente
            // los valores flotantes de r.credito, lo cual arrastraba errores de precisión
            // binaria (ej. 0.1 + 0.2 → 0.30000000000000004) y producía una diferencia de
            // centavos en el total impreso. Ahora se acumula en centavos (enteros) y se
            // convierte de vuelta a dólares al final, garantizando una suma exacta.
            totCreditoCentavos += Math.round((r.credito||0) * sign * 100);
            totIvaPercibido += ivaPercibido * sign;
            totTotal += totalConPercibido * sign;

            var ncLabel = isNC ? ' <span style="color:var(--rp-error);font-weight:700;font-size:9px;">(NC)</span>' : '';

            tr.innerHTML =
                '<td>' + (i+1) + '</td>' +
                '<td>' + formatFecha(r.fecha) + '</td>' +
                '<td>' + extractNum(r.tipoDoc) + ncLabel + '</td>' +
                '<td style="font-family:monospace;">' + (r.numDoc||'—') + '</td>' +
                '<td>' + (r.nrc||r.nit||'—') + '</td>' +
                '<td>' + (r.nombre||'—') + '</td>' +
                '<td class="td-money">' + fMoney((r.intExentas||0) * sign) + '</td>' +
                '<td class="td-money">' + fMoney(impExentas * sign) + '</td>' +
                '<td class="td-money">' + fMoney((r.intGravadas||0) * sign) + '</td>' +
                '<td class="td-money">' + fMoney(impGravadas * sign) + '</td>' +
                '<td class="td-money td-total">' + fMoney((r.credito||0) * sign) + '</td>' +
                '<td class="td-money">' + fMoney(ivaPercibido * sign) + '</td>' +
                '<td class="td-money" style="font-weight:700;">' + fMoney(totalConPercibido * sign) + '</td>' +
                '<td class="td-money">' + fMoney(0) + '</td>';
            tbody.appendChild(tr);
        });

        if (sorted.length === 0) {
            var trVacioCompras = document.createElement('tr');
            trVacioCompras.innerHTML = '<td colspan="14" style="text-align:center;font-weight:700;padding:14px 0;">SIN MOVIMIENTO</td>';
            tbody.appendChild(trVacioCompras);
        } else {
            // CORRECCIÓN: reconstruir el total de Crédito Fiscal en dólares a partir del
            // acumulador exacto en centavos.
            totCredito = totCreditoCentavos / 100;
            var tfr = document.createElement('tr');
            tfr.innerHTML =
                '<td colspan="6" style="text-align:right;font-weight:700;">TOTALES</td>' +
                '<td style="text-align:right;">' + fMoney(totIntExentas) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totImpExentas) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totIntGravadas) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totImpGravadas) + '</td>' +
                '<td style="text-align:right;color:var(--rp-accent);">' + fMoney(totCredito) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totIvaPercibido) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totTotal) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totExcluidos) + '</td>';
            tfoot.appendChild(tfr);
        }
    }

    function renderLLCf() {
        var tbody = document.getElementById('llCfBody');
        var tfoot = document.getElementById('llCfFoot');
        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        var totNosuj=0, totExentas=0, totGravadas=0, totExp=0, totTotal=0;

        var sorted = cfRecords.slice().sort(function(a,b) { return (a.fecha||'').localeCompare(b.fecha||''); });

        sorted.forEach(function(r, i) {
            var isNC = esNotaCredito(r.tipoDoc);
            var sign = isNC ? -1 : 1;
            var exp = (r.expCa||0) + (r.expFuera||0) + (r.expServ||0);

            // Detectar si este registro está anulado (usando _id único)
            // Bug fix (Libros Impresos): "i" es el índice del arreglo ordenado por
            // fecha; se usa el índice real dentro de cfRecords vía indexOf(r) para
            // evitar marcar como anulado un documento distinto al anulado realmente.
            var anulado = isRegistroAnulado('cf', cfRecords.indexOf(r));

            // Solo sumar si NO está anulado
            if (!anulado) {
                totNosuj   += (r.nosujetas||0) * sign;
                totExentas += (r.exentas||0)   * sign;
                totGravadas+= (r.gravadas||0)  * sign;
                totExp     += exp               * sign;
                totTotal   += (r.total||0)      * sign;
            }

            var ncLabel    = isNC    ? ' <span style="color:var(--rp-error);font-weight:700;font-size:9px;">(NC)</span>' : '';
            var anuLabel   = anulado ? ' <span style="color:var(--rp-warning);font-weight:700;font-size:9px;">[ANULADO]</span>' : '';
            var rowStyle   = anulado ? 'opacity:0.45;text-decoration:line-through;' : '';

            var tr = document.createElement('tr');
            tr.style.cssText = rowStyle;
            tr.innerHTML =
                '<td>' + (i+1) + '</td>' +
                '<td>' + formatFecha(r.fecha) + ncLabel + anuLabel + '</td>' +
                '<td style="font-family:monospace;">' + (r.docDel||'—') + '</td>' +
                '<td style="font-family:monospace;">' + (r.docAl||'—') + '</td>' +
                '<td>' + (r.maquina||'—') + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : (r.nosujetas||0) * sign) + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : (r.exentas||0)   * sign) + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : (r.gravadas||0)  * sign) + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : exp               * sign) + '</td>' +
                '<td class="td-money" style="font-weight:700;">' + fMoney(anulado ? 0 : (r.total||0) * sign) + '</td>';
            tbody.appendChild(tr);
        });

        if (sorted.length === 0) {
            var trVacioCf = document.createElement('tr');
            trVacioCf.innerHTML = '<td colspan="10" style="text-align:center;font-weight:700;padding:14px 0;">SIN MOVIMIENTO</td>';
            tbody.appendChild(trVacioCf);
        } else {
            var tfr = document.createElement('tr');
            tfr.innerHTML =
                '<td colspan="5" style="text-align:right;font-weight:700;">TOTALES</td>' +
                '<td style="text-align:right;">' + fMoney(totNosuj)   + '</td>' +
                '<td style="text-align:right;">' + fMoney(totExentas) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totGravadas)+ '</td>' +
                '<td style="text-align:right;">' + fMoney(totExp)     + '</td>' +
                '<td style="text-align:right;">' + fMoney(totTotal)   + '</td>';
            tfoot.appendChild(tfr);
        }
        var cfTotals = calcularTotalesCf();
        _llTotalesCf = { gravadas: cfTotals.gravadas, iva: cfTotals.iva, total: cfTotals.total };
        var ivaCalculado = cfTotals.iva;
        var elG = document.getElementById('llCfResGravadas');
        var elI = document.getElementById('llCfResIva');
        var elT = document.getElementById('llCfResTotal');
        if (elG) elG.innerText = fMoney(totGravadas);
        if (elI) elI.innerText = fMoney(ivaCalculado);
        if (elT) elT.innerText = fMoney(totTotal);
    }

    function renderLLCcf() {
        var tbody = document.getElementById('llCcfBody');
        var tfoot = document.getElementById('llCcfFoot');
        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        var totNosuj=0, totExentas=0, totGravadas=0, totIva=0, totTotal=0;

        var sorted = debitoRecords.slice().sort(function(a,b) { return (a.fecha||'').localeCompare(b.fecha||''); });

        sorted.forEach(function(r, i) {
            var isNC = esNotaCredito(r.tipoDoc);
            var sign = isNC ? -1 : 1;

            // Detectar si este registro está anulado (usando _id único)
            // Bug fix (Libros Impresos): "i" es el índice del arreglo ordenado por
            // fecha; se usa el índice real dentro de debitoRecords vía indexOf(r)
            // para evitar marcar como anulado un documento distinto al anulado realmente.
            var anulado = isRegistroAnulado('debito', debitoRecords.indexOf(r));

            // Solo sumar si NO está anulado
            if (!anulado) {
                totNosuj   += (r.nosujetas||0) * sign;
                totExentas += (r.exentas||0)   * sign;
                totGravadas+= (r.gravadas||0)  * sign;
                totIva     += (r.iva||0)        * sign;
                totTotal   += (r.total||0)      * sign;
            }

            var ncLabel  = isNC    ? ' <span style="color:var(--rp-error);font-weight:700;font-size:9px;">(NC)</span>'    : '';
            var anuLabel = anulado ? ' <span style="color:var(--rp-warning);font-weight:700;font-size:9px;">[ANULADO]</span>' : '';
            var rowStyle = anulado ? 'opacity:0.45;text-decoration:line-through;' : '';

            var tr = document.createElement('tr');
            tr.style.cssText = rowStyle;
            tr.innerHTML =
                '<td>' + (i+1) + '</td>' +
                '<td>' + formatFecha(r.fecha) + '</td>' +
                '<td>' + extractNum(r.tipoDoc) + ncLabel + anuLabel + '</td>' +
                '<td style="font-family:monospace;">' + (r.numDoc||'—') + '</td>' +
                '<td>' + (r.nombre||'—') + '</td>' +
                '<td>' + (r.nrc||r.nit||'—') + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : (r.nosujetas||0) * sign) + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : (r.exentas||0)   * sign) + '</td>' +
                '<td class="td-money">' + fMoney(anulado ? 0 : (r.gravadas||0)  * sign) + '</td>' +
                '<td class="td-money td-total">' + fMoney(anulado ? 0 : (r.iva||0) * sign) + '</td>' +
                '<td class="td-money" style="font-weight:700;">' + fMoney(anulado ? 0 : (r.total||0) * sign) + '</td>';
            tbody.appendChild(tr);
        });

        if (sorted.length === 0) {
            var trVacioCcf = document.createElement('tr');
            trVacioCcf.innerHTML = '<td colspan="11" style="text-align:center;font-weight:700;padding:14px 0;">SIN MOVIMIENTO</td>';
            tbody.appendChild(trVacioCcf);
        } else {
            var tfr = document.createElement('tr');
            tfr.innerHTML =
                '<td colspan="6" style="text-align:right;font-weight:700;">TOTALES</td>' +
                '<td style="text-align:right;">' + fMoney(totNosuj)   + '</td>' +
                '<td style="text-align:right;">' + fMoney(totExentas) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totGravadas)+ '</td>' +
                '<td style="text-align:right;color:var(--rp-accent);">' + fMoney(totIva) + '</td>' +
                '<td style="text-align:right;">' + fMoney(totTotal)   + '</td>';
            tfoot.appendChild(tfr);
        }
        var ccfTotals = calcularTotalesCcf();
        _llTotalesCcf = { gravadas: ccfTotals.gravadas, iva: ccfTotals.iva, total: ccfTotals.total };
        var elG2 = document.getElementById('llCcfResGravadas');
        var elI2 = document.getElementById('llCcfResIva');
        var elT2 = document.getElementById('llCcfResTotal');
        if (elG2) elG2.innerText = fMoney(totGravadas);
        if (elI2) elI2.innerText = fMoney(totIva);
        if (elT2) elT2.innerText = fMoney(totTotal);
    }

    function toggleFirmaResumen() {
        var hidden = document.getElementById('firma_incluir_resumen');
        var btn    = document.getElementById('firma_resumen_toggle_btn');
        var knob   = document.getElementById('firma_resumen_toggle_knob');
        var wrap   = document.getElementById('firma_resumen_libro_wrap');
        var active = hidden.value === '1';
        if (active) {
            hidden.value = '0';
            btn.style.background  = 'var(--rp-border-strong)';
            knob.style.left       = '3px';
            if (wrap) wrap.style.opacity = '0.35';
        } else {
            hidden.value = '1';
            btn.style.background  = 'var(--rp-accent)';
            knob.style.left       = '17px';
            if (wrap) wrap.style.opacity = '1';
        }
    }

    function selectFirmaLibro(libro) {
        if (libro !== 'ccf' && libro !== 'cf') {
            libro = 'ccf';
        }
        document.getElementById('firma_resumen_libro').value = libro;
        var active   = { border: '1px solid var(--rp-accent)', background: 'rgba(59,130,246,0.12)', color: 'var(--rp-accent)' };
        var inactive = { border: '1px solid var(--rp-border-strong)', background: 'transparent', color: 'var(--rp-text-secondary)' };
        ['ccf','cf'].forEach(function(l) {
            var el = document.getElementById('firmaLibroBtn_' + l);
            if (!el) return;
            var s = l === libro ? active : inactive;
            el.style.border     = s.border;
            el.style.background = s.background;
            el.style.color      = s.color;
        });
    }

    function shouldIncludeResumen(tipo) {
        var resumenLibroSel = document.getElementById('firma_resumen_libro') ? document.getElementById('firma_resumen_libro').value : 'ccf';
        if (resumenLibroSel !== 'ccf' && resumenLibroSel !== 'cf') {
            resumenLibroSel = 'ccf';
        }
        var resumenActivo = document.getElementById('firma_incluir_resumen') ? document.getElementById('firma_incluir_resumen').value === '1' : false;
        return (tipo === 'ccf' || tipo === 'cf') && tipo === resumenLibroSel && resumenActivo;
    }

    function buildResumenHtml(tipo) {
        var resumenHtml = '';
        if (!shouldIncludeResumen(tipo)) return resumenHtml;

        var cfTotals = calcularTotalesCf();
        var ccfTotals = calcularTotalesCcf();
        _llTotalesCf = { gravadas: cfTotals.gravadas, iva: cfTotals.iva, total: cfTotals.total };
        _llTotalesCcf = { gravadas: ccfTotals.gravadas, iva: ccfTotals.iva, total: ccfTotals.total };
        var cfExentas  = cfTotals.exentas;
        var ccfExentas = ccfTotals.exentas;
        var cfGravadaBase = cfTotals.gravadas * 100 / 113;
        var cfIva         = cfTotals.iva;
        var cfTotalResumen = cfExentas + cfGravadaBase + cfIva;
        var totGenGravadas = cfGravadaBase + (ccfTotals.gravadas || 0);
        var totGenExentas  = cfExentas + ccfExentas;
        var totGenIva      = cfIva + (ccfTotals.iva || 0);
        var totGenTotal    = cfTotalResumen + (ccfTotals.total || 0);
        var thStyle  = 'border:1px solid #bbb;padding:3px 6px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:#f0f0f0;text-align:right;white-space:nowrap;';
        var thLStyle = 'border:1px solid #bbb;padding:3px 6px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:#f0f0f0;text-align:left;';
        var tdStyle  = 'border:1px solid #ddd;padding:3px 6px;font-size:7.5px;text-align:right;font-family:monospace;color:#222;';
        var tdLStyle = 'border:1px solid #ddd;padding:3px 6px;font-size:7.5px;color:#333;white-space:nowrap;';
        var tdTot    = 'border:1px solid #bbb;padding:3px 6px;font-size:7.5px;text-align:right;font-family:monospace;font-weight:700;color:#000;background:#f5f5f5;';
        var tdTotL   = 'border:1px solid #bbb;padding:3px 6px;font-size:7.5px;font-weight:700;color:#000;background:#f5f5f5;white-space:nowrap;';
        resumenHtml =
            '<div style="border:1px solid #aaa;border-radius:4px;padding:7px 9px;min-width:320px;max-width:360px;">' +
            '<p style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#000;margin-bottom:5px;border-bottom:1.5px solid #999;padding-bottom:3px;">Resumen del Período</p>' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr>' +
            '<th style="' + thLStyle + '">Nombre</th>' +
            '<th style="' + thStyle + '">V. Exenta</th>' +
            '<th style="' + thStyle + '">V. Gravada</th>' +
            '<th style="' + thStyle + '">IVA</th>' +
            '<th style="' + thStyle + '">Total</th>' +
            '</tr></thead><tbody>' +
            '<tr>' +
            '<td style="' + tdLStyle + '">Venta Consumidor Final</td>' +
            '<td style="' + tdStyle + '">' + fMoney(cfExentas) + '</td>' +
            '<td style="' + tdStyle + '">' + fMoney(cfGravadaBase) + '</td>' +
            '<td style="' + tdStyle + '">' + fMoney(cfIva) + '</td>' +
            '<td style="' + tdStyle + '">' + fMoney(cfTotalResumen) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td style="' + tdLStyle + '">Ventas Crédito Fiscal</td>' +
            '<td style="' + tdStyle + '">' + fMoney(ccfExentas) + '</td>' +
            '<td style="' + tdStyle + '">' + fMoney(ccfTotals.gravadas || 0) + '</td>' +
            '<td style="' + tdStyle + '">' + fMoney(ccfTotals.iva || 0) + '</td>' +
            '<td style="' + tdStyle + '">' + fMoney(ccfTotals.total || 0) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td style="' + tdTotL + '">Total General</td>' +
            '<td style="' + tdTot + '">' + fMoney(totGenExentas) + '</td>' +
            '<td style="' + tdTot + '">' + fMoney(totGenGravadas) + '</td>' +
            '<td style="' + tdTot + '">' + fMoney(totGenIva) + '</td>' +
            '<td style="' + tdTot + '">' + fMoney(totGenTotal) + '</td>' +
            '</tr>' +
            '</tbody></table>' +
            '</div>';
        return resumenHtml;
    }

    // ══════════════════════════════════════════════════════════════════
    // FIRMA + CUADRO RESUMEN COMO ÚLTIMA FILA DEL TFOOT
    // Se inserta como una fila más de la tabla (en lugar de un <div>
    // suelto después de ella) para heredar la paginación nativa del
    // navegador: si hay espacio libre al final de la página actual, la
    // fila se queda ahí sin duplicar el encabezado; si no cabe, la fila
    // completa salta a la siguiente página y el encabezado del libro
    // (que vive en el <thead>) se repite automáticamente arriba, porque
    // sigue siendo la misma tabla continuando.
    // ══════════════════════════════════════════════════════════════════
    var LL_TFOOT_IDS  = { compras: 'llComprasFoot',  cf: 'llCfFoot',  ccf: 'llCcfFoot' };
    var LL_TABLE_IDS  = { compras: 'llComprasTable', cf: 'llCfTable', ccf: 'llCcfTable' };
    var LL_COLSPANS   = { compras: 12,               cf: 10,          ccf: 11 };

    function clearFirmaRows() {
        Object.keys(LL_TFOOT_IDS).forEach(function(k) {
            var tfoot = document.getElementById(LL_TFOOT_IDS[k]);
            if (!tfoot) return;
            var fila = tfoot.querySelector('tr.ll-firma-row');
            if (fila) fila.parentNode.removeChild(fila);
        });
    }

    function appendFirmaRow(tipo, innerHtml) {
        var tfoot = document.getElementById(LL_TFOOT_IDS[tipo]);
        if (!tfoot) return null;
        var tr = document.createElement('tr');
        tr.className = 'll-firma-row';
        var td = document.createElement('td');
        td.colSpan = LL_COLSPANS[tipo] || 1;
        td.innerHTML = innerHtml;
        tr.appendChild(td);
        tfoot.appendChild(tr);
        return tr;
    }

    function buildFirmaContentHtml(nombreFirmante, cargoFirmante, resumenHtml, textColor, subColor, subColor2) {
        return '<div style="margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end;">' +
            '<div style="width:280px;">' +
            '<div style="margin-bottom:6px;padding-bottom:0;height:30px;"></div>' +
            '<p style="font-size:12px;font-weight:600;color:' + textColor + ';">F. ___________________</p>' +
            '<p style="font-size:12px;color:' + subColor + ';margin-top:4px;">' + nombreFirmante + '</p>' +
            (cargoFirmante ? '<p style="font-size:10px;color:' + subColor2 + ';margin-top:2px;">' + cargoFirmante + '</p>' : '') +
            '</div>' +
            resumenHtml +
            '</div>';
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO (Corrección 03): anchos de columna y CSS de impresión
    // COMPARTIDOS entre la generación real del PDF/impresión y la Vista
    // Previa del editor de Admin, para que ambas sean visualmente idénticas.
    // ══════════════════════════════════════════════════════════════════
    var LL_COL_WIDTHS_PCT = {
        compras: [3,6,4,14,6,13,6,6,6,6,6,6,6,6],
        cf:      [3,7,16,16,10,12,12,12,12,12],
        ccf:     [3,6,4,16,17,7,8,8,8,8,8]
    };

    // ══════════════════════════════════════════════════════════════════
    // EXPORTAR LIBRO LEGAL EN PDF (Propuesta A — window.print())
    // Usa exactamente el mismo flujo HTML que la impresión normal.
    // El PDF generado es idéntico píxel a píxel al impreso porque
    // ambos usan el mismo motor de renderizado del navegador/OS.
    // ══════════════════════════════════════════════════════════════════
    // ── Configuración compartida entre Imprimir y Descargar PDF ──────────
    // Unifica el comportamiento de ambas rutas: siempre muestran la misma
    // ventana de configuración (firma + Cuadro Resumen) antes de generar
    // el documento, sin atajos que se salten las opciones. mode: 'print' | 'pdf'
    function abrirModalConfigLibro(tipo, mode) {
        currentPrintType = tipo;
        _firmaModalMode = mode;

        var firmaGuardada = getFirmaConfig();
        document.getElementById('firma_nombre').value = firmaGuardada ? firmaGuardada.nombre : '';
        document.getElementById('firma_cargo').value  = firmaGuardada ? (firmaGuardada.cargo || '') : '';

        // Mostrar toggle de resumen en CF y CCF — igual para impresión y para PDF
        var toggleWrap = document.getElementById('firmaResumenToggleWrap');
        if (toggleWrap) {
            toggleWrap.style.display = (tipo === 'ccf' || tipo === 'cf') ? 'block' : 'none';
            // Resetear toggle a "activado" y preseleccionar libro actual
            var hiddenVal = document.getElementById('firma_incluir_resumen');
            var btn       = document.getElementById('firma_resumen_toggle_btn');
            var knob      = document.getElementById('firma_resumen_toggle_knob');
            var wrap2     = document.getElementById('firma_resumen_libro_wrap');
            if (hiddenVal) hiddenVal.value = '1';
            if (btn)  { btn.style.background = '#3b82f6'; }
            if (knob) { knob.style.left = '17px'; }
            if (wrap2){ wrap2.style.opacity = '1'; }
            selectFirmaLibro(tipo === 'cf' ? 'cf' : 'ccf');
        }

        if (mode === 'pdf') {
            document.getElementById('firmaModalTitle').innerText = '¿Quién firma el Libro?';
            document.getElementById('firmaModalSubtitle').innerText = 'Configuración de Descarga PDF';
            document.getElementById('firmaModalSubmitBtn').innerHTML = '<i data-lucide="download" class="w-3.5 h-3.5"></i> Descargar PDF';
        } else {
            document.getElementById('firmaModalTitle').innerText = '¿Quién firma los Libros?';
            document.getElementById('firmaModalSubtitle').innerText = 'Configuración de Impresión';
            document.getElementById('firmaModalSubmitBtn').innerHTML = '<i data-lucide="printer" class="w-3.5 h-3.5"></i> Imprimir';
        }
        document.getElementById('firmaModalForm').style.display='flex'; document.getElementById('firmaModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function descargarPDF(tipo) {
        abrirModalConfigLibro(tipo, 'pdf');
    }

    function construirSnapshotLibroLegal(tipo, nombreFirmante, cargoFirmante) {
        // ================================================================
        // Implementación 03 — SNAPSHOT ÚNICO COMPARTIDO
        //
        // Esta función es la única fuente del HTML/datos/estilos/configuración
        // de un Libro Legal. Tanto "Imprimir Libro" como "Descargar PDF" la
        // invocan igual y reciben exactamente el mismo resultado; la única
        // diferencia entre ambas acciones es su destino final (impresión vs.
        // archivo .pdf), nunca el contenido ni el proceso de construcción.
        // ================================================================
        var emp = empresas.find(function(e) { return e.id === activeEmpresaId; });
        var titulos = {
            'compras': 'LIBRO DE COMPRAS',
            'cf':      'LIBRO DE VENTAS A CONSUMIDOR FINAL',
            'ccf':     'LIBRO DE VENTAS A CONTRIBUYENTES (CRÉDITO FISCAL)'
        };
        var titulo = titulos[tipo] || '';

        // El encabezado que ya existe dentro de la tabla es el que se
        // imprimirá/exportará. No se depende del DOM principal ni de
        // @media print globales para la salida final.
        var hdrMap = { compras: 'llCompras', cf: 'llCf', ccf: 'llCcf' };
        var hdrPfx = hdrMap[tipo] || '';
        if (hdrPfx) {
            var hdrTitulo  = document.getElementById(hdrPfx + 'HeaderTitle');
            var hdrEmpresa = document.getElementById(hdrPfx + 'HeaderEmpresa');
            var hdrDatos   = document.getElementById(hdrPfx + 'HeaderDatos');
            if (hdrTitulo)  hdrTitulo.innerText  = titulo;
            if (hdrEmpresa) hdrEmpresa.innerText = emp ? emp.razon : '';
            if (hdrDatos) {
                hdrDatos.innerText =
                    (emp ? 'NRC: ' + (emp.nrc || '—') + '   NIT: ' + (emp.nit || '—') : '') +
                    '   Período: ' + MONTH_NAMES[currentMonth] + ' ' + currentYear;
            }
        }

        // ── Bloque de firma ──
        // Se coloca como última fila del <tfoot> de la tabla (ver LL_TFOOT_IDS /
        // appendFirmaRow) en lugar de un <div> suelto después de la tabla, para
        // que herede la paginación nativa: si cabe en el espacio restante de la
        // página actual, no duplica el encabezado; si no cabe, salta de página
        // completa junto con el encabezado del libro. Esta es la misma tabla
        // que usan tanto "Imprimir Libro" como "Descargar PDF".
        ['llComprasFirma','llCfFirma','llCcfFirma'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.innerHTML = '';
            }
        });
        clearFirmaRows();

        var incluirResumen = shouldIncludeResumen(tipo);
        var resumenHtml = incluirResumen ? buildResumenHtml(tipo) : '';
        var firmaHtml = buildFirmaContentHtml(
            nombreFirmante,
            cargoFirmante,
            resumenHtml,
            '#000',
            '#333',
            '#555'
        );
        appendFirmaRow(tipo, firmaHtml);
        setPrintOrientation(tipo);

        var tableEl = document.getElementById(LL_TABLE_IDS[tipo]);
        if (!tableEl) {
            clearFirmaRows();
            showToast('No se encontró la tabla del Libro Legal seleccionado.', 'error');
            return null;
        }

        var pcfg = getPrintConfigFor(tipo);
        var colWidths = pceColWidthsCss(tipo);
        var orientacion = getLlOrientacion(tipo);

        // MISMO CSS base para "Imprimir Libro" y "Descargar PDF".
        // Esto evita depender de las reglas @media print de la aplicación
        // principal, incluyendo .modal-overlay, #workspaceContainer, etc.
        var htmlSnapshot =
            '<!DOCTYPE html>' +
            '<html lang="es">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<style>' +
            pceLibroPrintCss(pcfg, orientacion, colWidths) +
            '</style>' +
            '</head>' +
            '<body>' +
            tableEl.outerHTML +
            '</body>' +
            '</html>';

        return { htmlSnapshot: htmlSnapshot, tableEl: tableEl, emp: emp, titulo: titulo };
    }

    function generarPDFLibro(tipo, nombreFirmante, cargoFirmante) {
        // "Descargar PDF" reutiliza el mismo snapshot (HTML + datos + estilos +
        // configuración) que "Imprimir Libro". La única diferencia entre ambas
        // rutas es el destino final: aquí se guarda un archivo .pdf en vez de
        // enviarse a impresión.
        var snapshot = construirSnapshotLibroLegal(tipo, nombreFirmante, cargoFirmante);
        if (!snapshot) return;

        var emp = snapshot.emp;

        function _cleanup() {
            clearFirmaRows();
        }

        // ── Si estamos en Electron: PDF silencioso vía printToPDF ──
        if (window.fiscalAPI && window.fiscalAPI.saveLibroPdf) {
            setTimeout(function() {
                // Construir nombre del archivo: Libro_Empresa_Mes_Año.pdf
                var _tituloCorto = { compras: 'LibroCompras', cf: 'LibroCF', ccf: 'LibroCCF' }[tipo] || tipo;
                var _empNombre   = emp ? emp.razon.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').trim().replace(/\s+/g, '_') : 'Empresa';
                var _mesAnio     = MONTH_NAMES[currentMonth].replace(/\s+/g, '') + '_' + currentYear;
                var _fileName    = _tituloCorto + '_' + _empNombre + '_' + _mesAnio + '.pdf';
                var _mesLabelPdf = MONTH_NAMES[currentMonth] + ' ' + currentYear;
                var _empRazonPdf = emp ? emp.razon : 'Sin_Empresa';

                window.fiscalAPI.saveLibroPdf(snapshot.htmlSnapshot, _fileName, _mesLabelPdf, _empRazonPdf).then(function(res) {
                    _cleanup();
                    if (res && res.ok) {
                        showToast('PDF guardado en: ' + res.path, 'success');
                    } else if (res && res.canceled) {
                        // El usuario canceló el diálogo — no mostrar error
                    } else {
                        showToast('Error al guardar PDF: ' + (res && res.error ? res.error : 'desconocido'), 'error');
                    }
                }).catch(function(err) {
                    _cleanup();
                    showToast('Error al guardar PDF', 'error');
                });
            }, 200);

        } else {
            // ── Navegador: mantener window.print() sobre el DOM visible como fallback ──
            document.getElementById('llPrintTitle').innerText = snapshot.titulo;
            document.getElementById('llPrintEmpresa').innerText = emp ? emp.razon : '';
            document.getElementById('llPrintNit').innerText = emp ? 'NRC: ' + (emp.nrc || '—') : '';
            document.getElementById('llPrintNrc').innerText = emp ? 'NIT: ' + (emp.nit || '—') : '';
            document.getElementById('llPrintPeriodo').innerText = 'Período: ' + MONTH_NAMES[currentMonth] + ' ' + currentYear;
            document.getElementById('llPrintHeader').style.display = 'block';

            var mainEl = document.querySelector('main');
            var origMainStyle = mainEl.getAttribute('style') || '';
            mainEl.style.overflow = 'visible';
            mainEl.style.height = 'auto';
            mainEl.style.maxHeight = 'none';

            setTimeout(function() {
                window.print();
                setTimeout(function() {
                    document.getElementById('llPrintHeader').style.display = 'none';
                    _cleanup();
                    if (origMainStyle) {
                        mainEl.setAttribute('style', origMainStyle);
                    } else {
                        mainEl.removeAttribute('style');
                    }
                }, 500);
            }, 200);
        }
    }

        function prepararImpresion(tipo) {
        abrirModalConfigLibro(tipo, 'print');
    }

    function closeFirmaModal() {
        _cerrarModalAnimado('firmaModalForm');
    }

    function ejecutarImpresion() {
        var nombreFirmante = document.getElementById('firma_nombre').value.trim();
        var cargoFirmante  = document.getElementById('firma_cargo').value.trim();

        if (!nombreFirmante) {
            showToast('Ingresa el nombre del firmante', 'error');
            return;
        }

        saveFirmaConfig(nombreFirmante, cargoFirmante);
        closeFirmaModal();

        // "Descargar PDF" usa el mismo snapshot que "Imprimir Libro"
        // (ver construirSnapshotLibroLegal); solo cambia el destino final.
        if (_firmaModalMode === 'pdf') {
            generarPDFLibro(currentPrintType, nombreFirmante, cargoFirmante);
            _firmaModalMode = 'print';
            return;
        }

        var tipo = currentPrintType;

        // ================================================================
        // CORRECCIÓN 02 / Implementación 03 — IMPRESIÓN REAL DEL LIBRO LEGAL
        //
        // Ya NO se utiliza window.print() sobre la ventana principal.
        // Se construye el snapshot HTML mediante construirSnapshotLibroLegal()
        // — la misma función que usa "Descargar PDF" — y se envía al proceso
        // principal. main.js crea una BrowserWindow de impresión independiente
        // y ejecuta webContents.print() sobre ese documento aislado.
        // ================================================================
        var snapshot = construirSnapshotLibroLegal(tipo, nombreFirmante, cargoFirmante);
        if (!snapshot) return;

        // La limpieza ocurre únicamente cuando el proceso de impresión
        // independiente termina (imprimió o canceló). No se usa ningún
        // timeout fijo para decidir cuándo limpiar el contenido.
        var limpiar = function() {
            clearFirmaRows();
        };

        if (window.fiscalAPI && window.fiscalAPI.printLibroHtml) {
            window.fiscalAPI.printLibroHtml(snapshot.htmlSnapshot, tipo).then(function(res) {
                limpiar();

                if (res && res.ok) {
                    showToast('Libro enviado a impresión correctamente.', 'success');
                } else if (res && res.canceled) {
                    // Cancelación normal: no mostrar error.
                } else {
                    showToast(
                        'Error al imprimir el Libro Legal: ' +
                        (res && res.error ? res.error : 'desconocido'),
                        'error'
                    );
                }
            }).catch(function(err) {
                limpiar();
                console.error('[Libros Legales] Error en impresión independiente:', err);
                showToast('Error al imprimir el Libro Legal.', 'error');
            });
            return;
        }

        // Fallback únicamente para navegador sin Electron. En Electron,
        // el flujo anterior siempre debe estar disponible.
        limpiar();
        window.print();
    }