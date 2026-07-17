"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import ResumenNavigation from "@/app/components/lp/ResumenNavigation";

type EstadoCuenta =
  | "SIN_MOVIMIENTOS"
  | "CONCILIADO"
  | "PENDIENTE"
  | "SALDO_A_FAVOR";

type UltimoCiclo = {
  id: number;
  tipo:
    | "DIARIO"
    | "SEMANAL"
    | "QUINCENAL"
    | "MENSUAL"
    | "PERSONALIZADO";
  fechaInicio: string | null;
  fechaFin: string | null;
  totalTrabajado: number;
  totalAplicado: number;
  saldoPendiente: number;
  estado:
    | "SIN_PAGO"
    | "PAGO_PARCIAL"
    | "CONCILIADO";
};

type ClienteCuenta = {
  id: number;
  nombre: string;

  fechaPrimerTrabajo: string | null;
  fechaUltimoTrabajo: string | null;

  totalTrabajos: number;
  cantidadTrabajos: number;

  totalPagos: number;
  totalAjustesCredito: number;
  totalAjustesDebito: number;
  totalDevoluciones: number;

  totalCreditos: number;
  totalDebitos: number;

  saldoCuenta: number;
  saldoPendiente: number;
  saldoAFavor: number;

  totalPagosAplicados: number;
  pagosSinAplicar: number;

  cantidadCiclos: number;
  ciclosConciliados: number;
  ciclosPendientes: number;

  ultimoCiclo: UltimoCiclo | null;
  estadoCuenta: EstadoCuenta;
};

type ResumenGeneral = {
  totalFacturado: number;
  totalRecibido: number;
  totalPendiente: number;
  totalSaldoAFavor: number;
  totalPagosSinAplicar: number;
  clientesPendientes: number;
  clientesConSaldoAFavor: number;
};

type RespuestaClientes = {
  status: "success" | "fail";
  message?: string;
  resumen?: ResumenGeneral;
  clientes?: ClienteCuenta[];
};

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

function formatTipoCiclo(tipo: UltimoCiclo["tipo"]) {
  const etiquetas: Record<
    UltimoCiclo["tipo"],
    string
  > = {
    DIARIO: "Diario",
    SEMANAL: "Semanal",
    QUINCENAL: "Quincenal",
    MENSUAL: "Mensual",
    PERSONALIZADO: "Personalizado",
  };

  return etiquetas[tipo];
}

