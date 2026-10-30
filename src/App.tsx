import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  Check,
  Clock,
  Copy,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Unlock,
  UserCheck,
} from 'lucide-react';
import {
  AlertaWhatsAppLog,
  BoletoEmitido,
  ConfiguracionGlobalSistema,
  FrecuenciaRuta,
  LogRespaldoBDRecord,
  NotaCreditoSaldoRecord,
  RolOperativo,
  SaldoAFavorRecord,
  UnidadFlota,
} from './types/pasajeya';
import {
  aplicarCongelamientoT20,
  crearEstadoInicialFrecuencias,
  FLOTA_UNIDADES,
  formatearTextoCopiadoSRI,
  obtenerManifiestoCongeladoSRI,
  PIN_CORPORATIVO_OFICIAL,
  reasignarBusRealYNotificarWhatsApp,
  TENANT_VILCABAMBATURIS,
  validarAccesoCorporativo,
  venderAsientoEnVentanilla,
} from './services/pasajeyaEngine';
import {
  crearNotasCreditoSaldoIniciales,
  emitirBoletoTaquillaConSaldoAFavor,
  intentarReembolsoEfectivoEnVentanilla,
} from './services/module2PaymentsEngine';
import {
  COLOR_TAQUILLA_DISPONIBLE_VERDE,
  COLOR_TAQUILLA_RESERVA_NARANJA,
  COLOR_TAQUILLA_VENDIDO_ROJO,
  construirMapaTricolor45Asientos,
  ejecutarProtocoloCeroVentasWeb,
  evaluarTarjetaPizarraTurno,
  generarManifiestoImpresoConAsientosLiberados,
  generarPayloadsCopiadoSistemaVilcabambaturis,
  obtenerPermisosRBACTaquilla,
  obtenerUnidadesFlotaConBloqueoEnRuta,
  venderAsientoTaquillaTricolorConRBAC,
} from './services/module3TaquillaEngine';
import {
  crearCatalogoFlotaInicial,
  crearUnidadFlotaCRUD,
  editarUnidadFlotaCRUD,
  restablecerPinDiscoAuxilioRapido,
} from './services/module4PwaEngine';
import {
  crearConfiguracionGlobalInicial,
  crearSaldosAFavorIniciales,
} from './services/module5And6Engine';
import { crearHistorialRespaldosInicial } from './services/backupAndAuditService';
import { AyudanteView } from './components/AyudanteView';
import { AuditoriaSaaSView } from './components/AuditoriaSaaSView';
import { Modulo1PublicCheckoutView } from './components/Modulo1PublicCheckoutView';
import { limpiarBaseOffline } from './lib/offlineDb';

type RutaNavegacion =
  | '/pasajero'
  | '/taquilla'
  | '/ayudante'
  | '/admin'
  | '/admin/auditoria';

const STORAGE_KEY_FRECUENCIAS = 'pasajeya_frecuencias_v8';
const STORAGE_KEY_ALERTAS = 'pasajeya_alertas_wa_v8';
const STORAGE_KEY_AUTH = 'pasajeya_auth_session_v8';
const STORAGE_KEY_RESPALDOS = 'pasajeya_respaldos_sql_v8';

interface SesionCorporativa {
  autenticado: boolean;
  rol: RolOperativo;
  operadorNombre: string;
  loginAt: string;
}

