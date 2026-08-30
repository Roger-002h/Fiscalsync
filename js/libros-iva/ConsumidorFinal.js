// libros-iva/ConsumidorFinal.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    // Combina el resultado de la consulta pública + si la venta es exenta o
    // no (elegido en el teléfono), y GUARDA DIRECTO el registro en el Libro
    // de Ventas — Consumidor Final (Anexo 2), sin abrir el modal "Nuevo
    // Registro — Consumidor Final". Mapeo (ver detalle acordado):
    //   Tipo de DTE (Factura/Nota de Crédito) -> Tipo de Documento (01/05)
    //   Fecha y Hora de Generación             -> Fecha de Emisión
    //   Número de Control                      -> N° Resolución, Control Interno DEL y AL
    //   Sello de Recepción                     -> Serie de Documento
    //   Código de Generación                   -> N° Documento DEL y AL
    //   Monto Total de la Operación            -> Ventas Gravadas Locales (o Ventas
    //                                              Exentas si el usuario marcó "exenta"
    //                                              en el teléfono antes de enviar)
    // Cambio 03: ya no se guarda automáticamente ni se decide "exenta" en el
    // teléfono. Se abre el modal "Nuevo Registro — Consumidor Final" con los
    // datos del documento precargados (el monto se coloca por defecto en
    // "Ventas Gravadas" — si la venta escaneada era exenta, el usuario mueve
    // el monto al campo "Exentas" del propio modal antes de confirmar, tal
    // como ya lo haría con un registro manual). El usuario confirma con el
    // mismo botón "Guardar" del modal.
    // Corrección 01: ya no se abre el modal "Nuevo Registro — Consumidor
    // Final" — se abre la pantalla independiente "Documentos Escaneados".
    function _autocompletarVentaCFDesdeQR(combinado) {
        if (!combinado) return;
        if (_rechazarEscaneoSinEmpresaActiva()) return;

        // Corrección Bug 01 (se mantiene): mismo criterio que en Compras.
        var _dupPeriodoCf = _codigoGenYaExisteEnLibro('cf', normalizeUUID(combinado.codGen || ''), cfRecords);
        if (_dupPeriodoCf) {
            showToast('Documento ya procesado.', 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: 'Documento ya procesado.' });
            }
            return;
        }

        // Cambio 03 — Control de tipos de documento permitidos por módulo.
        if (!qrScanTipoPermitido('cf', combinado.tipoDteTexto)) {
            var _msgTipoCf = 'Este tipo de documento (' + (combinado.tipoDteTexto || combinado.tipoDocMapeado) + ') no está permitido para escaneo en Ventas — Consumidor Final — revísalo en Admin › Escaneo QR.';
            showToast(_msgTipoCf, 'error');
            if (window.qrScan && window.qrScan.reportarResultado) {
                window.qrScan.reportarResultado({ ok: false, mensaje: _msgTipoCf });
            }
            return;
        }

        // Cambio 05 — Modo Admin "Resumen de Escaneo": en la PC
        // (comportamiento de siempre) o en el teléfono vinculado.
        if (resumenEscaneoModoLoad() === 'celular') {
            _enviarResumenACelular('cf', combinado);
        } else {
            openQrDocModal('cf', combinado);
        }
    }