function obtenerPresentacionEstado(
  estado: EstadoCuenta
) {
  switch (estado) {
    case "PENDIENTE":
      return {
        label: "Pendiente",
        className:
          "border-red-200 bg-red-50 text-red-700",
      };

    case "SALDO_A_FAVOR":
      return {
        label: "Saldo a favor",
        className:
          "border-green-200 bg-green-50 text-green-700",
      };

    case "CONCILIADO":
      return {
        label: "Conciliado",
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

export default function SaldosClientesPage() {
  const [clientes, setClientes] = useState<
    ClienteCuenta[]
  >([]);

  const [resumen, setResumen] =
    useState<ResumenGeneral | null>(null);

  const [busqueda, setBusqueda] = useState("");

  const [estadoFiltro, setEstadoFiltro] =
    useState<EstadoCuenta | "TODOS">("TODOS");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/lp/saldos-clientes",
        {
          cache: "no-store",
        }
      );

      const data: RespuestaClientes =
        await response.json();

      if (
        !response.ok ||
        data.status !== "success"
      ) {
        throw new Error(
          data.message ||
            "No fue posible cargar las cuentas de clientes."
        );
      }

      setClientes(data.clientes || []);
      setResumen(data.resumen || null);
    } catch (error) {
      console.error(
        "Error cargando cuentas de clientes:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar las cuentas de clientes."
      );

      setClientes([]);
      setResumen(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  const clientesFiltrados = useMemo(() => {
    const termino =
      busqueda.trim().toLowerCase();

    return clientes.filter((cliente) => {
      const coincideBusqueda =
        !termino ||
        cliente.nombre
          .toLowerCase()
          .includes(termino);

      const coincideEstado =
        estadoFiltro === "TODOS" ||
        cliente.estadoCuenta === estadoFiltro;

      return (
        coincideBusqueda &&
        coincideEstado
      );
    });
  }, [
    clientes,
    busqueda,
    estadoFiltro,
  ]);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Cuentas de clientes
        </h1>

        <p className="mt-1 text-sm text-lp-navy/70">
          Controla trabajos realizados, pagos recibidos,
          ciclos conciliados y saldos pendientes.
        </p>
      </div>

      <ResumenNavigation />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && resumen && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResumenCard
            label="Total facturado"
            value={formatMoney(
              resumen.totalFacturado
            )}
          />

          <ResumenCard
            label="Total recibido"
            value={formatMoney(
              resumen.totalRecibido
            )}
            valueClassName="text-green-700"
          />

          <ResumenCard
            label="Pendiente por cobrar"
            value={formatMoney(
              resumen.totalPendiente
            )}
            valueClassName={
              resumen.totalPendiente > 0
                ? "text-red-600"
                : "text-lp-navy"
            }
            destacado={
              resumen.totalPendiente > 0
            }
          />

          <ResumenCard
            label="Saldo a favor"
            value={formatMoney(
              resumen.totalSaldoAFavor
            )}
            valueClassName="text-green-700"
          />
        </section>
      )}

      {!loading && resumen && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniResumenCard
            label="Clientes pendientes"
            value={resumen.clientesPendientes}
          />

          <MiniResumenCard
            label="Clientes con saldo a favor"
            value={
              resumen.clientesConSaldoAFavor
            }
          />

          <MiniResumenCard
            label="Pagos sin aplicar"
            value={formatMoney(
              resumen.totalPagosSinAplicar
            )}
          />
        </section>
      )}

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-bold text-lp-navy">
              Clientes
            </h2>

            <p className="mt-1 text-xs text-lp-navy/60">
              El saldo se calcula desde el primer trabajo
              registrado de cada cliente.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div>
              <label
                htmlFor="buscar-cliente"
                className="text-xs font-semibold text-lp-navy"
              >
                Buscar cliente
              </label>

              <input
                id="buscar-cliente"
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(event.target.value)
                }
                placeholder="Anna, We Host, IMD..."
                className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
              />
            </div>

            <div>
              <label
                htmlFor="estado-cliente"
                className="text-xs font-semibold text-lp-navy"
              >
                Estado
              </label>

              <select
                id="estado-cliente"
                value={estadoFiltro}
                onChange={(event) =>
                  setEstadoFiltro(
                    event.target.value as
                      | EstadoCuenta
                      | "TODOS"
                  )
                }
                className="mt-1 w-full rounded-xl border bg-white p-3 text-lp-navy"
              >
                <option value="TODOS">
                  Todos
                </option>

                <option value="PENDIENTE">
                  Pendientes
                </option>

                <option value="CONCILIADO">
                  Conciliados
                </option>

                <option value="SALDO_A_FAVOR">
                  Con saldo a favor
                </option>

                <option value="SIN_MOVIMIENTOS">
                  Sin movimientos
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold text-lp-navy">
              Estado general
            </h2>

            {!loading && (
              <p className="mt-1 text-xs text-lp-navy/60">
                {clientesFiltrados.length}{" "}
                {clientesFiltrados.length === 1
                  ? "cliente"
                  : "clientes"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={cargarClientes}
            disabled={loading}
            className="rounded-xl border border-lp-navy px-3 py-2 text-xs font-semibold text-lp-navy disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-lp-navy">
              Cargando cuentas...
            </p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-lp-navy">
              No encontramos clientes
            </p>

            <p className="mt-1 text-sm text-lp-navy/60">
              Prueba con otro término o estado.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-sm text-lp-navy">
                <thead className="bg-lp-navy text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      Cliente
                    </th>

                    <th className="px-4 py-3 text-right">
                      Facturado
                    </th>

                    <th className="px-4 py-3 text-right">
                      Recibido
                    </th>

                    <th className="px-4 py-3 text-right">
                      Saldo
                    </th>

                    <th className="px-4 py-3 text-left">
                      Ciclos
                    </th>

                    <th className="px-4 py-3 text-left">
                      Estado
                    </th>

                    <th className="px-4 py-3 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {clientesFiltrados.map(
                    (cliente) => (
                      <ClienteFila
                        key={cliente.id}
                        cliente={cliente}
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y xl:hidden">
              {clientesFiltrados.map(
                (cliente) => (
                  <ClienteCuentaCard
                    key={cliente.id}
                    cliente={cliente}
                  />
                )
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ClienteFila({
  cliente,
}: {
  cliente: ClienteCuenta;
}) {
  const estado =
    obtenerPresentacionEstado(
      cliente.estadoCuenta
    );

  return (
    <tr className="border-b last:border-b-0 hover:bg-lp-light/40">
      <td className="px-4 py-4">
        <p className="font-bold">
          {cliente.nombre}
        </p>

        <p className="mt-0.5 text-xs text-lp-navy/50">
          Desde{" "}
          {formatDate(
            cliente.fechaPrimerTrabajo
          )}
        </p>
      </td>

      <td className="px-4 py-4 text-right font-semibold">
        {formatMoney(
          cliente.totalTrabajos
        )}

        <p className="mt-0.5 text-xs font-normal text-lp-navy/50">
          {cliente.cantidadTrabajos} trabajos
        </p>
      </td>

      <td className="px-4 py-4 text-right font-semibold text-green-700">
        {formatMoney(cliente.totalPagos)}

        {cliente.pagosSinAplicar > 0 && (
          <p className="mt-0.5 text-xs font-normal text-amber-700">
            {formatMoney(
              cliente.pagosSinAplicar
            )} sin aplicar
          </p>
        )}
      </td>

      <td className="px-4 py-4 text-right">
        {cliente.saldoPendiente > 0 ? (
          <div>
            <p className="font-bold text-red-600">
              {formatMoney(
                cliente.saldoPendiente
              )}
            </p>

            <p className="mt-0.5 text-xs text-red-600/70">
              Por cobrar
            </p>
          </div>
        ) : cliente.saldoAFavor > 0 ? (
          <div>
            <p className="font-bold text-green-700">
              {formatMoney(
                cliente.saldoAFavor
              )}
            </p>

            <p className="mt-0.5 text-xs text-green-700/70">
              A favor
            </p>
          </div>
        ) : (
          <p className="font-bold text-lp-navy">
            {formatMoney(0)}
          </p>
        )}
      </td>

      <td className="px-4 py-4">
        <p className="font-semibold">
          {cliente.ciclosConciliados} /{" "}
          {cliente.cantidadCiclos}
        </p>

        <p className="mt-0.5 text-xs text-lp-navy/50">
          conciliados
        </p>

        {cliente.ultimoCiclo && (
          <p className="mt-1 text-xs text-lp-navy/60">
            {formatTipoCiclo(
              cliente.ultimoCiclo.tipo
            )}{" "}
            ·{" "}
            {formatDate(
              cliente.ultimoCiclo
                .fechaInicio
            )}
          </p>
        )}
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${estado.className}`}
        >
          {estado.label}
        </span>
      </td>

      <td className="px-4 py-4 text-right">
        <Link
          href={`/dashboard/lp/saldos-clientes/${cliente.id}`}
          className="inline-flex rounded-lg border border-lp-navy px-3 py-2 text-xs font-semibold text-lp-navy"
        >
          Ver estado
        </Link>
      </td>
    </tr>
  );
}

function ClienteCuentaCard({
  cliente,
}: {
  cliente: ClienteCuenta;
}) {
  const estado =
    obtenerPresentacionEstado(
      cliente.estadoCuenta
    );

  return (
    <article className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-lp-navy">
            {cliente.nombre}
          </h3>

          <p className="mt-0.5 text-xs text-lp-navy/50">
            Desde{" "}
            {formatDate(
              cliente.fechaPrimerTrabajo
            )}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${estado.className}`}
        >
          {estado.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniItem
          label="Facturado"
          value={formatMoney(
            cliente.totalTrabajos
          )}
        />

        <MiniItem
          label="Recibido"
          value={formatMoney(
            cliente.totalPagos
          )}
        />

        <MiniItem
          label="Trabajos"
          value={cliente.cantidadTrabajos}
        />

        <MiniItem
          label="Ciclos conciliados"
          value={`${cliente.ciclosConciliados}/${cliente.cantidadCiclos}`}
        />
      </div>

      <div
        className={`rounded-xl p-3 ${
          cliente.saldoPendiente > 0
            ? "bg-red-50"
            : cliente.saldoAFavor > 0
              ? "bg-green-50"
              : "bg-lp-light"
        }`}
      >
        <p className="text-xs text-lp-navy/60">
          {cliente.saldoPendiente > 0
            ? "Pendiente por cobrar"
            : cliente.saldoAFavor > 0
              ? "Saldo a favor"
              : "Saldo de cuenta"}
        </p>

        <p
          className={`mt-1 text-xl font-bold ${
            cliente.saldoPendiente > 0
              ? "text-red-600"
              : cliente.saldoAFavor > 0
                ? "text-green-700"
                : "text-lp-navy"
          }`}
        >
          {formatMoney(
            cliente.saldoPendiente > 0
              ? cliente.saldoPendiente
              : cliente.saldoAFavor
          )}
        </p>
      </div>

      {cliente.pagosSinAplicar > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">
            Pagos sin aplicar
          </p>

          <p className="mt-1 font-bold text-amber-800">
            {formatMoney(
              cliente.pagosSinAplicar
            )}
          </p>
        </div>
      )}

      <Link
        href={`/dashboard/lp/saldos-clientes/${cliente.id}`}
        className="block rounded-xl border border-lp-navy px-4 py-3 text-center text-sm font-semibold text-lp-navy"
      >
        Ver estado de cuenta
      </Link>
    </article>
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
          ? "border-red-200 bg-red-50"
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

function MiniResumenCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-lp-navy/10 bg-white p-4 shadow-sm">
      <p className="text-xs text-lp-navy/60">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-lp-navy">
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