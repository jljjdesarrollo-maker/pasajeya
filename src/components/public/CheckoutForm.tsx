import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Tenant, ProgramacionTurno, TenantBankConfig } from '../../types/transit';
import {
  CreditCard,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Copy,
  Check,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
  QrCode
} from 'lucide-react';

interface CheckoutFormProps {
  tenant: Tenant;
  turno: ProgramacionTurno;
  selectedSeats: number[];
  tarifaPorAsiento: number;
  destinoNombre: string;
  cedula: string;
  setCedula: (v: string) => void;
  nombre: string;
  setNombre: (v: string) => void;
  correo: string;
  setCorreo: (v: string) => void;
  whatsapp: string;
  setWhatsapp: (v: string) => void;
  puntoAbordaje: string;
  setPuntoAbordaje: (v: string) => void;
  selectedBank: 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA';
  setSelectedBank: (b: 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA') => void;
  referenciaBanco: string;
  setReferenciaBanco: (v: string) => void;
  onSubmitPayment: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  tenant,
  turno,
  selectedSeats,
  tarifaPorAsiento,
  destinoNombre,
  cedula,
  setCedula,
  nombre,
  setNombre,
  correo,
  setCorreo,
  whatsapp,
  setWhatsapp,
  puntoAbordaje,
  setPuntoAbordaje,
  selectedBank,
  setSelectedBank,
  referenciaBanco,
  setReferenciaBanco,
  onSubmitPayment,
  onBack,
  isSubmitting
}) => {
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);
  const [bankQrUrl, setBankQrUrl] = useState<string>('');
  const [cedulaError, setCedulaError] = useState<string>('');

  // Tarifa y fee inmutable
  const feePorBoleto = 0.25;
  const subtotalTarifa = selectedSeats.length * tarifaPorAsiento;
  const totalFee = selectedSeats.length * feePorBoleto;
  const totalPagar = subtotalTarifa + totalFee;

  const currentBankConfig = tenant.configBancos.find((b) => b.banco === selectedBank);

  // Paradas urbanas oficiales en Loja y el corredor
  const paradasAbordaje = [
    'Terminal Terrestre Reina del Cisne (Andén 12)',
    'Parada Parque Infantil (Av. Manuel Agustín Aguirre)',
    'Parada Supermaxi / La Pradera',
    'Parada Ciudadela La Tebaida',
    'Parada Universidad Nacional de Loja (Argelia)',
    'Parada Parque Central de Malacatos'
  ];

  // Copiar al portapapeles
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBankField(field);
    setTimeout(() => setCopiedBankField(null), 2500);
  };

  // Generar QR de pago dinámico
  useEffect(() => {
    async function makeBankQr() {
      if (!currentBankConfig) return;
      const payload =
        selectedBank === 'BANCO_DE_LOJA'
          ? `BANCO_LOJA|CTA:${currentBankConfig.numeroCuenta}|TITULAR:${currentBankConfig.titular}|RUC:${currentBankConfig.ruc}|MONTO:${totalPagar.toFixed(2)}|REF:VILCA-${Date.now().toString().slice(-4)}`
          : `DEUNA_PICHINCHA|CTA:${currentBankConfig.numeroCuenta}|TITULAR:${currentBankConfig.titular}|RUC:${currentBankConfig.ruc}|MONTO:${totalPagar.toFixed(2)}|PAGO_TRANSPORTE`;

      try {
        const url = await QRCode.toDataURL(payload, {
          width: 240,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        setBankQrUrl(url);
      } catch (err) {
        console.error('Error generando QR bancario:', err);
      }
    }
    makeBankQr();
  }, [selectedBank, currentBankConfig, totalPagar]);

  // Validación básica de cédula ecuatoriana
  const handleCedulaChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setCedula(clean);
    if (clean.length > 0 && clean.length < 10) {
      setCedulaError('La cédula ecuatoriana debe tener 10 dígitos.');
    } else {
      setCedulaError('');
    }
  };

  const isFormValid =
    cedula.length === 10 &&
    nombre.trim().length >= 4 &&
    correo.includes('@') &&
    whatsapp.replace(/\D/g, '').length >= 9 &&
    referenciaBanco.trim().length >= 4;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: FORMULARIO DEL PASAJERO INVITADO (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Datos Personales */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Datos del Pasajero (Sin Registro)</h2>
                <p className="text-xs text-slate-500">
                  Emitiremos los pases digitales oficiales a estos datos
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Cédula */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cédula / Documento de Identidad <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => handleCedulaChange(e.target.value)}
                  placeholder="1104859201"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all ${
                    cedulaError ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-amber-200 focus:border-amber-500'
                  }`}
                />
                {cedulaError && <p className="text-[11px] text-rose-600 mt-1">{cedulaError}</p>}
              </div>

              {/* Nombre Completo */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombres y Apellidos Completos <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.toUpperCase())}
                  placeholder="CARLOS ALBERTO MORA OCHOA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-amber-200 focus:border-amber-500 text-xs font-bold transition-all"
                />
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Correo Electrónico (Para envío de boleto) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="pasajero@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-amber-200 focus:border-amber-500 text-xs transition-all"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Número de WhatsApp (Notificación inmediata) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+593 99 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-amber-200 focus:border-amber-500 text-xs font-mono transition-all"
                />
              </div>

              {/* Punto de Abordaje */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Punto de Abordaje en Loja / Corredor <span className="text-rose-500">*</span>
                </label>
                <select
                  value={puntoAbordaje}
                  onChange={(e) => setPuntoAbordaje(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-amber-200 focus:border-amber-500 text-xs font-medium bg-white transition-all"
                >
                  {paradasAbordaje.map((parada) => (
                    <option key={parada} value={parada}>
                      {parada}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Instrucciones Bancarias y Comprobante */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Transferencia Bancaria Directa</h2>
                <p className="text-xs text-slate-500">
                  Conciliación autónoma con IA en menos de 3 segundos
                </p>
              </div>
            </div>

            {/* Selector Banco de Loja vs Pichincha / Deuna */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedBank('BANCO_DE_LOJA')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedBank === 'BANCO_DE_LOJA'
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-extrabold text-slate-900 block">Banco de Loja</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Cta Corriente Directa</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedBank('BANCO_PICHINCHA')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedBank === 'BANCO_PICHINCHA'
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-extrabold text-slate-900 block">Pichincha / Deuna</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Transferencia o App Deuna</span>
              </button>
            </div>

            {/* Datos de la cuenta seleccionada */}
            {currentBankConfig && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans font-semibold">Titular:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{currentBankConfig.titular}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentBankConfig.titular, 'titular')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedBankField === 'titular' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans font-semibold">RUC Cooperativa:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{currentBankConfig.ruc}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentBankConfig.ruc, 'ruc')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedBankField === 'ruc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans font-semibold">No. de Cuenta:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-blue-900 text-sm">
                      {currentBankConfig.numeroCuenta} ({currentBankConfig.tipoCuenta})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentBankConfig.numeroCuenta, 'cuenta')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedBankField === 'cuenta' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-sans font-semibold">Monto Exacto a Transferir:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    ${totalPagar.toFixed(2)} USD
                  </span>
                </div>
              </div>
            )}

            {/* Input de Número de Referencia o Comprobante */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Referencia / Comprobante de Transferencia <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={referenciaBanco}
                  onChange={(e) => setReferenciaBanco(e.target.value.toUpperCase())}
                  placeholder="Ej: 784912 o PICH-904128"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-amber-200 focus:border-amber-500 font-mono font-bold text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={() => setReferenciaBanco(`REF-${Math.floor(100000 + Math.random() * 900000)}`)}
                  className="absolute right-2 top-2 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded"
                >
                  Generar Demo
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ingrese el código numérico o alfanumérico que emite su banco al transferir.
              </p>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: QR DE PAGO Y DESGLOSE INMUTABLE (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-500" />
              <span>QR de Transferencia Bancaria</span>
            </h3>

            {/* Imagen QR para escaneo */}
            {bankQrUrl && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
                <img
                  src={bankQrUrl}
                  alt="QR de Pago Bancario"
                  className="w-44 h-44 rounded-xl border border-slate-200 shadow-xs bg-white p-2"
                />
                <span className="text-[11px] text-slate-500 mt-2 font-mono">
                  Escanee desde su App de {selectedBank === 'BANCO_DE_LOJA' ? 'Banco de Loja' : 'Pichincha / Deuna'}
                </span>
              </div>
            )}

            {/* Desglose Inmutable de Tarifa */}
            <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Ruta y Destino:</span>
                <span className="font-bold text-slate-900">{destinoNombre}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Horario del Turno:</span>
                <span className="font-bold text-slate-900">{turno.frecuenciaHora}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Asiento(s) Reservados:</span>
                <span className="font-mono font-bold text-slate-900">
                  [{selectedSeats.join(', ')}]
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Boletos ({selectedSeats.length} × ${tarifaPorAsiento.toFixed(2)}):</span>
                  <span>${subtotalTarifa.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-800 font-semibold bg-amber-50 p-1.5 rounded-lg">
                  <span>Fee Transaccional ($0.25 × {selectedSeats.length}):</span>
                  <span>${totalFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total a Pagar:</span>
                  <span className="text-xl text-emerald-700">${totalPagar.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="pt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                className="w-full sm:w-1/3 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <button
                type="button"
                onClick={onSubmitPayment}
                disabled={!isFormValid || isSubmitting}
                className="w-full sm:w-2/3 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Procesando Reserva...</span>
                ) : (
                  <>
                    <span>Confirmar y Enviar Comprobante</span>
                    <ArrowRight className="w-4 h-4 text-emerald-200" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
