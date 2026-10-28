/**
 * Módulo Criptográfico de Seguridad para Boletos y Pases Digitales QR
 * Implementa firma y verificación HMAC-SHA256 compatible con Web Crypto API
 * Permite validación a bordo sin señal celular (Offline-First en IndexedDB).
 */

const DEFAULT_SECRET_SEED = 'VILCABAMBATURIS-TRANSIT-SECURE-KEY-2026-X99';

/**
 * Convierte un ArrayBuffer a cadena hexadecimal
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Genera firma criptográfica HMAC-SHA256 para el boleto
 */
export async function generateTicketHmac(
  payload: {
    tenantId: string;
    codigoUnico: string;
    turnoId: string;
    numeroAsiento: number;
    origen: string;
    destino: string;
    compradorCedula: string;
  },
  secretKey: string = DEFAULT_SECRET_SEED
): Promise<string> {
  const canonicalString = `${payload.tenantId}|${payload.codigoUnico}|${payload.turnoId}|${payload.numeroAsiento}|${payload.origen}|${payload.destino}|${payload.compradorCedula}`;

  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      const keyData = enc.encode(secretKey);
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await window.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        enc.encode(canonicalString)
      );
      return bufferToHex(signature).substring(0, 32); // Primeros 32 caracteres hex (128 bits) para QR compacto
    }
  } catch (err) {
    console.warn('Fallback a digest manual HMAC:', err);
  }

  // Fallback determinista ligero
  return simpleHmacFallback(canonicalString, secretKey);
}

/**
 * Valida la firma HMAC de un boleto (utilizado por el ayudante a bordo en modo Offline)
 */
export async function verifyTicketHmac(
  payload: {
    tenantId: string;
    codigoUnico: string;
    turnoId: string;
    numeroAsiento: number;
    origen: string;
    destino: string;
    compradorCedula: string;
  },
  signatureToVerify: string,
  secretKey: string = DEFAULT_SECRET_SEED
): Promise<boolean> {
  const expectedSignature = await generateTicketHmac(payload, secretKey);
  return expectedSignature.toLowerCase() === signatureToVerify.trim().toLowerCase();
}

/**
 * Genera el string codificado para el código QR del boleto
 */
export function buildQrPayload(
  boleto: {
    codigoUnico: string;
    tenantId: string;
    turnoId: string;
    numeroAsiento: number;
    origen: string;
    destino: string;
    puntoAbordaje: string;
    compradorCedula: string;
    compradorNombre: string;
    firmaDigitalHmac: string;
  },
  horaSalida: string,
  busDisco: string
): string {
  const compactObject = {
    v: 1, // Versión protocolo
    c: boleto.codigoUnico,
    t: boleto.tenantId,
    u: boleto.turnoId,
    s: boleto.numeroAsiento,
    o: boleto.origen,
    d: boleto.destino,
    p: boleto.puntoAbordaje,
    n: boleto.compradorNombre,
    id: boleto.compradorCedula,
    h: horaSalida,
    b: busDisco,
    sig: boleto.firmaDigitalHmac
  };
  return JSON.stringify(compactObject);
}

/**
 * Parsea el contenido leído del código QR
 */
export function parseQrPayload(rawContent: string): {
  validFormat: boolean;
  data?: {
    version: number;
    codigoUnico: string;
    tenantId: string;
    turnoId: string;
    numeroAsiento: number;
    origen: string;
    destino: string;
    puntoAbordaje: string;
    compradorNombre: string;
    compradorCedula: string;
    horaSalida: string;
    busDisco: string;
    firmaDigitalHmac: string;
  };
} {
  try {
    const parsed = JSON.parse(rawContent.trim());
    if (parsed.c && parsed.s && parsed.sig) {
      return {
        validFormat: true,
        data: {
          version: parsed.v || 1,
          codigoUnico: parsed.c,
          tenantId: parsed.t || 'tenant-vilcabambaturis',
          turnoId: parsed.u || '',
          numeroAsiento: Number(parsed.s),
          origen: parsed.o || 'Loja',
          destino: parsed.d || 'Vilcabamba',
          puntoAbordaje: parsed.p || 'Terminal',
          compradorNombre: parsed.n || 'Pasajero',
          compradorCedula: parsed.id || '',
          horaSalida: parsed.h || '',
          busDisco: parsed.b || '',
          firmaDigitalHmac: parsed.sig
        }
      };
    }
  } catch {
    // Si no es JSON, verificar si es código directo simple (ej: VILCA-2026-XXXX)
    if (rawContent.startsWith('VILCA-')) {
      return {
        validFormat: true,
        data: {
          version: 1,
          codigoUnico: rawContent.trim(),
          tenantId: 'tenant-vilcabambaturis',
          turnoId: '',
          numeroAsiento: 0,
          origen: '',
          destino: '',
          puntoAbordaje: '',
          compradorNombre: '',
          compradorCedula: '',
          horaSalida: '',
          busDisco: '',
          firmaDigitalHmac: ''
        }
      };
    }
  }
  return { validFormat: false };
}

function simpleHmacFallback(message: string, key: string): string {
  let hash = 0;
  const combined = message + '::' + key;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return (hex + '88a3f9104cde72b1').substring(0, 32);
}
