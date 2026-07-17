"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";


type CicloTipo =
  | "DIARIO"
  | "SEMANAL"
  | "QUINCENAL"
  | "MENSUAL"
  | "PERSONALIZADO";

type CicloEstado =
  | "SIN_MOVIMIENTOS"
  | "SIN_PAGO"
  | "PAGO_PARCIAL"
  | "CONCILIADO"
  | "SALDO_A_FAVOR";

type Cliente = {
  id: number;
  nombre: string;
  fechaInicioCuenta?: string | null;
};

type ResumenEstadoCuenta = {
  saldoInicial: number;
  totalAbonos: number;
  totalAjustesCredito: number;
  totalTrabajos: number;
  cantidadTrabajos: number;
  totalAjustesDebito: number;
  totalDevoluciones: number;
  totalCreditos: number;
  totalDebitos: number;
  saldoFinal: number;
  saldoPendiente: number;
  saldoAFavor: number;
};

type TrabajoCiclo = {
  id: number;
  fecha: string | null;
  edificio: string;
  unidad: string;
  tipoUnidad: string | null;
  tipoTrabajo: string;
  precio: number;
  notas: string | null;
};

type PagoAplicado = {
  id: number;
  movimientoId: number;
  fecha: string | null;
  tipo: string;
  concepto: string;
  referencia: string | null;
  valorPago: number;
  valorAplicado: number;
  notas: string | null;
};

type Ciclo = {
  id: number;
  clienteId: number;
  tipo: CicloTipo;
  fechaInicio: string | null;
  fechaFin: string | null;
  concepto: string | null;
  notas: string | null;
  cantidadTrabajos: number;
  totalTrabajado: number;
  totalAplicado: number;
  diferencia: number;
  saldoPendiente: number;
  saldoAFavor: number;
  estado: CicloEstado;
  trabajos: TrabajoCiclo[];
  pagosAplicados: PagoAplicado[];
};

type PagoDisponible = {
  id: number;
  fecha: string | null;
  tipo: string;
  concepto: string;
  referencia: string | null;
  valor: number;
  totalAplicado: number;
  saldoDisponible: number;
  notas: string | null;
};

type EstadoCuentaResponse = {
  status: "success" | "fail";
  message?: string;
  cliente?: Cliente;
  resumen?: ResumenEstadoCuenta;
};

type CiclosResponse = {
  status: "success" | "fail";
  message?: string;
  cliente?: Cliente;
  ciclos?: Ciclo[];
  pagosDisponibles?: PagoDisponible[];
};

