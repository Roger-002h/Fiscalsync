// ══════════════════════════════════════════════════════════════════════
// app.js — Página servida al teléfono
// Cambio 03 (Gestión del documento trasladada a la computadora): el
// teléfono dejó de ser una app de gestión — ya NO elige tipo de documento,
// no busca/agrega/edita proveedor ni cliente, no decide si una venta es
// "exenta" y no tiene botón de "Confirmar". Ahora es ÚNICAMENTE un lector
// remoto de códigos QR conectado a FiscalSync:
//
//   Abrir cámara → Escanear QR → Enviar el QR a la computadora.
//
// Todo lo demás (mostrar el documento, seleccionar/agregar proveedor o
// cliente, validar y confirmar, y registrarlo en el anexo correspondiente)
// vive ahora en FiscalSync (ver index.html). Sin dependencias externas
// salvo jsqr.min.js (vendorizado, 100% offline).
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
    screenEnviando: document.getElementById('screenEnviando'),
    screenResultado: document.getElementById('screenResultado'),
    empresaBar: document.getElementById('empresaBar'),
    empresaBarNombre: document.getElementById('empresaBarNombre'),
    // La pantalla "Listo" y la cámara solo muestran qué tipo de documento
    // ordenó la computadora — nunca lo elige el teléfono.
    libroOrdenadoTxt: document.getElementById('libroOrdenadoTxt'),
    camaraLibroLabel: document.getElementById('camaraLibroLabel'),
    btnCancelarCamara: document.getElementById('btnCancelarCamara'),
    video: document.getElementById('video'),
    resTitulo: document.getElementById('resTitulo'),
    resMensaje: document.getElementById('resMensaje'),
    toast: document.getElementById('toast')
  };

  var ws = null;
  var empresaNombre = '';

  var modoActual = 'compras';  // 'compras' | 'cf' | 'ccf' | 'retencion' | 'excluido' — libro que ordenó la PC
  var streamCamara = null;
  var loopId = null;
  var reconectando = false;

  // Cambio 01: etiquetas de cada tipo de documento, solo para que el
  // teléfono MUESTRE (nunca elija) qué está escaneando por orden de la
  // computadora — misma nomenclatura que usa FiscalSync.
  var LIBRO_LABELS = {
    compras: 'Compras',
    cf: 'Venta — Consumidor Final',
    ccf: 'Venta — Crédito Fiscal',
    retencion: 'Comprobante de Retención',
    excluido: 'Compra a Sujeto Excluido'
  };

  function actualizarLibroActualUI() {
    var etiqueta = LIBRO_LABELS[modoActual] || '';
    if (els.libroOrdenadoTxt) {
      els.libroOrdenadoTxt.textContent = etiqueta ? ('Escaneando: ' + etiqueta) : '';
    }
    if (els.camaraLibroLabel) {
      els.camaraLibroLabel.textContent = etiqueta ? ('Escaneando: ' + etiqueta) : '';
    }
  }

  // Punto 3 (se mantiene): refleja la empresa activa en la barra
  // persistente del header, visible en todas las pantallas, para evitar
  // escanear para la empresa incorrecta.
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
    ['screenConnecting', 'screenReady', 'screenCamera', 'screenEnviando', 'screenResultado']
      .forEach(function (key) {
        els[key].classList.toggle('hidden', key !== id);
      });
  }

  // Pantalla "Sin Empresa Activa" (reutiliza screenConnecting + los textos
  // de connTitle/connHint) — se muestra tanto al conectar sin ninguna
  // empresa activa en el escritorio como al cambiar a "ninguna empresa".
  function _mostrarSinEmpresaActiva() {
    mostrarPantalla('screenConnecting');
    els.connTitle.textContent = 'Sin empresa activa';
    els.connHint.textContent = 'Selecciona una empresa en FiscalSync para poder escanear documentos.';
  }

  // ── Conexión WebSocket ──────────────────────────────────────────────
  var catalogoInicialRecibido = false; // primera llegada de 'catalogo-proveedores' tras conectar (ver manejarMensaje)

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

    catalogoInicialRecibido = false;

    ws = new WebSocket('wss://' + location.host + '/ws');

    ws.onopen = function () {
      ws.send(JSON.stringify({ tipo: 'auth', token: token }));
    };

    ws.onclose = function (ev) {
      els.connDot.className = 'dot off';
      els.connSub.textContent = 'Desconectado';
      cerrarCamara();
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

    // Cambio 03: el teléfono ya no gestiona catálogos de proveedores/
    // clientes — el ÚNICO dato útil de este mensaje ahora es el nombre de
    // la empresa activa (para mostrarlo en el header y evitar escanear para
    // la empresa incorrecta). Se conserva el mismo criterio de "cambio de
    // empresa" que antes para cortar cualquier orden de escaneo en curso.
    if (msg.tipo === 'catalogo-proveedores') {
      var empresaNueva = msg.empresa || '';
      var esCambioDeEmpresa = catalogoInicialRecibido && empresaNueva !== empresaNombre;
      empresaNombre = empresaNueva;
      actualizarEmpresaActiva();

      if (esCambioDeEmpresa) {
        cerrarCamara();
        if (els.libroOrdenadoTxt) els.libroOrdenadoTxt.textContent = '';
        if (empresaNombre) {
          mostrarPantalla('screenReady');
          showToast('Empresa activa cambiada a: ' + empresaNombre, 'ok');
        } else {
          _mostrarSinEmpresaActiva();
        }
        return;
      }

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

    // El teléfono ya no usa el catálogo de clientes — se ignora.
    if (msg.tipo === 'catalogo-clientes') return;

    // Cambio 01: la computadora ordena qué tipo de documento escanear a
    // continuación. El teléfono ya no elige nada por su cuenta — solo
    // obedece: guarda el tipo de documento indicado y abre la cámara.
    if (msg.tipo === 'iniciar-escaneo') {
      var librosValidos = ['compras', 'cf', 'ccf', 'retencion', 'excluido'];
      if (librosValidos.indexOf(msg.libro) === -1) return;
      modoActual = msg.libro;
      actualizarLibroActualUI();
      abrirCamara();
      return;
    }

    if (msg.tipo === 'recibido') {
      mostrarPantalla('screenEnviando');
      return;
    }

    // Cambio 03: este mensaje ya NO es el resultado final del guardado (eso
    // ahora lo decide el usuario en la computadora) — es solo la
    // confirmación de que el QR llegó bien y se está procesando ahí, o un
    // aviso de que hubo un problema con la lectura/consulta y conviene
    // volver a escanear.
    if (msg.tipo === 'resultado-documento') {
      els.resTitulo.innerHTML = msg.ok
        ? 'Enviado <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-left:2px;"><polyline points="20 6 9 17 4 12"/></svg>'
        : 'No se pudo procesar';
      els.resMensaje.textContent = msg.mensaje || (msg.ok
        ? 'Revisa el documento en tu computadora.'
        : 'Vuelve a escanear el documento.');
      mostrarPantalla('screenResultado');
      // Vuelve sola a la cámara (el mismo tipo de documento sigue vigente)
      // después de un momento, así el usuario puede seguir escaneando sin
      // tocar nada más — igual que si la PC hubiera vuelto a ordenar el
      // mismo tipo de documento.
      setTimeout(function () {
        if (els.screenResultado.classList.contains('hidden')) return; // el usuario ya salió de esta pantalla
        abrirCamara();
      }, 1600);
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
        // 'attemptBoth' prueba también la variante invertida en cada frame
        // (brillo del flash, reflejo del papel térmico, impresoras que
        // invierten el sello, etc.) sin cambiar el resultado para los QR
        // que ya funcionaban con la primera pasada.
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
    // Compatibilidad con QR de consulta pública que traen ambiente=null
    // (texto literal "null", no ausencia del parámetro) u otras variantes
    // equivalentes ("undefined", vacío, solo espacios) — se tratan igual
    // que si el parámetro no viniera.
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

  // Cambio 03: el teléfono ya no muestra ninguna pantalla de gestión del
  // documento (proveedor, cliente, exenta, confirmar) — en cuanto lee un QR
  // válido, lo envía de inmediato a la computadora y pasa a "Enviando…".
  // Todo lo demás ocurre en FiscalSync.
  function onQrDecodificado(texto) {
    cerrarCamara();
    var datos = parsearQrDte(texto);
    if (!datos) {
      showToast('Este no es un QR de DTE válido. Vuelve a intentar.', 'err');
      abrirCamara();
      return;
    }
    feedbackEscaneoExitoso();
    enviarDocumentoEscaneado(datos);
  }

  function enviarDocumentoEscaneado(qr) {
    if (!ws || ws.readyState !== 1 /* OPEN */) {
      showToast('Se perdió la conexión — espera a reconectar e intenta de nuevo.', 'err');
      mostrarPantalla('screenReady');
      return;
    }
    mostrarPantalla('screenEnviando');
    ws.send(JSON.stringify({
      tipo: 'documento-escaneado',
      qr: qr
    }));
  }

  // ── Botones ──────────────────────────────────────────────────────────
  if (els.btnCancelarCamara) {
    els.btnCancelarCamara.addEventListener('click', function () {
      cerrarCamara();
      mostrarPantalla('screenReady');
    });
  }

  // ── Arranque ─────────────────────────────────────────────────────────
  actualizarLibroActualUI();
  conectar();
})();
