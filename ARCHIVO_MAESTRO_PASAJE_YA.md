# ARCHIVO MAESTRO DE CONTEXTO: SISTEMA "PASAJEYA" (SaaS MULTI-TENANT v4.0)
> **DOCUMENTO MAESTRO PARA CONTINUIDAD EN LA NUBE (CHAT / IA)**
> **Última Actualización:** Octubre 2026
> **Directiva de Trabajo:** Metodología 100% en la nube mediante este archivo maestro de contexto unificado. No se utiliza repositorio Git local obligatorio entre equipos para prevenir desincronizaciones. Cualquier nueva sesión de IA debe leer este archivo en su totalidad para continuar sin perder el hilo.

---

## 1. IDENTIDAD Y ALCANCE DEL PRODUCTO

* **Nombre de la Plataforma SaaS:** **PasajeYa**
* **Repositorio Remoto Oficial:** `https://github.com/jljjdesarrollo-maker/pasajeya`
* **Correo Asociado a GitHub:** `jljjdesarrollo@gmail.com`
* **Principio de Autoridad y Fuente Canónica:**
  * **REGLA ABSOLUTA:** Todo el código fuente, modelos relacionales, reglas de negocio y flujos operacionales válidos son **exclusivamente** los construidos y acordados en este entorno en la nube.
  * Los archivos previos que pudieran existir en el repositorio remoto quedan desestimados; lo único que se adopta es el nombre oficial **PasajeYa**.
* **Tipo de Software:** Plataforma Web Autónoma de Venta de Boletos Interparroquiales e Interprovinciales, Multi-Tenant con Auto-Conciliación Bancaria con Inteligencia Artificial.
* **Cliente Piloto Activo:** **Vilcabambaturis Cía. Ltda.**
  * **RUC:** 1191728394001
  * **Sede Principal:** Loja, Ecuador (Terminal Terrestre Reina del Cisne)
  * **Rutas Piloto:** Loja ⇄ Vilcabamba, Malacatos, El Tambo, Yangana, Zahuayco, La Elvira.
  * **Flota Piloto:** Disco 04 (LBA-2564), Disco 12 (LBA-3190), Disco 18 (LBA-1845), Disco 25 (LBA-4012). Capacidad estándar: 45 asientos por unidad.
  * **Cuentas Bancarias Registradas:**
    * Banco de Loja: Cta. Corriente #2901234567 (Titular: Vilcabambaturis Cía. Ltda.)
    * Banco Pichincha: Cta. Corriente #3109876543 (Titular: Vilcabambaturis Cía. Ltda. / Deuna QR)

---

## 2. MODELO DE NEGOCIO Y FINANCIERO SAAS

* **Sin costos fijos de entrada ni mensualidades básicas obligatorias** para las cooperativas.
* **Fee Transaccional:** **$0.25 USD por cada boleto vendido en línea** (ej: 2 pasajes comprados = $0.50 USD de fee).
* **Flujo del Dinero:** El 100% de la transferencia del usuario (Tarifa oficial del pasaje + Fee del servicio web) se acredita directamente en las cuentas bancarias de la cooperativa.
* **Liquidación B2B:** Facturación mensual consolidada a fin de mes por `$0.25 × N boletos confirmados`.

---

## 3. ARQUITECTURA TÉCNICA E INFRAESTRUCTURA DEVOPS

### A. Stack Tecnológico
* **Framework:** React 19 + Express Full-Stack (con middleware Vite integrado y TypeScript estricto).
* **Estilos & UI:** Tailwind CSS v4 + Lucide React + Componentes accesibles y diseño sin dependencias genéricas (anti-AI slop).
* **Modelado de Datos:** Prisma ORM v5 (`prisma/schema.prisma`) con 10 entidades relacionales tipadas.
* **Criptografía:** Firmas HMAC-SHA256 mediante Web Crypto API para códigos QR de alta densidad y verificación fuera de línea.
* **PWA Offline-First:** Service Worker (`public/sw.js`) + Web App Manifest (`public/manifest.json`) + Base de datos local IndexedDB para el ayudante a bordo sin señal celular.

