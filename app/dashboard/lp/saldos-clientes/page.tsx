"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ResumenNavigation from "@/app/components/lp/ResumenNavigation";

type ClienteSaldo = {
  id: number;
  nombre: string;
  usaSaldoAnticipado: boolean;
  fechaInicioSaldo: string | null;

  totalAbonos: number;
  totalCreditos: number;
  totalTrabajos: number;
  cantidadTrabajos: number;
  totalDebitosManuales: number;
  saldoActual: number;
};

type RespuestaClientes = {
  status: "success" | "fail";
  message?: string;
  clientes?: ClienteSaldo[];
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(
    today.getTime() - offset * 60 * 1000
  );

  return localDate.toISOString().split("T")[0];
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
  if (!fecha) return "Sin configurar";

  const [year, month, day] = fecha.split("T")[0].split("-");

  return `${month}/${day}/${year}`;
}

export default function SaldosClientesPage() {
  const [clientes, setClientes] = useState<ClienteSaldo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  /*
   * Guardamos los cambios temporales por cliente antes
   * de enviarlos a la API.
   */
  const [configuraciones, setConfiguraciones] = useState<
    Record<
      number,
      {
        usaSaldoAnticipado: boolean;
        fechaInicioSaldo: string;
      }
    >
  >({});

  const cargarClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/lp/saldos-clientes", {
        cache: "no-store",
      });

      const data: RespuestaClientes = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message || "No fue posible cargar los clientes."
        );
      }

      const clientesCargados = data.clientes || [];

      setClientes(clientesCargados);

      const configuracionesIniciales =
        clientesCargados.reduce<
          Record<
            number,
            {
              usaSaldoAnticipado: boolean;
              fechaInicioSaldo: string;
            }
          >
        >((acc, cliente) => {
          acc[cliente.id] = {
            usaSaldoAnticipado:
              cliente.usaSaldoAnticipado,
            fechaInicioSaldo:
              cliente.fechaInicioSaldo || getTodayInputValue(),
          };

          return acc;
        }, {});

      setConfiguraciones(configuracionesIniciales);
    } catch (error) {
      console.error("Error cargando saldos:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar los clientes."
      );

      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  const actualizarConfiguracionLocal = (
    clienteId: number,
    campo: "usaSaldoAnticipado" | "fechaInicioSaldo",
    valor: boolean | string
  ) => {
    setConfiguraciones((actuales) => ({
      ...actuales,
      [clienteId]: {
        ...actuales[clienteId],
        [campo]: valor,
      },
    }));
  };

  const guardarConfiguracion = async (clienteId: number) => {
    const configuracion = configuraciones[clienteId];

    if (!configuracion) return;

    if (
      configuracion.usaSaldoAnticipado &&
      !configuracion.fechaInicioSaldo
    ) {
      alert("Debes indicar la fecha de inicio del saldo.");
      return;
    }

    try {
      setSavingId(clienteId);

      const response = await fetch("/api/lp/saldos-clientes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clienteId,
          usaSaldoAnticipado:
            configuracion.usaSaldoAnticipado,
          fechaInicioSaldo:
            configuracion.usaSaldoAnticipado
              ? configuracion.fechaInicioSaldo
              : null,
        }),
      });

      const data: RespuestaClientes = await response.json();

      if (!response.ok || data.status !== "success") {
        alert(
          data.message ||
            "No fue posible actualizar la configuración."
        );

        return;
      }

      await cargarClientes();
    } catch (error) {
      console.error(
        "Error guardando configuración:",
        error
      );

      alert(
        "No fue posible actualizar la configuración."
      );
    } finally {
      setSavingId(null);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) return clientes;

    return clientes.filter((cliente) =>
      cliente.nombre.toLowerCase().includes(termino)
    );
  }, [clientes, busqueda]);

  const resumenGeneral = useMemo(() => {
    const activos = clientes.filter(
      (cliente) => cliente.usaSaldoAnticipado
    );

    return {
      clientesActivos: activos.length,

      saldoDisponible: activos.reduce(
        (acc, cliente) => acc + cliente.saldoActual,
        0
      ),

      totalAnticipos: activos.reduce(
        (acc, cliente) => acc + cliente.totalAbonos,
        0
      ),

      totalConsumido: activos.reduce(
        (acc, cliente) => acc + cliente.totalTrabajos,
        0
      ),
    };
  }, [clientes]);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Saldos de clientes
        </h1>
        
        <p className="mt-1 text-sm text-lp-navy/70">
          Configura clientes con anticipos y controla el saldo
          disponible después de cada limpieza.
        </p>
      </div>
        <ResumenNavigation />
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResumenCard
            label="Clientes con saldo"
            value={resumenGeneral.clientesActivos}
          />

          <ResumenCard
            label="Anticipos recibidos"
            value={formatMoney(
              resumenGeneral.totalAnticipos
            )}
          />

          <ResumenCard
            label="Servicios descontados"
            value={formatMoney(
              resumenGeneral.totalConsumido
            )}
          />

          <ResumenCard
            label="Saldo disponible"
            value={formatMoney(
              resumenGeneral.saldoDisponible
            )}
            valueClassName={
              resumenGeneral.saldoDisponible >= 0
                ? "text-green-700"
                : "text-red-600"
            }
            destacado
          />
        </section>
      )}

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-bold text-lp-navy">
              Clientes
            </h2>

            <p className="mt-1 text-xs text-lp-navy/60">
              Activa el saldo anticipado únicamente para los
              clientes que hayan entregado un anticipo.
            </p>
          </div>

          <div className="w-full sm:max-w-sm">
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold text-lp-navy">
              Configuración de saldos
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
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-lp-navy">
              Cargando clientes...
            </p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-lp-navy">
              No encontramos clientes
            </p>

            <p className="mt-1 text-sm text-lp-navy/60">
              Prueba con otro término de búsqueda.
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

                    <th className="px-4 py-3 text-center">
                      Saldo anticipado
                    </th>

                    <th className="px-4 py-3 text-left">
                      Fecha de inicio
                    </th>

                    <th className="px-4 py-3 text-right">
                      Anticipos
                    </th>

                    <th className="px-4 py-3 text-right">
                      Limpiezas
                    </th>

                    <th className="px-4 py-3 text-right">
                      Saldo
                    </th>

                    <th className="px-4 py-3 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {clientesFiltrados.map((cliente) => {
                    const configuracion =
                      configuraciones[cliente.id];

                    if (!configuracion) return null;

                    const tieneCambios =
                      configuracion.usaSaldoAnticipado !==
                        cliente.usaSaldoAnticipado ||
                      (
                        configuracion.usaSaldoAnticipado &&
                        configuracion.fechaInicioSaldo !==
                          (cliente.fechaInicioSaldo || "")
                      );

                    return (
                      <tr
                        key={cliente.id}
                        className="border-b last:border-b-0 hover:bg-lp-light/40"
                      >
                        <td className="px-4 py-4">
                          <p className="font-bold">
                            {cliente.nombre}
                          </p>

                          <p className="mt-0.5 text-xs text-lp-navy/50">
                            ID #{cliente.id}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={
                                configuracion.usaSaldoAnticipado
                              }
                              onChange={(event) =>
                                actualizarConfiguracionLocal(
                                  cliente.id,
                                  "usaSaldoAnticipado",
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 accent-lp-navy"
                            />

                            <span className="text-xs font-semibold">
                              {configuracion.usaSaldoAnticipado
                                ? "Activo"
                                : "Inactivo"}
                            </span>
                          </label>
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="date"
                            value={
                              configuracion.fechaInicioSaldo
                            }
                            onChange={(event) =>
                              actualizarConfiguracionLocal(
                                cliente.id,
                                "fechaInicioSaldo",
                                event.target.value
                              )
                            }
                            disabled={
                              !configuracion.usaSaldoAnticipado
                            }
                            className="rounded-xl border bg-white p-2 text-sm text-lp-navy disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50"
                          />
                        </td>

                        <td className="px-4 py-4 text-right font-semibold">
                          {cliente.usaSaldoAnticipado
                            ? formatMoney(cliente.totalAbonos)
                            : "—"}
                        </td>

                        <td className="px-4 py-4 text-right">
                          {cliente.usaSaldoAnticipado
                            ? formatMoney(cliente.totalTrabajos)
                            : "—"}
                        </td>

                        <td
                          className={`px-4 py-4 text-right font-bold ${
                            cliente.saldoActual >= 0
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {cliente.usaSaldoAnticipado
                            ? formatMoney(cliente.saldoActual)
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {tieneCambios && (
                              <button
                                type="button"
                                onClick={() =>
                                  guardarConfiguracion(
                                    cliente.id
                                  )
                                }
                                disabled={
                                  savingId === cliente.id
                                }
                                className="rounded-lg bg-lp-gold px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {savingId === cliente.id
                                  ? "Guardando..."
                                  : "Guardar"}
                              </button>
                            )}

                            {cliente.usaSaldoAnticipado && (
                              <Link
                                href={`/dashboard/lp/saldos-clientes/${cliente.id}`}
                                className="rounded-lg border border-lp-navy px-3 py-2 text-xs font-semibold text-lp-navy"
                              >
                                Ver estado
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y xl:hidden">
              {clientesFiltrados.map((cliente) => (
                <ClienteSaldoCard
                  key={cliente.id}
                  cliente={cliente}
                  configuracion={
                    configuraciones[cliente.id]
                  }
                  saving={
                    savingId === cliente.id
                  }
                  onActualizar={
                    actualizarConfiguracionLocal
                  }
                  onGuardar={guardarConfiguracion}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ClienteSaldoCard({
  cliente,
  configuracion,
  saving,
  onActualizar,
  onGuardar,
}: {
  cliente: ClienteSaldo;

  configuracion?: {
    usaSaldoAnticipado: boolean;
    fechaInicioSaldo: string;
  };

  saving: boolean;

  onActualizar: (
    clienteId: number,
    campo: "usaSaldoAnticipado" | "fechaInicioSaldo",
    valor: boolean | string
  ) => void;

  onGuardar: (clienteId: number) => void;
}) {
  if (!configuracion) return null;

  const tieneCambios =
    configuracion.usaSaldoAnticipado !==
      cliente.usaSaldoAnticipado ||
    (
      configuracion.usaSaldoAnticipado &&
      configuracion.fechaInicioSaldo !==
        (cliente.fechaInicioSaldo || "")
    );

  return (
    <article className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-lp-navy">
            {cliente.nombre}
          </h3>

          <p className="mt-0.5 text-xs text-lp-navy/50">
            {cliente.usaSaldoAnticipado
              ? `Inicio: ${formatDate(
                  cliente.fechaInicioSaldo
                )}`
              : "Facturación normal"}
          </p>
        </div>

        {cliente.usaSaldoAnticipado && (
          <p
            className={`text-lg font-bold ${
              cliente.saldoActual >= 0
                ? "text-green-700"
                : "text-red-600"
            }`}
          >
            {formatMoney(cliente.saldoActual)}
          </p>
        )}
      </div>

      {cliente.usaSaldoAnticipado && (
        <div className="grid grid-cols-2 gap-2">
          <MiniItem
            label="Anticipos"
            value={formatMoney(cliente.totalAbonos)}
          />

          <MiniItem
            label="Limpiezas"
            value={formatMoney(cliente.totalTrabajos)}
          />

          <MiniItem
            label="Trabajos"
            value={cliente.cantidadTrabajos}
          />

          <MiniItem
            label="Saldo"
            value={formatMoney(cliente.saldoActual)}
          />
        </div>
      )}

      <div className="space-y-3 rounded-xl bg-lp-light p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-lp-navy">
            Usar saldo anticipado
          </span>

          <input
            type="checkbox"
            checked={configuracion.usaSaldoAnticipado}
            onChange={(event) =>
              onActualizar(
                cliente.id,
                "usaSaldoAnticipado",
                event.target.checked
              )
            }
            className="h-5 w-5 accent-lp-navy"
          />
        </label>

        {configuracion.usaSaldoAnticipado && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Fecha desde la que se descuentan limpiezas
            </label>

            <input
              type="date"
              value={configuracion.fechaInicioSaldo}
              onChange={(event) =>
                onActualizar(
                  cliente.id,
                  "fechaInicioSaldo",
                  event.target.value
                )
              }
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tieneCambios && (
          <button
            type="button"
            onClick={() => onGuardar(cliente.id)}
            disabled={saving}
            className="rounded-xl bg-lp-gold px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        )}

        {cliente.usaSaldoAnticipado && (
          <Link
            href={`/dashboard/lp/saldos-clientes/${cliente.id}`}
            className="rounded-xl border border-lp-navy px-4 py-3 text-center text-sm font-semibold text-lp-navy"
          >
            Ver estado de cuenta
          </Link>
        )}
      </div>
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
    <div className="min-w-0 rounded-xl bg-white p-3">
      <p className="text-xs text-lp-navy/60">
        {label}
      </p>

      <p className="mt-0.5 break-words font-bold text-lp-navy">
        {value}
      </p>
    </div>
  );
}