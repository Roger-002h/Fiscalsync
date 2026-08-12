// ══════════════════════════════════════════════════════════════════════
// app.js — Página servida al teléfono (Cambio 01 — Escaneo QR)
// Sin dependencias externas salvo jsqr.min.js (vendorizado, 100% offline).
// ══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var HOST_VALIDO = 'admin.factura.gob.sv';

  var els = {
    connDot: document.getElementById('connDot'),
    connSub: document.getElementById('connSub'),
    connTitle: document.getElementById('connTitle'),
    connHint: document.getElementById('connHint'),
    screenConnecting: document.getElementById('screenConnecting'),
    screenReady: document.getElementById('screenReady'),
    screenCamera: document.getElementById('screenCamera'),
    screenDocumento: document.getElementById('screenDocumento'),
    screenVentaCF: document.getElementById('screenVentaCF'),
    screenDocumentoCCF: document.getElementById('screenDocumentoCCF'),
    screenProcesando: document.getElementById('screenProcesando'),
    screenResultado: document.getElementById('screenResultado'),
    empresaBar: document.getElementById('empresaBar'),
    empresaBarNombre: document.getElementById('empresaBarNombre'),
    btnEscanearCompra: document.getElementById('btnEscanearCompra'),
    btnEscanearCF: document.getElementById('btnEscanearCF'),
    btnEscanearCCF: document.getElementById('btnEscanearCCF'),
    btnEscanearRetencion: document.getElementById('btnEscanearRetencion'),
    btnEscanearExcluido: document.getElementById('btnEscanearExcluido'),
    docDetectadoTitulo: document.getElementById('docDetectadoTitulo'),
    btnCancelarCamara: document.getElementById('btnCancelarCamara'),
    video: document.getElementById('video'),
    docCodGen: document.getElementById('docCodGen'),
    docFecha: document.getElementById('docFecha'),
    provSearch: document.getElementById('provSearch'),
    provResults: document.getElementById('provResults'),
    btnProvNuevo: document.getElementById('btnProvNuevo'),
    provNuevoForm: document.getElementById('provNuevoForm'),
    pnNombre: document.getElementById('pnNombre'),
    pnNit: document.getElementById('pnNit'),
    pnNrc: document.getElementById('pnNrc'),
    pnDui: document.getElementById('pnDui'),
    pnClasifSection: document.getElementById('pnClasifSection'),
    pnClasif: document.getElementById('pnClasif'),
    pnSector: document.getElementById('pnSector'),
    pnTipoCosto: document.getElementById('pnTipoCosto'),
    pnExcluidoFields: document.getElementById('pnExcluidoFields'),
    pnTipoDocEx: document.getElementById('pnTipoDocEx'),
    pnTipoOpEx: document.getElementById('pnTipoOpEx'),
    btnPnConfirmar: document.getElementById('btnPnConfirmar'),
    provElegido: document.getElementById('provElegido'),
    provElegidoTxt: document.getElementById('provElegidoTxt'),
    provElegidoClasif: document.getElementById('provElegidoClasif'),
    btnEditarProveedor: document.getElementById('btnEditarProveedor'),
    provEditarForm: document.getElementById('provEditarForm'),
    peNombre: document.getElementById('peNombre'),
    peNit: document.getElementById('peNit'),
    peNrc: document.getElementById('peNrc'),
    peDui: document.getElementById('peDui'),
    peClasif: document.getElementById('peClasif'),
    peSector: document.getElementById('peSector'),
    peTipoCosto: document.getElementById('peTipoCosto'),
    btnPeCancelar: document.getElementById('btnPeCancelar'),
    btnPeGuardar: document.getElementById('btnPeGuardar'),
    btnConfirmarDocumento: document.getElementById('btnConfirmarDocumento'),
    btnCancelarDocumento: document.getElementById('btnCancelarDocumento'),
    docCfCodGen: document.getElementById('docCfCodGen'),
    docCfFecha: document.getElementById('docCfFecha'),
    swExentaCf: document.getElementById('swExentaCf'),
    btnConfirmarVentaCF: document.getElementById('btnConfirmarVentaCF'),
    btnCancelarVentaCF: document.getElementById('btnCancelarVentaCF'),
    ccfDocCodGen: document.getElementById('ccfDocCodGen'),
    ccfDocFecha: document.getElementById('ccfDocFecha'),
    clienteSearch: document.getElementById('clienteSearch'),
    clienteResults: document.getElementById('clienteResults'),
    btnClienteNuevo: document.getElementById('btnClienteNuevo'),
    clienteNuevoForm: document.getElementById('clienteNuevoForm'),
    cnNombre: document.getElementById('cnNombre'),
    cnNit: document.getElementById('cnNit'),
    cnNrc: document.getElementById('cnNrc'),
    cnTipoOp: document.getElementById('cnTipoOp'),
    cnTipoIng: document.getElementById('cnTipoIng'),
    btnCnConfirmar: document.getElementById('btnCnConfirmar'),
    clienteElegido: document.getElementById('clienteElegido'),
    clienteElegidoTxt: document.getElementById('clienteElegidoTxt'),
    clienteElegidoClasif: document.getElementById('clienteElegidoClasif'),
    btnEditarCliente: document.getElementById('btnEditarCliente'),
    clienteEditarForm: document.getElementById('clienteEditarForm'),
    ceNombre: document.getElementById('ceNombre'),
    ceNit: document.getElementById('ceNit'),
    ceNrc: document.getElementById('ceNrc'),
    ceTipoOp: document.getElementById('ceTipoOp'),
    ceTipoIng: document.getElementById('ceTipoIng'),
    btnCeCancelar: document.getElementById('btnCeCancelar'),
    btnCeGuardar: document.getElementById('btnCeGuardar'),
    swExentaCcf: document.getElementById('swExentaCcf'),
    btnConfirmarCCF: document.getElementById('btnConfirmarCCF'),
    btnCancelarCCF: document.getElementById('btnCancelarCCF'),
    resTitulo: document.getElementById('resTitulo'),
    resMensaje: document.getElementById('resMensaje'),
    btnOtroDocumento: document.getElementById('btnOtroDocumento'),
    toast: document.getElementById('toast')
  };

  var ws = null;
  var proveedores = [];
  var clientes = [];
  var empresaNombre = '';
  // Etiquetas de clasificación de Proveedores (config. de la empresa activa en FiscalSync,
  // se recibe con el catálogo — ver 'catalogo-proveedores'), solo para mostrarla.
  var clasifLabels = {};
  // Cambio 01 (ampliación): etiquetas de Sector y Tipo de Costo/Gasto de Proveedores
  // (mismo origen y propósito que clasifLabels — config. de la empresa activa,
  // solo para mostrar/editar con el mismo texto que usa el programa).
  var sectorLabels = {};
  var costoLabels = {};
  // Etiquetas de clasificación de Clientes (Tipo de Operación / Tipo de Ingreso — Crédito
  // Fiscal). Son fijas en FiscalSync (no configurables por empresa), solo para mostrarlas.
  var TIPOOP_LABELS = {
    '0': '0 — Periodo Anterior Enero 2025',
    '1': '1 — Gravada',
    '2': '2 — No Gravada o Exento',
    '3': '3 — Excluido o no Constituye Renta',
    '4': '4 — Mixta (gravada y exenta)',
    '12': '12 — Ingresos sujetos de retención en F910',
    '13': '13 — Sujetos pasivos excluidos / no hecho generador ISR'
  };
  var TIPOING_LABELS = {
    '1': '1 — Profesiones, Artes y Oficios',
    '2': '2 — Actividades de Servicios',
    '3': '3 — Actividades Comerciales',
    '4': '4 — Actividades Industriales',
    '5': '5 — Actividades Agropecuarias',
    '6': '6 — Utilidades y Dividendos',
    '7': '7 — Exportaciones de bienes',
    '8': '8 — Servicios Realizados en el Exterior',
    '9': '9 — Exportaciones de servicios',
    '10': '10 — Otras Rentas Gravables',
    '12': '12 — Ingresos sujetos de retención en F910'
  };
  var modoActual = 'compras';  // 'compras' | 'cf' | 'ccf' | 'retencion' | 'excluido' — libro destino del escaneo actual
  var qrActual = null;        // { ambiente, codGen, fechaEmi }

  // Corrección Bug 02: el catálogo de proveedores puede reenviarse desde
  // FiscalSync en cualquier momento (por ejemplo, al agregar/editar un
  // proveedor durante el guardado de un documento), no solo al conectar.
  // Antes, CADA mensaje 'catalogo-proveedores' forzaba mostrarPantalla('screenReady'),
  // así que un reenvío de catálogo que llegaba mientras el teléfono mostraba
  // "Consultando…" o "Documento cargado" hacía que esas pantallas se saltaran
  // o desaparecieran de inmediato. Con esta bandera solo se navega a
  // "screenReady" la PRIMERA vez que llega el catálogo (justo después de
  // conectar) — los reenvíos posteriores solo actualizan los datos en memoria,
  // sin tocar qué pantalla está visible. No cambia la lógica de consulta ni
  // de procesamiento del documento, solo la transición de pantallas.
  var catalogoInicialRecibido = false;

  // ── Cambio 04: Catálogo de Proveedores — clasificación por anexo de uso ──
  // Mismo campo `usos` (array: 'compras' | 'retenido' | 'excluido') que usa el
  // catálogo de Proveedores en FiscalSync (escritorio). El teléfono reutiliza
  // los mismos proveedores que llegan en 'catalogo-proveedores' (ver
  // manejarMensaje) y los filtra según el libro que se está escaneando, para
  // que cada pantalla muestre únicamente los proveedores que correspondan.
  // Un proveedor sin `usos` guardado (creado antes de este cambio) se trata
  // como "Compras" — misma regla de compatibilidad retroactiva que usa el
  // escritorio (ver proveedorUsosEfectivos en index.html).
  var MODO_A_USO = { compras: 'compras', retencion: 'retenido', excluido: 'excluido' };
  function proveedorUsosEfectivos(p) {
    if (!p) return [];
    return (p.usos && p.usos.length) ? p.usos : ['compras'];
  }
  function proveedorTieneUso(p, uso) {
    return !uso || proveedorUsosEfectivos(p).indexOf(uso) !== -1;
  }
  var proveedorElegido = null; // { esNuevo, nit, nrc, dui, nombre }
  var clienteSeleccionado = null; // { esNuevo, nit, nrc, nombre } — solo para modo 'ccf'
  var streamCamara = null;
  var loopId = null;
  var reconectando = false;

  // Punto 3: refleja la empresa activa en la barra persistente del header,
  // visible en TODAS las pantallas (conectando, listo, cámara, documento,
  // consultando, resultado) para evitar subir documentos a la empresa
  // incorrecta. Se actualiza sola cada vez que llega un catálogo nuevo,
  // que es como FiscalSync avisa al teléfono de un cambio de empresa.
  function actualizarEmpresaActiva() {
    if (!els.empresaBar || !els.empresaBarNombre) return;
    if (empresaNombre) {
      els.empresaBarNombre.textContent = empresaNombre;
      els.empresaBar.classList.remove('hidden');
    } else {
      els.empresaBar.classList.add('hidden');
    }
  }

  function showToast(msg, tipo) {
    els.toast.textContent = msg;
    els.toast.className = 'toast show' + (tipo ? ' ' + tipo : '');
    setTimeout(function () { els.toast.className = 'toast'; }, 3200);
  }

  function mostrarPantalla(id) {
    ['screenConnecting', 'screenReady', 'screenCamera', 'screenDocumento', 'screenVentaCF', 'screenDocumentoCCF', 'screenProcesando', 'screenResultado']
      .forEach(function (key) {
        els[key].classList.toggle('hidden', key !== id);
      });
  }

  // CAMBIO — Validación de Empresa Activa en Escaneo QR: pantalla "Sin
  // Empresa Activa" ya existente (reutiliza screenConnecting + los textos
  // de connTitle/connHint). Antes este patrón solo se disparaba cuando el
  // escritorio CAMBIABA de empresa con el módulo ya abierto (ver
  // esCambioDeEmpresa en manejarMensaje); se centraliza aquí para poder
  // reutilizarlo TAMBIÉN en la conexión inicial, sin duplicar lógica ni
  // crear una pantalla nueva.
  function _mostrarSinEmpresaActiva() {
    mostrarPantalla('screenConnecting');
    els.connTitle.textContent = 'Sin empresa activa';
    els.connHint.textContent = 'Selecciona una empresa en FiscalSync para poder escanear documentos.';
  }

  // ── Conexión WebSocket ──────────────────────────────────────────────
  function obtenerToken() {
    var params = new URLSearchParams(location.search);
    return params.get('t') || '';
  }

  function conectar() {
    var token = obtenerToken();
    if (!token) {
      els.connTitle.textContent = 'Enlace inválido';
      els.connHint.textContent = 'Vuelve a escanear el código QR de vinculación desde FiscalSync.';
      return;
    }

    // Cada conexión nueva empieza sin catálogo recibido todavía, para que
    // la primera 'catalogo-proveedores' de ESTA conexión vuelva a llevar a
    // "screenReady" (p. ej. tras una reconexión) — ver Corrección Bug 02.
    catalogoInicialRecibido = false;

    ws = new WebSocket('wss://' + location.host + '/ws');

    ws.onopen = function () {
      ws.send(JSON.stringify({ tipo: 'auth', token: token }));
    };

    ws.onclose = function (ev) {
      els.connDot.className = 'dot off';
      els.connSub.textContent = 'Desconectado';
      mostrarPantalla('screenConnecting');
      if (ev.code === 4001 || ev.code === 4002) {
        els.connTitle.textContent = 'Vinculación expirada';
        els.connHint.textContent = 'Cierra esta página y vuelve a escanear el QR desde FiscalSync.';
        return;
      }
      els.connTitle.textContent = 'Conexión perdida';
      els.connHint.textContent = 'Intentando reconectar…';
      if (!reconectando) {
        reconectando = true;
        setTimeout(function () { reconectando = false; conectar(); }, 2000);
      }
    };

    ws.onerror = function () { /* onclose se dispara igual */ };

    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      manejarMensaje(msg);
    };
  }

  function manejarMensaje(msg) {
    if (msg.tipo === 'auth-ok') {
      els.connDot.className = 'dot on';
      els.connSub.textContent = 'Conectado';
      return;
    }
    if (msg.tipo === 'catalogo-proveedores') {
      // CAMBIO — Actualización dinámica de empresa: distingue un CAMBIO DE
      // EMPRESA real (el escritorio entró a otra empresa, o volvió a la
      // pantalla de selección sin ninguna activa) de un simple refresco del
      // catálogo de la MISMA empresa (p. ej. se agregó un proveedor nuevo
      // mientras se procesaba un documento). Solo en el primer caso se debe
      // interrumpir cualquier flujo en curso, para no dejar mezclar datos
      // (proveedor/cliente elegido, cámara abierta) de la empresa anterior
      // con un documento que termine guardándose en la empresa nueva.
      var empresaNueva = msg.empresa || '';
      var esCambioDeEmpresa = catalogoInicialRecibido && empresaNueva !== empresaNombre;

      proveedores = Array.isArray(msg.proveedores) ? msg.proveedores : [];
      empresaNombre = empresaNueva;
      clasifLabels = (msg.clasifLabels && typeof msg.clasifLabels === 'object') ? msg.clasifLabels : {};
      sectorLabels = (msg.sectorLabels && typeof msg.sectorLabels === 'object') ? msg.sectorLabels : {};
      costoLabels = (msg.costoLabels && typeof msg.costoLabels === 'object') ? msg.costoLabels : {};
      poblarSelectClasif();
      poblarSelectGenerico(els.pnSector, sectorLabels);
      poblarSelectGenerico(els.pnTipoCosto, costoLabels);
      poblarSelectGenerico(els.peClasif, clasifLabels);
      poblarSelectGenerico(els.peSector, sectorLabels);
      poblarSelectGenerico(els.peTipoCosto, costoLabels);
      actualizarEmpresaActiva();

      if (esCambioDeEmpresa) {
        // Corta cualquier flujo en curso que dependiera de la empresa
        // anterior (cámara abierta, proveedor/cliente ya elegido, formulario
        // de "nuevo proveedor/cliente" a medio llenar) y regresa a la
        // pantalla principal con los datos de la empresa nueva.
        cerrarCamara();
        proveedorElegido = null;
        clienteSeleccionado = null;
        if (empresaNombre) {
          mostrarPantalla('screenReady');
          showToast('Empresa activa cambiada a: ' + empresaNombre, 'ok');
        } else {
          _mostrarSinEmpresaActiva();
        }
        return;
      }

      // Corrección Bug 02: solo se navega la primera vez que llega el
      // catálogo tras conectar. Los reenvíos posteriores del mismo catálogo
      // de la MISMA empresa (p. ej. al agregar/editar un proveedor mientras
      // se guarda un documento) solo deben refrescar los datos, sin
      // interrumpir la pantalla de "Consultando…" o "Documento cargado" que
      // el usuario esté viendo.
      //
      // CAMBIO — Validación de Empresa Activa en Escaneo QR: en esta primera
      // llegada de catálogo (justo al conectar desde Pantalla Principal) se
      // valida si hay empresa activa. Antes se navegaba siempre a
      // "screenReady" sin importar si empresaNombre venía vacío, permitiendo
      // escanear sin ninguna empresa seleccionada. Ahora, si no hay empresa
      // activa, se muestra la MISMA pantalla "Sin Empresa Activa" ya usada
      // arriba para el cambio de empresa (misma función, mismo
      // comportamiento). Si el usuario luego entra a una empresa en el
      // escritorio, _sincronizarEmpresaActivaQR() reenvía el catálogo y el
      // bloque esCambioDeEmpresa de arriba se encarga de pasar a
      // "screenReady" con normalidad.
      if (!catalogoInicialRecibido) {
        catalogoInicialRecibido = true;
        if (empresaNombre) {
          mostrarPantalla('screenReady');
        } else {
          _mostrarSinEmpresaActiva();
        }
      }
      return;
    }
    if (msg.tipo === 'catalogo-clientes') {
      clientes = Array.isArray(msg.clientes) ? msg.clientes : [];
      return;
    }
    if (msg.tipo === 'recibido') {
      mostrarPantalla('screenProcesando');
      return;
    }
    if (msg.tipo === 'resultado-documento') {
      els.resTitulo.innerHTML = msg.ok
        ? 'Documento cargado <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-left:2px;"><polyline points="20 6 9 17 4 12"/></svg>'
        : 'No se pudo procesar';
      els.resMensaje.textContent = msg.mensaje || (msg.ok
        ? 'Revisa y guarda el registro en la computadora.'
        : 'Intenta de nuevo o cárgalo manualmente en FiscalSync.');
      mostrarPantalla('screenResultado');
      return;
    }
  }

  // ── Cámara + lectura de QR ──────────────────────────────────────────
  function abrirCamara() {
    mostrarPantalla('screenCamera');

    var constraintsAlta = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        advanced: [{ focusMode: 'continuous' }]
      }
    };
    var constraintsBasica = { video: { facingMode: 'environment' } };

    navigator.mediaDevices.getUserMedia(constraintsAlta)
      .catch(function () {
        // Si el dispositivo no soporta las restricciones avanzadas, se reintenta con lo básico.
        return navigator.mediaDevices.getUserMedia(constraintsBasica);
      })
      .then(function (stream) {
        streamCamara = stream;
        els.video.srcObject = stream;

        // Intenta forzar enfoque continuo si el track lo soporta (mejora nitidez al escanear documentos).
        var track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          try {
            var caps = track.getCapabilities();
            if (caps.focusMode && caps.focusMode.indexOf('continuous') !== -1) {
              track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            }
          } catch (e) { /* no soportado, se ignora */ }
        }

        els.video.onloadedmetadata = function () {
          els.video.play();
          loopEscaneo();
        };
      })
      .catch(function () {
        showToast('No se pudo acceder a la cámara. Revisa los permisos del navegador.', 'err');
        cerrarCamara();
        mostrarPantalla('screenReady');
      });
  }

  function cerrarCamara() {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = null;
    if (streamCamara) {
      streamCamara.getTracks().forEach(function (t) { t.stop(); });
      streamCamara = null;
    }
  }

  function loopEscaneo() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (!streamCamara) return;
      if (els.video.readyState === els.video.HAVE_ENOUGH_DATA) {
        canvas.width = els.video.videoWidth;
        canvas.height = els.video.videoHeight;
        ctx.drawImage(els.video, 0, 0, canvas.width, canvas.height);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Corrección Cambio 02 punto 3: 'dontInvert' solo intenta una lectura
        // (oscuro-sobre-claro) y deja sin reconocer QR que llegan con
        // contraste invertido a la cámara (brillo del flash, reflejo del
        // papel térmico, impresoras que invierten el sello, etc.).
        // 'attemptBoth' prueba también la variante invertida en cada frame
        // sin cambiar en nada el resultado para los QR que ya funcionaban
        // (si la primera pasada los reconoce, ahí termina) ni el resto del
        // flujo posterior a la detección (onQrDecodificado sigue igual).
        var code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) {
          onQrDecodificado(code.data);
          return;
        }
      }
      loopId = requestAnimationFrame(tick);
    }
    loopId = requestAnimationFrame(tick);
  }

  // Valida dominio y extrae ambiente/codGen/fechaEmi del QR del DTE.
  // Solo se acepta si el host es EXACTAMENTE admin.factura.gob.sv.
  function parsearQrDte(texto) {
    var url;
    try { url = new URL(texto); } catch (e) { return null; }
    if (url.hostname.toLowerCase() !== HOST_VALIDO) return null;

    var params = url.searchParams;
    // CAMBIO — Compatibilidad con QR de consulta pública que traen
    // ambiente=null (texto literal "null", no ausencia del parámetro) u
    // otras variantes equivalentes ("undefined", vacío, solo espacios).
    // Antes cualquier valor no vacío de 'ambiente' (incluido el texto
    // "null") se tomaba tal cual, así que este caso nunca caía en el
    // valor por defecto '01' y terminaba rechazado más adelante como
    // "no es un DTE". Ahora esas variantes se tratan igual que si el
    // parámetro no viniera, sin afectar el resto de QR que ya funcionan
    // (los que traen ambiente=00 o ambiente=01 siguen igual).
    function esValorVacioOEquivalente(v) {
      if (!v) return true;
      var norm = String(v).trim().toLowerCase();
      return norm === '' || norm === 'null' || norm === 'undefined';
    }
    function buscarParam(nombres) {
      for (var i = 0; i < nombres.length; i++) {
        var v = params.get(nombres[i]);
        if (v && !esValorVacioOEquivalente(v)) return v;
      }
      return '';
    }
    var ambiente = buscarParam(['ambiente', 'Ambiente']);
    var codGen = buscarParam(['codGen', 'codgen', 'CodGen']);
    var fechaEmi = buscarParam(['fechaEmi', 'fechaemi', 'FechaEmi']);
    // La identificación del DTE depende de codGen y fechaEmi (más el host
    // ya validado arriba) — 'ambiente' es informativo y nunca debe, por sí
    // solo, invalidar un QR de consulta pública legítimo.
    if (!codGen || !fechaEmi) return null;
    return { ambiente: ambiente || '01', codGen: codGen, fechaEmi: fechaEmi };
  }

  // Feedback de escaneo exitoso: sonido corto (Web Audio, sin archivos
  // externos) + vibración breve del dispositivo, si el navegador lo soporta.
  function feedbackEscaneoExitoso() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        var ctx = new Ctx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        osc.onended = function () { ctx.close(); };
      }
    } catch (e) { /* audio no disponible — se ignora */ }

    try {
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (e) { /* vibración no disponible — se ignora */ }
  }

  function onQrDecodificado(texto) {
    cerrarCamara();
    var datos = parsearQrDte(texto);
    if (!datos) {
      showToast('Este no es un QR de DTE válido.', 'err');
      mostrarPantalla('screenReady');
      return;
    }
    feedbackEscaneoExitoso();
    qrActual = datos;

    if (modoActual === 'cf') {
      els.docCfCodGen.textContent = datos.codGen;
      els.docCfFecha.textContent = datos.fechaEmi;
      els.swExentaCf.checked = false;
      mostrarPantalla('screenVentaCF');
      return;
    }

    if (modoActual === 'ccf') {
      clienteSeleccionado = null;
      els.ccfDocCodGen.textContent = datos.codGen;
      els.ccfDocFecha.textContent = datos.fechaEmi;
      els.clienteSearch.value = '';
      els.clienteResults.innerHTML = '';
      els.clienteNuevoForm.classList.add('hidden');
      els.clienteElegido.classList.add('hidden');
      els.swExentaCcf.checked = false;
      mostrarPantalla('screenDocumentoCCF');
      return;
    }

    // 'retencion' y 'excluido' reutilizan la MISMA pantalla y catálogo de
    // proveedores que 'compras' — el NIT/DUI (del Agente de Retención o del
    // Sujeto Excluido, según el caso) se toma de ahí, ya que la consulta
    // pública de Hacienda no lo expone. El único dato adicional es el
    // título, para dejar claro qué documento se está registrando.
    if (modoActual === 'retencion') {
      els.docDetectadoTitulo.textContent = 'Comprobante de Retención detectado';
    } else if (modoActual === 'excluido') {
      els.docDetectadoTitulo.textContent = 'Compra a Sujeto Excluido detectada';
    } else {
      els.docDetectadoTitulo.textContent = 'Documento detectado';
    }

    proveedorElegido = null;
    els.docCodGen.textContent = datos.codGen;
    els.docFecha.textContent = datos.fechaEmi;
    els.provSearch.value = '';
    els.provResults.innerHTML = '';
    limpiarFormularioProveedorNuevo();
    els.provNuevoForm.classList.add('hidden');
    els.provElegido.classList.add('hidden');
    mostrarPantalla('screenDocumento');
  }

  // ── Selección / alta de proveedor ───────────────────────────────────
  function normalizarBusqueda(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  // Llena el select "Clasificación" del formulario de proveedor nuevo con
  // las mismas opciones configuradas en FiscalSync (clasifLabels), para que
  // coincida con lo que verá el usuario en la computadora.
  function poblarSelectClasif() {
    if (!els.pnClasif) return;
    var valorPrevio = els.pnClasif.value;
    els.pnClasif.innerHTML = '';
    var claves = Object.keys(clasifLabels);
    if (!claves.length) {
      var opDefault = document.createElement('option');
      opDefault.value = '';
      opDefault.textContent = '— Sin clasificar —';
      els.pnClasif.appendChild(opDefault);
    } else {
      claves.forEach(function (v) {
        var op = document.createElement('option');
        op.value = v;
        op.textContent = clasifLabels[v];
        els.pnClasif.appendChild(op);
      });
    }
    if (claves.indexOf(valorPrevio) !== -1) els.pnClasif.value = valorPrevio;
  }

  // Texto legible de la clasificación de un proveedor (por su código guardado en el catálogo)
  function etiquetaClasifProveedor(codigo) {
    if (!codigo) return 'Sin clasificar';
    return clasifLabels[codigo] || ('Clasificación: ' + codigo);
  }

  // Cambio 01 (ampliación): mismos helpers que etiquetaClasifProveedor pero para
  // Sector y Tipo de Costo/Gasto — reutilizan sectorLabels/costoLabels recibidos
  // junto con el catálogo, con el mismo texto que usa el programa en la computadora.
  function etiquetaSectorProveedor(codigo) {
    if (!codigo) return 'Sin clasificar';
    return sectorLabels[codigo] || ('Sector: ' + codigo);
  }
  function etiquetaTipoCostoProveedor(codigo) {
    if (!codigo) return 'Sin clasificar';
    return costoLabels[codigo] || ('Tipo de Costo/Gasto: ' + codigo);
  }

  // Llena cualquier <select> de clasificación con un mapa {valor: etiqueta},
  // igual que poblarSelectClasif() pero reutilizable para Sector y Tipo de
  // Costo/Gasto (Cambio 01 — ampliación: formulario de edición de proveedor).
  function poblarSelectGenerico(selectEl, labelsMap, valorPrevio) {
    if (!selectEl) return;
    var valorAnterior = (valorPrevio !== undefined) ? valorPrevio : selectEl.value;
    selectEl.innerHTML = '';
    var claves = Object.keys(labelsMap || {});
    if (!claves.length) {
      var opDefault = document.createElement('option');
      opDefault.value = '';
      opDefault.textContent = '— Sin clasificar —';
      selectEl.appendChild(opDefault);
    } else {
      claves.forEach(function (v) {
        var op = document.createElement('option');
        op.value = v;
        op.textContent = labelsMap[v];
        selectEl.appendChild(op);
      });
    }
    if (claves.indexOf(valorAnterior) !== -1) selectEl.value = valorAnterior;
  }

  // Cambio 01: pinta en `container` la clasificación COMPLETA de un proveedor
  // (Tipo de Operación, Clasificación, Sector, Tipo de Costo/Gasto) para que el
  // usuario pueda verificarla sin volver a la computadora. "Tipo de Operación"
  // es informativo: FiscalSync siempre asigna '1 — Gravada' por defecto a los
  // registros de Compras (no es un dato guardado por proveedor), así que se
  // muestra ese mismo valor fijo — igual al que se aplicará al guardar.
  function pintarClasifCompletaProveedor(container, p) {
    if (!container) return;
    container.innerHTML = '';
    var lineas = [
      'Tipo de Operación: ' + (TIPOOP_LABELS['1'] || '1 — Gravada'),
      'Clasificación: ' + etiquetaClasifProveedor(p && p.clasif),
      'Sector: ' + etiquetaSectorProveedor(p && p.sector),
      'Tipo de Costo/Gasto: ' + etiquetaTipoCostoProveedor(p && p.tipoCosto)
    ];
    lineas.forEach(function (linea) {
      var lineEl = document.createElement('p');
      lineEl.className = 'hint';
      lineEl.textContent = linea;
      container.appendChild(lineEl);
    });
  }

  function renderResultadosProveedor(texto) {
    els.provResults.innerHTML = '';
    if (!texto) return;
    var t = normalizarBusqueda(texto);
    // Cambio 04: solo se muestran los proveedores clasificados para el anexo
    // que corresponde al libro que se está escaneando (compras/retención/
    // excluido) — mismo criterio (`usos`) que usa el Catálogo de Proveedores
    // en el escritorio, así el teléfono no ofrece proveedores de otro anexo.
    var usoRequerido = MODO_A_USO[modoActual];
    var matches = proveedores.filter(function (p) {
      return p.nombre && normalizarBusqueda(p.nombre).indexOf(t) !== -1 && proveedorTieneUso(p, usoRequerido);
    }).slice(0, 15);

    matches.forEach(function (p) {
      var item = document.createElement('div');
      item.className = 'prov-item';
      item.innerHTML = '<div class="nombre"></div><div class="nit"></div><div class="clasif"></div>';
      item.querySelector('.nombre').textContent = p.nombre || '(sin nombre)';
      item.querySelector('.nit').textContent = 'NIT: ' + (p.nit || '—') + (p.nrc ? '  ·  NRC: ' + p.nrc : '');
      item.querySelector('.clasif').textContent = etiquetaClasifProveedor(p.clasif);
      item.onclick = function () { elegirProveedor({ esNuevo: false, nit: p.nit || '', nrc: p.nrc || '', dui: p.dui || '', nombre: p.nombre || '', clasif: p.clasif || '', sector: p.sector || '', tipoCosto: p.tipoCosto || '' }); };
      els.provResults.appendChild(item);
    });
  }

  function elegirProveedor(p) {
    proveedorElegido = p;
    els.provElegidoTxt.textContent = (p.nombre || '(sin nombre)') + ' — NIT: ' + (p.nit || '—') + (p.esNuevo ? '  (nuevo)' : '');
    pintarClasifCompletaProveedor(els.provElegidoClasif, p);
    // Solo se puede editar un proveedor que YA EXISTE en el catálogo — uno
    // "nuevo" todavía no se ha creado, así que no hay nada que editar aún.
    if (els.btnEditarProveedor) els.btnEditarProveedor.classList.toggle('hidden', !!p.esNuevo);
    els.provElegido.classList.remove('hidden');
    els.provNuevoForm.classList.add('hidden');
    if (els.provEditarForm) els.provEditarForm.classList.add('hidden');
    els.provResults.innerHTML = '';
    els.provSearch.value = '';
  }

  els.provSearch.addEventListener('input', function () { renderResultadosProveedor(els.provSearch.value.trim()); });

  // Cambio 01: muestra/oculta los campos del formulario "Proveedor nuevo"
  // según el anexo que se está escaneando, con el mismo criterio que usa el
  // Catálogo de Proveedores del escritorio (toggleProveedorUsoFields):
  //   - Clasificación / Sector / Tipo de Costo-Gasto → Compras y Sujeto Excluido
  //   - Tipo de Documento / Tipo de Operación         → solo Sujeto Excluido
  //   - Escanear Retención no usa ninguno de esos campos
  function actualizarCamposProveedorNuevo() {
    var usaClasif = (modoActual === 'compras' || modoActual === 'excluido');
    var usaExcluido = (modoActual === 'excluido');
    if (els.pnClasifSection) els.pnClasifSection.classList.toggle('hidden', !usaClasif);
    if (els.pnExcluidoFields) els.pnExcluidoFields.classList.toggle('hidden', !usaExcluido);
    if (usaExcluido) {
      if (els.pnTipoDocEx) els.pnTipoDocEx.value = '1';
      if (els.pnTipoOpEx) els.pnTipoOpEx.value = '';
    }
  }

  // Corrección Bug 01: antes, el formulario "Proveedor nuevo" nunca se
  // limpiaba entre usos, así que si el usuario registraba un proveedor y
  // luego escaneaba OTRO documento y abría "Agregar Proveedor Nuevo" de
  // nuevo, los campos (nombre, NIT, NRC, DUI, clasificación, sector, tipo
  // de costo/gasto y los campos de Sujeto Excluido) todavía traían los
  // valores del proveedor anterior. Esta función deja el formulario
  // completamente en blanco.
  function limpiarFormularioProveedorNuevo() {
    els.pnNombre.value = '';
    els.pnNit.value = '';
    els.pnNrc.value = '';
    els.pnDui.value = '';
    if (els.pnClasif) els.pnClasif.value = '';
    if (els.pnSector) els.pnSector.value = '';
    if (els.pnTipoCosto) els.pnTipoCosto.value = '';
    if (els.pnTipoDocEx) els.pnTipoDocEx.value = '1';
    if (els.pnTipoOpEx) els.pnTipoOpEx.value = '';
  }

  els.btnProvNuevo.addEventListener('click', function () {
    limpiarFormularioProveedorNuevo();
    actualizarCamposProveedorNuevo();
    els.provNuevoForm.classList.remove('hidden');
    els.provElegido.classList.add('hidden');
  });

  els.btnPnConfirmar.addEventListener('click', function () {
    var nombre = els.pnNombre.value.trim();
    var nit = els.pnNit.value.trim();
    var nrcNuevo = els.pnNrc.value.trim();
    var duiNuevo = els.pnDui.value.trim();
    // CAMBIO — Proveedores Sujeto Excluido en el escáner QR: un Sujeto
    // Excluido puede identificarse con NIT, DUI o NRC (ej. persona natural
    // sin NIT/NRC), así que para ese anexo basta con que UNO de los tres
    // tenga dato. Para el resto de los tipos de proveedor se mantiene la
    // exigencia original de NIT obligatorio (no se toca esa validación).
    var esExcluidoNuevo = (modoActual === 'excluido');
    var identificacionOk = esExcluidoNuevo ? (nit || duiNuevo || nrcNuevo) : nit;
    if (!nombre || !identificacionOk) {
      var msgFaltaProvNuevo = esExcluidoNuevo
        ? 'Nombre y al menos un documento de identificación (NIT, DUI o NRC) son obligatorios para un proveedor nuevo.'
        : 'Nombre y NIT son obligatorios para un proveedor nuevo.';
      showToast(msgFaltaProvNuevo, 'err');
      return;
    }
    // Cambio 01: el proveedor nuevo se guarda con el anexo correspondiente al
    // tipo de escaneo desde el que se creó (Compras / IVA Retenido / Sujeto
    // Excluido), y solo lleva los campos que aplican a ese anexo — igual que
    // en el Catálogo de Proveedores del escritorio.
    var usoNuevo = MODO_A_USO[modoActual] || 'compras';
    var usaClasif = (modoActual === 'compras' || modoActual === 'excluido');
    var usaExcluido = (modoActual === 'excluido');
    elegirProveedor({
      esNuevo: true,
      nombre: nombre,
      nit: nit,
      nrc: els.pnNrc.value.trim(),
      dui: els.pnDui.value.trim(),
      usos: [usoNuevo],
      clasif: (usaClasif && els.pnClasif) ? els.pnClasif.value : '',
      sector: (usaClasif && els.pnSector) ? els.pnSector.value : '',
      tipoCosto: (usaClasif && els.pnTipoCosto) ? els.pnTipoCosto.value : '',
      tipoDocEx: (usaExcluido && els.pnTipoDocEx) ? els.pnTipoDocEx.value : '',
      tipoOpEx: (usaExcluido && els.pnTipoOpEx) ? els.pnTipoOpEx.value : ''
    });
    // Corrección Bug 01: deja el formulario limpio de inmediato después de
    // usarlo, para que no queden datos de este proveedor si se vuelve a
    // abrir "Agregar Proveedor Nuevo" más adelante (elegirProveedor() ya lo
    // oculta arriba, pero no borraba los valores de los campos).
    limpiarFormularioProveedorNuevo();
  });

  els.btnConfirmarDocumento.addEventListener('click', function () {
    if (!qrActual || !proveedorElegido) return;
    var libroDestino = 'compras';
    if (modoActual === 'retencion') libroDestino = 'retencion';
    else if (modoActual === 'excluido') libroDestino = 'excluido';
    ws.send(JSON.stringify({
      tipo: 'documento-escaneado',
      libro: libroDestino,
      qr: qrActual,
      proveedor: proveedorElegido
    }));
  });

  els.btnCancelarDocumento.addEventListener('click', function () {
    qrActual = null;
    proveedorElegido = null;
    mostrarPantalla('screenReady');
  });

  // ── Cambio 01 (ampliación): editar un proveedor existente desde el teléfono ──
  // No cambia el flujo de escaneo (qrActual sigue intacto) — solo abre un
  // formulario para corregir los datos del proveedor ya seleccionado.
  if (els.btnEditarProveedor) {
    els.btnEditarProveedor.addEventListener('click', function () {
      if (!proveedorElegido || proveedorElegido.esNuevo) return;
      els.peNombre.value = proveedorElegido.nombre || '';
      els.peNit.value = proveedorElegido.nit || '';
      els.peNrc.value = proveedorElegido.nrc || '';
      els.peDui.value = proveedorElegido.dui || '';
      poblarSelectGenerico(els.peClasif, clasifLabels, proveedorElegido.clasif || '');
      poblarSelectGenerico(els.peSector, sectorLabels, proveedorElegido.sector || '');
      poblarSelectGenerico(els.peTipoCosto, costoLabels, proveedorElegido.tipoCosto || '');
      els.provElegido.classList.add('hidden');
      els.provEditarForm.classList.remove('hidden');
    });
  }

  if (els.btnPeCancelar) {
    els.btnPeCancelar.addEventListener('click', function () {
      els.provEditarForm.classList.add('hidden');
      els.provElegido.classList.remove('hidden');
    });
  }

  if (els.btnPeGuardar) {
    els.btnPeGuardar.addEventListener('click', function () {
      if (!proveedorElegido) return;
      var nombre = els.peNombre.value.trim();
      var nit = els.peNit.value.trim();
      if (!nombre || !nit) {
        showToast('Nombre y NIT son obligatorios.', 'err');
        return;
      }
      var nitOriginal = proveedorElegido.nit || nit;
      var nrcOriginal = proveedorElegido.nrc || '';
      var editado = {
        esNuevo: false,
        nit: nit,
        nrc: els.peNrc.value.trim(),
        dui: els.peDui.value.trim(),
        nombre: nombre,
        clasif: els.peClasif ? els.peClasif.value : '',
        sector: els.peSector ? els.peSector.value : '',
        tipoCosto: els.peTipoCosto ? els.peTipoCosto.value : ''
      };

      // Actualiza también la copia local del catálogo (búsqueda/lista), sin
      // esperar a que el catálogo se vuelva a sincronizar desde FiscalSync.
      var idxLocal = proveedores.findIndex(function (pr) {
        var prNit = pr.nit ? String(pr.nit).trim() : '';
        var prNrc = pr.nrc ? String(pr.nrc).trim() : '';
        return (prNit && prNit === nitOriginal) || (nrcOriginal && prNrc && prNrc === nrcOriginal);
      });
      if (idxLocal !== -1) {
        proveedores[idxLocal] = Object.assign({}, proveedores[idxLocal], editado);
      }

      // Envía la edición a FiscalSync — el identificador es nitOriginal (el NIT
      // ANTES de esta edición), para poder localizar el registro aunque el
      // usuario también haya corregido el NIT en este mismo formulario.
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          tipo: 'proveedor-editado',
          proveedor: Object.assign({ nitOriginal: nitOriginal }, editado)
        }));
      }

      elegirProveedor(editado);
      showToast('Proveedor actualizado', 'ok');
    });
  }

  // ── Selección / alta de cliente (Ventas — Crédito Fiscal) ──────────
  function renderResultadosCliente(texto) {
    els.clienteResults.innerHTML = '';
    if (!texto) return;
    var t = normalizarBusqueda(texto);
    var matches = clientes.filter(function (c) {
      return c.nombre && normalizarBusqueda(c.nombre).indexOf(t) !== -1;
    }).slice(0, 15);

    matches.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'prov-item';
      item.innerHTML = '<div class="nombre"></div><div class="nit"></div><div class="clasif"></div>';
      item.querySelector('.nombre').textContent = c.nombre || '(sin nombre)';
      item.querySelector('.nit').textContent = 'NIT: ' + (c.nit || '—') + (c.nrc ? '  ·  NRC: ' + c.nrc : '');
      item.querySelector('.clasif').textContent = etiquetaClasifCliente(c);
      item.onclick = function () { elegirCliente({ esNuevo: false, nit: c.nit || '', nrc: c.nrc || '', nombre: c.nombre || '', tipoOp: c.tipoOp || '', tipoIng: c.tipoIng || '' }); };
      els.clienteResults.appendChild(item);
    });
  }

  // Texto legible de la clasificación de un cliente (Tipo de Operación / Tipo de Ingreso)
  function etiquetaClasifCliente(c) {
    var partes = [];
    if (c && c.tipoOp) partes.push(TIPOOP_LABELS[c.tipoOp] || ('Tipo de Operación: ' + c.tipoOp));
    if (c && c.tipoIng) partes.push(TIPOING_LABELS[c.tipoIng] || ('Tipo de Ingreso: ' + c.tipoIng));
    return partes.length ? partes.join(' · ') : 'Sin clasificar';
  }

  function elegirCliente(c) {
    clienteSeleccionado = c;
    els.clienteElegidoTxt.textContent = (c.nombre || '(sin nombre)') + ' — NIT: ' + (c.nit || '—') + (c.esNuevo ? '  (nuevo)' : '');
    els.clienteElegidoClasif.textContent = 'Clasificación: ' + etiquetaClasifCliente(c);
    // Solo se puede editar un cliente que YA EXISTE en el catálogo — uno
    // "nuevo" todavía no se ha creado, así que no hay nada que editar aún.
    if (els.btnEditarCliente) els.btnEditarCliente.classList.toggle('hidden', !!c.esNuevo);
    els.clienteElegido.classList.remove('hidden');
    els.clienteNuevoForm.classList.add('hidden');
    if (els.clienteEditarForm) els.clienteEditarForm.classList.add('hidden');
    els.clienteResults.innerHTML = '';
    els.clienteSearch.value = '';
  }

  els.clienteSearch.addEventListener('input', function () { renderResultadosCliente(els.clienteSearch.value.trim()); });

  els.btnClienteNuevo.addEventListener('click', function () {
    poblarSelectGenerico(els.cnTipoOp, TIPOOP_LABELS, '');
    poblarSelectGenerico(els.cnTipoIng, TIPOING_LABELS, '');
    els.clienteNuevoForm.classList.remove('hidden');
    els.clienteElegido.classList.add('hidden');
  });

  els.btnCnConfirmar.addEventListener('click', function () {
    var nombre = els.cnNombre.value.trim();
    var nit = els.cnNit.value.trim();
    if (!nombre || !nit) {
      showToast('Nombre y NIT son obligatorios para un cliente nuevo.', 'err');
      return;
    }
    elegirCliente({
      esNuevo: true,
      nombre: nombre,
      nit: nit,
      nrc: els.cnNrc.value.trim(),
      tipoOp: els.cnTipoOp ? els.cnTipoOp.value : '',
      tipoIng: els.cnTipoIng ? els.cnTipoIng.value : ''
    });
  });

  // ── Cambio 01 (ampliación): editar un cliente existente desde el teléfono ──
  // No cambia el flujo de escaneo (qrActual sigue intacto) — solo abre un
  // formulario para corregir los datos del cliente ya seleccionado.
  if (els.btnEditarCliente) {
    els.btnEditarCliente.addEventListener('click', function () {
      if (!clienteSeleccionado || clienteSeleccionado.esNuevo) return;
      els.ceNombre.value = clienteSeleccionado.nombre || '';
      els.ceNit.value = clienteSeleccionado.nit || '';
      els.ceNrc.value = clienteSeleccionado.nrc || '';
      poblarSelectGenerico(els.ceTipoOp, TIPOOP_LABELS, clienteSeleccionado.tipoOp || '');
      poblarSelectGenerico(els.ceTipoIng, TIPOING_LABELS, clienteSeleccionado.tipoIng || '');
      els.clienteElegido.classList.add('hidden');
      els.clienteEditarForm.classList.remove('hidden');
    });
  }

  if (els.btnCeCancelar) {
    els.btnCeCancelar.addEventListener('click', function () {
      els.clienteEditarForm.classList.add('hidden');
      els.clienteElegido.classList.remove('hidden');
    });
  }

  if (els.btnCeGuardar) {
    els.btnCeGuardar.addEventListener('click', function () {
      if (!clienteSeleccionado) return;
      var nombre = els.ceNombre.value.trim();
      var nit = els.ceNit.value.trim();
      if (!nombre || !nit) {
        showToast('Nombre y NIT son obligatorios.', 'err');
        return;
      }
      var nitOriginal = clienteSeleccionado.nit || nit;
      var nrcOriginal = clienteSeleccionado.nrc || '';
      var editado = {
        esNuevo: false,
        nit: nit,
        nrc: els.ceNrc.value.trim(),
        nombre: nombre,
        tipoOp: els.ceTipoOp ? els.ceTipoOp.value : '',
        tipoIng: els.ceTipoIng ? els.ceTipoIng.value : ''
      };

      // Actualiza también la copia local del catálogo (búsqueda/lista), sin
      // esperar a que el catálogo se vuelva a sincronizar desde FiscalSync.
      var idxLocal = clientes.findIndex(function (cl) {
        var clNit = cl.nit ? String(cl.nit).trim() : '';
        var clNrc = cl.nrc ? String(cl.nrc).trim() : '';
        return (clNit && clNit === nitOriginal) || (nrcOriginal && clNrc && clNrc === nrcOriginal);
      });
      if (idxLocal !== -1) {
        clientes[idxLocal] = Object.assign({}, clientes[idxLocal], editado);
      }

      // Envía la edición a FiscalSync — el identificador es nitOriginal (el NIT
      // ANTES de esta edición), para poder localizar el registro aunque el
      // usuario también haya corregido el NIT en este mismo formulario.
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          tipo: 'cliente-editado',
          cliente: Object.assign({ nitOriginal: nitOriginal }, editado)
        }));
      }

      elegirCliente(editado);
      showToast('Cliente actualizado', 'ok');
    });
  }

  els.btnConfirmarCCF.addEventListener('click', function () {
    if (!qrActual || !clienteSeleccionado) return;
    ws.send(JSON.stringify({
      tipo: 'documento-escaneado',
      libro: 'ccf',
      qr: qrActual,
      cliente: clienteSeleccionado,
      exenta: !!els.swExentaCcf.checked
    }));
  });

  els.btnCancelarCCF.addEventListener('click', function () {
    qrActual = null;
    clienteSeleccionado = null;
    mostrarPantalla('screenReady');
  });

  // ── Venta a Consumidor Final (sin proveedor — solo indica si es exenta) ──
  els.btnConfirmarVentaCF.addEventListener('click', function () {
    if (!qrActual) return;
    ws.send(JSON.stringify({
      tipo: 'documento-escaneado',
      libro: 'cf',
      qr: qrActual,
      exenta: !!els.swExentaCf.checked
    }));
  });

  els.btnCancelarVentaCF.addEventListener('click', function () {
    qrActual = null;
    mostrarPantalla('screenReady');
  });

  // Cambio 02: el formulario de "Cliente nuevo" usa la misma clasificación
  // (Tipo de Operación / Tipo de Ingreso) que ya usa "Editar cliente". Son
  // etiquetas fijas (no dependen del catálogo de la empresa), así que se
  // pueden poblar de una vez, sin esperar mensajes del servidor.
  poblarSelectGenerico(els.cnTipoOp, TIPOOP_LABELS);
  poblarSelectGenerico(els.cnTipoIng, TIPOING_LABELS);

  els.btnEscanearCompra.addEventListener('click', function () { modoActual = 'compras'; abrirCamara(); });
  els.btnEscanearCF.addEventListener('click', function () { modoActual = 'cf'; abrirCamara(); });
  els.btnEscanearCCF.addEventListener('click', function () { modoActual = 'ccf'; abrirCamara(); });
  els.btnEscanearRetencion.addEventListener('click', function () { modoActual = 'retencion'; abrirCamara(); });
  els.btnEscanearExcluido.addEventListener('click', function () { modoActual = 'excluido'; abrirCamara(); });
  els.btnCancelarCamara.addEventListener('click', function () { cerrarCamara(); mostrarPantalla('screenReady'); });
  els.btnOtroDocumento.addEventListener('click', function () { mostrarPantalla('screenReady'); });

  conectar();
})();
