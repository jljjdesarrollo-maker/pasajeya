import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Boleto, ProgramacionTurno, Tenant } from '../types/transit';
import { buildQrPayload } from '../services/crypto';
import { dbService } from '../services/database';
import { X, Printer, Share2, CheckCircle2, ShieldCheck, Bus, MapPin, Clock, Calendar, User } from 'lucide-react';

interface DigitalTicketModalProps {
  boleto: Boleto;
  turno: ProgramacionTurno;
  tenant: Tenant;
  onClose: () => void;
}

export const DigitalTicketModal: React.FC<DigitalTicketModalProps> = ({
  boleto,
  turno,
  tenant,
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const busDisco = dbService.getBusDiscoForTurno(turno);

  useEffect(() => {
    async function makeQr() {
      const payload = buildQrPayload(boleto, turno.frecuenciaHora, busDisco);
      try {
        const url = await QRCode.toDataURL(payload, {
          width: 320,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('Error generando QR:', err);
      }
    }
    makeQr();
  }, [boleto, turno, busDisco]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🚌 *Pase Digital Vilcabambaturis*\n` +
      `Boleto: ${boleto.codigoUnico}\n` +
      `Pasajero: ${boleto.compradorNombre}\n` +
      `Asiento: #${boleto.numeroAsiento}\n` +
      `Turno: ${turno.frecuenciaHora} | Bus Disco: ${busDisco}\n` +
      `Ruta: ${turno.origen} ➡️ ${turno.destino}\n` +
      `Abordaje: ${boleto.puntoAbordaje}\n` +
      `Firma HMAC: ${boleto.firmaDigitalHmac.substring(0, 12)}...\n` +
      `Presente este pase al ayudante de la unidad.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(boleto.codigoUnico);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Pase */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">{tenant.nombreComercial}</h2>
              <p className="text-xs text-slate-400">Pase Digital de Abordaje Oficial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Boleto */}
        <div className="p-6">
          {/* Asiento y Código */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Asiento Asignado</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">#{boleto.numeroAsiento}</span>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Bloque Web
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Código Único</span>
              <div 
                onClick={handleCopyCode}
                className="cursor-pointer group flex items-center gap-1 font-mono text-sm font-bold text-slate-800 hover:text-amber-600 transition-colors"
                title="Click para copiar"
              >
                <span>{boleto.codigoUnico}</span>
                {isCopied && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />}
              </div>
            </div>
          </div>

          {/* Código QR Centralizado */}
          <div className="my-5 flex flex-col items-center justify-center">
            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Boleto ${boleto.codigoUnico}`}
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-sm">
                  Generando código QR...
                </div>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verificación HMAC-SHA256 sin señal requerida</span>
            </div>
          </div>

          {/* Detalles del Viaje */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Pasajero
              </span>
              <span className="font-semibold text-slate-900">{boleto.compradorNombre}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-slate-400" /> Unidad Operativa
              </span>
              <span className="font-bold text-amber-700 font-mono">
                DISCO {busDisco} {turno.busDiscoRealId ? '(Reasignado)' : '(Programado)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Hora Salida
              </span>
              <span className="font-bold text-slate-900 font-mono tabular-nums">{turno.frecuenciaHora}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha
              </span>
              <span className="font-medium text-slate-700 font-mono">{turno.fecha}</span>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500">Punto de abordaje:</span>
                  <p className="font-medium text-slate-800">{boleto.puntoAbordaje}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Firma Criptográfica Hash */}
          <div className="mt-3 text-[11px] text-slate-500 font-mono truncate bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
            <span className="text-slate-400">HMAC-SIG:</span> {boleto.firmaDigitalHmac}
          </div>

          {/* Botones de Acción */}
          <div className="mt-5 grid grid-cols-2 gap-3 no-print">
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
