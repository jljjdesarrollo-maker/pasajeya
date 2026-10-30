# ESPECIFICACIÓN TÉCNICA E INMUTABLE — MÓDULO 6: CONSOLA DE CONFIGURACIÓN GLOBAL (`/admin/configuracion`)
**Proyecto:** PasajeYa (SaaS Multi-Tenant de Transporte Interparroquial e Intraprovincial)  
**Cliente Piloto (Tenant #1):** Cooperativa / Compañía Vilcabambaturis Cía. Ltda. (`RUC: 1191705482001` · Loja, Ecuador)  
**Estado:** 100% IMPLEMENTADO, VERIFICADO E INMUTABLE EN PRODUCCIÓN

---

## A. Control de Canales de Cobro (Toggles en 1-Clic)
- **Interruptores Independientes (`alternarToggleCanalCobroTiempoReal`):**
  - Toggles **`[ON / OFF]`** en tiempo real para activar o desactivar inmediatamente **Banco de Loja** (`bancoDeLojaActivo`) y/o **Banco Pichincha / Deuna!** (`bancoPichinchaDeunaActivo`) en la pantalla de checkout público (`/pasajero`).

---

## B. Gestor de Cuentas Bancarias y Códigos QR
- **Administración de Cuentas (`guardarCuentaBancariaCRUD`):**
  - Módulo CRUD para configurar números de cuenta, RUC institucional (`1191705482001`), tipo de cuenta (`Cuenta Corriente` / `Cuenta de Ahorros`) y titulares.
- **Cargador de Imágenes QR (`actualizarImagenQrOficialBanco`):**
  - Interfaz para subir y actualizar las imágenes oficiales de los códigos QR de pago (**Deuna! / Banco de Loja**) que se muestran directamente al usuario en el checkout.

---

## C. Configuración de WhatsApp y Soporte
- **Atención al Cliente:** Configuración del número de WhatsApp de soporte oficial de Vilcabambaturis (`whatsappSoporteCliente`).
- **Gateway de Mensajería (`actualizarConfiguracionGlobalSoporteYBackup`):** Credenciales (`gatewayWhatsappApiUrl`) y token de conexión (`gatewayWhatsappToken`) con la API de WhatsApp (Evolution API / VPS).

---

## D. Respaldo Automático de Base de Datos (Backup SQL 23:50 PM)
- **Seguridad IT:** Configuración del correo electrónico institucional de Gerencia/Sistemas (`correoInstitucionalGerenciaSistemas`).
- **Envío Automático Nocturno (`/api/v1/cron/backup-db`):** Tarea programada (`"50 23 * * *"` en `vercel.json`) que genera un archivo de respaldo (**Dump SQL encriptado de PostgreSQL**) y lo envía por correo electrónico todas las noches a las **23:50 PM**.
