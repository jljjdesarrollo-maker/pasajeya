'use client';

import React, { useState } from 'react';
import { crearEstadoInicialFrecuencias } from '../../src/services/pasajeyaEngine';
import { AyudanteView } from '../../src/components/AyudanteView';
import { FrecuenciaRuta } from '../../src/types/pasajeya';

/**
 * Vista de Ayudante de Autobús (Compatible con Next.js App Router y Vite SPA)
 * Ruta protegida por PIN corporativo 1191 (Rol: AYUDANTE)
 */
export default function AyudantePage() {
  const [frecuencias, setFrecuencias] = useState<FrecuenciaRuta[]>(() =>
    crearEstadoInicialFrecuencias()
  );
  const [frecuenciaSeleccionadaId, setFrecuenciaSeleccionadaId] =
    useState<string>(() => frecuencias[0]?.id || 'freq-loja-vilca-1030');

  const frecuenciaActual =
    frecuencias.find((f) => f.id === frecuenciaSeleccionadaId) ||
    frecuencias[0];

  const handleSyncBoletos = (
    frecuenciaId: string,
    boletosAbordadosIds: string[]
  ) => {
    setFrecuencias((prev) =>
      prev.map((f) =>
        f.id === frecuenciaId
          ? {
              ...f,
              boletos: f.boletos.map((b) =>
                boletosAbordadosIds.includes(b.id)
                  ? { ...b, estadoAbordaje: 'ABORDADO' }
                  : b
              ),
            }
          : f
      )
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6 max-w-7xl mx-auto">
      <AyudanteView
        frecuencias={frecuencias}
        frecuenciaActual={frecuenciaActual}
        onSelectFrecuencia={setFrecuenciaSeleccionadaId}
        onSyncBoletosToMainState={handleSyncBoletos}
      />
    </main>
  );
}
