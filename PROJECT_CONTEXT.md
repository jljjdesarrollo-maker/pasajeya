# PROJECT_CONTEXT.md: BITÁCORA DE CONTINUIDAD Y PROMPT DE ARRANQUE FRÍO (PASAJE YA)
> **GUÍA DE RESCATE PARA CAMBIO DE CUENTA DE GOOGLE AI STUDIO / GITHUB**
> **Última sincronización:** Octubre 2026
> **Proyecto:** PasajeYa (SaaS Multi-Tenant de boletaje interparroquial e interprovincial)
> **Piloto Activo:** Vilcabambaturis Cía. Ltda. (Loja - Vilcabamba, Ecuador)

---

## 🚀 1. PROMPT MAESTRO PARA COPIAR Y PEGAR EN OTRA CUENTA DE GOOGLE AI STUDIO (CON AUTO-REGISTRO Y SYNC A GITHUB)

Cuando abras una nueva sesión en otra cuenta de Google AI Studio vinculada al repositorio `jljjdesarrollo-maker/pasajeya`, **copia y pega exactamente el siguiente bloque de texto como tu primer mensaje**:

```text
Hola. Estoy continuando el desarrollo del proyecto "PasajeYa", un SaaS multi-tenant de boletaje de buses para Ecuador con auto-conciliación bancaria (Banco de Loja / Pichincha / Deuna), segregación PWA de roles (Pasajeros vs Personal con PIN 1191), base de datos Neon PostgreSQL y tarifa transaccional de $0.25 por pasaje.

REGLAS OBLIGATORIAS DE CONTINUIDAD (PROTOCOLOS DE CERO PÉRDIDA ANTE FIN DE CUOTA):
1. Antes de responder o modificar archivos, lee completamente:
   - /ARCHIVO_MAESTRO_PASAJE_YA.md (Arquitectura, reglas de negocio, esquema de base de datos Neon y fases)
   - /PROJECT_CONTEXT.md (Bitácora cronológica, ADRs y estado actual)

2. PROTOCOLO DE AUTO-REGISTRO Y CLASIFICACIÓN AUTOMÁTICA EN CADA TURNO:
   - Cada vez que conversemos, tomes decisiones arquitectónicas, definas requerimientos o edites código, DEBES clasificar y registrar automáticamente los acuerdos y avances en /PROJECT_CONTEXT.md (y en /ARCHIVO_MAESTRO_PASAJE_YA.md si altera reglas de negocio o BD).
   - NUNCA esperes a que yo te pida actualizar la bitácora; hazlo de forma proactiva y automática en cada intervención.

3. PROTOCOLO DE AUTO-SINCRONIZACIÓN CONTINUA A GITHUB:
   - Como la cuota de Google AI Studio puede agotarse en cualquier momento sin previo aviso, en CADA TURNO donde realices cambios de código o documentación DEBES ejecutar:
     git add . && git commit -m "..." && git push origin main
   - Esto garantiza que GitHub y el auto-deploy de Vercel (https://pasajeya.vercel.app) siempre tengan el 100% del progreso intacto.

4. Confirma que has leído este protocolo, indícame en qué fase estamos y cuál es la siguiente tarea técnica que ejecutaremos.
```

---

## 📋 2. MAPA DE RECURSOS Y CUENTAS VINCULADAS

| Servicio | Identificador / Cuenta | Rol en el Proyecto |
| :--- | :--- | :--- |
| **GitHub** | `jljjdesarrollo-maker/pasajeya` (`jljjdesarrollo@gmail.com`) | Repositorio remoto central canónico (`main`) |
| **Vercel PasajeYa** | `jjayajaramillo-gmailcoms-projects` (`jjayajaramillo@gmail.com`) | Producción desplegada: `https://pasajeya.vercel.app` |
| **Neon PostgreSQL** | Org: `jljjdesarrollo-maker`, Proy: `quiet-union-86818791` | Base de datos relacional serverless (AWS Ohio) |
| **Cliente Piloto** | Vilcabambaturis Cía. Ltda. (RUC: `1191728394001`) | Ruta Loja - Vilcabamba, 45 asientos, Discos 04, 12, 18, 25 |
| **PIN Personal** | `1191` (Año / clave corporativa de Vilcabambaturis) | Acceso al portal de Secretaría, Ayudante, Conciliación y Gerencia |

