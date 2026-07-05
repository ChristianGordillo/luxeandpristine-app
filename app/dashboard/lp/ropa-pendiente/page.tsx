"use client";

import { useEffect, useMemo, useState } from "react";

type Unidad = {
  id: number;
  nombre: string;
  activo: boolean;
  habitaciones?: number | null;
  banos?: number | null;
  edificio?: {
    nombre: string;
  } | null;
};

type RopaPendiente = {
  id: number;
  createdAt: string;
  unidad: {
    id: number;
    nombre: string;
    habitaciones: number;
    banos: number;
    edificio?: {
      nombre: string;
    } | null;
  };
};

function formatDate(fecha: string) {
  return fecha.split("T")[0].split("-").reverse().join("/");
}

export default function RopaPendientePage() {
  const [ropaPendiente, setRopaPendiente] = useState<RopaPendiente[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<Unidad | null>(
    null
  );
  const [adding, setAdding] = useState(false);

  const fetchRopaPendiente = async () => {
    try {
      setLoading(true);

      const [ropaRes, unidadesRes] = await Promise.all([
        fetch("/api/lp/ropa-pendiente"),
        fetch("/api/lp/unidades?estado=activas"),
      ]);

      const ropaData = await ropaRes.json();
      const unidadesData = await unidadesRes.json();

      setRopaPendiente(ropaData.ropaPendiente || []);
      setUnidades(unidadesData.unidades || []);
    } catch (error) {
      console.error("Error cargando ropa pendiente:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRopaPendiente();
  }, []);

  const total = useMemo(() => ropaPendiente.length, [ropaPendiente]);

  const unidadesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    if (!q || unidadSeleccionada) return [];

    return unidades
      .filter((unidad) => {
        const nombre = unidad.nombre.toLowerCase();
        const edificio = unidad.edificio?.nombre?.toLowerCase() || "";
        const id = String(unidad.id);

        return nombre.includes(q) || edificio.includes(q) || id.includes(q);
      })
      .sort((a, b) => {
        const edificioA = a.edificio?.nombre || "";
        const edificioB = b.edificio?.nombre || "";

        if (edificioA !== edificioB) {
          return edificioA.localeCompare(edificioB);
        }

        return a.nombre.localeCompare(b.nombre);
      });
  }, [busqueda, unidades, unidadSeleccionada]);

  const agregarRopaPendiente = async () => {
    if (!unidadSeleccionada) {
      alert("Selecciona una unidad.");
      return;
    }

    const yaEstaEnListado = ropaPendiente.some(
      (item) => item.unidad.id === unidadSeleccionada.id
    );

    if (yaEstaEnListado) {
      alert("Esta unidad ya tiene ropa pendiente activa.");
      return;
    }

    try {
      setAdding(true);

      const res = await fetch("/api/lp/ropa-pendiente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unidadId: unidadSeleccionada.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Error al agregar ropa pendiente.");
        return;
      }

      setBusqueda("");
      setUnidadSeleccionada(null);
      await fetchRopaPendiente();
    } catch (error) {
      console.error(error);
      alert("Error al agregar ropa pendiente.");
    } finally {
      setAdding(false);
    }
  };

  const marcarComoLlevada = async (id: number) => {
    const confirmar = confirm("¿Marcar esta ropa como llevada?");
    if (!confirmar) return;

    try {
      setClosingId(id);

      const res = await fetch("/api/lp/ropa-pendiente", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        alert("Error al marcar la ropa como llevada.");
        return;
      }

      await fetchRopaPendiente();
    } catch (error) {
      console.error(error);
      alert("Error al marcar la ropa como llevada.");
    } finally {
      setClosingId(null);
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando ropa pendiente...</p>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Ropa pendiente</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Unidades con ropa lavándose o secándose que debe llevarse en el
          próximo turnover.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 space-y-4">
        <div>
          <h2 className="text-base font-bold text-lp-navy">Agregar unidad</h2>
          <p className="text-xs text-lp-navy/60 mt-1">
            Busca una unidad y márcala con ropa pendiente.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setUnidadSeleccionada(null);
            }}
            placeholder="Buscar por unidad, edificio o ID..."
            className="w-full border rounded-xl p-3 pr-10 text-lp-navy bg-white"
          />

          {busqueda && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setUnidadSeleccionada(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-lp-navy/50"
            >
              ✕
            </button>
          )}

          {busqueda && unidadesFiltradas.length === 0 && !unidadSeleccionada && (
            <div className="absolute z-20 mt-2 w-full bg-white border rounded-xl shadow-lg p-4">
              <p className="text-sm text-lp-navy/60">
                No se encontraron unidades.
              </p>
            </div>
          )}

          {unidadesFiltradas.length > 0 && (
            <div className="absolute z-20 mt-2 w-full max-h-80 overflow-y-auto bg-white border rounded-xl shadow-lg">
              {unidadesFiltradas.map((unidad) => {
                const yaEstaEnListado = ropaPendiente.some(
                  (item) => item.unidad.id === unidad.id
                );

                return (
                  <button
                    key={unidad.id}
                    type="button"
                    disabled={yaEstaEnListado}
                    onClick={() => {
                      if (yaEstaEnListado) return;

                      setUnidadSeleccionada(unidad);
                      setBusqueda(
                        `${unidad.nombre} · ${
                          unidad.edificio?.nombre || "Sin edificio"
                        }`
                      );
                    }}
                    className={`w-full text-left px-4 py-3 border-b last:border-b-0 ${
                      yaEstaEnListado
                        ? "bg-yellow-50 cursor-not-allowed opacity-70"
                        : "hover:bg-lp-light"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-lp-navy">
                          Unidad {unidad.nombre}
                        </p>

                        <p className="text-xs text-lp-navy/60">
                          ID {unidad.id} ·{" "}
                          {unidad.edificio?.nombre || "Sin edificio"}
                        </p>
                      </div>

                      {yaEstaEnListado && (
                        <span className="shrink-0 rounded-full bg-yellow-200 px-2 py-1 text-[10px] font-bold text-yellow-800">
                          Ya en listado
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {unidadSeleccionada && (
          <div className="bg-lp-light border rounded-xl p-3">
            <p className="text-xs text-lp-navy/60">Unidad seleccionada</p>

            <p className="text-sm font-bold text-lp-navy">
              Unidad {unidadSeleccionada.nombre}
            </p>

            <p className="text-xs text-lp-navy/60">
              ID {unidadSeleccionada.id} ·{" "}
              {unidadSeleccionada.edificio?.nombre || "Sin edificio"}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={agregarRopaPendiente}
          disabled={!unidadSeleccionada || adding}
          className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? "Agregando..." : "Agregar ropa pendiente"}
        </button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4">
        <p className="text-xs text-lp-navy/60">Unidades con ropa pendiente</p>
        <p className="text-3xl font-bold text-lp-navy">{total}</p>
      </div>

      {ropaPendiente.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm text-lp-navy/70">
          No hay ropa pendiente por llevar.
        </div>
      ) : (
        <div className="space-y-4">
          {ropaPendiente.map((item) => {
            const unidad = item.unidad.nombre;
            const edificio = item.unidad.edificio?.nombre || "Sin edificio";

            return (
              <section
                key={item.id}
                className="bg-white border rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="p-4 bg-lp-light border-b space-y-1">
                  <p className="text-xs text-lp-navy/60">
                    Pendiente desde {formatDate(item.createdAt)}
                  </p>

                  <h2 className="text-xl font-bold text-lp-navy">
                    Unidad {unidad}
                  </h2>

                  <p className="text-sm text-lp-navy/70">
                    {edificio} · {item.unidad.habitaciones} hab ·{" "}
                    {item.unidad.banos} baños
                  </p>
                </div>

                <div className="p-4 space-y-4">
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">
                      Ropa pendiente
                    </p>
                    <p className="text-sm text-lp-navy">
                      Esta unidad tiene ropa pendiente por llevar en el próximo
                      turnover.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => marcarComoLlevada(item.id)}
                    disabled={closingId === item.id}
                    className="w-full bg-lp-navy text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
                  >
                    {closingId === item.id ? "Guardando..." : "Ropa llevada"}
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