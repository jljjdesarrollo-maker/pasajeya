import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PassengerCheckout } from './components/PassengerCheckout';
import { SecretariaTaquilla } from './components/SecretariaTaquilla';
import { AyudantePwa } from './components/AyudantePwa';
import { ReconciliationConsole } from './components/ReconciliationConsole';
import { GerenciaDashboard } from './components/GerenciaDashboard';
import { dbService } from './services/database';
import { Lock, Shield } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'comprar' | 'taquilla' | 'ayudante' | 'conciliacion' | 'gerencia'>('comprar');
  const [isStaff, setIsStaff] = useState<boolean>(() => {
    return localStorage.getItem('pasajeya_staff_auth') === 'true';
  });

  const tenant = dbService.getTenant();

  useEffect(() => {
    // Detección de ruta inicial por URL (Segregación de interfaces)
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') || params.get('view');

      if (path.includes('/admin') || path.includes('/taquilla') || tabParam === 'taquilla') {
        if (!isStaff) {
          const pin = window.prompt('Portal de Administración y Taquilla SRI. Ingrese PIN de operador:');
          if (pin === '1191' || pin === '2026') {
            setIsStaff(true);
            setActiveTab('taquilla');
          } else {
            setActiveTab('comprar');
          }
        } else {
          setActiveTab('taquilla');
        }
      } else if (path.includes('/personal') || path.includes('/ayudante') || tabParam === 'ayudante') {
        if (!isStaff) {
          const pin = window.prompt('PWA Ayudante de Unidad. Ingrese PIN de personal (1191):');
          if (pin === '1191' || pin === '2026') {
            setIsStaff(true);
            setActiveTab('ayudante');
          } else {
            setActiveTab('comprar');
          }
        } else {
          setActiveTab('ayudante');
        }
      } else {
        setActiveTab('comprar');
      }
    }
  }, []);

  useEffect(() => {
    if (isStaff) {
      localStorage.setItem('pasajeya_staff_auth', 'true');
    } else {
      localStorage.removeItem('pasajeya_staff_auth');
    }
  }, [isStaff]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Top Bar Contract (Wordmark, Nav Links condicionales por rol, Acción de Acceso/Salida) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tenant={tenant}
        isStaff={isStaff}
        setIsStaff={setIsStaff}
      />

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'comprar' && <PassengerCheckout tenant={tenant} />}
        {activeTab === 'taquilla' && isStaff && <SecretariaTaquilla tenant={tenant} />}
        {activeTab === 'ayudante' && isStaff && <AyudantePwa tenant={tenant} />}
        {activeTab === 'conciliacion' && isStaff && <ReconciliationConsole tenant={tenant} />}
        {activeTab === 'gerencia' && isStaff && <GerenciaDashboard tenant={tenant} />}
      </main>

      {/* Footer Limpio y Profesional */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-extrabold text-slate-900">PasajeYa</span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-slate-700">{tenant.nombreComercial}</span>
            <span aria-hidden="true">·</span>
            <span>RUC: {tenant.ruc}</span>
            <span aria-hidden="true">·</span>
            <span>Loja, Ecuador</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
            <span>SaaS Multi-Tenant</span>
            <span aria-hidden="true">·</span>
            <span>Fee: $0.25 / boleto</span>
            <span aria-hidden="true">·</span>
            <span>Respaldo 23:50 PM</span>
            <span aria-hidden="true">·</span>
            {!isStaff ? (
              <button
                onClick={() => {
                  const pin = window.prompt('Ingrese PIN de acceso de personal:');
                  if (pin === '1191' || pin === '2026') {
                    setIsStaff(true);
                    setActiveTab('taquilla');
                  } else if (pin) {
                    alert('PIN incorrecto. (Piloto: 1191)');
                  }
                }}
                className="text-slate-400 hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                <span>Portal Operadores</span>
              </button>
            ) : (
              <span className="text-amber-600 font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Sesión Operador Activa</span>
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
