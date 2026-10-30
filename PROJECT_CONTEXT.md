# PROJECT_CONTEXT.md — ARQUITECTURA TÉCNICA Y ADRs (PASAJEYA)
# ESTADO: PROYECTO 100% COMPLETO Y LISTO PARA PRODUCCIÓN

## 1. Contexto Operativo (Vilcabambaturis Cía. Ltda.)
Vilcabambaturis Cía. Ltda. opera frecuencias continuas entre la Terminal Terrestre Reina del Cisne (Loja) y las parroquias del suroriental valle de Loja: **Vilcabamba, Malacatos, El Tambo, Yangana, Zahuayco y La Elvira**.

El sistema **PasajeYa** resuelve integralmente el ciclo operativo y financiero de la cooperativa:
1. Venta web anticipada sin colisión con ventanilla física (Bloque Web 1 al 10 y corte automático a T-20 min).
2. Sincronización contable en 1-clic con el **SRI (Servicio de Rentas Internas)** para facturación electrónica.
3. Validación criptográfica offline de boletos QR en carretera mediante PWA + IndexedDB para el ayudante.
4. Respaldo diario automatizado de la base de datos PostgreSQL a las 23:50 PM y auditoría transparente del modelo SaaS ($0.25 USD por boleto).

---

## 2. Registro de Decisiones de Arquitectura (ADRs)

### ADR-001: Partición Determinista de Asientos (Bloque Web 1–10)
- **Decisión:** Asignar los asientos `1` al `10` para venta digital anticipada.
- **Justificación:** Evita conflictos con boleteros de andén que venden del asiento `11` en adelante.

### ADR-002: Conciliación Bancaria Idempotente (< 1.2s)
- **Decisión:** Soportar transferencias directas e interbancarias de **Banco de Loja** y **Banco Pichincha** validando unicidad del código de comprobante.

### ADR-003: Regla de Corte y Congelamiento a T-20 Minutos (`ventaWebCongelada`)
- **Decisión:** Cuando `minutosParaSalida <= 20`, la frecuencia pasa a `ventaWebCongelada = true`.
- **Consecuencias:** Cierre de reservas web, liberación inmediata de asientos sobrantes (`1` al `10`) como `DISPONIBLE_VENTANILLA` en `/taquilla` y cierre inmutable del manifiesto SRI.

### ADR-004: Reasignación de Flota (`busDiscoTeorico` vs `busDiscoReal`) y Gateway WhatsApp VPS
- **Decisión:** Separar el disco planificado (`busDiscoTeorico`) del disco efectivo en andén (`busDiscoReal`).
- **Flujo de Contingencia:** Al registrar un cambio de `busDiscoReal`, el sistema despacha notificaciones automatizadas por WhatsApp mediante el Gateway VPS ($5/mes) a cada pasajero confirmado.

### ADR-005: Control de Acceso Operativo por PIN Corporativo (`1191`)
- **Decisión:** Proteger `/taquilla`, `/admin`, `/ayudante` y `/admin/auditoria` mediante PIN rápido de 4 dígitos (`1191`) asociado a los roles `SECRETARIA`, `AYUDANTE` y `GERENCIA`.

### ADR-006: PWA Offline-First con IndexedDB, Verificación QR HMAC-SHA256 Local y Delta Sync (Fase 5)
- **Decisión:** Construir el módulo del Ayudante (`/ayudante` y `app/ayudante/page.tsx`) como una Progressive Web App (PWA) respaldada por **IndexedDB** (`src/lib/offlineDb.ts`).
- **Flujo:** Pre-carga del manifiesto congelado a T-20 min, validación matemática `HMAC-SHA256` con 0 peticiones HTTP en tramos sin cobertura y *Delta Sync* hacia `/api/v1/tickets/sync-boarding`.

### ADR-007: Respaldo Automático SQL Nocturno (23:50 PM) y Liquidación SaaS B2B (Fase 6)
- **Decisión:** Programar un Vercel Cron Job diario a las 23:50 PM (`cron: "50 23 * * *"` en `vercel.json`) apuntando a `/api/v1/cron/backup-db` (`app/api/v1/cron/backup-db/route.ts`), autenticado mediante `CRON_SECRET`.
- **Ejecución de Respaldo:** Serializa la base de datos Neon PostgreSQL en un dump SQL transaccional, lo despacha al correo configurado en `process.env.BACKUP_NOTIFICATION_EMAIL` y persiste la evidencia de auditoría en el modelo Prisma `LogRespaldoBD`.
- **Liquidación B2B (`FacturacionMensualTenant`):** Consolida en `/admin/auditoria` la recaudación bruta diaria y mensual frente al fee tecnológico de `$0.25 USD` por boleto emitido.
