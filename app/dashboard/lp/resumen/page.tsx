"use client";

import { useEffect, useMemo, useState } from "react";

type CostoOperativo = {
  id: number;
  fecha: string;
  concepto: string;
  valor: number;
  notas?: string | null;
};

type ResumenGeneral = {
  trabajos: number;
  trabajosAsignados: number;
  trabajosPendientes: number;
  totalTrabajado: number;
  totalAsignadoCleaners: number;
  totalPendienteAsignar: number;
  totalCostosOperativos: number;
  margenEstimado: number;
};

type ResumenDia = {
  fecha: string;
  dia: string;
  trabajos: number;
  totalTrabajado: number;
  totalAsignadoCleaners: number;
  totalPendienteAsignar: number;
  totalCostosOperativos: number;
  margenEstimado: number;
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
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
  return fecha.split("T")[0].split("-").reverse().join("/");
}

function getFirstDayOfMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export default function ResumenFinancieroPage() {
  const [desde, setDesde] = useState(getFirstDayOfMonth());
  const [hasta, setHasta] = useState(getTodayInputValue());
  const [clienteFiltro, setClienteFiltro] = useState("TODOS");
  const [clientes, setClientes] = useState<string[]>([]);
  const [resumen, setResumen] = useState<ResumenGeneral | null>(null);
  const [resumenDias, setResumenDias] = useState<ResumenDia[]>([]);
  const [costosOperativos, setCostosOperativos] = useState<CostoOperativo[]>(
    []
  );

  const [fechaCosto, setFechaCosto] = useState(getTodayInputValue());
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [notas, setNotas] = useState("");

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchResumen = async () => {
    try {
      setLoading(true);

      const [resumenRes, costosRes] = await Promise.all([
        fetch(
              `/api/lp/resumen-financiero?desde=${desde}&hasta=${hasta}&cliente=${encodeURIComponent(
                clienteFiltro
              )}`
            ),
        fetch(`/api/lp/costos-operativos?desde=${desde}&hasta=${hasta}`),
      ]);

      const resumenData = await resumenRes.json();
      const costosData = await costosRes.json();

      setClientes(resumenData.clientes || []);
      setResumen(resumenData.resumen || null);
      setResumenDias(resumenData.resumenDias || []);
      setCostosOperativos(costosData.costos || []);
    } catch (error) {
      console.error("Error cargando resumen:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  fetchResumen();
}, [desde, hasta, clienteFiltro]);

  const limpiarFormulario = () => {
    setEditandoId(null);
    setFechaCosto(getTodayInputValue());
    setConcepto("");
    setValor("");
    setNotas("");
  };

  const guardarCosto = async () => {
    if (!fechaCosto || !concepto.trim() || valor === "") {
      alert("Completa fecha, concepto y valor.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lp/costos-operativos", {
        method: editandoId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editandoId,
          fecha: fechaCosto,
          concepto,
          valor: Number(valor),
          notas,
        }),
      });

      if (!res.ok) {
        alert("Error al guardar costo operativo");
        return;
      }

      limpiarFormulario();
      fetchResumen();
    } catch (error) {
      console.error(error);
      alert("Error al guardar costo operativo");
    } finally {
      setSaving(false);
    }
  };

  const editarCosto = (costo: CostoOperativo) => {
    setEditandoId(costo.id);
    setFechaCosto(costo.fecha.split("T")[0]);
    setConcepto(costo.concepto);
    setValor(String(costo.valor));
    setNotas(costo.notas || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const eliminarCosto = async (id: number) => {
    const confirmar = confirm("¿Eliminar este costo operativo?");
    if (!confirmar) return;

    try {
      const res = await fetch(`/api/lp/costos-operativos?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Error al eliminar costo");
        return;
      }

      if (editandoId === id) limpiarFormulario();

      fetchResumen();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar costo");
    }
  };

  const margenColor = useMemo(() => {
    if (!resumen) return "text-lp-navy";
    return resumen.margenEstimado >= 0 ? "text-green-700" : "text-red-600";
  }, [resumen]);

  if (loading) {
    return <p className="text-lp-navy">Cargando resumen financiero...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Resumen financiero
        </h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Control general por rango de fechas: ingresos, pagos a cleaners,
          pendientes y costos eventuales.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="font-bold text-lp-navy">Rango de facturación</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
        </div>
        {clientes.length > 0 && (
  <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
    <p className="text-xs font-semibold text-lp-navy/70">
      Filtrar por cliente
    </p>

    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => setClienteFiltro("TODOS")}
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border ${
          clienteFiltro === "TODOS"
            ? "bg-lp-navy text-white border-lp-navy"
            : "bg-white text-lp-navy border-lp-navy/20"
        }`}
      >
        Todos
      </button>

      {clientes.map((cliente) => (
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

    {clienteFiltro !== "TODOS" && (
      <p className="text-xs text-lp-navy/60">
        Vista filtrada por cliente. Los costos eventuales no se incluyen porque
        todavía no están asociados a un cliente específico.
      </p>
    )}
  </div>
)}
        {resumen && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-8 gap-3">
            <ResumenCard label="Trabajos" value={resumen.trabajos} />
            <ResumenCard
              label="Asignados"
              value={resumen.trabajosAsignados}
            />
            <ResumenCard
              label="Pendientes"
              value={resumen.trabajosPendientes}
            />
            <ResumenCard
              label="Total trabajado"
              value={formatMoney(resumen.totalTrabajado)}
            />
            <ResumenCard
              label="Pago cleaners"
              value={formatMoney(resumen.totalAsignadoCleaners)}
            />
            <ResumenCard
              label="Costo estimado sin asignar"
              value={formatMoney(resumen.totalPendienteAsignar)}
            />
            <ResumenCard
              label="Costos eventuales"
              value={formatMoney(resumen.totalCostosOperativos)}
            />
            <ResumenCard
              label="Utilidad operativa estimada"
              value={formatMoney(resumen.margenEstimado)}
              valueClassName={margenColor}
            />
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-lp-navy">
            {editandoId ? "Editar costo eventual" : "Agregar costo eventual"}
          </h2>

          {editandoId && (
            <span className="w-fit text-xs bg-lp-light text-lp-navy px-3 py-1 rounded-full font-semibold">
              Editando
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Fecha</label>
            <input
              type="date"
              value={fechaCosto}
              onChange={(e) => setFechaCosto(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1 xl:col-span-2">
            <label className="text-xs font-semibold text-lp-navy">
              Concepto
            </label>
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Volante, apoyo por horas, transporte..."
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Valor</label>
            <input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1 flex flex-col justify-end">
            <button
              onClick={guardarCosto}
              disabled={saving}
              className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
            >
              {saving
                ? "Guardando..."
                : editandoId
                ? "Actualizar"
                : "Agregar"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-lp-navy">Notas</label>
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas opcionales..."
            className="w-full border rounded-xl p-3 text-lp-navy bg-white"
          />
        </div>

        {editandoId && (
          <button
            onClick={limpiarFormulario}
            className="w-full sm:w-auto border border-lp-navy text-lp-navy rounded-xl px-4 py-2"
          >
            Cancelar edición
          </button>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">Resumen por día</h2>
        </div>

        {resumenDias.length === 0 ? (
          <div className="p-6 text-sm text-lp-navy/70">
            No hay información para este rango.
          </div>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-sm text-lp-navy">
                <thead className="bg-lp-navy text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Día</th>
                    <th className="px-4 py-3 text-right">Trabajos</th>
                    <th className="px-4 py-3 text-right">Trabajado</th>
                    <th className="px-4 py-3 text-right">Asignado</th>
                    <th className="px-4 py-3 text-right">Costo sin asignar</th>
                    <th className="px-4 py-3 text-right">Eventuales</th>
                    <th className="px-4 py-3 text-right">Utilidad operativa</th>
                  </tr>
                </thead>

                <tbody>
                  {resumenDias.map((dia) => (
                    <tr key={dia.fecha} className="border-b hover:bg-lp-light">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(dia.fecha)}
                      </td>
                      <td className="px-4 py-3 capitalize whitespace-nowrap">
                        {dia.dia || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {dia.trabajos}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatMoney(dia.totalTrabajado)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(dia.totalAsignadoCleaners)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(dia.totalPendienteAsignar)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(dia.totalCostosOperativos)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          dia.margenEstimado >= 0
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {formatMoney(dia.margenEstimado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="xl:hidden divide-y">
              {resumenDias.map((dia) => (
                <div key={dia.fecha} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-lp-navy/60 capitalize">
                        {dia.dia || "—"}
                      </p>
                      <p className="text-lg font-bold text-lp-navy">
                        {formatDate(dia.fecha)}
                      </p>
                    </div>

                    <p
                      className={`font-bold ${
                        dia.margenEstimado >= 0
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {formatMoney(dia.margenEstimado)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <MiniItem label="Trabajos" value={dia.trabajos} />
                    <MiniItem
                      label="Trabajado"
                      value={formatMoney(dia.totalTrabajado)}
                    />
                    <MiniItem
                      label="Asignado"
                      value={formatMoney(dia.totalAsignadoCleaners)}
                    />
                    <MiniItem
                      label="Costo sin asignar"
                      value={formatMoney(dia.totalPendienteAsignar)}
                    />
                    <MiniItem
                      label="Eventuales"
                      value={formatMoney(dia.totalCostosOperativos)}
                    />
                    <MiniItem
                      label="Utilidad operativa"
                      value={formatMoney(dia.margenEstimado)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">Costos eventuales</h2>

          <span className="text-sm font-bold text-lp-navy">
            {costosOperativos.length}
          </span>
        </div>

        {costosOperativos.length === 0 ? (
          <div className="p-6 text-sm text-lp-navy/70">
            No hay costos eventuales registrados en este rango.
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-lp-navy">
                <thead className="bg-lp-navy text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Concepto</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-left">Notas</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {costosOperativos.map((costo) => (
                    <tr key={costo.id} className="border-b hover:bg-lp-light">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(costo.fecha)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {costo.concepto}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatMoney(costo.valor)}
                      </td>
                      <td className="px-4 py-3 text-lp-navy/70 max-w-[260px] truncate">
                        {costo.notas || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => editarCosto(costo)}
                            className="border border-lp-navy text-lp-navy px-3 py-1 rounded-lg text-xs hover:bg-lp-light"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => eliminarCosto(costo.id)}
                            className="border border-red-500 text-red-500 px-3 py-1 rounded-lg text-xs hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y">
              {costosOperativos.map((costo) => (
                <div key={costo.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-lp-navy/60">
                        {formatDate(costo.fecha)}
                      </p>
                      <p className="font-bold text-lp-navy">
                        {costo.concepto}
                      </p>
                      {costo.notas && (
                        <p className="text-sm text-lp-navy/70 break-words">
                          {costo.notas}
                        </p>
                      )}
                    </div>

                    <p className="font-bold text-lp-navy shrink-0">
                      {formatMoney(costo.valor)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => editarCosto(costo)}
                      className="border border-lp-navy text-lp-navy px-3 py-2 rounded-lg text-sm"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarCosto(costo.id)}
                      className="border border-red-500 text-red-500 px-3 py-2 rounded-lg text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
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
    <div className="bg-lp-light rounded-xl p-4 min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className={`text-xl font-bold truncate ${valueClassName}`}>
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
    <div className="bg-lp-light rounded-xl p-3">
      <p className="text-xs text-lp-navy/60">{label}</p>
      <p className="font-bold text-lp-navy">{value}</p>
    </div>
  );
}