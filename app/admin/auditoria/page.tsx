'use client';

import React, { useState } from 'react';
import { crearEstadoInicialFrecuencias } from '../../../src/services/pasajeyaEngine';
import { crearHistorialRespaldosInicial } from '../../../src/services/backupAndAuditService';
import { AuditoriaSaaSView } from '../../../src/components/AuditoriaSaaSView';
import { LogRespaldoBDRecord } from '../../../src/types/pasajeya';

/**
 * Consola de Auditoría SaaS y Respaldos Nocturnos SQL (/admin/auditoria)
 * Protegida por PIN Corporativo 1191 (Rol: GERENCIA / SUPERADMIN)
 */
export default function AuditoriaPage() {
  const [frecuencias] = useState(() => crearEstadoInicialFrecuencias());
  const [historialRespaldos, setHistorialRespaldos] = useState<
    LogRespaldoBDRecord[]
  >(() => crearHistorialRespaldosInicial());

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6 max-w-7xl mx-auto">
      <AuditoriaSaaSView
        frecuencias={frecuencias}
        historialRespaldos={historialRespaldos}
        onNuevoRespaldoGenerado={(nuevo) =>
          setHistorialRespaldos((prev) => [nuevo, ...prev])
        }
      />
    </main>
  );
}