type ApiResponse = {
  status: "success" | "fail";
  message?: string;
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();

  return new Date(
    today.getTime() - offset * 60 * 1000
  )
    .toISOString()
    .split("T")[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(fecha: string | null) {
  if (!fecha) return "—";

  const [year, month, day] = fecha.split("-");

  return `${month}/${day}/${year}`;
}

function formatTipoCiclo(tipo: CicloTipo) {
  const etiquetas: Record<CicloTipo, string> = {
    DIARIO: "Diario",
    SEMANAL: "Semanal",
    QUINCENAL: "Quincenal",
    MENSUAL: "Mensual",
    PERSONALIZADO: "Personalizado",
  };

  return etiquetas[tipo];
}

function formatTipoTrabajo(tipo: string) {
  const etiquetas: Record<string, string> = {
    LIMPIEZA_INICIAL: "Limpieza inicial",
    LIMPIEZA: "Limpieza",
    EXTRA: "Extra",
    REPASO_LIMPIEZA: "Repaso",
  };

  return etiquetas[tipo] || tipo.replaceAll("_", " ");
}

function obtenerEstadoCiclo(estado: CicloEstado) {
  switch (estado) {
    case "CONCILIADO":
      return {
        label: "Conciliado",
        className:
          "border-green-200 bg-green-50 text-green-700",
      };

    case "PAGO_PARCIAL":
      return {
        label: "Pago parcial",
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
      };

    case "SIN_PAGO":
      return {
        label: "Sin pago",
        className:
          "border-red-200 bg-red-50 text-red-700",
      };

    case "SALDO_A_FAVOR":
      return {
        label: "Saldo a favor",
        className:
          "border-blue-200 bg-blue-50 text-blue-700",
      };

    default:
      return {
        label: "Sin movimientos",
        className:
          "border-gray-200 bg-gray-50 text-gray-600",
      };
  }
}

export default function DetalleCuentaCiclos() {
  const params = useParams();

  const clienteIdParam = Array.isArray(params.clienteId)
    ? params.clienteId[0]
    : params.clienteId;

  const clienteId = Number(clienteIdParam);

  const [cliente, setCliente] =
    useState<Cliente | null>(null);

  const [resumen, setResumen] =
    useState<ResumenEstadoCuenta | null>(null);

  const [ciclos, setCiclos] = useState<Ciclo[]>([]);

  const [pagosDisponibles, setPagosDisponibles] =
    useState<PagoDisponible[]>([]);

  const [cicloSeleccionadoId, setCicloSeleccionadoId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /*
   * Formulario de ciclo.
   */
  const [tipoCiclo, setTipoCiclo] =
    useState<CicloTipo>("QUINCENAL");

  const [fechaInicioCiclo, setFechaInicioCiclo] =
    useState("");

  const [fechaFinCiclo, setFechaFinCiclo] =
    useState("");

  const [conceptoCiclo, setConceptoCiclo] =
    useState("");

  const [notasCiclo, setNotasCiclo] =
    useState("");

  /*
   * Formulario de pago.
   */
  const [fechaPago, setFechaPago] =
    useState(getTodayInputValue());

  const [valorPago, setValorPago] = useState("");
  const [conceptoPago, setConceptoPago] =
    useState("Payment received");

  const [referenciaPago, setReferenciaPago] =
    useState("");

  const [notasPago, setNotasPago] =
    useState("");

  /*
   * Aplicación de pagos.
   */
  const [pagoSeleccionadoId, setPagoSeleccionadoId] =
    useState<number | null>(null);

  const [valorAplicar, setValorAplicar] =
    useState("");

  const cargarDatos = useCallback(async () => {
    if (
      !Number.isInteger(clienteId) ||
      clienteId <= 0
    ) {
      setError("El cliente indicado no es válido.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        estadoResponse,
        ciclosResponse,
      ] = await Promise.all([
        fetch(
          `/api/lp/estado-cuenta-cliente?clienteId=${clienteId}`,
          {
            cache: "no-store",
          }
        ),

        fetch(
          `/api/lp/ciclos-clientes?clienteId=${clienteId}`,
          {
            cache: "no-store",
          }
        ),
      ]);

      const estadoData: EstadoCuentaResponse =
        await estadoResponse.json();

      const ciclosData: CiclosResponse =
        await ciclosResponse.json();

      if (
        !estadoResponse.ok ||
        estadoData.status !== "success"
      ) {
        throw new Error(
          estadoData.message ||
            "No fue posible cargar el estado de cuenta."
        );
      }

      if (
        !ciclosResponse.ok ||
        ciclosData.status !== "success"
      ) {
        throw new Error(
          ciclosData.message ||
            "No fue posible cargar los ciclos."
        );
      }

      setCliente(
        estadoData.cliente ||
          ciclosData.cliente ||
          null
      );

      setResumen(estadoData.resumen || null);

      const ciclosCargados =
        ciclosData.ciclos || [];

      setCiclos(ciclosCargados);

      setPagosDisponibles(
        ciclosData.pagosDisponibles || []
      );

      setCicloSeleccionadoId(
        (actual) => {
          if (
            actual &&
            ciclosCargados.some(
              (ciclo) => ciclo.id === actual
            )
          ) {
            return actual;
          }

          return ciclosCargados[0]?.id || null;
        }
      );
    } catch (error) {
      console.error(
        "Error cargando cuenta del cliente:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar la cuenta."
      );
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const cicloSeleccionado = useMemo(() => {
    return (
      ciclos.find(
        (ciclo) =>
          ciclo.id === cicloSeleccionadoId
      ) || null
    );
  }, [ciclos, cicloSeleccionadoId]);

  const pagoSeleccionado = useMemo(() => {
    return (
      pagosDisponibles.find(
        (pago) =>
          pago.id === pagoSeleccionadoId
      ) || null
    );
  }, [
    pagosDisponibles,
    pagoSeleccionadoId,
  ]);

  const limpiarFormularioCiclo = () => {
    setTipoCiclo("QUINCENAL");
    setFechaInicioCiclo("");
    setFechaFinCiclo("");
    setConceptoCiclo("");
    setNotasCiclo("");
  };

  const crearCiclo = async () => {
    if (
      !fechaInicioCiclo ||
      !fechaFinCiclo
    ) {
      alert(
        "Debes seleccionar la fecha inicial y final."
      );
      return;
    }

    if (fechaInicioCiclo > fechaFinCiclo) {
      alert(
        "La fecha inicial no puede ser posterior a la final."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/lp/ciclos-clientes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clienteId,
            tipo: tipoCiclo,
            fechaInicio: fechaInicioCiclo,
            fechaFin: fechaFinCiclo,
            concepto: conceptoCiclo,
            notas: notasCiclo,
          }),
        }
      );

      const data: ApiResponse =
        await response.json();

      if (
        !response.ok ||
        data.status !== "success"
      ) {
        alert(
          data.message ||
            "No fue posible crear el ciclo."
        );
        return;
      }

      limpiarFormularioCiclo();
      await cargarDatos();
    } catch (error) {
      console.error(
        "Error creando ciclo:",
        error
      );

      alert(
        "No fue posible crear el ciclo."
      );
    } finally {
      setSaving(false);
    }
  };

  const eliminarCiclo = async (
    ciclo: Ciclo
  ) => {
    const confirmar = window.confirm(
      `¿Eliminar el ciclo ${formatDate(
        ciclo.fechaInicio
      )} – ${formatDate(ciclo.fechaFin)}?`
    );

    if (!confirmar) return;

    try {
      const response = await fetch(
        `/api/lp/ciclos-clientes?id=${ciclo.id}`,
        {
          method: "DELETE",
        }
      );

      const data: ApiResponse =
        await response.json();

      if (
        !response.ok ||
        data.status !== "success"
      ) {
        alert(
          data.message ||
            "No fue posible eliminar el ciclo."
        );
        return;
      }

      await cargarDatos();
    } catch (error) {
      console.error(
        "Error eliminando ciclo:",
        error
      );

      alert(
        "No fue posible eliminar el ciclo."
      );
    }
  };

  const limpiarFormularioPago = () => {
    setFechaPago(getTodayInputValue());
    setValorPago("");
    setConceptoPago("Payment received");
    setReferenciaPago("");
    setNotasPago("");
  };

  const registrarPago = async () => {
    const valorNumerico = Number(valorPago);

    if (
      !fechaPago ||
      !Number.isFinite(valorNumerico) ||
      valorNumerico <= 0
    ) {
      alert(
        "Debes indicar una fecha y un valor mayor que cero."
      );
      return;
    }

    if (!conceptoPago.trim()) {
      alert("Debes ingresar un concepto.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/lp/movimientos-clientes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clienteId,
            fecha: fechaPago,
            tipo: "ABONO",
            valor: valorNumerico,
            concepto: conceptoPago.trim(),
            referencia: referenciaPago.trim(),
            notas: notasPago.trim(),
          }),
        }
      );

      const data: ApiResponse =
        await response.json();

      if (
        !response.ok ||
        data.status !== "success"
      ) {
        alert(
          data.message ||
            "No fue posible registrar el pago."
        );
        return;
      }

      limpiarFormularioPago();
      await cargarDatos();
    } catch (error) {
      console.error(
        "Error registrando pago:",
        error
      );

      alert(
        "No fue posible registrar el pago."
      );
    } finally {
      setSaving(false);
    }
  };

  const seleccionarPago = (
    pagoId: number
  ) => {
    const pago = pagosDisponibles.find(
      (item) => item.id === pagoId
    );

    setPagoSeleccionadoId(pagoId);

    if (
      pago &&
      cicloSeleccionado
    ) {
      const sugerido = Math.min(
        pago.saldoDisponible,
        cicloSeleccionado.saldoPendiente
      );

      setValorAplicar(
        sugerido > 0
          ? String(sugerido)
          : ""
      );
    }
  };

  const aplicarPago = async () => {
    if (
      !cicloSeleccionado ||
      !pagoSeleccionado
    ) {
      alert(
        "Selecciona un ciclo y un pago disponible."
      );
      return;
    }

    const valorNumerico =
      Number(valorAplicar);

    if (
      !Number.isFinite(valorNumerico) ||
      valorNumerico <= 0
    ) {
      alert(
        "El valor aplicado debe ser mayor que cero."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/lp/aplicaciones-pagos-clientes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            movimientoId:
              pagoSeleccionado.id,

            cicloId:
              cicloSeleccionado.id,

            valorAplicado:
              valorNumerico,
          }),
        }
      );

      const data: ApiResponse =
        await response.json();

      if (
        !response.ok ||
        data.status !== "success"
      ) {
        alert(
          data.message ||
            "No fue posible aplicar el pago."
        );
        return;
      }

      setPagoSeleccionadoId(null);
      setValorAplicar("");

      await cargarDatos();
    } catch (error) {
      console.error(
        "Error aplicando pago:",
        error
      );

      alert(
        "No fue posible aplicar el pago."
      );
    } finally {
      setSaving(false);
    }
  };

  const eliminarAplicacion = async (
    aplicacion: PagoAplicado
  ) => {
    const confirmar = window.confirm(
      `¿Liberar ${formatMoney(
        aplicacion.valorAplicado
      )} de esta conciliación?`
    );

    if (!confirmar) return;

    try {
      const response = await fetch(
        `/api/lp/aplicaciones-pagos-clientes?id=${aplicacion.id}`,
        {
          method: "DELETE",
        }
      );

      const data: ApiResponse =
        await response.json();

      if (
        !response.ok ||
        data.status !== "success"
      ) {
        alert(
          data.message ||
            "No fue posible eliminar la aplicación."
        );
        return;
      }

      await cargarDatos();
    } catch (error) {
      console.error(
        "Error eliminando aplicación:",
        error
      );

      alert(
        "No fue posible eliminar la aplicación."
      );
    }
  };

  return (
    <div className="space-y-6">
      
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-lp-navy/50">
          Cuentas de clientes
        </p>

        <h1 className="mt-1 text-2xl font-bold text-lp-navy">
          {cliente?.nombre ||
            "Estado de cuenta"}
        </h1>

        <p className="mt-1 text-sm text-lp-navy/70">
          Conciliación de trabajos, pagos y anticipos
          por ciclos.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-lp-navy">
            Cargando estado de cuenta...
          </p>
        </div>
      ) : (
        <>
          {resumen && (
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <ResumenCard
                label="Total facturado"
                value={formatMoney(
                  resumen.totalTrabajos
                )}
              />

              <ResumenCard
                label="Pagos recibidos"
                value={formatMoney(
                  resumen.totalAbonos
                )}
                valueClassName="text-green-700"
              />

              <ResumenCard
                label="Cantidad de trabajos"
                value={
                  resumen.cantidadTrabajos
                }
              />

              <ResumenCard
                label="Ciclos creados"
                value={ciclos.length}
              />

              <ResumenCard
                label="Pendiente por cobrar"
                value={formatMoney(
                  resumen.saldoPendiente
                )}
                valueClassName={
                  resumen.saldoPendiente > 0
                    ? "text-red-600"
                    : "text-lp-navy"
                }
              />

              <ResumenCard
                label="Saldo a favor"
                value={formatMoney(
                  resumen.saldoAFavor
                )}
                valueClassName="text-green-700"
                destacado
              />
            </section>
          )}

          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="font-bold text-lp-navy">
                Crear ciclo de conciliación
              </h2>

              <p className="mt-1 text-xs text-lp-navy/60">
                Define el período que debe cubrir un pago.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <CampoSelect
                label="Tipo de ciclo"
                value={tipoCiclo}
                onChange={(value) =>
                  setTipoCiclo(
                    value as CicloTipo
                  )
                }
              >
                <option value="DIARIO">
                  Diario
                </option>
                <option value="SEMANAL">
                  Semanal
                </option>
                <option value="QUINCENAL">
                  Quincenal
                </option>
                <option value="MENSUAL">
                  Mensual
                </option>
                <option value="PERSONALIZADO">
                  Personalizado
                </option>
              </CampoSelect>

              <CampoFecha
                label="Desde"
                value={fechaInicioCiclo}
                onChange={
                  setFechaInicioCiclo
                }
              />

              <CampoFecha
                label="Hasta"
                value={fechaFinCiclo}
                onChange={setFechaFinCiclo}
              />

              <CampoTexto
                label="Concepto"
                value={conceptoCiclo}
                onChange={setConceptoCiclo}
                placeholder="Jul 1–15"
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={crearCiclo}
                  disabled={saving}
                  className="w-full rounded-xl bg-lp-gold px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Crear ciclo
                </button>
              </div>
            </div>

            <div className="mt-3">
              <CampoTexto
                label="Notas"
                value={notasCiclo}
                onChange={setNotasCiclo}
                placeholder="Notas opcionales..."
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-4 py-4 sm:px-5">
              <h2 className="font-bold text-lp-navy">
                Ciclos de conciliación
              </h2>

              <p className="mt-1 text-xs text-lp-navy/60">
                Selecciona un ciclo para revisar sus trabajos
                y pagos.
              </p>
            </div>

            {ciclos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-lp-navy">
                  No hay ciclos creados
                </p>

                <p className="mt-1 text-sm text-lp-navy/60">
                  Crea el primer período de conciliación.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {ciclos.map((ciclo) => (
                  <CicloFila
                    key={ciclo.id}
                    ciclo={ciclo}
                    seleccionado={
                      ciclo.id ===
                      cicloSeleccionadoId
                    }
                    onSeleccionar={() =>
                      setCicloSeleccionadoId(
                        ciclo.id
                      )
                    }
                    onEliminar={() =>
                      eliminarCiclo(ciclo)
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {cicloSeleccionado && (
            <>
              <ResumenCiclo
                ciclo={cicloSeleccionado}
              />

              <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="font-bold text-lp-navy">
                      Detalle trabajado
                    </h2>

                    <p className="mt-1 text-xs text-lp-navy/60">
                      Trabajos registrados dentro del ciclo.
                    </p>
                  </div>

                  <span className="rounded-full bg-lp-light px-3 py-1 text-sm font-bold text-lp-navy">
                    {
                      cicloSeleccionado.cantidadTrabajos
                    }
                  </span>
                </div>

                {cicloSeleccionado.trabajos.length ===
                0 ? (
                  <div className="p-8 text-center">
                    <p className="font-semibold text-lp-navy">
                      El ciclo no tiene trabajos
                    </p>
                  </div>
                ) : (
                  <DetalleTrabajos
                    trabajos={
                      cicloSeleccionado.trabajos
                    }
                  />
                )}
              </section>

              <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                <div>
                  <h2 className="font-bold text-lp-navy">
                    Registrar pago
                  </h2>

                  <p className="mt-1 text-xs text-lp-navy/60">
                    El pago quedará disponible hasta que
                    sea aplicado a uno o varios ciclos.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <CampoFecha
                    label="Fecha"
                    value={fechaPago}
                    onChange={setFechaPago}
                  />

                  <CampoNumero
                    label="Valor"
                    value={valorPago}
                    onChange={setValorPago}
                  />

                  <CampoTexto
                    label="Concepto"
                    value={conceptoPago}
                    onChange={
                      setConceptoPago
                    }
                  />

                  <CampoTexto
                    label="Referencia"
                    value={referenciaPago}
                    onChange={
                      setReferenciaPago
                    }
                    placeholder="ACH, Zelle..."
                  />

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={registrarPago}
                      disabled={saving}
                      className="w-full rounded-xl bg-lp-gold px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Registrar pago
                    </button>
                  </div>
                </div>

                <CampoTexto
                  label="Notas"
                  value={notasPago}
                  onChange={setNotasPago}
                  placeholder="Notas opcionales..."
                />
              </section>

              <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                <div>
                  <h2 className="font-bold text-lp-navy">
                    Aplicar pago al ciclo
                  </h2>

                  <p className="mt-1 text-xs text-lp-navy/60">
                    Puedes usar un pago reciente, un excedente
                    o un anticipo anterior.
                  </p>
                </div>

                {pagosDisponibles.length === 0 ? (
                  <div className="rounded-xl bg-lp-light p-4 text-sm text-lp-navy/70">
                    No hay pagos con saldo disponible.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-lp-navy">
                          Pago disponible
                        </label>

                        <select
                          value={
                            pagoSeleccionadoId ||
                            ""
                          }
                          onChange={(event) =>
                            seleccionarPago(
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
                        >
                          <option value="">
                            Seleccionar pago
                          </option>

                          {pagosDisponibles.map(
                            (pago) => (
                              <option
                                key={pago.id}
                                value={pago.id}
                              >
                                {formatDate(
                                  pago.fecha
                                )}{" "}
                                ·{" "}
                                {formatMoney(
                                  pago.saldoDisponible
                                )}{" "}
                                disponibles
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <CampoNumero
                        label="Valor a aplicar"
                        value={valorAplicar}
                        onChange={
                          setValorAplicar
                        }
                      />

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={aplicarPago}
                          disabled={
                            saving ||
                            !pagoSeleccionadoId
                          }
                          className="w-full rounded-xl bg-lp-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Aplicar al ciclo
                        </button>
                      </div>
                    </div>

                    {pagoSeleccionado && (
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-lp-light p-4 md:grid-cols-4">
                        <MiniItem
                          label="Pago"
                          value={formatMoney(
                            pagoSeleccionado.valor
                          )}
                        />

                        <MiniItem
                          label="Aplicado"
                          value={formatMoney(
                            pagoSeleccionado.totalAplicado
                          )}
                        />

                        <MiniItem
                          label="Disponible"
                          value={formatMoney(
                            pagoSeleccionado.saldoDisponible
                          )}
                        />

                        <MiniItem
                          label="Pendiente del ciclo"
                          value={formatMoney(
                            cicloSeleccionado.saldoPendiente
                          )}
                        />
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="border-b px-4 py-4 sm:px-5">
                  <h2 className="font-bold text-lp-navy">
                    Pagos aplicados
                  </h2>

                  <p className="mt-1 text-xs text-lp-navy/60">
                    Valores utilizados para conciliar este
                    ciclo.
                  </p>
                </div>

                {cicloSeleccionado.pagosAplicados
                  .length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="font-semibold text-lp-navy">
                      No hay pagos aplicados
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {cicloSeleccionado.pagosAplicados.map(
                      (pago) => (
                        <PagoAplicadoFila
                          key={pago.id}
                          pago={pago}
                          onEliminar={() =>
                            eliminarAplicacion(
                              pago
                            )
                          }
                        />
                      )
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CicloFila({
  ciclo,
  seleccionado,
  onSeleccionar,
  onEliminar,
}: {
  ciclo: Ciclo;
  seleccionado: boolean;
  onSeleccionar: () => void;
  onEliminar: () => void;
}) {
  const estado = obtenerEstadoCiclo(
    ciclo.estado
  );

  return (
    <article
      className={`space-y-3 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0 ${
        seleccionado
          ? "bg-lp-light"
          : "bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onSeleccionar}
        className="flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-lp-navy">
            {formatDate(
              ciclo.fechaInicio
            )}{" "}
            – {formatDate(ciclo.fechaFin)}
          </h3>

          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${estado.className}`}
          >
            {estado.label}
          </span>
        </div>

        <p className="mt-1 text-xs text-lp-navy/60">
          {formatTipoCiclo(ciclo.tipo)} ·{" "}
          {ciclo.cantidadTrabajos} trabajos ·{" "}
          {formatMoney(ciclo.totalTrabajado)}
        </p>
      </button>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <p className="font-bold text-lp-navy">
            {formatMoney(
              ciclo.totalAplicado
            )}
          </p>

          <p className="text-xs text-lp-navy/50">
            aplicado
          </p>
        </div>

        {ciclo.pagosAplicados.length ===
          0 && (
          <button
            type="button"
            onClick={onEliminar}
            className="rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-600"
          >
            Eliminar
          </button>
        )}
      </div>
    </article>
  );
}

function ResumenCiclo({
  ciclo,
}: {
  ciclo: Ciclo;
}) {
  const estado = obtenerEstadoCiclo(
    ciclo.estado
  );

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-lp-navy/50">
            Ciclo seleccionado
          </p>

          <h2 className="mt-1 text-xl font-bold text-lp-navy">
            {formatDate(ciclo.fechaInicio)} –{" "}
            {formatDate(ciclo.fechaFin)}
          </h2>

          <p className="mt-1 text-sm text-lp-navy/60">
            {formatTipoCiclo(ciclo.tipo)}
          </p>
        </div>

        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${estado.className}`}
        >
          {estado.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniItem
          label="Trabajos"
          value={ciclo.cantidadTrabajos}
        />

        <MiniItem
          label="Total trabajado"
          value={formatMoney(
            ciclo.totalTrabajado
          )}
        />

        <MiniItem
          label="Total aplicado"
          value={formatMoney(
            ciclo.totalAplicado
          )}
        />

        <MiniItem
          label="Pendiente"
          value={formatMoney(
            ciclo.saldoPendiente
          )}
        />
      </div>
    </section>
  );
}

function DetalleTrabajos({
  trabajos,
}: {
  trabajos: TrabajoCiclo[];
}) {
  const total = trabajos.reduce(
    (acc, trabajo) =>
      acc + trabajo.precio,
    0
  );

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm text-lp-navy">
          <thead className="bg-lp-navy text-white">
            <tr>
              <th className="px-4 py-3 text-left">
                Fecha
              </th>
              <th className="px-4 py-3 text-left">
                Edificio
              </th>
              <th className="px-4 py-3 text-left">
                Unidad
              </th>
              <th className="px-4 py-3 text-left">
                Tipo
              </th>
              <th className="px-4 py-3 text-left">
                Trabajo
              </th>
              <th className="px-4 py-3 text-right">
                Valor
              </th>
            </tr>
          </thead>

          <tbody>
            {trabajos.map((trabajo) => (
              <tr
                key={trabajo.id}
                className="border-b last:border-b-0"
              >
                <td className="px-4 py-4">
                  {formatDate(
                    trabajo.fecha
                  )}
                </td>

                <td className="px-4 py-4 font-semibold">
                  {trabajo.edificio}
                </td>

                <td className="px-4 py-4">
                  {trabajo.unidad}
                </td>

                <td className="px-4 py-4">
                  {trabajo.tipoUnidad || "—"}
                </td>

                <td className="px-4 py-4">
                  {formatTipoTrabajo(
                    trabajo.tipoTrabajo
                  )}
                </td>

                <td className="px-4 py-4 text-right font-bold">
                  {formatMoney(
                    trabajo.precio
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-lp-light">
            <tr>
              <td
                colSpan={5}
                className="px-4 py-4 text-right font-bold"
              >
                Total del ciclo
              </td>

              <td className="px-4 py-4 text-right text-lg font-bold">
                {formatMoney(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="divide-y lg:hidden">
        {trabajos.map((trabajo) => (
          <article
            key={trabajo.id}
            className="space-y-3 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-lp-navy/50">
                  {formatDate(
                    trabajo.fecha
                  )}
                </p>

                <h3 className="font-bold text-lp-navy">
                  {trabajo.edificio} ·{" "}
                  {trabajo.unidad}
                </h3>
              </div>

              <p className="font-bold text-lp-navy">
                {formatMoney(
                  trabajo.precio
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MiniItem
                label="Tipo de unidad"
                value={
                  trabajo.tipoUnidad ||
                  "—"
                }
              />

              <MiniItem
                label="Trabajo"
                value={formatTipoTrabajo(
                  trabajo.tipoTrabajo
                )}
              />
            </div>
          </article>
        ))}

        <div className="flex items-center justify-between bg-lp-light p-4">
          <p className="font-bold text-lp-navy">
            Total del ciclo
          </p>

          <p className="text-lg font-bold text-lp-navy">
            {formatMoney(total)}
          </p>
        </div>
      </div>
    </>
  );
}

function PagoAplicadoFila({
  pago,
  onEliminar,
}: {
  pago: PagoAplicado;
  onEliminar: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs text-lp-navy/50">
          {formatDate(pago.fecha)}
        </p>

        <h3 className="font-bold text-lp-navy">
          {pago.concepto}
        </h3>

        <p className="mt-0.5 text-xs text-lp-navy/60">
          {pago.referencia || "Sin referencia"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right">
          <p className="font-bold text-green-700">
            {formatMoney(
              pago.valorAplicado
            )}
          </p>

          <p className="text-xs text-lp-navy/50">
            de{" "}
            {formatMoney(pago.valorPago)}
          </p>
        </div>

        <button
          type="button"
          onClick={onEliminar}
          className="rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-600"
        >
          Liberar
        </button>
      </div>
    </article>
  );
}

function CampoFecha({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-lp-navy">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
      />
    </div>
  );
}

function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-lp-navy">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
      />
    </div>
  );
}

function CampoNumero({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-lp-navy">
        {label}
      </label>

      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder="0.00"
        className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
      />
    </div>
  );
}

function CampoSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-lp-navy">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
      >
        {children}
      </select>
    </div>
  );
}

function ResumenCard({
  label,
  value,
  valueClassName = "text-lp-navy",
  destacado = false,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-sm ${
        destacado
          ? "border-lp-gold/40 bg-lp-gold/10"
          : "border-lp-navy/10 bg-white"
      }`}
    >
      <p className="text-xs text-lp-navy/60">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-xl font-bold ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-lp-light p-3">
      <p className="text-xs text-lp-navy/60">
        {label}
      </p>

      <p className="mt-0.5 break-words font-bold text-lp-navy">
        {value}
      </p>
    </div>
  );
}