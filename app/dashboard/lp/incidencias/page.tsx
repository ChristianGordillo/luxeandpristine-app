"use client";

import { useEffect, useMemo, useState } from "react";

type Trabajo = {
  id: number;
  fecha: string;
  dia: string;
  tipo: string;
  notas?: string | null;
  unidad?: {
    nombre: string;
    edificio?: {
      nombre: string;
    } | null;
  } | null;
  unidadManual?: string | null;
  asignaciones: {
    id: number;
    cleaner: {
      nombre: string;
    };
  }[];
};

function formatDate(fecha: string) {
  return fecha.split("T")[0].split("-").reverse().join("/");
}

export default function IncidenciasPage() {
  const [incidencias, setIncidencias] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<number | null>(null);

  const fetchIncidencias = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/lp/incidencias");
      const data = await res.json();

      setIncidencias(data.incidencias || []);
    } catch (error) {
      console.error("Error cargando incidencias:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidencias();
  }, []);

  const total = useMemo(() => incidencias.length, [incidencias]);

  const cerrarIncidencia = async (trabajoId: number) => {
    const confirmar = confirm("¿Cerrar esta incidencia?");
    if (!confirmar) return;

    try {
      setClosingId(trabajoId);

      const res = await fetch("/api/lp/incidencias", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trabajoId }),
      });

      if (!res.ok) {
        alert("Error al cerrar incidencia.");
        return;
      }

      await fetchIncidencias();
    } catch (error) {
      console.error(error);
      alert("Error al cerrar incidencia.");
    } finally {
      setClosingId(null);
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando incidencias...</p>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Incidencias abiertas
        </h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Seguimiento de novedades pendientes por resolver.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4">
        <p className="text-xs text-lp-navy/60">Total abiertas</p>
        <p className="text-3xl font-bold text-lp-navy">{total}</p>
      </div>

      {incidencias.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm text-lp-navy/70">
          No hay incidencias abiertas.
        </div>
      ) : (
        <div className="space-y-4">
          {incidencias.map((trabajo) => {
            const unidad =
              trabajo.unidad?.nombre || trabajo.unidadManual || "Unidad eventual";

            const edificio = trabajo.unidad?.edificio?.nombre || "Eventual";

            return (
              <section
                key={trabajo.id}
                className="bg-white border rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="p-4 bg-lp-light border-b space-y-1">
                  <p className="text-xs text-lp-navy/60">
                    {formatDate(trabajo.fecha)} · {trabajo.dia}
                  </p>

                  <h2 className="text-xl font-bold text-lp-navy">
                    Unidad {unidad}
                  </h2>

                  <p className="text-sm text-lp-navy/70">{edificio}</p>
                </div>

                <div className="p-4 space-y-4">
                  {trabajo.asignaciones.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {trabajo.asignaciones.map((asignacion) => (
                        <span
                          key={asignacion.id}
                          className="text-xs font-semibold bg-lp-light border rounded-full px-3 py-1 text-lp-navy"
                        >
                          {asignacion.cleaner.nombre}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      Incidencia
                    </p>
                    <p className="text-sm text-lp-navy whitespace-pre-line">
                      {trabajo.notas || "Sin nota registrada"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => cerrarIncidencia(trabajo.id)}
                    disabled={closingId === trabajo.id}
                    className="w-full bg-lp-navy text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
                  >
                    {closingId === trabajo.id
                      ? "Cerrando..."
                      : "Cerrar incidencia"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}