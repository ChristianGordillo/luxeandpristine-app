"use client";

import { useEffect, useMemo, useState } from "react";
import ComprasNav from "@/app/components/lp/ComprasNav";

type ProductoCompra = {
  id: number;
  nombre: string;
  nombreNormalizado: string;
  marca: string | null;
  presentacion: string | null;
  activo: boolean;
  etiqueta: string;
};

type ProductoForm = {
  nombre: string;
  marca: string;
  presentacion: string;
};

const formularioVacio: ProductoForm = {
  nombre: "",
  marca: "",
  presentacion: "",
};

function construirEtiqueta(producto: ProductoCompra) {
  if (producto.etiqueta) {
    return producto.etiqueta;
  }

  return [
    producto.nombre,
    producto.marca,
    producto.presentacion,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ProductosComprasPage() {
  const [productos, setProductos] = useState<ProductoCompra[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [formulario, setFormulario] =
    useState<ProductoForm>(formularioVacio);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargarProductos = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (mostrarInactivos) {
        params.set("incluirInactivos", "true");
      }

      const query = params.toString();

      const response = await fetch(
        `/api/lp/productos-compras${query ? `?${query}` : ""}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "No se pudo cargar el catálogo."
        );
      }

      setProductos(data.productos || []);
    } catch (error) {
      console.error("Error cargando catálogo:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el catálogo."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, [mostrarInactivos]);

  const productosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) {
      return productos;
    }

    return productos.filter((producto) => {
      const texto = [
        producto.nombre,
        producto.marca,
        producto.presentacion,
        producto.etiqueta,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(query);
    });
  }, [productos, busqueda]);

  const limpiarFormulario = () => {
    setFormulario(formularioVacio);
    setEditandoId(null);
    setError("");
  };

  const guardarProducto = async () => {
    const nombre = formulario.nombre.trim();
    const marca = formulario.marca.trim();
    const presentacion = formulario.presentacion.trim();

    if (!nombre) {
      setError("El nombre es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/lp/productos-compras", {
        method: editandoId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editandoId ? { id: editandoId } : {}),
          nombre,
          marca: marca || null,
          presentacion: presentacion || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "No se pudo guardar el producto."
        );
      }

      limpiarFormulario();
      await cargarProductos();
    } catch (error) {
      console.error("Error guardando producto:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el producto."
      );
    } finally {
      setSaving(false);
    }
  };

  const editarProducto = (producto: ProductoCompra) => {
    setEditandoId(producto.id);

    setFormulario({
      nombre: producto.nombre,
      marca: producto.marca || "",
      presentacion: producto.presentacion || "",
    });

    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cambiarEstado = async (producto: ProductoCompra) => {
    const accion = producto.activo ? "desactivar" : "activar";

    const confirmar = confirm(
      `¿Seguro que quieres ${accion} "${construirEtiqueta(
        producto
      )}"?`
    );

    if (!confirmar) {
      return;
    }

    try {
      setError("");

      const response = await fetch("/api/lp/productos-compras", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: producto.id,
          activo: !producto.activo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "No se pudo cambiar el estado."
        );
      }

      if (editandoId === producto.id && producto.activo) {
        limpiarFormulario();
      }

      await cargarProductos();
    } catch (error) {
      console.error("Error cambiando estado:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado."
      );
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Catálogo de compras
        </h1>
        <ComprasNav />
        <p className="mt-1 text-sm text-lp-navy/70">
          Administra los productos y conceptos usados en el registro de
          compras.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">
            {editandoId ? "Editar producto" : "Crear producto"}
          </h2>

          {editandoId && (
            <span className="rounded-full bg-lp-gold/20 px-3 py-1 text-xs font-bold text-lp-navy">
              Editando
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Nombre
            </label>

            <input
              type="text"
              value={formulario.nombre}
              onChange={(event) =>
                setFormulario((actual) => ({
                  ...actual,
                  nombre: event.target.value,
                }))
              }
              placeholder="Ej: Papel de baño"
              autoComplete="off"
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Marca
            </label>

            <input
              type="text"
              value={formulario.marca}
              onChange={(event) =>
                setFormulario((actual) => ({
                  ...actual,
                  marca: event.target.value,
                }))
              }
              placeholder="Opcional"
              autoComplete="off"
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Presentación
            </label>

            <input
              type="text"
              value={formulario.presentacion}
              onChange={(event) =>
                setFormulario((actual) => ({
                  ...actual,
                  presentacion: event.target.value,
                }))
              }
              placeholder="Opcional"
              autoComplete="off"
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-lp-light p-3">
          <p className="text-xs text-lp-navy/60">
            Nombre en el catálogo
          </p>

          <p className="mt-1 font-bold text-lp-navy">
            {[
              formulario.nombre.trim(),
              formulario.marca.trim(),
              formulario.presentacion.trim(),
            ]
              .filter(Boolean)
              .join(" · ") || "Completa el nombre"}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={guardarProducto}
            disabled={saving || !formulario.nombre.trim()}
            className="w-full rounded-xl bg-lp-gold px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving
              ? "Guardando..."
              : editandoId
                ? "Actualizar producto"
                : "Crear producto"}
          </button>

          {editandoId && (
            <button
              type="button"
              onClick={limpiarFormulario}
              disabled={saving}
              className="w-full rounded-xl border border-lp-navy bg-white px-4 py-3 font-semibold text-lp-navy disabled:opacity-60"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-lp-navy">
              Productos registrados
            </h2>

            <p className="text-xs text-lp-navy/60">
              {productosFiltrados.length} resultado
              {productosFiltrados.length === 1 ? "" : "s"}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-lp-navy">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(event) =>
                setMostrarInactivos(event.target.checked)
              }
            />

            Mostrar inactivos
          </label>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar producto, marca o presentación..."
          autoComplete="off"
          className="w-full rounded-xl border bg-white p-3 text-lp-navy"
        />
      </section>

      {loading ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-lp-navy/70 shadow-sm">
          Cargando catálogo...
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-lp-navy/70 shadow-sm">
          No hay productos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="space-y-3">
          {productosFiltrados.map((producto) => (
            <section
              key={producto.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                producto.activo ? "" : "opacity-60"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-lp-navy">
                      {producto.nombre}
                    </h3>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        producto.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {producto.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  {(producto.marca || producto.presentacion) && (
                    <p className="mt-1 text-sm text-lp-navy/60">
                      {[producto.marca, producto.presentacion]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  <p className="mt-2 break-all text-xs text-lp-navy/40">
                    {producto.nombreNormalizado}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => editarProducto(producto)}
                    disabled={!producto.activo}
                    className="rounded-xl border border-lp-navy bg-white px-4 py-2 text-sm font-semibold text-lp-navy disabled:opacity-40"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => cambiarEstado(producto)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                      producto.activo
                        ? "border-red-500 text-red-500"
                        : "border-green-600 text-green-600"
                    }`}
                  >
                    {producto.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}