### B. Módulos de Infraestructura Desplegados en el Código
1. **Base de Datos en la Nube (Neon Serverless PostgreSQL):**
   * **Organización:** `jljjdesarrollo-maker` (`org-purple-pine-13748800`)
   * **Proyecto:** `quiet-union-86818791` (Región: AWS US East 2 - Ohio)
   * **Rama Activa:** `production` (`br-summer-night-b51dnmcw`)
   * **Conexión Pooler:** `ep-proud-dew-b5stc73y-pooler.c-7.us-east-2.aws.neon.tech/neondb`
   * **Driver:** `@neondatabase/serverless` (HTTP & WebSockets)
   * **Endpoints Backend:** `GET /api/v1/neon/health`, `GET /api/v1/neon/tenants`, `GET /api/v1/neon/turnos`, `GET /api/v1/neon/boletos`, `POST /api/v1/neon/transactions`, `POST /api/v1/neon/seed`.
   * **Tablas Sembradas:** `Tenant`, `TenantBankConfig`, `Ruta`, `TramoTarifa`, `UnidadBus`, `Frecuencia`, `ProgramacionTurno`, `TransaccionPago`, `Boleto`.

2. **Motor de Conciliación Bancaria:**
   * Endpoint: `POST /api/v1/payments/webhook`
   * Soporta sobres base64 de **Google Cloud Pub/Sub Push** conectados a la **Gmail API**.
   * Adaptadores Regex de latencia < 20 ms para Banco de Loja y Banco Pichincha / Deuna.
   * Fallback NLP con **Gemini AI (`gemini-3.8-flash`)** para correos desestructurados.
   * Ventana de conciliación total: **< 3 segundos**.
3. **Gateway de WhatsApp Propio ($5.00/mes):**
   * Configurado para correr en un servidor VPS económico de $5.00/mes con **Baileys / Evolution API** (`docker-compose.yml`).
   * Envía pases QR y alertas de cambio de bus sin costo por mensaje.
   * Endpoints: `POST /api/v1/whatsapp/send`, `GET /api/v1/whatsapp/status`.
4. **Respaldo Automático de Base de Datos (Cron a las 23:50 PM):**
   * Configurado en `vercel.json` con `"schedule": "50 23 * * *"` apuntando a `POST /api/v1/cron/backup`.
   * Genera un dump SQL completo compatible con PostgreSQL (`psql` / `pg_restore`) y calcula el hash de integridad SHA-256.
5. **Infraestructura VPS Dockerizada:**
   * Archivo `docker-compose.yml` que orquesta:
     * Contenedor PostgreSQL 16 Alpine con almacenamiento persistente.
     * Contenedor Evolution API Baileys para WhatsApp.
     * Contenedor de la aplicación PasajeYa (`Dockerfile`).

---

## 4. ESQUEMA DE BASE DE DATOS (PRISMA SCHEMA)

Ubicado en `prisma/schema.prisma`:
* `Tenant`: Cooperativa de transporte (slug, nombreComercial, ruc, whatsappSoporte, activo).
* `TenantBankConfig`: Cuentas bancarias asociadas por operador (BANCO_DE_LOJA, BANCO_PICHINCHA).
* `Ruta`: Origen y destino (ej. Loja ⇄ Vilcabamba).
* `TramoTarifa`: Paradas intermedias con tarifa normal y tarifa media (Malacatos, Vilcabamba, El Tambo, Yangana, Zahuayco, La Elvira).
* `UnidadBus`: Número de disco, placa, capacidad (45 asientos).
* `Frecuencia`: Horarios de salida programados (06:00 a 19:00).
* `ProgramacionTurno`: Asignación diaria de frecuencias, busDiscoTeoricoId, busDiscoRealId, asientosVendidosWeb (Array), asientosBloqueadosTemp (JSON con locks de 15 min), ventaWebCongelada (Boolean).
* `TransaccionPago`: Estado (PENDIENTE, CONFIRMADO, MONTO_INCOMPLETO, PAGO_EXTEMPORANEO), referencia bancaria, montos, comprador.
* `Boleto`: Código único (ej. VILCA-2026-XXXX), número de asiento, firma digital HMAC-SHA256, estado (RESERVADO, CONFIRMADO, ABORDADO).
* `FacturacionMensualTenant`: Cálculo mensual B2B del fee SaaS de $0.25 por boleto.
* `LogRespaldoBD`: Bitácora del cron de las 23:50 PM con checksum y tamaño.

