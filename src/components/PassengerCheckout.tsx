import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Tenant, ProgramacionTurno, TransaccionPago, Boleto, TramoTarifa } from '../types/transit';
import { dbService } from '../services/database';
import { processIncomingBankNotification } from '../services/reconciliation';
import { DigitalTicketModal } from './DigitalTicketModal';
import {
  Bus,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  QrCode,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building,
  Sparkles,
  Phone,
  Mail,
  UserCheck,
  Zap,
  Info
} from 'lucide-react';

interface PassengerCheckoutProps {
  tenant: Tenant;
}

export const PassengerCheckout: React.FC<PassengerCheckoutProps> = ({ tenant }) => {
  // Estado de selección
  const [turnos, setTurnos] = useState<ProgramacionTurno[]>([]);
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>('');
  const [selectedTramoId, setSelectedTramoId] = useState<string>('t-2'); // Vilcabamba por defecto
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [sessionId] = useState<string>(() => `sess-${Math.random().toString(36).substring(2, 9)}`);
  
  // Timer de 15 minutos para bloqueo atómico
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);

  // Formulario de pasajero invitado
  const [cedula, setCedula] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [correo, setCorreo] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [puntoAbordaje, setPuntoAbordaje] = useState<string>('Terminal Terrestre Loja - Andén 12');

  // Banco seleccionado
  const [selectedBank, setSelectedBank] = useState<'BANCO_DE_LOJA' | 'BANCO_PICHINCHA'>('BANCO_DE_LOJA');
  const [referenciaBanco, setReferenciaBanco] = useState<string>('');
  const [bankQrUrl, setBankQrUrl] = useState<string>('');

  // Estados de proceso
  const [currentStep, setCurrentStep] = useState<'SELECCION' | 'PAGO' | 'CONCILIANDO' | 'EXITO'>('SELECCION');
  const [activeTx, setActiveTx] = useState<TransaccionPago | null>(null);
  const [issuedBoletos, setIssuedBoletos] = useState<Boleto[]>([]);
  const [modalBoleto, setModalBoleto] = useState<Boleto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [reconcilingProgress, setReconcilingProgress] = useState<number>(0);

  // Cargar turnos frescos
  const reloadTurnos = () => {
    const list = dbService.getTurnos();
    setTurnos(list);
    if (!selectedTurnoId && list.length > 0) {
      setSelectedTurnoId(list[0].id);
    }
  };

  useEffect(() => {
    reloadTurnos();
    const interval = setInterval(reloadTurnos, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeRoute = tenant.rutas[0];
  const selectedTramo = activeRoute?.tramos.find(t => t.id === selectedTramoId) || activeRoute?.tramos[1];

  // Turnos filtrados dinámicamente según el tramo/parada de destino
  const filteredTurnos = React.useMemo(() => {
    if (!selectedTramo) return turnos;
    return dbService.getTurnosPorDestino(selectedTramo.puntoDestino);
  }, [turnos, selectedTramo]);

  // Si el turno previamente seleccionado no atiende el nuevo destino, auto-seleccionar el primero válido
  useEffect(() => {
    if (filteredTurnos.length > 0) {
      const exists = filteredTurnos.some(t => t.id === selectedTurnoId);
      if (!exists) {
        setSelectedTurnoId(filteredTurnos[0].id);
        setSelectedSeats([]);
        setLockExpiresAt(null);
      }
    }
  }, [filteredTurnos, selectedTurnoId]);

  const activeTurno = filteredTurnos.find(t => t.id === selectedTurnoId) || filteredTurnos[0] || turnos[0];

  // Cálculo de tarifas
  const tarifaPorAsiento = selectedTramo?.tarifaNormal || 2.00;
  const subtotalTarifa = selectedSeats.length * tarifaPorAsiento;
  const feePorBoleto = 0.25;
  const totalFee = selectedSeats.length * feePorBoleto;
  const totalPagar = subtotalTarifa + totalFee;

  // Generar QR de pago bancario dinámico
  useEffect(() => {
    async function generateBankQr() {
      const bankConfig = tenant.configBancos.find(b => b.banco === selectedBank);
      if (!bankConfig) return;

      const paymentString = selectedBank === 'BANCO_DE_LOJA'
        ? `BANCO_LOJA|CTA:${bankConfig.numeroCuenta}|TITULAR:${bankConfig.titular}|RUC:${bankConfig.ruc}|MONTO:${totalPagar.toFixed(2)}|REF:VILCA-${Date.now().toString().slice(-4)}`
        : `DEUNA_PICHINCHA|CTA:${bankConfig.numeroCuenta}|TITULAR:${bankConfig.titular}|RUC:${bankConfig.ruc}|MONTO:${totalPagar.toFixed(2)}|PAGO_TRANSPORTE`;

      try {
        const url = await QRCode.toDataURL(paymentString, {
          width: 240,
          margin: 1,
          color: {
            dark: selectedBank === 'BANCO_DE_LOJA' ? '#0d47a1' : '#b78103',
            light: '#ffffff'
          }
        });
        setBankQrUrl(url);
      } catch (e) {
        console.error('Error generando QR de banco:', e);
      }
    }
    if (totalPagar > 0) {
      generateBankQr();
    }
  }, [selectedBank, totalPagar, tenant]);

  // Manejo de countdown de Seat Locking (15 min)
  useEffect(() => {
    if (!lockExpiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((lockExpiresAt - Date.now()) / 1000));
      setTimeLeftSec(remaining);
      if (remaining === 0) {
        // Expiró el bloqueo temporal
        setErrorMessage('El tiempo de reserva de 15 minutos ha expirado. Seleccione nuevamente sus asientos.');
        selectedSeats.forEach(seat => {
          if (activeTurno) dbService.unlockSeat(activeTurno.id, seat, sessionId);
        });
        setSelectedSeats([]);
        setLockExpiresAt(null);
        setCurrentStep('SELECCION');
        reloadTurnos();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockExpiresAt, selectedSeats, activeTurno, sessionId]);

  // Manejo de click en asiento
  const handleSeatClick = (seatNum: number) => {
    if (!activeTurno) return;
    setErrorMessage('');

    if (activeTurno.ventaWebCongelada) {
      setErrorMessage('Este turno ya cerró venta en línea (Cierre operacional a T-20 minutos). Adquiera su boleto en ventanilla.');
      return;
    }

    if (seatNum > 10) {
      setErrorMessage(`El asiento ${seatNum} pertenece al bloque de ventanilla física (asientos 11 al 45). Solo los asientos 1 al 10 están disponibles en la web.`);
      return;
    }

    if (activeTurno.asientosVendidosWeb.includes(seatNum)) {
      setErrorMessage(`El asiento ${seatNum} ya ha sido vendido.`);
      return;
    }

    const currentLock = activeTurno.asientosBloqueadosTemp[seatNum.toString()];
    if (currentLock && currentLock.sessionId !== sessionId && currentLock.expiresAt > Date.now()) {
      setErrorMessage(`El asiento ${seatNum} está reservado temporalmente por otro usuario.`);
      return;
    }

    // Toggle selección
    if (selectedSeats.includes(seatNum)) {
      dbService.unlockSeat(activeTurno.id, seatNum, sessionId);
      const updated = selectedSeats.filter(s => s !== seatNum);
      setSelectedSeats(updated);
      if (updated.length === 0) {
        setLockExpiresAt(null);
      }
    } else {
      if (selectedSeats.length >= 4) {
        setErrorMessage('Máximo 4 asientos por compra en modo pasajero.');
        return;
      }
      const lockRes = dbService.lockSeat(activeTurno.id, seatNum, sessionId);
      if (lockRes.success) {
        const updated = [...selectedSeats, seatNum].sort((a, b) => a - b);
        setSelectedSeats(updated);
        // Iniciar timer si no estaba activo
        if (!lockExpiresAt) {
          const expires = Date.now() + 15 * 60 * 1000;
          setLockExpiresAt(expires);
          setTimeLeftSec(15 * 60);
        }
      } else {
        setErrorMessage(lockRes.message || 'No se pudo reservar el asiento.');
      }
    }
    reloadTurnos();
  };

  // Pasar al checkout de pago
  const handleProceedToPayment = () => {
    if (selectedSeats.length === 0) {
      setErrorMessage('Por favor seleccione al menos un asiento.');
      return;
    }
    if (!cedula.trim() || !nombre.trim() || !whatsapp.trim() || !correo.trim()) {
      setErrorMessage('Por favor complete todos los campos de información del pasajero.');
      return;
    }

    // Generar sugerencia de referencia única
    if (!referenciaBanco) {
      const autoRef = selectedBank === 'BANCO_DE_LOJA' 
        ? Math.floor(100000 + Math.random() * 900000).toString() 
        : `PICH-${Math.floor(100000 + Math.random() * 900000)}`;
      setReferenciaBanco(autoRef);
    }

    setCurrentStep('PAGO');
  };

  // Crear transacción y disparar auto-conciliación simulada en < 3s
  const handleInitiatePaymentAndReconciliation = async (customNotificationText?: string) => {
    if (!activeTurno) return;
    if (!referenciaBanco.trim()) {
      setErrorMessage('Por favor ingrese el número de comprobante o referencia de la transferencia.');
      return;
    }

    setErrorMessage('');
    setCurrentStep('CONCILIANDO');
    setReconcilingProgress(15);

    // 1. Crear transacción pendiente
    const createTxRes = dbService.createPendingTransaction({
      turnoId: activeTurno.id,
      destinoBoleto: selectedTramo?.puntoDestino || activeTurno.destino,
      banco: selectedBank,
      referenciaBanco: referenciaBanco.trim().toUpperCase(),
      montoEsperado: totalPagar,
      feeServicioCalculado: totalFee,
      compradorCedula: cedula.trim(),
      compradorNombre: nombre.trim().toUpperCase(),
      compradorCorreo: correo.trim(),
      compradorWhatsApp: whatsapp.trim(),
      puntoAbordaje,
      asientos: selectedSeats
    });

    if (!createTxRes.success || !createTxRes.transaction) {
      setErrorMessage(createTxRes.message || 'Error creando la orden de pago');
      setCurrentStep('PAGO');
      return;
    }

    setActiveTx(createTxRes.transaction);
    setReconcilingProgress(45);

    // 2. Simulación de notificación entrante de banco (Google Cloud Pub/Sub -> Gmail API webhook)
    const simulatedNotificationBody = customNotificationText || (
      selectedBank === 'BANCO_DE_LOJA'
        ? `Banco de Loja Notificaciones: Estimado cliente ${tenant.nombreComercial}, se ha recibido una transferencia por el valor de $${totalPagar.toFixed(2)}. Comprobante / Referencia: ${referenciaBanco.trim().toUpperCase()}. Ordenante: ${nombre.trim().toUpperCase()}. Cuenta acreditada: Cta Cte 2901234567. Fecha: ${new Date().toLocaleDateString('es-EC')}.`
        : `Notificación Deuna / Banco Pichincha: ¡Recibiste dinero! Te transfirieron $${totalPagar.toFixed(2)} a tu cuenta Corriente terminada en 6543. Código de transacción / Referencia: ${referenciaBanco.trim().toUpperCase()} de ${nombre.trim().toUpperCase()}. Fecha: ${new Date().toLocaleDateString('es-EC')}.`
    );

    // Simular latencia de red bancaria (1.2 segundos para alcanzar meta < 3s)
    setTimeout(async () => {
      setReconcilingProgress(80);

      const result = await processIncomingBankNotification({
        rawEmailSubject: `Aviso de Transferencia Recibida - ${selectedBank}`,
        rawEmailBody: simulatedNotificationBody,
        senderAddress: selectedBank === 'BANCO_DE_LOJA' ? 'notificaciones@bancodeloja.fin.ec' : 'notificaciones@pichincha.com'
      });

      setReconcilingProgress(100);

      if (result.success && result.boletosEmitidos && result.boletosEmitidos.length > 0) {
        setIssuedBoletos(result.boletosEmitidos);
        setModalBoleto(result.boletosEmitidos[0]);
        setCurrentStep('EXITO');
        reloadTurnos();
      } else {
        setErrorMessage(result.message || 'No se pudo conciliar automáticamente la transferencia.');
        setCurrentStep('PAGO');
      }
    }, 1200);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedBankConfig = tenant.configBancos.find(b => b.banco === selectedBank);

  return (
    <div className="space-y-6">
      {/* Hero Visual Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/vilcabambaturis_bus_hero_1793226370935.jpg"
            alt="Autobús Vilcabambaturis en la ruta Loja Vilcabamba"
            className="w-full h-full object-cover opacity-35"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
        </div>

        <div className="relative max-w-4xl p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-2">
            <span>Servicio Interparroquial Oficial</span>
            <span aria-hidden="true">·</span>
            <span>Rutas Loja ⇄ Vilcabamba</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Auto-Conciliación IA</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
            PasajeYa: Venta Autónoma de Boletos en Línea
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-2xl text-balance">
            Elija su asiento en el <strong className="text-white">Bloque Web (Asientos 1 al 10)</strong> con reserva asegurada de 15 minutos. Pague por transferencia directa a Banco de Loja o Pichincha / Deuna y reciba su Pase Digital con código QR verificado al instante.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sin comisiones abusivas: Fee justo de $0.25</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Conciliación automática en menos de 3 segundos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Error si existe */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Atención: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* SECCIÓN PRINCIPAL: PROCESO PASO A PASO */}
      {currentStep === 'SELECCION' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN DE VIAJE Y ASIENTOS (7 COLS) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Selector de Ruta y Tramo */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  <span>1. Seleccione Origen y Destino</span>
                </h2>
                <span className="text-xs text-slate-500 font-mono">Tarifa Interparroquial</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Punto de Destino (Tramo de Tarifa Oficial)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeRoute?.tramos.map(tramo => {
                    const isSelected = selectedTramoId === tramo.id;
                    const isAll = tramo.puntoDestino.toLowerCase().includes('malacatos') || tramo.puntoDestino.toLowerCase().includes('vilcabamba');
                    return (
                      <button
                        key={tramo.id}
                        type="button"
                        onClick={() => setSelectedTramoId(tramo.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/60 text-slate-900 ring-2 ring-amber-500/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/70 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{tramo.puntoDestino}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-amber-700 font-bold font-mono">
                            ${tramo.tarifaNormal.toFixed(2)} USD
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {isAll ? '100% de buses' : 'Turnos específicos'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Selector de Turno / Horario filtrado dinámicamente */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Turnos que atienden {selectedTramo?.puntoDestino} ({filteredTurnos.length} disponibles)</span>
                  </label>
                  <span className="text-xs text-slate-500 font-mono">Cierre web a T-20 min</span>
                </div>

                {filteredTurnos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 text-center">
                    No hay turnos con servicio hacia este destino hoy. Por favor seleccione otro tramo o consulte en ventanilla.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {filteredTurnos.map(turno => {
                      const busDisco = dbService.getBusDiscoForTurno(turno);
                      const isFrozen = turno.ventaWebCongelada;
                      const isSelected = selectedTurnoId === turno.id;

                      const isElvira = turno.destinoFinal?.toLowerCase().includes('elvira') || turno.destino.toLowerCase().includes('elvira');
                      const isTambo = turno.destinoFinal?.toLowerCase().includes('tambo') || turno.destino.toLowerCase().includes('tambo');
                      const isYangana = turno.destinoFinal?.toLowerCase().includes('yangana') || turno.destino.toLowerCase().includes('yangana');

                      return (
                        <button
                          key={turno.id}
                          type="button"
                          onClick={() => {
                            setSelectedTurnoId(turno.id);
                            setSelectedSeats([]);
                            setLockExpiresAt(null);
                          }}
                          className={`p-2.5 rounded-xl text-left border relative transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/50 shadow-xs'
                              : isFrozen
                              ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                              {turno.frecuenciaHora}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              D-{busDisco}
                            </span>
                          </div>

                          {/* Badge de alcance del bus */}
                          <div className="mt-1">
                            {isElvira ? (
                              <span className="inline-block text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded">
                                Extensión La Elvira
                              </span>
                            ) : isYangana ? (
                              <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                Extensión Yangana
                              </span>
                            ) : isTambo ? (
                              <span className="inline-block text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                                Extensión El Tambo
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                Termina Vilcabamba
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-[11px] truncate">
                            {isFrozen ? (
                              <span className="text-rose-600 font-semibold">Venta Cerrada</span>
                            ) : (
                              <span className="text-emerald-700 font-medium">
                                {10 - turno.asientosVendidosWeb.length} Disp. Web
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Mapa Interactivo de Asientos del Autobús */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Bus className="w-4 h-4 text-amber-500" />
                    <span>2. Mapa Interactivo de Asientos</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unidad Disco {activeTurno ? dbService.getBusDiscoForTurno(activeTurno) : '04'} (Capacidad 45 asientos)
                  </p>
                </div>

                {/* Leyenda de Asientos */}
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400" />
                    <span>Disp. Web (1-10)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-amber-500 text-white" />
                    <span>Su Selección</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300" />
                    <span>Ventanilla (11-45)</span>
                  </div>
                </div>
              </div>

              {/* Aviso de Bloque Web vs Ventanilla */}
              <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Política de Asignación Transparente:</strong> Los asientos <strong className="underline">1 al 10</strong> están garantizados para venta exclusiva en línea. Los asientos <span className="text-slate-600">11 al 45</span> se comercializan únicamente de manera presencial en la ventanilla del terminal.
                </div>
              </div>

              {/* Representación Visual del Autobús */}
              <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 max-w-md mx-auto">
                {/* Cabina del Conductor */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-300 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5 bg-slate-200 px-3 py-1 rounded-md">
                    <span>🚪 Puerta Ingreso</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800 text-white px-3 py-1 rounded-md font-mono">
                    <span>👨‍✈️ Chofer</span>
                  </div>
                </div>

                {/* FILAS DE ASIENTOS */}
                <div className="space-y-2">
                  {/* Filas 1 a 11 (4 asientos por fila) */}
                  {Array.from({ length: 11 }).map((_, rowIndex) => {
                    const seatA = rowIndex * 4 + 1;
                    const seatB = rowIndex * 4 + 2;
                    const seatC = rowIndex * 4 + 3;
                    const seatD = rowIndex * 4 + 4;

                    const renderSeatButton = (num: number) => {
                      if (num > 45) return <div key={num} className="w-9 h-9" />;

                      const isWebBlock = num <= 10;
                      const isSelected = selectedSeats.includes(num);
                      const isSold = activeTurno?.asientosVendidosWeb.includes(num);
                      const lock = activeTurno?.asientosBloqueadosTemp[num.toString()];
                      const isLockedOther = lock && lock.sessionId !== sessionId && lock.expiresAt > Date.now();

                      let btnStyle = '';
                      if (isSelected) {
                        btnStyle = 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-sm ring-2 ring-amber-400';
                      } else if (isSold) {
                        btnStyle = 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-400';
                      } else if (isLockedOther) {
                        btnStyle = 'bg-amber-100 text-amber-700 border-amber-300 cursor-not-allowed';
                      } else if (isWebBlock) {
                        btnStyle = 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500';
                      } else {
                        // Ventanilla
                        btnStyle = 'bg-slate-200/70 text-slate-500 border-slate-300 cursor-not-allowed opacity-75';
                      }

                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleSeatClick(num)}
                          disabled={!isWebBlock || isSold || !!isLockedOther}
                          title={
                            isSold
                              ? `Asiento ${num}: Vendido`
                              : isLockedOther
                              ? `Asiento ${num}: Bloqueado temporalmente`
                              : isWebBlock
                              ? `Asiento ${num}: Disponible para compra web`
                              : `Asiento ${num}: Exclusivo ventanilla física`
                          }
                          className={`w-9 h-9 rounded-lg border text-xs font-mono font-medium flex items-center justify-center transition-all ${btnStyle}`}
                        >
                          {num}
                        </button>
                      );
                    };

                    return (
                      <div key={rowIndex} className="flex items-center justify-between">
                        {/* Lado Izquierdo (2 Asientos) */}
                        <div className="flex items-center gap-1.5">
                          {renderSeatButton(seatA)}
                          {renderSeatButton(seatB)}
                        </div>

                        {/* Pasillo Central */}
                        <span className="text-[10px] text-slate-400 font-mono px-1">
                          {rowIndex === 0 && 'Pasillo'}
                        </span>

                        {/* Lado Derecho (2 Asientos) */}
                        <div className="flex items-center gap-1.5">
                          {renderSeatButton(seatC)}
                          {renderSeatButton(seatD)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Asiento 45 posterior */}
                  <div className="flex items-center justify-center pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      disabled
                      className="w-9 h-9 rounded-lg border bg-slate-200/70 text-slate-500 border-slate-300 text-xs font-mono flex items-center justify-center opacity-75 cursor-not-allowed"
                    >
                      45
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: DATOS DEL PASAJERO Y RESUMEN (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Countdown Timer de 15 Minutos */}
            {lockExpiresAt && timeLeftSec > 0 && (
              <div className="bg-amber-500 text-slate-950 rounded-2xl p-4 shadow-sm border border-amber-600 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-slate-950 animate-pulse" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Bloqueo Atómico Activo</div>
                    <div className="text-xs opacity-90">Sus asientos están reservados temporalmente</div>
                  </div>
                </div>
                <div className="font-mono text-xl font-extrabold tracking-tight tabular-nums">
                  {formatTimer(timeLeftSec)}
                </div>
              </div>
            )}

            {/* Formulario de Pasajero Invitado */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-500" />
                  <span>3. Datos del Pasajero (Sin Registro)</span>
                </h2>
                <span className="text-xs text-slate-500">Modo Invitado</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cédula o Pasaporte Ecuatoriano *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 1104872910"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={10}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombres y Apellidos Completos *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: CARLOS ALBERTO MORA"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      WhatsApp para Pase QR *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        placeholder="0991234567"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Correo Electrónico *
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        placeholder="usuario@gmail.com"
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Punto de Abordaje Estimado
                  </label>
                  <select
                    value={puntoAbordaje}
                    onChange={(e) => setPuntoAbordaje(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Terminal Terrestre Loja - Andén 12">Terminal Terrestre Loja - Andén 12</option>
                    <option value="Parada Landangui (Puente)">Parada Landangui (Puente)</option>
                    <option value="Malacatos (Parque Central)">Malacatos (Parque Central)</option>
                    <option value="Vilcabamba (Terminal Principal)">Vilcabamba (Terminal Principal)</option>
                    <option value="El Tambo (Intersección)">El Tambo (Intersección)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Resumen de Desglose Financiero Transaccional */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span>4. Desglose de Pago Transparente</span>
              </h2>

              <div className="space-y-2 text-xs border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Asientos seleccionados ({selectedSeats.length}):</span>
                  <span className="font-mono font-medium text-slate-900">
                    {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'Ninguno'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Tarifa Pasaje ({selectedTramo?.puntoDestino}):</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    ${tarifaPorAsiento.toFixed(2)} × {selectedSeats.length} = ${subtotalTarifa.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>Fee de Servicio Web Transaccional:</span>
                    <span className="text-[10px] text-slate-400">($0.25 / boleto)</span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-900">
                    +${totalFee.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Total Final */}
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Total a Transferir</span>
                  <p className="text-[11px] text-emerald-700">100% ingresa a cuenta de la cooperativa</p>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                  ${totalPagar.toFixed(2)} <span className="text-xs font-normal text-slate-500">USD</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={selectedSeats.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  selectedSeats.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                <span>Continuar a Transferencia Bancaria</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: PAGO POR TRANSFERENCIA DIRECTA + AUTO-CONCILIACIÓN */}
      {currentStep === 'PAGO' && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-xs">Paso Final</span>
                <h2 className="text-lg font-bold text-slate-900">Transferencia Bancaria Directa</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Transfiera exactamente <strong className="text-slate-900 font-mono">${totalPagar.toFixed(2)}</strong> a la cuenta oficial de {tenant.nombreComercial}.
              </p>
            </div>

            <button
              onClick={() => setCurrentStep('SELECCION')}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Modificar Asientos
            </button>
          </div>

          {/* Selector de Banco */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Seleccione su Banco o Billetera
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedBank('BANCO_DE_LOJA')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedBank === 'BANCO_DE_LOJA'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-700" />
                  <span className="font-bold text-xs text-slate-900">Banco de Loja</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Transferencia directa o interbancaria SPI</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedBank('BANCO_PICHINCHA')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedBank === 'BANCO_PICHINCHA'
                    ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-xs text-slate-900">Pichincha / Deuna</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Escaneo con Deuna o transferencia Pichincha</p>
              </button>
            </div>
          </div>

          {/* Tarjeta de Datos Bancarios y QR */}
          {selectedBankConfig && (
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col sm:flex-row items-center gap-6">
              {/* QR Renderizado */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs shrink-0 flex flex-col items-center">
                {bankQrUrl ? (
                  <img src={bankQrUrl} alt="QR de Pago" className="w-36 h-36 object-contain" />
                ) : (
                  <div className="w-36 h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    Cargando QR...
                  </div>
                )}
                <span className="text-[10px] text-slate-500 font-mono mt-1">Escanee para pagar</span>
              </div>

              {/* Datos de la Cuenta */}
              <div className="space-y-2 text-xs flex-1 w-full">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-slate-500">Banco:</span>
                  <span className="font-bold text-slate-900">
                    {selectedBank === 'BANCO_DE_LOJA' ? 'Banco de Loja' : 'Banco Pichincha / Deuna'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-slate-500">Tipo de Cuenta:</span>
                  <span className="font-semibold text-slate-900">{selectedBankConfig.tipoCuenta}</span>
                </div>

                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-slate-500">Número de Cuenta:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm tracking-wider">
                    {selectedBankConfig.numeroCuenta}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-slate-500">Titular:</span>
                  <span className="font-medium text-slate-800">{selectedBankConfig.titular}</span>
                </div>

                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-slate-500">RUC:</span>
                  <span className="font-mono text-slate-800">{selectedBankConfig.ruc}</span>
                </div>

                <div className="flex items-center justify-between pt-1 font-bold text-sm text-slate-900">
                  <span>Monto Exacto:</span>
                  <span className="font-mono text-amber-700">${totalPagar.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          )}

          {/* Campo de Referencia o Comprobante */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Número de Referencia o Comprobante Bancario *
              </label>
              <input
                type="text"
                placeholder={selectedBank === 'BANCO_DE_LOJA' ? 'Ej: 784912' : 'Ej: PICH-904128 o 98124501'}
                value={referenciaBanco}
                onChange={(e) => setReferenciaBanco(e.target.value.toUpperCase())}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono text-sm font-bold uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                El sistema lee automáticamente los correos bancarios entrantes de {tenant.nombreComercial} mediante Gmail API y Pub/Sub.
              </p>
            </div>

            {/* Botón de Auto-Conciliación Instantánea */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleInitiatePaymentAndReconciliation()}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Confirmar Transferencia y Auto-Conciliar (&lt; 3s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 3: PANTALLA DE PROCESO DE CONCILIACIÓN EN TIEMPO REAL */}
      {currentStep === 'CONCILIANDO' && (
        <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border border-slate-200 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Zap className="w-8 h-8 animate-bounce" />
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Auto-Conciliando con Banco...</h3>
            <p className="text-xs text-slate-500 mt-1">
              Verificando acreditación de ${totalPagar.toFixed(2)} en {selectedBank === 'BANCO_DE_LOJA' ? 'Banco de Loja' : 'Banco Pichincha'}.
            </p>
          </div>

          {/* Barra de Progreso */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-amber-400 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${reconcilingProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Webhook Pub/Sub</span>
            <span>Reglas + NLP Gemini</span>
            <span>&lt; 3.0s</span>
          </div>
        </div>
      )}

      {/* PASO 4: ÉXITO - BOLETOS EMITIDOS */}
      {currentStep === 'EXITO' && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-emerald-200 shadow-lg text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Conciliación Exitosa en 1.8 segundos
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              ¡Su Pase Digital está Listo!
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Se han emitido con éxito {issuedBoletos.length} boleto(s) para {nombre}. Hemos enviado copia con código QR a su WhatsApp <strong className="font-mono">{whatsapp}</strong>.
            </p>
          </div>

          {/* Lista de Boletos Emitidos */}
          <div className="space-y-3">
            {issuedBoletos.map(bol => (
              <div
                key={bol.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-left"
              >
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      Asiento #{bol.numeroAsiento}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{bol.codigoUnico}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Turno: <strong className="font-mono">{activeTurno?.frecuenciaHora}</strong> | Bus Disco {activeTurno ? dbService.getBusDiscoForTurno(activeTurno) : '04'}
                  </div>
                </div>

                <button
                  onClick={() => setModalBoleto(bol)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Ver Pase QR</span>
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                if (issuedBoletos[0]) setModalBoleto(issuedBoletos[0]);
              }}
              className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Mostrar Pase Digital para Abordaje</span>
            </button>

            <button
              onClick={() => {
                setSelectedSeats([]);
                setLockExpiresAt(null);
                setCurrentStep('SELECCION');
                reloadTurnos();
              }}
              className="py-3 px-4 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
            >
              Comprar Otro Boleto
            </button>
          </div>
        </div>
      )}

      {/* Modal de Pase Digital QR */}
      {modalBoleto && activeTurno && (
        <DigitalTicketModal
          boleto={modalBoleto}
          turno={activeTurno}
          tenant={tenant}
          onClose={() => setModalBoleto(null)}
        />
      )}
    </div>
  );
};
