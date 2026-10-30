import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  Check,
  Clock,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  Lock,
  Mail,
  MessageSquare,
  Play,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  ConfiguracionGlobalSistema,
  CuentaBancariaConfigurable,
  FacturacionMensualTenantRecord,
  FrecuenciaRuta,
  LiquidacionDia1Prefactura,
  LogRespaldoBDRecord,
  SaldoAFavorRecord,
} from '../types/pasajeya';
import {
  BACKUP_EMAIL_DEFAULT,
  calcularMetricasAuditoriaSaaS,
  CRON_SECRET_DEFAULT,
  ejecutarRespaldoNocturnoSQL,
  FEE_TECNOLOGICO_POR_BOLETO_USD,
} from '../services/backupAndAuditService';
import {
  actualizarConfiguracionGlobalSoporteYBackup,
  actualizarImagenQrOficialBanco,
  alternarToggleCanalCobroTiempoReal,
  aprobarLiquidacionDia1EnUnClic,
  buscarSaldosAFavorPorCedulaRuc,
  calcularArqueoFisicoVentanillaSeparado,
  calcularCuadreConciliacionBancariaFondos,
  crearConfiguracionGlobalInicial,
  crearSaldosAFavorIniciales,
  ejecutarCierreAutomaticoDia1Mes0005AM,
  exportarProduccionPorDiscoTSV,
  generarReporteProduccionPorDisco01a16,
  guardarCuentaBancariaCRUD,
  quemarSaldoAFavorEnTaquillaAtomico,
  revertirCanjeSaldoDentroDe3Minutos,
} from '../services/module5And6Engine';
import {
  PIN_CORPORATIVO_OFICIAL,
  TENANT_VILCABAMBATURIS,
} from '../services/pasajeyaEngine';

interface AuditoriaSaaSViewProps {
  frecuencias: FrecuenciaRuta[];
  historialRespaldos: LogRespaldoBDRecord[];
  onNuevoRespaldoGenerado: (nuevoLog: LogRespaldoBDRecord) => void;
  configuracionGlobal?: ConfiguracionGlobalSistema;
  onUpdateConfiguracionGlobal?: (nuevaConfig: ConfiguracionGlobalSistema) => void;
  saldosAFavor?: SaldoAFavorRecord[];
  onUpdateSaldosAFavor?: (nuevosSaldos: SaldoAFavorRecord[]) => void;
  tabInicial?:
    | 'ARQUEO_Y_SALDOS'
    | 'PRODUCCION_DISCOS'
    | 'AUDITORIA_BANCOS_Y_DIA1'
    | 'CONFIGURACION_GLOBAL';
}

