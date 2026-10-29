import React, { useEffect, useState } from 'react';
import { ProgramacionTurno, AsientoLockInfo } from '../../types/transit';
import {
  Clock,
  User,
  Shield,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Info,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface SeatMapProps {
  turno: ProgramacionTurno;
  selectedSeats: number[];
  onToggleSeat: (seatNumber: number) => void;
  sessionId: string;
  lockExpiresAt: number | null;
  onLockExpired: () => void;
  onBack: () => void;
  onContinue: () => void;
  tarifaPorAsiento: number;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  turno,
  selectedSeats,
  onToggleSeat,
  sessionId,
  lockExpiresAt,
  onLockExpired,
  onBack,
  onContinue,
  tarifaPorAsiento
}) => {
  // Temporizador de 15 minutos para bloqueo atómico
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!lockExpiresAt || selectedSeats.length === 0) {
      setSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((lockExpiresAt - now) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        onLockExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockExpiresAt, selectedSeats.length, onLockExpired]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Asientos del Bloque Web: 1 al 10
  const webSeats = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const terminalSeatsCount = 35; // 11 al 45

  // Costo calculado
  const feePorBoleto = 0.25;
  const subtotal = selectedSeats.length * tarifaPorAsiento;
  const totalFee = selectedSeats.length * feePorBoleto;
  const total = subtotal + totalFee;

  return (
    <div className="space-y-6">
      {/* Barra de Bloqueo Atómico de 15 Minutos */}
      {selectedSeats.length > 0 && secondsRemaining > 0 && (
        <div className="bg-amber-500 text-slate-900 p-4 rounded-2xl shadow-sm border border-amber-600 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm">Reserva Temporal Activa</span>
                <span className="bg-slate-900 text-amber-400 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                  {formatTimer(secondsRemaining)} min
                </span>
              </div>
              <p className="text-xs text-slate-900/80">
                Sus asientos [{selectedSeats.join(', ')}] están bloqueados exclusivamente para usted.
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold bg-slate-900/10 border border-slate-900/20 px-3 py-1 rounded-lg">
            Locking Atómico 15m
          </span>
        </div>
      )}

      {/* Contenedor del Mapa del Autobús y Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: MAPA DE ASIENTOS DEL AUTOBÚS (7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Mapa del Autobús (45 Pasajeros)</h2>
              <p className="text-xs text-slate-500">
                Toque los asientos del <strong>Bloque Web (1 al 10)</strong> para seleccionarlos.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
              {turno.frecuenciaHora} · Bus {turno.busDiscoTeoricoId}
            </span>
          </div>

          {/* Leyenda de Asientos */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white" />
              <span className="text-slate-600">Disponible (1-10)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-amber-400 border-2 border-amber-500 font-bold" />
              <span className="text-slate-900 font-semibold">Seleccionado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-slate-300 border border-slate-400" />
              <span className="text-slate-500">Ocupado / Vendido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-slate-100 border border-dashed border-slate-300" />
              <span className="text-slate-400">Taquilla (11-45)</span>
            </div>
          </div>

          {/* ESTRUCTURA DEL AUTOBÚS (MOBILE-FIRST) */}
          <div className="max-w-xs sm:max-w-sm mx-auto bg-slate-50 rounded-3xl p-4 sm:p-6 border-2 border-slate-300 shadow-inner">
            {/* CABINA DEL CONDUCTOR & PUERTA */}
            <div className="flex items-center justify-between border-b-2 border-dashed border-slate-300 pb-4 mb-4">
              <div className="flex items-center gap-2 bg-slate-200/80 px-3 py-1.5 rounded-lg border border-slate-300">
                <span className="text-xs font-bold text-slate-700">Conductor</span>
                <span className="text-base" role="img" aria-label="volante">🛞</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Puerta de Acceso
                </span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 justify-end">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Entrada
                </span>
              </div>
            </div>

            {/* SECCIÓN 1: BLOQUE WEB EXCLUSIVO (ASIENTOS 1 AL 10) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Bloque Web Exclusivo</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Asientos 1 - 10</span>
              </div>

              {/* Fila 1: Asientos 1, 2 | Pasillo | 3, 4 */}
              <div className="grid grid-cols-5 gap-2 items-center">
                {[1, 2].map((num) => renderSeatButton(num))}
                <div className="text-center text-[10px] text-slate-300 font-mono uppercase tracking-widest">
                  Pasillo
                </div>
                {[3, 4].map((num) => renderSeatButton(num))}
              </div>

              {/* Fila 2: Asientos 5, 6 | Pasillo | 7, 8 */}
              <div className="grid grid-cols-5 gap-2 items-center">
                {[5, 6].map((num) => renderSeatButton(num))}
                <div className="text-center text-[10px] text-slate-300 font-mono uppercase tracking-widest">
                  Pasillo
                </div>
                {[7, 8].map((num) => renderSeatButton(num))}
              </div>

              {/* Fila 3: Asientos 9, 10 | Pasillo | 11, 12 (11 y 12 ya son taquilla) */}
              <div className="grid grid-cols-5 gap-2 items-center">
                {[9, 10].map((num) => renderSeatButton(num))}
                <div className="text-center text-[10px] text-slate-300 font-mono uppercase tracking-widest">
                  Pasillo
                </div>
                {[11, 12].map((num) => renderTerminalSeat(num))}
              </div>
            </div>

            {/* SECCIÓN 2: BLOQUE EXCLUSIVO TAQUILLA FÍSICA (ASIENTOS 13 AL 45) */}
            <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-300 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Exclusivo Taquilla Terminal</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Asientos 13 - 45</span>
              </div>

              {/* Muestra representativa de filas 4 y 5 de taquilla */}
              <div className="grid grid-cols-5 gap-2 items-center opacity-70">
                {[13, 14].map((num) => renderTerminalSeat(num))}
                <div className="text-center text-[10px] text-slate-300 font-mono">···</div>
                {[15, 16].map((num) => renderTerminalSeat(num))}
              </div>

              <div className="grid grid-cols-5 gap-2 items-center opacity-70">
                {[17, 18].map((num) => renderTerminalSeat(num))}
                <div className="text-center text-[10px] text-slate-300 font-mono">···</div>
                {[19, 20].map((num) => renderTerminalSeat(num))}
              </div>

              <div className="p-2.5 bg-slate-100 rounded-xl text-center text-[11px] text-slate-500 font-medium">
                🔒 Asientos 21 al 45 reservados para ventanilla física de la terminal.
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: RESUMEN DE COMPRA Y TARIFA (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Resumen de Boletos
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Horario de Salida:</span>
                <span className="font-bold text-slate-900">{turno.frecuenciaHora}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destino:</span>
                <span className="font-bold text-slate-900">{turno.destinoFinal || turno.destino}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tarifa por Pasaje:</span>
                <span className="font-bold text-slate-900">${tarifaPorAsiento.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tarifa Transaccional PasajeYa:</span>
                <span className="font-bold text-amber-700">$0.25 / boleto</span>
              </div>
            </div>

            {/* Asientos Seleccionados */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700 block mb-2">
                Asientos Seleccionados ({selectedSeats.length}):
              </span>
              {selectedSeats.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Seleccione al menos un asiento (1-10) en el mapa del bus.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSeats.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1.5 bg-amber-400 text-slate-900 font-mono font-black rounded-lg text-xs shadow-xs"
                    >
                      Asiento #{s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Desglose Matemático */}
            {selectedSeats.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({selectedSeats.length} boleto{selectedSeats.length > 1 ? 's' : ''}):</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Fee Transaccional ($0.25 × {selectedSeats.length}):</span>
                  <span>${totalFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total a Pagar:</span>
                  <span className="text-lg text-emerald-700">${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Acciones de Navegación */}
            <div className="pt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-1/3 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <button
                type="button"
                onClick={onContinue}
                disabled={selectedSeats.length === 0}
                className="w-full sm:w-2/3 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <span>Continuar a Datos de Pasajero</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizar asiento interactivo del Bloque Web (1 al 10)
  function renderSeatButton(seatNum: number) {
    const isSelected = selectedSeats.includes(seatNum);
    const isSold = turno.asientosVendidosWeb.includes(seatNum);
    const lock = turno.asientosBloqueadosTemp?.[seatNum.toString()];
    const isLockedByOther = lock && lock.sessionId !== sessionId && lock.expiresAt > Date.now();

    let stateClass = 'bg-white border-2 border-slate-300 text-slate-800 hover:border-amber-400 hover:scale-105';
    let label = `#${seatNum}`;

    if (isSelected) {
      stateClass = 'bg-amber-400 border-2 border-slate-900 text-slate-900 font-black shadow-md scale-105 ring-2 ring-amber-400/50';
    } else if (isSold) {
      stateClass = 'bg-slate-300 border border-slate-400 text-slate-500 cursor-not-allowed';
    } else if (isLockedByOther) {
      stateClass = 'bg-amber-100 border border-amber-300 text-amber-800 cursor-not-allowed';
    }

    return (
      <button
        key={seatNum}
        type="button"
        disabled={isSold || Boolean(isLockedByOther)}
        onClick={() => onToggleSeat(seatNum)}
        className={`h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs transition-all cursor-pointer ${stateClass}`}
      >
        <span>{label}</span>
        {isSelected && <span className="text-[9px] font-sans text-slate-900 font-bold -mt-1">Elegido</span>}
        {isSold && <span className="text-[8px] font-sans text-slate-500 -mt-1">Vendido</span>}
        {isLockedByOther && <span className="text-[8px] font-sans text-amber-700 -mt-1">En pago</span>}
      </button>
    );
  }

  // Renderizar asiento de Taquilla (11-45)
  function renderTerminalSeat(seatNum: number) {
    return (
      <div
        key={seatNum}
        title={`Asiento #${seatNum} reservado exclusivamente para taquilla física`}
        className="h-11 sm:h-12 rounded-xl border border-dashed border-slate-300 bg-slate-100 text-slate-400 font-mono text-xs flex flex-col items-center justify-center cursor-not-allowed"
      >
        <span>#{seatNum}</span>
        <span className="text-[8px] font-sans text-slate-400 -mt-1">Terminal</span>
      </div>
    );
  }
};
