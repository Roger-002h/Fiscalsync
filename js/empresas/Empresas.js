// empresas/Empresas.js
// Extraído automáticamente de index.html (FiscalSync) — Fase 2.
// No se modificó ninguna línea de lógica: es exactamente el código original,
// solo reordenado por módulo.



    function saveEmpresas() {
        fsStore.setItem('fs_v' + APP_VERSION + '_empresas', JSON.stringify(empresas));
    }

    function loadEmpresas() {
        var raw = fsStore.getItem('fs_v' + APP_VERSION + '_empresas');
        if (raw) { try { empresas = JSON.parse(raw); } catch(e) { empresas = []; } }
    }

    // ══════════════════════════════════════════════
    // RENDER LISTA DE EMPRESAS
    // ══════════════════════════════════════════════
    function renderEmpresaList() {
        var list = document.getElementById('empresaList');
        var empty = document.getElementById('empresaEmpty');
        var countBadge = document.getElementById('empresaCountBadge');
        list.innerHTML = '';

        if (!empresas.length) {
            empty.classList.add('visible');
            countBadge.innerText = '0 empresas registradas';
            return;
        }
        empty.classList.remove('visible');
        countBadge.innerText = empresas.length + (empresas.length === 1 ? ' empresa registrada' : ' empresas registradas');

        empresas.forEach(function(emp, i) {
            var isReconstructed = emp._reconstructed || /^emp_\d+_[a-z0-9]+$/i.test(emp.razon);
            var row = document.createElement('div');
            row.className = 'empresa-row';
            var nameHtml = isReconstructed
                ? '<p class="text-amber-400 text-sm font-medium truncate" style="display:flex;align-items:center;gap:6px;">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:var(--rp-warning)"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                  '<span class="truncate" style="color:var(--rp-warning);">Razón Social pendiente</span></p>' +
                  '<p class="text-amber-600/70 text-[11px] mt-0.5 font-light">Importada desde backup — haz clic en <strong>Completar</strong> para asignar nombre</p>'
                : '<p class="text-white text-sm font-medium truncate">' + emp.razon + '</p>' +
                  '<p class="text-zinc-500 text-[11px] mt-0.5 font-light">DUI/NIT: ' + (emp.nit || '—') + ' &nbsp;·&nbsp; NRC: ' + (emp.nrc || '—') + '</p>';
            var actionBtn = isReconstructed
                ? '<button onclick="openEmpresaModal(' + i + ')" class="empresa-btn blue">Completar</button>'
                : '<button onclick="ingresarEmpresa(\'' + emp.id + '\')" class="empresa-btn blue">Ingresar</button>';
            row.innerHTML = '<div class="flex-1 min-w-0">' + nameHtml + '</div>' +
                '<div class="flex items-center gap-2 flex-shrink-0 ml-4">' +
                actionBtn +
                '<button onclick="openEmpresaModal(' + i + ')" class="empresa-btn ghost">Editar</button>' +
                '<button onclick="eliminarEmpresa(' + i + ')" class="empresa-btn danger">Eliminar</button>' +
                '</div>';
            list.appendChild(row);
        });
        lucide.createIcons();
    }

    // ══════════════════════════════════════════════
    // CRUD EMPRESA (MODAL)
    // ══════════════════════════════════════════════
    function openEmpresaModal(index) {
        if (index === undefined) index = -1;
        document.getElementById('emp_editIndex').value = index;
        document.getElementById('emp_razon').value = '';
        document.getElementById('emp_nit').value = '';
        document.getElementById('emp_nrc').value = '';
        document.getElementById('emp_tipo_ing').value = '1';
        document.getElementById('emp_sector').value = '1';
        document.getElementById('emp_correos_activo').value = '0';
        document.getElementById('emp_correo_email').value = '';
        document.getElementById('emp_correo_pass').value = '';
        _setEmpCorreosToggle(false);
        document.getElementById('emp_facturacion_activo').value = '0';
        document.getElementById('emp_fe_usuario').value = '';
        document.getElementById('emp_fe_clave_acceso').value = '';
        document.getElementById('emp_fe_clave_privada').value = '';
        _setEmpFacturacionToggle(false);
        clearFieldError('emp_nit', 'emp_nit_error');
        clearFieldError('emp_nrc', 'emp_nrc_error');

        if (index !== -1) {
            var emp = empresas[index];
            var isReconstructed = emp._reconstructed || /^emp_\d+_[a-z0-9]+$/i.test(emp.razon);
            document.getElementById('empresaModalTitle').innerText = isReconstructed ? 'Completar Empresa Restaurada' : 'Editar Empresa';
            document.getElementById('emp_razon').value = isReconstructed ? '' : emp.razon;
            document.getElementById('emp_nit').value = emp.nit;
            document.getElementById('emp_nrc').value = emp.nrc;
            document.getElementById('emp_tipo_ing').value = emp.tipoIng || '1';
            document.getElementById('emp_sector').value = emp.sector || '1';
            if (emp.correosActivo) {
                document.getElementById('emp_correos_activo').value = '1';
                document.getElementById('emp_correo_email').value = emp.correosEmail || '';
                _setEmpCorreosToggle(true);
            }
            if (emp.facturacionElectronica) {
                document.getElementById('emp_facturacion_activo').value = '1';
                document.getElementById('emp_fe_usuario').value = emp.feUsuario || '';
                // Implementación 01 — las claves nunca se muestran en claro al
                // reabrir el formulario: el campo queda vacío y solo se
                // sobrescribe el valor guardado si el usuario escribe uno nuevo
                // (ver saveEmpresa). Igual que ya hace correosPass arriba.
                document.getElementById('emp_fe_clave_acceso').value = '';
                document.getElementById('emp_fe_clave_privada').value = '';
                _setEmpFacturacionToggle(true);
            }
        } else {
            document.getElementById('empresaModalTitle').innerText = 'Nueva Empresa';
        }
        document.getElementById('empresaModalForm').style.display='flex'; document.getElementById('empresaModalForm').classList.add('modal-open');
        lucide.createIcons();
    }

    function toggleEmpCorreosFields() {
        var activo = document.getElementById('emp_correos_activo').value === '1';
        activo = !activo;
        document.getElementById('emp_correos_activo').value = activo ? '1' : '0';
        _setEmpCorreosToggle(activo);
    }
    function _setEmpCorreosToggle(on) {
        var tog   = document.getElementById('emp_correos_toggle');
        var thumb = document.getElementById('emp_correos_thumb');
        var creds = document.getElementById('empCorreosCreds');
        if (on) {
            tog.style.background   = '#4f46e5';
            thumb.style.left       = '20px';
            thumb.style.background = '#fff';
            creds.style.display    = 'block';
        } else {
            tog.style.background   = 'var(--rp-border-strong)';
            thumb.style.left       = '2px';
            thumb.style.background = 'var(--rp-text-secondary)';
            creds.style.display    = 'none';
        }
    }

    // Implementación 01 — Facturación Electrónica: mismo patrón de toggle
    // que "Módulo de Correos DTE" (arriba), pero sin campos adicionales —
    // solo decide si esta empresa muestra la pantalla intermedia al
    // ingresar (ver ingresarEmpresa()).
    function toggleEmpFacturacionField() {
        var activo = document.getElementById('emp_facturacion_activo').value === '1';
        activo = !activo;
        document.getElementById('emp_facturacion_activo').value = activo ? '1' : '0';
        _setEmpFacturacionToggle(activo);
    }
    function _setEmpFacturacionToggle(on) {
        var tog   = document.getElementById('emp_facturacion_toggle');
        var thumb = document.getElementById('emp_facturacion_thumb');
        var creds = document.getElementById('empFacturacionCreds');
        if (!tog || !thumb) return;
        if (on) {
            tog.style.background   = '#4f46e5';
            thumb.style.left       = '20px';
            thumb.style.background = '#fff';
            if (creds) creds.style.display = 'block';
        } else {
            tog.style.background   = 'var(--rp-border-strong)';
            thumb.style.left       = '2px';
            thumb.style.background = 'var(--rp-text-secondary)';
            if (creds) creds.style.display = 'none';
        }
    }

    function closeEmpresaModal() {
        _cerrarModalAnimado('empresaModalForm');
    }

    function saveEmpresa() {
        var index = parseInt(document.getElementById('emp_editIndex').value);
        var razon = document.getElementById('emp_razon').value.trim();
        var nit   = document.getElementById('emp_nit').value.trim();
        var nrc   = document.getElementById('emp_nrc').value.trim();
        var tipoIng = document.getElementById('emp_tipo_ing').value;
        var sector  = document.getElementById('emp_sector').value;
        var correosActivo = document.getElementById('emp_correos_activo').value === '1';
        var correosEmail  = document.getElementById('emp_correo_email').value.trim();
        var correosPass   = document.getElementById('emp_correo_pass').value;
        var facturacionElectronica = document.getElementById('emp_facturacion_activo').value === '1';
        var feUsuario       = document.getElementById('emp_fe_usuario').value.trim();
        var feClaveAcceso   = document.getElementById('emp_fe_clave_acceso').value;
        var feClavePrivada  = document.getElementById('emp_fe_clave_privada').value;

        if (!razon) { showToast('La Razón Social es obligatoria', 'error'); return; }

        var valid = true;

        if (nit && !isValidDuiOrNit(nit)) {
            setFieldError('emp_nit', 'emp_nit_error');
            valid = false;
        } else {
            clearFieldError('emp_nit', 'emp_nit_error');
        }

        if (nrc && !isValidNrc(nrc)) {
            setFieldError('emp_nrc', 'emp_nrc_error');
            valid = false;
        } else {
            clearFieldError('emp_nrc', 'emp_nrc_error');
        }

        if (correosActivo && !correosEmail) { showToast('Ingresa el correo de envío para activar el módulo', 'error'); return; }
        if (correosActivo && !correosPass && index === -1) { showToast('Ingresa la contraseña de aplicación', 'error'); return; }

        // Implementación 01 — Facturación Electrónica: los tres datos son
        // obligatorios solo si el módulo está habilitado, y las claves solo
        // se exigen al crear la empresa (al editar, dejarlas en blanco
        // conserva la clave ya guardada — mismo patrón que Correos DTE).
        if (facturacionElectronica && !feUsuario) { showToast('Ingresa el NIT/DUI de Facturación Electrónica', 'error'); return; }
        if (facturacionElectronica && !feClaveAcceso && index === -1) { showToast('Ingresa la Clave de Acceso de Facturación Electrónica', 'error'); return; }
        if (facturacionElectronica && !feClavePrivada && index === -1) { showToast('Ingresa la Clave Privada de Facturación Electrónica', 'error'); return; }

        if (!valid) { showToast('Corrige los campos con formato incorrecto', 'error'); return; }



        if (index === -1) {
            var id = 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            empresas.push({
                id: id, razon: razon, nit: nit, nrc: nrc, tipoIng: tipoIng, sector: sector,
                correosActivo: correosActivo,
                correosEmail: correosActivo ? correosEmail : '',
                correosPass:  correosActivo && correosPass ? _correosSimpleCipher(correosPass) : '',
                facturacionElectronica: facturacionElectronica,
                // Implementación 01 — credenciales de Facturación Electrónica,
                // independientes por empresa (ver saveEmpresa/openEmpresaModal).
                feUsuario:      facturacionElectronica ? feUsuario : '',
                feClaveAcceso:  facturacionElectronica && feClaveAcceso  ? _correosSimpleCipher(feClaveAcceso)  : '',
                feClavePrivada: facturacionElectronica && feClavePrivada ? _correosSimpleCipher(feClavePrivada) : ''
            });
        } else {
            empresas[index].razon   = razon;
            empresas[index].nit     = nit;
            empresas[index].nrc     = nrc;
            empresas[index].tipoIng = tipoIng;
            empresas[index].sector  = sector;
            empresas[index].correosActivo = correosActivo;
            empresas[index].facturacionElectronica = facturacionElectronica;
            delete empresas[index]._reconstructed;
            if (correosActivo) {
                empresas[index].correosEmail = correosEmail;
                if (correosPass) empresas[index].correosPass = _correosSimpleCipher(correosPass);
            }
            if (facturacionElectronica) {
                empresas[index].feUsuario = feUsuario;
                if (feClaveAcceso)  empresas[index].feClaveAcceso  = _correosSimpleCipher(feClaveAcceso);
                if (feClavePrivada) empresas[index].feClavePrivada = _correosSimpleCipher(feClavePrivada);
            }
        }

        saveEmpresas();
        renderEmpresaList();
        closeEmpresaModal();
        showToast(index === -1 ? 'Empresa creada' : 'Empresa actualizada', 'success');
    }

    function eliminarEmpresa(index) {
        var emp = empresas[index];
        fsConfirm('¿Eliminar la empresa "' + emp.razon + '" y TODOS sus datos mensuales?\n\nEsta acción no se puede deshacer.', function() {

        // Corrección 01 — por seguridad: si por algún motivo quedaba una
        // instancia viva de Facturación Electrónica asociada a esta
        // empresa (normalmente ya no, porque para llegar a esta pantalla
        // ya se pasó por volverAEmpresas(), que la destruye), se destruye
        // también aquí antes de eliminar la empresa.
        if (_facturacionElecActiva.empresaId === emp.id) _destruirWebviewFacturacion();

        var prefix = 'fs_data_v' + APP_VERSION + '_' + emp.id + '_';
        var keysToRemove = [];
        for (var i = 0; i < fsStore.length(); i++) {
            var key = fsStore.key(i);
            if (key && key.startsWith(prefix)) keysToRemove.push(key);
        }
        keysToRemove.forEach(function(k) { fsStore.removeItem(k); });
        // AGREGADO NUEVO: eliminar catálogo de proveedores de la empresa
        fsStore.removeItem('fs_prov_v' + APP_VERSION + '_' + emp.id);

        empresas.splice(index, 1);
        saveEmpresas();
        renderEmpresaList();
        showToast('Empresa eliminada', 'success');
    }); }

    // ══════════════════════════════════════════════
    // INGRESAR A EMPRESA
    // ══════════════════════════════════════════════
    // Implementación 01 — Facturación Electrónica: única decisión nueva en
    // todo el flujo de entrada. Si la empresa NO tiene la función
    // habilitada, el comportamiento es EXACTAMENTE el de siempre (entra
    // directo a Gestión — ver _entrarModoGestion). Si la tiene habilitada,
    // se muestra la pantalla intermedia y es esa pantalla la que decide,
    // según el botón que el usuario presione, a cuál de los dos módulos
    // entrar.
    function ingresarEmpresa(empresaId) {
        var emp = empresas.find(function(e) { return e.id === empresaId; });
        if (!emp) return;

        if (emp.facturacionElectronica) {
            _mostrarSeleccionEntradaEmpresa(empresaId);
            return;
        }

        _entrarModoGestion(empresaId);
    }

    // Pantalla intermedia "¿A dónde desea ingresar?" — guarda temporalmente
    // qué empresa se está por abrir mientras el usuario elige.
    var _facturacionEmpresaIdPendiente = null;

    function _mostrarSeleccionEntradaEmpresa(empresaId) {
        var emp = empresas.find(function(e) { return e.id === empresaId; });
        if (!emp) return;
        _facturacionEmpresaIdPendiente = empresaId;
        document.getElementById('facturacionSelectEmpresaNombre').innerText = emp.razon;
        _mostrarPantalla('facturacionSelectScreen', 'empresaScreen');
    }

    function _volverAEmpresasDesdeSeleccion() {
        // Corrección 01 — aquí SÍ se sale completamente de la empresa
        // (el usuario nunca llegó a entrar a Facturación Electrónica, pero
        // por si ya existía una instancia viva de una entrada anterior a
        // esta misma empresa, se destruye igual — es "salir de empresa").
        _destruirWebviewFacturacion();
        _facturacionEmpresaIdPendiente = null;
        // Corrección 02 — con _salirDeGestion() ahora también se puede
        // llegar aquí con una sesión de Gestión todavía "activa" en
        // memoria (el usuario venía de Gestión, no directo de la lista de
        // empresas). Al salir de verdad de la empresa hay que limpiarla
        // igual que hace volverAEmpresas(), o quedaría activeEmpresaId
        // apuntando a una empresa que ya no está abierta.
        if (activeEmpresaId) {
            activeEmpresaId = null;
            resetInMemoryRecords();
            _sincronizarEmpresaActivaQR();
        }
        _mostrarPantalla('empresaScreen', 'facturacionSelectScreen');
        renderEmpresaList();
        _restaurarBusquedaEmpresas(); // AGREGADO (Cambio 04)
        lucide.createIcons();
    }

    // Contiene EXACTAMENTE la misma lógica que antes tenía ingresarEmpresa()
    // — solo se le agregó el parámetro idPantallaOrigen para poder llegar
    // aquí tanto desde la lista de empresas (comportamiento normal) como
    // desde la pantalla intermedia de Facturación Electrónica.
    function _entrarModoGestion(empresaId, idPantallaOrigen) {
        var emp = empresas.find(function(e) { return e.id === empresaId; });
        if (!emp) return;

        // ═══ AGREGADO NUEVO: CONTROL DE IMPORTACIÓN ═══
        // Limpiar cola y estructuras temporales al cambiar de empresa
        clearQueue();

        // Limpiar memoria de resolución/serie y fecha manual al cambiar empresa
        _cfActiveRes = { resolucion: '', serie: '' };
        _dActiveRes  = { resolucion: '', serie: '' };
        _cfLastManualDate = '';
        _dLastManualDate  = '';

        activeEmpresaId = empresaId;

        document.getElementById('topbarEmpresaName').innerText = emp.razon;
        document.getElementById('topbarEmpresaId').innerText = 'DUI/NIT: ' + (emp.nit || '—') + '  ·  NRC: ' + (emp.nrc || '—');

        loadCurrentMonthData();
        renderAllTables();
        updateMonthLabel();

        // AJUSTADO — Cambio 07 (Animaciones): transición visual al entrar
        // a una empresa, en vez de un cambio instantáneo.
        _mostrarPantalla('workspaceContainer', idPantallaOrigen || 'empresaScreen');

        // Mostrar/ocultar nav de correos según configuración de empresa
        var navCorreos = document.getElementById('navCorreosWrap');
        if (navCorreos) navCorreos.style.display = emp.correosActivo ? 'block' : 'none';

        switchScreen('homeScreen');
        lucide.createIcons();

        // CAMBIO — Actualización dinámica de empresa: si el módulo de
        // escaneo QR sigue abierto/minimizado de una empresa anterior, se
        // le envía de inmediato el nombre y los catálogos de ESTA empresa,
        // sin cerrar ni reabrir el módulo.
        _sincronizarEmpresaActivaQR();
    }

    // ══════════════════════════════════════════════════════════════════
    // Corrección 02 — botón "Volver" de Gestión: si la empresa activa
    // tiene Facturación Electrónica habilitada, salir de Gestión regresa
    // a "¿A dónde desea ingresar?" (la empresa sigue activa: NO se
    // destruye el <webview> de Facturación Electrónica ni se pierde su
    // sesión — ver puntos 4 y 6 de Corrección 02). Solo "Volver a
    // Empresas" desde esa pantalla intermedia (_volverAEmpresasDesdeSeleccion)
    // sale de verdad de la empresa. Para empresas SIN Facturación
    // Electrónica el comportamiento es EXACTAMENTE el de siempre: salir
    // de Gestión sale directo a la lista de empresas (volverAEmpresas).
    // ══════════════════════════════════════════════════════════════════
    function _salirDeGestion() {
        var empActiva = empresas.find(function(e) { return e.id === activeEmpresaId; });
        if (empActiva && empActiva.facturacionElectronica) {
            saveCurrentMonthData();
            // La pantalla de selección lee de esta variable para saber sobre
            // qué empresa actuar cuando el usuario elija Gestión o
            // Facturación Electrónica (ver _entrarModoGestionDesdeSeleccion /
            // _entrarModoFacturacionElectronica).
            _facturacionEmpresaIdPendiente = empActiva.id;
            document.getElementById('facturacionSelectEmpresaNombre').innerText = empActiva.razon;
            _mostrarPantalla('facturacionSelectScreen', 'workspaceContainer');
            lucide.createIcons();
            return;
        }
        volverAEmpresas();
    }

    // ══════════════════════════════════════════════
    // VOLVER A EMPRESAS
    // ══════════════════════════════════════════════
    function volverAEmpresas() {
        saveCurrentMonthData();

        // Corrección 01 — salir de la empresa (a diferencia de solo salir
        // de Facturación Electrónica hacia "¿A dónde desea ingresar?")
        // destruye por completo el <webview> de esta empresa, si existía
        // uno. La próxima vez que se entre a esta empresa se crea uno
        // nuevo desde cero (ver _asegurarWebviewFacturacion).
        _destruirWebviewFacturacion();

        activeEmpresaId = null;
        resetInMemoryRecords();

        // AJUSTADO — Cambio 07 (Animaciones): transición visual al volver
        // a la pantalla de empresas, en vez de un cambio instantáneo.
        _mostrarPantalla('empresaScreen', 'workspaceContainer');

        renderEmpresaList();
        _restaurarBusquedaEmpresas(); // AGREGADO (Cambio 04)
        lucide.createIcons();

        // CAMBIO — Actualización dinámica de empresa: si el módulo de
        // escaneo QR sigue abierto/minimizado, se limpia de inmediato en el
        // teléfono el nombre de empresa y los catálogos (activeEmpresaId ya
        // es null aquí), para que no quede mostrando ni usando datos de la
        // empresa que se acaba de dejar mientras no hay una empresa activa.
        _sincronizarEmpresaActivaQR();
    }

    // Agregado 01 — bloque de trabajo compartido que se ejecuta cada vez
    // que cambia el período (currentMonth/currentYear) de Gestión, sea
    // porque el usuario usó las flechas de Gestión (changeMonth) o
    // porque el mes se sincronizó desde Facturación Electrónica (ver
    // _sincronizarMesGestionConFE). Extraído de changeMonth() sin
    // modificar su comportamiento, para no duplicar esta lógica.
    function _aplicarCambioDePeriodoGestion() {
        // Limpiar memoria de resolución/serie y fecha al cambiar período
        _cfActiveRes = { resolucion: '', serie: '' };
        _dActiveRes  = { resolucion: '', serie: '' };
        _cfLastManualDate = '';
        _dLastManualDate  = '';

        // Desactivar Modo Revisión al cambiar período
        _revisionActive = { debito: false, cf: false, compras: false, percibido: false, retenido: false, anticipo: false, excluido: false, f14: false };
        ['btnRevisionDebito','btnRevisionCf','btnRevisionCompras','btnRevisionPercibido','btnRevisionRetenido','btnRevisionAnticipo','btnRevisionExcluido','btnRevisionF14'].forEach(function(id) {
            var b = document.getElementById(id);
            if (b) b.classList.remove('btn-revision-active');
        });

        loadCurrentMonthData();
        renderAllTables();
        updateMonthLabel();
        updateExportCounts();
        updateLibrosLegalesCounts();
        refreshOpenLibroLegal(); // AGREGADO NUEVO: si hay un Libro Legal abierto, lo refresca con los datos del nuevo mes

        // Refrescar Correos al cambiar mes — cada mes tiene su propia lista
        correosRenderTabla();
        correosRenderHistorial();
        correosActualizarStats();
    }

    // ══════════════════════════════════════════════════════════════════
    // FILTRAR EMPRESAS EN PANTALLA DE SELECCIÓN
    // ══════════════════════════════════════════════════════════════════
    // AGREGADO NUEVO (Cambio 04) — guarda el texto de búsqueda tal como se
    // escribió, para poder restaurarlo al volver al listado de empresas
    // (ver _restaurarBusquedaEmpresas más abajo). No afecta ninguna otra
    // barra de búsqueda ni ningún otro filtro.
    var _empresaSearchQuery = '';

    function filtrarEmpresas() {
        var inputEl = document.getElementById('empresaSearch');
        _empresaSearchQuery = inputEl ? inputEl.value : ''; // AGREGADO (Cambio 04)
        var q = (inputEl ? inputEl.value.toLowerCase() : '');
        var rows = document.querySelectorAll('#empresaList .empresa-row');
        rows.forEach(function(row) {
            var txt = row.textContent.toLowerCase();
            row.style.display = (!q || txt.indexOf(q) !== -1) ? '' : 'none';
        });
    }

    // AGREGADO NUEVO (Cambio 04) — restaura en la barra el texto guardado
    // por filtrarEmpresas() y vuelve a aplicar el filtro sobre las filas
    // recién generadas por renderEmpresaList(). Se llama únicamente en los
    // puntos donde se regresa al listado de empresas después de haber
    // entrado a una (volverAEmpresas / _volverAEmpresasDesdeSeleccion).
    function _restaurarBusquedaEmpresas() {
        var inputEl = document.getElementById('empresaSearch');
        if (inputEl) inputEl.value = _empresaSearchQuery;
        filtrarEmpresas();
    }