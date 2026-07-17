"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type ClienteSaldoAnticipado = {
  id: number;
  nombre: string;
  modalidadCuenta: "SALDO_ANTICIPADO";
  usaSaldoAnticipado: boolean;
  fechaInicioSaldo: string | null;
  fechaInicioCuenta: string | null;
};

type ResumenSaldoAnticipado = {
  saldoInicial: number;

  totalAbonos: number;
  totalAnticipos: number;
  totalAjustesCredito: number;

  totalTrabajos: number;
  totalServiciosDescontados: number;
  cantidadTrabajos: number;

  totalAjustesDebito: number;
  totalDevoluciones: number;

  totalCreditos: number;
  totalDebitos: number;

  saldoFinal: number;
  saldoPendiente: number;
  saldoAFavor: number;
  saldoDisponible: number;
};

type MovimientoCuenta = {
  id: string;
  referenciaId: number;

  fecha: string;

  origen:
    | "MOVIMIENTO"
    | "TRABAJO";

  tipo: string;

  naturaleza:
    | "CREDITO"
    | "DEBITO";

  concepto: string;
  descripcion: string;

  cliente: string;

  edificio: string | null;
  unidad: string | null;
  tipoUnidad: string | null;
  tipoTrabajo: string | null;

  credito: number;
  debito: number;

  referencia: string | null;
  notas: string | null;

  saldo: number;
};

type EstadoCuentaResponse = {
  status: "success" | "fail";
  message?: string;

  cliente?: ClienteSaldoAnticipado;

  resumen?: ResumenSaldoAnticipado;

  movimientos?: MovimientoCuenta[];
};

type MovimientoResponse = {
  status: "success" | "fail";
  message?: string;
};

type Props = {
  clienteId: number;
};

