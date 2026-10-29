import React, { useState } from 'react';
import { Bus, ShieldCheck, Ticket, Users, FileSpreadsheet, Server, Lock, LogOut, KeyRound } from 'lucide-react';
import { Tenant } from '../types/transit';

interface HeaderProps {
  activeTab: 'comprar' | 'taquilla' | 'ayudante' | 'conciliacion' | 'gerencia';
  setActiveTab: (tab: 'comprar' | 'taquilla' | 'ayudante' | 'conciliacion' | 'gerencia') => void;
  tenant: Tenant;
  isStaff: boolean;
  setIsStaff: (isStaff: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  tenant,
  isStaff,
  setIsStaff
}) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // PIN por defecto: 1191 (primeros 4 dígitos del RUC de Vilcabambaturis) o 2026
    if (pinInput === '1191' || pinInput === '2026') {
      setIsStaff(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
      setActiveTab('taquilla');
    } else {
      setPinError(true);
    }
  };

  const handleLogoutStaff = () => {
    setIsStaff(false);
    setActiveTab('comprar');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            
            {/* Zona 1: Logo & Identidad de la Cooperativa */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Bus className="w-5 h-5" />
              </div>
              <button 
                onClick={() => setActiveTab('comprar')}
                className="text-left flex flex-col group cursor-pointer"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-amber-400 transition-colors">
                    PasajeYa
                  </span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 hidden sm:inline-block">
                    Oficial
                  </span>
                </div>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                  {tenant.nombreComercial}
                </span>
              </button>
            </div>

            {/* Zona 2: Navegación Condicional */}
            {isStaff ? (
              /* Menú EXCLUSIVO para Personal Autorizado */
              <nav className="hidden lg:flex items-center gap-4 text-xs font-medium">
                <span className="px-2 py-1 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-semibold tracking-wide">
                  PORTAL OPERATIVO
                </span>

                <button
                  onClick={() => setActiveTab('comprar')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === 'comprar'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Vista Pasajero</span>
                </button>

                <button
                  onClick={() => setActiveTab('taquilla')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === 'taquilla'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Taquilla & SRI</span>
                </button>

                <button
                  onClick={() => setActiveTab('ayudante')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === 'ayudante'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Ayudante PWA</span>
                </button>

                <button
                  onClick={() => setActiveTab('conciliacion')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === 'conciliacion'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Conciliación IA</span>
                </button>

                <button
                  onClick={() => setActiveTab('gerencia')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === 'gerencia'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Gerencia SaaS</span>
                </button>
              </nav>
            ) : (
              /* Indicador Limpio para Pasajeros (Móvil y Desktop) */
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Venta en Línea Asientos 1 al 10</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Loja ⇄ Vilcabamba</span>
              </div>
            )}

            {/* Zona 3: Botones de Acción */}
            <div className="flex items-center gap-2.5 shrink-0">
              {isStaff ? (
                <button
                  onClick={handleLogoutStaff}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                  title="Salir de la consola operativa"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowPinModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
                  title="Acceso exclusivo para taquilla, ayudante y gerencia"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Acceso Personal</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra Secundaria Móvil si es Personal */}
          {isStaff && (
            <div className="lg:hidden flex items-center justify-between gap-1 py-2 border-t border-slate-800 overflow-x-auto text-xs">
              <button
                onClick={() => setActiveTab('comprar')}
                className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'comprar' ? 'bg-amber-400 text-slate-900 font-bold' : 'text-slate-300'}`}
              >
                Pasajero
              </button>
              <button
                onClick={() => setActiveTab('taquilla')}
                className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'taquilla' ? 'bg-amber-400 text-slate-900 font-bold' : 'text-slate-300'}`}
              >
                Taquilla SRI
              </button>
              <button
                onClick={() => setActiveTab('ayudante')}
                className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'ayudante' ? 'bg-amber-400 text-slate-900 font-bold' : 'text-slate-300'}`}
              >
                Ayudante PWA
              </button>
              <button
                onClick={() => setActiveTab('conciliacion')}
                className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'conciliacion' ? 'bg-amber-400 text-slate-900 font-bold' : 'text-slate-300'}`}
              >
                Conciliación
              </button>
              <button
                onClick={() => setActiveTab('gerencia')}
                className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'gerencia' ? 'bg-amber-400 text-slate-900 font-bold' : 'text-slate-300'}`}
              >
                Gerencia
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Modal de Autenticación de Personal con PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900 mb-1">
              Acceso a Personal de Operaciones
            </h3>
            <p className="text-xs text-slate-500 text-center mb-5">
              Portal interno para Taquilla SRI, Ayudante a Bordo y Gerencia de <strong className="text-slate-700">{tenant.nombreComercial}</strong>.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                  Ingrese el PIN de Seguridad
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  autoFocus
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                />
                {pinError && (
                  <p className="text-xs text-rose-600 text-center mt-1.5 font-medium">
                    PIN incorrecto. (PIN piloto: 1191 o 2026)
                  </p>
                )}
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  PIN piloto de prueba: <span className="font-mono font-semibold text-slate-600">1191</span>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError(false);
                  }}
                  className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
