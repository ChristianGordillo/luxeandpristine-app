"use client";

import { useEffect, useMemo, useState } from "react";

type EstadoFiltro = "todas" | "activas" | "inactivas";

type Unidad = {
  id: number;
  nombre: string;
  habitaciones: number;
  banos: number;
  camas?: number | null;
  camasDetalle?: string | null;
  precio: number;
  activo: boolean;
  cliente?: { nombre: string } | null;
  edificio?: { nombre: string } | null;
};

type FormUnidad = {
  id?: number;
  nombre: string;
  habitaciones: string;
  banos: string;
  camas: string;
  camasDetalle: string;
  precio: string;
  clienteNombre: string;
  edificioNombre: string;
  activo: boolean;
};

const initialForm: FormUnidad = {
  nombre: "",
  habitaciones: "",
  banos: "",
  camas: "",
  camasDetalle: "",
  precio: "",
  clienteNombre: "",
  edificioNombre: "",
  activo: true,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [estado, setEstado] = useState<EstadoFiltro>("activas");
  const [busqueda, setBusqueda] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [form, setForm] = useState<FormUnidad>(initialForm);
  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUnidades = async () => {
    try {
      setLoading(true);

      const query = estado === "todas" ? "" : `?estado=${estado}`;
      const res = await fetch(`/api/lp/unidades${query}`);
      const data = await res.json();

      setUnidades(data.unidades || []);
    } catch (error) {
      console.error("Error cargando unidades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnidades();
  }, [estado]);

const unidadesFiltradas = useMemo(() => {
  const texto = busqueda.toLowerCase().trim();

  return unidades.filter((u) => {
    const coincideBusqueda =
      !texto ||
      u.nombre.toLowerCase().includes(texto) ||
      u.edificio?.nombre?.toLowerCase().includes(texto) ||
      u.cliente?.nombre?.toLowerCase().includes(texto) ||
      u.camasDetalle?.toLowerCase().includes(texto);

    const coincideCliente =
      clienteFiltro === "todos" || u.cliente?.nombre === clienteFiltro;

    return coincideBusqueda && coincideCliente;
  });
}, [unidades, busqueda, clienteFiltro]);

  const unidadesPorEdificio = useMemo(() => {
    const grupos = unidadesFiltradas.reduce<Record<string, Unidad[]>>(
      (acc, unidad) => {
        const edificio = unidad.edificio?.nombre || "Sin edificio";

        if (!acc[edificio]) {
          acc[edificio] = [];
        }

        acc[edificio].push(unidad);

        return acc;
      },
      {}
    );

    Object.keys(grupos).forEach((edificio) => {
      grupos[edificio].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    });

    return Object.entries(grupos).sort(([a], [b]) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [unidadesFiltradas]);

  const clientesDisponibles = useMemo(() => {
    const clientes = unidades
      .map((u) => u.cliente?.nombre)
      .filter(Boolean) as string[];

    return Array.from(new Set(clientes)).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [unidades]);

  const resumen = useMemo(() => {
    return {
      total: unidadesFiltradas.length,
      activas: unidadesFiltradas.filter((u) => u.activo).length,
      inactivas: unidadesFiltradas.filter((u) => !u.activo).length,
    };
  }, [unidadesFiltradas]);

  const handleChange = (campo: keyof FormUnidad, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [campo]: value,
    }));
  };

  const limpiarForm = () => {
    setForm(initialForm);
    setEditando(false);
  };

  const cargarParaEditar = (unidad: Unidad) => {
    setForm({
      id: unidad.id,
      nombre: unidad.nombre,
      habitaciones: String(unidad.habitaciones ?? ""),
      banos: String(unidad.banos ?? ""),
      camas:
        unidad.camas !== null && unidad.camas !== undefined
          ? String(unidad.camas)
          : "",
      camasDetalle: unidad.camasDetalle || "",
      precio: String(unidad.precio ?? ""),
      clienteNombre: unidad.cliente?.nombre || "",
      edificioNombre: unidad.edificio?.nombre || "",
      activo: unidad.activo,
    });

    setEditando(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardarUnidad = async () => {
    if (
      !form.nombre ||
      !form.habitaciones ||
      !form.banos ||
      !form.precio ||
      !form.clienteNombre ||
      !form.edificioNombre
    ) {
      alert("Completa nombre, habitaciones, baños, precio, cliente y edificio.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lp/unidades", {
        method: editando ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        alert("Error al guardar unidad.");
        return;
      }

      limpiarForm();
      fetchUnidades();
    } catch (error) {
      console.error("Error guardando unidad:", error);
      alert("Error al guardar unidad.");
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (unidad: Unidad) => {
    const confirmar = confirm(
      unidad.activo
        ? "¿Deseas desactivar esta unidad?"
        : "¿Deseas activar esta unidad?"
    );

    if (!confirmar) return;

    try {
      const res = await fetch("/api/lp/unidades", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: unidad.id,
          activo: !unidad.activo,
        }),
      });

      if (!res.ok) {
        alert("Error al cambiar estado.");
        return;
      }

      fetchUnidades();
    } catch (error) {
      console.error("Error cambiando estado:", error);
      alert("Error al cambiar estado.");
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando unidades...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Unidades</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Control de unidades activas, tipo, camas y precios base.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="font-bold text-lp-navy">
          {editando ? "Editar unidad" : "Crear unidad"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          <Input
            label="Unidad"
            value={form.nombre}
            onChange={(v) => handleChange("nombre", v)}
            placeholder="Ej: 3205"
          />

          <Input
            label="Edificio"
            value={form.edificioNombre}
            onChange={(v) => handleChange("edificioNombre", v)}
            placeholder="Ej: 501 First"
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Cliente</label>
            <input
              list="clientesDisponibles"
              value={form.clienteNombre}
              onChange={(e) => handleChange("clienteNombre", e.target.value)}
              placeholder="Buscar o escribir nuevo cliente"
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />

            <datalist id="clientesDisponibles">
              {clientesDisponibles.map((cliente) => (
                <option key={cliente} value={cliente} />
              ))}
            </datalist>
          </div>

          <Input
            label="Habitaciones"
            type="number"
            value={form.habitaciones}
            onChange={(v) => handleChange("habitaciones", v)}
          />

          <Input
            label="Baños"
            type="number"
            value={form.banos}
            onChange={(v) => handleChange("banos", v)}
          />

          <Input
            label="Precio"
            type="number"
            value={form.precio}
            onChange={(v) => handleChange("precio", v)}
          />

          <Input
            label="Cantidad de camas"
            type="number"
            value={form.camas}
            onChange={(v) => handleChange("camas", v)}
          />

          <div className="sm:col-span-2 xl:col-span-3">
            <Input
              label="Detalle / tamaño camas"
              value={form.camasDetalle}
              onChange={(v) => handleChange("camasDetalle", v)}
              placeholder="Ej: 1 king, 1 queen, 1 sofa cama"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Estado</label>
            <select
              value={form.activo ? "activo" : "inactivo"}
              onChange={(e) =>
                handleChange("activo", e.target.value === "activo")
              }
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            >
              <option value="activo">Activa</option>
              <option value="inactivo">Inactiva</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2 sm:flex-row xl:col-span-2">
            <button
              onClick={guardarUnidad}
              disabled={saving}
              className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
            >
              {saving ? "Guardando..." : editando ? "Actualizar" : "Crear"}
            </button>

            {editando && (
              <button
                onClick={limpiarForm}
                className="w-full sm:w-auto border border-lp-navy text-lp-navy rounded-xl px-4 py-3"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-lp-navy">Buscar</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar unidad, edificio, cliente o tamaño de camas..."
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            >
              <option value="todas">Todas</option>
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
            </select>
          </div>

          <ResumenCard label="Unidades" value={resumen.total} />
        </div>
      </div>

            <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
  <p className="text-xs font-semibold text-lp-navy/70">
    Filtrar por cliente
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
      <div className="space-y-6">
        {unidadesPorEdificio.length === 0 ? (
          <div className="bg-white border rounded-2xl shadow-sm p-6 text-sm text-lp-navy/70">
            No hay unidades para mostrar.
          </div>
        ) : (
          unidadesPorEdificio.map(([edificio, unidadesGrupo]) => (
            <div
              key={edificio}
              className="bg-white border rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-4 border-b bg-lp-light flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lp-navy">{edificio}</h2>
                  <p className="text-xs text-lp-navy/60">
                    {unidadesGrupo.length} unidades
                  </p>
                </div>
              </div>

              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-sm text-lp-navy">
                  <thead className="bg-lp-navy text-white">
                    <tr>
                      <th className="px-4 py-3 text-left">Unidad</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Camas</th>
                      <th className="px-4 py-3 text-left">Tamaño</th>
                      <th className="px-4 py-3 text-right">Precio</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {unidadesGrupo.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-lp-light">
                        <td className="px-4 py-3 font-bold whitespace-nowrap">
                          {u.nombre}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.cliente?.nombre || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.habitaciones}/{u.banos}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.camas ?? "—"}
                        </td>
                        <td className="px-4 py-3 max-w-[300px] truncate">
                          {u.camasDetalle || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                          {formatMoney(u.precio)}
                        </td>
                        <td className="px-4 py-3">
                          <EstadoBadge activo={u.activo} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => cargarParaEditar(u)}
                              className="border border-lp-navy text-lp-navy px-3 py-1 rounded-lg text-xs hover:bg-lp-light"
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => cambiarEstado(u)}
                              className={`border px-3 py-1 rounded-lg text-xs ${
                                u.activo
                                  ? "border-red-500 text-red-500 hover:bg-red-50"
                                  : "border-green-600 text-green-600 hover:bg-green-50"
                              }`}
                            >
                              {u.activo ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="xl:hidden divide-y">
                {unidadesGrupo.map((u) => (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-lp-navy/60">{edificio}</p>

                        <h3 className="text-lg font-bold text-lp-navy truncate">
                          Unidad {u.nombre}
                        </h3>

                        <p className="text-xs font-semibold text-lp-navy/70">
                          Cliente: {u.cliente?.nombre || "—"}
                        </p>

                        <p className="text-sm text-lp-navy/70">
                          {u.habitaciones}/{u.banos} · {formatMoney(u.precio)}
                        </p>
                      </div>

                      <EstadoBadge activo={u.activo} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <InfoMini label="Camas" value={u.camas ?? "—"} />
                      <InfoMini
                        label="Detalle / tamaño"
                        value={u.camasDetalle || "—"}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => cargarParaEditar(u)}
                        className="border border-lp-navy text-lp-navy px-3 py-2 rounded-lg text-sm"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => cambiarEstado(u)}
                        className={`border px-3 py-2 rounded-lg text-sm ${
                          u.activo
                            ? "border-red-500 text-red-500"
                            : "border-green-600 text-green-600"
                        }`}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
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

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-lp-navy">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-xl p-3 text-lp-navy bg-white"
      />
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

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={`w-fit text-xs font-semibold px-3 py-1 rounded-full ${
        activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {activo ? "Activa" : "Inactiva"}
    </span>
  );
}