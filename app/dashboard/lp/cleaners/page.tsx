"use client";

import { useEffect, useState } from "react";

type Cleaner = {
  id: number;
  nombre: string;
  telefono?: string | null;
  paisOrigen?: string | null;
  activo: boolean;
};

export default function CleanersPage() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [paisOrigen, setPaisOrigen] = useState("");
  const [activo, setActivo] = useState(true);

  const fetchCleaners = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/lp/cleaners");
      const data = await res.json();

      setCleaners(data.cleaners || []);
    } catch (error) {
      console.error("Error cargando cleaners:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCleaners();
  }, []);

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre("");
    setTelefono("");
    setPaisOrigen("");
    setActivo(true);
  };

  const guardarCleaner = async () => {
    if (!nombre.trim()) {
      alert("El nombre es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lp/cleaners", {
        method: editandoId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editandoId,
          nombre,
          telefono,
          paisOrigen,
          activo,
        }),
      });

      if (!res.ok) {
        alert("Error al guardar cleaner");
        return;
      }

      limpiarFormulario();
      fetchCleaners();
    } catch (error) {
      console.error(error);
      alert("Error al guardar cleaner");
    } finally {
      setSaving(false);
    }
  };

  const editarCleaner = (cleaner: Cleaner) => {
    setEditandoId(cleaner.id);
    setNombre(cleaner.nombre);
    setTelefono(cleaner.telefono || "");
    setPaisOrigen(cleaner.paisOrigen || "");
    setActivo(cleaner.activo);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const eliminarCleaner = async (id: number) => {
    const confirmar = confirm(
      "¿Seguro que deseas eliminar este cleaner?"
    );

    if (!confirmar) return;

    try {
      const res = await fetch(`/api/lp/cleaners?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert(
          "No se pudo eliminar. Puede que este cleaner ya tenga asignaciones."
        );
        return;
      }

      fetchCleaners();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar cleaner");
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando cleaners...</p>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Cleaners</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Base operativa de personas disponibles para limpieza y apoyo.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">
            {editandoId ? "Editar cleaner" : "Agregar cleaner"}
          </h2>

          {editandoId && (
            <span className="text-xs bg-lp-light text-lp-navy px-3 py-1 rounded-full font-semibold">
              Editando
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="space-y-1 xl:col-span-2">
            <label className="text-xs font-semibold text-lp-navy">
              Nombre
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Teléfono
            </label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+1..."
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              País de origen
            </label>
            <input
              value={paisOrigen}
              onChange={(e) => setPaisOrigen(e.target.value)}
              placeholder="Colombia, Venezuela..."
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1 flex flex-col justify-end">
            <button
              onClick={guardarCleaner}
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

        {editandoId && (
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 text-sm text-lp-navy">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              Activo
            </label>

            <button
              onClick={limpiarFormulario}
              className="w-full sm:w-auto border border-lp-navy text-lp-navy rounded-xl px-4 py-2"
            >
              Cancelar edición
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-lp-navy">Listado</h2>

          <span className="text-sm font-bold text-lp-navy">
            {cleaners.length}
          </span>
        </div>

        {cleaners.length === 0 ? (
          <div className="p-6 text-sm text-lp-navy/70">
            Todavía no hay cleaners registrados.
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-lp-navy">
                <thead className="bg-lp-navy text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Teléfono</th>
                    <th className="px-4 py-3 text-left">País</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {cleaners.map((cleaner) => (
                    <tr
                      key={cleaner.id}
                      className="border-b hover:bg-lp-light"
                    >
                      <td className="px-4 py-3 font-bold">
                        {cleaner.nombre}
                      </td>

                      <td className="px-4 py-3">
                        {cleaner.telefono || "—"}
                      </td>

                      <td className="px-4 py-3">
                        {cleaner.paisOrigen || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            cleaner.activo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {cleaner.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => editarCleaner(cleaner)}
                            className="border border-lp-navy text-lp-navy px-3 py-1 rounded-lg text-xs hover:bg-lp-light"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => eliminarCleaner(cleaner.id)}
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
              {cleaners.map((cleaner) => (
                <div key={cleaner.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-lp-navy">
                        {cleaner.nombre}
                      </p>
                      <p className="text-sm text-lp-navy/70">
                        {cleaner.telefono || "Sin teléfono"}
                      </p>
                      <p className="text-sm text-lp-navy/70">
                        {cleaner.paisOrigen || "Sin país registrado"}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                        cleaner.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {cleaner.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => editarCleaner(cleaner)}
                      className="border border-lp-navy text-lp-navy px-3 py-2 rounded-lg text-sm"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarCleaner(cleaner.id)}
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