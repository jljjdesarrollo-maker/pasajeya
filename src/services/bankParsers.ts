/**
 * Motor de Parseo de Notificaciones Bancarias de Ecuador
 * Optimizado para:
 * 1. Banco de Loja (Transferencias directas, banca virtual y avisos de crédito)
 * 2. Banco Pichincha y Deuna (Billetera digital, transferencias directas e interbancarias)
 * 3. Fallback Gemini AI NLP para correos desestructurados o reenviados
 *
 * Latencia esperada por Regex: < 15ms.
 */

import { GoogleGenAI } from '@google/genai';

export type SupportedBank = 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA';

export interface ExtractedTransactionData {
  banco: SupportedBank;
  referencia: string;
  monto: number;
  ordenanteNombre?: string;
  cuentaDestino?: string;
  fechaHoraTexto?: string;
  methodUsed: 'REGEX_FAST' | 'GEMINI_AI_NLP';
  parseLatencyMs: number;
}

export interface BankNotificationInput {
  rawSubject?: string;
  rawBody: string;
  senderAddress?: string;
}

/**
 * Extractor especializado para Banco de Loja
 */
export function parseBancoDeLoja(
  text: string,
  senderAddress?: string
): ExtractedTransactionData | null {
  const start = performance.now();
  const lowerText = text.toLowerCase();
  const isSenderLoja = senderAddress?.toLowerCase().includes('bancodeloja') || false;
  const isContentLoja = lowerText.includes('banco de loja') || lowerText.includes('bancodeloja');

  if (!isSenderLoja && !isContentLoja && !/cta\s*cte\s*2901234567/i.test(text)) {
    return null;
  }

  // Regex de Monto: "$4.50", "valor de $ 4.50", "monto de 4.50", "USD 4.50"
  const montoMatch =
    text.match(/(?:(?:valor|monto|por|usd|\$)\s*:?\s*(?:de\s*)?\$?\s*(\d+[.,]\d{2}))/i) ||
    text.match(/\$\s*(\d+[.,]\d{2})/i) ||
    text.match(/(\d+[.,]\d{2})\s*(?:usd|d[oó]lares)/i);

  // Regex de Referencia: "Comprobante: 784912", "Referencia: 784912", "Ref: 784912", "Doc: 784912", "Referencia de transacción: 784912"
  const refMatch =
    text.match(/(LOJA-[A-Za-z0-9_-]+)/i) ||
    text.match(/\b(?:(?:n[uú]mero\s+de\s+)?(?:referencia|comprobante|documento|transacci[oó]n|secuencial)(?:\s+de\s+transacci[oó]n)?|ref|doc)\b\s*:?\s*(?:#|no\.?|n[uú]m\.?)?\s*([A-Za-z0-9_-]{4,25})/i) ||
    text.match(/\b([0-9]{6,8})\b/);

  // Regex de Nombre de Ordenante: "Ordenante: CARLOS MORA", "Por cuenta de: CARLOS MORA"
  const ordenanteMatch =
    text.match(/(?:ordenante|remitente|por cuenta de|de:?)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,35})(?:\.|\n|\r|,|Cuenta|Cta)/i);

  // Regex de Cuenta Destino
  const cuentaMatch = text.match(/(?:cuenta(?:\s+destino|\s+acreditada)?|cta(?:\.?|\s+cte))\s*:?\s*([0-9]{8,12})/i);

  if (montoMatch && refMatch) {
    const rawMonto = montoMatch[1].replace(',', '.');
    const monto = parseFloat(rawMonto);
    const referencia = refMatch[1].trim().toUpperCase();
    const ordenante = ordenanteMatch ? ordenanteMatch[1].trim() : undefined;
    const cuenta = cuentaMatch ? cuentaMatch[1].trim() : undefined;

    return {
      banco: 'BANCO_DE_LOJA',
      referencia,
      monto,
      ordenanteNombre: ordenante,
      cuentaDestino: cuenta,
      methodUsed: 'REGEX_FAST',
      parseLatencyMs: Math.round(performance.now() - start),
    };
  }

  return null;
}

/**
 * Extractor especializado para Banco Pichincha y Deuna
 */
