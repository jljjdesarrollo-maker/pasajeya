# ESPECIFICACIÓN TÉCNICA E INMUTABLE — MÓDULO 4: PWA OFFLINE-FIRST PARA TRIPULACIÓN, VISOR DE CONSULTA Y GESTIÓN DE FLOTA
**Proyecto:** PasajeYa (SaaS Multi-Tenant de Transporte Interparroquial e Intraprovincial)  
**Cliente Piloto (Tenant #1):** Cooperativa / Compañía Vilcabambaturis Cía. Ltda. (`RUC: 1191705482001` · Loja, Ecuador)  
**Estado:** 100% IMPLEMENTADO, VERIFICADO E INMUTABLE EN PRODUCCIÓN

---

## 1. CRUD de Unidades y Gestión de Credenciales (`/admin/flota` y `/admin`)
- **Gestión Exclusiva de Gerencia / Administración (`GERENCIA`):**
  - Módulo administrativo para crear y editar unidades de transporte (Número de Disco, Placa Oficial ANT, Chofer Titular y PIN Corporativo de 4 dígitos `pinUnidad`).
  - Los roles `SECRETARIA` y `AYUDANTE` tienen bloqueada la creación o modificación estructural de unidades en el catálogo de flota (`crearUnidadFlotaCRUD` y `editarUnidadFlotaCRUD`).
- **Restablecimiento de PIN (Botón de Auxilio Rápido en 1-Clic):**
  - Tanto **Gerencia (`GERENCIA`)** como **Secretaría (`SECRETARIA`)** disponen de un botón de auxilio rápido (`restablecerPinDiscoAuxilioRapido`) para restablecer instantáneamente el PIN de un Disco a `1191` en caso de olvido por parte de la tripulación en andén.
  - El rol `AYUDANTE` tiene bloqueado el restablecimiento de PINes.

---

## 2. PWA Offline-First con Carga Previa en Terminal (`IndexedDB`)
- **Instalación sin App Store:**
  - Aplicación Web Progresiva (PWA) con `manifest.json` y Service Worker (`sw.js`) instalable en 1-clic (*"Añadir a Pantalla de Inicio"*) en los teléfonos Android/iOS de la tripulación sin depender de tiendas de aplicaciones.
- **Sincronización en Oficina (5 Minutos Antes de Salir):**
  - Al autenticarse con **Disco + PIN** en la red Wi-Fi / LAN de la oficina terminal 5 minutos antes de la salida (`autenticarYSincronizarEnTerminal5MinAntes`), el manifiesto se descarga y almacena automáticamente en `IndexedDB` en **`< 1 segundo`**.
- **Botón Prominente de Sincronización Manual:**
  - 🟢 **Estado Verde (`#2E7D32`):** `[✓ MANIFIESTO ACTUALIZADO — Disco XX]` cuando el manifiesto de la frecuencia activa ya está almacenado en `IndexedDB`.
  - 🔴 **Estado Rojo (`#912D26`):** `[⚠️ TOCAR AQUÍ PARA SINCRONIZAR MANIFIESTO]` cuando el turno aún requiere sincronización previa a salir del andén.
- **Cero Cobertura en Ruta (`< 100ms`):**
  - Almacenamiento persistente en `IndexedDB` y validación criptográfica offline (`HMAC-SHA256`) de pases QR en **`< 100ms`** (`verificarPaseQrCriptograficoOfflineSub100ms`), operando con `0` llamadas HTTP en tramos sin señal celular (Malacatos, Vilcabamba, El Tambo, Yangana, Zahuayco, La Elvira).

---

## 3. Visor de Solo Consulta y Distinción de Boletos Web
- **Perfil de Solo Lectura (`SOLO_LECTURA_CONSULTA_RAPIDA`):**
  - **Cero obligación de hacer check-in o clics por pasajero a bordo** (`obligacionCheckInClicsABordo = false`).
  - La aplicación funciona estrictamente como un visor de consulta rápida en ruta para el ayudante y chofer.
- **Distinción Visual del Turno (`evaluarDistincionVisualTurnoPwa`):**
  - 🔴 **Tarjeta en Rojo Vinotinto (`#912D26`):** Resaltada con el número exacto de pasajes vendidos online (ej. `6 BOLETOS WEB`, `4 BOLETOS WEB`).
  - ⚪ **Tarjeta en Gris Neutral (`#64748B`):** Marcada explícitamente con `0 Boletos Web` para evitar búsquedas innecesarias por parte de la tripulación.
- **Orden Secuencial por Asiento (`1` al `45`):**
  - Tanto el listado de pasajeros confirmados como el croquis de 45 asientos (`construirVisorSoloConsultaSecuencial1a45`) están ordenados estrictamente por número de asiento del **`1` al `45`**, facilitando la inspección visual pasillo por pasillo al pasar la parada **UNL Argelia**.

---

## 4. Protocolo de No-Show y Fajas Físicas `"RESERVADO WEB"`
- **Operación mediante Fajas Físicas (`generarKitFajasFisicasReservadoWeb`):**
  - La secretaría en terminal entrega el manifiesto físico impreso junto con las **fajas físicas con leyenda `"RESERVADO WEB"`** para colocarlas en las cabeceras de los asientos del bloque `1–10` vendidos en línea.
- **Límite Urbano UNL Argelia (`20 minutos` de recorrido urbano):**
  - Los asientos vendidos en línea se mantienen reservados y protegidos durante todo el perímetro urbano de Loja hasta superar la última parada autorizada: **UNL Argelia** (`20 minutos` de recorrido urbano).
  - Si un pasajero no aborda hasta superar **UNL Argelia** (*No-Show*), el ayudante retira la faja física `"RESERVADO WEB"` (`ejecutarRetiroFajaNoShowPasadaUNLArgelia`) y libera el asiento para pasajeros que suben en carretera.
  - El sistema bloquea cualquier intento de retirar la faja física antes de superar **UNL Argelia**.
