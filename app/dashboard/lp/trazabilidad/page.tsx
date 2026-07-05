"use client";

import { useEffect, useMemo, useState } from "react";

type Cleaner = {
  id: number;
  nombre: string;
};

type Asignacion = {
  id: number;
  rol: "CLEANER" | "VOLANTE";
  valorPago: number;
  cleaner: Cleaner;
};

type Trabajo = {
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
  habitaciones: number;
  banos: number;
  precio: number;
  edificio: {
    nombre: string;
  };
  cliente: {
    nombre: string;
  };
  ultimoTrabajo: Trabajo | null;
  historial: Trabajo[];
};

function formatDate(fecha: string) {
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

function getCleaners(trabajo: Trabajo | null) {
  if (!trabajo || trabajo.asignaciones.length === 0) return "Sin asignar";

  return trabajo.asignaciones
    .map(
      (a) =>
        `${a.cleaner.nombre} (${a.rol === "CLEANER" ? "Cleaner" : "Volante"})`
    )
    .join(", ");
}

export default function TrazabilidadPage() {
  const [data, setData] = useState<UnidadTrazabilidad[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unidadAbierta, setUnidadAbierta] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchTrazabilidad = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/lp/trazabilidad");
      const json = await res.json();

      setData(json.trazabilidad || []);
    } catch (error) {
      console.error("Error cargando trazabilidad:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrazabilidad();
  }, []);

  const unidadesFiltradas = useMemo(() => {
    const texto = search.toLowerCase().trim();

    return data.filter((unidad) => {
      if (!texto) return true;

      return (
        unidad.nombre?.toLowerCase().includes(texto) ||
        unidad.edificio?.nombre?.toLowerCase().includes(texto) ||
        unidad.cliente?.nombre?.toLowerCase().includes(texto)
      );
    });
  }, [data, search]);

  const sugerencias = useMemo(() => {
    if (!search.trim()) return [];

    return unidadesFiltradas.slice(0, 8);
  }, [search, unidadesFiltradas]);

  const limpiarBusqueda = () => {
    setSearch("");
    setUnidadAbierta(null);
    setShowSuggestions(false);
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando trazabilidad...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Trazabilidad de unidades
        </h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Consulta la última limpieza, notas, cleaner asignado e historial de
          cada unidad.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="relative space-y-1 w-full sm:w-[360px]">
            <label className="text-xs font-semibold text-lp-navy">
              Buscar unidad, edificio o cliente
            </label>

            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Ej: 1205, 501, Nomad..."
              className="w-full border border-lp-gold rounded-2xl px-4 py-3 pr-10 text-sm text-lp-navy bg-white focus:outline-none focus:ring-2 focus:ring-lp-gold/30"
            />

            {search && (
              <button
                type="button"
                onClick={limpiarBusqueda}
                className="absolute right-3 top-[31px] text-lp-navy/50 hover:text-lp-navy text-sm"
              >
                ✕
              </button>
            )}

            {showSuggestions && sugerencias.length > 0 && (
              <div className="absolute z-30 mt-2 w-full bg-white border rounded-2xl shadow-lg overflow-hidden">
                {sugerencias.map((unidad) => (
                  <button
                    key={unidad.id}
                    type="button"
                    onClick={() => {
                      setSearch(unidad.nombre);
                      setUnidadAbierta(unidad.id);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-lp-light border-b last:border-b-0"
                  >
                    <p className="font-semibold text-lp-navy">
                      Unidad {unidad.nombre}
                    </p>
                    <p className="text-xs text-lp-navy/60">
                      {unidad.edificio?.nombre} · {unidad.cliente?.nombre}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-lp-navy/60">
            {unidadesFiltradas.length} unidades encontradas
          </div>
        </div>
      </div>

      {unidadesFiltradas.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-6 text-sm text-lp-navy/70">
          No se encontraron unidades.
        </div>
      ) : (
        <div className="space-y-4">
          {unidadesFiltradas.map((unidad) => {
            const abierta = unidadAbierta === unidad.id;
            const ultimo = unidad.ultimoTrabajo;

            return (
              <section
                key={unidad.id}
                className="bg-white border rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5 bg-lp-light border-b">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-lp-navy/60">
                        {unidad.edificio?.nombre} · {unidad.cliente?.nombre}
                      </p>

                      <h2 className="text-xl font-bold text-lp-navy truncate">
                        Unidad {unidad.nombre}
                      </h2>

                      <p className="text-sm text-lp-navy/70">
                        Tipo {unidad.habitaciones}/{unidad.banos} · Precio base{" "}
                        {formatMoney(unidad.precio)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ultimo ? (
                        <>
                          <Badge>Última {formatDate(ultimo.fecha)}</Badge>
                          <Badge>{tipoLabel(ultimo.tipo)}</Badge>
                          <Badge>{getCleaners(ultimo)}</Badge>
                        </>
                      ) : (
                        <Badge>Sin registros</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {ultimo ? (
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <InfoCard
                        label="Última limpieza"
                        value={formatDate(ultimo.fecha)}
                      />
                      <InfoCard label="Día" value={ultimo.dia || "—"} />
                      <InfoCard
                        label="Descripción"
                        value={tipoLabel(ultimo.tipo)}
                      />
                      <InfoCard label="Cleaner" value={getCleaners(ultimo)} />
                    </div>

                    <div className="bg-lp-light rounded-xl p-4">
                      <p className="text-xs text-lp-navy/60 mb-1">
                        Notas del último registro
                      </p>
                      <p className="text-sm text-lp-navy whitespace-pre-wrap">
                        {ultimo.notas || "Sin notas registradas."}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setUnidadAbierta(abierta ? null : unidad.id)
                      }
                      className="w-full sm:w-auto border border-lp-navy text-lp-navy rounded-xl px-4 py-2 text-sm hover:bg-lp-light"
                    >
                      {abierta ? "Ocultar historial" : "Ver historial completo"}
                    </button>

                    {abierta && (
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 bg-lp-navy text-white font-semibold text-sm">
                          Historial de trabajos
                        </div>

                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full text-sm text-lp-navy">
                            <thead className="bg-white border-b">
                              <tr>
                                <th className="px-4 py-3 text-left">Fecha</th>
                                <th className="px-4 py-3 text-left">Día</th>
                                <th className="px-4 py-3 text-left">
                                  Descripción
                                </th>
                                <th className="px-4 py-3 text-left">
                                  Cleaner
                                </th>
                                <th className="px-4 py-3 text-left">Notas</th>
                              </tr>
                            </thead>

                            <tbody>
                              {unidad.historial.map((trabajo) => (
                                <tr
                                  key={trabajo.id}
                                  className="border-b hover:bg-lp-light"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {formatDate(trabajo.fecha)}
                                  </td>
                                  <td className="px-4 py-3 capitalize whitespace-nowrap">
                                    {trabajo.dia}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {tipoLabel(trabajo.tipo)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {getCleaners(trabajo)}
                                  </td>
                                  <td className="px-4 py-3 text-lp-navy/70 max-w-[360px]">
                                    {trabajo.notas || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="lg:hidden divide-y">
                          {unidad.historial.map((trabajo) => (
                            <div key={trabajo.id} className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs text-lp-navy/60 capitalize">
                                    {trabajo.dia}
                                  </p>
                                  <p className="font-bold text-lp-navy">
                                    {formatDate(trabajo.fecha)}
                                  </p>
                                </div>

                                <span className="text-xs bg-lp-light text-lp-navy font-semibold px-2.5 py-1 rounded-full">
                                  {tipoLabel(trabajo.tipo)}
                                </span>
                              </div>

                              <p className="text-sm text-lp-navy">
                                <span className="font-semibold">Cleaner:</span>{" "}
                                {getCleaners(trabajo)}
                              </p>

                              {trabajo.notas && (
                                <p className="text-sm text-lp-navy/70 break-words">
                                  <span className="font-semibold">Notas:</span>{" "}
                                  {trabajo.notas}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 text-sm text-lp-navy/70">
                    Esta unidad todavía no tiene trabajos registrados.
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-lp-light rounded-xl p-4 min-w-0">
      <p className="text-xs text-lp-navy/60 truncate">{label}</p>
      <p className="font-bold text-lp-navy truncate">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white border text-lp-navy text-xs font-semibold px-3 py-1 rounded-full max-w-full truncate">
      {children}
    </span>
  );
}