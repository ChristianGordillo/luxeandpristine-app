"use client";

import { useEffect, useMemo, useState } from "react";

type RolOperativo = "CLEANER" | "VOLANTE";

type Cleaner = {
  id: number;
  nombre: string;
  telefono?: string | null;
  paisOrigen?: string | null;
};

type Unidad = {
  id: number;
  nombre: string;
  precio: number;
  habitaciones?: number | null;
  banos?: number | null;
  edificio?: {
    nombre: string;
  } | null;
};

type Asignacion = {
  id: number;
  rol: RolOperativo;
  valorPago: number;
  notas?: string | null;
  cleaner: Cleaner;
};

type Trabajo = {
  id: number;
  fecha: string;
  dia: string;
  tipo: string;
  precio: number;
  notas?: string | null;
  unidadId?: number | null;
  unidad?: Unidad | null;
  unidadManual?: string | null;
  asignaciones: Asignacion[];
};

type TrabajoTrazabilidad = {
  id: number;
  fecha: string;
  dia: string;
  tipo: string;
  precio: number;
  notas?: string | null;
  asignaciones: Asignacion[];
};

type UnidadTrazabilidad = {
  id: number;
  nombre: string;
  habitaciones?: number | null;
  banos?: number | null;
  precio: number;
  edificio?: {
    nombre: string;
  } | null;
  ultimoTrabajo: TrabajoTrazabilidad | null;
  historial: TrabajoTrazabilidad[];
};

