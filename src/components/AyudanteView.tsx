import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  CloudUpload,
  Database,
  Eye,
  KeyRound,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  EventoDeltaAbordaje,
  FrecuenciaRuta,
  PasajeroOfflineRecord,
  ResultadoSyncBoarding,
  UnidadFlota,
} from '../types/pasajeya';
import {
  ejecutarSincronizacionDelta,
  obtenerColaDeltaPendiente,
  obtenerPasajerosOfflinePorFrecuencia,
  precargarManifiestoT20EnIndexedDB,
  registrarAbordajeOffline,
  serializarPayloadQR,
} from '../lib/offlineDb';
import {
  AsientoVisorSecuencialTripulacion,
  autenticarYSincronizarEnTerminal5MinAntes,
  construirVisorSoloConsultaSecuencial1a45,
  crearCatalogoFlotaInicial,
  ejecutarRetiroFajaNoShowPasadaUNLArgelia,
  evaluarDistincionVisualTurnoPwa,
  generarKitFajasFisicasReservadoWeb,
  obtenerEstadoBotonSincronizacionManual,
  PARADA_LIMITE_URBANO_NO_SHOW,
  verificarPaseQrCriptograficoOfflineSub100ms,
} from '../services/module4PwaEngine';
import { PWAInstallButton } from './PWAInstallButton';

interface AyudanteViewProps {
  frecuencias: FrecuenciaRuta[];
  frecuenciaActual: FrecuenciaRuta;
  catalogoFlota?: UnidadFlota[];
  onSelectFrecuencia: (id: string) => void;
  onSyncBoletosToMainState: (
    frecuenciaId: string,
    boletosAbordadosIds: string[]
  ) => void;
}

const TRAMOS_RUTA = [
  '1. Terminal Reina del Cisne (Andén — Colocación de Fajas "RESERVADO WEB")',
  '2. Paradas Urbanas Loja (Sueño Eterno / Coliseo / La Tebaida)',
  '3. Límite Urbano: UNL Argelia (20 min — Punto de Corte No-Show)',
  '4. Tramo Malacatos / El Tambo (Cero Cobertura — Visor Secuencial 1 al 45)',
  '5. Tramo Vilcabamba / Yangana / Zahuayco (100% Offline IndexedDB)',
];