export const AuditoriaSaaSView: React.FC<AuditoriaSaaSViewProps> = ({
  frecuencias,
  historialRespaldos,
  onNuevoRespaldoGenerado,
  configuracionGlobal: propConfig,
  onUpdateConfiguracionGlobal,
  saldosAFavor: propSaldos,
  onUpdateSaldosAFavor,
  tabInicial = 'ARQUEO_Y_SALDOS',
}) => {
  const [tabActiva, setTabActiva] = useState<
    | 'ARQUEO_Y_SALDOS'
    | 'PRODUCCION_DISCOS'
    | 'AUDITORIA_BANCOS_Y_DIA1'
    | 'CONFIGURACION_GLOBAL'
  >(tabInicial);

  // Estado local o sincronizado de Saldos a Favor (Tabla SaldoAFavor)
  const [saldosInternos, setSaldosInternos] = useState<SaldoAFavorRecord[]>(
    () => crearSaldosAFavorIniciales()
  );
  const saldos = propSaldos || saldosInternos;
  const actualizarSaldos = (nuevos: SaldoAFavorRecord[]) => {
    setSaldosInternos(nuevos);
    onUpdateSaldosAFavor?.(nuevos);
  };

  // Estado local o sincronizado de Configuración Global (Módulo 6)
  const [configInterna, setConfigInterna] =
    useState<ConfiguracionGlobalSistema>(() =>
      crearConfiguracionGlobalInicial()
    );
  const configGlobal = propConfig || configInterna;
  const actualizarConfigGlobal = (nueva: ConfiguracionGlobalSistema) => {
    setConfigInterna(nueva);
    onUpdateConfiguracionGlobal?.(nueva);
  };

  // Banner interno de notificaciones Módulos 5 y 6
  const [avisoOperativo, setAvisoOperativo] = useState<{
    tipo: 'exito' | 'alerta';
    texto: string;
  } | null>(null);

  const notificar = (texto: string, tipo: 'exito' | 'alerta' = 'exito') => {
    setAvisoOperativo({ tipo, texto });
  };

  // =========================================================================
  // 5A. ARQUEO FÍSICO DE VENTANILLA (EFECTIVO PURO)
  // =========================================================================
  const [encomiendasEfectivoUSD, setEncomiendasEfectivoUSD] =
    useState<number>(18.5);

  const arqueoSeparado = useMemo(
    () =>
      calcularArqueoFisicoVentanillaSeparado({
        frecuencias,
        encomiendasEfectivoUSD,
        saldosAFavor: saldos,
      }),
    [frecuencias, encomiendasEfectivoUSD, saldos]
  );

  const descargarTsvVentasWebContadora = () => {
    const blob = new Blob([arqueoSeparado.tsvDescargableContadora], {
      type: 'text/tab-separated-values;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AUDITORIA_CONTABLE_TRANSFERENCIAS_WEB_${arqueoSeparado.fechaOperativa}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notificar(
      'Reporte "Ventas en Línea por Transferencia (Auditoría Contable)" descargado para Contabilidad ($0.00 afectación en efectivo de taquilla).'
    );
  };

  // =========================================================================
  // 5B. QUEMA ATÓMICA DE "SALDO A FAVOR" EN TAQUILLA (/taquilla/saldos)
  // =========================================================================
  const [busquedaCedulaSaldo, setBusquedaCedulaSaldo] = useState<string>('');
  const [pinQuemaSecretaria, setPinQuemaSecretaria] =
    useState<string>(PIN_CORPORATIVO_OFICIAL);
  const [formaPagoQuema, setFormaPagoQuema] = useState<
    'Saldo a Favor' | 'Transferencia'
  >('Saldo a Favor');

  const saldosFiltrados = useMemo(
    () => buscarSaldosAFavorPorCedulaRuc(saldos, busquedaCedulaSaldo),
    [saldos, busquedaCedulaSaldo]
  );

  const manejarCanjearSaldoEnVentanilla = (saldoId: string) => {
    try {
      const res = quemarSaldoAFavorEnTaquillaAtomico({
        saldosActuales: saldos,
        saldoId,
        pinSecretaria: pinQuemaSecretaria,
        formaPagoMarcada: formaPagoQuema,
      });
      actualizarSaldos(res.saldosActualizados);
      notificar(
        `¡Quema atómica exitosa! Código único ${res.codigoQuemaUnico} · Estado: CONSUMIDO_EN_TAQUILLA ($0.00 salida de efectivo) · WhatsApp enviado: "${res.mensajeWhatsAppConfirmacion}"`
      );
    } catch (err: any) {
      notificar(err?.message || 'Error al canjear Saldo a Favor.', 'alerta');
    }
  };

  const manejarRevertirCanje3Min = (saldoId: string) => {
    try {
      const res = revertirCanjeSaldoDentroDe3Minutos({
        saldosActuales: saldos,
        saldoId,
      });
      actualizarSaldos(res.saldosActualizados);
      notificar(res.mensajeAuxilio);
    } catch (err: any) {
      notificar(err?.message || 'Error al revertir canje de saldo.', 'alerta');
    }
  };

  // =========================================================================
  // 5C. REPORTE DE PRODUCCIÓN WEB POR DISCO / UNIDAD (DISCO 01 AL DISCO 16)
  // =========================================================================
  const filasProduccionDiscos = useMemo(
    () => generarReporteProduccionPorDisco01a16(frecuencias),
    [frecuencias]
  );

  const descargarExcelProduccionDiscos = () => {
    const tsv = exportarProduccionPorDiscoTSV(filasProduccionDiscos);
    const blob = new Blob([tsv], {
      type: 'text/tab-separated-values;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRODUCCION_WEB_POR_DISCO_01_AL_16_VILCABAMBATURIS.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notificar(
      'Reporte de Producción Web por Disco (Disco 01 al Disco 16) exportado en formato Excel (TSV/CSV).'
    );
  };

  // =========================================================================
  // 5D & 5E. AUDITORÍA DE FONDOS EN CUSTODIA + LIQUIDACIÓN DÍA 1 (00:05 AM)
  // =========================================================================
  const cuadreBancario = useMemo(
    () =>
      calcularCuadreConciliacionBancariaFondos({
        frecuencias,
        saldosCustodia: saldos,
      }),
    [frecuencias, saldos]
  );

  const [prefacturaDia1, setPrefacturaDia1] =
    useState<LiquidacionDia1Prefactura>(() =>
      ejecutarCierreAutomaticoDia1Mes0005AM({
        frecuencias,
        saldosSinBoleto: saldos,
      })
    );

  const dispararCierreDia1Manual = () => {
    const nueva = ejecutarCierreAutomaticoDia1Mes0005AM({
      frecuencias,
      saldosSinBoleto: saldos,
      correoGerenciaDestino: configGlobal.correoInstitucionalGerenciaSistemas,
    });
    setPrefacturaDia1(nueva);
    notificar(
      `Cierre Automático Día 1 (00:05 AM) ejecutado: ${nueva.boletosConfirmadosAuditados} boletos CONFIRMADO × $0.25 = $${nueva.totalPrefacturaFeeUSD.toFixed(
        2
      )} USD ($0.00 sobre ${
        nueva.transferenciasSinBoletoExcluidas
      } transferencias sin boleto). Enviado a ${nueva.correoGerenciaDestino}.`
    );
  };

  const manejarAprobarLiquidacionDia1 = () => {
    const aprobada = aprobarLiquidacionDia1EnUnClic({
      prefactura: prefacturaDia1,
    });
    setPrefacturaDia1(aprobada);
    notificar(
      `Liquidación mensual (${aprobada.periodoLiquidado}) aprobada en 1-clic por ${aprobada.aprobadaPor}.`
    );
  };

  // Métricas financieras SaaS en tiempo real
  const metricas = useMemo(
    () => calcularMetricasAuditoriaSaaS(frecuencias),
    [frecuencias]
  );

  const [liquidacionesPagadasIds, setLiquidacionesPagadasIds] = useState<
    string[]
  >([]);

  // =========================================================================
  // MÓDULO 6: CONSOLA DE CONFIGURACIÓN GLOBAL (/admin/configuracion)
  // =========================================================================
  const [cuentaEditId, setCuentaEditId] = useState<string>('cta-bancaria-01');
  const cuentaSeleccionada =
    configGlobal.cuentasBancarias.find((c) => c.id === cuentaEditId) ||
    configGlobal.cuentasBancarias[0];

  const [numeroCuentaInput, setNumeroCuentaInput] = useState<string>(
    cuentaSeleccionada?.numeroCuenta || '2901485921'
  );
  const [rucTitularInput, setRucTitularInput] = useState<string>(
    cuentaSeleccionada?.rucTitular || '1191705482001'
  );
  const [tipoCuentaInput, setTipoCuentaInput] = useState<
    'Cuenta Corriente' | 'Cuenta de Ahorros'
  >(cuentaSeleccionada?.tipoCuenta || 'Cuenta Corriente');
  const [titularInput, setTitularInput] = useState<string>(
    cuentaSeleccionada?.titularCuenta ||
      'Cooperativa de Transporte Vilcabambaturis Cía. Ltda.'
  );

  const [whatsappSoporteInput, setWhatsappSoporteInput] = useState<string>(
    configGlobal.whatsappSoporteCliente
  );
  const [gatewayUrlInput, setGatewayUrlInput] = useState<string>(
    configGlobal.gatewayWhatsappApiUrl
  );
  const [gatewayTokenInput, setGatewayTokenInput] = useState<string>(
    configGlobal.gatewayWhatsappToken
  );

  // Estado del disparador de Cron Job Nocturno (/api/v1/cron/backup-db)
  const [cronSecretInput, setCronSecretInput] =
    useState<string>(CRON_SECRET_DEFAULT);
  const [emailDestinoInput, setEmailDestinoInput] = useState<string>(
    configGlobal.correoInstitucionalGerenciaSistemas || BACKUP_EMAIL_DEFAULT
  );
  const [ejecutandoBackup, setEjecutandoBackup] = useState<boolean>(false);
  const [ultimoDumpSql, setUltimoDumpSql] = useState<string | null>(null);
  const [mostrarSqlPreview, setMostrarSqlPreview] = useState<boolean>(false);
  const [mensajeCron, setMensajeCron] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);

  const manejarToggleBanco = (
    canal: 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA',
    nuevoEstado: boolean
  ) => {
    const nueva = alternarToggleCanalCobroTiempoReal({
      configActual: configGlobal,
      canal,
      activo: nuevoEstado,
    });
    actualizarConfigGlobal(nueva);
    notificar(
      `Canal ${
        canal === 'BANCO_DE_LOJA' ? 'Banco de Loja' : 'Banco Pichincha / Deuna!'
      } cambiado en tiempo real a [${
        nuevoEstado ? 'ON (HABILITADO)' : 'OFF (DESACTIVADO)'
      }] en el checkout público.`
    );
  };

  const manejarGuardarCuentaBancaria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaSeleccionada) return;
    try {
      const nueva = guardarCuentaBancariaCRUD({
        configActual: configGlobal,
        cuentaEditadaOCreada: {
          ...cuentaSeleccionada,
          numeroCuenta: numeroCuentaInput,
          rucTitular: rucTitularInput,
          tipoCuenta: tipoCuentaInput,
          titularCuenta: titularInput,
        },
      });
      actualizarConfigGlobal(nueva);
      notificar(
        `Cuenta bancaria de ${cuentaSeleccionada.nombreMostrar} actualizada (#${numeroCuentaInput} · RUC ${rucTitularInput}).`
      );
    } catch (err: any) {
      notificar(err?.message || 'Error al guardar cuenta bancaria.', 'alerta');
    }
  };

  const manejarSubirArchivoQr = (
    cuenta: CuentaBancariaConfigurable,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const nueva = actualizarImagenQrOficialBanco({
          configActual: configGlobal,
          cuentaId: cuenta.id,
          nuevaQrImagenUrl: reader.result,
        });
        actualizarConfigGlobal(nueva);
        notificar(
          `Imagen oficial de código QR actualizada para ${cuenta.nombreMostrar}.`
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const manejarGuardarSoporteYBackup = (e: React.FormEvent) => {
    e.preventDefault();
    const nueva = actualizarConfiguracionGlobalSoporteYBackup({
      configActual: configGlobal,
      whatsappSoporteCliente: whatsappSoporteInput,
      gatewayWhatsappApiUrl: gatewayUrlInput,
      gatewayWhatsappToken: gatewayTokenInput,
      correoInstitucionalGerenciaSistemas: emailDestinoInput,
    });
    actualizarConfigGlobal(nueva);
    notificar(
      `Configuración de WhatsApp Oficial (${nueva.whatsappSoporteCliente}), Gateway VPS y Correo de Respaldo SQL (${nueva.correoInstitucionalGerenciaSistemas}) guardada.`
    );
  };

  const dispararCronRespaldoManual = async (usarTokenInvalido = false) => {
    setEjecutandoBackup(true);
    setMensajeCron(null);

    const tokenAEnviar = usarTokenInvalido
      ? 'TOKEN_INTRUSO_NO_AUTORIZADO'
      : cronSecretInput;

    const resultado = await ejecutarRespaldoNocturnoSQL({
      authHeader: `Bearer ${tokenAEnviar}`,
      frecuencias,
      emailOverride: emailDestinoInput,
    });

    setEjecutandoBackup(false);

    if (!resultado.autorizado || !resultado.registroLog) {
      setMensajeCron({
        tipo: 'error',
        texto: `HTTP ${resultado.statusHttp}: ${resultado.mensaje}`,
      });
      return;
    }

    onNuevoRespaldoGenerado(resultado.registroLog);
    setUltimoDumpSql(resultado.sqlDumpCompleto || null);
    setMostrarSqlPreview(true);
    setMensajeCron({
      tipo: 'ok',
      texto: `HTTP 200 OK (/api/v1/cron/backup-db): ${resultado.mensaje}`,
    });
  };

  const descargarDumpSqlArchivo = (log: LogRespaldoBDRecord) => {
    const contenido = ultimoDumpSql || log.sqlDumpPreview;
    const blob = new Blob([contenido], {
      type: 'application/sql;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = log.archivoNombre.replace('.gz', '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* CABECERA EJECUTIVA MÓDULOS 5 Y 6 */}
      <section className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
              <span>MÓDULOS 5 Y 6 · FINANZAS, SALDOS Y CONFIGURACIÓN GLOBAL</span>
              <span aria-hidden="true">·</span>
              <span>
                RUTAS: /admin/taquilla · /taquilla/saldos · /admin/reportes ·
                /admin/configuracion
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Arqueo Separado ($0.00 Descuadre), Quema de Saldos a Favor,
              Producción por Disco (01–16) y Configuración Global
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>CUADRE AL CENTAVO · VILCABAMBATURIS CÍA. LTDA.</span>
          </div>
        </div>

        {/* Selector de Pestañas Módulos 5 y 6 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-5">
          <button
            type="button"
            onClick={() => setTabActiva('ARQUEO_Y_SALDOS')}
            style={
              tabActiva === 'ARQUEO_Y_SALDOS'
                ? { backgroundColor: '#912D26', borderColor: '#912D26' }
                : undefined
            }
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-left text-xs font-bold border transition-all ${
              tabActiva === 'ARQUEO_Y_SALDOS'
                ? 'text-white'
                : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            1. Arqueo Efectivo Puro & Quema de Saldos (/taquilla/saldos)
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('PRODUCCION_DISCOS')}
            style={
              tabActiva === 'PRODUCCION_DISCOS'
                ? { backgroundColor: '#912D26', borderColor: '#912D26' }
                : undefined
            }
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-left text-xs font-bold border transition-all ${
              tabActiva === 'PRODUCCION_DISCOS'
                ? 'text-white'
                : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            2. Producción Web por Disco 01 al 16 (/admin/reportes)
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('AUDITORIA_BANCOS_Y_DIA1')}
            style={
              tabActiva === 'AUDITORIA_BANCOS_Y_DIA1'
                ? { backgroundColor: '#912D26', borderColor: '#912D26' }
                : undefined
            }
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-left text-xs font-bold border transition-all ${
              tabActiva === 'AUDITORIA_BANCOS_Y_DIA1'
                ? 'text-white'
                : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            3. Fondos en Custodia & Liquidación Día 1 (00:05 AM)
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('CONFIGURACION_GLOBAL')}
            style={
              tabActiva === 'CONFIGURACION_GLOBAL'
                ? { backgroundColor: '#912D26', borderColor: '#912D26' }
                : undefined
            }
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-left text-xs font-bold border transition-all ${
              tabActiva === 'CONFIGURACION_GLOBAL'
                ? 'text-white'
                : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            4. Módulo 6: Configuración Global (/admin/configuracion)
          </button>
        </div>
      </section>

      {avisoOperativo && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between no-print ${
            avisoOperativo.tipo === 'exito'
              ? 'bg-emerald-950 text-emerald-50 border-emerald-800'
              : 'bg-amber-950 text-amber-50 border-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {avisoOperativo.tipo === 'exito' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{avisoOperativo.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setAvisoOperativo(null)}
            className="underline ml-4 shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 1: MÓDULO 5A (ARQUEO SEPARADO) Y MÓDULO 5B (QUEMA DE SALDOS A FAVOR)
         ===================================================================== */}
      {tabActiva === 'ARQUEO_Y_SALDOS' && (
        <div className="space-y-6">
          {/* 5A: Arqueo Físico de Ventanilla (Efectivo Puro) vs Ventas Web por Transferencia */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono text-emerald-700 font-bold">
                    MÓDULO 5A · /admin/taquilla · EFECTIVO PURO DE SECRETARIA
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Arqueo Físico de Ventanilla (Cero Mezcla con Dinero Web)
                  </h3>
                </div>
                <Receipt className="w-5 h-5 text-emerald-700" />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                El cierre diario de la secretaria calcula{' '}
                <strong>ÚNICAMENTE el dinero físico recaudado en ventanilla</strong>
                :
                <code className="block mt-1 p-2 bg-slate-100 rounded font-mono text-[11px] text-slate-900">
                  ($VentaFisicaEfectivo + $EncomiendasEfectivo =
                  $TotalEfectivoCajon)
                </code>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    $VentaFisicaEfectivo
                  </span>
                  <strong className="font-mono text-lg font-bold text-slate-900">
                    ${arqueoSeparado.ventaFisicaEfectivoUSD.toFixed(2)} USD
                  </strong>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Boletos cobrados en efectivo
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                    $EncomiendasEfectivo
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={encomiendasEfectivoUSD}
                    onChange={(e) =>
                      setEncomiendasEfectivoUSD(
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full px-2.5 py-1 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-950 text-white border border-emerald-800">
                  <span className="text-[11px] text-emerald-200 block">
                    $TotalEfectivoCajon
                  </span>
                  <strong className="font-mono text-xl font-bold text-emerald-300">
                    ${arqueoSeparado.totalEfectivoCajonUSD.toFixed(2)} USD
                  </strong>
                  <span className="block text-[10px] text-emerald-200 mt-0.5">
                    Efectivo físico exacto a entregar
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-mono">
                {arqueoSeparado.formulaArqueoEfectivo} · Descuadre o afectación
                por ventas web:{' '}
                <strong>
                  $
                  {arqueoSeparado.afectacionEfectivoCajonPorWebUSD.toFixed(2)}{' '}
                  USD
                </strong>
              </div>
            </section>

            {/* Bloque Informativo Separado: Ventas en Línea por Transferencia (Auditoría Contable) */}
            <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono text-[#912D26] font-bold">
                    BLOQUE INFORMATIVO INDEPENDIENTE PARA CONTABILIDAD
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {arqueoSeparado.tituloBloqueTransferenciasWeb}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={descargarTsvVentasWebContadora}
                  style={{ backgroundColor: '#912D26' }}
                  className="px-3.5 py-2 text-xs font-bold text-white rounded-xl hover:opacity-95 transition-opacity flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar para Contadora
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Las ventas web por transferencia ingresan directamente a las
                cuentas bancarias de{' '}
                <strong>{TENANT_VILCABAMBATURIS.nombre}</strong> y{' '}
                <strong>NO se arquean en la caja chica de la secretaria</strong>{' '}
                (<strong>$0.00 dólares de afectación o descuadre</strong> en el
                efectivo físico de la taquilla).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    Boletos Web Transferencia
                  </span>
                  <strong className="font-mono text-lg font-bold text-slate-900">
                    {arqueoSeparado.boletosWebTransferenciaCount} boletos
                  </strong>
                  <span className="block text-[10px] font-mono text-slate-600 mt-0.5">
                    Total: $
                    {arqueoSeparado.totalVentasWebTransferenciaUSD.toFixed(2)}{' '}
                    USD
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    Saldos a Favor Quemados
                  </span>
                  <strong className="font-mono text-lg font-bold text-slate-900">
                    {arqueoSeparado.saldosAFavorCanjeadosCount} canje(s)
                  </strong>
                  <span className="block text-[10px] font-mono text-slate-600 mt-0.5">
                    Total: $
                    {arqueoSeparado.totalSaldosAFavorCanjeadosUSD.toFixed(2)}{' '}
                    USD
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                  <span className="text-[11px] text-[#912D26] font-bold block">
                    Afectación a Efectivo Taquilla
                  </span>
                  <strong className="font-mono text-xl font-bold text-[#912D26]">
                    $0.00 USD
                  </strong>
                  <span className="block text-[10px] text-slate-700 mt-0.5">
                    0% mezcla con caja chica
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* 5B: Mecanismo de Quema de "Saldo a Favor" en Taquilla (/taquilla/saldos) */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-[#912D26] font-bold">
                  MÓDULO 5B · /taquilla/saldos · TABLA PRISMA: SaldoAFavor
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Mecanismo de Quema Atómica de "Saldo a Favor" en Taquilla y
                  Reversión de Auxilio (3 min)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Consulta por Cédula/RUC, quema en 1-clic con código único{' '}
                  <code className="font-mono">SALDO-XXXXXX</code>, disparo
                  automático de WhatsApp y{' '}
                  <strong>$0.00 de entrega o salida de efectivo físico</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busquedaCedulaSaldo}
                    onChange={(e) => setBusquedaCedulaSaldo(e.target.value)}
                    placeholder="Buscar Cédula / RUC / Nombre..."
                    className="pl-8 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl w-64"
                  />
                </div>

                <select
                  value={formaPagoQuema}
                  onChange={(e) =>
                    setFormaPagoQuema(
                      e.target.value as 'Saldo a Favor' | 'Transferencia'
                    )
                  }
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="Saldo a Favor">
                    Forma Pago: Saldo a Favor ($0.00 Efectivo)
                  </option>
                  <option value="Transferencia">
                    Forma Pago: Transferencia ($0.00 Efectivo)
                  </option>
                </select>

                <input
                  type="password"
                  maxLength={4}
                  value={pinQuemaSecretaria}
                  onChange={(e) => setPinQuemaSecretaria(e.target.value)}
                  placeholder="PIN 1191"
                  className="w-24 px-3 py-2 text-xs font-mono text-center bg-slate-50 border border-slate-300 rounded-xl"
                  title="PIN de la secretaria (1191)"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Cédula / RUC</th>
                    <th className="py-2.5 px-3">Depositante / WhatsApp</th>
                    <th className="py-2.5 px-3">Banco / # Referencia</th>
                    <th className="py-2.5 px-3 text-right">Monto Custodia</th>
                    <th className="py-2.5 px-3">Estado / Código Quema</th>
                    <th className="py-2.5 pl-3 text-right">
                      Acción Atómica en Ventanilla ($0.00 Efectivo)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saldosFiltrados.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="py-3 pr-3 font-mono font-bold text-slate-900">
                        {s.cedulaRuc}
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-900 block">
                          {s.depositanteNombre}
                        </strong>
                        <span className="font-mono text-[11px] text-slate-500">
                          {s.telefonoWhatsApp}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <strong className="text-slate-900">
                          {s.referenciaBancaria}
                        </strong>
                        <span className="block text-slate-500">{s.banco}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ${s.montoUSD.toFixed(2)} USD
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded font-bold inline-block ${
                            s.estado === 'ACTIVO'
                              ? 'bg-emerald-100 text-emerald-900'
                              : s.estado === 'CONSUMIDO_EN_TAQUILLA'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {s.estado}
                        </span>
                        {s.codigoQuemaUnico && (
                          <span className="block text-[10px] text-[#912D26] font-bold mt-0.5">
                            Quema: {s.codigoQuemaUnico} · PIN{' '}
                            {s.pinSecretariaQuema}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {s.estado === 'ACTIVO' && (
                            <button
                              type="button"
                              onClick={() =>
                                manejarCanjearSaldoEnVentanilla(s.id)
                              }
                              style={{ backgroundColor: '#912D26' }}
                              className="px-3 py-1.5 rounded-lg text-white font-bold text-xs hover:opacity-95 transition-opacity inline-flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              [Canjear Saldo en Ventanilla]
                            </button>
                          )}

                          {s.estado === 'CONSUMIDO_EN_TAQUILLA' && (
                            <button
                              type="button"
                              onClick={() => manejarRevertirCanje3Min(s.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              [Revertir Canje (3 min)]
                            </button>
                          )}

                          {s.estado === 'EXPIRADO' && (
                            <span className="text-[11px] font-mono text-slate-400">
                              Expirado (&gt;30 días)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: MÓDULO 5C — REPORTE DE PRODUCCIÓN WEB POR DISCO (01 AL 16)
         ===================================================================== */}
      {tabActiva === 'PRODUCCION_DISCOS' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono text-[#912D26] font-bold">
                MÓDULO 5C · /admin/reportes · JUNTA DE SOCIOS Y CONTABILIDAD
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                Reporte Consolidado de Producción Web por Unidad (Disco 01 al
                Disco 16)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Detalle mensual y anual de boletos web vendidos por unidad,
                recaudación bruta generada y porcentaje de ocupación del bloque
                web (asientos 1 al 10).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
              <button
                type="button"
                onClick={descargarExcelProduccionDiscos}
                className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                Exportar Excel (TSV/CSV)
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                style={{ backgroundColor: '#912D26' }}
                className="px-3.5 py-2 text-xs font-bold text-white rounded-xl hover:opacity-95 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Descargar / Imprimir PDF Socios
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 pr-3">Unidad (Disco)</th>
                  <th className="py-2.5 px-3">Placa ANT / Chofer Titular</th>
                  <th className="py-2.5 px-3 text-right">
                    Boletos Web (Mensual)
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Recaudación Bruta (Mes)
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Ocupación Bloque Web (1–10)
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Boletos Web (Anual)
                  </th>
                  <th className="py-2.5 pl-3 text-right">
                    Recaudación Bruta (Anual)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filasProduccionDiscos.map((fila) => (
                  <tr key={fila.numeroDisco} className="hover:bg-slate-50/80">
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-900">
                      {fila.discoEtiqueta}
                    </td>
                    <td className="py-2.5 px-3">
                      <strong className="font-mono text-slate-900">
                        {fila.placa}
                      </strong>{' '}
                      · <span className="text-slate-600">{fila.choferTitular}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {fila.boletosWebVendidosMes} boletos
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      ${fila.recaudacionBrutaMesUSD.toFixed(2)} USD
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className="px-2 py-0.5 rounded bg-red-50 text-[#912D26] font-bold">
                        {fila.porcentajeOcupacionBloqueWeb.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {fila.boletosWebVendidosAnual.toLocaleString('es-EC')}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono font-bold text-slate-900">
                      ${fila.recaudacionBrutaAnualUSD.toFixed(2)} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          PESTAÑA 3: MÓDULO 5D (AUDITORÍA FONDOS EN CUSTODIA) Y 5E (LIQUIDACIÓN DÍA 1)
         ===================================================================== */}
      {tabActiva === 'AUDITORIA_BANCOS_Y_DIA1' && (
        <div className="space-y-6">
          {/* 5D: Panel de Conciliación Bancaria y Cuadre Exacto al Centavo */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-emerald-700 font-bold">
                  MÓDULO 5D · AUDITORÍA DE FONDOS EN CUSTODIA Y SALDOS PENDIENTES
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Cuadre Exacto del Extracto Bancario al Centavo para
                  Contabilidad
                </h3>
              </div>

              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 font-mono text-xs font-bold">
                Diferencia: ${cuadreBancario.diferenciaCentavosUSD.toFixed(2)}{' '}
                USD (Cuadre Exacto)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs">
              {cuadreBancario.formulaCuadreContadora}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">
                  Total Boletos Emitidos
                </span>
                <strong className="font-mono text-lg font-bold text-slate-900">
                  ${cuadreBancario.totalBoletosEmitidosUSD.toFixed(2)} USD
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-800 block">
                  Total Saldos Activos (Custodia)
                </span>
                <strong className="font-mono text-lg font-bold text-emerald-900">
                  ${cuadreBancario.totalSaldosActivosUSD.toFixed(2)} USD
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">
                  Total Saldos Expirados (&gt;30d)
                </span>
                <strong className="font-mono text-lg font-bold text-slate-800">
                  ${cuadreBancario.totalSaldosExpiradosUSD.toFixed(2)} USD
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 text-white">
                <span className="text-[11px] text-slate-300 block">
                  Total Extracto Banco
                </span>
                <strong className="font-mono text-xl font-bold text-emerald-400">
                  ${cuadreBancario.totalBancoExtractoUSD.toFixed(2)} USD
                </strong>
              </div>
            </div>
          </section>

          {/* 5E: Liquidación Mensual del Fee Tecnológico ($0.25) el Día 1 del Mes a las 00:05 AM */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-[#912D26] font-bold">
                  MÓDULO 5E · CRON DÍA 1 DEL MES (00:05 AM · 5 0 1 * *)
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Liquidación Mensual Automatizada del Fee Tecnológico ($0.25 ×
                  Boletos CONFIRMADO)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Calcula exclusivamente los boletos en estado{' '}
                  <code className="font-mono">CONFIRMADO</code> ($0.00 sobre
                  transferencias incompletas o sin boleto) y envía borrador de
                  pre-factura por correo a Gerencia.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={dispararCierreDia1Manual}
                  className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Simular Cierre Día 1 (00:05 AM)
                </button>

                {prefacturaDia1.estado !== 'APROBADA_POR_GERENCIA' ? (
                  <button
                    type="button"
                    onClick={manejarAprobarLiquidacionDia1}
                    style={{ backgroundColor: '#912D26' }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-xl hover:opacity-95 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    [Aprobar Liquidación]
                  </button>
                ) : (
                  <span className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-950 font-mono text-xs font-bold">
                    ✓ APROBADA POR GERENCIA
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Periodo / Ejecución Día 1
                </span>
                <strong className="font-mono text-slate-900 block mt-0.5">
                  {prefacturaDia1.periodoLiquidado}
                </strong>
                <span className="font-mono text-[10px] text-slate-500">
                  {prefacturaDia1.fechaEjecucionAutomatica}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Boletos CONFIRMADO Auditados
                </span>
                <strong className="font-mono text-lg text-slate-900 block mt-0.5">
                  {prefacturaDia1.boletosConfirmadosAuditados.toLocaleString(
                    'es-EC'
                  )}{' '}
                  boletos
                </strong>
                <span className="font-mono text-[10px] text-emerald-700">
                  Excluidos sin boleto:{' '}
                  {prefacturaDia1.transferenciasSinBoletoExcluidas} ($0.00)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[#912D26] font-bold block">
                  Total Borrador Pre-Factura ($0.25)
                </span>
                <strong className="font-mono text-xl font-bold text-[#912D26] block mt-0.5">
                  ${prefacturaDia1.totalPrefacturaFeeUSD.toFixed(2)} USD
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Notificación a Gerencia
                </span>
                <strong className="font-mono text-slate-900 block mt-0.5 truncate">
                  {prefacturaDia1.correoGerenciaDestino}
                </strong>
                <span className="font-mono text-[10px] text-emerald-700">
                  Estado: {prefacturaDia1.estado}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: MÓDULO 6 — CONSOLA DE CONFIGURACIÓN GLOBAL (/admin/configuracion)
         ===================================================================== */}
      {tabActiva === 'CONFIGURACION_GLOBAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 6A & 6B: Toggles de Canales de Cobro en 1-Clic + CRUD Cuentas Bancarias y Cargador QR */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-[#912D26] font-bold">
                  MÓDULO 6A & 6B · /admin/configuracion
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Control de Canales de Cobro (Toggles 1-Clic) y Gestor de
                  Cuentas / QR
                </h3>
              </div>
              <Settings className="w-5 h-5 text-slate-700" />
            </div>

            {/* 6A: Interruptores Independientes [ON / OFF] en Tiempo Real */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                A. Interruptores de Canales Bancarios en Checkout Público (Tiempo
                Real)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <strong className="text-xs text-slate-900 block">
                      Banco de Loja
                    </strong>
                    <span className="text-[11px] font-mono text-slate-500">
                      Estado:{' '}
                      {configGlobal.bancoDeLojaActivo ? 'ON (Activo)' : 'OFF'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      manejarToggleBanco(
                        'BANCO_DE_LOJA',
                        !configGlobal.bancoDeLojaActivo
                      )
                    }
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold text-white transition-colors ${
                      configGlobal.bancoDeLojaActivo
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-slate-500 hover:bg-slate-600'
                    }`}
                  >
                    {configGlobal.bancoDeLojaActivo ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <strong className="text-xs text-slate-900 block">
                      Banco Pichincha / Deuna!
                    </strong>
                    <span className="text-[11px] font-mono text-slate-500">
                      Estado:{' '}
                      {configGlobal.bancoPichinchaDeunaActivo
                        ? 'ON (Activo)'
                        : 'OFF'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      manejarToggleBanco(
                        'BANCO_PICHINCHA',
                        !configGlobal.bancoPichinchaDeunaActivo
                      )
                    }
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold text-white transition-colors ${
                      configGlobal.bancoPichinchaDeunaActivo
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-slate-500 hover:bg-slate-600'
                    }`}
                  >
                    {configGlobal.bancoPichinchaDeunaActivo ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* 6B: Gestor CRUD de Cuentas Bancarias y Cargador de Imágenes QR */}
            <form
              onSubmit={manejarGuardarCuentaBancaria}
              className="space-y-3 pt-3 border-t border-slate-100"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                B. Gestor de Cuentas Bancarias y Cargador de Códigos QR Oficiales
              </h4>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Seleccionar Cuenta Bancaria a Configurar
                </label>
                <select
                  value={cuentaEditId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCuentaEditId(id);
                    const encontrada = configGlobal.cuentasBancarias.find(
                      (c) => c.id === id
                    );
                    if (encontrada) {
                      setNumeroCuentaInput(encontrada.numeroCuenta);
                      setRucTitularInput(encontrada.rucTitular);
                      setTipoCuentaInput(encontrada.tipoCuenta);
                      setTitularInput(encontrada.titularCuenta);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {configGlobal.cuentasBancarias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombreMostrar} — #{c.numeroCuenta} ({c.tipoCuenta})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Número de Cuenta
                  </label>
                  <input
                    type="text"
                    value={numeroCuentaInput}
                    onChange={(e) => setNumeroCuentaInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    RUC Institucional
                  </label>
                  <input
                    type="text"
                    value={rucTitularInput}
                    onChange={(e) => setRucTitularInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Tipo de Cuenta
                  </label>
                  <select
                    value={tipoCuentaInput}
                    onChange={(e) =>
                      setTipoCuentaInput(
                        e.target.value as
                          | 'Cuenta Corriente'
                          | 'Cuenta de Ahorros'
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                    <option value="Cuenta de Ahorros">Cuenta de Ahorros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Razón Social / Titular de la Cuenta
                </label>
                <input
                  type="text"
                  value={titularInput}
                  onChange={(e) => setTitularInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              {cuentaSeleccionada && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={cuentaSeleccionada.qrImagenUrl}
                      alt={cuentaSeleccionada.nombreMostrar}
                      className="w-14 h-14 rounded-lg border border-slate-300 bg-white object-contain"
                    />
                    <div className="text-xs">
                      <strong className="text-slate-900 block">
                        Código QR Oficial ({cuentaSeleccionada.nombreMostrar})
                      </strong>
                      <span className="text-[11px] text-slate-500">
                        Suba una nueva imagen PNG/SVG para actualizar el QR en
                        el checkout.
                      </span>
                    </div>
                  </div>
                  <label className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir QR</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        manejarSubirArchivoQr(cuentaSeleccionada, e)
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <button
                type="submit"
                style={{ backgroundColor: '#912D26' }}
                className="w-full min-h-[44px] py-2.5 px-4 text-xs font-bold text-white rounded-xl hover:opacity-95 transition-opacity"
              >
                Guardar Cuenta Bancaria y Código QR
              </button>
            </form>
          </section>

          {/* 6C & 6D: WhatsApp / Gateway VPS y Respaldo Automático SQL 23:50 PM */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <form onSubmit={manejarGuardarSoporteYBackup} className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono text-emerald-700 font-bold">
                    MÓDULO 6C & 6D · WHATSAPP GATEWAY Y BACKUP SQL (23:50 PM)
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Configuración de WhatsApp / Soporte y Respaldo Nocturno SQL
                  </h3>
                </div>
                <Database className="w-5 h-5 text-slate-700" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    WhatsApp Oficial de Soporte Vilcabambaturis
                  </label>
                  <input
                    type="text"
                    value={whatsappSoporteInput}
                    onChange={(e) => setWhatsappSoporteInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Correo Institucional Gerencia / Sistemas (Backup 23:50 PM)
                  </label>
                  <input
                    type="email"
                    value={emailDestinoInput}
                    onChange={(e) => setEmailDestinoInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Endpoint Evolution API / Gateway VPS WhatsApp
                  </label>
                  <input
                    type="text"
                    value={gatewayUrlInput}
                    onChange={(e) => setGatewayUrlInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Token de Conexión API WhatsApp
                  </label>
                  <input
                    type="password"
                    value={gatewayTokenInput}
                    onChange={(e) => setGatewayTokenInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Guardar Parámetros de WhatsApp y Correo de Respaldo SQL
              </button>
            </form>

            {/* Ejecución y Bitácora del Cron Job Nocturno 23:50 PM */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  D. Respaldo Automático Nocturno (Dump SQL Encriptado · 23:50
                  PM)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ejecutandoBackup}
                    onClick={() => dispararCronRespaldoManual(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {ejecutandoBackup
                        ? 'Generando Dump SQL...'
                        : 'Ejecutar Backup 23:50 PM'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispararCronRespaldoManual(true)}
                    className="px-2.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                  >
                    Probar 401
                  </button>
                </div>
              </div>

              {mensajeCron && (
                <div
                  className={`p-3 rounded-lg border text-xs font-mono ${
                    mensajeCron.tipo === 'ok'
                      ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
                      : 'bg-red-950 text-red-100 border-red-800'
                  }`}
                >
                  {mensajeCron.texto}
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {historialRespaldos.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <strong className="font-mono text-slate-900 block truncate">
                        {log.archivoNombre}
                      </strong>
                      <span className="font-mono text-[10px] text-slate-500">
                        Destino: {log.correoDestinatario} · {log.estado}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => descargarDumpSqlArchivo(log)}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shrink-0"
                    >
                      SQL
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
