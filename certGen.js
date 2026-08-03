// ══════════════════════════════════════════════════════════════════════
// certGen.js — Cambio 01 (Escaneo QR)
// Genera (o reutiliza) un certificado autofirmado para el servidor HTTPS
// local que atiende al teléfono durante el escaneo de documentos físicos.
// Se guarda en userData/qr-cert/ (cert.pem + key.pem) y se reutiliza
// mientras no esté vencido, para no pedirle al usuario que acepte la
// advertencia de seguridad del certificado en el teléfono más de una vez
// por instalación (salvo que cambie de red/IP con frecuencia — el
// certificado incluye TODAS las IPs de red detectadas al momento de
// generarlo, así que sigue sirviendo aunque cambie de LAN mientras esas
// IPs no cambien).
//
// Requiere el paquete 'selfsigned' (npm install selfsigned).
// Si no está instalado, se informa con un error claro en vez de tronar.
// ══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const os = require('os');

const CERT_MAX_AGE_DIAS = 350; // se regenera antes de llegar a los 825 días de validez del cert

function getCertDir(app) {
  return path.join(app.getPath('userData'), 'qr-cert');
}

// Recolecta todas las IPv4 de la máquina (LAN, WiFi, etc.) para incluirlas
// como Subject Alternative Names del certificado — así sirve sin importar
// a cuál red esté conectada la PC al momento de escanear.
function listarIPsLocales() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.keys(ifaces).forEach(function (nombre) {
    (ifaces[nombre] || []).forEach(function (iface) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    });
  });
  return ips;
}

function construirAltNames() {
  const altNames = [
    { type: 2, value: 'localhost' } // type 2 = DNS
  ];
  listarIPsLocales().forEach(function (ip) {
    altNames.push({ type: 7, ip: ip }); // type 7 = IP
  });
  altNames.push({ type: 7, ip: '127.0.0.1' });
  return altNames;
}

// Devuelve { cert, key } — genera uno nuevo si no existe o si está por vencer.
// NOTA: en selfsigned v5.x, generate() es async (devuelve una Promise), por
// eso esta función también es async y debe llamarse con await.
async function obtenerCertificado(app) {
  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch (e) {
    throw new Error('El paquete "selfsigned" no está instalado. Ejecuta: npm install selfsigned en la carpeta del proyecto. (' + e.message + ')');
  }

  const dir = getCertDir(app);
  const certPath = path.join(dir, 'cert.pem');
  const keyPath = path.join(dir, 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const stat = fs.statSync(certPath);
      const ageDias = (Date.now() - stat.mtimeMs) / 86400000;
      if (ageDias < CERT_MAX_AGE_DIAS) {
        return {
          cert: fs.readFileSync(certPath, 'utf8'),
          key: fs.readFileSync(keyPath, 'utf8')
        };
      }
    } catch (e) {
      // si algo falla leyendo el existente, cae al bloque de abajo y regenera
    }
  }

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const attrs = [{ name: 'commonName', value: 'FiscalSync Local' }];
  const pems = await selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      { name: 'subjectAltName', altNames: construirAltNames() }
    ]
  });

  fs.writeFileSync(certPath, pems.cert, 'utf8');
  fs.writeFileSync(keyPath, pems.private, 'utf8');

  return { cert: pems.cert, key: pems.private };
}

module.exports = { obtenerCertificado, listarIPsLocales };
