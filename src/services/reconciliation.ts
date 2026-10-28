/**
 * Motor de Conciliación Bancaria Autónoma con Extracción Híbrida (Reglas Regex + Gemini AI NLP)
 * Diseñado para procesar notificaciones entrantes de:
 * 1. Banco de Loja (Transferencias directas y banca virtual)
 * 2. Banco Pichincha y Deuna (Billetera digital y transferencias interbancarias)
 * 
 * Reconciliación en < 3 segundos con confirmación atómica y emisión de boletos QR.
 */

import { GoogleGenAI } from '@google/genai';
import { dbService } from './database';
import { BancoOperador, TransaccionPago, Boleto } from '../types/transit';

export interface BankNotificationPayload {
  rawEmailSubject?: string;
  rawEmailBody: string;
  senderAddress?: string; // ej: notificaciones@bancodeloja.fin.ec o transferencias@pichincha.com
  receivedAt?: string;
}

export interface ExtractedBankData {
  banco: BancoOperador;
  referencia: string;
  monto: number;
  ordenanteNombre?: string;
  cuentaAcreditada?: string;
  fechaTexto?: string;
  methodUsed: 'REGEX_FAST' | 'GEMINI_AI_NLP';
  latencyMs: number;
}

export interface ReconciliationResult {
  success: boolean;
  matchedTransaction?: TransaccionPago;
  boletosEmitidos?: Boleto[];
  extractedData?: ExtractedBankData;
  latencySeconds: number;
  status: 'CONFIRMADO' | 'MONTO_INCOMPLETO' | 'PAGO_EXTEMPORANEO' | 'SIN_COINCIDENCIA' | 'ERROR_PARSING';
  message: string;
}

/**
 * Adaptador de Reglas Regex Ultrarrápidas (<20ms) para Banco de Loja
 */
export function extractBancoDeLojaRegex(text: string): ExtractedBankData | null {
  const startTime = performance.now();
  
  // Buscar patrones de Banco de Loja
  const isBancoLoja = /banco\s+de\s+loja|bancodeloja/i.test(text);
  
  // Extraer monto: "$ 4.50", "valor de $4.50", "USD 4.50", "4,50"
  const montoMatch = text.match(/(?:(?:valor|monto|por|usd|\$)\s*:?\s*\$?\s*(\d+[.,]\d{2}))/i) ||
                     text.match(/\$\s*(\d+[.,]\d{2})/);
  
  // Extraer referencia: "Referencia: 784912", "Comprobante: 784912", "Ref: 784912", "Doc: 784912"
  const refMatch = text.match(/(?:referencia|comprobante|documento|transacci[oó]n|ref\.?)\s*:?\s*([A-Za-z0-9_-]{4,15})/i) ||
                   text.match(/\b(\d{6,8})\b/);

  // Extraer nombre de ordenante
  const nombreMatch = text.match(/(?:ordenante|de|remitente|por cuenta de)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{4,35})(?:\.|\n|\r|,|Cuenta)/i);

  if (montoMatch && refMatch) {
    const monto = parseFloat(montoMatch[1].replace(',', '.'));
    const referencia = refMatch[1].trim().toUpperCase();
    const ordenante = nombreMatch ? nombreMatch[1].trim() : undefined;
    const latency = Math.round(performance.now() - startTime);

    return {
      banco: 'BANCO_DE_LOJA',
      referencia,
      monto,
      ordenanteNombre: ordenante,
      methodUsed: 'REGEX_FAST',
      latencyMs: latency
    };
  }

  return null;
}

/**
 * Adaptador de Reglas Regex Ultrarrápidas (<20ms) para Banco Pichincha y Deuna
 */
export function extractBancoPichinchaRegex(text: string): ExtractedBankData | null {
  const startTime = performance.now();

  const isPichinchaOrDeuna = /pichincha|deuna/i.test(text);

  // Extraer monto
  const montoMatch = text.match(/(?:(?:valor|monto|transfirieron|recibiste|pag[oó]|usd|\$)\s*:?\s*\$?\s*(\d+[.,]\d{2}))/i) ||
                     text.match(/\$\s*(\d+[.,]\d{2})/);

  // Extraer referencia: "PICH-904128", "Comprobante: 98124501", "Ref: 904128"
  const refMatch = text.match(/(?:referencia|comprobante|c[oó]digo|transacci[oó]n|ref\.?)\s*:?\s*([A-Za-z0-9_-]{4,18})/i) ||
                   text.match(/(PICH-[A-Za-z0-9]+)/i) ||
                   text.match(/\b(\d{6,10})\b/);

  // Extraer nombre remitente
  const nombreMatch = text.match(/(?:de|remitente|persona)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{4,35})(?:\.|\n|\r|,|Fecha)/i);

  if (montoMatch && refMatch) {
    const monto = parseFloat(montoMatch[1].replace(',', '.'));
    const referencia = refMatch[1].trim().toUpperCase();
    const ordenante = nombreMatch ? nombreMatch[1].trim() : undefined;
    const latency = Math.round(performance.now() - startTime);

    return {
      banco: 'BANCO_PICHINCHA',
      referencia,
      monto,
      ordenanteNombre: ordenante,
      methodUsed: 'REGEX_FAST',
      latencyMs: latency
    };
  }

  return null;
}

/**
 * Extracción Inteligente con Gemini AI (NLP) para correos bancarios irregulares,
 * textos desestructurados o formatos de aviso no estándar.
 */
