import React, { useState, useEffect } from 'react';
import { Tenant, ProgramacionTurno, ScannedQRVerificationResult } from '../types/transit';
import { dbService } from '../services/database';
import { ayudantePwaService, OfflineShiftManifest, OfflinePassengerRecord } from '../services/ayudantePwa';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Bus,
  User,
  Search,
  Camera,
  Upload,
  Check,
  Sparkles
} from 'lucide-react';

interface AyudantePwaProps {
  tenant: Tenant;
}

export const AyudantePwa: React.FC<AyudantePwaProps> = ({ tenant }) => {
  const [turnos, setTurnos] = useState<ProgramacionTurno[]>([]);
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>('');
  const [manifest, setManifest] = useState<OfflineShiftManifest | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Entrada de escaneo
  const [scannedInput, setScannedInput] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<ScannedQRVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Cargar datos
  const loadTurnosAndManifest = async () => {
    const list = dbService.getTurnos();
    setTurnos(list);
    const targetTurnoId = selectedTurnoId || (list.length > 0 ? list[0].id : '');
    if (targetTurnoId) {
      if (!selectedTurnoId) setSelectedTurnoId(targetTurnoId);
      const stored = await ayudantePwaService.getStoredManifest(targetTurnoId);
      if (stored) {
        setManifest(stored);
      } else {
        // Precarga inicial automática
        const synced = await ayudantePwaService.syncShiftManifest(targetTurnoId);
        setManifest(synced);
      }
    }
  };

  useEffect(() => {
    loadTurnosAndManifest();
  }, [selectedTurnoId]);

  // Sincronizar manifiesto
  const handleSyncManifest = async () => {
    if (!selectedTurnoId) return;
    setIsSyncing(true);
    const synced = await ayudantePwaService.syncShiftManifest(selectedTurnoId);
    setManifest(synced);
    setTimeout(() => setIsSyncing(false), 600);
  };

  // Toggle modo offline
  const handleToggleOffline = () => {
    const next = !isOfflineMode;
    setIsOfflineMode(next);
    ayudantePwaService.setSimulatedOffline(next);
  };

  // Procesar código QR o payload
  const handleVerifyPayload = async (rawCode: string) => {
    if (!rawCode.trim() || !selectedTurnoId) return;
    setIsVerifying(true);
    setVerificationResult(null);

    // Simular lectura de sensor de cámara (150ms)
    setTimeout(async () => {
      const result = await ayudantePwaService.verifyAndBoardTicketOffline(rawCode, selectedTurnoId);
      setVerificationResult(result);
      setIsVerifying(false);
      // Actualizar manifiesto visual
      const updated = await ayudantePwaService.getStoredManifest(selectedTurnoId);
      setManifest(updated);
    }, 150);
  };

  // Preset de prueba rápida
  const handleRunPresetTest = (type: 'VALIDO_1' | 'VALIDO_2' | 'ADULTERADO' | 'OTRO_TURNO') => {
    if (!manifest || manifest.passengers.length === 0) {
      alert('Primero compre boletos o verifique que existan boletos en el turno.');
      return;
    }

    const p1 = manifest.passengers[0];
    const p2 = manifest.passengers[1] || p1;

    if (type === 'VALIDO_1') {
      const payload = JSON.stringify({
        v: 1,
        c: p1.codigoUnico,
        t: tenant.id,
        u: selectedTurnoId,
        s: p1.numeroAsiento,
        o: p1.origen,
        d: p1.destino,
        p: p1.puntoAbordaje,
        n: p1.compradorNombre,
        id: p1.compradorCedula,
        h: manifest.horaSalida,
        b: manifest.busDisco,
        sig: p1.firmaDigitalHmac
      });
      setScannedInput(payload);
      handleVerifyPayload(payload);
    } else if (type === 'VALIDO_2') {
      const payload = JSON.stringify({
        v: 1,
        c: p2.codigoUnico,
        t: tenant.id,
        u: selectedTurnoId,
        s: p2.numeroAsiento,
        o: p2.origen,
        d: p2.destino,
        p: p2.puntoAbordaje,
        n: p2.compradorNombre,
        id: p2.compradorCedula,
        h: manifest.horaSalida,
        b: manifest.busDisco,
        sig: p2.firmaDigitalHmac
      });
      setScannedInput(payload);
      handleVerifyPayload(payload);
    } else if (type === 'ADULTERADO') {
      // Firma hackeada/alterada
      const payload = JSON.stringify({
        v: 1,
        c: p1.codigoUnico,
        t: tenant.id,
        u: selectedTurnoId,
        s: p1.numeroAsiento,
        n: 'PIRATA INFORMÁTICO',
        sig: 'firma_falsa_99999999999999999999'
      });
      setScannedInput(payload);
      handleVerifyPayload(payload);
    } else if (type === 'OTRO_TURNO') {
      const payload = JSON.stringify({
        v: 1,
        c: 'VILCA-2026-9999',
        t: tenant.id,
        u: 'turno-otro',
        s: 8,
        sig: 'random_hash'
      });
      setScannedInput(payload);
      handleVerifyPayload(payload);
    }
  };

  const activeTurno = turnos.find(t => t.id === selectedTurnoId);
  const busDisco = activeTurno ? dbService.getBusDiscoForTurno(activeTurno) : (manifest?.busDisco || '04');

  const passengers = manifest?.passengers || [];
  const boardedCount = passengers.filter(p => p.estado === 'ABORDADO').length;
  const filteredPassengers = passengers.filter(p =>
    p.compradorNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.numeroAsiento.toString().includes(searchQuery) ||
    p.codigoUnico.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cockpit de la PWA Móvil */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Ayudante de Autobús PWA</h1>
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-amber-400 px-2 py-0.5 rounded border border-slate-700">
                  Offline-First
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Unidad: <strong className="text-white font-mono">DISCO {busDisco}</strong> | Turno: <strong className="text-amber-400 font-mono">{activeTurno?.frecuenciaHora}</strong>
              </p>
            </div>
          </div>

          {/* Selector de Turno y Estado de Conexión */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTurnoId}
              onChange={(e) => setSelectedTurnoId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 font-mono focus:ring-2 focus:ring-amber-500"
            >
              {turnos.map(t => (
                <option key={t.id} value={t.id}>
                  {t.frecuenciaHora} — Disco {dbService.getBusDiscoForTurno(t)}
                </option>
              ))}
            </select>

            {/* Botón Simular Modo Offline */}
            <button
              onClick={handleToggleOffline}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isOfflineMode
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sin Cobertura (Offline)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Con Cobertura Celular</span>
                </>
              )}
            </button>

            {/* Sincronizar Turno a IndexedDB */}
            <button
              onClick={handleSyncManifest}
              disabled={isSyncing}
              title="Descargar lista de pasajeros del turno en IndexedDB antes de partir"
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar Turno</span>
            </button>
          </div>
        </div>

        {/* Resumen de Manifiesto en Memoria Local */}
        {manifest && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 font-mono">
            <div>
              <span>IndexedDB: </span>
              <span className="text-slate-200">
                {passengers.length} pasajeros registrados
              </span>
            </div>
            <div>
              <span>Progreso de Abordaje: </span>
              <span className="text-amber-400 font-bold">
                {boardedCount} / {passengers.length} abordados
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">
                Sincronizado: {new Date(manifest.syncedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ÁREA DE ESCANEO Y VERIFICACIÓN QR */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">
              Escáner de Códigos QR a Bordo (Verificación HMAC Offline)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {isOfflineMode ? 'Verificando con llaves locales' : 'En línea'}
          </span>
        </div>

        {/* Botones de Prueba Rápida para Validación Instantánea */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <span className="text-xs font-semibold text-slate-700 block mb-2">
            Simulador de Lectura de Cámara (Presets de Verificación):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleRunPresetTest('VALIDO_1')}
              className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Boleto Válido #1</span>
            </button>

            <button
              type="button"
              onClick={() => handleRunPresetTest('VALIDO_2')}
              className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Boleto Válido #2</span>
            </button>

            <button
              type="button"
              onClick={() => handleRunPresetTest('ADULTERADO')}
              className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Firma Adulterada</span>
            </button>

            <button
              type="button"
              onClick={() => handleRunPresetTest('OTRO_TURNO')}
              className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Turno Incorrecto</span>
            </button>
          </div>
        </div>

        {/* Input Manual o Escaneado */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Contenido Escaneado del Código QR o Código de Boleto
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='Pegue contenido del QR (JSON firmado) o código ej: VILCA-2026-0041'
              value={scannedInput}
              onChange={(e) => setScannedInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={() => handleVerifyPayload(scannedInput)}
              disabled={isVerifying || !scannedInput.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isVerifying ? 'Verificando...' : 'Verificar QR'}
            </button>
          </div>
        </div>

        {/* TARJETA DE RESULTADO DE VERIFICACIÓN */}
        {verificationResult && (
          <div className={`p-5 rounded-2xl border transition-all ${
            verificationResult.valid
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : verificationResult.alreadyBoarded
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {verificationResult.valid ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                ) : verificationResult.alreadyBoarded ? (
                  <AlertCircle className="w-7 h-7 text-amber-600" />
                ) : (
                  <XCircle className="w-7 h-7 text-rose-600" />
                )}
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    {verificationResult.valid
                      ? '¡BOLETO AUTORIZADO - ABORDADO!'
                      : verificationResult.alreadyBoarded
                      ? '¡ALERTA! BOLETO YA FUE ABORDADO'
                      : '¡ACCESO DENEGADO! BOLETO INVÁLIDO'}
                  </h3>
                  <p className="text-xs opacity-90 mt-0.5">
                    {verificationResult.reason || 'Firma digital HMAC-SHA256 verificada criptográficamente.'}
                  </p>
                </div>
              </div>

              {verificationResult.asiento && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Asiento</span>
                  <span className="text-3xl font-black font-mono">
                    #{verificationResult.asiento}
                  </span>
                </div>
              )}
            </div>

            {verificationResult.passengerName && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Pasajero</span>
                  <span className="font-bold">{verificationResult.passengerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Unidad</span>
                  <span className="font-bold font-mono">Disco {verificationResult.busDisco || busDisco}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Hora Turno</span>
                  <span className="font-bold font-mono">{verificationResult.horaSalida || activeTurno?.frecuenciaHora}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Hora Abordaje</span>
                  <span className="font-bold font-mono">
                    {verificationResult.boardedAt ? new Date(verificationResult.boardedAt).toLocaleTimeString() : 'Ahora'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LISTA Y MANIFIESTO COMPLETO DE PASAJEROS DEL TURNO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              <span>Manifiesto de Pasajeros a Bordo (IndexedDB)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Turno {activeTurno?.frecuenciaHora} | Unidad Disco {busDisco} | {boardedCount} de {passengers.length} a bordo
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar pasajero o asiento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs w-56 focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {passengers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No hay pasajeros sincronizados para este turno. Presione "Sincronizar Turno".
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPassengers.map((p) => {
              const isBoarded = p.estado === 'ABORDADO';
              return (
                <div
                  key={p.boletoId}
                  className={`p-4 flex items-center justify-between transition-colors ${
                    isBoarded ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl font-mono font-bold flex items-center justify-center text-sm ${
                      isBoarded
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}>
                      #{p.numeroAsiento}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{p.compradorNombre}</span>
                        {isBoarded ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Abordado {p.fechaAbordajeLocal ? new Date(p.fechaAbordajeLocal).toLocaleTimeString() : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            Esperando Abordaje
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        CI: {p.compradorCedula} · Boleto: {p.codigoUnico} · {p.puntoAbordaje}
                      </div>
                    </div>
                  </div>

                  {!isBoarded && (
                    <button
                      onClick={() => handleVerifyPayload(p.codigoUnico)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Validar Abordaje</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
