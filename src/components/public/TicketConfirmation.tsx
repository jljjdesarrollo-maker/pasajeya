import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Boleto, ProgramacionTurno, Tenant, TransaccionPago } from '../../types/transit';
import { buildQrPayload } from '../../services/crypto';
import {
  CheckCircle2,
  Share2,
  Printer,
  Bus,
  Clock,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Download
} from 'lucide-react';

interface TicketConfirmationProps {
  tenant: Tenant;
  turno: ProgramacionTurno;
  boletos: Boleto[];
  transaccion: TransaccionPago | null;
  onNewBooking: () => void;
}

export const TicketConfirmation: React.FC<TicketConfirmationProps> = ({
  tenant,
  turno,
  boletos,
  transaccion,
  onNewBooking
}) => {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [selectedBoletoIndex, setSelectedBoletoIndex] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const activeBoleto = boletos[selectedBoletoIndex] || boletos[0];
  const busDisco = turno.busDiscoRealId || turno.busDiscoTeoricoId || '04';

  useEffect(() => {
    async function generateAllQrs() {
      const qrs: Record<string, string> = {};
      for (const b of boletos) {
        const payload = buildQrPayload(b, turno.frecuenciaHora, busDisco);
        try {
          const url = await QRCode.toDataURL(payload, {
            width: 320,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
            errorCorrectionLevel: 'M'
          });
          qrs[b.id] = url;
        } catch (e) {
          console.error('Error generando QR para boleto:', b.id, e);
        }
      }
      setQrMap(qrs);
    }

    if (boletos.length > 0) {
      generateAllQrs();
    }
  }, [boletos, turno, busDisco]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = (b: Boleto) => {
    const text = encodeURIComponent(
      `🚌 *Vilcabambaturis Cía. Ltda. - Pase Digital Oficial*\n` +
      `🎫 *Boleto:* ${b.codigoUnico}\n` +
      `👤 *Pasajero:* ${b.compradorNombre}\n` +
      `💺 *Asiento:* #${b.numeroAsiento} (Bloque Web)\n` +
      `⏰ *Hora de Salida:* ${turno.frecuenciaHora}\n` +
      `🚌 *Unidad:* Disco ${busDisco}\n` +
      `📍 *Ruta:* ${b.origen} ➔ ${b.destino}\n` +
      `📌 *Punto de Abordaje:* ${b.puntoAbordaje}\n` +
      `🔐 *Firma HMAC:* ${b.firmaDigitalHmac.slice(0, 16)}...\n\n` +
      `Muestre este mensaje o su código QR al personal de abordo.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banner de Éxito */}
      <div className="bg-emerald-600 text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              ¡Reserva y Pago Exitosos!
            </span>
            <h1 className="text-xl sm:text-2xl font-black mt-0.5">
              Pase Digital de Abordaje Emitido
            </h1>
            <p className="text-xs text-emerald-100 mt-1">
              Se han generado {boletos.length} boleto(s) confirmados con firma digital HMAC-SHA256.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Selector de Boletos si hay múltiples */}
      {boletos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Ver Boleto:
          </span>
          {boletos.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBoletoIndex(idx)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedBoletoIndex === idx
                  ? 'bg-amber-400 text-slate-900 shadow-xs ring-2 ring-amber-500'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Asiento #{b.numeroAsiento} · {b.codigoUnico}
            </button>
          ))}
        </div>
      )}

      {/* Tarjeta del Pase Digital de Abordaje (Estilo Ticket de Avión/Bus) */}
      {activeBoleto && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Header del Ticket */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  {tenant.nombreComercial}
                </span>
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                  Pase Digital de Abordaje · RUC {tenant.ruc}
                </h2>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-mono block">CÓDIGO ÚNICO</span>
              <button
                type="button"
                onClick={() => handleCopyCode(activeBoleto.codigoUnico)}
                className="text-xs font-mono font-bold text-amber-300 hover:text-white transition-colors flex items-center gap-1 justify-end cursor-pointer"
              >
                <span>{activeBoleto.codigoUnico}</span>
                {isCopied && <span className="text-[9px] text-emerald-400 font-sans">¡Copiado!</span>}
              </button>
            </div>
          </div>

          {/* Cuerpo del Ticket */}
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* DATOS DEL VIAJE (8 COLS) */}
            <div className="md:col-span-8 space-y-6">
              {/* Asiento y Hora Destacados */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Asiento
                  </span>
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    #{activeBoleto.numeroAsiento}
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold block">
                    Bloque Web (1-10)
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Hora de Salida
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {turno.frecuenciaHora}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Hoy (Programado)
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Bus Disco
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {busDisco}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Placa LBA-2564
                  </span>
                </div>
              </div>

              {/* Detalle de Pasajero y Ruta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Nombre del Pasajero:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {activeBoleto.compradorNombre}
                  </span>
                  <span className="text-[11px] text-slate-500 block font-mono">
                    Cédula: {activeBoleto.compradorCedula}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block">Punto de Abordaje:</span>
                  <span className="font-bold text-slate-900 block">
                    {activeBoleto.puntoAbordaje}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Destino: {activeBoleto.destino}
                  </span>
                </div>
              </div>

              {/* Firma Criptográfica HMAC */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-950 block">
                      Firma de Seguridad HMAC-SHA256 (Offline)
                    </span>
                    <span className="text-[10px] font-mono text-amber-800 break-all">
                      {activeBoleto.firmaDigitalHmac}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold bg-amber-200 text-amber-900 px-2 py-0.5 rounded whitespace-nowrap">
                  Válido
                </span>
              </div>
            </div>

            {/* CÓDIGO QR Y BOTÓN DE WHATSAPP (4 COLS) */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
              {qrMap[activeBoleto.id] ? (
                <img
                  src={qrMap[activeBoleto.id]}
                  alt="QR Pase Digital"
                  className="w-44 h-44 rounded-xl border border-slate-300 shadow-sm bg-white p-2"
                />
              ) : (
                <div className="w-44 h-44 rounded-xl bg-slate-200 animate-pulse flex items-center justify-center text-xs text-slate-400">
                  Generando QR...
                </div>
              )}

              <p className="text-[10px] text-slate-500 leading-tight">
                Muestre este código al ayudante de la unidad al momento de abordar el autobús.
              </p>

              <button
                type="button"
                onClick={() => handleShareWhatsApp(activeBoleto)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Enviar a mi WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Footer del Ticket con comprobante */}
          {transaccion && (
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono">
              <span>Referencia Bancaria: <strong>{transaccion.referenciaBanco}</strong></span>
              <span>Total Pagado: <strong>${transaccion.montoEsperado.toFixed(2)}</strong> (Incluye $0.25 fee/boleto)</span>
              <span>Estado: <strong className="text-emerald-700">CONCILIADO EN LÍNEA</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Botón para nueva reserva */}
      <div className="pt-4 flex justify-center">
        <button
          type="button"
          onClick={onNewBooking}
          className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>Comprar Otro Boleto o Consultar Otra Frecuencia</span>
        </button>
      </div>
    </div>
  );
};
