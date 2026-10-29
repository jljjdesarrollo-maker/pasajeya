import React, { useState } from 'react';
import { Tenant } from '../types/transit';
import { dbService } from '../services/database';
import { processIncomingBankNotification, ReconciliationResult } from '../services/reconciliation';
import {
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Play,
  Mail,
  Building,
  RotateCcw
} from 'lucide-react';

interface ReconciliationConsoleProps {
  tenant: Tenant;
}

export const ReconciliationConsole: React.FC<ReconciliationConsoleProps> = ({ tenant }) => {
  const [emailSubject, setEmailSubject] = useState<string>('Notificación de Transferencia Recibida');
  const [senderAddress, setSenderAddress] = useState<string>('notificaciones@bancodeloja.fin.ec');
  const [emailBody, setEmailBody] = useState<string>(
    `Banco de Loja Notificaciones:\nEstimado cliente VILCABAMBATURIS CIA. LTDA.,\nLe notificamos que ha recibido una transferencia por el valor de $4.50 USD.\nNúmero de Comprobante / Referencia: 784912\nOrdenante: CARLOS ALBERTO MORA OCHOA\nCuenta acreditada: Cta Cte 2901234567\nFecha: 28/10/2026 14:15`
  );

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);

  // Cargar plantillas de prueba
  const handleLoadTemplate = (template: 'LOJA_NORMAL' | 'PICHINCHA_DEUNA' | 'INCOMPLETO' | 'DESESTRUCTURADO') => {
    setResult(null);
    if (template === 'LOJA_NORMAL') {
      setEmailSubject('Aviso de Crédito en Cuenta - Banco de Loja');
      setSenderAddress('notificaciones@bancodeloja.fin.ec');
      setEmailBody(
        `Banco de Loja le informa:\nSe ha acreditado una transferencia directa por valor de $4.50.\nReferencia de transacción: 784912\nOrdenante: CARLOS ALBERTO MORA OCHOA\nCuenta destino: 2901234567 Corriente\nFecha y hora: 28/10/2026 14:10:22`
      );
    } else if (template === 'PICHINCHA_DEUNA') {
      setEmailSubject('¡Recibiste un pago Deuna! - Banco Pichincha');
      setSenderAddress('notificaciones@deuna.app');
      setEmailBody(
        `¡Buenas noticias! Recibiste un pago en Deuna / Banco Pichincha por un monto de $2.25.\nCódigo de comprobante: PICH-904128\nDe: MARIA ELENA CASTILLO RIOS\nPara: VILCABAMBATURIS CIA. LTDA.\nFecha: 28 de Octubre 2026`
      );
    } else if (template === 'INCOMPLETO') {
      setEmailSubject('Transferencia Recibida - Banco de Loja');
      setSenderAddress('notificaciones@bancodeloja.fin.ec');
      setEmailBody(
        `Banco de Loja: Transferencia por $1.00 USD recibida.\nComprobante: 784912\nOrdenante: CARLOS ALBERTO MORA\n(Monto transferido es menor al costo del boleto)`
      );
    } else if (template === 'DESESTRUCTURADO') {
      setEmailSubject('Fwd: Comprobante de pago transferencia');
      setSenderAddress('pasajero123@gmail.com');
      setEmailBody(
        `Hola estimada cooperativa Vilcabambaturis, adjunto les aviso que ya hice la transferencia desde mi app de Banco de Loja por el valor total de $4.50 para mis pasajes. El comprobante que me dio el banco dice número 784912 a nombre de Carlos Mora. Por favor confirmen.`
      );
    }
  };

  const handleExecuteWebhook = async () => {
    setIsProcessing(true);
    setResult(null);

    const payload = {
      rawEmailSubject: emailSubject,
      rawEmailBody: emailBody,
      senderAddress,
      tenantSlug: tenant.slug || 'vilcabambaturis',
    };

    try {
      const resp = await fetch('/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok || resp.status === 422) {
        const data = await resp.json();
        setResult({
          success: data.success,
          matchedTransaction: data.transaccionId
            ? {
                id: data.transaccionId,
                tenantId: tenant.id,
                turnoId: 'turno-1',
                banco: data.extractedData?.banco || 'BANCO_DE_LOJA',
                referenciaBanco: data.referenciaBanco || data.extractedData?.referencia || '',
                montoEsperado: data.montoEsperado || data.extractedData?.monto || 0,
                montoRecibido: data.montoRecibido || data.extractedData?.monto,
                feeServicioCalculado: 0.25,
                estado: data.status === 'CONFIRMADO' || data.status === 'IDEMPOTENTE_DUPLICADO' ? 'CONFIRMADO' : data.status,
                compradorCedula: '1104859201',
                compradorNombre: data.extractedData?.ordenanteNombre || 'CARLOS ALBERTO MORA OCHOA',
                compradorCorreo: 'carlos.mora@example.com',
                compradorWhatsApp: '+593991234567',
                puntoAbordaje: 'Terminal Loja',
                asientos: (data.boletosConfirmados || []).map((b: any) => b.numeroAsiento),
                boletos: (data.boletosConfirmados || []).map((b: any) => ({
                  id: b.id,
                  transaccionId: data.transaccionId,
                  turnoId: 'turno-1',
                  numeroAsiento: b.numeroAsiento,
                  origen: b.origen,
                  destino: b.destino,
                  puntoAbordaje: b.origen,
                  codigoUnico: b.codigoUnico,
                  firmaDigitalHmac: 'HMAC-VERIFIED',
                  estado: 'CONFIRMADO',
                })),
                createdAt: new Date().toISOString(),
              }
            : undefined,
          boletosEmitidos: (data.boletosConfirmados || []).map((b: any) => ({
            id: b.id,
            transaccionId: data.transaccionId || 'tx-1',
            turnoId: 'turno-1',
            numeroAsiento: b.numeroAsiento,
            origen: b.origen,
            destino: b.destino,
            puntoAbordaje: b.origen,
            codigoUnico: b.codigoUnico,
            firmaDigitalHmac: 'HMAC-VERIFIED',
            estado: 'CONFIRMADO',
          })),
          extractedData: data.extractedData
            ? {
                banco: data.extractedData.banco,
                referencia: data.extractedData.referencia,
                monto: data.extractedData.monto,
                ordenanteNombre: data.extractedData.ordenanteNombre,
                methodUsed: data.extractedData.methodUsed,
                latencyMs: data.extractedData.parseLatencyMs || data.latencyMs,
              }
            : undefined,
          latencySeconds: Number((data.latencyMs / 1000).toFixed(2)),
          status: data.status,
          message: data.message,
        });
        setIsProcessing(false);
        return;
      }
    } catch (e) {
      console.warn('API /api/v1/payments/webhook falló, ejecutando motor local:', e);
    }

    // Fallback local en memoria
    const res = await processIncomingBankNotification({
      rawEmailSubject: emailSubject,
      rawEmailBody: emailBody,
      senderAddress,
    });

    setResult(res);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>Servicio Transaccional de Conciliación Bancaria</span>
          <span aria-hidden="true">·</span>
          <span>Gmail API + Google Cloud Pub/Sub Webhook</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
          Motor de Auto-Conciliación Bancaria con IA (&lt; 3 Segundos)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Procesa notificaciones entrantes de Banco de Loja y Banco Pichincha / Deuna. Aplica reglas Regex ultrarrápidas y fallback NLP con Gemini AI para correos irregulares.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: SIMULADOR DE WEBHOOK DE GMAIL (7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-500" />
              <span>Carga de Notificación Bancaria Entrante</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">POST /api/v1/payments/webhook</span>
          </div>

          {/* Plantillas Pre-cargadas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Cargar Escenarios de Prueba:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleLoadTemplate('LOJA_NORMAL')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-800 transition-colors"
              >
                Banco de Loja
              </button>
              <button
                type="button"
                onClick={() => handleLoadTemplate('PICHINCHA_DEUNA')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-800 transition-colors"
              >
                Pichincha / Deuna
              </button>
              <button
                type="button"
                onClick={() => handleLoadTemplate('INCOMPLETO')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-800 transition-colors"
              >
                Monto Incompleto
              </button>
              <button
                type="button"
                onClick={() => handleLoadTemplate('DESESTRUCTURADO')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-800 transition-colors"
              >
                Irregular (Gemini AI)
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Remitente (Sender Address)
                </label>
                <input
                  type="text"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Asunto (Subject)
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Cuerpo del Correo Notificación Bancaria (Raw Body)
              </label>
              <textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 leading-relaxed"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleExecuteWebhook}
            disabled={isProcessing}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {isProcessing ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Extrayendo y Reconciliando...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Ejecutar Pipeline de Conciliación (&lt; 3s)</span>
              </>
            )}
          </button>
        </div>

        {/* PANEL DERECHO: RESULTADOS Y AUDITORÍA DE CONCILIACIÓN (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Resultado de Ejecución</span>
              </h2>
              {result && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                  result.latencySeconds <= 3.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {result.latencySeconds}s latencia
                </span>
              )}
            </div>

            {!result && !isProcessing && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Haga clic en "Ejecutar Pipeline" para procesar el aviso bancario y verificar la coincidencia transaccional.
              </div>
            )}

            {isProcessing && (
              <div className="p-8 text-center space-y-3">
                <RotateCcw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-700">Analizando con Adaptadores Híbridos...</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Banner de Estado */}
                <div className={`p-4 rounded-xl border ${
                  result.status === 'IDEMPOTENTE_DUPLICADO'
                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                    : result.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : result.status === 'MONTO_INCOMPLETO'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {result.status === 'IDEMPOTENTE_DUPLICADO' ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    ) : result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                    <span>
                      {result.status === 'IDEMPOTENTE_DUPLICADO'
                        ? '🛡️ IDEMPOTENCIA DETECTADA (0 DUPLICADOS)'
                        : result.status}
                    </span>
                  </div>
                  <p className="text-xs mt-1 opacity-90">{result.message}</p>
                </div>

                {/* Datos Extraídos */}
                {result.extractedData && (
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2 font-mono">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans block">
                      Extracción Inteligente
                    </span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Banco:</span>
                      <span className="font-bold text-slate-900">{result.extractedData.banco}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Referencia:</span>
                      <span className="font-bold text-blue-900">{result.extractedData.referencia}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monto Extraído:</span>
                      <span className="font-bold text-emerald-700">${result.extractedData.monto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Método Utilizado:</span>
                      <span className="font-semibold text-purple-700 flex items-center gap-1">
                        {result.extractedData.methodUsed === 'GEMINI_AI_NLP' && <Sparkles className="w-3 h-3" />}
                        {result.extractedData.methodUsed}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tiempo de Extracción:</span>
                      <span>{result.extractedData.latencyMs} ms</span>
                    </div>
                  </div>
                )}

                {/* Transacción Coincidente */}
                {result.matchedTransaction && (
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Transacción Coincidente en BD
                    </span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ID Orden:</span>
                      <span className="font-mono">{result.matchedTransaction.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Comprador:</span>
                      <span className="font-semibold text-slate-900">{result.matchedTransaction.compradorNombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Asientos Reservados:</span>
                      <span className="font-mono font-bold text-slate-900">
                        #{result.matchedTransaction.asientos.join(', #')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monto Esperado:</span>
                      <span className="font-mono font-bold">${result.matchedTransaction.montoEsperado.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