export default function App() {
  // Sincronización con ruta URL (/pasajero, /taquilla, /ayudante, /admin, /admin/auditoria)
  const [rutaActiva, setRutaActiva] = useState<RutaNavegacion>(() => {
    const path = window.location.pathname;
    if (
      path === '/admin/auditoria' ||
      path === '/admin/reportes' ||
      path === '/admin/configuracion' ||
      path === '/admin/taquilla' ||
      path === '/taquilla/saldos'
    ) {
      return '/admin/auditoria';
    }
    if (path === '/ayudante' || path === '/personal') return '/ayudante';
    if (path === '/taquilla') return '/taquilla';
    if (path === '/admin' || path === '/admin/flota') return '/admin';
    return '/pasajero'; // Módulo 1 Público activo por defecto para inspección inmediata
  });

  const navegarA = (nuevaRuta: RutaNavegacion) => {
    setRutaActiva(nuevaRuta);
    if (nuevaRuta === '/ayudante') {
      setRolInput('AYUDANTE');
    } else if (nuevaRuta === '/taquilla') {
      setRolInput('SECRETARIA');
    } else if (nuevaRuta === '/admin' || nuevaRuta === '/admin/auditoria') {
      setRolInput('GERENCIA');
    }
    try {
      window.history.pushState({}, '', nuevaRuta);
    } catch {
      // Ignorar en caso de restricciones de sandbox iframe
    }
  };

  // Estado de Frecuencias con persistencia local
  const [frecuencias, setFrecuencias] = useState<FrecuenciaRuta[]>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY_FRECUENCIAS);
      if (guardado) {
        return JSON.parse(guardado);
      }
    } catch {
      // Fallback a estado inicial
    }
    return crearEstadoInicialFrecuencias();
  });

  // Historial de Alertas WhatsApp disparadas por el Gateway VPS
  const [alertasWhatsApp, setAlertasWhatsApp] = useState<AlertaWhatsAppLog[]>(
    () => {
      try {
        const guardado = localStorage.getItem(STORAGE_KEY_ALERTAS);
        if (guardado) return JSON.parse(guardado);
      } catch {
        // Fallback
      }
      return [];
    }
  );

  // Bitácora de Respaldos SQL Nocturnos (LogRespaldoBD)
  const [historialRespaldos, setHistorialRespaldos] = useState<
    LogRespaldoBDRecord[]
  >(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY_RESPALDOS);
      if (guardado) return JSON.parse(guardado);
    } catch {
      // Fallback
    }
    return crearHistorialRespaldosInicial();
  });

  // Sesión corporativa protegida por PIN 1191
  const [sesion, setSesion] = useState<SesionCorporativa | null>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY_AUTH);
      if (guardado) return JSON.parse(guardado);
    } catch {
      // Sin sesión previa
    }
    return null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_FRECUENCIAS,
        JSON.stringify(frecuencias)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [frecuencias]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_ALERTAS,
        JSON.stringify(alertasWhatsApp)
      );
    } catch {
      // Ignore
    }
  }, [alertasWhatsApp]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_RESPALDOS,
        JSON.stringify(historialRespaldos)
      );
    } catch {
      // Ignore
    }
  }, [historialRespaldos]);

  // Frecuencia seleccionada actualmente (Por defecto seleccionamos la frecuencia con venta web abierta T-35m para el Módulo 1)
  const [frecuenciaSeleccionadaId, setFrecuenciaSeleccionadaId] =
    useState<string>(() => frecuencias[1]?.id || frecuencias[0]?.id || 'freq-loja-yangana-1100');

  const frecuenciaActual = useMemo(
    () =>
      frecuencias.find((f) => f.id === frecuenciaSeleccionadaId) ||
      frecuencias[0],
    [frecuencias, frecuenciaSeleccionadaId]
  );

  // Estado del formulario de Login Corporativo (PIN 1191)
  const [pinInput, setPinInput] = useState('1191');
  const [rolInput, setRolInput] = useState<RolOperativo>('GERENCIA');
  const [errorPin, setErrorPin] = useState<string | null>(null);

  // Notificaciones operativas (Toasts internos sin window.alert)
  const [mensajeOperativo, setMensajeOperativo] = useState<{
    tipo: 'exito' | 'alerta';
    texto: string;
  } | null>(null);

  const mostrarNotificacion = (
    texto: string,
    tipo: 'exito' | 'alerta' = 'exito'
  ) => {
    setMensajeOperativo({ tipo, texto });
    setTimeout(() => {
      setMensajeOperativo((prev) => (prev?.texto === texto ? null : prev));
    }, 4500);
  };

  // Estado de Copiado SRI 1-Clic
  const [copiadoSriExito, setCopiadoSriExito] = useState(false);
  const [filaCopiadaId, setFilaCopiadaId] = useState<string | null>(null);
  const [mostrarPrevisualizacionSri, setMostrarPrevisualizacionSri] =
    useState(false);

  // Estado para emisión rápida en Ventanilla sobre asientos liberados (1-10)
  const [asientoVentanillaSeleccionado, setAsientoVentanillaSeleccionado] =
    useState<number | null>(null);
  const [formaPagoVentanilla, setFormaPagoVentanilla] = useState<
    'EFECTIVO_TAQUILLA' | 'SALDO_A_FAVOR'
  >('EFECTIVO_TAQUILLA');
  const [notasCreditoSaldo, setNotasCreditoSaldo] = useState<
    NotaCreditoSaldoRecord[]
  >(() => crearNotasCreditoSaldoIniciales());
  const [notaCreditoSeleccionadaId, setNotaCreditoSeleccionadaId] =
    useState<string>('nc-demo-01');
  const [cedulaVentanilla, setCedulaVentanilla] = useState('');
  const [nombreVentanilla, setNombreVentanilla] = useState('');
  const [telefonoVentanilla, setTelefonoVentanilla] = useState('+593 99 ');
  const [paradaVentanilla, setParadaVentanilla] = useState('');

  // Estado para Reasignación de Flota (busDiscoTeorico vs busDiscoReal) y CRUD /admin/flota
  const [catalogoFlota, setCatalogoFlota] = useState<UnidadFlota[]>(() =>
    crearCatalogoFlotaInicial()
  );
  const [configuracionGlobal, setConfiguracionGlobal] =
    useState<ConfiguracionGlobalSistema>(() =>
      crearConfiguracionGlobalInicial()
    );
  const [saldosAFavor, setSaldosAFavor] = useState<SaldoAFavorRecord[]>(() =>
    crearSaldosAFavorIniciales()
  );
  const [nuevoBusDisco, setNuevoBusDisco] = useState<string>('Disco #14');
  const [motivoReasignacion, setMotivoReasignacion] = useState<string>(
    'Contingencia mecánica en unidad titular — Cambio en andén'
  );
  const [nuevoCrudDisco, setNuevoCrudDisco] = useState<string>('Disco #35');
  const [nuevaCrudPlaca, setNuevaCrudPlaca] = useState<string>('LAA-3055');
  const [nuevoCrudChofer, setNuevoCrudChofer] = useState<string>(
    'Sr. Jorge Armijos'
  );
  const [nuevoCrudPin, setNuevoCrudPin] = useState<string>('1191');
  const [discoEditandoPin, setDiscoEditandoPin] = useState<string | null>(null);
  const [pinPersonalizadoInput, setPinPersonalizadoInput] =
    useState<string>('1191');

  const [ultimoBoletoQR, setUltimoBoletoQR] = useState<BoletoEmitido | null>(
    null
  );

  useEffect(() => {
    if (frecuenciaActual) {
      setParadaVentanilla(frecuenciaActual.destino);
      const busAlternativo =
        FLOTA_UNIDADES.find((u) => u.disco !== frecuenciaActual.busDiscoReal)
          ?.disco || 'Disco #14';
      setNuevoBusDisco(busAlternativo);
    }
  }, [frecuenciaActual?.id]);

  // Handler de Login PIN 1191 (SECRETARIA, GERENCIA o AYUDANTE)
  const manejarLoginPin = (e: React.FormEvent) => {
    e.preventDefault();
    const resultado = validarAccesoCorporativo(pinInput, rolInput);
    if (!resultado.autorizado || !resultado.rol) {
      setErrorPin(resultado.mensaje);
      return;
    }
    const nuevaSesion: SesionCorporativa = {
      autenticado: true,
      rol: resultado.rol,
      operadorNombre:
        resultado.rol === 'AYUDANTE'
          ? 'Sr. Darwin Quizhpe (Oficial Ayudante en Ruta)'
          : resultado.rol === 'SECRETARIA'
          ? 'Lcda. Verónica Ochoa (Taquilla Matriz Loja)'
          : 'Ing. Patricio Valdivieso (Gerencia / SuperAdmin)',
      loginAt: new Date().toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setSesion(nuevaSesion);
    setErrorPin(null);
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(nuevaSesion));
    } catch {
      // Ignore
    }
    mostrarNotificacion(
      `Acceso verificado con PIN corporativo 1191 (${resultado.rol}).`
    );
  };

  const cerrarSesionCorporativa = () => {
    setSesion(null);
    setPinInput('');
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch {
      // Ignore
    }
  };

  // Handler para ejecutar / simular llegada a T-20 Minutos en una frecuencia
  const ejecutarCorteT20Minutos = (frecuenciaId: string) => {
    setFrecuencias((prev) =>
      prev.map((freq) => {
        if (freq.id !== frecuenciaId) return freq;
        const { frecuenciaActualizada, asientosLiberados } =
          aplicarCongelamientoT20(freq, true);
        mostrarNotificacion(
          `Corte T-20 min aplicado en ${freq.codigoFrecuencia}: Venta web congelada, manifiesto pre-cargado en IndexedDB y ${asientosLiberados.length} asientos sobrantes liberados para Ventanilla.`
        );
        return frecuenciaActualizada;
      })
    );
  };

  // Handler para sincronizar abordajes desde IndexedDB hacia el estado central de frecuencias
  const sincronizarAbordajesEnEstadoPrincipal = (
    frecuenciaId: string,
    boletosAbordadosIds: string[]
  ) => {
    setFrecuencias((prev) =>
      prev.map((f) =>
        f.id === frecuenciaId
          ? {
              ...f,
              boletos: f.boletos.map((b) =>
                boletosAbordadosIds.includes(b.id)
                  ? {
                      ...b,
                      estadoAbordaje: 'ABORDADO',
                      abordadoAt: b.abordadoAt || new Date().toISOString(),
                    }
                  : b
              ),
            }
          : f
      )
    );
  };

  // Handler para Copiar Todo el Manifiesto SRI en 1-Clic
  const copiarManifiestoCompletoSRI = async () => {
    if (!frecuenciaActual) return;
    const textoTsv = formatearTextoCopiadoSRI(frecuenciaActual, true);
    try {
      await navigator.clipboard.writeText(textoTsv);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textoTsv;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiadoSriExito(true);
    setMostrarPrevisualizacionSri(true);

    setFrecuencias((prev) =>
      prev.map((f) =>
        f.id === frecuenciaActual.id
          ? {
              ...f,
              boletos: f.boletos.map((b) =>
                b.canalVenta === 'WEB' ? { ...b, sincronizadoSri: true } : b
              ),
            }
          : f
      )
    );

    mostrarNotificacion(
      `Manifiesto SRI (${
        obtenerManifiestoCongeladoSRI(frecuenciaActual).length
      } compradores web) copiado al portapapeles en formato TSV listo para facturación.`
    );
    setTimeout(() => setCopiadoSriExito(false), 3000);
  };

  // Handler para Copiar una fila individual para el SRI
  const copiarFilaIndividualSRI = async (
    boletoId: string,
    identificacion: string,
    nombre: string,
    asiento: number,
    origen: string,
    destino: string,
    total: string
  ) => {
    const linea = `${identificacion}\t${nombre}\tAsiento #${asiento}\t${origen}-${destino}\t$${total}`;
    try {
      await navigator.clipboard.writeText(linea);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = linea;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setFilaCopiadaId(boletoId);
    setFrecuencias((prev) =>
      prev.map((f) =>
        f.id === frecuenciaActual.id
          ? {
              ...f,
              boletos: f.boletos.map((b) =>
                b.id === boletoId ? { ...b, sincronizadoSri: true } : b
              ),
            }
          : f
      )
    );
    mostrarNotificacion(
      `Datos SRI de ${nombre} (${identificacion}) copiados en 1-clic.`
    );
    setTimeout(() => setFilaCopiadaId(null), 2000);
  };

  // Handler para exportar CSV/TSV descargable para el sistema SRI
  const descargarArchivoSRI = () => {
    if (!frecuenciaActual) return;
    const contenido = formatearTextoCopiadoSRI(frecuenciaActual, true);
    const blob = new Blob([contenido], {
      type: 'text/tab-separated-values;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SRI_MANIFIESTO_${frecuenciaActual.codigoFrecuencia}_${frecuenciaActual.horaSalida.replace(
      ':',
      ''
    )}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarNotificacion(
      `Archivo TSV descargado para importación en facturador electrónico SRI.`
    );
  };

  const permisosRBAC = useMemo(
    () => obtenerPermisosRBACTaquilla(sesion?.rol || 'SECRETARIA'),
    [sesion?.rol]
  );

  const [mostrarManifiestoFisicoLiberados, setMostrarManifiestoFisicoLiberados] =
    useState(false);

  // Handler para Copiar cualquiera de los 3 botones independientes del Sistema Vilcabambaturis
  const copiarBotonSistemaVilcabambaturis = async (
    boletoId: string,
    tipoBoton: 'CEDULA' | 'REFERENCIA' | 'DEPOSITO',
    textoCopiar: string,
    etiquetaToast: string
  ) => {
    try {
      await navigator.clipboard.writeText(textoCopiar);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textoCopiar;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setFilaCopiadaId(`${boletoId}-${tipoBoton}`);
    setFrecuencias((prev) =>
      prev.map((f) =>
        f.id === frecuenciaActual.id
          ? {
              ...f,
              boletos: f.boletos.map((b) =>
                b.id === boletoId ? { ...b, sincronizadoSri: true } : b
              ),
            }
          : f
      )
    );
    mostrarNotificacion(`${etiquetaToast}: "${textoCopiar}" copiado en 1-clic.`);
    setTimeout(() => setFilaCopiadaId(null), 2200);
  };

  // Handler para Protocolo de 0 Ventas Web (DESPACHADO_SIN_VENTAS_WEB)
  const manejarCierreSinVentasWeb = (frecuenciaId: string) => {
    if (!permisosRBAC.puedeCerrarTurnos) {
      mostrarNotificacion(
        `Acceso denegado (${permisosRBAC.etiquetaModo}): Solo LECTURA_ESCRITURA puede ejecutar DESPACHADO_SIN_VENTAS_WEB.`,
        'alerta'
      );
      return;
    }
    try {
      setFrecuencias((prev) =>
        prev.map((f) => {
          if (f.id !== frecuenciaId) return f;
          const { frecuenciaActualizada, resumenOperativo } =
            ejecutarProtocoloCeroVentasWeb(f);
          mostrarNotificacion(resumenOperativo);
          return frecuenciaActualizada;
        })
      );
    } catch (err: any) {
      mostrarNotificacion(
        err?.message || 'Error al ejecutar protocolo de 0 ventas web.',
        'alerta'
      );
    }
  };

  // Handler para vender un asiento liberado o nativo (1-45) en Ventanilla Física (Efectivo o SALDO_A_FAVOR con 0 Efectivo Entregado)
  const manejarVentaVentanilla = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frecuenciaActual || asientoVentanillaSeleccionado === null) return;

    if (!permisosRBAC.puedeVenderEnTaquilla) {
      mostrarNotificacion(
        `Rol ${permisosRBAC.rol} en modo SOLO_LECTURA: no tiene permisos para emitir boletos en ventanilla.`,
        'alerta'
      );
      return;
    }

    if (formaPagoVentanilla === 'SALDO_A_FAVOR') {
      const notaElegida = notasCreditoSaldo.find(
        (n) => n.id === notaCreditoSeleccionadaId
      );
      if (!notaElegida) {
        mostrarNotificacion(
          'Seleccione una Nota de Crédito (Saldo a Favor) válida.',
          'alerta'
        );
        return;
      }

      try {
        const {
          frecuenciaActualizada,
          boletoEmitido,
          notaCreditoActualizada,
        } = emitirBoletoTaquillaConSaldoAFavor({
          frecuencia: frecuenciaActual,
          asientoNumero: asientoVentanillaSeleccionado,
          notaCredito: notaElegida,
          destinoParada: paradaVentanilla || frecuenciaActual.destino,
        });

        setFrecuencias((prev) =>
          prev.map((f) =>
            f.id === frecuenciaActual.id ? frecuenciaActualizada : f
          )
        );
        setNotasCreditoSaldo((prev) =>
          prev.map((n) =>
            n.id === notaCreditoActualizada.id ? notaCreditoActualizada : n
          )
        );
        setUltimoBoletoQR(boletoEmitido);
        setAsientoVentanillaSeleccionado(null);
        mostrarNotificacion(
          `Canje SALDO_A_FAVOR exitoso (${notaCreditoActualizada.codigoNotaCredito}): Boleto emitido para Asiento #${boletoEmitido.asientoNumero} con $0.00 de afectación a caja chica en efectivo.`
        );
      } catch (err: any) {
        mostrarNotificacion(
          err?.message || 'Error al canjear Saldo a Favor en ventanilla.',
          'alerta'
        );
      }
      return;
    }

    if (cedulaVentanilla.trim().length < 10 || !nombreVentanilla.trim()) {
      mostrarNotificacion(
        'Ingrese un número de Cédula/RUC válido (10 o 13 dígitos) y el nombre del pasajero.',
        'alerta'
      );
      return;
    }

    try {
      const { frecuenciaActualizada, boletoEmitido } =
        venderAsientoTaquillaTricolorConRBAC({
          rol: sesion?.rol || 'SECRETARIA',
          frecuencia: frecuenciaActual,
          asientoNumero: asientoVentanillaSeleccionado,
          cedulaRuc: cedulaVentanilla.trim(),
          pasajeroNombre: nombreVentanilla.trim(),
          telefonoWhatsApp: telefonoVentanilla.trim(),
          destinoParada: paradaVentanilla || frecuenciaActual.destino,
        });

      setFrecuencias((prev) =>
        prev.map((f) =>
          f.id === frecuenciaActual.id ? frecuenciaActualizada : f
        )
      );
      setUltimoBoletoQR(boletoEmitido);
      setAsientoVentanillaSeleccionado(null);
      setCedulaVentanilla('');
      setNombreVentanilla('');
      mostrarNotificacion(
        `Boleto de ventanilla emitido exitosamente para Asiento #${boletoEmitido.asientoNumero} (${boletoEmitido.pasajeroNombre}).`
      );
    } catch (err: any) {
      mostrarNotificacion(
        err?.message || 'Error al emitir boleto en ventanilla.',
        'alerta'
      );
    }
  };

  // Handler para Reasignar Bus Real y disparar WhatsApp masivo vía Gateway VPS
  const manejarReasignacionFlota = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frecuenciaActual) return;
    if (!permisosRBAC.puedeReasignarFlota) {
      mostrarNotificacion(
        `Rol ${permisosRBAC.rol} en modo SOLO_LECTURA: no tiene permisos para reasignar unidades de flota.`,
        'alerta'
      );
      return;
    }
    if (nuevoBusDisco === frecuenciaActual.busDiscoReal) {
      mostrarNotificacion(
        `La unidad ${nuevoBusDisco} ya se encuentra asignada como busDiscoReal en esta frecuencia.`,
        'alerta'
      );
      return;
    }

    try {
      const { frecuenciaActualizada, alertasDisparadas } =
        reasignarBusRealYNotificarWhatsApp(
          frecuenciaActual,
          nuevoBusDisco,
          motivoReasignacion.trim() ||
            'Reasignación operativa de flota en andén'
        );

      setFrecuencias((prev) =>
        prev.map((f) =>
          f.id === frecuenciaActual.id ? frecuenciaActualizada : f
        )
      );
      setAlertasWhatsApp((prev) => [...alertasDisparadas, ...prev]);

      mostrarNotificacion(
        `Flota reasignada: Teórico ${frecuenciaActualizada.busDiscoTeorico} ➔ Real ${frecuenciaActualizada.busDiscoReal}. Se enviaron ${alertasDisparadas.length} notificaciones WhatsApp vía Gateway VPS.`
      );
    } catch (err: any) {
      mostrarNotificacion(
        err?.message || 'Error al reasignar unidad de flota.',
        'alerta'
      );
    }
  };

  // Handlers para CRUD de Unidades y Gestión/Restablecimiento de PIN (/admin/flota — Módulo 4)
  const manejarCrearUnidadCrud = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { catalogoActualizado, unidadCreada } = crearUnidadFlotaCRUD({
        catalogoActual: catalogoFlota,
        rolOperador: sesion?.rol || 'GERENCIA',
        disco: nuevoCrudDisco,
        placa: nuevaCrudPlaca,
        chofer: nuevoCrudChofer,
        pinUnidad: nuevoCrudPin,
      });
      setCatalogoFlota(catalogoActualizado);
      setNuevoCrudDisco(`Disco #${36 + catalogoActualizado.length}`);
      setNuevaCrudPlaca(`LAA-30${60 + catalogoActualizado.length}`);
      mostrarNotificacion(
        `Unidad creada en /admin/flota: ${unidadCreada.disco} (${unidadCreada.placa}) con PIN corporativo [${unidadCreada.pinUnidad}].`
      );
    } catch (err: any) {
      mostrarNotificacion(
        err?.message || 'Error al crear unidad en /admin/flota.',
        'alerta'
      );
    }
  };

  const manejarRestablecerPinAuxilio = (disco: string) => {
    try {
      const { catalogoActualizado, mensajeAuxilio } =
        restablecerPinDiscoAuxilioRapido({
          catalogoActual: catalogoFlota,
          rolOperador: sesion?.rol || 'GERENCIA',
          disco,
          pinRestablecido: PIN_CORPORATIVO_OFICIAL,
        });
      setCatalogoFlota(catalogoActualizado);
      mostrarNotificacion(mensajeAuxilio);
    } catch (err: any) {
      mostrarNotificacion(
        err?.message || 'Error al restablecer PIN de auxilio rápido.',
        'alerta'
      );
    }
  };

  const manejarGuardarPinEditado = (disco: string) => {
    try {
      const { catalogoActualizado, unidadEditada } = editarUnidadFlotaCRUD({
        catalogoActual: catalogoFlota,
        rolOperador: sesion?.rol || 'GERENCIA',
        discoOriginal: disco,
        nuevoPinUnidad: pinPersonalizadoInput,
      });
      setCatalogoFlota(catalogoActualizado);
      setDiscoEditandoPin(null);
      mostrarNotificacion(
        `PIN de ${unidadEditada.disco} actualizado por GERENCIA a [${unidadEditada.pinUnidad}].`
      );
    } catch (err: any) {
      mostrarNotificacion(
        err?.message || 'Error al editar PIN de la unidad.',
        'alerta'
      );
    }
  };

  const restaurarDatosDemo = async () => {
    await limpiarBaseOffline();
    const inicial = crearEstadoInicialFrecuencias();
    setFrecuencias(inicial);
    setCatalogoFlota(crearCatalogoFlotaInicial());
    setAlertasWhatsApp([]);
    setHistorialRespaldos(crearHistorialRespaldosInicial());
    setFrecuenciaSeleccionadaId(inicial[1].id);
    setUltimoBoletoQR(null);
    mostrarNotificacion(
      'Estado operativo, catálogo de flota (/admin/flota), IndexedDB y bitácora LogRespaldoBD restaurados a valores iniciales.'
    );
  };

  const manifiestoSriActual = useMemo(
    () =>
      frecuenciaActual ? obtenerManifiestoCongeladoSRI(frecuenciaActual) : [],
    [frecuenciaActual]
  );

  const mapaTricolor45Asientos = useMemo(
    () =>
      frecuenciaActual ? construirMapaTricolor45Asientos(frecuenciaActual) : [],
    [frecuenciaActual]
  );

  const unidadesFlotaControl = useMemo(
    () =>
      frecuenciaActual
        ? obtenerUnidadesFlotaConBloqueoEnRuta(frecuenciaActual.busDiscoReal)
        : [],
    [frecuenciaActual]
  );

  const asientosDisponiblesVentanilla = useMemo(
    () =>
      frecuenciaActual
        ? frecuenciaActual.asientosBloqueWeb.filter(
            (a) => a.estado === 'DISPONIBLE_VENTANILLA'
          )
        : [],
    [frecuenciaActual]
  );

  const asientosVendidosWeb = useMemo(
    () =>
      frecuenciaActual
        ? frecuenciaActual.asientosBloqueWeb.filter(
            (a) => a.estado === 'VENDIDO_WEB'
          )
        : [],
    [frecuenciaActual]
  );

  const requierePin =
    rutaActiva === '/admin/auditoria' ||
    rutaActiva === '/taquilla' ||
    rutaActiva === '/admin' ||
    rutaActiva === '/ayudante';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* TOP BAR CONTRACT: 3 Zonas limpias separadas por gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        {/* Zona 1: Wordmark de una sola línea */}
        <a
          href="/pasajero"
          onClick={(e) => {
            e.preventDefault();
            navegarA('/pasajero');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          PasajeYa · Vilcabambaturis
        </a>

        {/* Zona 2: 5 enlaces de navegación de una sola línea */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => navegarA('/pasajero')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              rutaActiva === '/pasajero'
                ? 'border-[#912D26] text-[#912D26] font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Módulo 1: Compra Pública (/pasajero)
          </button>
          <button
            type="button"
            onClick={() => navegarA('/taquilla')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              rutaActiva === '/taquilla'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Taquilla SRI (/taquilla)
          </button>
          <button
            type="button"
            onClick={() => navegarA('/ayudante')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              rutaActiva === '/ayudante'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Ayudante PWA (/ayudante)
          </button>
          <button
            type="button"
            onClick={() => navegarA('/admin')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              rutaActiva === '/admin'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Flota WhatsApp (/admin)
          </button>
          <button
            type="button"
            onClick={() => navegarA('/admin/auditoria')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              rutaActiva === '/admin/auditoria'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Auditoría SaaS (/admin/auditoria)
          </button>
        </nav>

        {/* Zona 3: 1 Acción Primaria */}
        <div className="flex items-center gap-3 shrink-0">
          {sesion?.autenticado ? (
            <button
              type="button"
              onClick={cerrarSesionCorporativa}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir ({sesion.rol})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navegarA('/taquilla')}
              style={{ backgroundColor: '#912D26' }}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white rounded-lg hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Personal PIN 1191
            </button>
          )}
        </div>
      </header>

      {/* Banner de retroalimentación de acciones operativas */}
      {mensajeOperativo && (
        <div
          className={`px-6 py-3 border-b text-sm flex items-center justify-between no-print ${
            mensajeOperativo.tipo === 'exito'
              ? 'bg-emerald-950 text-emerald-50 border-emerald-800'
              : 'bg-amber-950 text-amber-50 border-amber-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {mensajeOperativo.tipo === 'exito' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{mensajeOperativo.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeOperativo(null)}
            className="text-xs underline opacity-80 hover:opacity-100 whitespace-nowrap shrink-0 ml-4"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* PROTECCIÓN DE RUTAS CORPORATIVAS MEDIANTE PIN 1191 */}
      {requierePin && !sesion?.autenticado ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  CONTROL DE ACCESO CORPORATIVO · {rutaActiva.toUpperCase()}
                </p>
                <h1 className="text-xl font-bold text-slate-900 mt-1">
                  Vilcabambaturis Cía. Ltda.
                </h1>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              Acceso rápido protegido por{' '}
              <span className="font-semibold text-slate-900">
                PIN Corporativo (1191)
              </span>{' '}
              para Auditoría SaaS / Respaldos SQL, Ayudante de Autobús (PWA
              Offline) o Taquilla.
            </p>

            <form onSubmit={manejarLoginPin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Seleccione su Rol Operativo
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRolInput('GERENCIA')}
                    className={`min-h-[48px] py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      rolInput === 'GERENCIA'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    GERENCIA
                  </button>
                  <button
                    type="button"
                    onClick={() => setRolInput('AYUDANTE')}
                    className={`min-h-[48px] py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      rolInput === 'AYUDANTE'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    AYUDANTE
                  </button>
                  <button
                    type="button"
                    onClick={() => setRolInput('SECRETARIA')}
                    className={`min-h-[48px] py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      rolInput === 'SECRETARIA'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    SECRETARIA
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="pin-corporativo"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  PIN Corporativo de 4 Dígitos
                </label>
                <input
                  id="pin-corporativo"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Ingrese 1191"
                  className="w-full min-h-[48px] px-3.5 py-2.5 text-center font-mono text-xl tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900"
                />
                <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
                  <span>PIN oficial configurado: 1191</span>
                  <button
                    type="button"
                    onClick={() => setPinInput(PIN_CORPORATIVO_OFICIAL)}
                    className="text-emerald-700 hover:underline font-medium"
                  >
                    Autocompletar 1191
                  </button>
                </div>
              </div>

              {errorPin && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorPin}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Ingresar a {rutaActiva} ({rolInput})
              </button>
            </form>
          </div>
        </main>
      ) : (
        /* CONTENIDO PRINCIPAL DE LA APLICACIÓN */
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
          {/* BARRA DE CONTEXTO OPERATIVO Y SELECTOR DE FRECUENCIAS */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 no-print">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{TENANT_VILCABAMBATURIS.nombre}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    RUC {TENANT_VILCABAMBATURIS.ruc}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{TENANT_VILCABAMBATURIS.matriz}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mt-1">
                  {rutaActiva === '/pasajero' &&
                    'Módulo 1: Compra Pública Accesible (48px), Paradas ANT y Autobús Hino AK (45 Asientos)'}
                  {rutaActiva === '/admin/auditoria' &&
                    'Consola de Auditoría SaaS ($0.25/boleto), Liquidación B2B y Respaldo SQL (23:50 PM)'}
                  {rutaActiva === '/ayudante' &&
                    'App PWA Offline-First del Ayudante — Verificación QR HMAC-SHA256 e IndexedDB'}
                  {rutaActiva === '/taquilla' &&
                    'Consola de Taquilla Física, Corte T-20m y Sincronización SRI'}
                  {rutaActiva === '/admin' &&
                    'Control de Flota en Andén (busDiscoReal) y Despacho WhatsApp VPS'}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sesion?.autenticado && (
                  <span className="text-xs text-slate-600 mr-2">
                    Operador:{' '}
                    <strong className="text-slate-900">
                      {sesion.operadorNombre}
                    </strong>{' '}
                    · Rol <strong className="font-mono">{sesion.rol}</strong>
                  </span>
                )}
                <button
                  type="button"
                  onClick={restaurarDatosDemo}
                  className="min-h-[48px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  Restaurar Turno Demo
                </button>
              </div>
            </div>

            {/* Pizarra de Turnos en Tiempo Real (Módulo 3: #912D26 con ventas vs Gris Neutral 0 ventas) */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <p className="text-xs font-semibold text-slate-600">
                  Pizarra de Turnos en Tiempo Real (Troncal Sur: Loja ⇄
                  Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira |
                  Ramal Noroccidental: Loja ⇄ Malacatos ⇄ El Tambo directo):
                </p>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="inline-flex items-center gap-1.5 text-[#912D26] font-bold">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: '#912D26' }}
                    />
                    Rojo Vinotinto (#912D26): Con ventas / reservas activas
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: '#64748B' }}
                    />
                    Gris Neutral: 0 ventas en línea
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {frecuencias.map((freq) => {
                  const activa = freq.id === frecuenciaActual.id;
                  const pizarra = evaluarTarjetaPizarraTurno(freq);
                  const esConVentas =
                    pizarra.varianteVisual === 'ROJO_VINOTINTO_CON_VENTAS';
                  const abordadosCount = freq.boletos.filter(
                    (b) => b.estadoAbordaje === 'ABORDADO'
                  ).length;

                  return (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setFrecuenciaSeleccionadaId(freq.id)}
                      style={
                        esConVentas
                          ? activa
                            ? {
                                backgroundColor: '#912D26',
                                borderColor: '#912D26',
                              }
                            : {
                                borderColor: '#912D26',
                                backgroundColor: '#FEF2F2',
                              }
                          : activa
                          ? {
                              backgroundColor: '#475569',
                              borderColor: '#334155',
                            }
                          : {
                              borderColor: '#CBD5E1',
                              backgroundColor: '#F8FAFC',
                            }
                      }
                      className={`min-h-[96px] text-left p-4 rounded-2xl border-2 transition-all ${
                        activa ? 'text-white shadow-sm' : 'text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span
                          className={
                            activa ? 'text-white/90' : 'text-slate-600'
                          }
                        >
                          {freq.codigoFrecuencia} · {freq.horaSalida}
                        </span>
                        <span
                          className={`font-semibold ${
                            freq.ventaWebCongelada
                              ? activa
                                ? 'text-amber-200'
                                : 'text-amber-800'
                              : activa
                              ? 'text-emerald-200'
                              : 'text-emerald-800'
                          }`}
                        >
                          {freq.estadoDespacho === 'DESPACHADO_SIN_VENTAS_WEB'
                            ? 'DESPACHADO (0 WEB)'
                            : freq.ventaWebCongelada
                            ? `CERRADA T-20M (T-${freq.minutosParaSalida}m)`
                            : `T-20m en ${Math.max(
                                0,
                                freq.minutosParaSalida - 20
                              )}m (T-${freq.minutosParaSalida}m)`}
                        </span>
                      </div>

                      <div className="text-base font-bold flex items-center gap-1.5">
                        <span>{freq.origen}</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                        <span>{freq.destino}</span>
                        <span className="ml-auto font-mono text-sm">
                          ${freq.tarifaUSD.toFixed(2)} ANT
                        </span>
                      </div>

                      <div
                        className={`text-[11px] mt-2 flex items-center justify-between font-mono ${
                          activa ? 'text-white/95' : 'text-slate-700'
                        }`}
                      >
                        <span>
                          <strong>{freq.busDiscoReal}</strong> · Abordados:{' '}
                          {abordadosCount}/{freq.boletos.length}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            activa
                              ? 'bg-black/25 text-white'
                              : esConVentas
                              ? 'bg-[#912D26] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {esConVentas
                            ? `${pizarra.pasajesVendidosCount} vendido(s)${
                                pizarra.reservasActivasCount > 0
                                  ? ` + ${pizarra.reservasActivasCount} res.`
                                  : ''
                              }`
                            : '0 ventas (Gris)'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* =====================================================================
              VISTA MÓDULO 1: COMPRA PÚBLICA MOBILE-FIRST (/pasajero)
             ===================================================================== */}
          {rutaActiva === '/pasajero' && frecuenciaActual && (
            <Modulo1PublicCheckoutView
              frecuencias={frecuencias}
              frecuenciaActual={frecuenciaActual}
              configuracionGlobal={configuracionGlobal}
              onSelectFrecuencia={setFrecuenciaSeleccionadaId}
              onUpdateFrecuencia={(freqActualizada) => {
                setFrecuencias((prev) =>
                  prev.map((f) =>
                    f.id === freqActualizada.id ? freqActualizada : f
                  )
                );
              }}
              onEmitirBoletosQR={(boletosEmitidos) => {
                if (boletosEmitidos.length > 0) {
                  setUltimoBoletoQR(boletosEmitidos[0]);
                  mostrarNotificacion(
                    `¡Compra exitosa! Se emitieron ${boletosEmitidos.length} Pase(s) Digital(es) QR independientes con desglose ANT.`
                  );
                }
              }}
              onNuevaNotaCreditoSaldo={(nuevaNota) => {
                setNotasCreditoSaldo((prev) => [nuevaNota, ...prev]);
                setNotaCreditoSeleccionadaId(nuevaNota.id);
                mostrarNotificacion(
                  `NotaCreditoSaldo (${nuevaNota.codigoNotaCredito}) creada por $${nuevaNota.saldoDisponibleUSD.toFixed(
                    2
                  )} USD con vigencia de 30 días calendario ($0.00 fee cobrado).`,
                  'alerta'
                );
              }}
            />
          )}

          {/* =====================================================================
              VISTA MÓDULOS 5 Y 6 / FASE 6: ARQUEO SEPARADO, QUEMA DE SALDOS,
              PRODUCCIÓN POR DISCO, AUDITORÍA SAAS Y CONFIGURACIÓN GLOBAL (/admin/auditoria)
             ===================================================================== */}
          {rutaActiva === '/admin/auditoria' && (
            <AuditoriaSaaSView
              frecuencias={frecuencias}
              historialRespaldos={historialRespaldos}
              configuracionGlobal={configuracionGlobal}
              onUpdateConfiguracionGlobal={setConfiguracionGlobal}
              saldosAFavor={saldosAFavor}
              onUpdateSaldosAFavor={setSaldosAFavor}
              onNuevoRespaldoGenerado={(nuevoLog) => {
                setHistorialRespaldos((prev) => [nuevoLog, ...prev]);
                mostrarNotificacion(
                  `Respaldo SQL Nocturno (${nuevoLog.archivoNombre}) enviado a ${nuevoLog.correoDestinatario} y registrado en LogRespaldoBD.`
                );
              }}
            />
          )}

          {/* =====================================================================
              VISTA MÓDULO 4 / FASE 5: APP PWA OFFLINE-FIRST DE TRIPULACIÓN (/ayudante)
             ===================================================================== */}
          {rutaActiva === '/ayudante' && frecuenciaActual && (
            <AyudanteView
              frecuencias={frecuencias}
              frecuenciaActual={frecuenciaActual}
              catalogoFlota={catalogoFlota}
              onSelectFrecuencia={setFrecuenciaSeleccionadaId}
              onSyncBoletosToMainState={sincronizarAbordajesEnEstadoPrincipal}
            />
          )}

          {/* =====================================================================
              VISTA MÓDULO 3: CONSOLA DE TAQUILLA, MAPA TRICOLOR 45 ASIENTOS Y SRI (/taquilla)
             ===================================================================== */}
          {rutaActiva === '/taquilla' && frecuenciaActual && (
            <div className="space-y-6">
              {/* Banner RBAC (Secretaria Lectura/Escritura vs Tripulación/Ayudante Solo Lectura) */}
              <section
                className={`border rounded-xl p-4 no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  permisosRBAC.modoAcceso === 'SOLO_LECTURA'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>{permisosRBAC.etiquetaModo}</span>
                  </div>
                  <p
                    className={`text-xs ${
                      permisosRBAC.modoAcceso === 'SOLO_LECTURA'
                        ? 'text-amber-900'
                        : 'text-slate-300'
                    }`}
                  >
                    {permisosRBAC.descripcionAlcance}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!sesion) return;
                      const nuevoRol: RolOperativo =
                        sesion.rol === 'AYUDANTE' ? 'SECRETARIA' : 'AYUDANTE';
                      const sesionActualizada: SesionCorporativa = {
                        ...sesion,
                        rol: nuevoRol,
                        operadorNombre:
                          nuevoRol === 'AYUDANTE'
                            ? 'Sr. Darwin Quizhpe (Tripulación / Ayudante — Solo Lectura)'
                            : 'Lcda. Verónica Ochoa (Secretaria Taquilla — Lectura/Escritura)',
                      };
                      setSesion(sesionActualizada);
                      mostrarNotificacion(
                        `Modo RBAC cambiado a ${nuevoRol} (${
                          nuevoRol === 'AYUDANTE'
                            ? 'SOLO_LECTURA'
                            : 'LECTURA_ESCRITURA'
                        }).`
                      );
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      permisosRBAC.modoAcceso === 'SOLO_LECTURA'
                        ? 'bg-amber-900 text-white hover:bg-amber-950'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    Alternar Rol RBAC:{' '}
                    {sesion?.rol === 'AYUDANTE'
                      ? 'Cambiar a SECRETARIA (Lectura/Escritura)'
                      : 'Simular Vista AYUDANTE (Solo Lectura)'}
                  </button>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl p-5 no-print">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <Clock className="w-4 h-4 text-slate-700" />
                      <span>
                        REGLA DE CORTE T-20 MINUTOS ·{' '}
                        {frecuenciaActual.codigoFrecuencia} (
                        {frecuenciaActual.origen} ➔ {frecuenciaActual.destino})
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {frecuenciaActual.estadoDespacho ===
                      'DESPACHADO_SIN_VENTAS_WEB' ? (
                        <span className="text-slate-700">
                          Turno Cerrado con Protocolo 0 Ventas (
                          DESPACHADO_SIN_VENTAS_WEB) — 45 Asientos Operados en
                          Ventanilla
                        </span>
                      ) : frecuenciaActual.ventaWebCongelada ? (
                        <span className="text-amber-800">
                          Venta Web Congelada (ventaWebCongelada = true) — Lista
                          SRI Cerrada y {asientosDisponiblesVentanilla.length}{' '}
                          Asientos Sobrantes Liberados a Ventanilla
                        </span>
                      ) : (
                        <span className="text-emerald-800">
                          Venta Web Abierta (Faltan{' '}
                          {frecuenciaActual.minutosParaSalida} min para salida a
                          las {frecuenciaActual.horaSalida})
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Paradas habilitadas:{' '}
                      {[
                        frecuenciaActual.origen,
                        ...frecuenciaActual.paradasIntermedias,
                        frecuenciaActual.destino,
                      ].join(' · ')}{' '}
                      | {frecuenciaActual.anden} | Unidad en Andén:{' '}
                      <strong className="font-mono text-slate-900">
                        {frecuenciaActual.busDiscoReal} (
                        {frecuenciaActual.placaBusReal})
                      </strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {/* Botón de Protocolo 0 Ventas Web cuando el turno tiene 0 ventas en línea */}
                    {evaluarTarjetaPizarraTurno(frecuenciaActual)
                      .puedeCerrarSinVentasWeb && (
                      <button
                        type="button"
                        disabled={!permisosRBAC.puedeCerrarTurnos}
                        onClick={() =>
                          manejarCierreSinVentasWeb(frecuenciaActual.id)
                        }
                        className="px-3.5 py-2.5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Check className="w-4 h-4" />
                        Cerrar Turno 0 Ventas (DESPACHADO_SIN_VENTAS_WEB)
                      </button>
                    )}

                    {!frecuenciaActual.ventaWebCongelada ? (
                      <button
                        type="button"
                        disabled={!permisosRBAC.puedeCerrarTurnos}
                        onClick={() =>
                          ejecutarCorteT20Minutos(frecuenciaActual.id)
                        }
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <Lock className="w-4 h-4" />
                        Activar Corte T-20m Ahora (Congelar Web + Liberar
                        Sobrantes)
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg">
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          Corte T-20m Activo · Asientos 1-10 sobrantes en
                          Ventanilla
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => navegarA('/admin')}
                      className="px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Bus className="w-4 h-4" />
                      Reasignar Bus Real ({frecuenciaActual.busDiscoReal})
                    </button>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 no-print">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Gestión Tricolor del Mapa de Asientos (45 Asientos Hino
                        AK)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Bloque Web (1–10) + Asientos Nativos de Ventanilla
                        (11–45). Toque cualquier asiento{' '}
                        <strong style={{ color: COLOR_TAQUILLA_DISPONIBLE_VERDE }}>
                          Verde Menta (#2E7D32)
                        </strong>{' '}
                        para vender en taquilla.
                      </p>
                    </div>
                  </div>

                  {/* Leyenda Tricolor Inmutable */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-slate-900">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: COLOR_TAQUILLA_VENDIDO_ROJO }}
                      />
                      <span>
                        <strong>#912D26</strong> Vendido (
                        {
                          mapaTricolor45Asientos.filter(
                            (a) => a.estadoTricolor === 'VENDIDO_CONFIRMADO'
                          ).length
                        }
                        )
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-900">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{
                          backgroundColor: COLOR_TAQUILLA_DISPONIBLE_VERDE,
                        }}
                      />
                      <span>
                        <strong>#2E7D32</strong> Libre (
                        {
                          mapaTricolor45Asientos.filter(
                            (a) => a.estadoTricolor === 'DISPONIBLE_TAQUILLA'
                          ).length
                        }
                        )
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-300 text-slate-900">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{
                          backgroundColor: COLOR_TAQUILLA_RESERVA_NARANJA,
                        }}
                      />
                      <span>
                        <strong>#F57C00</strong> Reserva 15m (
                        {
                          mapaTricolor45Asientos.filter(
                            (a) => a.estadoTricolor === 'RESERVA_PENDIENTE_15M'
                          ).length
                        }
                        )
                      </span>
                    </div>
                  </div>

                  {/* Detalle Rápido Bloque Web 1 al 10 */}
                  <p className="text-[11px] font-bold text-slate-700 mb-2">
                    1. Bloque Web (Asientos 1 al 10):
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {mapaTricolor45Asientos
                      .filter((a) => a.esBloqueWeb)
                      .map((asiento) => {
                        const esSeleccionado =
                          asientoVentanillaSeleccionado === asiento.numero;
                        return (
                          <button
                            key={asiento.numero}
                            type="button"
                            onClick={() => {
                              if (
                                asiento.estadoTricolor ===
                                'RESERVA_PENDIENTE_15M'
                              ) {
                                mostrarNotificacion(
                                  `Asiento #${asiento.numero} en Reserva Pendiente (${COLOR_TAQUILLA_RESERVA_NARANJA}): Bloqueado para venta presencial hasta que se confirme o expire su reloj de 15 minutos.`,
                                  'alerta'
                                );
                                return;
                              }
                              if (
                                asiento.puedeVenderseEnVentanilla &&
                                permisosRBAC.puedeVenderEnTaquilla
                              ) {
                                setAsientoVentanillaSeleccionado(
                                  asiento.numero
                                );
                              } else {
                                const boletoAsociado =
                                  frecuenciaActual.boletos.find(
                                    (b) => b.asientoNumero === asiento.numero
                                  );
                                if (boletoAsociado) {
                                  setUltimoBoletoQR(boletoAsociado);
                                }
                              }
                            }}
                            style={{
                              backgroundColor: esSeleccionado
                                ? '#0F172A'
                                : asiento.colorHex,
                              borderColor: esSeleccionado
                                ? '#0F172A'
                                : asiento.colorHex,
                            }}
                            className="p-2.5 rounded-lg border text-left text-white transition-all flex items-center justify-between hover:opacity-95"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs">
                                  #{asiento.numero}
                                </span>
                                <span className="text-[10px] font-mono opacity-90 truncate">
                                  {asiento.etiquetaCorta}
                                </span>
                              </div>
                              <p className="text-[11px] truncate mt-0.5 opacity-95">
                                {asiento.pasajeroNombre || 'Libre Ventanilla'}
                              </p>
                            </div>
                            <div className="shrink-0">
                              {asiento.puedeVenderseEnVentanilla ? (
                                <Unlock className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>

                  {/* Croquis Compacto Nativos de Ventanilla (Asientos 11 al 45) */}
                  <p className="text-[11px] font-bold text-slate-700 mb-2">
                    2. Nativos de Ventanilla (Asientos 11 al 45 — Tricolor):
                  </p>
                  <div className="grid grid-cols-5 gap-1.5 mb-5 max-h-[210px] overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {mapaTricolor45Asientos
                      .filter((a) => !a.esBloqueWeb)
                      .map((asiento) => {
                        const esSeleccionado =
                          asientoVentanillaSeleccionado === asiento.numero;
                        return (
                          <button
                            key={asiento.numero}
                            type="button"
                            onClick={() => {
                              if (
                                asiento.puedeVenderseEnVentanilla &&
                                permisosRBAC.puedeVenderEnTaquilla
                              ) {
                                setAsientoVentanillaSeleccionado(
                                  asiento.numero
                                );
                              } else {
                                const boletoAsociado =
                                  frecuenciaActual.boletos.find(
                                    (b) => b.asientoNumero === asiento.numero
                                  );
                                if (boletoAsociado) {
                                  setUltimoBoletoQR(boletoAsociado);
                                }
                              }
                            }}
                            style={{
                              backgroundColor: esSeleccionado
                                ? '#0F172A'
                                : asiento.colorHex,
                            }}
                            className="py-2 px-1.5 rounded-lg text-white font-mono text-xs font-bold text-center hover:opacity-90 transition-opacity"
                            title={`Asiento #${asiento.numero} — ${
                              asiento.pasajeroNombre || asiento.etiquetaCorta
                            }`}
                          >
                            #{asiento.numero}
                          </button>
                        );
                      })}
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800 mb-2">
                      {!permisosRBAC.puedeVenderEnTaquilla
                        ? 'Modo Solo Lectura Activo (Rol AYUDANTE) — Emisión Deshabilitada'
                        : asientoVentanillaSeleccionado
                        ? `Emitir Boleto Físico en Ventanilla — Asiento #${asientoVentanillaSeleccionado}`
                        : 'Seleccione un asiento Verde Menta (#2E7D32) arriba (1–45) para vender en Ventanilla'}
                    </h4>

                    <form
                      onSubmit={manejarVentaVentanilla}
                      className="space-y-3"
                    >
                      {/* Selector de Forma de Pago en Taquilla: EFECTIVO_TAQUILLA vs SALDO_A_FAVOR (0 Efectivo Entregado) */}
                      <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 space-y-2">
                        <label className="block text-[11px] font-bold text-slate-800">
                          Forma de Pago en Taquilla (Protección de Caja Chica):
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={!permisosRBAC.puedeVenderEnTaquilla}
                            onClick={() =>
                              setFormaPagoVentanilla('EFECTIVO_TAQUILLA')
                            }
                            className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                              formaPagoVentanilla === 'EFECTIVO_TAQUILLA'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            Efectivo Ventanilla
                          </button>
                          <button
                            type="button"
                            disabled={!permisosRBAC.puedeVenderEnTaquilla}
                            onClick={() =>
                              setFormaPagoVentanilla('SALDO_A_FAVOR')
                            }
                            className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                              formaPagoVentanilla === 'SALDO_A_FAVOR'
                                ? 'bg-[#912D26] text-white border-[#912D26]'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            SALDO_A_FAVOR (30 Días)
                          </button>
                        </div>

                        {formaPagoVentanilla === 'SALDO_A_FAVOR' && (
                          <div className="space-y-2 pt-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Seleccione `NotaCreditoSaldo` del Pasajero
                              (Vigencia 30 días · 0 Reembolso en Efectivo):
                            </label>
                            <select
                              value={notaCreditoSeleccionadaId}
                              onChange={(e) =>
                                setNotaCreditoSeleccionadaId(e.target.value)
                              }
                              className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                            >
                              {notasCreditoSaldo.map((nc) => (
                                <option key={nc.id} value={nc.id}>
                                  [{nc.estado}] {nc.codigoNotaCredito} · C.I.{' '}
                                  {nc.cedulaRuc} · $
                                  {nc.saldoDisponibleUSD.toFixed(2)} USD
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                const nota =
                                  notasCreditoSaldo.find(
                                    (n) => n.id === notaCreditoSeleccionadaId
                                  ) || notasCreditoSaldo[0];
                                const bloqueo =
                                  intentarReembolsoEfectivoEnVentanilla(nota);
                                mostrarNotificacion(
                                  bloqueo.motivoProhibicion,
                                  'alerta'
                                );
                              }}
                              className="w-full py-1.5 px-2.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-semibold border border-amber-300 text-left"
                            >
                              Probar Regla de Protección de Caja: Intentar
                              entregar efectivo en ventanilla (Bloqueado)
                            </button>
                          </div>
                        )}
                      </div>

                      {formaPagoVentanilla === 'EFECTIVO_TAQUILLA' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Cédula / RUC Comprador
                              </label>
                              <input
                                type="text"
                                value={cedulaVentanilla}
                                onChange={(e) =>
                                  setCedulaVentanilla(e.target.value)
                                }
                                placeholder="Ej: 1104771920"
                                disabled={
                                  !asientoVentanillaSeleccionado ||
                                  !permisosRBAC.puedeVenderEnTaquilla
                                }
                                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Destino / Parada
                              </label>
                              <select
                                value={paradaVentanilla}
                                onChange={(e) =>
                                  setParadaVentanilla(e.target.value)
                                }
                                disabled={
                                  !asientoVentanillaSeleccionado ||
                                  !permisosRBAC.puedeVenderEnTaquilla
                                }
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50"
                              >
                                <option value={frecuenciaActual.destino}>
                                  {frecuenciaActual.destino} (Ruta Completa - $
                                  {frecuenciaActual.tarifaUSD.toFixed(2)})
                                </option>
                                {frecuenciaActual.paradasIntermedias.map(
                                  (p) => (
                                    <option key={p} value={p}>
                                      Parada: {p}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Nombres y Apellidos / Razón Social
                              </label>
                              <input
                                type="text"
                                value={nombreVentanilla}
                                onChange={(e) =>
                                  setNombreVentanilla(e.target.value)
                                }
                                placeholder="Ej: Mercy Jaramillo"
                                disabled={
                                  !asientoVentanillaSeleccionado ||
                                  !permisosRBAC.puedeVenderEnTaquilla
                                }
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                WhatsApp (Para alertas de flota)
                              </label>
                              <input
                                type="text"
                                value={telefonoVentanilla}
                                onChange={(e) =>
                                  setTelefonoVentanilla(e.target.value)
                                }
                                placeholder="+593 99 123 4567"
                                disabled={
                                  !asientoVentanillaSeleccionado ||
                                  !permisosRBAC.puedeVenderEnTaquilla
                                }
                                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <button
                        type="submit"
                        disabled={
                          !asientoVentanillaSeleccionado ||
                          !permisosRBAC.puedeVenderEnTaquilla
                        }
                        className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Ticket className="w-4 h-4" />
                        {!permisosRBAC.puedeVenderEnTaquilla
                          ? 'Solo Lectura (Rol Tripulación / Ayudante)'
                          : asientoVentanillaSeleccionado
                          ? formaPagoVentanilla === 'SALDO_A_FAVOR'
                            ? `Canjear SALDO_A_FAVOR ($0.00 Efectivo) y Emitir Asiento #${asientoVentanillaSeleccionado}`
                            : `Cobrar $${frecuenciaActual.tarifaUSD.toFixed(
                                2
                              )} y Emitir Asiento #${asientoVentanillaSeleccionado} en Ventanilla`
                          : 'Seleccione un Asiento Disponible (#2E7D32)'}
                      </button>
                    </form>
                  </div>
                </section>

                <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span>
                          EXPORTACIÓN Y 3 BOTONES DE COPIADO VILCABAMBATURIS
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {frecuenciaActual.ventaWebCongelada
                            ? 'LISTA CONGELADA OFICIAL (T-20M)'
                            : 'VISTA PREVIA EN TIEMPO REAL'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                        Compradores Web — Captura Gmail API y Copiado 1-Clic
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={copiarManifiestoCompletoSRI}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        {copiadoSriExito ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ¡Copiado para SRI!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar para SRI (1-Clic)
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={descargarArchivoSRI}
                        className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Exportar TSV
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setMostrarManifiestoFisicoLiberados(
                            !mostrarManifiestoFisicoLiberados
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold text-white bg-[#912D26] hover:opacity-95 rounded-lg transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {mostrarManifiestoFisicoLiberados
                          ? 'Ocultar Manifiesto Impreso'
                          : 'Manifiesto Físico (Asientos Liberados)'}
                      </button>
                    </div>
                  </div>

                  {/* Vista de Manifiesto Físico Impreso con Asientos Liberados de Web */}
                  {mostrarManifiestoFisicoLiberados && (
                    <div className="mb-4 p-4 rounded-xl bg-slate-900 text-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-emerald-300">
                          HOJA DE RUTA IMPRESA PARA ENTREGA FÍSICA AL AYUDANTE
                          (INCLUYE ASIENTOS LIBERADOS DE WEB 1-10)
                        </span>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-2.5 py-1 rounded bg-white text-slate-900 text-xs font-bold"
                        >
                          Imprimir Hoja Física
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono overflow-x-auto leading-relaxed">
                        {
                          generarManifiestoImpresoConAsientosLiberados(
                            frecuenciaActual
                          ).textoImprimible
                        }
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pb-4 border-b border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">
                        Frecuencia / Ruta
                      </span>
                      <strong className="font-mono text-slate-900">
                        {frecuenciaActual.origen} ➔ {frecuenciaActual.destino} (
                        {frecuenciaActual.horaSalida})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        Unidad Real Despachada
                      </span>
                      <strong className="font-mono text-slate-900">
                        {frecuenciaActual.busDiscoReal} ·{' '}
                        {frecuenciaActual.placaBusReal}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        Boletos Web Conciliados
                      </span>
                      <strong className="font-mono text-slate-900">
                        {manifiestoSriActual.length} comprobantes
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        Total Tarifa Oficial ANT (IVA 0%)
                      </span>
                      <strong className="font-mono text-emerald-700">
                        $
                        {manifiestoSriActual
                          .reduce((acc, f) => acc + parseFloat(f.totalUSD), 0)
                          .toFixed(2)}{' '}
                        USD
                      </strong>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 pr-3">Asiento</th>
                          <th className="py-2.5 px-3">Cédula / RUC</th>
                          <th className="py-2.5 px-3">
                            Pasajero / Razón Social
                          </th>
                          <th className="py-2.5 px-3">
                            # Documento / Ref. Gmail API
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            Tarifa ANT
                          </th>
                          <th className="py-2.5 pl-3 text-right no-print">
                            3 Botones de Copiado Independientes (Sistema
                            Vilcabambaturis)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {manifiestoSriActual.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-slate-500"
                            >
                              No existen compras web registradas en esta
                              frecuencia (Tarjeta en Gris Neutral — 0 ventas).
                            </td>
                          </tr>
                        ) : (
                          manifiestoSriActual.map((fila) => {
                            const payloads =
                              generarPayloadsCopiadoSistemaVilcabambaturis(
                                fila,
                                frecuenciaActual
                              );
                            return (
                              <tr
                                key={fila.boletoId}
                                className="hover:bg-slate-50/90 transition-colors"
                              >
                                <td className="py-2.5 pr-3 font-mono font-bold text-slate-900">
                                  #{fila.asiento}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-800">
                                  {fila.identificacion}
                                  <span className="block text-[10px] text-slate-500">
                                    {fila.tipoIdentificacion}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  {fila.razonSocialNombres}
                                  <span className="block text-[10px] font-mono text-slate-500">
                                    {fila.origen} ➔ {fila.destino}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                  <strong>{fila.referenciaPago}</strong>
                                  <span className="block text-[10px] text-slate-500">
                                    {fila.banco}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                  ${fila.totalUSD}
                                </td>
                                <td className="py-2.5 pl-3 text-right no-print">
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    {/* Botón 1: [Copiar Cédula / RUC] */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copiarBotonSistemaVilcabambaturis(
                                          fila.boletoId,
                                          'CEDULA',
                                          payloads.botonCopiarCedulaRuc,
                                          'Cédula / RUC'
                                        )
                                      }
                                      className="px-2 py-1 text-[10px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 inline-flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                      {filaCopiadaId ===
                                      `${fila.boletoId}-CEDULA`
                                        ? '¡Cédula Copiada!'
                                        : 'Copiar Cédula / RUC'}
                                    </button>

                                    {/* Botón 2: [Copiar # Comprobante / Referencia] */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copiarBotonSistemaVilcabambaturis(
                                          fila.boletoId,
                                          'REFERENCIA',
                                          payloads.botonCopiarReferenciaComprobante,
                                          '# Comprobante / Referencia'
                                        )
                                      }
                                      className="px-2 py-1 text-[10px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 inline-flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                      {filaCopiadaId ===
                                      `${fila.boletoId}-REFERENCIA`
                                        ? '¡Ref. Copiada!'
                                        : 'Copiar # Comprobante / Referencia'}
                                    </button>

                                    {/* Botón 3: [Copiar para Ventana Emergente de Depósito] */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copiarBotonSistemaVilcabambaturis(
                                          fila.boletoId,
                                          'DEPOSITO',
                                          payloads.botonCopiarVentanaEmergenteDeposito,
                                          'Ventana Emergente de Depósito'
                                        )
                                      }
                                      className="px-2 py-1 text-[10px] font-semibold text-white bg-[#912D26] hover:opacity-95 rounded inline-flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                      {filaCopiadaId ===
                                      `${fila.boletoId}-DEPOSITO`
                                        ? '¡Depósito Copiado!'
                                        : 'Copiar para Ventana Emergente de Depósito'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 no-print">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Formato estructurado TSV compatible con facturador
                        electrónico SRI y ventana emergente de depósito de
                        Vilcabambaturis.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMostrarPrevisualizacionSri(
                            !mostrarPrevisualizacionSri
                          )
                        }
                        className="text-xs font-medium text-slate-700 hover:text-slate-900 underline"
                      >
                        {mostrarPrevisualizacionSri
                          ? 'Ocultar bloque TSV'
                          : 'Ver bloque de texto SRI'}
                      </button>
                    </div>

                    {mostrarPrevisualizacionSri && (
                      <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed">
                        {formatearTextoCopiadoSRI(frecuenciaActual, true)}
                      </pre>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* =====================================================================
              VISTA REASIGNACIÓN DE FLOTA Y GATEWAY WHATSAPP (/admin)
             ===================================================================== */}
          {rutaActiva === '/admin' && frecuenciaActual && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
                <div className="pb-4 mb-4 border-b border-slate-100">
                  <p className="text-xs font-mono text-slate-500">
                    CONTROL ESTRICTO DE FLOTA Y BLOQUEO DE VEHÍCULOS EN RUTA
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    Reasignación de Flota (busDiscoTeorico vs busDiscoReal)
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg mb-5">
                  <div>
                    <span className="text-[11px] text-slate-500 block">
                      Cuadro de Trabajo (busDiscoTeorico)
                    </span>
                    <strong className="font-mono text-base text-slate-800">
                      {frecuenciaActual.busDiscoTeorico}
                    </strong>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Planificación original
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[11px] text-slate-500 block">
                      Unidad en Andén (busDiscoReal)
                    </span>
                    <strong className="font-mono text-base text-emerald-700">
                      {frecuenciaActual.busDiscoReal}
                    </strong>
                    <span className="block text-[11px] font-mono text-slate-600 mt-0.5">
                      Placa {frecuenciaActual.placaBusReal} ·{' '}
                      {frecuenciaActual.choferAsignado}
                    </span>
                  </div>
                </div>

                <form onSubmit={manejarReasignacionFlota} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Seleccionar Nueva Unidad Real para Salir del Andén (
                      <code className="font-mono">busDiscoReal</code> —
                      Vehículos en Ruta / Despachados Bloqueados)
                    </label>
                    <select
                      value={nuevoBusDisco}
                      onChange={(e) => setNuevoBusDisco(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      {unidadesFlotaControl.map((u) => (
                        <option key={u.disco} value={u.disco}>
                          {u.disco} — Placa {u.placa} — {u.chofer} [
                          {u.estadoOperativo}
                          {!u.seleccionableComoBusReal &&
                          u.disco !== frecuenciaActual.busDiscoReal
                            ? ' · BLOQUEADO EN RUTA'
                            : ''}
                          ]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Motivo de Reasignación (Incluido en alerta a pasajeros)
                    </label>
                    <input
                      type="text"
                      value={motivoReasignacion}
                      onChange={(e) => setMotivoReasignacion(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                      <span>
                        Disparo Automático vía Gateway WhatsApp VPS ($5/mes)
                      </span>
                    </div>
                    <p>
                      Al confirmar el cambio a{' '}
                      <strong className="font-mono text-slate-900">
                        {nuevoBusDisco}
                      </strong>
                      , se enviará notificación instantánea a los{' '}
                      <strong>
                        {frecuenciaActual.boletos.length} pasajeros confirmados
                      </strong>{' '}
                      en la frecuencia {frecuenciaActual.codigoFrecuencia} sin
                      alterar su número de asiento. Si selecciona un autobús en{' '}
                      <code className="font-mono">EN_RUTA</code> o{' '}
                      <code className="font-mono">DESPACHADO</code>, el motor lo
                      bloqueará estrictamente.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Bus className="w-4 h-4" />
                    Confirmar Cambio a {nuevoBusDisco} y Notificar por WhatsApp
                  </button>
                </form>
              </section>

              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-mono text-slate-500">
                      GATEWAY VPS WHATSAPP ·{' '}
                      {TENANT_VILCABAMBATURIS.gatewayVpsUrl}
                    </p>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                      Registro de Notificaciones Masivas a Pasajeros
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-slate-600">
                    Enviados: {alertasWhatsApp.length}
                  </span>
                </div>

                {alertasWhatsApp.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                      Aún no se han ejecutado reasignaciones de flota en este
                      turno.
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Utilice el formulario de la izquierda para cambiar el{' '}
                      <code className="font-mono">busDiscoReal</code> de la
                      frecuencia seleccionada y disparar las alertas por
                      WhatsApp a los pasajeros confirmados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {alertasWhatsApp.map((alerta) => (
                      <div
                        key={alerta.id}
                        className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span className="font-mono">
                              Asiento #{alerta.asientoNumero}
                            </span>
                            <span>·</span>
                            <span>{alerta.pasajeroNombre}</span>
                            <span className="font-mono text-slate-500">
                              ({alerta.telefonoWhatsApp})
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                            {alerta.estado} ({alerta.latenciaMs}ms)
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded border border-slate-200/80">
                          {alerta.mensaje}
                        </p>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                          <span>
                            Reemplazo: {alerta.busDiscoAnterior} ➔{' '}
                            {alerta.busDiscoNuevo}
                          </span>
                          <span>
                            {new Date(alerta.timestamp).toLocaleTimeString(
                              'es-EC'
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* MÓDULO 4: CRUD DE UNIDADES Y GESTIÓN DE CREDENCIALES / RESTABLECIMIENTO DE PIN (/admin/flota) */}
              <section className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-mono text-slate-500">
                      MÓDULO 4 · CRUD DE UNIDADES Y GESTIÓN DE CREDENCIALES (
                      /admin/flota)
                    </p>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                      Catálogo de Flota (Discos / Placas) y Auxilio Rápido de
                      Restablecimiento de PIN
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Creación y edición estructural exclusiva de{' '}
                      <strong>GERENCIA / ADMINISTRACIÓN</strong>. Botón de
                      Auxilio Rápido para restablecer PIN habilitado para{' '}
                      <strong>GERENCIA</strong> y <strong>SECRETARIA</strong>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono font-bold">
                      Rol Activo: {sesion?.rol || 'GERENCIA'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Formulario de Alta de Unidad (Exclusivo GERENCIA) */}
                  <form
                    onSubmit={manejarCrearUnidadCrud}
                    className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Registrar Nueva Unidad (Solo GERENCIA)
                      </h3>
                      <KeyRound className="w-4 h-4 text-[#912D26]" />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Número de Disco
                        </label>
                        <input
                          type="text"
                          value={nuevoCrudDisco}
                          onChange={(e) => setNuevoCrudDisco(e.target.value)}
                          placeholder="Disco #35"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Placa Oficial ANT
                        </label>
                        <input
                          type="text"
                          value={nuevaCrudPlaca}
                          onChange={(e) => setNuevaCrudPlaca(e.target.value)}
                          placeholder="LAA-3055"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Conductor / Chofer Titular
                        </label>
                        <input
                          type="text"
                          value={nuevoCrudChofer}
                          onChange={(e) => setNuevoCrudChofer(e.target.value)}
                          placeholder="Sr. Jorge Armijos"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          PIN (4 díg.)
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={nuevoCrudPin}
                          onChange={(e) => setNuevoCrudPin(e.target.value)}
                          placeholder="1191"
                          className="w-full px-3 py-2 text-xs font-mono text-center bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{ backgroundColor: '#912D26' }}
                      className="w-full min-h-[44px] py-2.5 px-4 text-white text-xs font-bold rounded-lg hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
                    >
                      <Bus className="w-4 h-4" />
                      Crear Unidad en /admin/flota
                    </button>
                  </form>

                  {/* Tabla de Unidades y Botón de Restablecimiento de PIN (Auxilio Rápido) */}
                  <div className="lg:col-span-8 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 pr-3">Disco / Placa</th>
                          <th className="py-2.5 px-3">Chofer Asignado</th>
                          <th className="py-2.5 px-3">Estado Flota</th>
                          <th className="py-2.5 px-3">PIN PWA Tripulación</th>
                          <th className="py-2.5 pl-3 text-right">
                            Gestión de Credenciales / Auxilio Rápido
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {catalogoFlota.map((unidad) => (
                          <tr
                            key={unidad.disco}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-2.5 pr-3 font-mono font-bold text-slate-900">
                              {unidad.disco}
                              <span className="block text-[10px] font-normal text-slate-500">
                                Placa {unidad.placa} · {unidad.capacidad}{' '}
                                asientos
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-800">
                              {unidad.chofer}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${
                                  unidad.estadoOperativo === 'EN_RUTA' ||
                                  unidad.estadoOperativo === 'DESPACHADO'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                {unidad.estadoOperativo}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <span className="px-2 py-1 rounded bg-slate-900 text-white font-bold">
                                PIN: {unidad.pinUnidad || '1191'}
                              </span>
                              {unidad.ultimoResetPinAt && (
                                <span className="block text-[10px] text-emerald-700 mt-0.5">
                                  Restablecido:{' '}
                                  {new Date(
                                    unidad.ultimoResetPinAt
                                  ).toLocaleTimeString('es-EC')}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {discoEditandoPin === unidad.disco ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      maxLength={4}
                                      value={pinPersonalizadoInput}
                                      onChange={(e) =>
                                        setPinPersonalizadoInput(e.target.value)
                                      }
                                      className="w-16 px-2 py-1 text-xs font-mono text-center border border-slate-300 rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        manejarGuardarPinEditado(unidad.disco)
                                      }
                                      className="px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDiscoEditandoPin(unidad.disco);
                                      setPinPersonalizadoInput(
                                        unidad.pinUnidad || '1191'
                                      );
                                    }}
                                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                                  >
                                    Editar PIN (Gerencia)
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    manejarRestablecerPinAuxilio(unidad.disco)
                                  }
                                  className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg inline-flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Restablecer PIN 1191 (Auxilio Rápido)
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* PASE DE ABORDAR DIGITAL QR CON FIRMA HMAC-SHA256 */}
          {ultimoBoletoQR && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 no-print">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-700">
                    <QrCode className="w-4 h-4" />
                    <span>
                      PASE DE ABORDAR VERIFICADO · CANAL:{' '}
                      {ultimoBoletoQR.canalVenta}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Asiento #{ultimoBoletoQR.asientoNumero} —{' '}
                    {ultimoBoletoQR.pasajeroNombre} ({ultimoBoletoQR.cedulaRuc})
                  </h3>
                  <p className="text-xs text-slate-600 font-mono">
                    Ruta: {ultimoBoletoQR.origen} ➔ {ultimoBoletoQR.destino} ·
                    Tarifa ANT: ${ultimoBoletoQR.montoUSD.toFixed(2)} · Ref:{' '}
                    {ultimoBoletoQR.referenciaBancaria} · Firma:{' '}
                    {ultimoBoletoQR.firmaHmac}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUltimoBoletoQR(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg self-start md:self-center"
                >
                  Cerrar Vista de Boleto
                </button>
              </div>
            </section>
          )}
        </main>
      )}

      {/* PIE DE PÁGINA LIMPIO */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
        <div>
          PasajeYa SaaS Multi-Tenant · Cliente Piloto: Vilcabambaturis Cía.
          Ltda. (Loja, Ecuador)
        </div>
        <div className="flex items-center gap-4">
          <span>Brand Kit: #912D26</span>
          <span aria-hidden="true">·</span>
          <span>5 Paradas Urbanas Autorizadas ANT</span>
          <span aria-hidden="true">·</span>
          <span>Desglose ANT + $0.25 Servicio Digital</span>
        </div>
      </footer>
    </div>
  );
}
