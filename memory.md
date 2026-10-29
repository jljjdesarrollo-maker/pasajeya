# MEMORY.md - MEMORIA OPERATIVA Y CONTINUIDAD DE "PASAJE YA"

## 📌 FICHA TÉCNICA Y ESTADO GENERAL
- **Proyecto:** PasajeYa (SaaS Multi-tenant para cooperativas de transporte interparroquial e interprovincial de Ecuador).
- **Cliente Piloto:** Vilcabambaturis Cía. Ltda. (Loja ⇄ Vilcabamba / El Tambo / Yangana / La Elvira).
- **Repositorio GitHub:** `https://github.com/jljjdesarrollo-maker/pasajeya` (rama `main`).
- **Producción Vercel:** `https://pasajeya.vercel.app`.
- **Base de Datos:** Neon PostgreSQL Serverless (`ep-proud-dew-b5stc73y-pooler.c-7.us-east-2.aws.neon.tech/neondb`).
- **ORM:** Prisma ORM v5.22.0.
- **PIN Corporativo de Personal:** `1191`.

---

## 🧭 ESTADO DEL PLAN POR FASES DE REFORMULACIÓN

### ✅ FASE 1: GOBERNANZA, BASE DE DATOS Y PRISMA ORM (COMPLETADA)
- Archivos de gobernanza `AGENTS.md` y `memory.md` creados en la raíz.
- Esquema de base de datos relacional definido en `prisma/schema.prisma` con modelos:
  - `Tenant` y `TenantBankConfig` (Bancos con unicidad compuesta).
  - `Ruta`, `TramoTarifa`, `UnidadBus`, `Frecuencia`, `ProgramacionTurno`.
  - `TransaccionPago` (idempotencia garantizada por `@@unique([tenantId, referenciaBanco])`).
  - `Boleto` (código único, firma digital HMAC, estado y timestamps).
  - `FacturacionMensualTenant` y `LogRespaldoBD`.
- Sincronización exitosa con Neon PostgreSQL vía `prisma db push`.
- Cliente Prisma generado (`@prisma/client` v5.22.0).
- Script de inicialización `prisma/seed.ts` ejecutado con datos reales del piloto Vilcabambaturis.

### ⏳ FASE 2: CONCILIACIÓN BANCARIA AUTOMATIZADA & IDEMPOTENCIA
- Ingesta de notificaciones por correo de transferencias Banco de Loja y Banco Pichincha / Deuna.
- Validación de montos esperados vs recibidos.
- Prevención de duplicados con restricción única en `TransaccionPago`.

### ⏳ FASE 3: MOTOR DE BLOQUEO DE ASIENTOS Y REGLA T-20 MINUTOS
- Reserva exclusiva de asientos web (1 al 10) con bloqueo temporal atómico de 15 minutos.
- Congelamiento automático de venta web a T-20 minutos de la hora de salida de cada turno.
- Liberación a taquilla física de asientos web no vendidos tras T-20 min.

### ⏳ FASE 4: PORTAL DE SECRETARÍA / TAQUILLA SRI & GESTIÓN DE FLOTA
- Interfaz privada protegida con PIN `1191`.
- Copiado de datos de pasajeros en 1 clic para facturación electrónica del SRI.
- Reasignación de disco de autobús por contingencia mecánica con alerta inmediata.

### ⏳ FASE 5: PWA OFFLINE DEL AYUDANTE A BORDO & AUDITORÍA B2B
- Manifiesto offline en IndexedDB para control de abordaje en carretera sin cobertura celular.
- Escaneo rápido de códigos QR y verificación criptográfica HMAC.
- Cierre contable mensual y cobro de fee transaccional de $0.25 por boleto emitido.

---

## 🗺️ MEMORIA DE TOPOLOGÍA VIAL Y RUTAS (ADR-005)
1. **Troncal Principal (Loja ⇄ Malacatos):**
   - El 100% de los turnos pasan por Malacatos (Parque Central).
2. **Ramal Noroccidental (Loja ⇄ Malacatos ⇄ El Tambo):**
   - Bifurcación en Malacatos hacia El Tambo. No ingresa a Vilcabamba.
   - Frecuencias asignadas: 08:30 y 17:30.
3. **Troncal Sur (Loja ⇄ Malacatos ⇄ Vilcabamba y extensiones):**
   - Ruta principal: Loja ⇄ Malacatos ⇄ Vilcabamba (Terminal Principal).
   - Extensión a comunidades del sur: Yangana, Zahuayco y La Elvira.

---

## 🏦 CUENTAS BANCARIAS CONFIGURADAS (PILOTO VILCABAMBATURIS)
- **Banco de Loja:** Cuenta Corriente No. `2901234567` | Titular: Vilcabambaturis Cía. Ltda. | RUC: `1191728394001`
- **Banco Pichincha / Deuna:** Cuenta Corriente No. `3109876543` | Titular: Vilcabambaturis Cía. Ltda. | RUC: `1191728394001`

---

## 🚌 FLOTA REGISTRADA
- Disco 04: Placa LBA-2564 (Capacidad 45)
- Disco 12: Placa LBA-3190 (Capacidad 45)
- Disco 18: Placa LBA-1845 (Capacidad 45)
- Disco 25: Placa LBA-4012 (Capacidad 45)