---

## 🛠️ 3. REGISTRO CRONOLÓGICO DE DECISIONES DE ARQUITECTURA (ADR)

### ADR-001: Despliegue en Vercel con Cuentas Segregadas
* **Decisión:** Para no saturar los límites de cuota de Vercel Hobby de Ruta GO, PasajeYa se aloja en la cuenta Vercel de `jjayajaramillo@gmail.com` vinculada al repo GitHub `jljjdesarrollo-maker/pasajeya`.
* **Configuración aplicada:** Variable de entorno `DATABASE_URL` configurada con el pooler de Neon Serverless (`ep-proud-dew-b5stc73y-pooler.c-7.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require`).

### ADR-002: Arquitectura de Frontend Único vs Apps Nativas (PWA Multi-Rol)
* **Problema planteado:** ¿Debe crearse una app de celular separada para pasajeros y otra web para secretaría?
* **Decisión técnica:** **UNA SOLA APLICACIÓN WEB RESPONSIVE (PWA) MULTI-ROL**.
  * **Razón:** El 85% de pasajeros rechaza descargar una app de 50 MB de Play Store para un viaje en bus de $2.50. Requiere entrar directo vía web/WhatsApp, comprar en 10 segundos y recibir su QR.
  * **Segregación:** 
    * **Público (Pasajeros):** Solo ve el portal de compra directa en móvil/desktop (cero ruido de taquilla o gerencia).
    * **Privado (Operadores / Secretaría / Ayudante / Gerencia):** Acceso protegido mediante PIN (`1191`) desde un enlace discreto de acceso personal.
    * **Ayudante:** Instala la misma web como PWA en su celular para escanear boletos offline con IndexedDB.

### ADR-003: Motor de Bloqueo de Asientos y Conciliación
* **Seat Locking Atómico:** 15 minutos exactos para compra en línea de los asientos 1 al 10.
* **Cierre de Venta Web:** Congelamiento automático a T-20 minutos antes de la salida del bus.
* **Auto-Conciliación:** Regex de alta velocidad (<20ms) para correos bancarios + fallback Gemini Flash.
* **Fee SaaS:** $0.25 por pasaje cobrado a fin de mes a la cooperativa.

### ADR-004: Protocolo de Preservación de Contexto por Agotamiento de Cuota de IA
* **Problema planteado:** La cuota de tokens de Google AI Studio puede terminarse imprevistamente durante una sesión de desarrollo, arriesgando la pérdida de las conversaciones y directrices habladas con el usuario.
* **Decisión técnica:** 
  1. Cada turno de conversación debe clasificar y asentar automáticamente cualquier nuevo acuerdo o requerimiento en `/PROJECT_CONTEXT.md`.
  2. Todo cambio de código o documentación debe empujarse inmediatamente a GitHub (`git push origin main`) en el mismo turno, garantizando persistencia absoluta.

---

## ⚡ 4. PROTOCOLO OBLIGATORIO DE AUTO-SINCRONIZACIÓN CONTINUA ANTE AGOTAMIENTO DE CUOTA

Cualquier instancia de IA que opere este proyecto debe ejecutar rigurosamente este ciclo en cada turno:

