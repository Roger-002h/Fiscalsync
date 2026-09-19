// documentos-faltantes/DocumentosFaltantes.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════════════════════════
    // FALTA FÍSICO — Buscar e Imprimir PDFs (Electron)
    // ══════════════════════════════════════════════════════════════════
    var _ffLibroActivo    = '';
    var _ffCarpetaPath    = '';
    var _ffEncontrados    = [];  // [{fecha, codGen, gravado, pdfFile, _rowIdx}]
    var _ffTodosResultados = [];
    var _ffFaseActual     = 1;  // 1 = elegir carpeta, 2 = verificando, 3 = documentos encontrados

    // ── Navegación por fases (solo presentación — no toca la lógica de negocio) ──
    function _ffIrAFase(n) {
        _ffFaseActual = n;

        var p1 = document.getElementById('ffPaso1Wrap');
        var p2 = document.getElementById('ffPaso2Wrap');
        var p3 = document.getElementById('ffResultadosWrap');
        if (p1) p1.classList.toggle('hidden', n !== 1);
        if (p2) p2.classList.toggle('hidden', n !== 2);
        if (p3) p3.classList.toggle('hidden', n !== 3);

        [1, 2, 3].forEach(function(i) {
            var stepEl = document.getElementById('ffStepEl' + i);
            if (!stepEl) return;
            stepEl.classList.toggle('ff-step-active', i === n);
            stepEl.classList.toggle('ff-step-done', i < n);
        });

        // Progress wrap (usado al imprimir) solo aplica en fase 3; nunca lo forzamos
        // a mostrarse aquí, solo lo ocultamos si estamos saliendo de la fase 3.
        var progressWrap = document.getElementById('ffProgressWrap');
        if (progressWrap && n !== 3) progressWrap.classList.add('hidden');

        var footerAcciones = document.getElementById('ffFooterAcciones');
        if (footerAcciones) footerAcciones.style.display = (n === 3) ? 'flex' : 'none';
    }

    // Reinicia la pantalla de verificación (Fase 02) a su estado inicial (spinner visible)
    function _ffReiniciarFase2() {
        var spinner = document.getElementById('ffPaso2Verificando');
        var resumen = document.getElementById('ffPaso2Resumen');
        if (spinner) spinner.classList.remove('hidden');
        if (resumen) resumen.classList.add('hidden');
    }

    // Muestra el resumen de la Fase 02 una vez terminada la verificación/cruce de documentos
    function _ffMostrarResumenFase2(encontrados, noEncontrados, total) {
        var spinner = document.getElementById('ffPaso2Verificando');
        var resumen = document.getElementById('ffPaso2Resumen');
        if (spinner) spinner.classList.add('hidden');
        if (resumen) resumen.classList.remove('hidden');
        var elEnc = document.getElementById('ffPaso2Encontrados');
        var elNoEnc = document.getElementById('ffPaso2NoEncontrados');
        var elTotal = document.getElementById('ffPaso2Total');
        if (elEnc) elEnc.textContent = encontrados;
        if (elNoEnc) elNoEnc.textContent = noEncontrados;
        if (elTotal) elTotal.textContent = total;
    }

    // Obtener lista de docs "falta" de un libro
    function _ffGetFaltaList(libro) {
        var states = loadRevStates(libro);
        var recordsMap = {
            debito: debitoRecords, cf: cfRecords, compras: comprasRecords,
            percibido: percibidoRecords, retenido: retenidoRecords,
            anticipo: anticipoRecords, excluido: excluidoRecords, f14: f14Records
        };
        var records = recordsMap[libro] || [];
        var list = [];
        records.forEach(function(r, i) {
            if (states[i] !== 'falta') return;
            var fecha  = r.fecha || '-';
            var codGen = _getCodGenUUID(r);
            var gravado = 0;
            if (libro === 'debito')    gravado = r.gravadas   || 0;
            if (libro === 'cf')        gravado = r.gravadas   || 0;
            if (libro === 'compras')   gravado = (r.intGravadas||0)+(r.internGrav||0)+(r.impGrav||0)+(r.impServ||0);
            if (libro === 'percibido') gravado = r.monto      || 0;
            if (libro === 'retenido')  gravado = r.monto      || 0;
            if (libro === 'anticipo')  gravado = r.monto      || 0;
            if (libro === 'excluido')  gravado = r.monto      || 0;
            if (libro === 'f14')       gravado = r.devengado  || 0;
            list.push({ fecha: fecha, codGen: codGen, gravado: gravado, _realIdx: i });
        });
        return list;
    }

    // Botón "Falta Físico" en cada módulo — siempre abre el modal
    function exportFaltaFisico(libro) {
        var faltaList = _ffGetFaltaList(libro);
        if (!faltaList.length) {
            showToast('No hay documentos con estado Falta Fisico', 'error');
            return;
        }
        _ffLibroActivo     = libro;
        _ffCarpetaPath     = '';
        _ffEncontrados     = [];
        _ffTodosResultados = [];
        openFaltaFisicoModal(libro, faltaList);
    }

    // Fallback CSV para non-Electron
    function _ffExportCSV(libro, faltaList) {
        var lineas = ['Fecha,Codigo Generacion,Monto Gravado'];
        faltaList.forEach(function(d) {
            lineas.push('"' + d.fecha + '","' + d.codGen + '",' + d.gravado.toFixed(2));
        });
        var csv  = '\uFEFF' + lineas.join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url;
        a.download = 'falta_fisico_' + libro + '_' + currentYear + '_' + String(currentMonth+1).padStart(2,'0') + '.csv';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        showToast('Exportado: ' + faltaList.length + ' documentos', 'success');
    }

    // Exportar falta físico a Excel (XML SpreadsheetML nativo — Excel lo abre sin
    // advertencias de "archivo dañado", a diferencia de una tabla HTML disfrazada de .xls)
    function ffExportarExcel() {
        var faltaList = _ffGetFaltaList(_ffLibroActivo);
        if (!faltaList.length) {
            showToast('No hay documentos con Falta Físico para exportar', 'error');
            return;
        }
        var librosLabel = {
            debito: 'Ventas Credito Fiscal', cf: 'Ventas Consumidor Final',
            compras: 'Compras', percibido: 'IVA Percibido', retenido: 'IVA Retenido',
            anticipo: 'Anticipo a Cuenta', excluido: 'Sujeto Excluido', f14: 'Retenciones F14'
        };
        var nombreLibro = librosLabel[_ffLibroActivo] || _ffLibroActivo;
        var periodo = MONTH_NAMES[currentMonth] + ' ' + currentYear;

        function _ffXmlEsc(v) {
            return String(v)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        // Construir libro en formato SpreadsheetML (XML nativo de Excel)
        var xml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<?mso-application progid="Excel.Sheet"?>' +
            '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
            'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
            'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
            'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
            '<Styles>' +
                '<Style ss:ID="Titulo"><Font ss:Bold="1" ss:Size="13" ss:Color="#FFFFFF"/><Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>' +
                '<Style ss:ID="Encabezado"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
                '<Style ss:ID="Celda"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDDDD"/></Borders></Style>' +
                '<Style ss:ID="Monto"><NumberFormat ss:Format="#,##0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDDDD"/></Borders></Style>' +
                '<Style ss:ID="Total"><Font ss:Bold="1"/><Alignment ss:Horizontal="Right"/></Style>' +
                '<Style ss:ID="TotalMonto"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0.00"/></Style>' +
            '</Styles>' +
            '<Worksheet ss:Name="Falta Fisico">' +
            '<Table>' +
                '<Column ss:Width="30"/><Column ss:Width="65"/><Column ss:Width="230"/><Column ss:Width="95"/>' +
                '<Row ss:Height="22"><Cell ss:StyleID="Titulo" ss:MergeAcross="3"><Data ss:Type="String">' +
                    _ffXmlEsc('Falta Físico — ' + nombreLibro + ' — ' + periodo) +
                '</Data></Cell></Row>' +
                '<Row>' +
                    '<Cell ss:StyleID="Encabezado"><Data ss:Type="String">#</Data></Cell>' +
                    '<Cell ss:StyleID="Encabezado"><Data ss:Type="String">Fecha</Data></Cell>' +
                    '<Cell ss:StyleID="Encabezado"><Data ss:Type="String">Código Generación</Data></Cell>' +
                    '<Cell ss:StyleID="Encabezado"><Data ss:Type="String">Monto Gravado</Data></Cell>' +
                '</Row>';

        faltaList.forEach(function(d, idx) {
            xml += '<Row>' +
                '<Cell ss:StyleID="Celda"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>' +
                '<Cell ss:StyleID="Celda"><Data ss:Type="String">' + _ffXmlEsc(d.fecha) + '</Data></Cell>' +
                '<Cell ss:StyleID="Celda"><Data ss:Type="String">' + _ffXmlEsc(d.codGen) + '</Data></Cell>' +
                '<Cell ss:StyleID="Monto"><Data ss:Type="Number">' + d.gravado.toFixed(2) + '</Data></Cell>' +
            '</Row>';
        });

        var totalGravado = faltaList.reduce(function(s, d) { return s + d.gravado; }, 0);
        xml += '<Row>' +
            '<Cell ss:StyleID="Total" ss:MergeAcross="2"><Data ss:Type="String">TOTAL</Data></Cell>' +
            '<Cell ss:StyleID="TotalMonto"><Data ss:Type="Number">' + totalGravado.toFixed(2) + '</Data></Cell>' +
        '</Row>';

        xml += '</Table></Worksheet></Workbook>';

        var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'Falta_Fisico_' + (_ffLibroActivo || 'libro') + '_' + currentYear + '_' + String(currentMonth+1).padStart(2,'0') + '.xls';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
        showToast('Excel exportado: ' + faltaList.length + ' documentos', 'success');
    }

    // Abrir modal
    function openFaltaFisicoModal(libro, faltaList) {
        var librosLabel = {
            debito: 'Ventas Credito Fiscal', cf: 'Ventas Consumidor Final',
            compras: 'Compras', percibido: 'IVA Percibido', retenido: 'IVA Retenido',
            anticipo: 'Anticipo a Cuenta', excluido: 'Sujeto Excluido', f14: 'Retenciones F14'
        };
        document.getElementById('ffLibroLabel').innerText    = librosLabel[libro] || libro;
        document.getElementById('ffTotalFalta').innerText    = faltaList.length;
        document.getElementById('ffCarpetaLabel').innerText  = 'Ninguna carpeta seleccionada';
        document.getElementById('ffResultadosWrap').classList.add('hidden');
        document.getElementById('ffProgressWrap').classList.add('hidden');
        document.getElementById('ffBtnImprimir').classList.add('hidden');
        document.getElementById('ffBtnImprimir').style.display = 'none';
        document.getElementById('ffResultadosBody').innerHTML = '';
        // Reiniciar navegación: siempre se entra por la Fase 01
        _ffReiniciarFase2();
        _ffIrAFase(1);
        // Mostrar botón Excel siempre que haya items falta
        var excelBtn = document.getElementById('ffBtnExportExcel');
        if (excelBtn) excelBtn.style.display = faltaList.length > 0 ? 'flex' : 'none';
        // Mostrar aviso si preload no está cargado — detección lazy con retry para Electron build
        var aviso = document.getElementById('ffAvisoPreload');
        var paso1 = document.getElementById('ffPaso1Wrap');
        function aplicarEstadoElectron() {
            var tieneElectron = (window.fiscalAPI && window.fiscalAPI.isElectron) ||
                                (window.electronAPI && window.electronAPI.isElectron);
            if (aviso && paso1) {
                aviso.style.display = tieneElectron ? 'none' : 'block';
                paso1.style.opacity = tieneElectron ? '1' : '0.4';
            }
        }
        aplicarEstadoElectron();
        // Retry a 300ms y 800ms — en Electron build el preload puede llegar tarde
        setTimeout(aplicarEstadoElectron, 300);
        setTimeout(aplicarEstadoElectron, 800);
        document.getElementById('faltaFisicoModal').style.display = 'flex';
        document.getElementById('faltaFisicoModal').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeFaltaFisicoModal() {
        _cerrarModalAnimado('faltaFisicoModal');
    }

    // Inicializar listeners de botones del modal Falta Físico (evita onclick inline + CSP)
    (function() {
        document.addEventListener('DOMContentLoaded', function() {
            var btnCerrar = document.getElementById('ffBtnCerrar');
            if (btnCerrar) btnCerrar.addEventListener('click', closeFaltaFisicoModal);

            var btnAbrir = document.getElementById('ffBtnImprimir');
            if (btnAbrir) btnAbrir.addEventListener('click', ffImprimirTodo);

            var btnDirecto = document.getElementById('ffBtnImprimirDirecto');
            if (btnDirecto) btnDirecto.addEventListener('click', ffImprimirDirecto);

            var btnExcel = document.getElementById('ffBtnExportExcel');
            if (btnExcel) btnExcel.addEventListener('click', ffExportarExcel);

            // Navegación entre fases (solo presentación)
            var btnRegresarFase1 = document.getElementById('ffBtnRegresarFase1');
            if (btnRegresarFase1) btnRegresarFase1.addEventListener('click', function() {
                _ffReiniciarFase2();
                _ffIrAFase(1);
            });

            var btnRegresarFase2 = document.getElementById('ffBtnRegresarFase2');
            if (btnRegresarFase2) btnRegresarFase2.addEventListener('click', function() {
                _ffIrAFase(2);
            });

            var btnContinuarFase3 = document.getElementById('ffBtnContinuarFase3');
            if (btnContinuarFase3) btnContinuarFase3.addEventListener('click', function() {
                _ffIrAFase(3);
            });
        });
    })();

    // Paso 1: Seleccionar carpeta y cruzar datos
    async function ffSeleccionarCarpeta() {
        var tieneElectron = (window.fiscalAPI && window.fiscalAPI.isElectron) ||
                            (window.electronAPI && window.electronAPI.isElectron);
        if (!tieneElectron) {
            showToast('Para usar esta funcion instala el preload.js y main.js actualizado', 'error');
            return;
        }
        var carpeta = await window.fiscalAPI.selectFolder();
        if (!carpeta) return;
        _ffCarpetaPath = carpeta;

        // Etiqueta de carpeta (mostrar solo el nombre final)
        var partes = carpeta.replace(/\\/g, '/').split('/');
        document.getElementById('ffCarpetaLabel').innerText = partes[partes.length - 1] + '  (' + carpeta + ')';

        // Carpeta seleccionada correctamente -> avanzar automáticamente a la Fase 02
        _ffReiniciarFase2();
        _ffIrAFase(2);

        // Leer todos los archivos de la carpeta
        var archivos = await window.fiscalAPI.readFolder(carpeta);
        if (archivos.error) {
            showToast('Error al leer carpeta: ' + archivos.error, 'error');
            _ffIrAFase(1);
            return;
        }

        // Construir SET de nombres de archivo disponibles (sin extensión, uppercase para comparar)
        // Ej: "A37B0199-EB4E-4282-9798-9175AD41D31D" → { pdf: true, json: true }
        var mapaArchivos = {};
        archivos.forEach(function(f) {
            var nameUpper = f.name.toUpperCase();
            if (!mapaArchivos[nameUpper]) mapaArchivos[nameUpper] = { json: false, pdf: false, realName: f.name };
            if (f.ext === '.json') mapaArchivos[nameUpper].json = true;
            if (f.ext === '.pdf')  mapaArchivos[nameUpper].pdf  = true;
        });

        // Obtener lista falta del libro activo
        var faltaList = _ffGetFaltaList(_ffLibroActivo);

        // Para cada doc falta, buscar directamente por codigo de generacion como nombre de archivo
        // El PDF y JSON siempre tienen el mismo nombre base = codigoGeneracion
        var resultados = [];
        for (var i = 0; i < faltaList.length; i++) {
            var doc = faltaList[i];
            var encontrado = false;
            var pdfFile    = null;

            var codNorm = (doc.codGen || '').trim().toUpperCase();

            if (codNorm && mapaArchivos[codNorm]) {
                var entrada = mapaArchivos[codNorm];
                if (entrada.pdf) {
                    // PDF encontrado directamente por codigo de generacion
                    pdfFile    = entrada.realName + '.pdf';
                    encontrado = true;
                } else if (entrada.json) {
                    // Tiene JSON pero no PDF — reportar como no encontrado
                    encontrado = false;
                    pdfFile    = null;
                }
            }

            // Si no encontró por nombre directo, intentar leyendo JSONs como fallback
            // (para documentos cuyo nombre de archivo no es el código de generación)
            if (!encontrado) {
                var jsonNames = Object.keys(mapaArchivos).filter(function(n) { return mapaArchivos[n].json; });
                for (var j = 0; j < jsonNames.length; j++) {
                    var baseName = jsonNames[j];
                    var realBase = mapaArchivos[baseName].realName;
                    var jsonData = await window.fiscalAPI.readJson(carpeta, realBase + '.json');
                    if (!jsonData || jsonData.error) continue;

                    // Extraer codigoGeneracion del JSON
                    var codJson = '';
                    if (jsonData.identificacion && jsonData.identificacion.codigoGeneracion)
                        codJson = jsonData.identificacion.codigoGeneracion;
                    else if (jsonData.codigoGeneracion)
                        codJson = jsonData.codigoGeneracion;

                    if (codJson && codJson.trim().toUpperCase() === codNorm) {
                        if (mapaArchivos[baseName] && mapaArchivos[baseName].pdf) {
                            pdfFile    = realBase + '.pdf';
                            encontrado = true;
                        }
                        break;
                    }
                }
            }

            resultados.push({
                fecha:      doc.fecha,
                codGen:     doc.codGen,
                gravado:    doc.gravado,
                encontrado: encontrado,
                pdfFile:    pdfFile,
                _rowIdx:    (doc._realIdx !== undefined ? doc._realIdx : i)
            });
        }

        _ffTodosResultados = resultados;
        _ffEncontrados = resultados.filter(function(r) { return r.encontrado; });

        // Mostrar resultados en tabla
        var encontrados   = resultados.filter(function(r) { return r.encontrado; }).length;
        var noEncontrados = resultados.filter(function(r) { return !r.encontrado; }).length;

        document.getElementById('ffStatBuscados').innerText     = resultados.length;
        document.getElementById('ffStatEncontrados').innerText  = encontrados;
        document.getElementById('ffStatNoEncontrados').innerText = noEncontrados;

        var tbody = document.getElementById('ffResultadosBody');
        tbody.innerHTML = '';
        resultados.forEach(function(r, idx) {
            var tr = document.createElement('tr');
            tr.className = 'border-b border-zinc-900/50';
            tr.id = 'ffRow_' + idx;

            var estadoTd = document.createElement('td');
            estadoTd.className = 'px-4 py-2.5 text-xs';
            estadoTd.innerHTML = r.encontrado
                ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:var(--rp-success);font-size:10px;font-weight:700;">&#10003; Encontrado</span>'
                : '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:var(--rp-error);font-size:10px;font-weight:700;">&#10007; No encontrado</span>';

            var fechaTd = document.createElement('td');
            fechaTd.className = 'px-4 py-2.5 text-xs text-zinc-400';
            fechaTd.textContent = r.fecha;

            var codTd = document.createElement('td');
            codTd.className = 'px-4 py-2.5 text-xs font-mono text-white';
            codTd.style.fontSize = '10px';
            codTd.textContent = r.codGen;

            var pdfTd = document.createElement('td');
            pdfTd.className = 'px-4 py-2.5 text-xs text-zinc-500';
            pdfTd.textContent = r.pdfFile || '—';

            var montoTd = document.createElement('td');
            montoTd.className = 'px-4 py-2.5 text-xs text-right';
            montoTd.textContent = fMoney(r.gravado);

            var accionTd = document.createElement('td');
            accionTd.className = 'px-4 py-2.5 text-xs text-center';
            accionTd.id = 'ffRowAccion_' + idx;

            if (r.encontrado) {
                var btnAbrir = document.createElement('button');
                btnAbrir.id = 'ffRowBtn_' + idx;
                btnAbrir.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 11px;font-size:10px;font-weight:600;color:var(--rp-text-secondary);border:1px solid var(--rp-border-strong);border-radius:8px;background:transparent;cursor:pointer;transition:all .15s;white-space:nowrap;';
                btnAbrir.textContent = '👁 Abrir';
                btnAbrir.addEventListener('mouseover', function(){ this.style.color='var(--rp-text-primary)'; this.style.borderColor='var(--rp-text-secondary)'; });
                btnAbrir.addEventListener('mouseout', function(){ this.style.color='var(--rp-text-secondary)'; this.style.borderColor='var(--rp-border-strong)'; });
                btnAbrir.addEventListener('click', (function(i){ return function(){ ffAbrirUno(i); }; })(idx));
                accionTd.appendChild(btnAbrir);
            } else {
                accionTd.innerHTML = '<span style="color:var(--rp-text-secondary);font-size:10px;">—</span>';
            }

            tr.appendChild(estadoTd);
            tr.appendChild(fechaTd);
            tr.appendChild(codTd);
            tr.appendChild(pdfTd);
            tr.appendChild(montoTd);
            tr.appendChild(accionTd);
            tbody.appendChild(tr);
        });

        // Verificación completa: mostrar resumen en Fase 02 y esperar confirmación
        // del usuario para pasar a la Fase 03 (la tabla ya quedó armada, solo se revela
        // cuando el usuario presiona "Continuar").
        _ffMostrarResumenFase2(encontrados, noEncontrados, resultados.length);

        // Mostrar botón imprimir si hay encontrados
        if (encontrados > 0) {
            document.getElementById('ffBtnCount').textContent = encontrados;
            document.getElementById('ffBtnCountDirecto').textContent = encontrados;
            document.getElementById('ffBtnImprimir').style.display = 'flex';
            document.getElementById('ffBtnImprimirDirecto').style.display = 'flex';
        } else {
            document.getElementById('ffBtnImprimir').style.display = 'none';
            document.getElementById('ffBtnImprimirDirecto').style.display = 'none';
        }
    }

    // Paso 2: Imprimir todos los PDFs encontrados en serie
    async function ffImprimirTodo() {
        if (!_ffEncontrados.length || !_ffCarpetaPath) return;

        var total = _ffEncontrados.length;
        document.getElementById('ffBtnImprimir').classList.add('hidden');
        document.getElementById('ffProgressWrap').classList.remove('hidden');

        for (var i = 0; i < total; i++) {
            var doc = _ffEncontrados[i];
            var globalIdx = doc._rowIdx;
            var pct = Math.round(((i) / total) * 100);
            document.getElementById('ffProgressBar').style.width   = pct + '%';
            document.getElementById('ffProgressLabel').innerText   = 'Abriendo ' + (i+1) + ' de ' + total + ': ' + doc.pdfFile;

            // Marcar fila como "abriendo"
            ffMarcarFila(globalIdx, 'abriendo');

            var result = await window.fiscalAPI.printPdf(_ffCarpetaPath, doc.pdfFile);
            if (result && result.error) {
                ffMarcarFila(globalIdx, 'error');
                showToast('Error: ' + doc.pdfFile + ': ' + result.error, 'error');
            } else {
                ffMarcarFila(globalIdx, 'abierto');
            }
        }

        document.getElementById('ffProgressBar').style.width  = '100%';
        document.getElementById('ffProgressLabel').innerText  = 'Completado — ' + total + ' archivos abiertos. Imprime desde cada visor de PDF.';
        showToast(total + ' PDFs abiertos en el visor del sistema', 'success');
    }

    // Abrir un PDF individual desde la fila
    async function ffAbrirUno(idx) {
        var doc = _ffTodosResultados[idx];
        if (!doc || !doc.pdfFile || !_ffCarpetaPath) return;
        ffMarcarFila(idx, 'abriendo');
        var result = await window.fiscalAPI.printPdf(_ffCarpetaPath, doc.pdfFile);
        if (result && result.error) {
            ffMarcarFila(idx, 'error');
            showToast('Error: ' + result.error, 'error');
        } else {
            ffMarcarFila(idx, 'abierto');
        }
    }

    // Actualizar visual de una fila según estado
    function ffMarcarFila(idx, estado) {
        var celda = document.getElementById('ffRowAccion_' + idx);
        var fila  = document.getElementById('ffRow_' + idx);
        if (!celda) return;
        celda.innerHTML = '';

        if (estado === 'abriendo') {
            var sp = document.createElement('span');
            sp.style.cssText = 'color:var(--rp-accent);font-size:10px;font-weight:600;';
            sp.textContent = '⏳ Abriendo…';
            celda.appendChild(sp);
            if (fila) fila.style.background = 'rgba(59,130,246,0.04)';

        } else if (estado === 'abierto') {
            var sp = document.createElement('span');
            sp.style.cssText = 'display:inline-flex;align-items:center;gap:5px;color:var(--rp-success);font-size:10px;font-weight:700;';
            sp.textContent = '✓ Abierto';
            var btnR = document.createElement('button');
            btnR.style.cssText = 'margin-left:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:9px;font-weight:600;color:var(--rp-text-secondary);border:1px solid var(--rp-border-strong);border-radius:7px;background:transparent;cursor:pointer;';
            btnR.title = 'Abrir de nuevo';
            btnR.textContent = '↺';
            btnR.addEventListener('click', (function(i){ return function(){ ffAbrirUno(i); }; })(idx));
            celda.appendChild(sp);
            celda.appendChild(btnR);
            if (fila) fila.style.background = 'rgba(34,197,94,0.04)';

        } else if (estado === 'error') {
            var sp = document.createElement('span');
            sp.style.cssText = 'color:var(--rp-error);font-size:10px;font-weight:700;';
            sp.textContent = '✗ Error';
            var btnR = document.createElement('button');
            btnR.style.cssText = 'margin-left:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:9px;font-weight:600;color:var(--rp-error);border:1px solid rgba(248,113,113,0.3);border-radius:7px;background:transparent;cursor:pointer;';
            btnR.title = 'Reintentar';
            btnR.textContent = '↺ Reintentar';
            btnR.addEventListener('click', (function(i){ return function(){ ffAbrirUno(i); }; })(idx));
            celda.appendChild(sp);
            celda.appendChild(btnR);
            if (fila) fila.style.background = 'rgba(248,113,113,0.04)';

        } else if (estado === 'imprimiendo') {
            var sp = document.createElement('span');
            sp.style.cssText = 'color:var(--rp-warning);font-size:10px;font-weight:600;';
            sp.textContent = '🖨 Imprimiendo…';
            celda.appendChild(sp);
            if (fila) fila.style.background = 'rgba(245,158,11,0.04)';

        } else if (estado === 'impreso') {
            var sp = document.createElement('span');
            sp.style.cssText = 'display:inline-flex;align-items:center;gap:5px;color:var(--rp-success);font-size:10px;font-weight:700;';
            sp.textContent = '🖨 Impreso';
            celda.appendChild(sp);
            if (fila) fila.style.background = 'rgba(34,197,94,0.06)';
            // Actualizar estado de revisión a 'impreso' solo al imprimir en serie exitosamente
            var docData = _ffTodosResultados[idx];
            if (docData && _ffLibroActivo) {
                setRevState(_ffLibroActivo, docData._rowIdx, 'impreso');
            }
        }
    }

    // ── Mini-modal de confirmación de impresora ──
    // Muestra un panel inline dentro de ffProgressWrap antes de iniciar la serie.
    // Resuelve: capturar la impresora elegida en el diálogo nativo del primer doc,
    // mostrarla al usuario y pedir confirmación antes de enviar el resto en silencio.
    var _ffPrinterConfirmResolve = null;

    function ffMostrarConfirmImpresora(printerName, total) {
        var wrap = document.getElementById('ffProgressWrap');
        wrap.classList.remove('hidden');
        var nombreMostrar = printerName || 'Impresora predeterminada del sistema';
        wrap.innerHTML =
            '<p class="section-label" style="margin-bottom:10px;">Confirmar impresión en serie</p>' +
            '<div style="background:var(--rp-inset);border:1px solid var(--rp-border-strong);border-radius:12px;padding:14px 16px;margin-bottom:12px;">' +
                '<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--rp-text-secondary);margin-bottom:6px;">Impresora seleccionada</p>' +
                '<p style="font-size:13px;font-weight:500;color:var(--rp-text-primary);font-family:monospace;">' + nombreMostrar + '</p>' +
            '</div>' +
            '<p style="font-size:11px;color:var(--rp-text-secondary);margin-bottom:14px;">Se enviarán <strong style="color:var(--rp-text-secondary);">' + total + ' documentos</strong> en silencio a esta impresora. El primer documento ya fue enviado.</p>' +
            '<div style="display:flex;gap:8px;">' +
                '<button id="ffConfirmImpBtn" style="padding:9px 20px;background:#fff;color:#000;font-size:11px;font-weight:700;border:none;border-radius:9px;cursor:pointer;font-family:\'Inter\',sans-serif;transition:background 0.2s;" onmouseover="this.style.background=\'var(--rp-text-primary)\'" onmouseout="this.style.background=\'#fff\'">Continuar con esta impresora</button>' +
                '<button id="ffCancelImpBtn" style="padding:9px 16px;background:transparent;color:var(--rp-text-secondary);font-size:11px;font-weight:500;border:1px solid var(--rp-border-strong);border-radius:9px;cursor:pointer;font-family:\'Inter\',sans-serif;transition:all 0.2s;" onmouseover="this.style.color=\'#fff\'" onmouseout="this.style.color=\'var(--rp-text-secondary)\'">Cancelar</button>' +
            '</div>';
        return new Promise(function(resolve) {
            _ffPrinterConfirmResolve = resolve;
            document.getElementById('ffConfirmImpBtn').onclick = function() { resolve(true); };
            document.getElementById('ffCancelImpBtn').onclick = function() { resolve(false); };
        });
    }

    function ffRestaurarProgressWrap() {
        var wrap = document.getElementById('ffProgressWrap');
        wrap.innerHTML =
            '<p class="section-label" style="margin-bottom:8px;">Imprimiendo PDFs…</p>' +
            '<div style="background:var(--rp-border);border-radius:999px;height:6px;overflow:hidden;">' +
                '<div id="ffProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--rp-accent),var(--rp-violet-soft));border-radius:999px;transition:width 0.3s;"></div>' +
            '</div>' +
            '<p id="ffProgressLabel" class="text-xs text-zinc-500 mt-2"></p>';
    }

    // Imprimir en serie directamente (sin abrir visor)
    async function ffImprimirDirecto() {
        if (!_ffCarpetaPath) return;
        // Filtrar solo los encontrados que aún tienen estado 'falta' en revisión
        var states = loadRevStates(_ffLibroActivo);
        var pendientesImprimir = _ffEncontrados.filter(function(doc) {
            return states[doc._rowIdx] === 'falta';
        });
        if (!pendientesImprimir.length) {
            showToast('No hay documentos con Falta Físico pendientes de imprimir', 'error');
            return;
        }
        var total = pendientesImprimir.length;
        document.getElementById('ffBtnImprimirDirecto').style.display = 'none';
        document.getElementById('ffBtnImprimir').style.display = 'none';

        // ── FASE 1: Abrir diálogo nativo para elegir impresora con el primer documento ──
        var primerDoc = pendientesImprimir[0];
        var primerIdx = _ffTodosResultados.indexOf(primerDoc);

        // Mostrar estado de espera en el progress wrap
        var wrap = document.getElementById('ffProgressWrap');
        wrap.classList.remove('hidden');
        wrap.innerHTML =
            '<p class="section-label" style="margin-bottom:8px;">Selección de impresora</p>' +
            '<p style="font-size:11px;color:var(--rp-text-secondary);">Abriendo diálogo de impresión — elige la impresora que deseas usar para todos los documentos…</p>';

        ffMarcarFila(primerIdx, 'imprimiendo');

        // Bug #5 fix: pasar grayscale:true al diálogo del primer documento para que
        // también salga en blanco y negro, igual que los documentos siguientes en serie
        var primerResult = await window.fiscalAPI.directPrintDialog(_ffCarpetaPath, primerDoc.pdfFile, { grayscale: true });

        if (!primerResult || primerResult.canceled) {
            ffMarcarFila(primerIdx, 'pendiente_impresion');
            document.getElementById('ffBtnImprimirDirecto').style.display = 'flex';
            document.getElementById('ffBtnImprimir').style.display = 'flex';
            wrap.classList.add('hidden');
            showToast('Impresión cancelada', 'error');
            return;
        }
        if (primerResult.error) {
            ffMarcarFila(primerIdx, 'error');
            showToast('Error: ' + primerDoc.pdfFile + ': ' + primerResult.error, 'error');
            document.getElementById('ffBtnImprimirDirecto').style.display = 'flex';
            document.getElementById('ffBtnImprimir').style.display = 'flex';
            wrap.classList.add('hidden');
            return;
        }

        // Primer doc impreso correctamente
        ffMarcarFila(primerIdx, 'impreso');
        var printerName = primerResult.printerName || null;

        // ── FASE 2: Mostrar confirmación con la impresora elegida ──
        // Solo mostrar confirmación si hay más documentos
        if (total > 1) {
            var confirmado = await ffMostrarConfirmImpresora(printerName, total - 1);
            if (!confirmado) {
                // Usuario canceló — restaurar botones, dejar el primer doc marcado como impreso
                document.getElementById('ffBtnImprimirDirecto').style.display = 'flex';
                document.getElementById('ffBtnImprimir').style.display = 'flex';
                wrap.classList.add('hidden');
                showToast('Serie cancelada. 1 documento ya fue enviado a impresora.', 'error');
                return;
            }
        }

        // ── FASE 3: Imprimir el resto en silencio con la misma impresora ──
        ffRestaurarProgressWrap();
        var labelProgress = document.getElementById('ffProgressWrap').querySelector('.section-label');
        if (labelProgress) labelProgress.textContent = 'Imprimiendo PDFs' + (printerName ? ' en "' + printerName + '"' : '') + '…';
        document.getElementById('ffProgressBar').style.width = Math.round((1 / total) * 100) + '%';
        document.getElementById('ffProgressLabel').textContent = 'Impreso 1 de ' + total + ': ' + primerDoc.pdfFile;

        for (var i = 1; i < total; i++) {
            var doc = pendientesImprimir[i];
            var tableIdx = _ffTodosResultados.indexOf(doc);
            var pct = Math.round((i / total) * 100);
            document.getElementById('ffProgressBar').style.width = pct + '%';
            document.getElementById('ffProgressLabel').textContent = 'Imprimiendo ' + (i+1) + ' de ' + total + ': ' + doc.pdfFile;
            ffMarcarFila(tableIdx, 'imprimiendo');

            // 500ms entre documentos — suficiente para el spooler sin hacer la serie lenta
            await new Promise(function(r) { setTimeout(r, 500); });

            var result = await window.fiscalAPI.directPrintTo(_ffCarpetaPath, doc.pdfFile, printerName, { grayscale: true });

            // Un solo reintento rápido si falla (800ms de espera)
            if (!result || (!result.ok && result.error)) {
                await new Promise(function(r) { setTimeout(r, 800); });
                result = await window.fiscalAPI.directPrintTo(_ffCarpetaPath, doc.pdfFile, printerName, { grayscale: true });
            }

            if (result && result.error) {
                ffMarcarFila(tableIdx, 'error');
                showToast('Error (' + doc.pdfFile + '): ' + result.error, 'error');
            } else {
                ffMarcarFila(tableIdx, 'impreso');
            }
        }

        document.getElementById('ffProgressBar').style.width = '100%';
        document.getElementById('ffProgressLabel').textContent = 'Completado — ' + total + ' documentos enviados a impresora' + (printerName ? ' "' + printerName + '"' : '') + '.';
        showToast(total + ' documentos enviados a impresora', 'success');
    }