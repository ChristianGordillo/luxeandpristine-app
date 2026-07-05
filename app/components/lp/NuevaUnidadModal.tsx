"use client";

import { useEffect, useState } from "react";

type Unidad = {
  id: number;
  nombre: string;
  habitaciones: number;
  banos: number;
  camas: number | null;
  camasDetalle: string | null;
  precio: number;
  activo: boolean;
  cliente: { nombre: string };
  edificio: { nombre: string };
};

type UnidadForm = {
  id?: number;
  nombre: string;
  habitaciones: string;
  banos: string;
  camas: string;
  camasDetalle: string;
  precio: string;
  clienteNombre: string;
  edificioNombre: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  unidadToEdit?: Unidad | null;
};

const emptyForm: UnidadForm = {
  nombre: "",
  habitaciones: "",
  banos: "",
  camas: "",
  camasDetalle: "",
  precio: "",
  clienteNombre: "",
  edificioNombre: "",
};

export default function NuevaUnidadModal({
  open,
  onClose,
  onSaved,
  unidadToEdit,
}: Props) {
  const [form, setForm] = useState<UnidadForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unidadToEdit) {
      setForm({
        nombre: unidadToEdit.nombre,
        habitaciones: String(unidadToEdit.habitaciones),
        banos: String(unidadToEdit.banos),
        camas: unidadToEdit.camas !== null ? String(unidadToEdit.camas) : "",
        camasDetalle: unidadToEdit.camasDetalle || "",
        precio: String(unidadToEdit.precio),
        clienteNombre: unidadToEdit.cliente?.nombre || "",
        edificioNombre: unidadToEdit.edificio?.nombre || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [unidadToEdit, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    try {
      setSaving(true);

      const method = unidadToEdit ? "PUT" : "POST";

      const body = unidadToEdit
        ? { ...form, id: unidadToEdit.id }
        : form;

      const res = await fetch("/api/lp/unidades", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Error al guardar la unidad");
        return;
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error("Error guardando unidad:", error);
      alert("Error al guardar la unidad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-lp-navy mb-6">
          {unidadToEdit ? "Editar unidad" : "Nueva unidad"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Cliente, ej: We Host"
            value={form.clienteNombre}
            onChange={(e) =>
              setForm({ ...form, clienteNombre: e.target.value })
            }
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Edificio, ej: 501 First"
            value={form.edificioNombre}
            onChange={(e) =>
              setForm({ ...form, edificioNombre: e.target.value })
            }
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Unidad, ej: 3303"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Precio, ej: 65"
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Habitaciones"
            value={form.habitaciones}
            onChange={(e) =>
              setForm({ ...form, habitaciones: e.target.value })
            }
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Baños"
            value={form.banos}
            onChange={(e) => setForm({ ...form, banos: e.target.value })}
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Cantidad de camas"
            value={form.camas}
            onChange={(e) => setForm({ ...form, camas: e.target.value })}
            className="border rounded-lg p-3 text-black"
          />

          <input
            placeholder="Detalle camas, ej: 1 King + 1 sofá cama"
            value={form.camasDetalle}
            onChange={(e) =>
              setForm({ ...form, camasDetalle: e.target.value })
            }
            className="border rounded-lg p-3 text-black"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="border px-5 py-2 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-lp-navy text-white px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : unidadToEdit
              ? "Actualizar unidad"
              : "Guardar unidad"}
          </button>
        </div>
      </div>
    </div>
  );
}