function getTodayInputValue() {
  const today = new Date();

  const offset =
    today.getTimezoneOffset();

  return new Date(
    today.getTime() -
      offset * 60 * 1000
  )
    .toISOString()
    .split("T")[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(Number(value || 0));
}

function formatDate(
  fecha: string | null
) {
  if (!fecha) return "—";

  const [
    year,
    month,
    day,
  ] = fecha.split("-");

  return `${month}/${day}/${year}`;
}

function formatTipoTrabajo(
  tipo: string | null
) {
  if (!tipo) return null;

  const etiquetas: Record<
    string,
    string
  > = {
    LIMPIEZA_INICIAL:
      "Limpieza inicial",

    LIMPIEZA:
      "Limpieza",

    EXTRA:
      "Extra",

    REPASO_LIMPIEZA:
      "Repaso",
  };

  return (
    etiquetas[tipo] ||
    tipo.replaceAll("_", " ")
  );
}

function obtenerTituloMovimiento(
  movimiento: MovimientoCuenta
) {
  if (
    movimiento.origen ===
    "TRABAJO"
  ) {
    const tipoTrabajo =
      formatTipoTrabajo(
        movimiento.tipoTrabajo
      );

    return (
      tipoTrabajo ||
      "Servicio de limpieza"
    );
  }

  return movimiento.concepto;
}

function obtenerDetalleMovimiento(
  movimiento: MovimientoCuenta
) {
  if (
    movimiento.origen ===
    "TRABAJO"
  ) {
    const ubicacion = [
      movimiento.edificio,
      movimiento.unidad,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      ubicacion ||
      movimiento.descripcion
    );
  }

  return (
    movimiento.referencia ||
    movimiento.descripcion
  );
}

export default function DetalleSaldoAnticipado({
  clienteId,
}: Props) {
  const [
    cliente,
    setCliente,
  ] =
    useState<ClienteSaldoAnticipado | null>(
      null
    );

  const [
    resumen,
    setResumen,
  ] =
    useState<ResumenSaldoAnticipado | null>(
      null
    );

  const [
    movimientos,
    setMovimientos,
  ] = useState<
    MovimientoCuenta[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mostrarFormulario,
    setMostrarFormulario,
  ] = useState(false);

  const [
    fechaAnticipo,
    setFechaAnticipo,
  ] = useState(
    getTodayInputValue()
  );

  const [
    valorAnticipo,
    setValorAnticipo,
  ] = useState("");

  const [
    conceptoAnticipo,
    setConceptoAnticipo,
  ] = useState(
    "Advance payment"
  );

  const [
    referenciaAnticipo,
    setReferenciaAnticipo,
  ] = useState("");

  const [
    notasAnticipo,
    setNotasAnticipo,
  ] = useState("");

  const cargarDatos =
    useCallback(async () => {
      if (
        !Number.isInteger(
          clienteId
        ) ||
        clienteId <= 0
      ) {
        setError(
          "El cliente indicado no es válido."
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `/api/lp/estado-cuenta-cliente?clienteId=${clienteId}`,
            {
              cache:
                "no-store",
            }
          );

        const data: EstadoCuentaResponse =
          await response.json();

        if (
          !response.ok ||
          data.status !==
            "success"
        ) {
          throw new Error(
            data.message ||
              "No fue posible cargar el estado de cuenta."
          );
        }

        if (
          !data.cliente
            ?.usaSaldoAnticipado
        ) {
          throw new Error(
            "Este cliente no utiliza saldo anticipado."
          );
        }

        setCliente(
          data.cliente
        );

        setResumen(
          data.resumen ||
            null
        );

        setMovimientos(
          data.movimientos ||
            []
        );
      } catch (error) {
        console.error(
          "Error cargando saldo anticipado:",
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

  const limpiarFormulario =
    () => {
      setFechaAnticipo(
        getTodayInputValue()
      );

      setValorAnticipo(
        ""
      );

      setConceptoAnticipo(
        "Advance payment"
      );

      setReferenciaAnticipo(
        ""
      );

      setNotasAnticipo(
        ""
      );
    };

  const registrarAnticipo =
    async () => {
      const valorNumerico =
        Number(valorAnticipo);

      if (
        !fechaAnticipo ||
        !Number.isFinite(
          valorNumerico
        ) ||
        valorNumerico <= 0
      ) {
        alert(
          "Debes indicar una fecha y un valor mayor que cero."
        );

        return;
      }

      if (
        !conceptoAnticipo.trim()
      ) {
        alert(
          "Debes ingresar un concepto."
        );

        return;
      }

      try {
        setSaving(true);

        const response =
          await fetch(
            "/api/lp/movimientos-clientes",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  clienteId,

                  fecha:
                    fechaAnticipo,

                  tipo:
                    "ABONO",

                  valor:
                    valorNumerico,

                  concepto:
                    conceptoAnticipo.trim(),

                  referencia:
                    referenciaAnticipo.trim(),

                  notas:
                    notasAnticipo.trim(),
                }),
            }
          );

        const data: MovimientoResponse =
          await response.json();

        if (
          !response.ok ||
          data.status !==
            "success"
        ) {
          alert(
            data.message ||
              "No fue posible registrar el anticipo."
          );

          return;
        }

        limpiarFormulario();

        setMostrarFormulario(
          false
        );

        await cargarDatos();
      } catch (error) {
        console.error(
          "Error registrando anticipo:",
          error
        );

        alert(
          "No fue posible registrar el anticipo."
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-lp-navy">
          Cargando saldo anticipado...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error &&
        cliente &&
        resumen && (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-lp-navy/50">
                  Cuenta de cliente
                </p>

                <h1 className="mt-1 text-2xl font-bold text-lp-navy">
                  {cliente.nombre}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-lp-gold/30 bg-lp-gold/10 px-3 py-1 text-xs font-bold text-lp-navy">
                    Saldo anticipado
                  </span>

                  <span className="text-xs text-lp-navy/60">
                    Servicios descontados
                    desde{" "}
                    {formatDate(
                      cliente.fechaInicioSaldo
                    )}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarFormulario(
                    (actual) =>
                      !actual
                  )
                }
                className="rounded-xl bg-lp-gold px-5 py-3 text-sm font-semibold text-white"
              >
                {mostrarFormulario
                  ? "Cerrar formulario"
                  : "Registrar anticipo"}
              </button>
            </header>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ResumenCard
                label="Anticipos recibidos"
                value={formatMoney(
                  resumen.totalAnticipos
                )}
                valueClassName="text-green-700"
              />

              <ResumenCard
                label="Servicios descontados"
                value={formatMoney(
                  resumen.totalServiciosDescontados
                )}
              />

              <ResumenCard
                label="Saldo disponible"
                value={formatMoney(
                  resumen.saldoDisponible
                )}
                valueClassName={
                  resumen.saldoDisponible >
                  0
                    ? "text-green-700"
                    : "text-lp-navy"
                }
                destacado={
                  resumen.saldoDisponible >
                  0
                }
              />

              <ResumenCard
                label="Pendiente por cobrar"
                value={formatMoney(
                  resumen.saldoPendiente
                )}
                valueClassName={
                  resumen.saldoPendiente >
                  0
                    ? "text-red-600"
                    : "text-lp-navy"
                }
                alerta={
                  resumen.saldoPendiente >
                  0
                }
              />
            </section>

            {resumen.saldoPendiente >
              0 && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  Anticipo agotado
                </p>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-red-700">
                      Hay{" "}
                      {formatMoney(
                        resumen.saldoPendiente
                      )}{" "}
                      pendiente por cobrar
                    </h2>

                    <p className="mt-1 text-sm text-red-700/80">
                      Los servicios continuaron
                      registrándose después de
                      agotarse el saldo disponible.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarFormulario(
                        true
                      )
                    }
                    className="w-fit rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Registrar nuevo anticipo
                  </button>
                </div>
              </section>
            )}

            {mostrarFormulario && (
              <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                <div>
                  <h2 className="font-bold text-lp-navy">
                    Registrar anticipo
                  </h2>

                  <p className="mt-1 text-xs text-lp-navy/60">
                    El valor se sumará
                    automáticamente al saldo
                    disponible del cliente.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <CampoFecha
                    label="Fecha"
                    value={
                      fechaAnticipo
                    }
                    onChange={
                      setFechaAnticipo
                    }
                  />

                  <CampoNumero
                    label="Valor"
                    value={
                      valorAnticipo
                    }
                    onChange={
                      setValorAnticipo
                    }
                  />

                  <CampoTexto
                    label="Concepto"
                    value={
                      conceptoAnticipo
                    }
                    onChange={
                      setConceptoAnticipo
                    }
                  />

                  <CampoTexto
                    label="Referencia"
                    value={
                      referenciaAnticipo
                    }
                    onChange={
                      setReferenciaAnticipo
                    }
                    placeholder="Zelle, ACH..."
                  />

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={
                        registrarAnticipo
                      }
                      disabled={
                        saving
                      }
                      className="w-full rounded-xl bg-lp-gold px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving
                        ? "Guardando..."
                        : "Registrar anticipo"}
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <CampoTexto
                    label="Notas"
                    value={
                      notasAnticipo
                    }
                    onChange={
                      setNotasAnticipo
                    }
                    placeholder="Notas opcionales..."
                  />
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="font-bold text-lp-navy">
                    Historial de movimientos
                  </h2>

                  <p className="mt-1 text-xs text-lp-navy/60">
                    Anticipos, ajustes y
                    servicios descontados en
                    orden cronológico.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-lp-light px-3 py-1 text-xs font-bold text-lp-navy">
                    {
                      movimientos.length
                    }{" "}
                    movimientos
                  </span>

                  <button
                    type="button"
                    onClick={
                      cargarDatos
                    }
                    className="rounded-lg border px-3 py-2 text-xs font-semibold text-lp-navy"
                  >
                    Actualizar
                  </button>
                </div>
              </div>

              {movimientos.length ===
              0 ? (
                <div className="p-8 text-center">
                  <p className="font-semibold text-lp-navy">
                    No hay movimientos
                  </p>

                  <p className="mt-1 text-sm text-lp-navy/60">
                    Registra el primer
                    anticipo para comenzar.
                  </p>
                </div>
              ) : (
                <>
                  <MovimientosDesktop
                    movimientos={
                      movimientos
                    }
                  />

                  <MovimientosMobile
                    movimientos={
                      movimientos
                    }
                  />
                </>
              )}
            </section>
          </>
        )}
    </div>
  );
}

function MovimientosDesktop({
  movimientos,
}: {
  movimientos: MovimientoCuenta[];
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm text-lp-navy">
        <thead className="bg-lp-navy text-white">
          <tr>
            <th className="px-4 py-3 text-left">
              Fecha
            </th>

            <th className="px-4 py-3 text-left">
              Movimiento
            </th>

            <th className="px-4 py-3 text-left">
              Detalle
            </th>

            <th className="px-4 py-3 text-right">
              Crédito
            </th>

            <th className="px-4 py-3 text-right">
              Débito
            </th>

            <th className="px-4 py-3 text-right">
              Saldo
            </th>
          </tr>
        </thead>

        <tbody>
          {movimientos.map(
            (movimiento) => (
              <tr
                key={
                  movimiento.id
                }
                className="border-b last:border-b-0"
              >
                <td className="whitespace-nowrap px-4 py-4">
                  {formatDate(
                    movimiento.fecha
                  )}
                </td>

                <td className="px-4 py-4">
                  <p className="font-semibold">
                    {obtenerTituloMovimiento(
                      movimiento
                    )}
                  </p>

                  <p className="mt-0.5 text-xs text-lp-navy/50">
                    {movimiento.origen ===
                    "TRABAJO"
                      ? "Servicio"
                      : "Movimiento financiero"}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <p>
                    {obtenerDetalleMovimiento(
                      movimiento
                    )}
                  </p>

                  {movimiento.notas && (
                    <p className="mt-1 text-xs text-lp-navy/50">
                      {
                        movimiento.notas
                      }
                    </p>
                  )}
                </td>

                <td className="px-4 py-4 text-right font-bold text-green-700">
                  {movimiento.credito >
                  0
                    ? formatMoney(
                        movimiento.credito
                      )
                    : "—"}
                </td>

                <td className="px-4 py-4 text-right font-bold text-red-600">
                  {movimiento.debito >
                  0
                    ? formatMoney(
                        movimiento.debito
                      )
                    : "—"}
                </td>

                <td
                  className={`px-4 py-4 text-right font-bold ${
                    movimiento.saldo <
                    0
                      ? "text-red-600"
                      : "text-lp-navy"
                  }`}
                >
                  {formatMoney(
                    movimiento.saldo
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function MovimientosMobile({
  movimientos,
}: {
  movimientos: MovimientoCuenta[];
}) {
  return (
    <div className="divide-y lg:hidden">
      {movimientos.map(
        (movimiento) => (
          <article
            key={movimiento.id}
            className="space-y-3 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-lp-navy/50">
                  {formatDate(
                    movimiento.fecha
                  )}
                </p>

                <h3 className="mt-1 font-bold text-lp-navy">
                  {obtenerTituloMovimiento(
                    movimiento
                  )}
                </h3>

                <p className="mt-1 text-sm text-lp-navy/60">
                  {obtenerDetalleMovimiento(
                    movimiento
                  )}
                </p>
              </div>

              <p
                className={`whitespace-nowrap text-base font-bold ${
                  movimiento.credito >
                  0
                    ? "text-green-700"
                    : "text-red-600"
                }`}
              >
                {movimiento.credito >
                0
                  ? `+${formatMoney(
                      movimiento.credito
                    )}`
                  : `-${formatMoney(
                      movimiento.debito
                    )}`}
              </p>
            </div>

            {movimiento.notas && (
              <div className="rounded-xl bg-lp-light p-3 text-xs text-lp-navy/70">
                {movimiento.notas}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-lp-light p-3">
              <p className="text-xs font-semibold text-lp-navy/60">
                Saldo después del
                movimiento
              </p>

              <p
                className={`font-bold ${
                  movimiento.saldo <
                  0
                    ? "text-red-600"
                    : "text-lp-navy"
                }`}
              >
                {formatMoney(
                  movimiento.saldo
                )}
              </p>
            </div>
          </article>
        )
      )}
    </div>
  );
}

function CampoFecha({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
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
          onChange(
            event.target.value
          )
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
  onChange: (
    value: string
  ) => void;
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
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
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
  onChange: (
    value: string
  ) => void;
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
          onChange(
            event.target.value
          )
        }
        placeholder="0.00"
        className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
      />
    </div>
  );
}

function ResumenCard({
  label,
  value,
  valueClassName = "text-lp-navy",
  destacado = false,
  alerta = false,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
  destacado?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-sm ${
        alerta
          ? "border-red-200 bg-red-50"
          : destacado
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