---

## 5. REGLAS DE NEGOCIO Y FLUJOS OPERACIONALES

1. **Pasajero (Compra Directa Modo Invitado):**
   * No requiere registro previo ni contraseñas.
   * Mapa de asientos del bus de 45 puestos: **Asientos 1 al 10 en Bloque Web exclusivo**; Asientos 11 al 45 para ventanilla presencial.
   * **Seat Locking Atómico:** 15 minutos exactos de reserva con temporizador en pantalla.
   * Transferencia bancaria directa con QR dinámico.
   * Auto-conciliación en < 3s y emisión del Pase Digital QR con firma criptográfica.
2. **Secretaria (Taquilla y SRI):**
   * **Cierre a T-20 min:** 20 minutos antes de la partida, la venta web se congela automáticamente (`ventaWebCongelada: true`).
   * **Facturación SRI:** Módulo para copiar en 1 clic los datos del pasajero y valor para ingresarlos en el sistema tributario propio de la cooperativa.
   * **Liberación de Sobrantes:** Asientos 4 al 10 no vendidos en línea se liberan automáticamente para la ventanilla física junto a los asientos 11 al 45.
   * **Reasignación de Flota (`busDiscoRealId`):** Si una unidad sufre avería mecánica, se reasigna en 1 clic y el sistema envía alertas automáticas por WhatsApp a los pasajeros confirmados.
3. **Ayudante de Autobús (Validación a Bordo PWA):**
   * Modo Offline-First con IndexedDB.
   * Botón "Sincronizar Turno" para descargar el manifiesto antes de salir.
   * Escaneo y verificación de firma HMAC del QR sin internet.
   * Control de abordaje (`ABORDADO`) y prevención de duplicados o fraudes.
4. **Gerencia & Dirección:**
   * Monitoreo de ingresos y cálculo del fee SaaS transaccional.
   * Auditoría de respaldos nocturnos de base de datos a las 23:50 PM.
   * Monitoreo del estado del Gateway WhatsApp VPS.

---

## 6. MAPA DE ARCHIVOS DEL PROYECTO

```
/
├── ARCHIVO_MAESTRO_PASAJE_YA.md       # Este documento maestro de contexto
├── Dockerfile                         # Contenedor Node 22 Alpine para producción
├── docker-compose.yml                 # Orquestación VPS ($5/mes): Postgres + Evolution API + App
├── vercel.json                        # Despliegue en Vercel con Cron Job 23:50 PM
├── package.json                       # Dependencias y scripts (dev: tsx server.ts)
├── server.ts                          # Backend Express con API v1 y middlewares Vite
├── index.html                         # Entrada HTML con registro PWA y tipografías
├── metadata.json                      # Metadatos del applet en AI Studio
├── prisma/
│   ├── schema.prisma                  # Esquema relacional completo de Prisma
│   └── seed.ts                        # Script de siembra para Vilcabambaturis
├── public/
│   ├── manifest.json                  # PWA Web App Manifest (standalone, theme #f59e0b)
│   └── sw.js                          # PWA Service Worker (caché offline y network fallback)
└── src/
    ├── App.tsx                        # Aplicación principal y enrutador de vistas
    ├── main.tsx                       # Montaje React 19
    ├── index.css                      # Tailwind CSS v4 y directivas de impresión
    ├── types/transit.ts               # Tipos TypeScript espejando el esquema Prisma
    ├── services/
    │   ├── crypto.ts                  # Generación y verificación HMAC-SHA256 Web Crypto
    │   ├── database.ts                # Motor transaccional, seat locking 15m, T-20 y dumps
    │   ├── reconciliation.ts          # Motor de auto-conciliación híbrida (Regex + Gemini)
    │   └── ayudantePwa.ts             # Almacenamiento local en IndexedDB para el ayudante
    └── components/
        ├── Header.tsx                 # Barra superior (Wordmark PasajeYa, nav y cooperativa)
        ├── PassengerCheckout.tsx      # Flujo de compra, mapa 1-10, timer 15m, pago QR
        ├── DigitalTicketModal.tsx     # Pase digital QR con firma HMAC y envío a WhatsApp
        ├── SecretariaTaquilla.tsx     # Cierre T-20, SRI 1-clic, sobrantes y reasignación flota
        ├── AyudantePwa.tsx            # Cabina móvil offline del ayudante con escáner QR
        ├── ReconciliationConsole.tsx  # Simulador de webhook y prueba de correos bancarios
        └── GerenciaDashboard.tsx      # SaaS fee $0.25, cron 23:50 y WhatsApp VPS Gateway
```

