# AGENTS.md - GUARDARRAÍLES Y REGLAS DE SISTEMA "PASAJE YA"

## STACK TECNOLÓGICO
- Framework: Next.js 16 (App Router, Server Actions, API Routes).
- Lenguaje & UI: TypeScript (Estricto) + Tailwind CSS + Lucide React + Shadcn UI.
- Base de Datos: Neon PostgreSQL + Prisma ORM v5+.
- Despliegue: GitHub (repositorio privado) ➔ Vercel (https://pasajeya.vercel.app).
- Conciliación Bancaria: Gmail API (OAuth2) + Google Cloud Pub/Sub (Banco de Loja / Pichincha).
- WhatsApp Gateway: Servidor VPS $5/mes (Evolution API) para avisos automáticos.
- PWA Ayudante: Service Workers + IndexedDB para escaneo QR offline con PIN 1191.

## REGLAS DE NEGOCIO INMUTABLES (NUNCA VIOLAR)
1. Tarifa Transaccional: Se cobra estrictamente $0.25 de fee por boleto individual vendido en línea.
2. Cierre de Venta Web: Se congela automáticamente a T-20 minutos de la hora de salida.
3. Idempotencia Bancaria: Restricción única en base de datos `[tenantId, referenciaBanco]`.
4. Asientos Web: Bloque exclusivo del 1 al 10 con locking atómico de 15 minutos.
5. Respaldo BD: Cron Job Vercel a las 23:50 PM con dump SQL enviado por correo electrónico.

## PROTOCOLO OBLIGATORIO DE CONTINUIDAD Y SINCRONIZACIÓN
- **Persistencia en cada turno:** Al finalizar cada intervención de desarrollo o refinamiento de lógica, sincronizar inmediatamente con Git:
  `git add . && git commit -m "..." && git push origin main`
- **Mantenimiento de Memoria:** Registrar cualquier cambio de arquitectura o progreso en `memory.md` y `PROJECT_CONTEXT.md`.
