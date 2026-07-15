"use client";

import { useEffect, useMemo, useState } from "react";
import ResumenNavigation from "@/app/components/lp/ResumenNavigation";

type CleanerDetalle = {
  id: number;
  nombre: string;
  rol: string;
  valorPago: number;
};

type TrabajoDetalle = {
  id: number;
  fecha: string;
  dia: string;
  cliente: string;
  edificio: string;
  unidad: string;
  habitaciones: number | null;
  banos: number | null;
  tipoUnidad: string;
  tipoTrabajo: string;
  precio: number;
  notas?: string | null;
  asignado: boolean;
  cantidadAsignaciones: number;
  totalPagoCleaners: number;
  pagoPendiente: number;
  utilidadEstimada: number;
  cleaners: CleanerDetalle[];
};

type DetalleDia = {
  fecha: string;
  dia: string;
  cantidadTrabajos: number;
  totalPrecio: number;
  trabajos: TrabajoDetalle[];
};

type RespuestaDetalle = {
  status: "success" | "fail";
  message?: string;
  clientes?: string[];
  trabajosDetalle?: TrabajoDetalle[];
  detalleDias?: DetalleDia[];
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function getFirstDayOfMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(fecha: string) {
  const fechaLimpia = fecha.split("T")[0];
  const [year, month, day] = fechaLimpia.split("-");

  return `${month}/${day}/${year}`;
}

function limpiarNombreArchivo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function obtenerNombreArchivo(
  desde: string,
  hasta: string,
  cliente: string,
  extension: "xlsx" | "csv"
) {
  const clienteArchivo =
    cliente === "TODOS" ? "todos" : limpiarNombreArchivo(cliente);

  return `detalle-trabajos_${desde}_${hasta}_${clienteArchivo}.${extension}`;
}

export default function DetalleTrabajosPage() {
  const [desde, setDesde] = useState(getFirstDayOfMonth());
  const [hasta, setHasta] = useState(getTodayInputValue());
  const [clienteFiltro, setClienteFiltro] = useState("TODOS");

  const [clientes, setClientes] = useState<string[]>([]);
  const [trabajos, setTrabajos] = useState<TrabajoDetalle[]>([]);
  const [detalleDias, setDetalleDias] = useState<DetalleDia[]>([]);

  const [loading, setLoading] = useState(true);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [error, setError] = useState("");

  const fetchDetalle = async () => {
    if (!desde || !hasta) return;

    if (desde > hasta) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      setTrabajos([]);
      setDetalleDias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        desde,
        hasta,
        cliente: clienteFiltro,
      });

      const response = await fetch(
        `/api/lp/resumen-financiero?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data: RespuestaDetalle = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message || "No fue posible cargar el detalle de trabajos."
        );
      }

      setClientes(data.clientes || []);
      setTrabajos(data.trabajosDetalle || []);
      setDetalleDias(data.detalleDias || []);
    } catch (error) {
      console.error("Error cargando detalle de trabajos:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el detalle de trabajos."
      );

      setTrabajos([]);
      setDetalleDias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetalle();
  }, [desde, hasta, clienteFiltro]);

  const totales = useMemo(() => {
    return trabajos.reduce(
      (acc, trabajo) => {
        acc.totalPrecio += Number(trabajo.precio || 0);
        acc.totalPagoCleaners += Number(trabajo.totalPagoCleaners || 0);
        acc.totalPagoPendiente += Number(trabajo.pagoPendiente || 0);
        acc.totalUtilidad += Number(trabajo.utilidadEstimada || 0);

        return acc;
      },
      {
        totalPrecio: 0,
        totalPagoCleaners: 0,
        totalPagoPendiente: 0,
        totalUtilidad: 0,
      }
    );
  }, [trabajos]);

  const construirFilasExportacion = () => {
    return trabajos.map((trabajo) => ({
      Fecha: formatDate(trabajo.fecha),
      Día: trabajo.dia || "",
      Cliente: trabajo.cliente,
      Edificio: trabajo.edificio,
      Unidad: trabajo.unidad,
      "Tipo de unidad": trabajo.tipoUnidad,
      "Tipo de trabajo": trabajo.tipoTrabajo,
      Precio: Number(trabajo.precio || 0),
      Estado: trabajo.asignado ? "Asignado" : "Pendiente",
      Cleaners:
        trabajo.cleaners.map((cleaner) => cleaner.nombre).join(", ") ||
        "Sin asignar",
      "Pago cleaners": Number(trabajo.totalPagoCleaners || 0),
      "Pago pendiente estimado": Number(trabajo.pagoPendiente || 0),
      "Utilidad estimada": Number(trabajo.utilidadEstimada || 0),
      Notas: trabajo.notas || "",
    }));
  };

  const exportarExcel = async () => {
    if (trabajos.length === 0) {
      alert("No hay trabajos para exportar.");
      return;
    }

    try {
      setExportandoExcel(true);

      const XLSX = await import("xlsx");
      const filas = construirFilasExportacion();

      const hojaDetalle = XLSX.utils.json_to_sheet(filas);

      hojaDetalle["!cols"] = [
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 22 },
        { wch: 14 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 14 },
        { wch: 28 },
        { wch: 16 },
        { wch: 22 },
        { wch: 18 },
        { wch: 35 },
      ];

      const filasResumen = [
        {
          Concepto: "Desde",
          Valor: formatDate(desde),
        },
        {
          Concepto: "Hasta",
          Valor: formatDate(hasta),
        },
        {
          Concepto: "Cliente",
          Valor: clienteFiltro === "TODOS" ? "Todos" : clienteFiltro,
        },
        {
          Concepto: "Cantidad de trabajos",
          Valor: trabajos.length,
        },
        {
          Concepto: "Total facturado",
          Valor: totales.totalPrecio,
        },
        {
          Concepto: "Pago a cleaners",
          Valor: totales.totalPagoCleaners,
        },
        {
          Concepto: "Pago pendiente estimado",
          Valor: totales.totalPagoPendiente,
        },
        {
          Concepto: "Utilidad estimada",
          Valor: totales.totalUtilidad,
        },
      ];

      const hojaResumen = XLSX.utils.json_to_sheet(filasResumen);

      hojaResumen["!cols"] = [{ wch: 30 }, { wch: 22 }];

      const libro = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen");
      XLSX.utils.book_append_sheet(libro, hojaDetalle, "Trabajos");

      XLSX.writeFile(
        libro,
        obtenerNombreArchivo(desde, hasta, clienteFiltro, "xlsx")
      );
    } catch (error) {
      console.error("Error exportando Excel:", error);
      alert("No fue posible exportar el archivo Excel.");
    } finally {
      setExportandoExcel(false);
    }
  };

  const exportarCSV = () => {
    if (trabajos.length === 0) {
      alert("No hay trabajos para exportar.");
      return;
    }

    const filas = construirFilasExportacion();

    const encabezados = [
      "Fecha",
      "Día",
      "Cliente",
      "Edificio",
      "Unidad",
      "Tipo de unidad",
      "Tipo de trabajo",
      "Precio",
      "Estado",
      "Cleaners",
      "Pago cleaners",
      "Pago pendiente estimado",
      "Utilidad estimada",
      "Notas",
    ];

    const valores = filas.map((fila) => [
      fila.Fecha,
      fila.Día,
      fila.Cliente,
      fila.Edificio,
      fila.Unidad,
      fila["Tipo de unidad"],
      fila["Tipo de trabajo"],
      fila.Precio,
      fila.Estado,
      fila.Cleaners,
      fila["Pago cleaners"],
      fila["Pago pendiente estimado"],
      fila["Utilidad estimada"],
      fila.Notas,
    ]);

    const contenidoCSV = [encabezados, ...valores]
      .map((fila) =>
        fila
          .map((valor) => {
            const texto = String(valor ?? "").replace(/"/g, '""');
            return `"${texto}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + contenidoCSV], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = obtenerNombreArchivo(
      desde,
      hasta,
      clienteFiltro,
      "csv"
    );

    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Detalle de trabajos
        </h1>

        <p className="mt-1 text-sm text-lp-navy/70">
          Consulta las unidades trabajadas, su tipo, precio y asignación dentro
          del rango seleccionado.
        </p>
      </div>

      <ResumenNavigation />

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="font-bold text-lp-navy">Filtros</h2>

          <p className="mt-1 text-xs text-lp-navy/60">
            La vista y las exportaciones respetan el rango y el cliente
            seleccionado.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-2xl">
          <div className="space-y-1">
            <label
              htmlFor="detalle-desde"
              className="text-xs font-semibold text-lp-navy"
            >
              Desde
            </label>

            <input
              id="detalle-desde"
              type="date"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
              className="w-full rounded-xl border bg-white p-3 text-lp-navy outline-none transition focus:border-lp-navy"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="detalle-hasta"
              className="text-xs font-semibold text-lp-navy"
            >
              Hasta
            </label>

            <input
              id="detalle-hasta"
              type="date"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
              className="w-full rounded-xl border bg-white p-3 text-lp-navy outline-none transition focus:border-lp-navy"
            />
          </div>
        </div>

        {clientes.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold text-lp-navy/70">
              Filtrar por cliente
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setClienteFiltro("TODOS")}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  clienteFiltro === "TODOS"
                    ? "border-lp-navy bg-lp-navy text-white"
                    : "border-lp-navy/20 bg-white text-lp-navy hover:bg-lp-light"
                }`}
              >
                Todos
              </button>

              {clientes.map((cliente) => (
                <button
                  type="button"
                  key={cliente}
                  onClick={() => setClienteFiltro(cliente)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    clienteFiltro === cliente
                      ? "border-lp-navy bg-lp-navy text-white"
                      : "border-lp-navy/20 bg-white text-lp-navy hover:bg-lp-light"
                  }`}
                >
                  {cliente}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-lp-navy">
              Resultado del período
            </h2>

            <p className="mt-1 text-xs text-lp-navy/60">
              {clienteFiltro === "TODOS"
                ? "Todos los clientes"
                : clienteFiltro}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={exportarCSV}
              disabled={loading || trabajos.length === 0}
              className="rounded-xl border border-lp-navy px-4 py-2.5 text-sm font-semibold text-lp-navy transition hover:bg-lp-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={exportarExcel}
              disabled={
                loading || exportandoExcel || trabajos.length === 0
              }
              className="rounded-xl bg-lp-gold px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportandoExcel ? "Exportando..." : "Exportar Excel"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ResumenCard
            label="Trabajos"
            value={trabajos.length}
          />

          <ResumenCard
            label="Total facturado"
            value={formatMoney(totales.totalPrecio)}
          />

          <ResumenCard
            label="Pago cleaners"
            value={formatMoney(
              totales.totalPagoCleaners + totales.totalPagoPendiente
            )}
          />

          <ResumenCard
            label="Utilidad estimada"
            value={formatMoney(totales.totalUtilidad)}
            valueClassName={
              totales.totalUtilidad >= 0
                ? "text-green-700"
                : "text-red-600"
            }
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold text-lp-navy">
              Trabajos por día
            </h2>

            {!loading && (
              <p className="mt-1 text-xs text-lp-navy/60">
                {detalleDias.length}{" "}
                {detalleDias.length === 1 ? "día registrado" : "días registrados"}
              </p>
            )}
          </div>

          {!loading && (
            <span className="rounded-full bg-lp-light px-3 py-1 text-sm font-bold text-lp-navy">
              {trabajos.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-lp-navy">
              Cargando detalle de trabajos...
            </p>
          </div>
        ) : detalleDias.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-lp-navy">
              No hay trabajos en este rango
            </p>

            <p className="mt-1 text-sm text-lp-navy/60">
              Cambia las fechas o selecciona otro cliente.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {detalleDias.map((grupo) => (
              <DetalleDiaSection
                key={grupo.fecha}
                grupo={grupo}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetalleDiaSection({ grupo }: { grupo: DetalleDia }) {
  return (
    <article>
      <div className="flex flex-col gap-2 bg-lp-light/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold capitalize text-lp-navy/60">
            {grupo.dia || "Día"}
          </p>

          <h3 className="text-lg font-bold text-lp-navy">
            {formatDate(grupo.fecha)}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-lp-navy/70">
            {grupo.cantidadTrabajos}{" "}
            {grupo.cantidadTrabajos === 1 ? "trabajo" : "trabajos"}
          </span>

          <span className="font-bold text-lp-navy">
            {formatMoney(grupo.totalPrecio)}
          </span>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm text-lp-navy">
          <thead>
            <tr className="border-b bg-white text-xs uppercase tracking-wide text-lp-navy/55">
              <th className="px-4 py-3 text-left sm:px-5">Cliente</th>
              <th className="px-4 py-3 text-left">Edificio</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-left">Trabajo</th>
              <th className="px-4 py-3 text-left">Cleaner</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right sm:px-5">Precio</th>
            </tr>
          </thead>

          <tbody>
            {grupo.trabajos.map((trabajo) => (
              <tr
                key={trabajo.id}
                className="border-b last:border-b-0 hover:bg-lp-light/40"
              >
                <td className="px-4 py-4 font-semibold sm:px-5">
                  {trabajo.cliente}
                </td>

                <td className="px-4 py-4">
                  {trabajo.edificio}
                </td>

                <td className="px-4 py-4 font-bold">
                  {trabajo.unidad}
                </td>

                <td className="px-4 py-4 text-center">
                  <span className="inline-flex min-w-12 justify-center rounded-full bg-lp-light px-3 py-1 font-bold text-lp-navy">
                    {trabajo.tipoUnidad}
                  </span>
                </td>

                <td className="px-4 py-4">
                  {formatTipoTrabajo(trabajo.tipoTrabajo)}
                </td>

                <td className="px-4 py-4">
                  {trabajo.cleaners.length > 0
                    ? trabajo.cleaners
                        .map((cleaner) => cleaner.nombre)
                        .join(", ")
                    : "—"}
                </td>

                <td className="px-4 py-4 text-center">
                  <EstadoBadge asignado={trabajo.asignado} />
                </td>

                <td className="px-4 py-4 text-right text-base font-bold sm:px-5">
                  {formatMoney(trabajo.precio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y lg:hidden">
        {grupo.trabajos.map((trabajo) => (
          <TrabajoCard
            key={trabajo.id}
            trabajo={trabajo}
          />
        ))}
      </div>
    </article>
  );
}

function TrabajoCard({ trabajo }: { trabajo: TrabajoDetalle }) {
  const cleaners =
    trabajo.cleaners.length > 0
      ? trabajo.cleaners.map((cleaner) => cleaner.nombre).join(", ")
      : "Sin asignar";

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-lp-navy/55">
            {trabajo.cliente} · {trabajo.edificio}
          </p>

          <h4 className="mt-0.5 text-lg font-bold text-lp-navy">
            Unidad {trabajo.unidad}
          </h4>
        </div>

        <p className="shrink-0 text-lg font-bold text-lp-navy">
          {formatMoney(trabajo.precio)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniItem
          label="Tipo de unidad"
          value={trabajo.tipoUnidad}
        />

        <MiniItem
          label="Tipo de trabajo"
          value={formatTipoTrabajo(trabajo.tipoTrabajo)}
        />

        <MiniItem
          label="Cleaner"
          value={cleaners}
        />

        <div className="rounded-xl bg-lp-light p-3">
          <p className="text-xs text-lp-navy/60">Estado</p>

          <div className="mt-1">
            <EstadoBadge asignado={trabajo.asignado} />
          </div>
        </div>
      </div>

      {trabajo.notas && (
        <div className="rounded-xl border border-lp-navy/10 p-3">
          <p className="text-xs font-semibold text-lp-navy/60">
            Notas
          </p>

          <p className="mt-1 text-sm text-lp-navy">
            {trabajo.notas}
          </p>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ asignado }: { asignado: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        asignado
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {asignado ? "Asignado" : "Pendiente"}
    </span>
  );
}

function formatTipoTrabajo(tipo: string) {
  return tipo
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letra) => letra.toUpperCase());
}

function ResumenCard({
  label,
  value,
  valueClassName = "text-lp-navy",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-lp-light p-4">
      <p className="truncate text-xs text-lp-navy/60">
        {label}
      </p>

      <p className={`truncate text-xl font-bold ${valueClassName}`}>
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