---

## 7. ARQUITECTURA DE INTERFAZ: PWA RESPONSIVE UNIFICADA CON PORTAL SEGREGADO

* **Principio de Cero Fricción para el Pasajero:**
  * **NO se crean aplicaciones nativas separadas de Play Store/App Store para los pasajeros.**
  * Motivo: Más del 85% de los pasajeros interparroquiales rechazan descargar una app pesada para un trayecto de bus de $2.50. Requieren entrar directamente por navegador web o link de WhatsApp.
  * **Experiencia del Pasajero:** Vista limpia, sin menús administrativos ni botones técnicos. Funciona al 100% en pantallas móviles (smartphones) y escritorios.
* **Portal de Personal Cooperativa (Secretaría, Ayudante, Gerencia):**
  * Acceso protegido mediante PIN/contraseña desde un enlace discreto ("Acceso Personal").
  * El ayudante a bordo puede instalar la misma web como PWA (icono en pantalla de inicio) para escaneo offline con IndexedDB.

---

## 8. PLAN MAESTRO DE LEVANTAMIENTO POR FASES

* **Fase 1: Infraestructura Base & Despliegue en la Nube (COMPLETADA)**
  * Conexión de GitHub a Vercel con build exitoso (`pasajeya.vercel.app`).
  * Integración de base de datos Neon Serverless PostgreSQL (`@neondatabase/serverless`).
  * Respaldo nocturno automatizado (cron 23:50 PM).
  * Criptografía HMAC-SHA256 para códigos QR.

* **Fase 2: Segregación Estricta de Portales Pasajero vs Personal (COMPLETADA)**
  * Experiencia de compra pública 100% limpia para pasajeros (móvil y PC).
  * Modal seguro de autenticación por PIN para personal de taquilla, ayudante y gerencia.
  * Selector de roles protegido para operadores autorizados.

* **Fase 3: Motor de Conciliación Bancaria en Tiempo Real (EN CURSO)**
  * Webhook para correos automáticos de transferencias (Banco de Loja / Banco Pichincha / Deuna).
  * Validación de montos exactos y asignación automática del asiento en < 3 segundos.

* **Fase 4: Consola de Taquilla para Secretaría y Cierre T-20**
  * Copia rápida de datos fiscales para facturación electrónica del SRI.
  * Congelamiento automático de venta web a T-20 min y liberación de asientos sobrantes a ventanilla física.
  * Protocolo de reasignación de flota por avería mecánica con alerta WhatsApp a pasajeros.

* **Fase 5: PWA Offline del Ayudante a Bordo & Liquidación SaaS B2B**
  * Descarga previa del manifiesto de pasajeros en IndexedDB antes de iniciar la ruta Loja-Vilcabamba.
  * Validación criptográfica fuera de línea de códigos QR sin cobertura celular.
  * Reporte mensual de liquidación de fees SaaS ($0.25 por boleto vendido en línea).

---

## 9. DIRECTIVA PARA NUEVAS SESIONES DE CHAT / IA

1. Al abrir el proyecto desde cualquier cuenta de Google AI Studio, **leer primero `ARCHIVO_MAESTRO_PASAJE_YA.md` y `PROJECT_CONTEXT.md`**.
2. Todo el código debe mantenerse sincronizado con el repositorio GitHub oficial `jljjdesarrollo-maker/pasajeya`.
3. El despliegue de producción se gestiona en la cuenta de Vercel de `jjayajaramillo@gmail.com` apuntando a Neon Serverless.

