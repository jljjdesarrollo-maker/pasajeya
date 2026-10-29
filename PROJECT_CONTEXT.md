# PROJECT_CONTEXT.md: BITÁCORA DE CONTINUIDAD Y PROMPT DE ARRANQUE FRÍO (PASAJE YA)
> **GUÍA DE RESCATE PARA CAMBIO DE CUENTA DE GOOGLE AI STUDIO / GITHUB**
> **Última sincronización:** Octubre 2026
> **Proyecto:** PasajeYa (SaaS Multi-Tenant de boletaje interparroquial e interprovincial)
> **Piloto Activo:** Vilcabambaturis Cía. Ltda. (Loja - Vilcabamba, Ecuador)

---

## 🚀 1. PROMPT MAESTRO PARA COPIAR Y PEGAR EN OTRA CUENTA DE GOOGLE AI STUDIO

Cuando abras una nueva sesión en otra cuenta de Google AI Studio vinculada al repositorio `jljjdesarrollo-maker/pasajeya`, **copia y pega exactamente el siguiente bloque de texto como tu primer mensaje**:

```text
Hola. Estoy continuando el desarrollo del proyecto "PasajeYa", un SaaS multi-tenant de boletaje de buses para Ecuador con auto-conciliación bancaria (Banco de Loja / Pichincha / Deuna) y tarifa transaccional de $0.25 por pasaje.

Por favor, antes de responder o modificar cualquier archivo:
1. Lee completamente los archivos de contexto en la raíz:
   - /ARCHIVO_MAESTRO_PASAJE_YA.md (Arquitectura, reglas de negocio, esquema Neon Postgres y fases)
   - /PROJECT_CONTEXT.md (Bitácora de decisiones y estado de avance actual)
2. Confirma que comprendes el modelo de negocio, el cliente piloto (Vilcabambaturis Cía. Ltda.), la infraestructura (Vercel + Neon Postgres Serverless) y cuál es la Fase actual en curso.
3. Indícame en qué fase estamos y qué tarea técnica específica continuaremos ejecutando.
```

---

## 📋 2. MAPA DE RECURSOS Y CUENTAS VINCULADAS

| Servicio | Identificador / Cuenta | Rol en el Proyecto |
| :--- | :--- | :--- |
| **GitHub** | `jljjdesarrollo-maker/pasajeya` (`jljjdesarrollo@gmail.com`) | Repositorio remoto central canónico |
| **Vercel PasajeYa** | `jjayajaramillo-gmailcoms-projects` (`jjayajaramillo@gmail.com`) | Producción desplegada: `https://pasajeya.vercel.app` |
| **Neon PostgreSQL** | Org: `jljjdesarrollo-maker`, Proy: `quiet-union-86818791` | Base de datos relacional serverless (AWS Ohio) |
| **Cliente Piloto** | Vilcabambaturis Cía. Ltda. (RUC: `1191728394001`) | Ruta Loja - Vilcabamba, 45 asientos, Discos 04, 12, 18, 25 |

---

## 🛠️ 3. REGISTRO CRONOLÓGICO DE DECISIONES DE ARQUITECTURA (ADR)

### ADR-001: Despliegue en Vercel con Cuentas Segregadas
* **Decisión:** Para no saturar los límites de cuota de Vercel Hobby de Ruta GO, PasajeYa se aloja en la cuenta Vercel de `jjayajaramillo@gmail.com` vinculada al repo GitHub `jljjdesarrollo-maker/pasajeya`.
* **Configuración aplicada:** Variable de entorno `DATABASE_URL` configurada con el pooler de Neon Serverless (`ep-proud-dew-b5stc73y-pooler.c-7.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require`).

### ADR-002: Arquitectura de Frontend Único vs Apps Nativas
* **Problema planteado:** ¿Debe crearse una app de celular separada para pasajeros y otra web para secretaría?
* **Decisión técnica:** **UNA SOLA APLICACIÓN WEB RESPONSIVE (PWA) MULTI-ROL**.
  * **Razón:** El 85% de pasajeros rechaza descargar una app de 50 MB de Play Store para un viaje en bus de $2.50. Requiere entrar directo vía web/WhatsApp, comprar en 10 segundos y recibir su QR.
  * **Segregación:** 
    * **Público (Pasajeros):** Solo ve el portal de compra directa en móvil/desktop (cero ruido de taquilla o gerencia).
    * **Privado (Operadores / Secretaría / Ayudante / Gerencia):** Acceso protegido mediante PIN o credencial desde un enlace discreto de acceso personal.
    * **Ayudante:** Instala la misma web como PWA en su celular para escanear boletos offline con IndexedDB.

### ADR-003: Motor de Bloqueo de Asientos y Conciliación
* **Seat Locking Atómico:** 15 minutos exactos para compra en línea de los asientos 1 al 10.
* **Cierre de Venta Web:** Congelamiento automático a T-20 minutos antes de la salida del bus.
* **Auto-Conciliación:** Regex de alta velocidad (<20ms) para correos bancarios + fallback Gemini Flash.
* **Fee SaaS:** $0.25 por pasaje cobrado a fin de mes a la cooperativa.

---

## 🗺️ 4. ESTADO DE LAS 5 FASES DE LEVANTAMIENTO

- [x] **Fase 1: Infraestructura Base & Despliegue en la Nube (100% COMPLETADA)**
  - Repositorio GitHub conectado a Vercel con build exitoso.
  - Conexión a Neon Serverless PostgreSQL validada.
  - Generador de respaldos nocturnos cron 23:50 PM.
  - Criptografía HMAC-SHA256 para códigos QR.

- [x] **Fase 2: Segregación Estricta de Portales Pasajero vs Personal (COMPLETADA HOY)**
  - Portal de Pasajero 100% limpio y responsive (móvil y desktop) sin menús de administración visibles.
  - Acceso seguro mediante PIN para el personal de la cooperativa (Secretaría SRI, Ayudante PWA, Conciliación, Gerencia).
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
