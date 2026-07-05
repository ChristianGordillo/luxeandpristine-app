"use client";

import { useEffect, useMemo, useState } from "react";

type RevisionEstado =
  | "SIN_NOVEDADES"
  | "NOVEDAD_REGISTRADA"
  | "INCIDENCIA_ABIERTA";

type Cleaner = {
  id: number;
  nombre: string;
};

type Unidad = {
  id: number;
  nombre: string;
  habitaciones?: number | null;
  banos?: number | null;
  edificio?: { nombre: string } | null;
};

type Asignacion = {
  id: number;
  rol: "CLEANER" | "VOLANTE";
  cleaner: Cleaner;
};

type Trabajo = {
  id: number;
  fecha: string;
  dia: string;
  tipo: string;
  precio: number;
  notas?: string | null;
  revisionEstado?: RevisionEstado | null;
  incidenciaAbierta?: boolean;
  unidad?: Unidad | null;
  unidadManual?: string | null;
  asignaciones: Asignacion[];
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function formatDate(fecha?: string | null) {
  if (!fecha) return "—";
  return fecha.split("T")[0].split("-").reverse().join("/");
}

function tipoLabel(tipo: string) {
  const labels: Record<string, string> = {
    LIMPIEZA_INICIAL: "Inicial",
    LIMPIEZA: "Limpieza",
    EXTRA: "Extra",
    REPASO_LIMPIEZA: "Repaso",
  };

  return labels[tipo] || tipo;
}

function getEstadoVisual(estado?: RevisionEstado | null) {
  if (estado === "SIN_NOVEDADES") {
    return {
      label: "Revisado sin novedades",
      badge: "Revisado",
      card: "bg-green-50 border-green-200",
      box: "bg-green-100 border-green-200 text-green-800",
    };
  }

  if (estado === "NOVEDAD_REGISTRADA") {
    return {
      label: "Novedad registrada sin seguimiento",
      badge: "Registrada",
      card: "bg-blue-50 border-blue-200",
      box: "bg-blue-100 border-blue-200 text-blue-800",
    };
  }

  if (estado === "INCIDENCIA_ABIERTA") {
    return {
      label: "Incidencia abierta",
      badge: "Abierta",
      card: "bg-red-50 border-red-200",
      box: "bg-red-100 border-red-200 text-red-800",
    };
  }

  return {
    label: "Pendiente de revisar",
    badge: "Pendiente",
    card: "bg-white border-gray-200",
    box: "bg-gray-100 border-gray-200 text-lp-navy",
  };
}

export default function AsignacionPage() {
  const [fecha, setFecha] = useState(getTodayInputValue());
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [notas, setNotas] = useState<Record<number, string>>({});
  const [estados, setEstados] = useState<Record<number, RevisionEstado>>({});
  const [editando, setEditando] = useState<Record<number, boolean>>({});
  const [lastActionId, setLastActionId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/lp/asignaciones?fecha=${fecha}`);
      const data = await res.json();

      const trabajosData: Trabajo[] = data.trabajos || [];

      setTrabajos(trabajosData);

      const notasIniciales: Record<number, string> = {};
      const estadosIniciales: Record<number, RevisionEstado> = {};
      const editandoInicial: Record<number, boolean> = {};

      trabajosData.forEach((trabajo) => {
        notasIniciales[trabajo.id] = trabajo.notas || "";
        estadosIniciales[trabajo.id] =
          trabajo.revisionEstado || "SIN_NOVEDADES";
        editandoInicial[trabajo.id] = !trabajo.revisionEstado;
      });

      setNotas(notasIniciales);
      setEstados(estadosIniciales);
      setEditando(editandoInicial);
    } catch (error) {
      console.error("Error cargando incidencias:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fecha]);

  const resumen = useMemo(() => {
    const asignados = trabajos.filter((t) => t.asignaciones.length > 0);
    const pendientes = trabajos.filter(
      (t) => t.asignaciones.length > 0 && !t.revisionEstado
    );
    const sinNovedades = trabajos.filter(
      (t) => t.revisionEstado === "SIN_NOVEDADES"
    );
    const novedades = trabajos.filter(
      (t) => t.revisionEstado === "NOVEDAD_REGISTRADA"
    );
    const abiertas = trabajos.filter(
      (t) => t.revisionEstado === "INCIDENCIA_ABIERTA"
    );

    return {
      asignados: asignados.length,
      pendientes: pendientes.length,
      sinNovedades: sinNovedades.length,
      novedades: novedades.length,
      abiertas: abiertas.length,
    };
  }, [trabajos]);

  const getNombreUnidad = (trabajo: Trabajo) => {
    return trabajo.unidad?.nombre || trabajo.unidadManual || "Unidad eventual";
  };

  const getEdificio = (trabajo: Trabajo) => {
    return trabajo.unidad?.edificio?.nombre || "Eventual";
  };

  const guardarRevision = async (trabajo: Trabajo) => {
    const revisionEstado = estados[trabajo.id];
    const nota = notas[trabajo.id]?.trim() || "";

    if (
      (revisionEstado === "NOVEDAD_REGISTRADA" ||
        revisionEstado === "INCIDENCIA_ABIERTA") &&
      !nota
    ) {
      alert("Escribe la novedad antes de guardar.");
      return;
    }

    try {
      setSavingId(trabajo.id);

      const res = await fetch("/api/lp/asignaciones", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trabajoId: trabajo.id,
          revisionEstado,
          notas: revisionEstado === "SIN_NOVEDADES" ? null : nota,
        }),
      });

      if (!res.ok) {
        alert("Error al guardar revisión.");
        return;
      }

      setLastActionId(trabajo.id);
      await fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al guardar revisión.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando incidencias...</p>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Incidencias del día
        </h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Cierra el ciclo de cada trabajo: sin novedades, novedad registrada o
          incidencia abierta.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-lp-navy">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full border rounded-xl p-3 text-lp-navy bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ResumenCard label="Pendientes" value={resumen.pendientes} />
          <ResumenCard label="Abiertas" value={resumen.abiertas} />
          <ResumenCard label="Novedades" value={resumen.novedades} />
          <ResumenCard label="Sin novedades" value={resumen.sinNovedades} />
        </div>
      </div>

      {trabajos.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm text-lp-navy/70">
          No hay trabajos registrados para esta fecha.
        </div>
      ) : (
        <div className="space-y-4">
          {trabajos.map((trabajo) => {
            const sinAsignacion = trabajo.asignaciones.length === 0;
            const estadoActual = trabajo.revisionEstado || null;
            const visual = getEstadoVisual(estadoActual);
            const estaEditando = editando[trabajo.id] || !estadoActual;

            return (
              <section
                key={trabajo.id}
                className={`border rounded-2xl shadow-sm overflow-hidden ${visual.card}`}
              >
                <div className="p-4 space-y-3 border-b bg-white/75">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-lp-navy/60 capitalize">
                        {formatDate(trabajo.fecha)} · {trabajo.dia}
                      </p>

                      <h2 className="text-xl font-bold text-lp-navy truncate">
                        Unidad {getNombreUnidad(trabajo)}
                      </h2>

                      <p className="text-sm text-lp-navy/70">
                        {getEdificio(trabajo)} · {tipoLabel(trabajo.tipo)}
                      </p>
                    </div>

                    <EstadoBadge
                      sinAsignacion={sinAsignacion}
                      estado={estadoActual}
                    />
                  </div>

                  {trabajo.asignaciones.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {trabajo.asignaciones.map((asignacion) => (
                        <span
                          key={asignacion.id}
                          className="text-xs font-semibold bg-white border rounded-full px-3 py-1 text-lp-navy"
                        >
                          {asignacion.cleaner.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {lastActionId === trabajo.id && (
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm font-semibold text-blue-700">
                      Acción guardada correctamente.
                    </div>
                  )}

                  {sinAsignacion ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                      Este trabajo todavía no tiene cleaner asignado.
                    </div>
                  ) : (
                    <>
                      <div className={`rounded-xl border p-3 ${visual.box}`}>
                        <p className="text-sm font-bold">{visual.label}</p>
                        <p className="text-xs mt-1 opacity-80">
                          {estadoActual
                            ? estaEditando
                              ? "Modo edición activado."
                              : "Esta revisión está protegida. Puedes editarla si necesitas corregir algo."
                            : "Selecciona el resultado de la revisión para cerrar el ciclo."}
                        </p>
                      </div>

                      <fieldset
                        disabled={!estaEditando || savingId === trabajo.id}
                        className={!estaEditando ? "opacity-60" : ""}
                      >
                        <p className="text-xs font-semibold text-lp-navy mb-2">
                          Estado de revisión
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                          <EstadoOption
                            label="Sin novedades"
                            description="El trabajo queda revisado y sin seguimiento."
                            value="SIN_NOVEDADES"
                            selected={estados[trabajo.id]}
                            onChange={(value) =>
                              setEstados((prev) => ({
                                ...prev,
                                [trabajo.id]: value,
                              }))
                            }
                          />

                          <EstadoOption
                            label="Novedad registrada"
                            description="Se deja historial, pero no requiere seguimiento."
                            value="NOVEDAD_REGISTRADA"
                            selected={estados[trabajo.id]}
                            onChange={(value) =>
                              setEstados((prev) => ({
                                ...prev,
                                [trabajo.id]: value,
                              }))
                            }
                          />

                          <EstadoOption
                            label="Incidencia abierta"
                            description="Requiere acción posterior y aparecerá en Incidencias."
                            value="INCIDENCIA_ABIERTA"
                            selected={estados[trabajo.id]}
                            onChange={(value) =>
                              setEstados((prev) => ({
                                ...prev,
                                [trabajo.id]: value,
                              }))
                            }
                          />
                        </div>

                        <div className="mt-4 space-y-1">
                          <label className="text-xs font-semibold text-lp-navy">
                            Notas
                          </label>
                          <textarea
                            value={notas[trabajo.id] || ""}
                            onChange={(e) =>
                              setNotas((prev) => ({
                                ...prev,
                                [trabajo.id]: e.target.value,
                              }))
                            }
                            placeholder="Ej: falta 1 bath towel, toalla manchada, ropa secando en bodega..."
                            rows={4}
                            className="w-full border rounded-xl p-3 text-lp-navy resize-none bg-white disabled:bg-gray-50"
                          />
                        </div>
                      </fieldset>

                      {estaEditando ? (
                        <div className="grid grid-cols-1 gap-3">
                          <button
                            type="button"
                            onClick={() => guardarRevision(trabajo)}
                            disabled={savingId === trabajo.id}
                            className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
                          >
                            {savingId === trabajo.id
                              ? "Guardando..."
                              : "Guardar revisión"}
                          </button>

                          {estadoActual && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditando((prev) => ({
                                  ...prev,
                                  [trabajo.id]: false,
                                }))
                              }
                              className="w-full border border-lp-navy text-lp-navy rounded-xl font-semibold px-4 py-3 bg-white"
                            >
                              Cancelar edición
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditando((prev) => ({
                              ...prev,
                              [trabajo.id]: true,
                            }))
                          }
                          className="w-full border border-lp-navy text-lp-navy rounded-xl font-semibold px-4 py-3 bg-white"
                        >
                          Editar revisión
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EstadoOption({
  label,
  description,
  value,
  selected,
  onChange,
}: {
  label: string;
  description: string;
  value: RevisionEstado;
  selected?: RevisionEstado;
  onChange: (value: RevisionEstado) => void;
}) {
  const active = selected === value;

  return (
    <label
      className={`flex gap-3 rounded-xl border p-3 bg-white ${
        active ? "border-lp-gold ring-1 ring-lp-gold" : "border-gray-200"
      }`}
    >
      <input
        type="radio"
        checked={active}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4"
      />

      <span>
        <span className="block text-sm font-bold text-lp-navy">{label}</span>
        <span className="block text-xs text-lp-navy/60 mt-0.5">
          {description}
        </span>
      </span>
    </label>
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
    <div className="bg-lp-light rounded-xl p-3 min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className="text-xl font-bold text-lp-navy truncate">{value}</p>
    </div>
  );
}

function EstadoBadge({
  sinAsignacion,
  estado,
}: {
  sinAsignacion: boolean;
  estado?: RevisionEstado | null;
}) {
  if (sinAsignacion) {
    return (
      <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full whitespace-nowrap">
        Sin cleaner
      </span>
    );
  }

  if (estado === "INCIDENCIA_ABIERTA") {
    return (
      <span className="text-xs font-semibold bg-red-100 text-red-700 px-3 py-1 rounded-full whitespace-nowrap">
        Abierta
      </span>
    );
  }

  if (estado === "NOVEDAD_REGISTRADA") {
    return (
      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full whitespace-nowrap">
        Registrada
      </span>
    );
  }

  if (estado === "SIN_NOVEDADES") {
    return (
      <span className="text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full whitespace-nowrap">
        Revisada
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-1 rounded-full whitespace-nowrap">
      Pendiente
    </span>
  );
}