```text
[TURNO DEL USUARIO] 
         │
         ▼
[1. ANÁLISIS & EJECUCIÓN TÉCNICA]
   - Modificación/creación de componentes, lógica o configuración.
         │
         ▼
[2. CLASIFICACIÓN Y AUTO-REGISTRO EN BITÁCORA]
   - Registrar la decisión en PROJECT_CONTEXT.md (Sección ADR o Bitácora de Turnos).
   - Si cambia arquitectura/BD, actualizar ARCHIVO_MAESTRO_PASAJE_YA.md.
         │
         ▼
[3. VERIFICACIÓN Y COMPILACIÓN]
   - Ejecutar compile_applet para asegurar 0 errores de build.
         │
         ▼
[4. AUTO-SINCRONIZACIÓN INMEDIATA A GITHUB]
   - Ejecutar: git add . && git commit -m "feat/fix/docs: descripción" && git push origin main
   - (Esto dispara automáticamente el re-despliegue en Vercel).
         │
         ▼
[5. RESPUESTA CONCISA AL USUARIO]
   - Resumen de lo ejecutado y propuesta del siguiente paso.
```

---

## 🗺️ 5. ESTADO DE LAS 5 FASES DE LEVANTAMIENTO

- [x] **Fase 1: Infraestructura Base & Despliegue en la Nube (100% COMPLETADA)**
  - Repositorio GitHub conectado a Vercel con build exitoso (`pasajeya.vercel.app`).
  - Conexión a Neon Serverless PostgreSQL validada.
  - Generador de respaldos nocturnos cron 23:50 PM.
  - Criptografía HMAC-SHA256 para códigos QR.

- [x] **Fase 2: Segregación Estricta de Portales Pasajero vs Personal (100% COMPLETADA)**
  - Portal de Pasajero 100% limpio y responsive (móvil y desktop) sin menús de administración visibles.
  - Acceso seguro mediante PIN (`1191`) para el personal de la cooperativa (Secretaría SRI, Ayudante PWA, Conciliación, Gerencia).
  - PWA Web App Manifest configurado para instalación en dispositivos móviles.

- [ ] **Fase 3: Integración Operativa Real con Pasarela de Correos / Webhooks Bancarios (SIGUIENTE PASO)**
  - Conexión de webhooks de Gmail / PubSub para recibir transferencias en tiempo real de Banco de Loja y Banco Pichincha / Deuna.
  - Pruebas E2E de auto-confirmación y emisión de boletos en < 3 segundos.

- [ ] **Fase 4: Flujo de Secretaría SRI y Contingencia de Flota**
  - Copiado rápido 1-clic para el sistema de facturación electrónica de la cooperativa.
  - Liberación automática de asientos sobrantes a T-20 min.
  - Reasignación de disco de bus por avería con notificación por WhatsApp.

- [ ] **Fase 5: PWA del Ayudante a Bordo & Auditoría Gerencial**
  - Manifiesto offline descargable en IndexedDB.
  - Escáner de QR a bordo sin internet en la carretera Loja-Vilcabamba.
  - Consolidado mensual B2B para liquidación de fees SaaS ($0.25/boleto).

---

## 📝 6. BITÁCORA HISTÓRICA DE CONVERSACIONES Y DECISIONES CLASIFICADAS

| Fecha / Turno | Clasificación | Temas & Decisiones Registradas |
| :--- | :--- | :--- |
| **Sesión Inicial** | Arquitectura & BD | Definición de PasajeYa como SaaS multi-tenant con tarifa de $0.25. Configuración de Neon Postgres Serverless y schema DDL en SQL y Drizzle. |
| **Sesión Vercel** | DevOps & Infra | Separación de cuentas Vercel (`jjayajaramillo@gmail.com` para PasajeYa vs cuenta de Ruta GO). Despliegue exitoso en `pasajeya.vercel.app` con variable `DATABASE_URL`. |
| **Sesión UX / PWA** | UX / Seguridad | Definición de PWA unificada responsiva. Segregación de portal público de pasajeros (sin menús técnicos) y acceso privado para personal protegido con PIN `1191`. |
| **Sesión Continuidad** | DevOps / Resiliencia | Creación del protocolo de cero pérdida ante fin de cuota de Google AI Studio, prompt maestro de arranque frío con auto-registro y subida automática sistemática a GitHub (`main`). |
