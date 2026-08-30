// importacion/ImportacionJSON.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.

 // DOCUMENTOS ANULADOS

    let jsonQueue       = [];
    let currentMode     = '';
    let pendingReaders  = 0;
    // AGREGADO NUEVO — Cambio 01: total de archivos de la carga actual (bulk o
    // individual). Se usa únicamente para recalcular el contador visible ("N / Total")
    // cuando el usuario elimina un archivo de la lista con removeQueueRow().
    let queueTotalFiles = 0;

    // Corrección Bug 01: verifica si un Código de Generación (UUID del DTE)
    // ya existe en el libro indicado — SIN importar los montos, la fecha
    // exacta, ni cómo se registró el documento original (manual, JSON, CSV,
    // o un escaneo QR previo). A diferencia de esDocumentoDuplicado (que
    // compara un "fingerprint" completo incluyendo montos calculados y por
    // eso puede fallar en detectar el mismo documento si algún monto quedó
    // redondeado distinto), esta función solo compara el identificador único
    // del documento — igual que ya se hace para los archivos JSON arrastrados
    // a la cola de importación (ver más abajo, "isDupCurrentMonth").
    // Retorna el nombre del período donde ya existe ('Julio 2026') o null si
    // no se encontró.
    function _codigoGenYaExisteEnLibro(libroKey, codGenNorm, arrActual) {
        if (!codGenNorm || codGenNorm.length < 32) return null;
        var enActual = (arrActual || []).some(function(r) {
            var candidates = [r.numDoc, r.serie, r.docDel, r.docAl, r.resolucion, r.codigoGen];
            return candidates.some(function(c) { return c && normalizeUUID(c) === codGenNorm; });
        });
        if (enActual) return MONTH_NAMES[currentMonth] + ' ' + currentYear;
        var idxOtros = buildCrossMonthIndex(libroKey);
        if (idxOtros[codGenNorm]) return idxOtros[codGenNorm];
        return null;
    }

    // Extrae el UUID normalizado de un registro importado (del JSON crudo)
    function _getCodigoGenFromParsed(parsed) {
        var id = parsed.identificacion || {};
        var raw = id.codigoGeneracion || id.codigoGeneracion || parsed.codigoGeneracion || '';
        return normalizeUUID(raw);
    }

    // Detecta qué índices son duplicados dentro de un array
    function detectarDuplicados(libro, records) {
        var seen = {};   // fingerprint -> primer índice válido
        var duplicados = {}; // índice -> true
        records.forEach(function(r, i) {
            var fp = docFingerprint(libro, r);
            if (seen[fp] !== undefined) {
                duplicados[i] = true; // Este es duplicado
            } else {
                seen[fp] = i;
            }
        });
        return duplicados;
    } // todos los resultados incluyendo no encontrados

    // Detectar si una cadena tiene formato UUID del MH
    // Ej: A37B0199-EB4E-4282-9798-9175AD41D31D
    function _esUUID(str) {
        if (!str) return false;
        return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(str.trim());
    }

    // Obtener el código de generación UUID de un registro
    // Busca en todos los campos posibles y retorna el que tenga formato UUID
    function _getCodGenUUID(r) {
        var candidatos = [r.numDoc, r.codigoGen, r.resolucion, r.serie, r.docDel, r.docAl];
        for (var k = 0; k < candidatos.length; k++) {
            if (_esUUID(candidatos[k])) return candidatos[k].trim().toUpperCase();
        }
        // Si ninguno es UUID, retornar numDoc como fallback (puede ser manual)
        return r.numDoc || r.serie || '-';
    }

    // ══════════════════════════════════════════════
    // JSON FOLDER LOADING
    // ══════════════════════════════════════════════
    function handleFolderSelect(files) {
        var jsonFiles = Array.from(files).filter(function(f) { return f.name.toLowerCase().endsWith('.json'); });
        if (!jsonFiles.length) { showToast('No se encontraron archivos .json', 'error'); return; }
        loadFilesIntoQueue(jsonFiles);
    }

    function handleDrop(event) {
        event.preventDefault();
        document.getElementById('dropZone').classList.remove('border-blue-600');
        var items = event.dataTransfer.items;
        var filePromises = [];
        if (items) {
            for (var idx = 0; idx < items.length; idx++) {
                var item = items[idx];
                if (item.kind === 'file') {
                    var entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry) { filePromises.push(traverseEntry(entry)); }
                    else {
                        var f = item.getAsFile();
                        if (f && f.name.toLowerCase().endsWith('.json')) filePromises.push(Promise.resolve([f]));
                    }
                }
            }
        }
        Promise.all(filePromises).then(function(arrays) {
            var all = arrays.flat().filter(function(f) { return f.name.toLowerCase().endsWith('.json'); });
            if (!all.length) { showToast('No se encontraron archivos .json', 'error'); return; }
            loadFilesIntoQueue(all);
        });
    }

    function traverseEntry(entry) {
        return new Promise(function(resolve) {
            if (entry.isFile) {
                entry.file(function(f) { resolve([f]); });
            } else if (entry.isDirectory) {
                var reader = entry.createReader();
                var results = [];
                var readAll = function() {
                    reader.readEntries(function(entries) {
                        if (!entries.length) { resolve(results.flat()); return; }
                        Promise.all(entries.map(traverseEntry)).then(function(sub) { results.push.apply(results, sub); readAll(); });
                    });
                };
                readAll();
            } else { resolve([]); }
        });
    }

    function loadFilesIntoQueue(files) {
        // ═══ AGREGADO NUEVO: CONTROL DE IMPORTACIÓN ═══
        // Limpiar estructuras temporales antes de cada nueva carga
        jsonQueue = [];
        pendingReaders = 0;
        // Reiniciar el input file para permitir seleccionar la misma carpeta nuevamente
        var folderInput = document.getElementById('jsonFolder');
        if (folderInput) folderInput.value = '';
        // AGREGADO (Cambio 01): reiniciar también el input de Importación Individual
        var singleInput = document.getElementById('jsonFileSingle');
        if (singleInput) singleInput.value = '';

        pendingReaders = files.length;
        queueTotalFiles = files.length;
        var loaded = 0;
        var container = document.getElementById('fileContainer');
        container.innerHTML = '';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('typeSummary').classList.add('hidden');

        // AGREGADO NUEVO — Cambio 01/04: el rótulo (Receptor/Emisor) ya no es fijo
        // por modo; se calcula por documento en extractEntidadInfo() según el tipo
        // de DTE (ver Cambio 04), con el modo Compras/Ventas como criterio general
        // de respaldo para el resto de documentos.

        files.forEach(function(file, idx) {
            var row = document.createElement('div');
            row.id = 'qrow-' + idx;
            row.className = 'flex items-center justify-between gap-2 py-2 border-b border-zinc-900/60';
            row.innerHTML =
                '<div class="flex items-center gap-3 min-w-0">' +
                '<div class="w-2 h-2 rounded-full bg-zinc-700 flex-shrink-0" id="qdot-' + idx + '"></div>' +
                '<div class="min-w-0">' +
                '<div class="text-xs text-zinc-400 font-light truncate max-w-[220px]">' + file.name + '</div>' +
                // AGREGADO NUEVO — Cambio 01: nombre del Receptor/Emisor del documento.
                // Se completa únicamente cuando el archivo termina de leerse y resulta
                // válido; se deja vacío mientras tanto (ver ramas de reader.onload).
                '<div class="text-[10px] text-indigo-400 font-mono truncate max-w-[220px]" id="qname-' + idx + '"></div>' +
                '</div>' +
                '</div>' +
                '<div class="flex items-center gap-2 flex-shrink-0">' +
                '<span class="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter" id="qstat-' + idx + '">Leyendo…</span>' +
                // AGREGADO NUEVO — Cambio 01: botón para retirar este archivo de la cola
                // de importación actual. Solo afecta jsonQueue/la lista en memoria; no
                // borra el archivo físico del equipo. Oculto mientras se lee el archivo.
                '<button type="button" onclick="removeQueueRow(' + idx + ')" id="qremove-' + idx + '" class="hidden text-zinc-600 hover:text-red-500 transition text-sm leading-none px-1" title="Quitar de la lista">✕</button>' +
                '</div>';
            container.appendChild(row);

            var reader = new FileReader();
            reader.onload = function(e) {
                // ═══ AGREGADO NUEVO: FILTRADO DE ARCHIVOS CORRUPTOS/VACÍOS ═══
                var rawText = e.target.result;
                // 1. Ignorar archivos vacíos o que solo contienen espacios
                if (!rawText || !rawText.trim()) {
                    document.getElementById('qdot-' + idx).className = 'w-2 h-2 rounded-full bg-zinc-600';
                    document.getElementById('qstat-' + idx).innerText = 'Vacío — ignorado';
                    // AGREGADO NUEVO — Cambio 01: permitir retirar también archivos ignorados
                    var qrm0 = document.getElementById('qremove-' + idx);
                    if (qrm0) qrm0.classList.remove('hidden');
                    loaded++;
                    pendingReaders--;
                    document.getElementById('progressFill').style.width = ((loaded / files.length) * 100) + '%';
                    document.getElementById('counter').innerText = loaded + ' / ' + files.length;
                    if (loaded === files.length) renderQueueSummary();
                    return;
                }
                try {
                    var parsed = JSON.parse(rawText);
                    // 2. Ignorar si el JSON parseó pero está vacío (null, array vacío, objeto vacío)
                    if (!parsed || (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0)) {
                        document.getElementById('qdot-' + idx).className = 'w-2 h-2 rounded-full bg-zinc-600';
                        document.getElementById('qstat-' + idx).innerText = 'JSON vacío — ignorado';
                        // AGREGADO NUEVO — Cambio 01: permitir retirar también archivos ignorados
                        var qrm1 = document.getElementById('qremove-' + idx);
                        if (qrm1) qrm1.classList.remove('hidden');
                        loaded++;
                        pendingReaders--;
                        document.getElementById('progressFill').style.width = ((loaded / files.length) * 100) + '%';
                        document.getElementById('counter').innerText = loaded + ' / ' + files.length;
                        if (loaded === files.length) renderQueueSummary();
                        return;
                    }
                    // 3. Detectar duplicado contra mes activo por codigoGeneracion normalizado
                    var codGen = _getCodigoGenFromParsed(parsed);
                    var isDupCurrentMonth = false;
                    if (codGen && codGen.length >= 32) {
                        var allCurrentRecords = [].concat(
                            comprasRecords, debitoRecords, cfRecords,
                            percibidoRecords, retenidoRecords, anticipoRecords, excluidoRecords
                        );
                        isDupCurrentMonth = allCurrentRecords.some(function(r) {
                            var candidates = [r.numDoc, r.serie, r.docDel, r.docAl, r.resolucion, r.codigoGen];
                            return candidates.some(function(c) { return c && normalizeUUID(c) === codGen; });
                        });
                    }
                    if (isDupCurrentMonth) {
                        document.getElementById('qdot-' + idx).className = 'w-2 h-2 rounded-full bg-yellow-500';
                        document.getElementById('qstat-' + idx).innerHTML = '⚠ Ya existe en este mes — ignorado';
                        // AGREGADO NUEVO — Cambio 01: mostrar Receptor/Emisor también aquí
                        // (solo visual, no participa en la detección de duplicados de arriba)
                        var qnDup = document.getElementById('qname-' + idx);
                        if (qnDup) {
                            var infoDup = extractEntidadInfo(parsed, currentMode);
                            qnDup.innerText = infoDup.nombre ? (infoDup.label + ': ' + infoDup.nombre) : '';
                        }
                        var qrmDup = document.getElementById('qremove-' + idx);
                        if (qrmDup) qrmDup.classList.remove('hidden');
                        loaded++;
                        pendingReaders--;
                        document.getElementById('progressFill').style.width = ((loaded / files.length) * 100) + '%';
                        document.getElementById('counter').innerText = loaded + ' / ' + files.length;
                        if (loaded === files.length) renderQueueSummary();
                        return;
                    }
                    // 4. Archivo válido — agregar a la cola
                    // AGREGADO NUEVO — Cambio 01: se guarda rowIdx (para poder ubicar y
                    // quitar este ítem de jsonQueue desde removeQueueRow) y entidadNombre
                    // (solo para mostrarlo junto al archivo; no se usa en ningún cálculo
                    // ni validación de la importación).
                    var infoValido = extractEntidadInfo(parsed, currentMode);
                    jsonQueue.push({ file: file, parsed: parsed, rowIdx: idx, entidadNombre: infoValido.nombre });
                    var label = detectDocType(parsed);
                    document.getElementById('qdot-' + idx).className = 'w-2 h-2 rounded-full bg-blue-600';
                    document.getElementById('qstat-' + idx).innerText = label;
                    var qnValido = document.getElementById('qname-' + idx);
                    if (qnValido) qnValido.innerText = infoValido.nombre ? (infoValido.label + ': ' + infoValido.nombre) : '';
                    var qrmValido = document.getElementById('qremove-' + idx);
                    if (qrmValido) qrmValido.classList.remove('hidden');
                } catch(err) {
                    // 4. JSON malformado — ignorar sin detener la carga
                    document.getElementById('qdot-' + idx).className = 'w-2 h-2 rounded-full bg-red-500';
                    document.getElementById('qstat-' + idx).innerText = 'Corrupto — ignorado';
                    var qrmErr = document.getElementById('qremove-' + idx);
                    if (qrmErr) qrmErr.classList.remove('hidden');
                }
                loaded++;
                pendingReaders--;
                document.getElementById('progressFill').style.width = ((loaded / files.length) * 100) + '%';
                document.getElementById('counter').innerText = loaded + ' / ' + files.length;
                if (loaded === files.length) renderQueueSummary();
            };
            reader.onerror = function() {
                // ═══ AGREGADO NUEVO: error de lectura — ignorar silenciosamente ═══
                document.getElementById('qdot-' + idx).className = 'w-2 h-2 rounded-full bg-red-500';
                document.getElementById('qstat-' + idx).innerText = 'Error lectura — ignorado';
                // AGREGADO NUEVO — Cambio 01: permitir retirar también archivos con error
                var qrmOnErr = document.getElementById('qremove-' + idx);
                if (qrmOnErr) qrmOnErr.classList.remove('hidden');
                loaded++;
                pendingReaders--;
                document.getElementById('progressFill').style.width = ((loaded / files.length) * 100) + '%';
                document.getElementById('counter').innerText = loaded + ' / ' + files.length;
                if (loaded === files.length) renderQueueSummary();
            };
            reader.readAsText(file);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO — Cambio 01: Mostrar Receptor/Emisor durante la carga
    // ══════════════════════════════════════════════════════════════════
    // Extrae el nombre del Receptor o del Emisor del JSON cargado, para
    // mostrarlo junto al archivo antes de importar y así identificar
    // rápidamente a qué empresa/persona pertenece. Es un dato puramente
    // informativo: no se usa en mapJsonToCompras, mapJsonToCf,
    // mapJsonToDebito ni en ninguna otra función de mapeo, ni participa en
    // validaciones, cálculos o el proceso de importación.
    //
    // AGREGADO — Cambio 04: extiende esta misma lógica para dos tipos de
    // documento específicos, sin importar el modo de importación activo
    // (Compras/Ventas):
    //   - Sujeto Excluido (tipoDte 14)      → siempre se muestra el Emisor.
    //   - Comprobante de Retención (tipoDte 07) → siempre se muestra el Receptor.
    // Para el resto de documentos se conserva el criterio existente basado
    // en el modo (Compras → Receptor, Ventas → Emisor). No se modifica la
    // estructura original del JSON ni el proceso de importación: esta
    // información se usa únicamente para identificación visual.
    function extractEntidadInfo(parsed, mode) {
        if (!parsed) return { label: '', nombre: '' };

        var tipoDte = (
            (parsed.identificacion && parsed.identificacion.tipoDte) ||
            (parsed.identificacion && parsed.identificacion.tipoDTE) ||
            parsed.tipoDte || parsed.tipoDTE || parsed.dteType || parsed.tipo_dte || ''
        ).toString().trim();

        var campo, label;
        if (tipoDte === '14') {
            // Sujeto Excluido — Cambio 04: mostrar Nombre del Emisor
            campo = 'emisor'; label = 'Emisor';
        } else if (tipoDte === '07') {
            // Comprobante de Retención — Cambio 04: mostrar Nombre del Receptor
            campo = 'receptor'; label = 'Receptor';
        } else {
            campo = (mode === 'compras') ? 'receptor' : 'emisor';
            label = (mode === 'compras') ? 'Receptor' : 'Emisor';
        }

        var obj = parsed[campo] || {};
        var nombre = gv(obj, 'nombre', 'nombreComercial', 'razonSocial') || '';
        return { label: label, nombre: nombre };
    }

    // Mantiene compatibilidad con el nombre de función original (Cambio 01),
    // devolviendo únicamente el nombre. Internamente usa extractEntidadInfo.
    function extractEntidadNombre(parsed, mode) {
        return extractEntidadInfo(parsed, mode).nombre;
    }

    // AGREGADO NUEVO — Cambio 01: Retira un archivo de la cola de importación
    // actual (jsonQueue) y de la lista visible. Solo afecta la sesión actual
    // de importación; no borra el archivo físico del equipo ni modifica la
    // lógica de importación, generación de Libros, Anexos o CSV.
    function removeQueueRow(idx) {
        var row = document.getElementById('qrow-' + idx);
        if (row) row.remove();

        // Si el archivo estaba en la cola de válidos, se retira de jsonQueue para
        // que no se importe. Si era un archivo ignorado/duplicado, esto no cambia
        // nada en jsonQueue (nunca estuvo ahí), solo se limpia de la lista visible.
        jsonQueue = jsonQueue.filter(function(item) { return item.rowIdx !== idx; });

        // AGREGADO NUEVO — Cambio 01: recalcular el contador "N / Total" para que
        // refleje la cantidad de archivos que quedan en la lista tras eliminar uno,
        // en vez de seguir mostrando la cantidad original de la carga.
        var remaining = document.querySelectorAll('#fileContainer [id^="qrow-"]').length;
        var counterEl = document.getElementById('counter');
        if (counterEl) {
            counterEl.innerText = remaining
                ? (remaining + ' / ' + queueTotalFiles)
                : '0 archivos';
        }

        var container = document.getElementById('fileContainer');
        if (container && !container.children.length) {
            container.innerHTML = '<p class="text-xs text-zinc-700 italic">Esperando archivos...</p>';
            document.getElementById('typeSummary').classList.add('hidden');
        } else {
            // Recalcular contadores/pills (ignorados, duplicados, etc.) sin toast
            renderQueueSummary(true);
        }
    }

    function renderQueueSummary(silent) {
        var counts = {};
        jsonQueue.forEach(function(item) {
            var t = detectDocType(item.parsed);
            counts[t] = (counts[t] || 0) + 1;
        });
        var summary = document.getElementById('typeSummary');
        summary.classList.remove('hidden');

        // ═══ AGREGADO NUEVO: contar ignorados visibles en la lista ═══
        var ignoradosCount = 0;
        var dupsMesCount = 0;
        var rows = document.getElementById('fileContainer').querySelectorAll('[id^="qstat-"]');
        rows.forEach(function(el) {
            var txt = el.innerText || '';
            if (txt.indexOf('ignorado') !== -1 || txt.indexOf('Corrupto') !== -1 || txt.indexOf('Error lectura') !== -1) {
                ignoradosCount++;
            }
            if (txt.indexOf('Ya existe en este mes') !== -1) {
                dupsMesCount++;
            }
        });

        var pills = Object.entries(counts).map(function(entry) {
            return '<span class="text-[10px] px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-400 font-mono">' + entry[0] + ': ' + entry[1] + '</span>';
        }).join('');

        // Pill de ignorados (si los hay)
        if (ignoradosCount > 0) {
            pills += '<span class="text-[10px] px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-400 font-mono">Ignorados: ' + ignoradosCount + '</span>';
        }
        // Pill de duplicados del mes activo
        if (dupsMesCount > 0) {
            pills += '<span class="text-[10px] px-3 py-1 rounded-full bg-yellow-600/10 border border-yellow-600/20 text-yellow-400 font-mono">⚠ Duplicados mes actual: ' + dupsMesCount + '</span>';
        }

        summary.innerHTML = pills;

        // AGREGADO NUEVO — Cambio 01: en modo silencioso (recálculo tras eliminar un
        // archivo de la lista) se omiten los toasts para no interrumpir al usuario.
        if (silent) return;

        if (jsonQueue.length === 0) {
            showToast('Ningún archivo válido para importar', 'error');
        } else if (dupsMesCount > 0 && ignoradosCount > 0) {
            showToast(jsonQueue.length + ' válidos · ' + dupsMesCount + ' duplicados del mes · ' + ignoradosCount + ' ignorados', 'success');
        } else if (dupsMesCount > 0) {
            showToast(jsonQueue.length + ' válidos · ' + dupsMesCount + ' ya existen en este mes', 'success');
        } else if (ignoradosCount > 0) {
            showToast(jsonQueue.length + ' válidos · ' + ignoradosCount + ' ignorados', 'success');
        } else {
            showToast(jsonQueue.length + ' archivos listos para importar', 'success');
        }
    }

    function clearQueue() {
        jsonQueue = [];
        pendingReaders = 0;
        queueTotalFiles = 0;
        document.getElementById('fileContainer').innerHTML = '<p class="text-xs text-zinc-700 italic">Esperando archivos...</p>';
        document.getElementById('counter').innerText = '0 archivos';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('typeSummary').classList.add('hidden');
        document.getElementById('typeSummary').innerHTML = '';
        // ═══ AGREGADO NUEVO: CONTROL DE IMPORTACIÓN ═══
        // Reiniciar el input file para permitir seleccionar la misma carpeta nuevamente
        var folderInput = document.getElementById('jsonFolder');
        if (folderInput) folderInput.value = '';
        // AGREGADO (Cambio 01): reiniciar también el input de Importación Individual
        var singleInputClear = document.getElementById('jsonFileSingle');
        if (singleInputClear) singleInputClear.value = '';
    }

    // ══════════════════════════════════════════════
    // HELPER: Extraer tipoDte robusto
    // ══════════════════════════════════════════════
    function getTipoDte(parsed) {
        return (
            (parsed.identificacion && parsed.identificacion.tipoDte) ||
            (parsed.identificacion && parsed.identificacion.tipoDTE) ||
            parsed.tipoDte ||
            parsed.tipoDTE ||
            parsed.dteType ||
            parsed.tipo_dte ||
            ''
        ).toString().trim();
    }

    // ══════════════════════════════════════════════
    // Detectar IVA Percibido / Retenido dentro de JSON de compra
    // ══════════════════════════════════════════════
    function detectarPercibidoDeCompra(parsed) {
        var resumen = parsed.resumen || parsed.resumenDocumento || {};
        var montoPercibido =
            parseFloat(resumen.ivaPercibido) ||
            parseFloat(resumen.ivaPerci1) ||
            parseFloat(resumen.montoPercepcion) ||
            parseFloat(resumen.totalPercibido) ||
            parseFloat(resumen.totalIVAPercibido) ||
            parseFloat(resumen.ivaPercibido1) ||
            0;

        if (montoPercibido <= 0) return null;

        var id = parsed.identificacion || {};
        var em = parsed.emisor || {};
        var selloRecepcion = gv(parsed,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(parsed,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';

        var montoSujeto = gn(parsed,'resumen.totalGravada','resumen.subTotalVentas','resumen.montoSujetoPercepcion','resumen.subTotalSinImpuesto','resumen.totalCompras','resumen.montoTotalOperacion');
        if (montoSujeto <= 0) {
            montoSujeto = montoPercibido / 0.01;
        }

        return {
            nit:     gv(em,'nit','numDocumento') || '',
            dui:     gv(em,'dui') || '',
            fecha:   gv(id,'fecEmi','fechaEmision') || '',
            tipoDoc: gv(id,'tipoDte','tipoDTE') || '03',
            serie:   selloRecepcion,
            numDoc:  codigoGen,
            monto:   montoSujeto,
            iva:     montoPercibido
        };
    }

    function detectarRetenidoDeCompra(parsed) {
        var resumen = parsed.resumen || parsed.resumenDocumento || {};
        var montoRetenido =
            parseFloat(resumen.totalIVAretenido) ||   // ACSA — r minúscula
            parseFloat(resumen.totalIVARetenido) ||   // variante R mayúscula
            parseFloat(resumen.ivaRetenido) ||
            parseFloat(resumen.ivaRete1) ||
            parseFloat(resumen.montoRetencion) ||
            parseFloat(resumen.totalRetenido) ||
            parseFloat(resumen.ivaRetenido1) ||
            parseFloat(resumen.reteRenta) ||
            0;
        // Fallback: sumar ivaRetenido de cada ítem del cuerpoDocumento
        if (montoRetenido <= 0 && Array.isArray(parsed.cuerpoDocumento)) {
            parsed.cuerpoDocumento.forEach(function(item) {
                montoRetenido += parseFloat(item.ivaRetenido) || 0;
            });
        }

        if (montoRetenido <= 0) return null;

        var id = parsed.identificacion || {};
        var em = parsed.emisor || {};
        var selloRecepcion = gv(parsed,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(parsed,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';

        var montoSujeto = gn(parsed,
            'resumen.totalSujetoRetencion',
            'resumen.totalGravada',
            'resumen.subTotalVentas',
            'resumen.montoSujetoRetencion',
            'resumen.subTotalSinImpuesto',
            'resumen.totalCompras',
            'resumen.montoTotalOperacion'
        );
        // Fallback: sumar montoSujetoGrav de cada ítem
        if (montoSujeto <= 0 && Array.isArray(parsed.cuerpoDocumento)) {
            parsed.cuerpoDocumento.forEach(function(item) {
                montoSujeto += parseFloat(item.montoSujetoGrav) || 0;
            });
        }
        if (montoSujeto <= 0) {
            montoSujeto = montoRetenido / 0.01;
        }

        return {
            nit:     gv(em,'nit','numDocumento') || '',
            dui:     gv(em,'dui') || '',
            fecha:   gv(id,'fecEmi','fechaEmision') || '',
            tipoDoc: gv(id,'tipoDte','tipoDTE') || '03',
            serie:   selloRecepcion,
            numDoc:  codigoGen,
            monto:   montoSujeto,
            iva:     montoRetenido
        };
    }

    // ══════════════════════════════════════════════
    // IMPORTACIÓN
    // ══════════════════════════════════════════════
    function iniciarImportacion() {
        if (pendingReaders > 0) {
            showToast('Espera, aún se están leyendo archivos...', 'error');
            return;
        }
        if (!jsonQueue.length) {
            showToast('No hay archivos en la cola', 'error');
            return;
        }
        if (!currentMode) {
            showToast('Selecciona JSON Compras o JSON Ventas primero', 'error');
            return;
        }

        var counters = { cf: 0, debito: 0, retenido: 0, compras: 0, percibido: 0, anticipo: 0, excluido: 0, omitido: 0 };

        jsonQueue.forEach(function(item) {
            var parsed = item.parsed;
            var tipoDTE = getTipoDte(parsed);

            if (currentMode === 'ventas') {
                if (['01','02','10','11'].indexOf(tipoDTE) !== -1) {
                    cfRecords.push(mapJsonToCf(parsed)); counters.cf++;
                }
                else if (['03','05','06'].indexOf(tipoDTE) !== -1) {
                    debitoRecords.push(mapJsonToDebito(parsed)); counters.debito++;
                }
                else if (tipoDTE === '07') {
                    retenidoRecords.push(mapJsonToRetenido(parsed)); counters.retenido++;
                }
                else if (tipoDTE === '14') {
                    // Fac. Sujeto Excluido — solo permitido en Compras, no en Ventas
                    counters.omitido++;
                }
                else if (tipoDTE === '15') {
                    // AGREGADO NUEVO: Comprobante de Donación — no compatible, se omite
                    counters.omitido++;
                }
                else {
                    var rec = parsed.receptor || {};
                    var hasNrc = rec.nrc || rec.numDocumento || rec.nit;
                    if (hasNrc && rec.nombre) {
                        debitoRecords.push(mapJsonToDebito(parsed)); counters.debito++;
                    } else {
                        cfRecords.push(mapJsonToCf(parsed)); counters.cf++;
                    }
                }
            } else {
                // Si no tiene tipo de documento, omitir
                if (!tipoDTE) {
                    counters.omitido++;
                    return;
                }

                if (['03','05','06','11','12','13'].indexOf(tipoDTE) !== -1) {
                    var cpRecImp = mapJsonToCompras(parsed);
                    comprasRecords.push(cpRecImp); counters.compras++;

                    var percRec = detectarPercibidoDeCompra(parsed);
                    if (percRec) {
                        // AGREGADO NUEVO: vincular el registro de Compras con el registro
                        // generado en el Libro de IVA Percibido (misma fuente: Sello de
                        // Recepción e IVA Percibido ya presentes en cpRecImp), de modo que
                        // si el usuario edita o elimina la compra más adelante, el registro
                        // de Percibido correspondiente se actualiza o elimina en conjunto.
                        var percLinkIdImp = 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
                        cpRecImp._percLinkId = percLinkIdImp;
                        percRec._fromCompraLinkId = percLinkIdImp;
                        // Usar el Sello de Recepción ya resuelto en cpRecImp (incluye el
                        // respaldo de búsqueda profunda) para que ambos registros coincidan.
                        if (cpRecImp.selloRecepcion) { percRec.serie = cpRecImp.selloRecepcion; }
                        percibidoRecords.push(percRec);
                        counters.percibido++;
                    }

                    var retRec = detectarRetenidoDeCompra(parsed);
                    if (retRec) {
                        retenidoRecords.push(retRec);
                        counters.retenido++;
                    }

                } else if (tipoDTE === '08') {
                    percibidoRecords.push(mapJsonToPercibido(parsed)); counters.percibido++;
                } else if (tipoDTE === '09') {
                    anticipoRecords.push(mapJsonToAnticipo(parsed)); counters.anticipo++;
                } else if (tipoDTE === '15') {
                    // AGREGADO NUEVO: Comprobante de Donación — no compatible, se omite
                    // (antes se importaba incorrectamente junto con '14' como Sujeto Excluido)
                    counters.omitido++;
                } else if (tipoDTE === '14') {
                    excluidoRecords.push(mapJsonToExcluido(parsed)); counters.excluido++;
                } else {
                    // Tipo no permitido en compras (01, 02, u otro) — omitir
                    counters.omitido++;
                }
            }
        });

        saveCurrentMonthData();

        // ══════════════════════════════════════════════════════════════
        // DETECCIÓN CROSS-MESES: marcar registros que ya existen en
        // meses anteriores con _dupMes = 'MesNombre YYYY'
        // ══════════════════════════════════════════════════════════════
        var libroKeyMap = {
            compras:   'compras',
            debito:    'debito',
            cf:        'cf',
            percibido: 'percibido',
            retenido:  'retenido',
            anticipo:  'anticipo',
            excluido:  'excluido'
        };
        var crossIndexCache = {};
        function getCrossIndex(libroKey) {
            if (!crossIndexCache[libroKey]) crossIndexCache[libroKey] = buildCrossMonthIndex(libroKey);
            return crossIndexCache[libroKey];
        }
        function markCrossDups(arr, libroKey) {
            var idx = getCrossIndex(libroKey);
            arr.forEach(function(r) {
                var candidates = [r.numDoc, r.serie, r.docDel, r.docAl, r.resolucion, r.codigoGen];
                for (var ci = 0; ci < candidates.length; ci++) {
                    if (!candidates[ci]) continue;
                    var norm = normalizeUUID(candidates[ci]);
                    if (norm.length >= 32 && idx[norm]) {
                        r._dupMes = idx[norm];
                        break;
                    }
                }
            });
        }
        markCrossDups(comprasRecords,   'compras');
        markCrossDups(debitoRecords,    'debito');
        markCrossDups(cfRecords,        'cf');
        markCrossDups(percibidoRecords, 'percibido');
        markCrossDups(retenidoRecords,  'retenido');
        markCrossDups(anticipoRecords,  'anticipo');
        markCrossDups(excluidoRecords,  'excluido');
        saveCurrentMonthData();
        // ══════════════════════════════════════════════════════════════
        function sortArrByFecha(arr) {
            arr.sort(function(a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });
        }
        sortArrByFecha(debitoRecords);
        sortArrByFecha(cfRecords);
        sortArrByFecha(comprasRecords);
        sortArrByFecha(percibidoRecords);
        sortArrByFecha(retenidoRecords);
        sortArrByFecha(anticipoRecords);
        sortArrByFecha(excluidoRecords);
        saveCurrentMonthData();
        // ───────────────────────────────────────────────────────────────

        renderAllTables();

        // AGREGADO NUEVO: auto-registrar proveedores desde compras importadas
        // Bug #4 fix: registrar para cualquier modo (no solo 'compras'), y aplicar
        // clasificación existente del catálogo a los registros recién importados
        {
            var provNuevos = 0;
            var registrosProveedor = comprasRecords;
            comprasRecords.forEach(function(r) {
                if (r.nit) {
                    var added = autoRegistrarProveedor(r.nit, r.nombre, r.dui || '', r.nrc || '');
                    if (added) provNuevos++;
                    else {
                        // Aplicar clasificación existente del catálogo al registro recién importado
                        var provs = loadProveedores();
                        var prov = provs.find(function(p) { return p.nit === r.nit; });
                        if (prov) {
                            if (prov.nombre && !r.nombre) r.nombre = prov.nombre;
                            if (prov.clasif && !r.clasif) r.clasif = prov.clasif;
                            if (prov.sector && !r.sector) r.sector = prov.sector;
                            if (prov.tipoCosto && !r.tipoCosto) r.tipoCosto = prov.tipoCosto;
                            // Actualizar NRC en catálogo si viene en el JSON y no estaba guardado
                            if (r.nrc && !prov.nrc) {
                                prov.nrc = r.nrc;
                                saveProveedores(provs);
                            }
                        }
                    }
                }
            });
            if (provNuevos > 0) {
                saveCurrentMonthData();
                renderProveedoresTable();
                showToast(provNuevos + ' proveedor(es) nuevos agregados al catálogo', 'success');
            }
        }

        // AGREGADO NUEVO: auto-registrar clientes desde ventas importadas
        if (currentMode === 'ventas') {
            var clientesNuevos = 0;
            // Registrar clientes de débito (CCF) — tienen NIT/NRC del receptor
            debitoRecords.forEach(function(r) {
                var nit = (r.nit || r.nrc || '').trim();
                var nombre = (r.nombre || '').trim();
                if (nit) {
                    var added = autoRegistrarCliente(nit, nombre, r.nrc || '');
                    if (added) clientesNuevos++;
                }
            });
            if (clientesNuevos > 0) {
                renderClientesTable();
                showToast(clientesNuevos + ' cliente(s) nuevo(s) agregado(s) al catálogo', 'success');
            }
        }

        var total = Object.values(counters).reduce(function(a, b) { return a + b; }, 0);
        var imported = total - counters.omitido;
        var detail = Object.entries(counters)
            .filter(function(entry) { return entry[1] > 0; })
            .map(function(entry) { return entry[1] + ' ' + entry[0]; })
            .join(', ');
        showToast(imported + ' registros importados → ' + detail, 'success');
        clearQueue();
    }

    function mapJsonToDebito(j) {
        var id  = j.identificacion || {};
        var rec = j.receptor || {};
        var gravadas  = gn(j,'resumen.totalGravada','resumen.ventasGravadas','resumenDocumento.totalGravada');
        var exentas   = gn(j,'resumen.totalExenta','resumen.ventasExentas','resumenDocumento.totalExenta');
        var nosujetas = gn(j,'resumen.totalNoSuj','resumen.ventasNoSujetas');
        var descuento = gn(j,'resumen.totalDescu','resumen.totalDescuento','resumen.descuento','resumen.montoDescuento','resumenDocumento.totalDescu','resumenDocumento.totalDescuento');
        if (descuento > 0) { gravadas = Math.max(0, gravadas - descuento); }
        var ivaTributos = 0;
        if (j.resumen && Array.isArray(j.resumen.tributos)) {
            j.resumen.tributos.forEach(function(t) {
                var cod = String(t.codigo || t.codigoTributo || '').trim();
                if (cod === '20') { ivaTributos += parseFloat(t.valor) || 0; }
            });
        }
        var iva = ivaTributos > 0 ? ivaTributos : (gn(j,'resumen.totalIva','resumenDocumento.totalIva') || (gravadas * 0.13));
        var total = gravadas + iva + exentas + nosujetas;

        var numControl = gv(id,'numeroControl') || '';
        var selloRecepcion = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';

        // Aplicar codificación del catálogo de clientes si existe
        var nitRec = gv(rec,'nit','numDocumento') || '';
        var empTipoIng = (activeEmpresaId && empresas.find(function(e){return e.id===activeEmpresaId;})) ? (empresas.find(function(e){return e.id===activeEmpresaId;}).tipoIng || '1') : '1';
        var tipoOpFinal  = '1';
        var tipoIngFinal = empTipoIng;
        if (nitRec) {
            var clienteCat = loadClientes().find(function(c) { return c.nit === nitRec || (c.nrc && c.nrc === nitRec); });
            if (clienteCat) {
                if (clienteCat.tipoOp)  tipoOpFinal  = clienteCat.tipoOp;
                if (clienteCat.tipoIng) tipoIngFinal = clienteCat.tipoIng;
            }
        }

        return {
            fecha:      gv(id,'fecEmi','fechaEmision','fecha') || '',
            clase:      '4',
            tipoDoc:    gv(id,'tipoDte','tipoDTE') || '03',
            resolucion: numControl,
            serie:      selloRecepcion,
            numDoc:     codigoGen,
            nit:        nitRec,
            nrc:        gv(rec,'nrc') || '',
            dui:        gv(rec,'dui') || '',
            nombre:     gv(rec,'nombre','razonSocial') || '',
            ctrl:       '',
            exentas: exentas, nosujetas: nosujetas, gravadas: gravadas, iva: iva,
            tercero: 0, dfTercero: 0, total: total,
            tipoOp: tipoOpFinal, tipoIng: tipoIngFinal
        };
    }

    function mapJsonToCf(j) {
        var id  = j.identificacion || {};
        var gravadas  = gn(j,'resumen.totalGravada','resumen.ventasGravadas','resumenDocumento.totalGravada');
        var exentas   = gn(j,'resumen.totalExenta','resumen.ventasExentas','resumenDocumento.totalExenta');
        var nosujetas = gn(j,'resumen.totalNoSuj','resumen.ventasNoSujetas');
        var descuentoCf = gn(j,'resumen.descuGravada','resumenDocumento.descuGravada');
        if (descuentoCf <= 0) {
            var pctDescCf = gn(j,'resumen.porcentajeDescuento','resumenDocumento.porcentajeDescuento');
            if (pctDescCf > 0) {
                descuentoCf = gn(j,'resumen.totalDescu','resumen.totalDescuento','resumen.descuento','resumen.montoDescuento','resumenDocumento.totalDescu','resumenDocumento.totalDescuento');
            }
        }
        if (descuentoCf > 0) { gravadas = Math.max(0, gravadas - descuentoCf); }
        var total = gn(j,'resumen.totalPagar','resumen.montoTotalOperacion','resumenDocumento.totalPagar') || (gravadas + exentas + nosujetas);

        var numControl = gv(id,'numeroControl') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';
        var selloRecepcion = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';

        // Aplicar codificación del catálogo de clientes si existe (CF no tiene NIT receptor pero puede tener receptor)
        var rec = j.receptor || {};
        var nitRec = gv(rec,'nit','numDocumento','dui') || '';
        var empTipoIng = (activeEmpresaId && empresas.find(function(e){return e.id===activeEmpresaId;})) ? (empresas.find(function(e){return e.id===activeEmpresaId;}).tipoIng || '1') : '1';
        var tipoOpFinal  = '1';
        var tipoIngFinal = empTipoIng;
        if (nitRec) {
            var clienteCatCf = loadClientes().find(function(c) { return c.nit === nitRec || (c.nrc && c.nrc === nitRec); });
            if (clienteCatCf) {
                if (clienteCatCf.tipoOp)  tipoOpFinal  = clienteCatCf.tipoOp;
                if (clienteCatCf.tipoIng) tipoIngFinal = clienteCatCf.tipoIng;
            }
        }

        return {
            fecha:      gv(id,'fecEmi','fechaEmision') || '',
            clase:      '4',
            tipoDoc:    gv(id,'tipoDte','tipoDTE') || '01',
            resolucion: numControl,
            serie:      selloRecepcion,
            maquina:    '',
            ctrlDel:    numControl,
            ctrlAl:     numControl,
            docDel:     codigoGen,
            docAl:      codigoGen,
            exentas: exentas, exentaNosuj: 0, nosujetas: nosujetas, gravadas: gravadas,
            expCa: 0, expFuera: 0, expServ: 0, zonas: 0, terceros: 0,
            total: total, tipoOp: tipoOpFinal, tipoIng: tipoIngFinal
        };
    }

    function mapJsonToRetenido(j) {
        var id  = j.identificacion || {};
        var em  = j.emisor || {};
        // Monto sujeto: buscar en resumen primero, luego sumar cuerpoDocumento si aplica
        var monto = gn(j,
            'resumen.totalSujetoRetencion',   // ACSA tipoDTE 07 — campo exacto del MH
            'resumen.montoSujetoRetencion',
            'resumen.totalGravada',
            'resumen.subTotalVentas',
            'resumen.subTotalSinImpuesto',
            'resumen.totalPagar',
            'resumen.montoTotalOperacion'
        );
        // Fallback: sumar montoSujetoGrav de cada ítem del cuerpoDocumento
        if (monto <= 0 && Array.isArray(j.cuerpoDocumento)) {
            j.cuerpoDocumento.forEach(function(item) {
                monto += parseFloat(item.montoSujetoGrav) || 0;
            });
        }
        var selloRecepcion = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';
        // IVA retenido: campo puede venir con R mayúscula o minúscula
        var ivaRetenido = gn(j,
            'resumen.totalIVAretenido',   // ACSA — r minúscula
            'resumen.totalIVARetenido',   // variante R mayúscula
            'resumen.ivaRetenido',
            'resumen.ivaRete1',
            'resumen.montoRetencion',
            'resumen.totalRetenido'
        );
        // Fallback: sumar ivaRetenido de cada ítem del cuerpoDocumento
        if (ivaRetenido <= 0 && Array.isArray(j.cuerpoDocumento)) {
            j.cuerpoDocumento.forEach(function(item) {
                ivaRetenido += parseFloat(item.ivaRetenido) || 0;
            });
        }
        if (ivaRetenido <= 0) ivaRetenido = monto * 0.01;
        return {
            nit:     gv(em,'nit','numDocumento') || '',
            dui:     gv(em,'dui') || '',
            fecha:   gv(id,'fecEmi','fechaEmision') || '',
            tipoDoc: gv(id,'tipoDte','tipoDTE') || '07',
            serie:   selloRecepcion,
            numDoc:  codigoGen,
            monto: monto, iva: ivaRetenido
        };
    }

    function mapJsonToCompras(j) {
        var id  = j.identificacion || {};
        var em  = j.emisor || {};
        var intGravadas = gn(j,'resumen.totalGravada','resumen.comprasGravadas');
        var intExentas  = gn(j,'resumen.totalExenta','resumen.comprasExentas');
        // Descontar descuentos de intGravadas para que la base gravable coincida con el documento
        // NOTA: usar descuGravada (descuento a nivel documento) NO totalDescu que puede incluir
        // descuentos por ítem ya reflejados en totalGravada.
        var descuento = gn(j,'resumen.descuGravada','resumenDocumento.descuGravada');
        if (descuento <= 0) {
            var pctDesc = gn(j,'resumen.porcentajeDescuento','resumenDocumento.porcentajeDescuento');
            if (pctDesc > 0) {
                descuento = gn(j,'resumen.totalDescu','resumen.totalDescuento','resumen.descuento','resumen.montoDescuento','resumenDocumento.totalDescu','resumenDocumento.totalDescuento');
            }
        }
        if (descuento > 0) { intGravadas = Math.max(0, intGravadas - descuento); }
        // Leer IVA real desde resumen.tributos (array) — fuente más confiable del MH
        // SOLO sumar tributo con código 20 (IVA 13%) — excluir FOVIAL (59) y COTRANS (71)
        var creditoTributos = 0;
        // AGREGADO NUEVO — Cambio 06: capturar FOVIAL (código 59) y COTRANS (código 71)
        // del mismo arreglo resumen.tributos, únicamente para mostrarlos en el formulario
        // de Compras (campos cp_fovial / cp_cotrans). Son montos puramente informativos:
        // no se suman a creditoTributos ni a ningún otro total, y no alteran la lógica
        // fiscal existente (ver notas "FOVIAL y COTRANS son informativos" más abajo).
        var fovialJson = 0;
        var cotransJson = 0;
        if (j.resumen && Array.isArray(j.resumen.tributos)) {
            j.resumen.tributos.forEach(function(t) {
                var cod = String(t.codigo || t.codigoTributo || '').trim();
                if (cod === '20') { creditoTributos += parseFloat(t.valor) || 0; }
                // AGREGADO NUEVO — Cambio 06: se reconocen ambos juegos de códigos de tributo
                // observados en los JSON de DTE: '59'/'71' (esquema numérico antiguo) y
                // 'D1'/'C8' (catálogo CAT-015 vigente, usado por la mayoría de emisores).
                // Puramente detección de código — no cambia dónde ni cómo se usa el valor.
                else if (cod === '59' || cod === 'D1') { fovialJson += parseFloat(t.valor) || 0; }
                else if (cod === '71' || cod === 'C8') { cotransJson += parseFloat(t.valor) || 0; }
            });
        }
        var credito = creditoTributos > 0 ? creditoTributos : (gn(j,'resumen.totalIva') || (intGravadas * 0.13));
        // Total del libro = exentas + gravadas + IVA — FOVIAL y COTRANS son informativos, no suman
        var total = intExentas + intGravadas + credito;
        var codigoGen = gv(id,'codigoGeneracion') || '';
        var nitProv = gv(em,'nit','numDocumento') || '';
        // AGREGADO NUEVO: defaults desde empresa activa
        var defSector = '1';
        if (activeEmpresaId) {
            var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
            if (empActiva && empActiva.sector) defSector = empActiva.sector;
        }
        // AGREGADO NUEVO: aplicar clasificación del catálogo de proveedores si existe
        var defClasif = '1';
        var defTipoCosto = '1';
        var nombreProv = gv(em,'nombre','razonSocial') || '';
        if (nitProv && activeEmpresaId) {
            var provs = loadProveedores();
            var prov = provs.find(function(p) { return p.nit === nitProv || (p.nrc && p.nrc === nitProv); });
            if (prov) {
                if (prov.clasif) defClasif = prov.clasif;
                if (prov.sector) defSector = prov.sector;
                if (prov.tipoCosto) defTipoCosto = prov.tipoCosto;
                if (prov.nombre) nombreProv = prov.nombre;
            }
        }
        // AGREGADO NUEVO — Cambio 02: Sello de Recepción e IVA Percibido — se extraen
        // del mismo .json (cuando el documento los contiene) para llenar automáticamente
        // estos dos campos informativos del registro de Compras. No participan en ningún
        // cálculo de este módulo (crédito fiscal / total de Compras siguen igual).
        // El IVA Percibido reutiliza exactamente detectarPercibidoDeCompra() — la misma
        // función que genera el registro del Libro de IVA Percibido (Anexo 8) — en lugar
        // de duplicar la extracción, para garantizar que el valor mostrado en el formulario
        // de Compras sea siempre idéntico al que ya se registró en dicho anexo, sin
        // recalcularlo ni crear una segunda fuente de verdad.
        var selloRecepcionCp = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';
        var percDetectadoCp = detectarPercibidoDeCompra(j);
        var ivaPercibidoCp = percDetectadoCp ? percDetectadoCp.iva : 0;
        return {
            fecha:    gv(id,'fecEmi','fechaEmision') || '',
            clase:    '4',
            tipoDoc:  gv(id,'tipoDte','tipoDTE') || '03',
            numDoc:   codigoGen,
            nit:      nitProv,
            nrc:      gv(em,'nrc') || '',
            dui:      gv(em,'dui') || '',
            nombre:   nombreProv,
            intExentas: intExentas, internExentas: 0, impExentas: 0,
            intGravadas: intGravadas, internGrav: 0, impGrav: 0, impServ: 0,
            credito: credito, total: total,
            tipoOp: '1', clasif: defClasif, sector: defSector, tipoCosto: defTipoCosto,
            selloRecepcion: selloRecepcionCp, ivaPercibido: ivaPercibidoCp,
            // AGREGADO NUEVO — Cambio 06: FOVIAL y COTRANS detectados en el JSON importado.
            // Solo se muestran en el formulario (openComprasModal ya los lee vía r.fovial /
            // r.cotrans); no participan en credito, total, ni en ningún otro cálculo.
            fovial: fovialJson, cotrans: cotransJson
        };
    }

    function mapJsonToPercibido(j) {
        var id  = j.identificacion || {};
        var em  = j.emisor || {};
        var monto = gn(j,'resumen.montoSujetoPercepcion','resumen.totalPagar','resumen.montoTotalOperacion');
        var selloRecepcion = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';
        return {
            nit:     gv(em,'nit','numDocumento') || '',
            dui:     gv(em,'dui') || '',
            fecha:   gv(id,'fecEmi','fechaEmision') || '',
            tipoDoc: gv(id,'tipoDte','tipoDTE') || '08',
            serie:   selloRecepcion,
            numDoc:  codigoGen,
            monto: monto, iva: monto * 0.01
        };
    }

    function mapJsonToAnticipo(j) {
        var id  = j.identificacion || {};
        var em  = j.emisor || {};
        var monto = gn(j,'resumen.montoSujetoAnticipo','resumen.totalPagar','resumen.montoTotalOperacion');
        var selloRecepcion = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';
        return {
            nit:    gv(em,'nit','numDocumento') || '',
            dui:    gv(em,'dui') || '',
            fecha:  gv(id,'fecEmi','fechaEmision') || '',
            serie:  selloRecepcion,
            numDoc: codigoGen,
            monto: monto, iva: monto * 0.02
        };
    }

    function mapJsonToExcluido(j) {
        var id  = j.identificacion || {};
        // En tipoDTE 14 el MH usa la clave "sujetoExcluido" (no "receptor" ni "emisor")
        var suj = j.sujetoExcluido || j.receptor || j.emisor || {};
        // Bug #3: para FSE el monto de operación es sumaVentas/montoTotalOperacion,
        // NO totalPagar (que ya descuenta la retención). Se prioriza el monto bruto.
        var monto = gn(j,'resumen.sumaVentas','resumen.montoTotalOperacion','resumen.montoOperacion','resumen.totalCompra','resumen.totalPagar');
        var selloRecepcion = gv(j,'selloRecibido','selloRecepcion','respuestaMH.selloRecibido','respuestaHacienda.selloRecibido') || buscarClaveProfundo(j,'selloRecibido') || '';
        var codigoGen = gv(id,'codigoGeneracion') || '';
        // Bug #1: mapear código MH de tipoDocumento al código interno (1=NIT, 2=DUI, 3=Otro)
        // El MH usa: 13=NIT, 36=DUI, otros=Otro Documento
        var rawTipoDoc = gv(suj,'tipoDocumento','tipoDoc','codTipoDocumento') || '';
        var tipoDocMapped;
        if (rawTipoDoc === '13' || rawTipoDoc === '1') {
            tipoDocMapped = '1'; // NIT
        } else if (rawTipoDoc === '36' || rawTipoDoc === '2') {
            tipoDocMapped = '2'; // DUI
        } else if (rawTipoDoc !== '') {
            tipoDocMapped = '3'; // Otro Documento
        } else {
            tipoDocMapped = '2'; // Default DUI si no viene el campo
        }

        // ══════════════════════════════════════════════════════════════════
        // CORRECCIÓN 03 — Filtro adicional de validación para el "Tipo de
        // Documento" al importar JSON en el anexo Compras a Sujeto Excluido.
        // Se evalúa el dato de identificación del sujeto excluido contando
        // únicamente sus dígitos numéricos (se ignoran guiones u otros
        // caracteres de formato) y se clasifica así:
        //   - exactamente 14 dígitos numéricos -> Tipo 1 (NIT)
        //   - exactamente 9 dígitos numéricos  -> Tipo 2 (DUI)
        //   - cualquier otro caso (no cumple lo anterior / caracteres o
        //     formatos especiales) -> Tipo 3 (Otro Documento)
        // Este filtro se ejecuta antes de asignar el Tipo de Documento final
        // del registro y tiene prioridad sobre el mapeo por código de MH
        // (rawTipoDoc), por ser más preciso. Solo se conserva el mapeo
        // anterior como respaldo cuando el dato de identificación no trae
        // ningún dígito (campo vacío o no disponible). No se altera ninguna
        // otra lógica de lectura, validación o almacenamiento existente.
        // ══════════════════════════════════════════════════════════════════
        var identValor   = gv(suj,'numDocumento','nit','dui','nrc','documento','numeroDocumento') || '';
        var identSoloNum = identValor.toString().replace(/\D/g, '');
        if (identSoloNum.length === 14) {
            tipoDocMapped = '1'; // NIT
        } else if (identSoloNum.length === 9) {
            tipoDocMapped = '2'; // DUI
        } else if (identSoloNum.length > 0) {
            tipoDocMapped = '3'; // Otro Documento
        }
        // Leer retención directamente del JSON (ivaRete1 o reteRenta).
        // Solo calcular 10% si el documento efectivamente trae un valor > 0 en esos campos.
        var retencionJson =
            parseFloat((j.resumen && (j.resumen.ivaRete1 || j.resumen.reteRenta)) || 0);
        // Si ambos campos vienen en el JSON pero en 0, la retención es 0 (no calcular).
        // Si el campo no existe en absoluto (undefined), se aplica el 10% como fallback.
        var tieneRetencionField =
            (j.resumen && (j.resumen.ivaRete1 !== undefined || j.resumen.reteRenta !== undefined));
        var retencionFinal = tieneRetencionField ? retencionJson : monto * 0.10;
        return {
            tipoDoc:        tipoDocMapped,
            identificacion: identValor,
            nombre:         gv(suj,'nombre','razonSocial','nombreComercial') || '',
            fecha:          gv(id,'fecEmi','fechaEmision') || '',
            serie:          selloRecepcion,
            numDoc:         codigoGen,
            monto: monto, retencion: retencionFinal,
            tipoOp: '1', clasif: '1', sector: '1', tipoCosto: '1'
        };
    }
    // ══════════════════════════════════════════════
    // AGREGADO NUEVO: sincronización Compras → Libro de IVA Percibido
    // ══════════════════════════════════════════════════════════════
    // A partir de los campos "Sello de Recepción" e "IVA Percibido" que ahora
    // forma parte del registro de Compras (llenado manual o vía importación de
    // .json), se crea/actualiza automáticamente el registro correspondiente en
    // el Libro de IVA Percibido (percibidoRecords), evitando digitar dos veces
    // la misma información. La lógica y los cálculos del módulo de Compras no
    // se ven afectados: esta función sólo lee del registro de compra ya
    // construido y escribe en el arreglo independiente percibidoRecords.
    function syncPercibidoFromCompra(cpRecord) {
        var montoIva = parseFloat(cpRecord.ivaPercibido) || 0;
        var idx = -1;
        if (cpRecord._percLinkId) {
            idx = percibidoRecords.findIndex(function(p) { return p._fromCompraLinkId === cpRecord._percLinkId; });
        }
        if (montoIva > 0) {
            if (!cpRecord._percLinkId) {
                cpRecord._percLinkId = 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
            }
            // CORRECCIÓN BUG 01 — Duplicación de IVA Percibido al usar "Recorrer y
            // Actualizar Documentos": si el registro de Compras todavía no tenía
            // _percLinkId (por ejemplo, registros más antiguos guardados antes de
            // que existiera este enlace, o cargados por una vía distinta) pero el
            // documento YA tiene su Percibido registrado en el Anexo 8, no se debe
            // crear un segundo registro. Se busca el registro existente por el
            // identificador único del documento — N° de documento / código de
            // generación, respaldado por Sello de Recepción — nunca por el monto,
            // y solo entre registros que aún no pertenecen a otra compra (que no
            // tengan ya su propio _fromCompraLinkId). Si se encuentra, se adopta
            // (se actualiza y se vincula) en vez de duplicarlo. Si no se
            // encuentra, se agrega normalmente, igual que antes.
            if (idx === -1) {
                var ndCp = normalizeUUID(cpRecord.numDoc || '');
                var selloCp = normalizeUUID(cpRecord.selloRecepcion || '');
                if (ndCp || selloCp) {
                    idx = percibidoRecords.findIndex(function(p) {
                        if (p._fromCompraLinkId) return false;
                        var ndP = normalizeUUID(p.numDoc || '');
                        if (ndCp && ndP && ndP === ndCp) return true;
                        var selloP = normalizeUUID(p.serie || '');
                        if (selloCp && selloP && selloP === selloCp) return true;
                        return false;
                    });
                }
            }
            var montoSujeto = (parseFloat(cpRecord.intGravadas) || 0) + (parseFloat(cpRecord.internGrav) || 0) +
                               (parseFloat(cpRecord.impGrav) || 0) + (parseFloat(cpRecord.impServ) || 0);
            if (montoSujeto <= 0) montoSujeto = montoIva / 0.01;
            var percRecord = {
                nit: cpRecord.nit || '', dui: cpRecord.dui || '', fecha: cpRecord.fecha || '',
                tipoDoc: cpRecord.tipoDoc || '03', serie: cpRecord.selloRecepcion || '',
                numDoc: cpRecord.numDoc || '', monto: montoSujeto, iva: montoIva,
                _fromCompraLinkId: cpRecord._percLinkId
            };
            if (idx !== -1) { percibidoRecords[idx] = percRecord; } else { percibidoRecords.push(percRecord); }
            renderPercibidoTable();
            return true;
        } else {
            if (idx !== -1) { percibidoRecords.splice(idx, 1); renderPercibidoTable(); }
            return false;
        }
    }

    // Buscar nombre de cliente por NIT/DUI/NRC
    function buscarNombreCliente(nitVal) {
        if (!nitVal || !activeEmpresaId) return '';
        var found = buscarClientePorId(nitVal);
        return found ? found.nombre : '';
    }