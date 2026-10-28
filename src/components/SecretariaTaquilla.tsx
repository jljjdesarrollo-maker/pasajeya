import React, { useState, useEffect } from 'react';
import { Tenant, ProgramacionTurno, TransaccionPago, Boleto, UnidadBus } from '../types/transit';
import { dbService } from '../services/database';
import {
  FileSpreadsheet,
  Clock,
  Bus,
  Lock,
  Unlock,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Users,
  Printer,
  Sparkles,
  Send
} from 'lucide-react';

interface SecretariaTaquillaProps {
  tenant: Tenant;
}

export const SecretariaTaquilla: React.FC<SecretariaTaquillaProps> = ({ tenant }) => {
  const [turnos, setTurnos] = useState<ProgramacionTurno[]>([]);
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>('');
  const [transacciones, setTransacciones] = useState<TransaccionPago[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [unidades, setUnidades] = useState<UnidadBus[]>([]);
  
  // Reasignación de flota
  const [reassignModalOpen, setReassignModalOpen] = useState<boolean>(false);
  const [selectedNewBusId, setSelectedNewBusId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('Mantenimiento preventivo de frenos');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const loadData = () => {
    const freshTurnos = dbService.getTurnos();
    setTurnos(freshTurnos);
    setTransacciones(dbService.getTransacciones());
    setBoletos(dbService.getBoletos());
    setUnidades(dbService.getUnidades());

    if (!selectedTurnoId && freshTurnos.length > 0) {
      setSelectedTurnoId(freshTurnos[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeTurno = turnos.find(t => t.id === selectedTurnoId) || turnos[0];
  const busTeoricoDisco = activeTurno ? tenant.unidades.find(u => u.id === activeTurno.busDiscoTeoricoId)?.numeroDisco || '04' : '04';
  const busRealDisco = activeTurno?.busDiscoRealId ? tenant.unidades.find(u => u.id === activeTurno.busDiscoRealId)?.numeroDisco : null;
  const busDiscoEfectivo = busRealDisco || busTeoricoDisco;

  // Filtrar transacciones confirmadas para este turno
  const turnTxList = transacciones.filter(tx => tx.turnoId === activeTurno?.id && tx.estado === 'CONFIRMADO');
  const turnBoletos = boletos.filter(b => b.turnoId === activeTurno?.id);

  // Cálculo de asientos sobrantes de Bloque Web (1 al 10) no vendidos
  const webSoldSeats = activeTurno?.asientosVendidosWeb || [];
  const webBlockSeats = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const webSurplusSeats = webBlockSeats.filter(s => !webSoldSeats.includes(s));
  const totalSeatsLiberatedToBoxOffice = webSurplusSeats.length + 35; // 35 son de ventanilla fija (11-45)

  // Toggle congelar venta web (Cierre a T-20 min)
  const handleToggleFreeze = () => {
    if (!activeTurno) return;
    const isNowFrozen = dbService.toggleVentaWebCongelada(activeTurno.id);
    loadData();
    setFeedbackMessage(
      isNowFrozen
        ? 'Venta web congelada con éxito a T-20 min. Los asientos sobrantes se han liberado a ventanilla.'
        : 'Venta web reactivada para este turno.'
    );
    setTimeout(() => setFeedbackMessage(''), 4000);
  };

  // Copiar formato para facturación en SRI
  const handleCopySriData = (tx: TransaccionPago) => {
    const formatted = `RUC/CI: ${tx.compradorCedula}\nCLIENTE: ${tx.compradorNombre}\nCORREO: ${tx.compradorCorreo}\nTOTAL: $${tx.montoEsperado.toFixed(2)}\nDETALLE: ${tx.asientos.length} Boleto(s) Ruta Vilcabambaturis Turno ${activeTurno?.frecuenciaHora} (Asientos: ${tx.asientos.join(', ')})\nREF PAGO: ${tx.referenciaBanco} (${tx.banco})`;
    navigator.clipboard.writeText(formatted);
    setCopiedTxId(tx.id);
    setTimeout(() => setCopiedTxId(null), 2500);
  };

  // Reasignar flota real
  const handleConfirmReassignment = () => {
    if (!activeTurno || !selectedNewBusId) return;
    const res = dbService.reasignarFlotaReal(activeTurno.id, selectedNewBusId, reassignReason);
    setReassignModalOpen(false);
    loadData();
    setFeedbackMessage(res.message || 'Flota actualizada');
    setTimeout(() => setFeedbackMessage(''), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Terminal de Taquilla y Facturación Tributaria</span>
            <span aria-hidden="true">·</span>
            <span>Operador: Vilcabambaturis</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Consola de Secretaria: Cierre T-20 y Facturación SRI
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Emisión de pasajes físicos SRI a partir de transferencias web congeladas y reasignación de discos de flota con avisos WhatsApp automáticos.
          </p>
        </div>

        {/* Turno Selector */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Turno Activo</span>
            <select
              value={selectedTurnoId}
              onChange={(e) => setSelectedTurnoId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 text-slate-900 focus:ring-2 focus:ring-amber-500"
            >
              {turnos.map(t => (
                <option key={t.id} value={t.id}>
                  {t.frecuenciaHora} — Disco {dbService.getBusDiscoForTurno(t)} ({t.ventaWebCongelada ? 'Congelado' : 'Abierto'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* TARJETA DE CONTROL OPERACIONAL: T-20 MIN Y FLOTA */}
      {activeTurno && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tarjeta 1: Estado de Venta Web a T-20 min */}
          <div className={`p-5 rounded-2xl border transition-all ${
            activeTurno.ventaWebCongelada 
              ? 'bg-rose-50/80 border-rose-200' 
              : 'bg-emerald-50/70 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Cierre a T-20 Minutos
              </span>
              {activeTurno.ventaWebCongelada ? (
                <Lock className="w-5 h-5 text-rose-600" />
              ) : (
                <Unlock className="w-5 h-5 text-emerald-600" />
              )}
            </div>

            <div className="mt-3">
              <div className="text-xl font-black text-slate-900">
                {activeTurno.ventaWebCongelada ? 'VENTA WEB CONGELADA' : 'VENTA WEB ABIERTA'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {activeTurno.ventaWebCongelada
                  ? 'La venta en línea está bloqueada. Los asientos no vendidos se liberaron a ventanilla.'
                  : 'Faltan más de 20 min para la salida. La web sigue vendiendo del Bloque 1 al 10.'}
              </p>
            </div>

            <button
              onClick={handleToggleFreeze}
              className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                activeTurno.ventaWebCongelada
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
            >
              {activeTurno.ventaWebCongelada ? 'Reactivar Venta Web' : 'Forzar Congelamiento T-20'}
            </button>
          </div>

          {/* Tarjeta 2: Reasignación de Flota (busDiscoReal) */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Unidad Operativa (Bus)
              </span>
              <Bus className="w-5 h-5 text-amber-500" />
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  DISCO {busDiscoEfectivo}
                </span>
                {busRealDisco && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Reasignado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Teórico programado: <span className="font-mono font-medium">Disco {busTeoricoDisco}</span>
              </p>
            </div>

            <button
              onClick={() => {
                setSelectedNewBusId(unidades.find(u => u.numeroDisco !== busDiscoEfectivo)?.id || unidades[0].id);
                setReassignModalOpen(true);
              }}
              className="mt-4 w-full py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Cambiar Disco por Falla Mecánica</span>
            </button>
          </div>

          {/* Tarjeta 3: Liberación de Sobrantes a Ventanilla */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Liberación de Sobrantes
              </span>
              <Users className="w-5 h-5 text-blue-600" />
            </div>

            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono">
                {totalSeatsLiberatedToBoxOffice} Asientos
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {webSurplusSeats.length} sobrantes web (Asientos: {webSurplusSeats.length > 0 ? webSurplusSeats.join(', ') : 'Ninguno'}) + 35 de ventanilla fija.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="mt-4 w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Hoja de Ruta Chofer</span>
            </button>
          </div>
        </div>
      )}

      {/* TABLA PRINCIPAL: FACTURACIÓN SRI DE TRANSFERENCIAS WEB */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <span>Transferencias Web Confirmadas para Facturación SRI</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tome esta lista para emitir los pasajes tributarios en el sistema informático/SRI propio de Vilcabambaturis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {turnTxList.length} registro(s) confirmados
            </span>
          </div>
        </div>

        {turnTxList.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">No hay transferencias web confirmadas aún para este turno.</p>
            <p className="text-xs text-slate-400 mt-1">Las ventas confirmadas aparecerán aquí con sus datos de comprobante para facturar en el SRI.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Cédula / RUC</th>
                  <th className="py-3 px-4">Pasajero Comprador</th>
                  <th className="py-3 px-4">Asientos</th>
                  <th className="py-3 px-4">Monto Total</th>
                  <th className="py-3 px-4">Banco / Referencia</th>
                  <th className="py-3 px-4">Punto Abordaje</th>
                  <th className="py-3 px-4 text-right">Acción SRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {turnTxList.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {tx.compradorCedula}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-800">
                      <div>{tx.compradorNombre}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{tx.compradorCorreo}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        #{tx.asientos.join(', #')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      ${tx.montoEsperado.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-blue-900">{tx.referenciaBanco}</span>
                      <div className="text-[10px] text-slate-400">
                        {tx.banco === 'BANCO_DE_LOJA' ? 'Banco de Loja' : 'Pichincha/Deuna'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 text-xs truncate max-w-xs">
                      {tx.puntoAbordaje}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleCopySriData(tx)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          copiedTxId === tx.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {copiedTxId === tx.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Datos SRI</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE REASIGNACIÓN DE FLOTA */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900">Reasignar Unidad de Autobús</h3>
            </div>

            <p className="text-xs text-slate-600">
              Si la unidad programada presenta una novedad técnica, cámbiela aquí. El sistema despachará automáticamente avisos informativos por WhatsApp a todos los pasajeros con boletos confirmados.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nueva Unidad Física (Reemplazo)
              </label>
              <select
                value={selectedNewBusId}
                onChange={(e) => setSelectedNewBusId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 font-mono font-medium focus:ring-2 focus:ring-amber-500"
              >
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>
                    DISCO {u.numeroDisco} — Placa {u.placa} ({u.modelo || '45 Pasajeros'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo del Cambio
              </label>
              <input
                type="text"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignment}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar y Enviar Avisos WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
