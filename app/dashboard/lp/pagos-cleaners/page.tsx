"use client";

import { useEffect, useMemo, useState } from "react";

type DetallePago = {
  id: number;
  fecha: string;
  unidad: string;
  edificio: string;
  cliente: string;
  tipo: string;
  rol: string;
  ingresoLP: number;
  valorPago: number;
  utilidad: number;
  notas?: string | null;
};

type ResumenCleaner = {
  cleanerId: number;
  cleaner: string;
  total: number;
  ingresoLP: number;
  utilidad: number;
  trabajos: number;
  detalle: DetallePago[];
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function getStartOfWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + 1;
  const monday = new Date(today.setDate(diff));
  const offset = monday.getTimezoneOffset();
  const localDate = new Date(monday.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function tipoLabel(tipo: string) {
  const labels: Record<string, string> = {
    LIMPIEZA_INICIAL: "Limpieza inicial",
    LIMPIEZA: "Limpieza",
    EXTRA: "Extra",
    REPASO_LIMPIEZA: "Repaso de limpieza",
  };

  return labels[tipo] || tipo;
}

function rolLabel(rol: string) {
  const labels: Record<string, string> = {
    CLEANER: "Cleaner",
    VOLANTE: "Volante",
    LIDER: "Líder",
  };

  return labels[rol] || rol;
}

export default function PagosCleanersPage() {
  const [desde, setDesde] = useState(getStartOfWeek());
  const [hasta, setHasta] = useState(getTodayInputValue());
  const [data, setData] = useState<ResumenCleaner[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleanerSeleccionado, setCleanerSeleccionado] = useState<number | null>(
    null
  );
  const [clienteFiltro, setClienteFiltro] = useState("todos");

  const fetchPagos = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/lp/pagos-cleaners?desde=${desde}&hasta=${hasta}`
      );

      const json = await res.json();

      if (json.status === "success") {
        setData(json.resumen || []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Error cargando pagos cleaners:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagos();
  }, [desde, hasta]);

  const clientesDisponibles = useMemo(() => {
    const clientes = data.flatMap((cleaner) =>
      cleaner.detalle.map((item) => item.cliente || "Cliente eventual")
    );

    return Array.from(new Set(clientes)).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [data]);

  const dataFiltrada = useMemo(() => {
    if (clienteFiltro === "todos") return data;

    return data
      .map((cleaner) => {
        const detalle = cleaner.detalle.filter(
          (item) => item.cliente === clienteFiltro
        );

        const total = detalle.reduce(
          (acc, item) => acc + Number(item.valorPago || 0),
          0
        );

        const ingresoLP = detalle.reduce(
          (acc, item) => acc + Number(item.ingresoLP || 0),
          0
        );

        const utilidad = detalle.reduce(
          (acc, item) => acc + Number(item.utilidad || 0),
          0
        );

        return {
          ...cleaner,
          detalle,
          total,
          ingresoLP,
          utilidad,
          trabajos: detalle.length,
        };
      })
      .filter((cleaner) => cleaner.trabajos > 0);
  }, [data, clienteFiltro]);

  const resumenPorCliente = useMemo(() => {
    const resumen = data.flatMap((cleaner) => cleaner.detalle).reduce(
      (acc: Record<string, any>, item) => {
        const cliente = item.cliente || "Cliente eventual";

        if (!acc[cliente]) {
          acc[cliente] = {
            cliente,
            trabajos: 0,
            ingresoLP: 0,
            total: 0,
            utilidad: 0,
          };
        }

        acc[cliente].trabajos += 1;
        acc[cliente].ingresoLP += Number(item.ingresoLP || 0);
        acc[cliente].total += Number(item.valorPago || 0);
        acc[cliente].utilidad += Number(item.utilidad || 0);

        return acc;
      },
      {}
    );

    return Object.values(resumen).sort((a: any, b: any) =>
      a.cliente.localeCompare(b.cliente, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [data]);

  const resumen = useMemo(() => {
    const total = dataFiltrada.reduce((acc, cleaner) => acc + cleaner.total, 0);
    const ingresoLP = dataFiltrada.reduce(
      (acc, cleaner) => acc + Number(cleaner.ingresoLP || 0),
      0
    );
    const utilidad = dataFiltrada.reduce(
      (acc, cleaner) => acc + Number(cleaner.utilidad || 0),
      0
    );
    const trabajos = dataFiltrada.reduce(
      (acc, cleaner) => acc + cleaner.trabajos,
      0
    );

    return {
      cleaners: dataFiltrada.length,
      trabajos,
      total,
      ingresoLP,
      utilidad,
    };
  }, [dataFiltrada]);

  const cleanerActivo = dataFiltrada.find(
    (item) => item.cleanerId === cleanerSeleccionado
  );

  const detalleVisible = cleanerActivo || dataFiltrada[0];

  useEffect(() => {
    if (dataFiltrada.length === 0) {
      setCleanerSeleccionado(null);
      return;
    }

    const existeCleanerSeleccionado = dataFiltrada.some(
      (item) => item.cleanerId === cleanerSeleccionado
    );

    if (!cleanerSeleccionado || !existeCleanerSeleccionado) {
      setCleanerSeleccionado(dataFiltrada[0].cleanerId);
    }
  }, [dataFiltrada, cleanerSeleccionado]);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Pagos cleaners</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Consulta automática de unidades realizadas, pagos, fuente de ingreso y
          utilidad operativa estimada por cleaner.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <ResumenCard label="Cleaners" value={resumen.cleaners} />
          <ResumenCard label="Trabajos" value={resumen.trabajos} />
          <ResumenCard
            label="Total a pagar"
            value={formatMoney(resumen.total)}
          />
          <ResumenCard
            label="Utilidad est."
            value={formatMoney(resumen.utilidad)}
          />
        </div>
      </div>

      {data.length > 0 && (
        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
          <p className="text-xs font-semibold text-lp-navy/70">
            Filtrar por fuente de ingreso / cliente
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setClienteFiltro("todos")}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border ${
                clienteFiltro === "todos"
                  ? "bg-lp-navy text-white border-lp-navy"
                  : "bg-white text-lp-navy border-lp-navy/20"
              }`}
            >
              Todos
            </button>

            {clientesDisponibles.map((cliente) => (
              <button
                key={cliente}
                onClick={() => setClienteFiltro(cliente)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border ${
                  clienteFiltro === cliente
                    ? "bg-lp-navy text-white border-lp-navy"
                    : "bg-white text-lp-navy border-lp-navy/20"
                }`}
              >
                {cliente}
              </button>
            ))}
          </div>
        </div>
      )}

      {data.length > 0 && clienteFiltro === "todos" && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-lp-light">
            <h2 className="font-bold text-lp-navy">Resumen por cliente</h2>
            <p className="text-xs text-lp-navy/60">
              Fuente del ingreso, pago asociado y utilidad por cliente.
            </p>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b">
                <tr className="text-left text-lp-navy/70">
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-right">Trabajos</th>
                  <th className="p-3 text-right">Ingreso L&P</th>
                  <th className="p-3 text-right">Pago cleaners</th>
                  <th className="p-3 text-right">Utilidad</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {resumenPorCliente.map((item: any) => (
                  <tr key={item.cliente} className="text-lp-navy">
                    <td className="p-3 font-bold">{item.cliente}</td>
                    <td className="p-3 text-right">{item.trabajos}</td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(item.ingresoLP)}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(item.total)}
                    </td>
                    <td className="p-3 text-right font-bold text-green-700">
                      {formatMoney(item.utilidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y">
            {resumenPorCliente.map((item: any) => (
              <div key={item.cliente} className="p-4 space-y-3">
                <div>
                  <p className="font-bold text-lp-navy">{item.cliente}</p>
                  <p className="text-xs text-lp-navy/60">
                    {item.trabajos} trabajos
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InfoMini
                    label="Ingreso L&P"
                    value={formatMoney(item.ingresoLP)}
                  />
                  <InfoMini
                    label="Pago cleaners"
                    value={formatMoney(item.total)}
                  />
                  <InfoMini
                    label="Utilidad"
                    value={formatMoney(item.utilidad)}
                  />
                  <InfoMini label="Trabajos" value={item.trabajos} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border rounded-2xl shadow-sm p-6 text-sm text-lp-navy/70">
          Cargando pagos...
        </div>
      ) : dataFiltrada.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-6 text-sm text-lp-navy/70">
          No hay asignaciones registradas para este rango de fechas.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-lp-light">
              <h2 className="font-bold text-lp-navy">Resumen por cleaner</h2>
            </div>

            <div className="divide-y">
              {dataFiltrada.map((cleaner) => (
                <button
                  key={cleaner.cleanerId}
                  onClick={() => setCleanerSeleccionado(cleaner.cleanerId)}
                  className={`w-full text-left p-4 hover:bg-lp-light transition ${
                    detalleVisible?.cleanerId === cleaner.cleanerId
                      ? "bg-lp-light"
                      : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-lp-navy truncate">
                        {cleaner.cleaner}
                      </p>
                      <p className="text-xs text-lp-navy/60">
                        {cleaner.trabajos} trabajos
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-lp-navy whitespace-nowrap">
                        {formatMoney(cleaner.total)}
                      </p>
                      <p className="text-xs font-semibold text-green-700 whitespace-nowrap">
                        Utilidad {formatMoney(cleaner.utilidad || 0)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-lp-light flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-bold text-lp-navy">
                  Detalle de {detalleVisible?.cleaner}
                </h2>
                <p className="text-xs text-lp-navy/60">
                  Relación por día, unidad, cliente, ingreso, pago y utilidad.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="font-bold text-lp-navy">
                  Total {formatMoney(detalleVisible?.total || 0)}
                </p>
                <p className="text-xs font-semibold text-green-700">
                  Utilidad estimada{" "}
                  {formatMoney(detalleVisible?.utilidad || 0)}
                </p>
              </div>
            </div>

            <div className="block md:hidden divide-y">
              {detalleVisible?.detalle.map((item) => (
                <div key={item.id} className="p-4 space-y-3 text-lp-navy">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-lp-navy/60">
                        {formatDate(item.fecha)}
                      </p>
                      <p className="font-bold text-base truncate">
                        {item.unidad}
                      </p>
                      <p className="text-sm text-lp-navy/70 truncate">
                        {item.edificio}
                      </p>
                      <p className="text-xs font-semibold text-lp-navy/70 truncate">
                        Cliente: {item.cliente}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg whitespace-nowrap">
                        {formatMoney(item.valorPago)}
                      </p>
                      <p className="text-xs font-semibold text-green-700 whitespace-nowrap">
                        +{formatMoney(item.utilidad || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <InfoMini
                      label="Ingreso L&P"
                      value={formatMoney(item.ingresoLP || 0)}
                    />
                    <InfoMini
                      label="Pago cleaner"
                      value={formatMoney(item.valorPago || 0)}
                    />
                    <InfoMini
                      label="Utilidad"
                      value={formatMoney(item.utilidad || 0)}
                    />
                    <InfoMini label="Rol" value={rolLabel(item.rol)} />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-lp-light text-lp-navy">
                      {tipoLabel(item.tipo)}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-lp-light text-lp-navy">
                      {item.cliente}
                    </span>
                  </div>

                  {item.notas && (
                    <p className="text-xs text-lp-navy/60">{item.notas}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b">
                  <tr className="text-left text-lp-navy/70">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Unidad</th>
                    <th className="p-3">Edificio</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3 text-right">Ingreso L&P</th>
                    <th className="p-3 text-right">Pago</th>
                    <th className="p-3 text-right">Utilidad</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {detalleVisible?.detalle.map((item) => (
                    <tr key={item.id} className="text-lp-navy">
                      <td className="p-3 whitespace-nowrap">
                        {formatDate(item.fecha)}
                      </td>
                      <td className="p-3 font-semibold">{item.unidad}</td>
                      <td className="p-3">{item.edificio}</td>
                      <td className="p-3 font-semibold">{item.cliente}</td>
                      <td className="p-3">{tipoLabel(item.tipo)}</td>
                      <td className="p-3">{rolLabel(item.rol)}</td>
                      <td className="p-3 text-right font-semibold">
                        {formatMoney(item.ingresoLP || 0)}
                      </td>
                      <td className="p-3 text-right font-bold">
                        {formatMoney(item.valorPago)}
                      </td>
                      <td className="p-3 text-right font-bold text-green-700">
                        {formatMoney(item.utilidad || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detalleVisible?.detalle.some((item) => item.notas) && (
              <div className="p-4 border-t space-y-2">
                <h3 className="text-sm font-bold text-lp-navy">Notas</h3>

                {detalleVisible.detalle
                  .filter((item) => item.notas)
                  .map((item) => (
                    <p key={item.id} className="text-xs text-lp-navy/70">
                      <span className="font-semibold">
                        {formatDate(item.fecha)} · {item.unidad} ·{" "}
                        {item.cliente}:
                      </span>{" "}
                      {item.notas}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResumenCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-lp-light rounded-xl p-4 min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className="text-xl font-bold text-lp-navy truncate">{value}</p>
    </div>
  );
}

function InfoMini({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-lp-light rounded-xl p-3 min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className="text-sm font-bold text-lp-navy break-words">{value}</p>
    </div>
  );
}