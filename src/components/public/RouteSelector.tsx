import React from 'react';
import { Ruta, TramoTarifa, ProgramacionTurno } from '../../types/transit';
import {
  Bus,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  GitBranch,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface RouteSelectorProps {
  rutas: Ruta[];
  selectedRutaId: string;
  onSelectRuta: (rutaId: string) => void;
  selectedTramoId: string;
  onSelectTramo: (tramoId: string) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  turnos: ProgramacionTurno[];
  selectedTurnoId: string;
  onSelectTurno: (turnoId: string) => void;
  onContinue: () => void;
}

export const RouteSelector: React.FC<RouteSelectorProps> = ({
  rutas,
  selectedRutaId,
  onSelectRuta,
  selectedTramoId,
  onSelectTramo,
  selectedDate,
  onSelectDate,
  turnos,
  selectedTurnoId,
  onSelectTurno,
  onContinue
}) => {
  const activeRuta = rutas.find((r) => r.id === selectedRutaId) || rutas[0];
  const tramos = activeRuta?.tramos || [];
  const selectedTramo = tramos.find((t) => t.id === selectedTramoId) || tramos[0];

  // Generar opciones de fecha: Hoy, Mañana y Pasado mañana
  const today = new Date();
  const dateOptions = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const iso = d.toISOString().split('T')[0];
    const label =
      offset === 0
        ? 'Hoy'
        : offset === 1
        ? 'Mañana'
        : d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
    return { iso, label, fullDate: d.toLocaleDateString('es-EC', { dateStyle: 'medium' }) };
  });

  // Determinar si una parada es de la ruta de El Tambo o del Troncal Sur
  const isElTambo = selectedTramo?.puntoDestino.toLowerCase().includes('tambo');

  return (
    <div className="space-y-6">
      {/* 1. Selector de Destino / Tramo */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Seleccione su Destino</h2>
              <p className="text-xs text-slate-500">Salida desde Loja (Terminal Reina del Cisne)</p>
            </div>
          </div>
          {isElTambo ? (
            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-emerald-600" />
              <span>Ramal El Tambo (Directo)</span>
            </span>
          ) : (
            <span className="text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Bus className="w-3 h-3 text-blue-600" />
              <span>Troncal Sur Vilcabamba</span>
            </span>
          )}
        </div>

        {/* Botones de Paradas de Destino (Mobile-First Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {tramos.map((tramo) => {
            const isSelected = tramo.id === selectedTramoId;
            return (
              <button
                key={tramo.id}
                type="button"
                onClick={() => onSelectTramo(tramo.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-400/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900 leading-tight">
                    {tramo.puntoDestino}
                  </span>
                  {tramo.puntoDestino.includes('Malacatos') && (
                    <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                      Paso Obligatorio
                    </span>
                  )}
                  {tramo.puntoDestino.includes('Tambo') && (
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                      Ramal Noroccidente
                    </span>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Tarifa</span>
                  <span className="text-xs font-extrabold text-slate-900">
                    ${tramo.tarifaNormal.toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Nota explicativa de bifurcación */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
          <GitBranch className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p>
            <strong>Topología del Corredor Vial:</strong> El 100% de turnos pasan por <strong>Malacatos</strong>.
            Los turnos a <strong>El Tambo</strong> bifurcan en Malacatos sin ingresar a Vilcabamba.
            Los turnos al <strong>Sur</strong> pasan por Vilcabamba hacia Yangana, Zahuayco y La Elvira.
          </p>
        </div>
      </div>

      {/* 2. Selector de Fecha */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">2. Fecha de Salida</h2>
            <p className="text-xs text-slate-500">Seleccione el día de su viaje</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 max-w-md">
          {dateOptions.map((opt) => {
            const isSelected = opt.iso === selectedDate;
            return (
              <button
                key={opt.iso}
                type="button"
                onClick={() => onSelectDate(opt.iso)}
                className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500 text-slate-900 font-bold shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="block text-xs font-bold">{opt.label}</span>
                <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                  {opt.iso}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lista de Frecuencias y Horarios */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">3. Horarios y Frecuencias Disponibles</h2>
              <p className="text-xs text-slate-500">
                Bloque Web exclusivo: Asientos 1 al 10 con locking de 15 min
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {turnos.length} turno(s) para hoy
          </span>
        </div>

        {/* Turnos en tarjetas responsivas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {turnos.map((turno) => {
            const isSelected = turno.id === selectedTurnoId;
            const isCongelado = turno.ventaWebCongelada;
            const vendidosCount = turno.asientosVendidosWeb.length;
            const bloqueadosCount = Object.keys(turno.asientosBloqueadosTemp || {}).length;
            const cuposLibres = Math.max(0, 10 - vendidosCount - bloqueadosCount);

            return (
              <div
                key={turno.id}
                onClick={() => {
                  if (!isCongelado) {
                    onSelectTurno(turno.id);
                  }
                }}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isCongelado
                    ? 'border-slate-200 bg-slate-100/80 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-amber-500 bg-amber-50/80 shadow-md ring-2 ring-amber-400/50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-slate-900 font-mono tracking-tight">
                      {turno.frecuenciaHora}
                    </span>
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Bus {turno.busDiscoRealId ? `Disco (R) ${turno.busDiscoRealId}` : `Disco 04`}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-600 mt-1 truncate">
                    {turno.destinoFinal || turno.destino}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Bloque Web (1-10):</span>
                    {isCongelado ? (
                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Cierre T-20 min</span>
                      </span>
                    ) : (
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          cuposLibres > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {cuposLibres > 0 ? `${cuposLibres} libres` : 'Agotado'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {isCongelado ? (
                    <span className="text-[11px] text-slate-500 italic">
                      Comprar en taquilla de terminal
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-900">
                        ${selectedTramo.tarifaNormal.toFixed(2)} + $0.25 fee
                      </span>
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 ${
                          isSelected ? 'text-amber-700 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {isSelected ? 'Seleccionado' : 'Elegir'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón de Continuar a Mapa de Asientos */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={!selectedTurnoId}
            className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <span>Continuar a Selección de Asientos</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
