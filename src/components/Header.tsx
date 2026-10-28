import React from 'react';
import { Bus, ShieldCheck, Ticket, Users, FileSpreadsheet, Server } from 'lucide-react';
import { Tenant } from '../types/transit';

interface HeaderProps {
  activeTab: 'comprar' | 'taquilla' | 'ayudante' | 'conciliacion' | 'gerencia';
  setActiveTab: (tab: 'comprar' | 'taquilla' | 'ayudante' | 'conciliacion' | 'gerencia') => void;
  tenant: Tenant;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, tenant }) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bus className="w-4 h-4" />
            </div>
            <a 
              href="#comprar" 
              onClick={(e) => { e.preventDefault(); setActiveTab('comprar'); }}
              className="text-base font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap"
            >
              {tenant.nombreComercial}
            </a>
          </div>

          {/* Zone 2: Concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              onClick={() => setActiveTab('comprar')}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'comprar'
                  ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-1 -mb-1'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Venta Pasajeros</span>
            </button>

            <button
              onClick={() => setActiveTab('taquilla')}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'taquilla'
                  ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-1 -mb-1'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Taquilla & SRI</span>
            </button>

            <button
              onClick={() => setActiveTab('ayudante')}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ayudante'
                  ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-1 -mb-1'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Ayudante PWA</span>
            </button>

            <button
              onClick={() => setActiveTab('conciliacion')}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'conciliacion'
                  ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-1 -mb-1'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Conciliación IA</span>
            </button>

            <button
              onClick={() => setActiveTab('gerencia')}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'gerencia'
                  ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-1 -mb-1'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Gerencia SaaS</span>
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 font-mono">
              <span className="text-slate-500">RUC:</span>
              <span className="tabular-nums">{tenant.ruc}</span>
            </span>

            <button 
              onClick={() => setActiveTab(activeTab === 'comprar' ? 'ayudante' : 'comprar')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              {activeTab === 'comprar' ? 'Modo Ayudante PWA' : 'Comprar Pasaje'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
