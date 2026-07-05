"use client";

import { useEffect, useMemo, useState } from "react";

type Unidad = {
  id: number;
  nombre: string;
  edificio?: { nombre: string } | null;
};

type RopaManchada = {
  id: number;
  item: string;
  cantidad: number;
  cambiada: boolean;
  createdAt: string;
  fechaCambio?: string | null;
  unidad: Unidad;
};

type RopaManchadaAgrupada = {
  ids: number[];
  item: string;
  cantidad: number;
  cambiada: boolean;
};

type ItemFormulario = {
  item: string;
  cantidad: number;
};

const itemsRopa = [
  "Sábana King",
  "Sábana Queen",
  "Sábana Twin",
  "Duvet King",
  "Duvet Queen",
  "Duvet Twin",
  "Duvet Cover King",
  "Duvet Cover Queen",
  "Duvet Cover Twin",
  "Protector de colchón King",
  "Protector de colchón Queen",
  "Protector de colchón Twin",
  "Funda de almohada King",
  "Funda de almohada Queen",
  "Protector de almohada King",
  "Protector de almohada Queen",
  "Toalla cuerpo",
  "Toalla manos",
  "Toalla cara",
  "Manta",
  "Pie de cama",
];

export default function RopaManchadaPage() {
  const [registros, setRegistros] = useState<RopaManchada[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  const [unidadId, setUnidadId] = useState("");
  const [busquedaUnidad, setBusquedaUnidad] = useState("");
  const [item, setItem] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [itemsFormulario, setItemsFormulario] = useState<ItemFormulario[]>([]);

  const [filtroEstado, setFiltroEstado] = useState<
    "PENDIENTE" | "CAMBIADA" | "TODAS"
  >("PENDIENTE");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const unidadesFiltradas = useMemo(() => {
    const texto = busquedaUnidad.toLowerCase().trim();
    if (!texto || unidadId) return [];

    return unidades
      .filter(
        (u) =>
          u.nombre.toLowerCase().includes(texto) ||
          u.edificio?.nombre?.toLowerCase().includes(texto)
      )
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      )
      .slice(0, 8);
  }, [busquedaUnidad, unidades, unidadId]);

  const itemsFiltrados = useMemo(() => {
    const texto = item.toLowerCase().trim();
    if (!texto) return itemsRopa;
    return itemsRopa.filter((i) => i.toLowerCase().includes(texto));
  }, [item]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroEstado === "PENDIENTE") return !r.cambiada;
      if (filtroEstado === "CAMBIADA") return r.cambiada;
      return true;
    });
  }, [registros, filtroEstado]);

  const resumenPorItem = useMemo(() => {
    const resumen: Record<string, number> = {};

    registrosFiltrados.forEach((r) => {
      resumen[r.item] = (resumen[r.item] || 0) + Number(r.cantidad || 0);
    });

    return Object.entries(resumen)
      .map(([item, cantidad]) => ({ item, cantidad }))
      .sort((a, b) => a.item.localeCompare(b.item));
  }, [registrosFiltrados]);

  const registrosPorEdificio = useMemo(() => {
    const edificios: Record<
      string,
      Record<string, Record<string, RopaManchadaAgrupada>>
    > = {};

    registrosFiltrados.forEach((r) => {
      const edificio = r.unidad?.edificio?.nombre || "Sin edificio";
      const unidad = r.unidad?.nombre || "Sin unidad";
      const key = `${r.item}-${r.cambiada ? "cambiada" : "pendiente"}`;

      if (!edificios[edificio]) edificios[edificio] = {};
      if (!edificios[edificio][unidad]) edificios[edificio][unidad] = {};

      if (!edificios[edificio][unidad][key]) {
        edificios[edificio][unidad][key] = {
          ids: [],
          item: r.item,
          cantidad: 0,
          cambiada: r.cambiada,
        };
      }

      edificios[edificio][unidad][key].ids.push(r.id);
      edificios[edificio][unidad][key].cantidad += Number(r.cantidad || 0);
    });

    return Object.entries(edificios).sort(([a], [b]) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [registrosFiltrados]);

  const totalItems = useMemo(() => {
    return registrosFiltrados.reduce(
      (acc, r) => acc + Number(r.cantidad || 0),
      0
    );
  }, [registrosFiltrados]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [ropaRes, unidadesRes] = await Promise.all([
        fetch("/api/lp/ropa-manchada"),
        fetch("/api/lp/unidades"),
      ]);

      const ropaData = await ropaRes.json();
      const unidadesData = await unidadesRes.json();

      setRegistros(ropaData.registros || []);
      setUnidades(unidadesData.unidades || []);
    } catch (error) {
      console.error("Error cargando ropa manchada:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const agregarItemFormulario = () => {
    const itemLimpio = item.trim();
    const cantidadNumero = Number(cantidad);

    if (!itemLimpio || cantidadNumero <= 0) {
      alert("Selecciona item y cantidad.");
      return;
    }

    setItemsFormulario((prev) => {
      const existente = prev.find(
        (i) => i.item.toLowerCase() === itemLimpio.toLowerCase()
      );

      if (existente) {
        return prev.map((i) =>
          i.item.toLowerCase() === itemLimpio.toLowerCase()
            ? { ...i, cantidad: i.cantidad + cantidadNumero }
            : i
        );
      }

      return [...prev, { item: itemLimpio, cantidad: cantidadNumero }];
    });

    setItem("");
    setCantidad("1");
  };

  const eliminarItemFormulario = (itemEliminar: string) => {
    setItemsFormulario((prev) => prev.filter((i) => i.item !== itemEliminar));
  };

  const limpiarFormulario = () => {
    setUnidadId("");
    setBusquedaUnidad("");
    setItem("");
    setCantidad("1");
    setItemsFormulario([]);
  };

  const crearRegistro = async () => {
    if (!unidadId || itemsFormulario.length === 0) {
      alert("Selecciona unidad y agrega al menos un item.");
      return;
    }

    try {
      setSaving(true);

      for (const itemFormulario of itemsFormulario) {
        const res = await fetch("/api/lp/ropa-manchada", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            unidadId: Number(unidadId),
            item: itemFormulario.item,
            cantidad: itemFormulario.cantidad,
          }),
        });

        if (!res.ok) {
          alert("Error al registrar uno de los items.");
          return;
        }
      }

      limpiarFormulario();
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al registrar ropa manchada");
    } finally {
      setSaving(false);
    }
  };

  const marcarGrupoComoCambiado = async (ids: number[]) => {
    const confirmar = confirm("¿Marcar este grupo como cambiado?");
    if (!confirmar) return;

    try {
      for (const id of ids) {
        const res = await fetch("/api/lp/ropa-manchada", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id }),
        });

        if (!res.ok) {
          alert("Error al marcar uno de los registros.");
          return;
        }
      }

      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al marcar como cambiado");
    }
  };

  const eliminarGrupo = async (ids: number[]) => {
    const confirmar = confirm("¿Seguro que deseas eliminar este grupo?");
    if (!confirmar) return;

    try {
      for (const id of ids) {
        const res = await fetch(`/api/lp/ropa-manchada?id=${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          alert("Error al eliminar uno de los registros.");
          return;
        }
      }

      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar grupo");
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando ropa manchada...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Ropa manchada</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Registro de ropa retirada por manchas y control de cambios en storage.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="font-bold text-lp-navy">Registrar ropa manchada</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
          <div className="space-y-1 md:col-span-2 relative">
            <label className="text-xs font-semibold text-lp-navy">Unidad</label>

            <div className="relative">
              <input
                value={busquedaUnidad}
                onChange={(e) => {
                  setBusquedaUnidad(e.target.value);
                  setUnidadId("");
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
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lp-navy/50 hover:text-lp-navy"
                >
                  ✕
                </button>
              )}
            </div>

            {unidadesFiltradas.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {unidadesFiltradas.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setUnidadId(String(u.id));
                      setBusquedaUnidad(
                        `${u.edificio?.nombre || "Sin edificio"} · Unidad ${
                          u.nombre
                        }`
                      );
                    }}
                    className="w-full text-left px-3 py-3 hover:bg-lp-light text-sm text-lp-navy border-b last:border-b-0"
                  >
                    <p className="font-semibold">Unidad {u.nombre}</p>
                    <p className="text-xs text-lp-navy/60">
                      {u.edificio?.nombre || "Sin edificio"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-lp-navy">Item</label>

            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Buscar item..."
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />

            {item && itemsFiltrados.length > 0 && !itemsRopa.includes(item) && (
              <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                {itemsFiltrados.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setItem(i)}
                    className="w-full text-left px-3 py-3 hover:bg-lp-light text-sm text-lp-navy border-b last:border-b-0"
                  >
                    {i}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Cantidad
            </label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <button
            type="button"
            onClick={agregarItemFormulario}
            className="w-full border border-lp-navy text-lp-navy rounded-xl font-semibold px-4 py-3 hover:bg-lp-light"
          >
            Agregar item
          </button>
        </div>

        {itemsFormulario.length > 0 && (
          <div className="border rounded-2xl overflow-hidden">
            <div className="bg-lp-light px-4 py-3">
              <p className="font-bold text-lp-navy">Items a registrar</p>
            </div>

            <div className="divide-y">
              {itemsFormulario.map((i) => (
                <div
                  key={i.item}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <p className="font-semibold text-lp-navy">
                    {i.cantidad} × {i.item}
                  </p>

                  <button
                    type="button"
                    onClick={() => eliminarItemFormulario(i.item)}
                    className="text-sm font-semibold text-red-500"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={crearRegistro}
          disabled={saving || !unidadId || itemsFormulario.length === 0}
          className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Registrar ropa manchada"}
        </button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-lp-navy">Resumen</h2>

          <select
            value={filtroEstado}
            onChange={(e) =>
              setFiltroEstado(
                e.target.value as "PENDIENTE" | "CAMBIADA" | "TODAS"
              )
            }
            className="w-full sm:w-auto border rounded-xl p-3 text-lp-navy bg-white"
          >
            <option value="PENDIENTE">Pendientes</option>
            <option value="CAMBIADA">Cambiadas</option>
            <option value="TODAS">Todas</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <ResumenCard label="Registros" value={registrosFiltrados.length} />
          <ResumenCard label="Items total" value={totalItems} />

          {resumenPorItem.map((r) => (
            <ResumenCard key={r.item} label={r.item} value={r.cantidad} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-bold text-lp-navy">Registros por edificio</h2>

        {registrosPorEdificio.length === 0 ? (
          <div className="bg-white border rounded-2xl p-6 text-sm text-lp-navy/70">
            No hay registros para este filtro.
          </div>
        ) : (
          registrosPorEdificio.map(([edificio, unidades]) => (
            <div
              key={edificio}
              className="bg-white border rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-4 border-b bg-lp-navy text-white">
                <h3 className="font-bold">{edificio}</h3>
              </div>

              <div className="divide-y">
                {Object.entries(unidades)
                  .sort(([a], [b]) =>
                    a.localeCompare(b, undefined, {
                      numeric: true,
                      sensitivity: "base",
                    })
                  )
                  .map(([unidad, items]) => (
                    <div key={unidad} className="p-4 space-y-3">
                      <h4 className="font-bold text-lp-navy">
                        Unidad {unidad}
                      </h4>

                      <div className="space-y-2">
                        {Object.values(items)
                          .sort((a, b) => a.item.localeCompare(b.item))
                          .map((r) => (
                            <div
                              key={`${r.item}-${r.cambiada}`}
                              className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="font-bold text-lp-navy">
                                  {r.cantidad} × {r.item}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                                    r.cambiada
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {r.cambiada ? "Cambiada" : "Pendiente"}
                                </span>

                                {!r.cambiada && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      marcarGrupoComoCambiado(r.ids)
                                    }
                                    className="bg-lp-navy text-white rounded-xl font-semibold px-4 py-2 text-sm"
                                  >
                                    Marcar cambiada
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => eliminarGrupo(r.ids)}
                                  className="border border-red-500 text-red-500 rounded-xl font-semibold px-4 py-2 text-sm hover:bg-red-50"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
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
