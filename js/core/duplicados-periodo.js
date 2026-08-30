// core/duplicados-periodo.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // Genera una clave de fingerprint para detectar duplicados exactos
    // El campo numDoc/serie/docDel/docAl se normaliza para UUID
    function docFingerprint(libro, r) {
        var nd  = normalizeUUID(r.numDoc  || '');
        var sr  = normalizeUUID(r.serie   || '');
        var dd  = normalizeUUID(r.docDel  || '');
        var da  = normalizeUUID(r.docAl   || '');
        var res = normalizeUUID(r.resolucion || '');
        if (libro === 'debito')    return [r.fecha,r.clase,r.tipoDoc,nd,r.nit,r.nombre,String(r.gravadas),String(r.iva),String(r.total)].join('|');
        if (libro === 'cf')        return [r.fecha,r.clase,r.tipoDoc,dd,da,res,sr,String(r.gravadas),String(r.total)].join('|');
        if (libro === 'compras')   return [r.fecha,r.clase,r.tipoDoc,nd,r.nit,r.nombre,String(r.intGravadas),String(r.credito),String(r.total)].join('|');
        if (libro === 'percibido') return [r.fecha,r.tipoDoc,nd,r.nit,String(r.monto),String(r.iva)].join('|');
        if (libro === 'retenido')  return [r.fecha,r.tipoDoc,nd,r.nit,String(r.monto),String(r.iva)].join('|');
        if (libro === 'anticipo')  return [r.fecha,nd,r.nit,String(r.monto),String(r.iva)].join('|');
        if (libro === 'excluido')  return [r.fecha,r.tipoDoc,nd,r.identificacion,String(r.monto)].join('|');
        if (libro === 'f14')       return [r.nombre,r.nit,r.periodo,String(r.devengado),String(r.retenido)].join('|');
        if (libro === 'quincena25') return [r.nombre,r.nit,r.dui,r.periodo,String(r.montoQuincena)].join('|');
        return JSON.stringify(r);
    }

    // ══════════════════════════════════════════════════════════════════
    // DETECCIÓN CROSS-MESES: construye un Set de codigosGen normalizados
    // de todos los meses guardados para la empresa activa, excluyendo
    // el mes actual (que se compara aparte dentro del mismo array).
    // Retorna un Map: normalizedCode → 'MesNombre YYYY'
    // ══════════════════════════════════════════════════════════════════
    function buildCrossMonthIndex(libroKey) {
        var index = {};   // normalizedCode → 'Enero 2025'
        if (!activeEmpresaId) return index;
        var prefix = 'fs_data_v' + APP_VERSION + '_' + activeEmpresaId + '_';
        var currentKey = monthKey(activeEmpresaId, currentYear, currentMonth);
        var len = fsStore.length();
        for (var i = 0; i < len; i++) {
            var k = fsStore.key(i);
            if (!k || k.indexOf(prefix) !== 0) continue;
            if (k === currentKey) continue; // excluir mes activo
            // Extraer año y mes del key: prefix + YYYY_MM
            var suffix = k.slice(prefix.length); // ej: '2025_01'
            var parts = suffix.split('_');
            if (parts.length < 2) continue;
            var yr = parseInt(parts[0]);
            var mo = parseInt(parts[1]);
            if (isNaN(yr) || isNaN(mo)) continue;
            var label = MONTH_NAMES[mo] + ' ' + yr;
            try {
                var raw = fsStore.getItem(k);
                if (!raw) continue;
                var data = JSON.parse(raw);
                var records = data[libroKey] || [];
                records.forEach(function(r) {
                    // Extraer todos los campos que pueden contener el UUID
                    var candidates = [r.numDoc, r.serie, r.docDel, r.docAl, r.resolucion, r.codigoGen];
                    candidates.forEach(function(c) {
                        if (!c) return;
                        var norm = normalizeUUID(c);
                        if (norm.length >= 32) {  // longitud mínima de UUID sin guiones
                            if (!index[norm]) index[norm] = label;
                        }
                    });
                });
            } catch(e) { /* ignorar mes corrupto */ }
        }
        return index;
    }

    // ══════════════════════════════════════════════════════════════════
    // CAMBIO 02 / CAMBIO 03 — VALIDACIÓN GLOBAL DE DOCUMENTOS DUPLICADOS
    // Amplía la misma lógica de comparación (docFingerprint) que el sistema
    // ya utilizaba únicamente para los documentos importados desde .JSON,
    // para que también bloquee duplicados al importar desde .CSV y al
    // registrar documentos manualmente, en todos los libros del sistema.
    // La validación revisa tanto el período activo (arreglo en memoria)
    // como el resto de los períodos guardados para la empresa activa.
    // ══════════════════════════════════════════════════════════════════
    function _fingerprintEnArray(libro, fp, arr, skipIndex) {
        for (var i = 0; i < arr.length; i++) {
            if (skipIndex !== null && skipIndex !== undefined && i === skipIndex) continue;
            if (docFingerprint(libro, arr[i]) === fp) return true;
        }
        return false;
    }

    // Revisa si el fingerprint ya existe en algún otro período guardado
    // (distinto al mes/año activo) para la empresa activa. Reutiliza el
    // mismo recorrido de claves fs_data_v... que ya usa buildCrossMonthIndex().
    function _buscarDuplicadoOtrosPeriodos(libroKey, fp) {
        if (!activeEmpresaId) return '';
        var prefix = 'fs_data_v' + APP_VERSION + '_' + activeEmpresaId + '_';
        var currentKey = monthKey(activeEmpresaId, currentYear, currentMonth);
        var len = fsStore.length();
        for (var i = 0; i < len; i++) {
            var k = fsStore.key(i);
            if (!k || k.indexOf(prefix) !== 0) continue;
            if (k === currentKey) continue; // el período activo ya se revisa aparte
            var suffix = k.slice(prefix.length);
            var parts = suffix.split('_');
            if (parts.length < 2) continue;
            var yr = parseInt(parts[0]);
            var mo = parseInt(parts[1]);
            if (isNaN(yr) || isNaN(mo)) continue;
            try {
                var raw = fsStore.getItem(k);
                if (!raw) continue;
                var data = JSON.parse(raw);
                var records = data[libroKey] || [];
                for (var j = 0; j < records.length; j++) {
                    if (docFingerprint(libroKey, records[j]) === fp) {
                        return MONTH_NAMES[mo] + ' ' + yr;
                    }
                }
            } catch(e) { /* ignorar período corrupto */ }
        }
        return '';
    }

    // Punto único de validación: retorna null si NO es duplicado, o un texto
    // describiendo el período donde se encontró el duplicado (para informar
    // al usuario). arrActual = arreglo en memoria del libro activo (p.ej.
    // comprasRecords). skipIndex = índice a excluir de la comparación (se usa
    // al editar un registro existente, para no compararlo contra sí mismo).
    function esDocumentoDuplicado(libroKey, record, arrActual, skipIndex) {
        var fp = docFingerprint(libroKey, record);
        if (_fingerprintEnArray(libroKey, fp, arrActual, skipIndex)) {
            return MONTH_NAMES[currentMonth] + ' ' + currentYear;
        }
        var otroPeriodo = _buscarDuplicadoOtrosPeriodos(libroKey, fp);
        if (otroPeriodo) return otroPeriodo;
        return null;
    }

    function esNotaCredito(tipoDoc) {
        var t = extractNum(tipoDoc);
        return t === '05' || t === '5';
    }

    function detectDocType(json) {
        var t = (
            (json.identificacion && json.identificacion.tipoDte) ||
            (json.identificacion && json.identificacion.tipoDTE) ||
            json.tipoDte ||
            json.tipoDTE ||
            json.dteType ||
            json.tipo_dte ||
            ''
        ).toString().trim();

        var map = {
            '01': 'Factura CF',
            '02': 'Fac. Simplificada',
            '03': 'CCF',
            '04': 'Nota Remisión',
            '05': 'Nota Crédito',
            '06': 'Nota Débito',
            '07': 'Comp.Retención',
            '08': 'Comp.Liquidación',
            '09': 'Doc.Cont.Liquidación',
            '11': 'Fac. Exportación',
            '14': 'Fac.Sujeto Excluido',
            '15': 'Comp.Donación'
        };
        return map[t] || (t ? 'Tipo ' + t : 'Sin tipo');
    }