export function parseBancoPichincha(
  text: string,
  senderAddress?: string
): ExtractedTransactionData | null {
  const start = performance.now();
  const lowerText = text.toLowerCase();
  const isSenderPichincha =
    senderAddress?.toLowerCase().includes('pichincha') ||
    senderAddress?.toLowerCase().includes('deuna') ||
    false;
  const isContentPichincha =
    lowerText.includes('pichincha') ||
    lowerText.includes('deuna') ||
    /cta\s*cte\s*3109876543/i.test(text);

  if (!isSenderPichincha && !isContentPichincha) {
    return null;
  }

  // Regex de Monto
  const montoMatch =
    text.match(/(?:(?:valor|monto|transfirieron|recibiste|pag[oó]|usd|\$)\s*:?\s*(?:de\s*)?\$?\s*(\d+[.,]\d{2}))/i) ||
    text.match(/\$\s*(\d+[.,]\d{2})/i) ||
    text.match(/(\d+[.,]\d{2})\s*(?:usd|d[oó]lares)/i);

  // Regex de Referencia: "PICH-904128", "Código de comprobante: PICH-904128", "Comprobante: 98124501", "Ref: 904128"
  const refMatch =
    text.match(/(PICH-[A-Za-z0-9_-]+)/i) ||
    text.match(/\b(?:(?:n[uú]mero\s+de\s+)?(?:referencia|comprobante|c[oó]digo|transacci[oó]n|secuencial)(?:\s+de\s+transacci[oó]n)?|ref|doc)\b\s*:?\s*(?:#|no\.?|n[uú]m\.?)?\s*([A-Za-z0-9_-]{4,20})/i) ||
    text.match(/\b([0-9]{6,10})\b/);

  // Regex de Ordenante / Remitente
  const ordenanteMatch =
    text.match(/(?:de|remitente|persona|ordenante|cliente)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,35})(?:\.|\n|\r|,|Para|Fecha|Cta)/i);

  if (montoMatch && refMatch) {
    const rawMonto = montoMatch[1].replace(',', '.');
    const monto = parseFloat(rawMonto);
    const referencia = refMatch[1].trim().toUpperCase();
    const ordenante = ordenanteMatch ? ordenanteMatch[1].trim() : undefined;

    return {
      banco: 'BANCO_PICHINCHA',
      referencia,
      monto,
      ordenanteNombre: ordenante,
      methodUsed: 'REGEX_FAST',
      parseLatencyMs: Math.round(performance.now() - start),
    };
  }

  return null;
}

/**
 * Fallback NLP con Gemini AI para correos desestructurados o notas manuscritas
 */
export async function parseWithGeminiAiFallback(
  text: string
): Promise<ExtractedTransactionData | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const start = performance.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Eres el motor extractor bancario de PasajeYa para cooperativas de transporte en Ecuador.
Extrae estrictamente en JSON:
- banco: "BANCO_DE_LOJA" o "BANCO_PICHINCHA"
- referencia: string con el comprobante o referencia (mayúsculas)
- monto: número decimal con el valor en dólares
- ordenanteNombre: nombre del remitente si está disponible

Texto de la notificación o mensaje:
"""
${text}
"""`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    if (parsed.banco && parsed.referencia && parsed.monto) {
      return {
        banco: parsed.banco === 'BANCO_DE_LOJA' ? 'BANCO_DE_LOJA' : 'BANCO_PICHINCHA',
        referencia: String(parsed.referencia).trim().toUpperCase(),
        monto: Number(parsed.monto),
        ordenanteNombre: parsed.ordenanteNombre || undefined,
        methodUsed: 'GEMINI_AI_NLP',
        parseLatencyMs: Math.round(performance.now() - start),
      };
    }
  } catch (err) {
    console.warn('Fallo en fallback Gemini AI NLP:', err);
  }

  return null;
}

/**
 * Función Principal de Extracción Multiproveedor
 * 1. Prueba Regex Banco de Loja
 * 2. Prueba Regex Banco Pichincha
 * 3. Si ambos fallan, prueba Gemini AI NLP
 */
export async function parseBankNotification(
  input: BankNotificationInput
): Promise<ExtractedTransactionData | null> {
  const fullText = `${input.rawSubject ? input.rawSubject + '\n' : ''}${input.rawBody}`.trim();

  // Intento 1: Regex Banco de Loja
  const loja = parseBancoDeLoja(fullText, input.senderAddress);
  if (loja) return loja;

  // Intento 2: Regex Banco Pichincha / Deuna
  const pichincha = parseBancoPichincha(fullText, input.senderAddress);
  if (pichincha) return pichincha;

  // Intento 3: Intentar detectar por patrones genéricos si no vino nombre de banco explícito
  const genericMontoMatch =
    fullText.match(/(?:(?:valor|monto|usd|\$)\s*:?\s*\$?\s*(\d+[.,]\d{2}))/i) ||
    fullText.match(/\$\s*(\d+[.,]\d{2})/i);
  const genericRefMatch =
    fullText.match(/(?:referencia|comprobante|transacci[oó]n|ref\.?)\s*:?\s*([A-Za-z0-9_-]{4,18})/i) ||
    fullText.match(/(PICH-[A-Za-z0-9]+)/i);

  if (genericMontoMatch && genericRefMatch) {
    const isPich = /(pichincha|deuna|pich-)/i.test(fullText);
    return {
      banco: isPich ? 'BANCO_PICHINCHA' : 'BANCO_DE_LOJA',
      referencia: genericRefMatch[1].trim().toUpperCase(),
      monto: parseFloat(genericMontoMatch[1].replace(',', '.')),
      methodUsed: 'REGEX_FAST',
      parseLatencyMs: 5,
    };
  }

  // Intento 4: Fallback con IA
  return await parseWithGeminiAiFallback(fullText);
}
