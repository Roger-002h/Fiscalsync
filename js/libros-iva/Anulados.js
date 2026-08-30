// libros-iva/Anulados.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // ══════════════════════════════════════════════
    // BORRAR LIBRO ESPECÍFICO
    // ══════════════════════════════════════════════
    function borrarLibro(libro, nombreLibro) {
        if (!activeEmpresaId) return;
        var libroMap = {
            debito:    function() { debitoRecords    = []; renderDebitoTable();    },
            cf:        function() { cfRecords         = []; renderCfTable();        },
            compras:   function() { comprasRecords    = []; renderComprasTable();   },
            percibido: function() { percibidoRecords  = []; renderPercibidoTable(); },
            retenido:  function() { retenidoRecords   = []; renderRetenidoTable();  },
            anticipo:  function() { anticipoRecords   = []; renderAnticipoTable();  },
            excluido:  function() { excluidoRecords   = []; renderExcluidoTable();  },
            f14:       function() { f14Records        = []; renderF14Table();       },
            quincena25: function() { quincena25Records = []; renderQuincena25Table(); },
            anulados:  function() { anuladosRecords   = []; renderAnuladosTable();  }
        };
        if (!libroMap[libro]) return;
        fsConfirm('¿Borrar TODOS los registros de ' + nombreLibro + ' de ' + MONTH_NAMES[currentMonth] + ' ' + currentYear + '?\n\nEsta acción no se puede deshacer.', function() {
            libroMap[libro]();
            saveCurrentMonthData();
            updateExportCounts();
            showToast(nombreLibro + ' — registros eliminados', 'success');
        });
    }

    // ══════════════════════════════════════════════
    // DOCUMENTOS ANULADOS / INVALIDADOS CRUD
    // ══════════════════════════════════════════════

    function swAN(p, b) {
        ['an-tab-doc','an-tab-rango'].forEach(function(i) {
            var el = document.getElementById(i);
            if (el) { el.classList.remove('active'); el.style.display = 'none'; }
        });
        ['an-btn-doc','an-btn-rango'].forEach(function(i) {
            document.getElementById(i).classList.remove('active');
        });
        var panel = document.getElementById(p);
        if (panel) { panel.style.display = 'grid'; panel.classList.add('active'); }
        document.getElementById(b).classList.add('active');
    }

    function openAnuladosModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('an_editIndex').value = index;
        document.getElementById('an_num_resolucion').value = '';
        document.getElementById('an_serie_doc').value = '';
        document.getElementById('an_codigo_generacion').value = '';
        document.getElementById('an_desde_preimpreso').value = '0';
        document.getElementById('an_hasta_preimpreso').value = '0';
        document.getElementById('an_desde').value = '0';
        document.getElementById('an_hasta').value = '0';
        document.getElementById('an_clase').value = '4';
        var _anSelND = document.getElementById('an_tipo_doc');
        _anSelND.value = (_anSelND.options.length > 0 && Array.from(_anSelND.options).some(function(o){return o.value==='01';})) ? '01' : (_anSelND.options[0] ? _anSelND.options[0].value : '01');
        document.getElementById('an_tipo_detalle').value = 'A';
        swAN('an-tab-doc','an-btn-doc');
        if (index !== -1) {
            var r = anuladosRecords[index];
            document.getElementById('anuladosModalTitle').innerText = 'Editar Registro — Anulado';
            document.getElementById('an_num_resolucion').value    = r.numResolucion || '';
            document.getElementById('an_clase').value             = r.clase || '4';
            var _anSelED = document.getElementById('an_tipo_doc');
            var _anDefED = (_anSelED.options[0] ? _anSelED.options[0].value : '01');
            _anSelED.value = r.tipoDoc || _anDefED;
            document.getElementById('an_tipo_detalle').value      = r.tipoDetalle || 'A';
            document.getElementById('an_serie_doc').value         = r.serieDoc || '';
            document.getElementById('an_codigo_generacion').value = r.codigoGeneracion || '';
            document.getElementById('an_desde_preimpreso').value  = r.desdePreimpreso || '0';
            document.getElementById('an_hasta_preimpreso').value  = r.hastaPreimpreso || '0';
            document.getElementById('an_desde').value             = r.desde || '0';
            document.getElementById('an_hasta').value             = r.hasta || '0';
        } else {
            document.getElementById('anuladosModalTitle').innerText = 'Nuevo Registro — Anulado';
        }
        _setModalMode('an', index !== -1, anuladosRecords, index);
        document.getElementById('anuladosModalForm').style.display = 'flex';
        document.getElementById('anuladosModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function closeAnuladosModal() {
        _cerrarModalAnimado('anuladosModalForm');
    }

    function navAnuladosRecord(delta) {
        var cur = parseInt(document.getElementById('an_editIndex').value);
        var next = cur + delta;
        if (next < 0 || next >= anuladosRecords.length) return;
        var activeBtn = ['an-btn-doc','an-btn-rango'].find(function(id){ var el=document.getElementById(id); return el && el.classList.contains('active'); });
        var tabMap = {'an-btn-doc':'an-tab-doc','an-btn-rango':'an-tab-rango'};
        saveAnuladosRecord();
        openAnuladosModal(next);
        if (activeBtn && tabMap[activeBtn]) swAN(tabMap[activeBtn], activeBtn);
    }

    function saveAnuladosRecord() {
        var index = document.getElementById('an_editIndex').value;
        var s = function(id) { return document.getElementById(id).value; };
        var r = {
            numResolucion:    s('an_num_resolucion'),
            clase:            s('an_clase'),
            desdePreimpreso:  s('an_desde_preimpreso') || '0',
            hastaPreimpreso:  s('an_hasta_preimpreso') || '0',
            tipoDoc:          s('an_tipo_doc'),
            tipoDetalle:      s('an_tipo_detalle'),
            serieDoc:         s('an_serie_doc'),
            desde:            s('an_desde') || '0',
            hasta:            s('an_hasta') || '0',
            codigoGeneracion: s('an_codigo_generacion'),
            origen:           'manual'
        };
        if (index === '-1') {
            anuladosRecords.push(r);
            saveCurrentMonthData();
            renderAnuladosTable();
            showToast('Registro guardado — listo para el siguiente', 'success');
            openAnuladosModal(-1);
        } else {
            anuladosRecords[index] = r;
            saveCurrentMonthData();
            renderAnuladosTable();
            showToast('Cambios guardados', 'success');
            var pos = document.getElementById('an-nav-pos');
            if (pos) pos.innerText = (parseInt(index) + 1) + ' / ' + anuladosRecords.length;
        }
    }

    function deleteAnuladosRecord(index) {
        fsConfirm('¿Desea eliminar este registro de anulados?', function() {
            anuladosRecords.splice(index, 1);
            saveCurrentMonthData();
            renderAnuladosTable();
        });
    }

    function renderAnuladosTable() {
        var tbody = document.getElementById('anuladosTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        var detalleLabel = { 'A': 'A — Anulado/Invalid.', 'X': 'X — Extraviado', 'D': 'D — DTE Invalidado' };
        var origenColors = { 'manual': 'text-zinc-500', 'debito': 'text-blue-400', 'cf': 'text-emerald-400', 'json': 'text-purple-400', 'excluido': 'text-orange-400' };
        anuladosRecords.forEach(function(r, i) {
            var row = document.createElement('tr');
            row.className = 'border-b border-zinc-900/50 hover:bg-white/5 transition-colors';
            var origenColor = origenColors[r.origen] || 'text-zinc-500';
            var origenLabel = r.origen === 'debito' ? 'CCF' : r.origen === 'cf' ? 'CF' : r.origen === 'excluido' ? 'Excluido' : r.origen === 'json' ? 'JSON' : 'Manual';
            row.innerHTML =
                '<td class="px-4 py-3 text-xs font-mono text-white">' + (r.numResolucion || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.clase) + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + (r.desdePreimpreso || '0') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + (r.hastaPreimpreso || '0') + '</td>' +
                '<td class="px-4 py-3 text-xs text-zinc-500">' + extractNum(r.tipoDoc) + '</td>' +
                '<td class="px-4 py-3 text-xs font-semibold ' + (r.tipoDetalle === 'A' ? 'text-amber-400' : r.tipoDetalle === 'X' ? 'text-rose-400' : 'text-blue-400') + '">' + (detalleLabel[r.tipoDetalle] || r.tipoDetalle) + '</td>' +
                '<td class="px-4 py-3 text-xs">' + (r.serieDoc || '—') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + (r.desde || '0') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono">' + (r.hasta || '0') + '</td>' +
                '<td class="px-4 py-3 text-xs font-mono text-zinc-400" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;" title="' + (r.codigoGeneracion || '') + '">' + (r.codigoGeneracion ? r.codigoGeneracion.substring(0,20) + (r.codigoGeneracion.length > 20 ? '…' : '') : '—') + '</td>' +
                '<td class="px-4 py-3 text-xs ' + origenColor + ' font-semibold">' + origenLabel + '</td>' +
                '<td class="px-4 py-3 text-xs sticky right-0 bg-zinc-950">' +
                '<div class="flex gap-2">' +
                '<button onclick="openAnuladosModal(' + i + ')" class="p-1.5 hover:text-blue-500 transition" title="Editar"><i data-lucide="edit-3" class="w-4"></i></button>' +
                '<button onclick="deleteAnuladosRecord(' + i + ')" class="p-1.5 hover:text-red-500 transition" title="Eliminar"><i data-lucide="trash-2" class="w-4"></i></button>' +
                '</div></td>';
            tbody.appendChild(row);
        });
        lucide.createIcons();
    }

    // ──────────────────────────────────────────────────────────────────
    // isRegistroAnulado — verifica si un registro de débito/CF ya
    // tiene un registro correspondiente en anuladosRecords.
    // USA _id único por registro para evitar anulación masiva por coincidencia parcial.
    // ──────────────────────────────────────────────────────────────────
    function isRegistroAnulado(tipo, index) {
        var _anulablesMap = { debito: debitoRecords, cf: cfRecords, excluido: excluidoRecords };
        var r = _anulablesMap[tipo] ? _anulablesMap[tipo][index] : undefined;
        if (!r) return false;
        // Método primario: _id único asignado al anular
        if (r._id) {
            return anuladosRecords.some(function(a) {
                return a._registroId === r._id;
            });
        }
        // Fallback para registros antiguos sin _id: usar codigoGeneracion UUID (único por documento)
        var codigoGenReg = tipo === 'cf' ? (r.docDel || r.numDoc || '') : (r.numDoc || '');
        // Solo hacer match si el código tiene formato UUID (largo > 10 chars) para evitar falsos positivos
        if (codigoGenReg && codigoGenReg.length > 10) {
            return anuladosRecords.some(function(a) {
                return a.origen === tipo && a.codigoGeneracion === codigoGenReg && a.codigoGeneracion.length > 10;
            });
        }
        // Para registros manuales sin _id: match estricto por origen + codigoGeneracion (campo dedicado)
        return anuladosRecords.some(function(a) {
            if (a.origen !== tipo) return false;
            if (!a._registroId) return false; // Sin _id en el registro anulado, no hacer match por campos ambiguos
            return false;
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // toggleAnulado — si ya está anulado lo des-anula (elimina de
    // anuladosRecords), si no, lo anula (agrega a anuladosRecords).
    // USA _id único para evitar anulación/desanulación masiva.
    // ──────────────────────────────────────────────────────────────────
    function _getAnulableArray(tipo) {
        if (tipo === 'debito') return debitoRecords;
        if (tipo === 'cf') return cfRecords;
        if (tipo === 'excluido') return excluidoRecords;
        return null;
    }
    function _renderAnulableTable(tipo) {
        if (tipo === 'debito') renderDebitoTable();
        else if (tipo === 'cf') renderCfTable();
        else if (tipo === 'excluido') renderExcluidoTable();
    }
    function toggleAnulado(tipo, index) {
        var arr = _getAnulableArray(tipo);
        var r = arr ? arr[index] : undefined;
        if (!r) return;

        // Asignar _id único al registro si no tiene uno
        if (!r._id) {
            r._id = tipo + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            arr[index] = r;
        }

        // Buscar registro anulado vinculado a este _id específico
        var anuIdx = -1;
        for (var i = 0; i < anuladosRecords.length; i++) {
            var a = anuladosRecords[i];
            if (a._registroId === r._id) { anuIdx = i; break; }
        }

        if (anuIdx !== -1) {
            // Des-anular: eliminar solo el registro vinculado a este _id
            anuladosRecords.splice(anuIdx, 1);
            saveCurrentMonthData();
            renderAnuladosTable();
            _renderAnulableTable(tipo);
            showToast('Documento des-anulado correctamente', 'success');
        } else {
            // Anular
            reportarComoAnulado(tipo, index);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // reportarComoAnulado — genera un registro en anuladosRecords
    // a partir de un registro existente de débito (CCF) o CF.
    // Incluye _registroId para vinculación unívoca.
    // ──────────────────────────────────────────────────────────────────
    function reportarComoAnulado(tipo, index) {
        var r, origen, esDTE;
        var arr = _getAnulableArray(tipo);
        r = arr ? arr[index] : undefined;
        origen = tipo;
        if (!r) return;

        // Asignar _id único al registro si no tiene uno
        if (!r._id) {
            r._id = tipo + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            arr[index] = r;
        }

        // Para CF: el código de generación DTE viene en docDel (no numDoc)
        // Para débito: viene en numDoc
        var codigoGen = tipo === 'cf' ? (r.docDel || r.numDoc || '') : (r.numDoc || '');

        // Detectar si es DTE: clase === '4' o codigoGeneracion tiene longitud de UUID (>10 chars)
        esDTE = (String(r.clase) === '4') || !!(codigoGen && codigoGen.length > 10);

        // CORRECCIÓN 01 — Compras a Sujeto Excluido:
        // - Tipo de Documento debe ser siempre '14' (en excluido, r.tipoDoc
        //   guarda el tipo de identificación del sujeto -NIT/DUI/Otro-, no el
        //   tipo de documento DTE, por eso no se puede usar r.tipoDoc aquí).
        // - N° Resolución / N° Control debe tomarse de la Serie del Documento
        //   del registro original de Sujeto Excluido (r.serie), ya que este
        //   anexo no maneja un campo "resolucion".
        var tipoDocAnulado = (tipo === 'excluido')
            ? '14'
            : (r.tipoDoc || (tipo === 'debito' ? '03' : '01'));
        var numResolucionAnulado = (tipo === 'excluido')
            ? (r.serie || '')
            : (r.resolucion || '');

        var anulado;
        if (esDTE) {
            // Caso 01: documento electrónico (DTE)
            anulado = {
                numResolucion:    tipo === 'excluido' ? numResolucionAnulado : (r.resolucion || r.ctrlDel || ''),
                clase:            r.clase || '4',
                desdePreimpreso:  '0',
                hastaPreimpreso:  '0',
                tipoDoc:          tipoDocAnulado,
                tipoDetalle:      'D',
                serieDoc:         r.serie || '',
                desde:            '0',
                hasta:            '0',
                codigoGeneracion: codigoGen,
                origen:           origen,
                _registroId:      r._id
            };
        } else {
            // Caso 02: documento manual / preimpreso
            anulado = {
                numResolucion:    numResolucionAnulado,
                clase:            r.clase || '1',
                desdePreimpreso:  tipo === 'cf' ? (r.ctrlDel || r.docDel || '') : (tipo === 'excluido' ? (r.numDoc || '') : ''),
                hastaPreimpreso:  tipo === 'cf' ? (r.ctrlAl  || r.docAl  || '') : (tipo === 'excluido' ? (r.numDoc || '') : ''),
                tipoDoc:          tipoDocAnulado,
                tipoDetalle:      'A',
                serieDoc:         r.serie || '',
                desde:            tipo === 'cf' ? (r.docDel || '') : (r.numDoc || ''),
                hasta:            tipo === 'cf' ? (r.docAl  || '') : (r.numDoc || ''),
                codigoGeneracion: '',
                origen:           origen,
                _registroId:      r._id
            };
        }

        anuladosRecords.push(anulado);
        saveCurrentMonthData();
        renderAnuladosTable();
        _renderAnulableTable(tipo);
        showToast('Documento marcado como anulado', 'success');
    }