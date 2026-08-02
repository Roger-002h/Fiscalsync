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
    empresaLabel: document.getElementById('empresaLabel'),
    btnEscanearCompra: document.getElementById('btnEscanearCompra'),
    btnEscanearCF: document.getElementById('btnEscanearCF'),
    btnEscanearCCF: document.getElementById('btnEscanearCCF'),
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
    btnPnConfirmar: document.getElementById('btnPnConfirmar'),
    provElegido: document.getElementById('provElegido'),
    provElegidoTxt: document.getElementById('provElegidoTxt'),
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
    btnCnConfirmar: document.getElementById('btnCnConfirmar'),
    clienteElegido: document.getElementById('clienteElegido'),
    clienteElegidoTxt: document.getElementById('clienteElegidoTxt'),
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
  var modoActual = 'compras';  // 'compras' | 'cf' | 'ccf' — libro destino del escaneo actual
  var qrActual = null;        // { ambiente, codGen, fechaEmi }
  var proveedorElegido = null; // { esNuevo, nit, nrc, dui, nombre }
  var clienteSeleccionado = null; // { esNuevo, nit, nrc, nombre } — solo para modo 'ccf'
  var streamCamara = null;
  var loopId = null;
  var reconectando = false;

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
      proveedores = Array.isArray(msg.proveedores) ? msg.proveedores : [];
      empresaNombre = msg.empresa || '';
      els.empresaLabel.textContent = empresaNombre ? ('Empresa activa: ' + empresaNombre) : '';
      mostrarPantalla('screenReady');
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
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (stream) {
        streamCamara = stream;
        els.video.srcObject = stream;
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
        var code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
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
    function buscarParam(nombres) {
      for (var i = 0; i < nombres.length; i++) {
        var v = params.get(nombres[i]);
        if (v) return v;
      }
      return '';
    }
    var ambiente = buscarParam(['ambiente', 'Ambiente']);
    var codGen = buscarParam(['codGen', 'codgen', 'CodGen']);
    var fechaEmi = buscarParam(['fechaEmi', 'fechaemi', 'FechaEmi']);
    if (!codGen || !fechaEmi) return null;
    return { ambiente: ambiente || '01', codGen: codGen, fechaEmi: fechaEmi };
  }

  function onQrDecodificado(texto) {
    cerrarCamara();
    var datos = parsearQrDte(texto);
    if (!datos) {
      showToast('Este no es un QR de DTE válido.', 'err');
      mostrarPantalla('screenReady');
      return;
    }
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

    proveedorElegido = null;
    els.docCodGen.textContent = datos.codGen;
    els.docFecha.textContent = datos.fechaEmi;
    els.provSearch.value = '';
    els.provResults.innerHTML = '';
    els.provNuevoForm.classList.add('hidden');
    els.provElegido.classList.add('hidden');
    mostrarPantalla('screenDocumento');
  }

  // ── Selección / alta de proveedor ───────────────────────────────────
  function normalizarBusqueda(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function renderResultadosProveedor(texto) {
    els.provResults.innerHTML = '';
    if (!texto) return;
    var t = normalizarBusqueda(texto);
    var matches = proveedores.filter(function (p) {
      return p.nombre && normalizarBusqueda(p.nombre).indexOf(t) !== -1;
    }).slice(0, 15);

    matches.forEach(function (p) {
      var item = document.createElement('div');
      item.className = 'prov-item';
      item.innerHTML = '<div class="nombre"></div><div class="nit"></div>';
      item.querySelector('.nombre').textContent = p.nombre || '(sin nombre)';
      item.querySelector('.nit').textContent = 'NIT: ' + (p.nit || '—') + (p.nrc ? '  ·  NRC: ' + p.nrc : '');
      item.onclick = function () { elegirProveedor({ esNuevo: false, nit: p.nit || '', nrc: p.nrc || '', dui: p.dui || '', nombre: p.nombre || '' }); };
      els.provResults.appendChild(item);
    });
  }

  function elegirProveedor(p) {
    proveedorElegido = p;
    els.provElegidoTxt.textContent = (p.nombre || '(sin nombre)') + ' — NIT: ' + (p.nit || '—') + (p.esNuevo ? '  (nuevo)' : '');
    els.provElegido.classList.remove('hidden');
    els.provNuevoForm.classList.add('hidden');
    els.provResults.innerHTML = '';
    els.provSearch.value = '';
  }

  els.provSearch.addEventListener('input', function () { renderResultadosProveedor(els.provSearch.value.trim()); });

  els.btnProvNuevo.addEventListener('click', function () {
    els.provNuevoForm.classList.remove('hidden');
    els.provElegido.classList.add('hidden');
  });

  els.btnPnConfirmar.addEventListener('click', function () {
    var nombre = els.pnNombre.value.trim();
    var nit = els.pnNit.value.trim();
    if (!nombre || !nit) {
      showToast('Nombre y NIT son obligatorios para un proveedor nuevo.', 'err');
      return;
    }
    elegirProveedor({
      esNuevo: true,
      nombre: nombre,
      nit: nit,
      nrc: els.pnNrc.value.trim(),
      dui: els.pnDui.value.trim()
    });
  });

  els.btnConfirmarDocumento.addEventListener('click', function () {
    if (!qrActual || !proveedorElegido) return;
    ws.send(JSON.stringify({
      tipo: 'documento-escaneado',
      libro: 'compras',
      qr: qrActual,
      proveedor: proveedorElegido
    }));
  });

  els.btnCancelarDocumento.addEventListener('click', function () {
    qrActual = null;
    proveedorElegido = null;
    mostrarPantalla('screenReady');
  });

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
      item.innerHTML = '<div class="nombre"></div><div class="nit"></div>';
      item.querySelector('.nombre').textContent = c.nombre || '(sin nombre)';
      item.querySelector('.nit').textContent = 'NIT: ' + (c.nit || '—') + (c.nrc ? '  ·  NRC: ' + c.nrc : '');
      item.onclick = function () { elegirCliente({ esNuevo: false, nit: c.nit || '', nrc: c.nrc || '', nombre: c.nombre || '' }); };
      els.clienteResults.appendChild(item);
    });
  }

  function elegirCliente(c) {
    clienteSeleccionado = c;
    els.clienteElegidoTxt.textContent = (c.nombre || '(sin nombre)') + ' — NIT: ' + (c.nit || '—') + (c.esNuevo ? '  (nuevo)' : '');
    els.clienteElegido.classList.remove('hidden');
    els.clienteNuevoForm.classList.add('hidden');
    els.clienteResults.innerHTML = '';
    els.clienteSearch.value = '';
  }

  els.clienteSearch.addEventListener('input', function () { renderResultadosCliente(els.clienteSearch.value.trim()); });

  els.btnClienteNuevo.addEventListener('click', function () {
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
      nrc: els.cnNrc.value.trim()
    });
  });

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

  els.btnEscanearCompra.addEventListener('click', function () { modoActual = 'compras'; abrirCamara(); });
  els.btnEscanearCF.addEventListener('click', function () { modoActual = 'cf'; abrirCamara(); });
  els.btnEscanearCCF.addEventListener('click', function () { modoActual = 'ccf'; abrirCamara(); });
  els.btnCancelarCamara.addEventListener('click', function () { cerrarCamara(); mostrarPantalla('screenReady'); });
  els.btnOtroDocumento.addEventListener('click', function () { mostrarPantalla('screenReady'); });

  conectar();
})();
