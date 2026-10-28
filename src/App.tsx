import React, { useState } from 'react';
import { Header } from './components/Header';
import { PassengerCheckout } from './components/PassengerCheckout';
import { SecretariaTaquilla } from './components/SecretariaTaquilla';
import { AyudantePwa } from './components/AyudantePwa';
import { ReconciliationConsole } from './components/ReconciliationConsole';
import { GerenciaDashboard } from './components/GerenciaDashboard';
import { dbService } from './services/database';

export default function App() {
  const [activeTab, setActiveTab] = useState<'comprar' | 'taquilla' | 'ayudante' | 'conciliacion' | 'gerencia'>('comprar');
  const tenant = dbService.getTenant();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Top Bar Contract (3 Zonas: Wordmark, Nav Links, Acción Primaria) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tenant={tenant}
      />

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'comprar' && <PassengerCheckout tenant={tenant} />}
        {activeTab === 'taquilla' && <SecretariaTaquilla tenant={tenant} />}
        {activeTab === 'ayudante' && <AyudantePwa tenant={tenant} />}
        {activeTab === 'conciliacion' && <ReconciliationConsole tenant={tenant} />}
        {activeTab === 'gerencia' && <GerenciaDashboard tenant={tenant} />}
      </main>

      {/* Footer Limpio y Profesional */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{tenant.nombreComercial}</span>
            <span aria-hidden="true">·</span>
            <span>RUC: {tenant.ruc}</span>
            <span aria-hidden="true">·</span>
            <span>Loja, Ecuador</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>SaaS Transaccional v4.0</span>
            <span aria-hidden="true">·</span>
            <span>Fee: $0.25 por boleto</span>
            <span aria-hidden="true">·</span>
            <span>Respaldo Diario 23:50 PM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
