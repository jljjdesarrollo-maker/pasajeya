'use client';

import React, { useState } from 'react';
import { crearEstadoInicialFrecuencias } from '../src/services/pasajeyaEngine';
import { Modulo1PublicCheckoutView } from '../src/components/Modulo1PublicCheckoutView';
import { FrecuenciaRuta } from '../src/types/pasajeya';

/**
 * Módulo 1: Interfaz Pública de Compra (Mobile-First), Rutas, Mapa de Asientos Hino AK y Checkout ANT
 */
export default function PublicCheckoutPage() {
  const [frecuencias, setFrecuencias] = useState<FrecuenciaRuta[]>(() =>
    crearEstadoInicialFrecuencias()
  );
  const [frecuenciaSeleccionadaId, setFrecuenciaSeleccionadaId] =
    useState<string>(() => frecuencias[1]?.id || frecuencias[0]?.id);

  const frecuenciaActual =
    frecuencias.find((f) => f.id === frecuenciaSeleccionadaId) ||
    frecuencias[0];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6 max-w-7xl mx-auto">
      <Modulo1PublicCheckoutView
        frecuencias={frecuencias}
        frecuenciaActual={frecuenciaActual}
        onSelectFrecuencia={setFrecuenciaSeleccionadaId}
        onUpdateFrecuencia={(actualizada) =>
          setFrecuencias((prev) =>
            prev.map((f) => (f.id === actualizada.id ? actualizada : f))
          )
        }
        onEmitirBoletosQR={() => {}}
      />
    </main>
  );
}
