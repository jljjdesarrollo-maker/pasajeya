/**
 * Endpoint Vercel Cron Job: /api/v1/cron/backup-db
 * Programación en vercel.json: "50 23 * * *" (23:50 PM diario)
 *
 * Responsabilidades:
 * 1. Verificar encabezado de seguridad Authorization: Bearer <CRON_SECRET>.
 * 2. Extraer y serializar en Dump SQL toda la base de datos Neon PostgreSQL.
 * 3. Enviar el respaldo comprimido al correo en process.env.BACKUP_NOTIFICATION_EMAIL.
 * 4. Registrar la ejecución en la tabla LogRespaldoBD (Prisma).
 */

import { ejecutarRespaldoNocturnoSQL } from '../../../../../src/services/backupAndAuditService';

export async function GET(request: Request): Promise<Response> {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('x-cron-secret') ||
    '';

  const resultado = await ejecutarRespaldoNocturnoSQL({
    authHeader,
  });

  if (!resultado.autorizado) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: resultado.mensaje,
      }),
      {
        status: resultado.statusHttp,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: '/api/v1/cron/backup-db',
      schedule: '50 23 * * *',
      message: resultado.mensaje,
      logRespaldoBD: resultado.registroLog,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