type FormAsignacion = {
  cleanerId: string;
  rol: RolOperativo;
  valorPago: string;
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
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

function calcularPagoCleaner(
  precioTrabajo: number,
  tipo: string,
  rol: RolOperativo
) {
  if (rol === "VOLANTE") return "";

  if (tipo === "REPASO_LIMPIEZA") return "10";

  if (Number(precioTrabajo) === 80) return "60";
  if (Number(precioTrabajo) === 68) return "55";
  if (Number(precioTrabajo) === 65) return "50";
  if (Number(precioTrabajo) === 55) return "40";
  if (Number(precioTrabajo) === 20) return "10";

  return "";
}

export default function ProgramacionPage() {
  const [fecha, setFecha] = useState(getTodayInputValue());
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [trazabilidad, setTrazabilidad] = useState<UnidadTrazabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [formularios, setFormularios] = useState<
    Record<number, FormAsignacion>
  >({});

  const [historialAbierto, setHistorialAbierto] = useState<
    Record<number, boolean>
  >({});

  const fetchData = async () => {
    try {
      setLoading(true);

      const [asignacionesRes, trazabilidadRes] = await Promise.all([
        fetch(`/api/lp/asignaciones?fecha=${fecha}`),
        fetch("/api/lp/trazabilidad"),
      ]);

      const asignacionesData = await asignacionesRes.json();
      const trazabilidadData = await trazabilidadRes.json();

      setTrabajos(asignacionesData.trabajos || []);
      setCleaners(asignacionesData.cleaners || []);
      setTrazabilidad(trazabilidadData.trazabilidad || []);
    } catch (error) {
      console.error("Error cargando programación:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fecha]);

  const trazabilidadPorUnidad = useMemo(() => {
    const mapa = new Map<number, UnidadTrazabilidad>();

    trazabilidad.forEach((unidad) => {
      mapa.set(unidad.id, unidad);
    });

    return mapa;
  }, [trazabilidad]);

  const resumen = useMemo(() => {
    const asignados = trabajos.filter((t) => t.asignaciones.length > 0).length;

    const totalIngreso = trabajos.reduce(
      (acc, t) => acc + Number(t.precio || 0),
      0
    );

    const totalPagoSugerido = trabajos.reduce((acc, t) => {
      const sugerido = calcularPagoCleaner(t.precio, t.tipo, "CLEANER");
      return acc + Number(sugerido || 0);
    }, 0);

    return {
      trabajos: trabajos.length,
      asignados,
      pendientes: trabajos.length - asignados,
      totalIngreso,
      totalPagoSugerido,
    };
  }, [trabajos]);

  const getNombreUnidad = (trabajo: Trabajo) => {
    return trabajo.unidad?.nombre || trabajo.unidadManual || "Unidad eventual";
  };

  const getEdificio = (trabajo: Trabajo) => {
    return trabajo.unidad?.edificio?.nombre || "Eventual";
  };

  const getFormulario = (trabajo: Trabajo): FormAsignacion => {
    return (
      formularios[trabajo.id] || {
        cleanerId: "",
        rol: "CLEANER",
        valorPago: calcularPagoCleaner(trabajo.precio, trabajo.tipo, "CLEANER"),
      }
    );
  };

  const actualizarFormulario = (
    trabajo: Trabajo,
    campo: keyof FormAsignacion,
    valor: string
  ) => {
    setFormularios((prev) => {
      const actual = getFormulario(trabajo);

      const nuevo: FormAsignacion = {
        ...actual,
        [campo]: valor,
      };

      if (campo === "rol") {
        nuevo.valorPago = calcularPagoCleaner(
          trabajo.precio,
          trabajo.tipo,
          valor as RolOperativo
        );
      }

      return {
        ...prev,
        [trabajo.id]: nuevo,
      };
    });
  };

  const limpiarFormularioTrabajo = (trabajoId: number) => {
    setFormularios((prev) => {
      const copy = { ...prev };
      delete copy[trabajoId];
      return copy;
    });
  };

  const crearAsignacion = async (trabajo: Trabajo) => {
    const form = getFormulario(trabajo);

    if (!form.cleanerId || !form.rol || form.valorPago === "") {
      alert("Selecciona cleaner, rol y valor de pago.");
      return;
    }

    try {
      setSavingId(trabajo.id);

      const res = await fetch("/api/lp/asignaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trabajoId: trabajo.id,
          cleanerId: Number(form.cleanerId),
          rol: form.rol,
          valorPago: Number(form.valorPago),
          notas: null,
        }),
      });

      if (!res.ok) {
        alert("Error al crear asignación");
        return;
      }

      limpiarFormularioTrabajo(trabajo.id);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al crear asignación");
    } finally {
      setSavingId(null);
    }
  };

  const eliminarAsignacion = async (id: number) => {
    const confirmar = confirm("¿Eliminar esta asignación?");
    if (!confirmar) return;

    try {
      const res = await fetch(`/api/lp/asignaciones?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Error al eliminar asignación");
        return;
      }

      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar asignación");
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando programación...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Programación cleaners
        </h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Paso 2: asigna cleaners y revisa incidencias anteriores antes de enviar el trabajo.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <ResumenCard label="Trabajos" value={resumen.trabajos} />
          <ResumenCard label="Asignados" value={resumen.asignados} />
          <ResumenCard label="Pendientes" value={resumen.pendientes} />
          <ResumenCard
            label="Ingreso L&P"
            value={formatMoney(resumen.totalIngreso)}
          />
          <ResumenCard
            label="Pago sugerido"
            value={formatMoney(resumen.totalPagoSugerido)}
          />
        </div>
      </div>

      {cleaners.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
          No hay cleaners activos registrados. Primero crea cleaners en la pantalla de Cleaners.
        </div>
      )}

      {trabajos.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-6 text-sm text-lp-navy/70">
          No hay trabajos registrados para esta fecha.
        </div>
      ) : (
        <div className="space-y-4">
          {trabajos.map((trabajo) => {
            const form = getFormulario(trabajo);

            const unidadTrazabilidad = trabajo.unidadId
              ? trazabilidadPorUnidad.get(trabajo.unidadId)
              : null;

            const ultimoTrabajo =
              unidadTrazabilidad?.historial?.find(
                (item) => item.id !== trabajo.id
              ) || null;

            const notasHistorial =
              unidadTrazabilidad?.historial
                ?.filter((item) => item.id !== trabajo.id && item.notas)
                .slice(0, 8) || [];

            const pagoSugerido = calcularPagoCleaner(
              trabajo.precio,
              trabajo.tipo,
              form.rol
            );

            const asignado = trabajo.asignaciones.length > 0;

            return (
              <section
                key={trabajo.id}
                className="bg-white border rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5 border-b bg-lp-light space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-lp-navy/60 capitalize">
                        {formatDate(trabajo.fecha)} · {trabajo.dia}
                      </p>

                      <h2 className="text-xl font-bold text-lp-navy truncate">
                        Unidad {getNombreUnidad(trabajo)}
                      </h2>

                      <p className="text-sm text-lp-navy/70">
                        {getEdificio(trabajo)} · Tipo{" "}
                        {trabajo.unidad?.habitaciones ?? "—"}/
                        {trabajo.unidad?.banos ?? "—"} ·{" "}
                        {tipoLabel(trabajo.tipo)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge>Ingreso {formatMoney(trabajo.precio)}</Badge>
                      <Badge>
                        Sugerido {formatMoney(Number(pagoSugerido || 0))}
                      </Badge>

                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          asignado
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {asignado ? "Asignado" : "Pendiente"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InfoCard
                      label="Última limpieza"
                      value={
                        ultimoTrabajo
                          ? `${formatDate(ultimoTrabajo.fecha)} · ${tipoLabel(
                              ultimoTrabajo.tipo
                            )}`
                          : "Sin historial"
                      }
                    />

                    <InfoCard
                      label="Último cleaner"
                      value={
                        ultimoTrabajo?.asignaciones?.length
                          ? ultimoTrabajo.asignaciones
                              .map((a) => a.cleaner.nombre)
                              .join(", ")
                          : "Sin asignar"
                      }
                    />

                    <InfoCard
                      label="Última incidencia"
                      value={ultimoTrabajo?.notas || "—"}
                    />
                  </div>

                  {trabajo.notas && (
                    <div className="bg-white border border-lp-gold/30 rounded-xl p-3">
                      <p className="text-xs font-semibold text-lp-navy/60">
                        Nota del registro diario
                      </p>
                      <p className="text-sm text-lp-navy mt-1 break-words">
                        {trabajo.notas}
                      </p>
                    </div>
                  )}

                  {notasHistorial.length > 0 && (
                    <div className="bg-white border border-lp-gold/30 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setHistorialAbierto((prev) => ({
                            ...prev,
                            [trabajo.id]: !prev[trabajo.id],
                          }))
                        }
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="text-xs font-semibold text-lp-navy/60">
                            Gestión de la unidad
                          </p>
                          <p className="text-sm font-bold text-lp-navy">
                            Historial de incidencias anteriores
                          </p>
                        </div>

                        <span className="text-xs font-semibold text-lp-navy shrink-0">
                          {historialAbierto[trabajo.id]
                            ? "Ocultar"
                            : `${notasHistorial.length} notas`}
                        </span>
                      </button>

                      {historialAbierto[trabajo.id] && (
                        <div className="border-t px-4 py-3 space-y-3">
                          {notasHistorial.map((item) => (
                            <div
                              key={item.id}
                              className="border-l-4 border-lp-gold pl-3"
                            >
                              <p className="text-xs text-lp-navy/60">
                                {formatDate(item.fecha)} ·{" "}
                                {tipoLabel(item.tipo)}
                              </p>

                              <p className="text-sm text-lp-navy mt-1 break-words">
                                {item.notas}
                              </p>

                              {item.asignaciones?.length > 0 && (
                                <p className="text-xs text-lp-navy/50 mt-1">
                                  Cleaner:{" "}
                                  {item.asignaciones
                                    .map((a) => a.cleaner.nombre)
                                    .join(", ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {trabajo.asignaciones.length > 0 && (
                  <div className="p-4 sm:p-5 space-y-3 border-b">
                    <h3 className="font-bold text-lp-navy text-sm">
                      Cleaner asignado
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {trabajo.asignaciones.map((asignacion) => (
                        <div
                          key={asignacion.id}
                          className="border rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-lp-navy truncate">
                                {asignacion.cleaner.nombre}
                              </p>

                              <p className="text-xs text-lp-navy/60">
                                {asignacion.rol === "CLEANER"
                                  ? "Cleaner"
                                  : "Volante"}
                              </p>
                            </div>

                            <p className="font-bold text-lp-navy shrink-0">
                              {formatMoney(asignacion.valorPago)}
                            </p>
                          </div>

                          <button
                            onClick={() => eliminarAsignacion(asignacion.id)}
                            className="w-full border border-red-500 text-red-500 rounded-lg px-3 py-2 text-sm hover:bg-red-50"
                          >
                            Eliminar asignación
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trabajo.asignaciones.length === 0 && (
                  <div className="p-4 sm:p-5 space-y-3">
                    <h3 className="font-bold text-lp-navy text-sm">
                      Asignar cleaner
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-lp-navy">
                          Cleaner
                        </label>

                        <select
                          value={form.cleanerId}
                          onChange={(e) =>
                            actualizarFormulario(
                              trabajo,
                              "cleanerId",
                              e.target.value
                            )
                          }
                          className="w-full border rounded-xl p-3 text-lp-navy bg-white"
                        >
                          <option value="">Seleccionar</option>
                          {cleaners.map((cleaner) => (
                            <option key={cleaner.id} value={cleaner.id}>
                              {cleaner.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-lp-navy">
                          Rol
                        </label>

                        <select
                          value={form.rol}
                          onChange={(e) =>
                            actualizarFormulario(
                              trabajo,
                              "rol",
                              e.target.value
                            )
                          }
                          className="w-full border rounded-xl p-3 text-lp-navy bg-white"
                        >
                          <option value="CLEANER">Cleaner</option>
                          <option value="VOLANTE">Volante</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-lp-navy">
                          Valor pago
                        </label>

                        <input
                          type="number"
                          value={form.valorPago}
                          onChange={(e) =>
                            actualizarFormulario(
                              trabajo,
                              "valorPago",
                              e.target.value
                            )
                          }
                          className="w-full border rounded-xl p-3 text-lp-navy bg-white font-bold"
                        />
                      </div>

                      <div className="space-y-1 flex flex-col justify-end">
                        <button
                          onClick={() => crearAsignacion(trabajo)}
                          disabled={savingId === trabajo.id}
                          className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
                        >
                          {savingId === trabajo.id ? "Guardando..." : "Asignar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl p-3 border min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className="text-sm font-semibold text-lp-navy break-words">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white border text-lp-navy text-xs font-semibold px-3 py-1 rounded-full">
      {children}
    </span>
  );
}