export async function extractWithGeminiAi(rawText: string): Promise<ExtractedBankData | null> {
  const startTime = performance.now();
  
  // Clave API de Gemini disponible en el entorno
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
                 (typeof window !== 'undefined' && (window as any)._GEMINI_API_KEY) || 
                 '';

  if (!apiKey) {
    console.warn('GEMINI_API_KEY no detectada para fallback NLP. Usando extracción heurística.');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Eres el motor extractor bancario de Vilcabambaturis. Analiza este correo o notificación bancaria recibida en Ecuador y extrae en formato JSON estricto:
- banco: "BANCO_DE_LOJA" o "BANCO_PICHINCHA"
- referencia: cadena con el número de comprobante, código o referencia única
- monto: número decimal con el valor en dólares
- ordenanteNombre: nombre del remitente si está disponible

Texto de la notificación:
"""
${rawText}
"""`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            banco: { type: 'STRING', enum: ['BANCO_DE_LOJA', 'BANCO_PICHINCHA'] },
            referencia: { type: 'STRING' },
            monto: { type: 'NUMBER' },
            ordenanteNombre: { type: 'STRING' }
          },
          required: ['banco', 'referencia', 'monto']
        }
      }
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');
    if (parsedJson.banco && parsedJson.referencia && parsedJson.monto) {
      const latency = Math.round(performance.now() - startTime);
      return {
        banco: parsedJson.banco,
        referencia: parsedJson.referencia.toUpperCase(),
        monto: Number(parsedJson.monto),
        ordenanteNombre: parsedJson.ordenanteNombre,
        methodUsed: 'GEMINI_AI_NLP',
        latencyMs: latency
      };
    }
  } catch (err) {
    console.error('Error invocando Gemini AI NLP para notificación bancaria:', err);
  }

  return null;
}

/**
 * Pipeline Principal de Conciliación Bancaria Automática (< 3s)
 * Simula webhook /api/v1/payments/webhook
 */
export async function processIncomingBankNotification(
  payload: BankNotificationPayload
): Promise<ReconciliationResult> {
  const globalStart = performance.now();
  const text = `${payload.rawEmailSubject || ''}\n${payload.rawEmailBody}`.trim();

  // 1. Detección de canal bancario y extracción rápida por Regex
  let extracted: ExtractedBankData | null = null;

  if (/loja/i.test(text) || payload.senderAddress?.includes('bancodeloja')) {
    extracted = extractBancoDeLojaRegex(text);
  } else if (/pichincha|deuna/i.test(text) || payload.senderAddress?.includes('pichincha') || payload.senderAddress?.includes('deuna')) {
    extracted = extractBancoPichinchaRegex(text);
  }

  // Si no se detectó por remitente o regex específico, probar ambos regexes
  if (!extracted) {
    extracted = extractBancoDeLojaRegex(text) || extractBancoPichinchaRegex(text);
  }

  // 2. Si las reglas regex fallan, invocar Gemini AI NLP
  if (!extracted) {
    try {
      extracted = await extractWithGeminiAi(text);
    } catch {
      // noop
    }
  }

  if (!extracted) {
    const elapsedSeconds = Number(((performance.now() - globalStart) / 1000).toFixed(2));
    return {
      success: false,
      latencySeconds: elapsedSeconds,
      status: 'ERROR_PARSING',
      message: 'No fue posible extraer referencia y monto de la notificación bancaria.'
    };
  }

  // 3. Buscar coincidencia en la base de datos de transacciones
  const transacciones = dbService.getTransacciones();
  
  // Normalizar referencia para comparación
  const cleanIncomingRef = extracted.referencia.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const matchingTx = transacciones.find(tx => {
    const cleanTxRef = tx.referenciaBanco.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return cleanTxRef === cleanIncomingRef || cleanTxRef.includes(cleanIncomingRef) || cleanIncomingRef.includes(cleanTxRef);
  });

  const totalLatencySec = Number(((performance.now() - globalStart) / 1000).toFixed(2));

  if (!matchingTx) {
    return {
      success: false,
      extractedData: extracted,
      latencySeconds: totalLatencySec,
      status: 'SIN_COINCIDENCIA',
      message: `Comprobante ${extracted.referencia} procesado pero no existe una reserva pendiente con ese código.`
    };
  }

  // 4. Confirmar transacción a través del servicio de base de datos
  const confirmResult = await dbService.confirmTransaction(
    matchingTx.id,
    extracted.monto,
    extracted.methodUsed,
    `Auto-conciliación en ${totalLatencySec}s mediante ${extracted.methodUsed} (${extracted.banco})`
  );

  const updatedTx = dbService.getTransacciones().find(t => t.id === matchingTx.id);

  if (!confirmResult.success) {
    const statusMap: Record<string, 'MONTO_INCOMPLETO' | 'PAGO_EXTEMPORANEO' | 'SIN_COINCIDENCIA'> = {
      'MONTO_INCOMPLETO': 'MONTO_INCOMPLETO',
      'PAGO_EXTEMPORANEO': 'PAGO_EXTEMPORANEO'
    };
    const finalStatus = (updatedTx?.estado && statusMap[updatedTx.estado]) || 'SIN_COINCIDENCIA';

    return {
      success: false,
      matchedTransaction: updatedTx,
      extractedData: extracted,
      latencySeconds: totalLatencySec,
      status: finalStatus,
      message: confirmResult.message || 'La transacción no pudo confirmarse'
    };
  }

  return {
    success: true,
    matchedTransaction: updatedTx,
    boletosEmitidos: confirmResult.boletos,
    extractedData: extracted,
    latencySeconds: totalLatencySec,
    status: 'CONFIRMADO',
    message: `¡Pago auto-conciliado con éxito en ${totalLatencySec}s! ${confirmResult.boletos?.length || 0} boleto(s) emitido(s).`
  };
}