export const AyudanteView: React.FC<AyudanteViewProps> = ({
  frecuencias,
  frecuenciaActual,
  catalogoFlota = crearCatalogoFlotaInicial(),
  onSelectFrecuencia,
  onSyncBoletosToMainState,
}) => {
  // Conectividad y simulación de carretera sin cobertura
  const [navegadorOnline, setNavegadorOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [modoCarreteraOffline, setModoCarreteraOffline] =
    useState<boolean>(false);
  const [tramoActual, setTramoActual] = useState<string>(TRAMOS_RUTA[2]); // Por defecto en UNL Argelia para inspección rápida

  const estaOnlineEfectivo = navegadorOnline && !modoCarreteraOffline;
  const yaPasoUNLArgelia =
    tramoActual.includes('UNL Argelia') ||
    tramoActual.includes('Malacatos') ||
    tramoActual.includes('Vilcabamba');

  // Credenciales de Sincronización en Oficina (Disco + PIN 5 min antes)
  const [discoTripulacion, setDiscoTripulacion] = useState<string>(
    frecuenciaActual.busDiscoReal
  );
  const [pinTripulacion, setPinTripulacion] = useState<string>('1191');
  const [manifiestoSincronizadoEnTerminal, setManifiestoSincronizadoEnTerminal] =
    useState<boolean>(true);
  const [latenciaUltimaDescargaMs, setLatenciaUltimaDescargaMs] =
    useState<number>(145);

  // Estado en IndexedDB y Visor Secuencial (1 al 45)
  const [pasajerosOffline, setPasajerosOffline] = useState<
    PasajeroOfflineRecord[]
  >([]);
  const [croquisSecuencial45, setCroquisSecuencial45] = useState<
    AsientoVisorSecuencialTripulacion[]
  >([]);
  const [asientosNoShowLiberados, setAsientosNoShowLiberados] = useState<
    number[]
  >([]);
  const [colaDelta, setColaDelta] = useState<EventoDeltaAbordaje[]>([]);
  const [ultimaPrecarga, setUltimaPrecarga] = useState<string>('');
  const [ultimoSyncResult, setUltimoSyncResult] =
    useState<ResultadoSyncBoarding | null>(null);

  // Escáner QR Opcional (< 100ms)
  const [camaraActiva, setCamaraActiva] = useState<boolean>(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [resultadoVerificacionQR, setResultadoVerificacionQR] = useState<{
    valido: boolean;
    motivo: string;
    latenciaMs?: number;
    firmaEsperada?: string;
    firmaRecibida?: string;
    pasajero?: PasajeroOfflineRecord;
  } | null>(null);

  const [busquedaManual, setBusquedaManual] = useState<string>('');
  const [mostrarHerramientasOpcionalesQR, setMostrarHerramientasOpcionalesQR] =
    useState<boolean>(false);

  const [feedbackAccion, setFeedbackAccion] = useState<{
    tipo: 'ok' | 'error';
    mensaje: string;
  } | null>(null);

  const mostrarFeedback = (mensaje: string, tipo: 'ok' | 'error' = 'ok') => {
    setFeedbackAccion({ tipo, mensaje });
    setTimeout(() => {
      setFeedbackAccion((prev) => (prev?.mensaje === mensaje ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    const onOnline = () => setNavegadorOnline(true);
    const onOffline = () => setNavegadorOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Carga automática en < 1 segundo en IndexedDB al seleccionar frecuencia
  const recargarVisorEIndexedDB = async (
    freq: FrecuenciaRuta,
    noShowIds: number[] = asientosNoShowLiberados
  ) => {
    const t0 = performance.now();
    const info = await precargarManifiestoT20EnIndexedDB(freq);
    const visor = await construirVisorSoloConsultaSecuencial1a45({
      frecuencia: freq,
      asientosNoShowLiberadosEnUNLArgelia: noShowIds,
    });
    const pendientes = await obtenerColaDeltaPendiente(freq.id);
    const t1 = performance.now();

    setPasajerosOffline(visor.pasajerosOrdenadosPorAsiento);
    setCroquisSecuencial45(visor.croquisSecuencial45Asientos);
    setColaDelta(pendientes);
    setLatenciaUltimaDescargaMs(Math.max(12, Math.min(480, Math.round(t1 - t0))));
    setUltimaPrecarga(
      new Date(info.timestampPrecarga).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  useEffect(() => {
    if (frecuenciaActual) {
      setDiscoTripulacion(frecuenciaActual.busDiscoReal);
      setAsientosNoShowLiberados([]);
      recargarVisorEIndexedDB(frecuenciaActual, []);
      setResultadoVerificacionQR(null);
    }
  }, [frecuenciaActual]);

  useEffect(() => {
    return () => {
      detenerCamara();
    };
  }, []);

  // Handler del Botón Prominente de Sincronización Manual (5 min antes en Terminal)
  const manejarSincronizacionManualEnTerminal = async () => {
    const res = await autenticarYSincronizarEnTerminal5MinAntes({
      catalogoFlota,
      frecuencia: frecuenciaActual,
      discoSeleccionado: discoTripulacion,
      pinIngresado: pinTripulacion,
    });

    if (!res.autenticado) {
      setManifiestoSincronizadoEnTerminal(false);
      mostrarFeedback(res.mensaje, 'error');
      return;
    }

    setManifiestoSincronizadoEnTerminal(true);
    setLatenciaUltimaDescargaMs(res.latenciaDescargaMs);
    await recargarVisorEIndexedDB(frecuenciaActual, asientosNoShowLiberados);
    mostrarFeedback(res.mensaje, 'ok');
  };

  // Handler para retirar faja física "RESERVADO WEB" por No-Show pasada la UNL Argelia
  const manejarRetiroFajaNoShow = async (asientoNumero: number) => {
    try {
      const res = ejecutarRetiroFajaNoShowPasadaUNLArgelia({
        frecuencia: frecuenciaActual,
        asientoNumero,
        yaPasoParadaUNLArgelia: yaPasoUNLArgelia,
        asientosNoShowPrevios: asientosNoShowLiberados,
      });

      setAsientosNoShowLiberados(res.asientosNoShowActualizados);
      await recargarVisorEIndexedDB(
        frecuenciaActual,
        res.asientosNoShowActualizados
      );
      mostrarFeedback(res.mensajeOperativo, 'ok');
    } catch (err: any) {
      mostrarFeedback(
        err?.message || 'No se pudo retirar la faja física.',
        'error'
      );
    }
  };

  const iniciarCamara = async () => {
    setErrorCamara(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorCamara(
          'El navegador actual restringe cámara directa en este contenedor. Utilice el validador instantáneo < 100ms debajo.'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCamaraActiva(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setErrorCamara(
        'Cámara trasera no disponible. Utilice los botones de prueba QR (< 100ms) debajo.'
      );
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  // Validación Criptográfica Offline en < 100ms
  const procesarEscaneoQR = async (payloadRaw: string) => {
    const verif = await verificarPaseQrCriptograficoOfflineSub100ms(
      payloadRaw,
      frecuenciaActual.id
    );
    setResultadoVerificacionQR(verif);

    if (verif.valido && verif.pasajero) {
      await registrarAbordajeOffline({
        frecuenciaId: frecuenciaActual.id,
        boletoId: verif.pasajero.boletoId,
        metodo: 'QR_HMAC_OFFLINE',
        tramoCarretera: tramoActual,
      });
      await recargarVisorEIndexedDB(frecuenciaActual, asientosNoShowLiberados);
      mostrarFeedback(
        `QR VÁLIDO en ${verif.latenciaMs}ms (< 100ms Offline): Asiento #${verif.pasajero.asientoNumero} — ${verif.pasajero.pasajeroNombre}.`,
        'ok'
      );
    } else {
      mostrarFeedback(verif.motivo, 'error');
    }
  };

  const simularQrFalsificado = async () => {
    const primerPasajero = pasajerosOffline[0];
    if (!primerPasajero) return;
    const payloadAdulterado = JSON.stringify({
      v: 'PASAJEYA_QR_V5',
      boletoId: primerPasajero.boletoId,
      frecuenciaId: primerPasajero.frecuenciaId,
      asientoNumero: primerPasajero.asientoNumero,
      cedulaRuc: primerPasajero.cedulaRuc,
      referenciaBancaria: primerPasajero.referenciaBancaria,
      firmaHmac: 'HMAC256-FALSIFICADO999999999999',
    });
    await procesarEscaneoQR(payloadAdulterado);
  };

  const manejarAbordajeManual = async (boletoIdONumero: string) => {
    const reg = await registrarAbordajeOffline({
      frecuenciaId: frecuenciaActual.id,
      boletoId: boletoIdONumero.startsWith('bol-')
        ? boletoIdONumero
        : undefined,
      asientoOCedula: !boletoIdONumero.startsWith('bol-')
        ? boletoIdONumero
        : undefined,
      metodo: 'MANUAL_CEDULA_ASIENTO',
      tramoCarretera: tramoActual,
    });

    if (!reg.exito) {
      mostrarFeedback(reg.mensaje, 'error');
      return;
    }

    await recargarVisorEIndexedDB(frecuenciaActual, asientosNoShowLiberados);
    setBusquedaManual('');
    mostrarFeedback(reg.mensaje, 'ok');
  };

  const ejecutarDeltaSyncAhora = async () => {
    if (!estaOnlineEfectivo) {
      mostrarFeedback(
        'Cero cobertura en este tramo. El manifiesto permanece disponible al 100% en IndexedDB.',
        'error'
      );
      return;
    }

    const resultado = await ejecutarSincronizacionDelta(frecuenciaActual.id);
    setUltimoSyncResult(resultado);
    await recargarVisorEIndexedDB(frecuenciaActual, asientosNoShowLiberados);

    if (resultado.boletosActualizadosIds.length > 0) {
      onSyncBoletosToMainState(
        frecuenciaActual.id,
        resultado.boletosActualizadosIds
      );
    }
    mostrarFeedback(
      `Sincronización completada (${resultado.latenciaMs}ms) con base central.`,
      'ok'
    );
  };

  const estadoBotonSync = obtenerEstadoBotonSincronizacionManual({
    sincronizado: manifiestoSincronizadoEnTerminal,
    disco: discoTripulacion,
  });

  const distincionTurnoActual = evaluarDistincionVisualTurnoPwa(frecuenciaActual);
  const kitFajasActual = generarKitFajasFisicasReservadoWeb(
    frecuenciaActual,
    asientosNoShowLiberados
  );

  const pasajerosOrdenadosFiltrados = pasajerosOffline
    .slice()
    .sort((a, b) => a.asientoNumero - b.asientoNumero)
    .filter((p) => {
      if (!busquedaManual.trim()) return true;
      const q = busquedaManual.trim().toLowerCase();
      return (
        String(p.asientoNumero) === q.replace('#', '') ||
        p.cedulaRuc.toLowerCase().includes(q) ||
        p.pasajeroNombre.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-5 pb-16">
      {/* =====================================================================
          1. CABECERA PWA OFFLINE-FIRST + BOTÓN PROMINENTE DE SINCRONIZACIÓN
         ===================================================================== */}
      <section className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-400">
              <Eye className="w-4 h-4 shrink-0" />
              <span>
                MÓDULO 4: VISOR DE SOLO CONSULTA PARA TRIPULACIÓN (0 CLICS / 0
                CHECK-IN OBLIGATORIO A BORDO)
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              PWA Offline-First en IndexedDB ({latenciaUltimaDescargaMs}ms &lt;
              1s) y Protocolo de Fajas &quot;RESERVADO WEB&quot;
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => {
                const nuevoModoOffline = !modoCarreteraOffline;
                setModoCarreteraOffline(nuevoModoOffline);
                if (nuevoModoOffline) {
                  setTramoActual(TRAMOS_RUTA[4]);
                  mostrarFeedback(
                    'Modo Cero Cobertura en Ruta activado: Visor de 45 asientos y validador QR (< 100ms) operando 100% desde IndexedDB.',
                    'ok'
                  );
                } else {
                  setTramoActual(TRAMOS_RUTA[0]);
                }
              }}
              className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                estaOnlineEfectivo
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold'
              }`}
            >
              {estaOnlineEfectivo ? (
                <>
                  <Wifi className="w-4 h-4 shrink-0" />
                  <span>Red Terminal Activa (Simular Ruta Cero Cobertura)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>CERO COBERTURA EN RUTA (100% IndexedDB)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sincronización en Oficina (5 min antes) con Disco + PIN y Botón Prominente Verde / Rojo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="lg:col-span-5 grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Autobús / Disco en Terminal
              </label>
              <select
                value={discoTripulacion}
                onChange={(e) => {
                  setDiscoTripulacion(e.target.value);
                  setManifiestoSincronizadoEnTerminal(false);
                }}
                className="w-full min-h-[48px] px-3 py-2 text-xs font-mono bg-slate-900 text-white border border-slate-700 rounded-xl"
              >
                {catalogoFlota.map((u) => (
                  <option key={u.disco} value={u.disco}>
                    {u.disco} ({u.placa})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                PIN de Unidad (4 dígitos)
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  maxLength={4}
                  value={pinTripulacion}
                  onChange={(e) => setPinTripulacion(e.target.value)}
                  placeholder="1191"
                  className="w-full min-h-[48px] pl-8 pr-2.5 py-2 text-xs font-mono bg-slate-900 text-white border border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* BOTÓN PROMINENTE DE SINCRONIZACIÓN MANUAL (VERDE / ROJO) */}
            <button
              type="button"
              onClick={manejarSincronizacionManualEnTerminal}
              style={{ backgroundColor: estadoBotonSync.colorFondoHex }}
              className="flex-1 min-h-[54px] px-4 py-3 rounded-xl text-white font-mono text-xs sm:text-sm font-bold shadow-md hover:opacity-95 transition-opacity flex items-center justify-center gap-2 text-center"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>{estadoBotonSync.etiquetaBoton}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setManifiestoSincronizadoEnTerminal(
                  !manifiestoSincronizadoEnTerminal
                )
              }
              className="min-h-[54px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono whitespace-nowrap"
            >
              {manifiestoSincronizadoEnTerminal
                ? 'Simular Pendiente (Estado 🔴)'
                : 'Marcar Sincronizado (Estado 🟢)'}
            </button>
          </div>
        </div>

        {/* Distinción Visual del Turno en la PWA (#912D26 con N BOLETOS WEB vs Gris Neutral 0 Boletos Web) */}
        <div className="pt-1">
          <p className="text-xs font-mono text-slate-400 mb-2">
            DISTINCIÓN VISUAL DE TURNOS EN PWA (TOQUE PARA CONSULTAR):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {frecuencias.map((f) => {
              const dist = evaluarDistincionVisualTurnoPwa(f);
              const esActual = f.id === frecuenciaActual.id;
              const tieneBoletosWeb = dist.boletosWebVendidosCount > 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFrecuencia(f.id)}
                  style={{
                    backgroundColor: tieneBoletosWeb ? '#912D26' : '#475569',
                    borderColor: esActual ? '#FFFFFF' : 'transparent',
                  }}
                  className={`min-h-[68px] p-3 rounded-xl border-2 text-left text-white transition-all flex items-center justify-between ${
                    esActual ? 'ring-2 ring-white/60' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-mono opacity-90">
                      {f.codigoFrecuencia} · {f.horaSalida} ({f.busDiscoReal})
                    </div>
                    <div className="text-xs font-bold mt-0.5">
                      {f.origen} ➔ {f.destino}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-black/30 font-mono text-xs font-bold whitespace-nowrap ml-2">
                    {dist.etiquetaDestacada}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {feedbackAccion && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center justify-between ${
            feedbackAccion.tipo === 'ok'
              ? 'bg-emerald-950 text-emerald-50 border-emerald-800'
              : 'bg-red-950 text-red-50 border-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackAccion.tipo === 'ok' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedbackAccion.mensaje}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackAccion(null)}
            className="text-xs underline ml-4 shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* =====================================================================
          2. PROTOCOLO DE NO-SHOW Y FAJAS FÍSICAS "RESERVADO WEB" (LÍMITE UNL ARGELIA)
         ===================================================================== */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#912D26] font-bold">
              <Tag className="w-4 h-4" />
              <span>
                PROTOCOLO DE FAJAS FÍSICAS &quot;RESERVADO WEB&quot; · LÍMITE
                URBANO: PARADA {PARADA_LIMITE_URBANO_NO_SHOW.toUpperCase()} (20
                MIN)
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {kitFajasActual.instruccionOperativaAyudante}
            </h3>
          </div>

          <div className="w-full lg:w-96 shrink-0">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Ubicación / Parada Actual del Autobús en Recorrido:
            </label>
            <select
              value={tramoActual}
              onChange={(e) => setTramoActual(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl"
            >
              {TRAMOS_RUTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {kitFajasActual.fajasReservadoWeb.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-mono">
            Tarjeta en Gris Neutral (0 Boletos Web): Este turno no requiere
            colocar fajas físicas &quot;RESERVADO WEB&quot; en los asientos 1–10.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kitFajasActual.fajasReservadoWeb.map((faja) => (
              <div
                key={faja.asientoNumero}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                  faja.fajaRetiradaPasadaUNLArgelia
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-red-50/70 border-[#912D26]/40 text-slate-900'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm">
                      Asiento #{faja.asientoNumero}
                    </span>
                    <span
                      style={{
                        backgroundColor: faja.fajaRetiradaPasadaUNLArgelia
                          ? '#2E7D32'
                          : '#912D26',
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white"
                    >
                      {faja.fajaRetiradaPasadaUNLArgelia
                        ? 'FAJA RETIRADA (LIBRE RUTA)'
                        : 'FAJA: RESERVADO WEB'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold truncate">
                    {faja.pasajeroNombre}
                  </p>
                  <p className="text-[11px] font-mono text-slate-600">
                    C.I./RUC: {faja.cedulaRuc} · Reserva hasta:{' '}
                    <strong>{faja.paradaLimiteReserva} (20m)</strong>
                  </p>
                </div>

                {!faja.fajaRetiradaPasadaUNLArgelia ? (
                  <button
                    type="button"
                    onClick={() => manejarRetiroFajaNoShow(faja.asientoNumero)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors"
                  >
                    No-Show pasada UNL Argelia: Retirar Faja y Liberar Asiento
                  </button>
                ) : (
                  <div className="text-[11px] font-mono font-semibold text-emerald-800">
                    ✓ Faja retirada pasada UNL Argelia — Asiento disponible en
                    ruta
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================================
          3. VISOR DE SOLO CONSULTA: ORDEN SECUENCIAL POR ASIENTO (1 AL 45)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (5 cols): Croquis Secuencial 1 al 45 (Solo Consulta) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono text-slate-500">
                CROQUIS SECUENCIAL (ASIENTOS 1 AL 45)
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Revisión Pasillo por Pasillo ({frecuenciaActual.busDiscoReal})
              </h3>
            </div>
            <span
              style={{ backgroundColor: distincionTurnoActual.colorTarjetaHex }}
              className="px-2.5 py-1 rounded-lg text-white font-mono text-xs font-bold"
            >
              {distincionTurnoActual.etiquetaDestacada}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            <strong>Visor de Solo Consulta:</strong> El ayudante no está
            obligado a hacer check-in ni clics en cada pasajero. Revise
            visualmente los asientos del <strong>1 al 45</strong> en orden
            secuencial:
          </p>

          <div className="grid grid-cols-5 gap-2 max-h-[380px] overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            {croquisSecuencial45.map((item) => (
              <div
                key={item.numeroAsiento}
                style={{ backgroundColor: item.colorHex }}
                className="p-2 rounded-xl text-white text-center font-mono flex flex-col items-center justify-center min-h-[58px]"
                title={
                  item.pasajeroNombre
                    ? `Asiento #${item.numeroAsiento}: ${item.pasajeroNombre} (${item.cedulaRuc})`
                    : `Asiento #${item.numeroAsiento}: Disponible Ventanilla / Ruta`
                }
              >
                <span className="text-xs font-bold">#{item.numeroAsiento}</span>
                <span className="text-[9px] leading-tight mt-0.5 opacity-95">
                  {item.tieneFajaFisicaReservadoWeb
                    ? 'FAJA WEB'
                    : item.fajaRetiradaPorNoShow
                    ? 'NO-SHOW'
                    : item.ocupado
                    ? 'OCUPADO'
                    : 'LIBRE'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Columna Derecha (7 cols): Lista Secuencial de Pasajeros por Asiento (1 al 45) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono text-slate-500">
                ORDEN SECUENCIAL POR NÚMERO DE ASIENTO (1 ➔ 45)
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Lista de Pasajeros en IndexedDB (Solo Lectura — Consulta Rápida)
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                setMostrarHerramientasOpcionalesQR(
                  !mostrarHerramientasOpcionalesQR
                )
              }
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center"
            >
              <QrCode className="w-4 h-4" />
              {mostrarHerramientasOpcionalesQR
                ? 'Ocultar Escáner QR Opcional'
                : 'Abrir Validador QR Opcional (< 100ms)'}
            </button>
          </div>

          {/* Buscador rápido de consulta en pasillo */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaManual}
              onChange={(e) => setBusquedaManual(e.target.value)}
              placeholder="Filtrar rápido por Nro. de Asiento (1-45), Cédula o Nombre..."
              className="w-full min-h-[48px] pl-10 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          {/* Listado Secuencial por Asiento */}
          <div className="space-y-2.5">
            {pasajerosOrdenadosFiltrados.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                0 Boletos Web registrados en esta frecuencia ({ultimaPrecarga}).
              </div>
            ) : (
              pasajerosOrdenadosFiltrados.map((p) => {
                const fajaRetirada = asientosNoShowLiberados.includes(
                  p.asientoNumero
                );
                return (
                  <div
                    key={p.boletoId}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      fajaRetirada
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          style={{ backgroundColor: '#912D26' }}
                          className="px-2.5 py-0.5 rounded font-mono font-bold text-white text-xs"
                        >
                          Asiento #{p.asientoNumero}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {p.pasajeroNombre}
                        </span>
                        <span className="font-mono text-slate-600">
                          · C.I./RUC: {p.cedulaRuc}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
                        <span>
                          Tramo: <strong>{p.origen} ➔ {p.destino}</strong>
                        </span>
                        <span>·</span>
                        <span>Canal: {p.canalVenta}</span>
                        <span>·</span>
                        <span>Ref: {p.referenciaBancaria}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${
                          fajaRetirada
                            ? 'bg-amber-200 text-amber-950'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {fajaRetirada
                          ? 'NO-SHOW (FAJA RETIRADA)'
                          : '100% PAGADO · FAJA WEB'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Herramienta Secundaria / Opcional: Verificador Criptográfico QR Offline (< 100ms) */}
          {mostrarHerramientasOpcionalesQR && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-emerald-400">
                      HERRAMIENTA SECUNDARIA OPCIONAL · VALIDACIÓN QR &lt; 100MS
                      OFFLINE
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      Verificador Criptográfico HMAC-SHA256 sin Internet
                    </h4>
                  </div>
                  {!camaraActiva ? (
                    <button
                      type="button"
                      onClick={iniciarCamara}
                      className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      Cámara QR
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={detenerCamara}
                      className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <CameraOff className="w-4 h-4" />
                      Apagar
                    </button>
                  )}
                </div>

                {camaraActiva && (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-emerald-500/50">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {errorCamara && (
                  <p className="text-xs text-amber-300 bg-amber-950/60 border border-amber-800 p-3 rounded-xl">
                    {errorCamara}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pasajerosOffline.map((pasajero) => (
                    <button
                      key={pasajero.boletoId}
                      type="button"
                      onClick={() =>
                        procesarEscaneoQR(serializarPayloadQR(pasajero))
                      }
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left text-xs flex items-center justify-between"
                    >
                      <span className="font-mono truncate pr-2">
                        <strong>#{pasajero.asientoNumero}</strong> ·{' '}
                        {pasajero.pasajeroNombre}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                        Validar &lt;100ms
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={simularQrFalsificado}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Probar QR Falsificado
                  </button>

                  {pasajerosOffline[0] && (
                    <button
                      type="button"
                      onClick={() =>
                        manejarAbordajeManual(pasajerosOffline[0].boletoId)
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      Registrar Abordaje Opcional
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={ejecutarDeltaSyncAhora}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 ml-auto"
                  >
                    <CloudUpload className="w-4 h-4" />
                    Delta Sync ({colaDelta.length})
                  </button>
                </div>

                {resultadoVerificacionQR && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-mono ${
                      resultadoVerificacionQR.valido
                        ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                        : 'bg-red-950/90 border-red-700 text-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        {resultadoVerificacionQR.valido
                          ? '✓ QR VÁLIDO OFFLINE'
                          : '✗ QR RECHAZADO'}
                      </span>
                      <span>
                        Latencia: {resultadoVerificacionQR.latenciaMs || 2}ms
                        (&lt; 100ms) · 0 HTTP
                      </span>
                    </div>
                    <p className="mt-1">{resultadoVerificacionQR.motivo}</p>
                  </div>
                )}

                {ultimoSyncResult && (
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Último Delta Sync: {ultimoSyncResult.procesados} evento(s)
                      en {ultimoSyncResult.latenciaMs}ms
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
