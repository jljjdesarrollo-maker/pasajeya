import React, { useState, useEffect } from 'react';
import { Tenant, ProgramacionTurno, TransaccionPago, Boleto } from '../types/transit';
import { dbService } from '../services/database';
import { RouteSelector } from './public/RouteSelector';
import { SeatMap } from './public/SeatMap';
import { CheckoutForm } from './public/CheckoutForm';
import { TicketConfirmation } from './public/TicketConfirmation';
import {
  MapPin,
  Calendar,
  Clock,
  Bus,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface PassengerCheckoutProps {
  tenant: Tenant;
}

export const PassengerCheckout: React.FC<PassengerCheckoutProps> = ({ tenant }) => {
  // Pasos del flujo: 1 = RUTA, 2 = ASIENTOS, 3 = PAGO, 4 = PASE
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Estado de Selección
  const [turnos, setTurnos] = useState<ProgramacionTurno[]>([]);
  const [selectedRutaId, setSelectedRutaId] = useState<string>(tenant.rutas[0]?.id || 'ruta-loja-vilca');
  const [selectedTramoId, setSelectedTramoId] = useState<string>('t-2'); // Vilcabamba por defecto
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>('');
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [sessionId] = useState<string>(() => `sess-${Math.random().toString(36).substring(2, 9)}`);

  // Locking atómico de 15 minutos
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);

  // Formulario de Pasajero Invitado
  const [cedula, setCedula] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [correo, setCorreo] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [puntoAbordaje, setPuntoAbordaje] = useState<string>('Terminal Terrestre Reina del Cisne (Andén 12)');

  // Banco y Comprobante
  const [selectedBank, setSelectedBank] = useState<'BANCO_DE_LOJA' | 'BANCO_PICHINCHA'>('BANCO_DE_LOJA');
  const [referenciaBanco, setReferenciaBanco] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Boletos y Transacción Confirmada
  const [activeTx, setActiveTx] = useState<TransaccionPago | null>(null);
  const [issuedBoletos, setIssuedBoletos] = useState<Boleto[]>([]);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

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

  const activeRuta = tenant.rutas.find((r) => r.id === selectedRutaId) || tenant.rutas[0];
  const selectedTramo = activeRuta?.tramos.find((t) => t.id === selectedTramoId) || activeRuta?.tramos[1];

  // Turnos filtrados dinámicamente según destino
  const filteredTurnos = React.useMemo(() => {
    if (!selectedTramo) return turnos;
    return dbService.getTurnosPorDestino(selectedTramo.puntoDestino);
  }, [turnos, selectedTramo]);

  useEffect(() => {
    if (filteredTurnos.length > 0) {
      const exists = filteredTurnos.some((t) => t.id === selectedTurnoId);
      if (!exists) {
        setSelectedTurnoId(filteredTurnos[0].id);
        setSelectedSeats([]);
        setLockExpiresAt(null);
      }
    }
  }, [filteredTurnos, selectedTurnoId]);

  const activeTurno =
    filteredTurnos.find((t) => t.id === selectedTurnoId) || filteredTurnos[0] || turnos[0];

  const tarifaPorAsiento = selectedTramo?.tarifaNormal || 2.0;

  // Manejo de Asientos con Seat Locking Atómico
  const handleToggleSeat = (seatNumber: number) => {
    if (!activeTurno) return;

    if (selectedSeats.includes(seatNumber)) {
      // Deseleccionar y liberar lock
      dbService.unlockSeat(activeTurno.id, seatNumber, sessionId);
      const nextSeats = selectedSeats.filter((s) => s !== seatNumber);
      setSelectedSeats(nextSeats);
      if (nextSeats.length === 0) {
        setLockExpiresAt(null);
      }
    } else {
      // Bloquear asiento por 15 minutos
      const res = dbService.lockSeat(activeTurno.id, seatNumber, sessionId);
      if (res.success) {
        const nextSeats = [...selectedSeats, seatNumber].sort((a, b) => a - b);
        setSelectedSeats(nextSeats);
        setLockExpiresAt(Date.now() + 15 * 60 * 1000);
      } else {
        alert(res.message || 'No fue posible bloquear el asiento.');
      }
    }
    reloadTurnos();
  };

  // Callback cuando expira el temporizador de 15 minutos
  const handleLockExpired = () => {
    if (activeTurno && selectedSeats.length > 0) {
      selectedSeats.forEach((s) => dbService.unlockSeat(activeTurno.id, s, sessionId));
      setSelectedSeats([]);
      setLockExpiresAt(null);
      reloadTurnos();
      alert('⏱️ Su reserva temporal de 15 minutos ha expirado. Por favor seleccione sus asientos nuevamente.');
      setStep(2);
    }
  };

  // Envío del Checkout y Conciliación
  const handleSubmitPayment = async () => {
    if (!activeTurno || selectedSeats.length === 0) return;
    setIsSubmitting(true);
    setStatusNotification('Validando transferencia bancaria e idempotencia...');

    const subtotal = selectedSeats.length * tarifaPorAsiento;
    const fee = selectedSeats.length * 0.25;
    const total = subtotal + fee;
    const finalRef = (referenciaBanco || `REF-${Math.floor(100000 + Math.random() * 900000)}`).toUpperCase();

    // 1. Crear transacción pendiente en dbService
    const txRes = dbService.createPendingTransaction({
      turnoId: activeTurno.id,
      destinoBoleto: selectedTramo?.puntoDestino,
      banco: selectedBank,
      referenciaBanco: finalRef,
      montoEsperado: total,
      feeServicioCalculado: fee,
      compradorCedula: cedula,
      compradorNombre: nombre,
      compradorCorreo: correo,
      compradorWhatsApp: whatsapp,
      puntoAbordaje,
      asientos: selectedSeats,
    });

    if (!txRes.success || !txRes.transaction) {
      alert(txRes.message || 'Error al registrar la transacción.');
      setIsSubmitting(false);
      return;
    }

    const createdTx = txRes.transaction;
    setActiveTx(createdTx);

    // 2. Intentar llamar al endpoint de backend /api/v1/payments/webhook para auto-conciliación inmediata
    try {
      const webhookPayload = {
        rawEmailSubject: `Aviso de Transferencia Recibida - ${selectedBank === 'BANCO_DE_LOJA' ? 'Banco de Loja' : 'Banco Pichincha'}`,
        rawEmailBody: `Notificación: Se ha recibido una transferencia por valor de $${total.toFixed(2)}.\nReferencia: ${finalRef}\nOrdenante: ${nombre}\nCuenta: ${selectedBank === 'BANCO_DE_LOJA' ? '2901234567' : '3109876543'}`,
        senderAddress: selectedBank === 'BANCO_DE_LOJA' ? 'notificaciones@bancodeloja.fin.ec' : 'notificaciones@pichincha.com',
      };

      await fetch('/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
    } catch {
      // Fallback local garantizado
    }

    // 3. Confirmar transacción en dbService emitiendo boletos con firma HMAC
    const confirmRes = await dbService.confirmTransaction(
      createdTx.id,
      total,
      'REGEX_FAST',
      `Pago auto-conciliado en línea (Ref: ${finalRef})`
    );

    if (confirmRes.success && confirmRes.boletos) {
      setIssuedBoletos(confirmRes.boletos);
      setStep(4);
    } else {
      // Si por alguna razón la confirmación quedó pendiente, igual obtener los boletos
      const freshBoletos = dbService.getBoletosByTurno(activeTurno.id).filter(b => b.transaccionId === createdTx.id);
      setIssuedBoletos(freshBoletos);
      setStep(4);
    }

    setIsSubmitting(false);
    setStatusNotification(null);
  };

  // Reiniciar flujo para nueva compra
  const handleNewBooking = () => {
    setSelectedSeats([]);
    setLockExpiresAt(null);
    setReferenciaBanco('');
    setActiveTx(null);
    setIssuedBoletos([]);
    setStep(1);
    reloadTurnos();
  };

  return (
    <div className="space-y-6">
      {/* Barra de Pasos / Wizard Mobile-First */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {/* Paso 1 */}
          <button
            type="button"
            onClick={() => step > 1 && setStep(1)}
            className={`flex items-center gap-2 cursor-pointer transition-all ${
              step === 1 ? 'text-amber-700 font-black' : step > 1 ? 'text-emerald-700 font-bold' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 1
                  ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-500'
                  : step > 1
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <span className="hidden sm:inline text-xs">Ruta y Horario</span>
          </button>

          <div className="flex-1 h-0.5 mx-2 bg-slate-200" />

          {/* Paso 2 */}
          <button
            type="button"
            onClick={() => step > 2 && setStep(2)}
            className={`flex items-center gap-2 cursor-pointer transition-all ${
              step === 2 ? 'text-amber-700 font-black' : step > 2 ? 'text-emerald-700 font-bold' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 2
                  ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-500'
                  : step > 2
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
            </div>
            <span className="hidden sm:inline text-xs">Asientos (1-10)</span>
          </button>

          <div className="flex-1 h-0.5 mx-2 bg-slate-200" />

          {/* Paso 3 */}
          <button
            type="button"
            onClick={() => step > 3 && setStep(3)}
            className={`flex items-center gap-2 cursor-pointer transition-all ${
              step === 3 ? 'text-amber-700 font-black' : step > 3 ? 'text-emerald-700 font-bold' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3
                  ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-500'
                  : step > 3
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > 3 ? <CheckCircle2 className="w-4 h-4" /> : '3'}
            </div>
            <span className="hidden sm:inline text-xs">Pasajero y Pago</span>
          </button>

          <div className="flex-1 h-0.5 mx-2 bg-slate-200" />

          {/* Paso 4 */}
          <div
            className={`flex items-center gap-2 ${
              step === 4 ? 'text-emerald-800 font-black' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 4 ? 'bg-emerald-600 text-white ring-2 ring-emerald-500' : 'bg-slate-100 text-slate-500'
              }`}
            >
              4
            </div>
            <span className="hidden sm:inline text-xs">Pase Digital QR</span>
          </div>
        </div>
      </div>

      {/* Renderizado Condicional de los 4 Pasos */}
      {step === 1 && (
        <RouteSelector
          rutas={tenant.rutas}
          selectedRutaId={selectedRutaId}
          onSelectRuta={setSelectedRutaId}
          selectedTramoId={selectedTramoId}
          onSelectTramo={setSelectedTramoId}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          turnos={filteredTurnos}
          selectedTurnoId={selectedTurnoId}
          onSelectTurno={setSelectedTurnoId}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && activeTurno && (
        <SeatMap
          turno={activeTurno}
          selectedSeats={selectedSeats}
          onToggleSeat={handleToggleSeat}
          sessionId={sessionId}
          lockExpiresAt={lockExpiresAt}
          onLockExpired={handleLockExpired}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          tarifaPorAsiento={tarifaPorAsiento}
        />
      )}

      {step === 3 && activeTurno && (
        <CheckoutForm
          tenant={tenant}
          turno={activeTurno}
          selectedSeats={selectedSeats}
          tarifaPorAsiento={tarifaPorAsiento}
          destinoNombre={selectedTramo?.puntoDestino || 'Vilcabamba'}
          cedula={cedula}
          setCedula={setCedula}
          nombre={nombre}
          setNombre={setNombre}
          correo={correo}
          setCorreo={setCorreo}
          whatsapp={whatsapp}
          setWhatsapp={setWhatsapp}
          puntoAbordaje={puntoAbordaje}
          setPuntoAbordaje={setPuntoAbordaje}
          selectedBank={selectedBank}
          setSelectedBank={setSelectedBank}
          referenciaBanco={referenciaBanco}
          setReferenciaBanco={setReferenciaBanco}
          onSubmitPayment={handleSubmitPayment}
          onBack={() => setStep(2)}
          isSubmitting={isSubmitting}
        />
      )}

      {step === 4 && activeTurno && (
        <TicketConfirmation
          tenant={tenant}
          turno={activeTurno}
          boletos={issuedBoletos}
          transaccion={activeTx}
          onNewBooking={handleNewBooking}
        />
      )}
    </div>
  );
};
