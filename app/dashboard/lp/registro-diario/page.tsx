"use client";

import { useEffect, useMemo, useState } from "react";
import RegistroCalendarioNav from "@/app/components/lp/RegistroCalendarioNav";

type Unidad = {
  id: number;
  nombre: string;
  precio: number;
  habitaciones?: number | null;
  banos?: number | null;
  edificio?: { nombre: string } | null;
  trabajos?: {
    id: number;
    fecha: string;
    notas?: string | null;
  }[];
  ropaPendiente?: {
    id: number;
    createdAt: string;
  }[];
};

type TrabajoTipo =
  | "LIMPIEZA_INICIAL"
  | "LIMPIEZA"
  | "EXTRA"
  | "REPASO_LIMPIEZA";

type Trabajo = {
  id: number;
  fecha: string;
  dia: string;
  tipo: TrabajoTipo;
  precio: number;
  notas?: string;
  checkIn?: boolean;
  unidadId?: number | null;
  unidad?: Unidad | null;
  unidadManual?: string | null;
};

type Resumen = {
  cantidad: number;
  total: number;
  limpiezaInicial: number;
  limpieza: number;
  extra: number;
  repasoLimpieza: number;
};

const tiposTrabajo: { value: TrabajoTipo; label: string }[] = [
  { value: "LIMPIEZA_INICIAL", label: "Limpieza inicial" },
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "EXTRA", label: "Extra" },
  { value: "REPASO_LIMPIEZA", label: "Repaso de limpieza" },
];

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function getDiaSemana(fechaString: string) {
  const [year, month, day] = fechaString.split("-").map(Number);
  const fechaUTC = new Date(Date.UTC(year, month - 1, day));

  return fechaUTC.toLocaleDateString("es-ES", {
    weekday: "long",
    timeZone: "UTC",
  });
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

function tipoLabel(tipo: TrabajoTipo) {
  return tiposTrabajo.find((t) => t.value === tipo)?.label || tipo;
}

function formatFechaInput(fecha: string) {
  return fecha.split("T")[0];
}

export default function RegistroDiarioPage() {
  const today = getTodayInputValue();

  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  const [fecha, setFecha] = useState(today);
  const [fechaFacturacion, setFechaFacturacion] = useState(today);
  const [fechaFacturacionDraft, setFechaFacturacionDraft] = useState(today);

  const [busquedaUnidad, setBusquedaUnidad] = useState("");
  const [unidadId, setUnidadId] = useState("");
  const [tipo, setTipo] = useState<TrabajoTipo>("LIMPIEZA");
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");
  const [checkIn, setCheckIn] = useState(false);

  const [detalleUnidadAbierto, setDetalleUnidadAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const unidadSeleccionada = useMemo(() => {
    return unidades.find((u) => String(u.id) === unidadId);
  }, [unidades, unidadId]);

  const unidadesFiltradas = useMemo(() => {
    const texto = busquedaUnidad.toLowerCase().trim();

    return unidades
      .filter((u) => {
        if (!texto) return false;

        return (
          u.nombre.toLowerCase().includes(texto) ||
          u.edificio?.nombre?.toLowerCase().includes(texto)
        );
      })
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      )
      .slice(0, 8);
  }, [unidades, busquedaUnidad]);

  const resumen = useMemo<Resumen>(() => {
    return {
      cantidad: trabajos.length,
      total: trabajos.reduce((acc, t) => acc + Number(t.precio || 0), 0),
      limpiezaInicial: trabajos.filter((t) => t.tipo === "LIMPIEZA_INICIAL")
        .length,
      limpieza: trabajos.filter((t) => t.tipo === "LIMPIEZA").length,
      extra: trabajos.filter((t) => t.tipo === "EXTRA").length,
      repasoLimpieza: trabajos.filter((t) => t.tipo === "REPASO_LIMPIEZA")
        .length,
    };
  }, [trabajos]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [trabajosRes, unidadesRes] = await Promise.all([
        fetch(
          `/api/lp/trabajos?desde=${fechaFacturacion}&hasta=${fechaFacturacion}`
        ),
        fetch("/api/lp/unidades"),
      ]);

      const trabajosData = await trabajosRes.json();
      const unidadesData = await unidadesRes.json();

      setTrabajos(trabajosData.trabajos || []);
      setUnidades(unidadesData.unidades || []);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fechaFacturacion]);

  const calcularPrecio = (nuevoTipo: TrabajoTipo, unidad?: Unidad) => {
    if (nuevoTipo === "REPASO_LIMPIEZA") return "20";
    if (nuevoTipo === "EXTRA") return "";
    if (unidad) return String(unidad.precio);
    return "";
  };

  const handleSeleccionarUnidad = (unidad: Unidad) => {
    setUnidadId(String(unidad.id));
    setBusquedaUnidad(
      `${unidad.edificio?.nombre || "Sin edificio"} · ${unidad.nombre}`
    );
    setPrecio(calcularPrecio(tipo, unidad));
    setDetalleUnidadAbierto(false);
  };

  const handleTipoChange = (nuevoTipo: TrabajoTipo) => {
    setTipo(nuevoTipo);
    setPrecio(calcularPrecio(nuevoTipo, unidadSeleccionada));
  };

  const limpiarFormulario = () => {
    setFecha(getTodayInputValue());
    setBusquedaUnidad("");
    setUnidadId("");
    setTipo("LIMPIEZA");
    setPrecio("");
    setNotas("");
    setCheckIn(false);
    setDetalleUnidadAbierto(false);
  };

  const crearTrabajo = async () => {
    const unidadManual = busquedaUnidad.trim();

    if (!fecha || !tipo || precio === "" || (!unidadId && !unidadManual)) {
      alert("Completa fecha, unidad, tipo y precio.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lp/trabajos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          unidadId: unidadId ? Number(unidadId) : null,
          unidadManual: unidadId ? null : unidadManual,
          tipo,
          precio: Number(precio),
          notas,
          checkIn,
        }),
      });

      if (!res.ok) {
        alert("Error al crear el trabajo");
        return;
      }

      limpiarFormulario();
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al crear el trabajo");
    } finally {
      setSaving(false);
    }
  };

  const cargarTrabajoParaEditar = (trabajo: Trabajo) => {
    setEditandoId(trabajo.id);
    setFecha(formatFechaInput(trabajo.fecha));

    if (trabajo.unidad) {
      setUnidadId(String(trabajo.unidad.id));
      setBusquedaUnidad(
        `${trabajo.unidad.edificio?.nombre || "Sin edificio"} · ${
          trabajo.unidad.nombre
        }`
      );
    } else {
      setUnidadId("");
      setBusquedaUnidad(trabajo.unidadManual || "");
    }

    setTipo(trabajo.tipo);
    setPrecio(String(trabajo.precio));
    setNotas(trabajo.notas || "");
    setCheckIn(Boolean(trabajo.checkIn));
    setDetalleUnidadAbierto(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const actualizarTrabajo = async () => {
    if (!editandoId) return;

    const unidadManual = busquedaUnidad.trim();

    if (!fecha || !tipo || precio === "" || (!unidadId && !unidadManual)) {
      alert("Completa fecha, unidad, tipo y precio.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lp/trabajos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editandoId,
          fecha,
          unidadId: unidadId ? Number(unidadId) : null,
          unidadManual: unidadId ? null : unidadManual,
          tipo,
          precio: Number(precio),
          notas,
          checkIn,
        }),
      });

      if (!res.ok) {
        alert("Error al actualizar");
        return;
      }

      setEditandoId(null);
      limpiarFormulario();
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const eliminarTrabajo = async (id: number) => {
    const confirmar = confirm("¿Seguro que deseas eliminar este registro?");
    if (!confirmar) return;

    try {
      const res = await fetch(`/api/lp/trabajos?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Error al eliminar");
        return;
      }

      if (editandoId === id) {
        setEditandoId(null);
        limpiarFormulario();
      }

      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar");
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando registro...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Registro diario</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Paso 1: programación diaria de unidades y trabajos.
        </p>
      </div>
      <RegistroCalendarioNav />
      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-lp-navy">
            {editandoId ? "Editar trabajo" : "Agregar trabajo"}
          </h2>

          <span className="w-fit text-xs bg-lp-light text-lp-navy px-3 py-1 rounded-full font-semibold capitalize">
            {getDiaSemana(fecha)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1 md:col-span-2 xl:col-span-2 relative">
            <label className="text-xs font-semibold text-lp-navy">Unidad</label>

            <div className="relative">
              <input
                value={busquedaUnidad}
                onChange={(e) => {
                  setBusquedaUnidad(e.target.value);
                  setUnidadId("");
                  setDetalleUnidadAbierto(false);
                }}
                placeholder="Buscar unidad..."
                className="w-full border rounded-xl p-3 pr-10 text-lp-navy bg-white"
              />

              {busquedaUnidad && (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaUnidad("");
                    setUnidadId("");
                    setPrecio(calcularPrecio(tipo));
                    setDetalleUnidadAbierto(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lp-navy/50 hover:text-lp-navy"
                >
                  ✕
                </button>
              )}
            </div>

            {busquedaUnidad && !unidadId && unidadesFiltradas.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {unidadesFiltradas.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSeleccionarUnidad(u)}
                    className="w-full text-left px-3 py-3 hover:bg-lp-light text-sm text-lp-navy border-b last:border-b-0"
                  >
                    <p className="font-semibold">Unidad {u.nombre}</p>
                    <p className="text-xs text-lp-navy/60">
                      {u.edificio?.nombre || "Sin edificio"} ·{" "}
                      {u.habitaciones ?? "—"} hab · {u.banos ?? "—"} baños ·{" "}
                      {formatMoney(u.precio)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Descripción
            </label>
            <select
              value={tipo}
              onChange={(e) => handleTipoChange(e.target.value as TrabajoTipo)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            >
              {tiposTrabajo.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Precio</label>
            <input
              type="number"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0"
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1 flex flex-col justify-end md:col-span-2 xl:col-span-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={editandoId ? actualizarTrabajo : crearTrabajo}
                disabled={saving}
                className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
              >
                {saving
                  ? "Guardando..."
                  : editandoId
                  ? "Actualizar"
                  : "Agregar"}
              </button>

              {editandoId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditandoId(null);
                    limpiarFormulario();
                  }}
                  className="w-full sm:w-auto border border-lp-navy text-lp-navy rounded-xl px-4 py-3"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>

        {unidadSeleccionada && (
          <div className="border border-lp-gold/30 bg-lp-light rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setDetalleUnidadAbierto(!detalleUnidadAbierto)}
              className="w-full p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-lp-navy/60">
                    {unidadSeleccionada.edificio?.nombre || "Sin edificio"}
                  </p>

                  <h3 className="text-lg font-bold text-lp-navy truncate">
                    Unidad {unidadSeleccionada.nombre}
                  </h3>

                  <p className="text-sm text-lp-navy/70">
                    Tipo {unidadSeleccionada.habitaciones ?? "—"}/
                    {unidadSeleccionada.banos ?? "—"} · Base{" "}
                    {formatMoney(unidadSeleccionada.precio)}
                  </p>
                </div>

                <span className="shrink-0 text-xs font-semibold bg-white text-lp-navy rounded-full px-3 py-1">
                  {detalleUnidadAbierto ? "Ocultar" : "Ver más"}
                </span>
              </div>
            </button>

            <div className="px-4 pb-4">
              <FlagsUnidad unidad={unidadSeleccionada} checkIn={checkIn} />
            </div>

            {detalleUnidadAbierto && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
                <InfoMini
                  label="Edificio"
                  value={unidadSeleccionada.edificio?.nombre || "—"}
                />
                <InfoMini
                  label="Habitaciones"
                  value={unidadSeleccionada.habitaciones ?? "—"}
                />
                <InfoMini label="Baños" value={unidadSeleccionada.banos ?? "—"} />
                <InfoMini
                  label="Precio base"
                  value={formatMoney(unidadSeleccionada.precio)}
                />
              </div>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 rounded-xl border bg-white p-3">
          <input
            type="checkbox"
            checked={checkIn}
            onChange={(e) => setCheckIn(e.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-sm font-semibold text-lp-navy">
            Esta unidad tiene check-in
          </span>
        </label>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-lp-navy">Notas</label>
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas opcionales..."
            className="w-full border rounded-xl p-3 text-lp-navy bg-white"
          />
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="font-bold text-lp-navy">Filtro de facturación</h2>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
                <label className="block text-xs font-semibold text-lp-navy mb-1">
                    Fecha
                </label>

                <input
                    type="date"
                    value={fechaFacturacionDraft}
                    onChange={(e) => setFechaFacturacionDraft(e.target.value)}
                    className="w-full h-[56px] border rounded-xl px-4 text-lp-navy"
                />
            </div>

            <button
                type="button"
                onClick={() => setFechaFacturacion(fechaFacturacionDraft)}
                className="h-[56px] px-8 bg-lp-navy text-white rounded-xl font-semibold"
            >
                Aplicar
            </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <ResumenCard label="Trabajos" value={resumen.cantidad} />
          <ResumenCard label="Total" value={formatMoney(resumen.total)} />
          <ResumenCard label="Limpiezas" value={resumen.limpieza} />
          <ResumenCard label="Iniciales" value={resumen.limpiezaInicial} />
          <ResumenCard label="Extras" value={resumen.extra} />
          <ResumenCard label="Repasos" value={resumen.repasoLimpieza} />
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">Registros</h2>

          <span className="text-sm font-bold text-lp-navy">
            {formatMoney(resumen.total)}
          </span>
        </div>

        {trabajos.length === 0 ? (
          <div className="p-6 text-sm text-lp-navy/70">
            No hay registros en esta fecha.
          </div>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-sm text-lp-navy">
                <thead className="bg-lp-navy text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Día</th>
                    <th className="px-4 py-3 text-left">Unidad</th>
                    <th className="px-4 py-3 text-left">Edificio</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Alertas</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-left">Notas</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {trabajos.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-lp-light">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(t.fecha)}
                      </td>
                      <td className="px-4 py-3 capitalize whitespace-nowrap">
                        {t.dia}
                      </td>
                      <td className="px-4 py-3 font-bold whitespace-nowrap">
                        {t.unidad?.nombre || t.unidadManual || "Unidad eventual"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.unidad?.edificio?.nombre || "Eventual"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tipoLabel(t.tipo)}
                      </td>
                      <td className="px-4 py-3">
                        <FlagsUnidad
                          unidad={t.unidad}
                          checkIn={Boolean(t.checkIn)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                        {formatMoney(t.precio)}
                      </td>
                      <td className="px-4 py-3 text-lp-navy/70 max-w-[220px] truncate">
                        {t.notas || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => cargarTrabajoParaEditar(t)}
                            className="border border-lp-navy text-lp-navy px-3 py-1 rounded-lg text-xs hover:bg-lp-light"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => eliminarTrabajo(t.id)}
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

            <div className="xl:hidden divide-y">
              {trabajos.map((t) => (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-lp-navy/60">
                        {formatDate(t.fecha)} ·{" "}
                        <span className="capitalize">{t.dia}</span>
                      </p>

                      <p className="text-lg font-bold text-lp-navy truncate">
                        {t.unidad
                          ? `Unidad ${t.unidad.nombre}`
                          : t.unidadManual || "Unidad eventual"}
                      </p>

                      <p className="text-sm text-lp-navy/70 truncate">
                        {t.unidad?.edificio?.nombre || "Eventual"}
                      </p>

                      {t.unidad && (
                        <p className="text-xs text-lp-navy/60">
                          Tipo {t.unidad.habitaciones ?? "—"}/
                          {t.unidad.banos ?? "—"}
                        </p>
                      )}
                    </div>

                    <p className="font-bold text-lp-navy shrink-0">
                      {formatMoney(t.precio)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="bg-lp-light text-lp-navy text-xs font-semibold px-2.5 py-1 rounded-full">
                      {tipoLabel(t.tipo)}
                    </span>

                    <FlagsUnidad
                      unidad={t.unidad}
                      checkIn={Boolean(t.checkIn)}
                    />
                  </div>

                  {t.notas && (
                    <p className="text-sm text-lp-navy/70 break-words">
                      Notas: {t.notas}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => cargarTrabajoParaEditar(t)}
                      className="border border-lp-navy text-lp-navy px-3 py-2 rounded-lg text-sm"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarTrabajo(t.id)}
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

function FlagsUnidad({
  unidad,
  checkIn,
}: {
  unidad?: Unidad | null;
  checkIn?: boolean;
}) {
  const tieneIncidencias = (unidad?.trabajos?.length || 0) > 0;
  const tieneRopaPendiente = (unidad?.ropaPendiente?.length || 0) > 0;

  if (!checkIn && !tieneIncidencias && !tieneRopaPendiente) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {checkIn && (
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
          Check-in
        </span>
      )}

      {tieneIncidencias && (
        <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
          Incidencia abierta
        </span>
      )}

      {tieneRopaPendiente && (
        <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2.5 py-1 rounded-full">
          Ropa por llevar
        </span>
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
    <div className="bg-white rounded-xl p-3 min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className="font-bold text-lp-navy truncate">{value}</p>
    </div>
  );
}