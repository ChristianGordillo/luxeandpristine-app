"use client";

import { useEffect, useMemo, useState } from "react";

type Categoria =
  | "GASOLINA"
  | "REPUESTOS_CARRO"
  | "INSUMOS"
  | "TAXES"
  | "NOMINA"
  | "OTROS";

type Proveedor = {
  id: number;
  nombre: string;
};

type CompraItemForm = {
  nombre: string;
  cantidad: string;
  precioBase: string;
};

type CompraItem = {
  id: number;
  nombre: string;
  cantidad: number;
  precioBase: number;
  taxAsignado: number;
  precioFinal: number;
};

type Compra = {
  id: number;
  fecha: string;
  categoria: Categoria;
  subtotal: number;
  taxes: number;
  total: number;
  proveedor: Proveedor;
  items: CompraItem[];
};

const categorias: { value: Categoria; label: string }[] = [
  { value: "INSUMOS", label: "Insumos" },
  { value: "GASOLINA", label: "Gasolina" },
  { value: "REPUESTOS_CARRO", label: "Repuestos carro" },
  { value: "TAXES", label: "Taxes" },
  { value: "NOMINA", label: "Nómina" },
  { value: "OTROS", label: "Otros" },
];

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function formatDate(fecha: string) {
  return fecha.split("T")[0].split("-").reverse().join("/");
}

function formatDateInput(fecha: string) {
  return fecha.split("T")[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function categoriaLabel(categoria: Categoria) {
  return categorias.find((c) => c.value === categoria)?.label || categoria;
}

export default function ComprasPage() {
  const today = getTodayInputValue();

  const [fecha, setFecha] = useState(today);
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorBusqueda, setProveedorBusqueda] = useState("");
  const [proveedorSeleccionado, setProveedorSeleccionado] =
    useState<Proveedor | null>(null);
  const [creatingProveedor, setCreatingProveedor] = useState(false);

  const [categoria, setCategoria] = useState<Categoria>("INSUMOS");
  const [taxes, setTaxes] = useState("");
  const [items, setItems] = useState<CompraItemForm[]>([
    { nombre: "", cantidad: "1", precioBase: "" },
  ]);

  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [comprasRes, proveedoresRes] = await Promise.all([
        fetch(`/api/lp/compras?desde=${desde}&hasta=${hasta}`),
        fetch("/api/lp/proveedores-compras"),
      ]);

      const comprasData = await comprasRes.json();
      const proveedoresData = await proveedoresRes.json();

      setCompras(comprasData.compras || []);
      setProveedores(proveedoresData.proveedores || []);
    } catch (error) {
      console.error("Error cargando compras:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProveedores = async () => {
    const res = await fetch("/api/lp/proveedores-compras");
    const data = await res.json();
    setProveedores(data.proveedores || []);
  };

  useEffect(() => {
    fetchData();
  }, [desde, hasta]);

  const proveedoresFiltrados = useMemo(() => {
    const q = proveedorBusqueda.trim().toLowerCase();

    if (!q || proveedorSeleccionado) return [];

    return proveedores
      .filter((proveedor) => proveedor.nombre.toLowerCase().includes(q))
      .slice(0, 8);
  }, [proveedorBusqueda, proveedores, proveedorSeleccionado]);

  const proveedorExisteExacto = useMemo(() => {
    const q = proveedorBusqueda.trim().toLowerCase();

    if (!q) return false;

    return proveedores.some(
      (proveedor) => proveedor.nombre.trim().toLowerCase() === q
    );
  }, [proveedorBusqueda, proveedores]);

  const puedeCrearProveedor =
    proveedorBusqueda.trim().length > 1 &&
    !proveedorSeleccionado &&
    !proveedorExisteExacto;

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.precioBase || 0), 0);
  }, [items]);

  const taxesNumber = Number(taxes || 0);
  const total = subtotal + taxesNumber;

  const resumen = useMemo(() => {
    return {
      cantidad: compras.length,
      subtotal: compras.reduce((acc, compra) => acc + compra.subtotal, 0),
      taxes: compras.reduce((acc, compra) => acc + compra.taxes, 0),
      total: compras.reduce((acc, compra) => acc + compra.total, 0),
    };
  }, [compras]);

  const limpiarFormulario = () => {
    setFecha(getTodayInputValue());
    setProveedorBusqueda("");
    setProveedorSeleccionado(null);
    setCategoria("INSUMOS");
    setTaxes("");
    setItems([{ nombre: "", cantidad: "1", precioBase: "" }]);
    setEditandoId(null);
  };

  const crearProveedorRapido = async () => {
    const nombre = proveedorBusqueda.trim();

    if (!nombre) {
      alert("Escribe el nombre del proveedor.");
      return;
    }

    try {
      setCreatingProveedor(true);

      const res = await fetch("/api/lp/proveedores-compras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nombre }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Error al crear proveedor.");
        return;
      }

      const nuevoProveedor: Proveedor = data.proveedor;

      setProveedorSeleccionado(nuevoProveedor);
      setProveedorBusqueda(nuevoProveedor.nombre);

      await fetchProveedores();
    } catch (error) {
      console.error(error);
      alert("Error al crear proveedor.");
    } finally {
      setCreatingProveedor(false);
    }
  };

  const actualizarItem = (
    index: number,
    field: keyof CompraItemForm,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const agregarItem = () => {
    setItems((prev) => [
      ...prev,
      { nombre: "", cantidad: "1", precioBase: "" },
    ]);
  };

  const eliminarItem = (index: number) => {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const cargarCompraParaEditar = (compra: Compra) => {
    setEditandoId(compra.id);
    setFecha(formatDateInput(compra.fecha));
    setProveedorSeleccionado(compra.proveedor);
    setProveedorBusqueda(compra.proveedor.nombre);
    setCategoria(compra.categoria);
    setTaxes(String(compra.taxes || ""));
    setItems(
      compra.items.length > 0
        ? compra.items.map((item) => ({
            nombre: item.nombre,
            cantidad: String(item.cantidad),
            precioBase: String(item.precioBase),
          }))
        : [{ nombre: "", cantidad: "1", precioBase: "" }]
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardarCompra = async () => {
    if (!fecha || !proveedorSeleccionado || !categoria) {
      alert("Completa fecha, proveedor y categoría.");
      return;
    }

    const itemsValidos = items.filter(
      (item) => item.nombre.trim() && Number(item.precioBase || 0) > 0
    );

    if (itemsValidos.length === 0) {
      alert("Agrega al menos un producto con precio.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lp/compras", {
        method: editandoId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editandoId ? { id: editandoId } : {}),
          fecha,
          proveedorId: proveedorSeleccionado.id,
          categoria,
          taxes: taxesNumber,
          items: itemsValidos.map((item) => ({
            nombre: item.nombre.trim(),
            cantidad: Number(item.cantidad || 1),
            precioBase: Number(item.precioBase || 0),
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Error al guardar compra.");
        return;
      }

      limpiarFormulario();
      await fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al guardar compra.");
    } finally {
      setSaving(false);
    }
  };

  const eliminarCompra = async (id: number) => {
    const confirmar = confirm("¿Eliminar esta compra?");
    if (!confirmar) return;

    try {
      setDeletingId(id);

      const res = await fetch(`/api/lp/compras?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Error al eliminar compra.");
        return;
      }

      if (editandoId === id) {
        limpiarFormulario();
      }

      await fetchData();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar compra.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <p className="text-lp-navy">Cargando compras...</p>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">Compras</h1>
        <p className="text-sm text-lp-navy/70 mt-1">
          Control de gastos, proveedores y costo real de productos con taxes.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">
            {editandoId ? "Editar compra" : "Registrar compra"}
          </h2>

          {editandoId && (
            <span className="text-xs font-bold bg-lp-gold/20 text-lp-navy px-3 py-1 rounded-full">
              Editando
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-lp-navy">
              Proveedor
            </label>

            <input
              type="text"
              value={proveedorBusqueda}
              onChange={(e) => {
                setProveedorBusqueda(e.target.value);
                setProveedorSeleccionado(null);
              }}
              placeholder="Buscar o crear proveedor..."
              className="w-full border rounded-xl p-3 pr-10 text-lp-navy bg-white"
            />

            {proveedorBusqueda && (
              <button
                type="button"
                onClick={() => {
                  setProveedorBusqueda("");
                  setProveedorSeleccionado(null);
                }}
                className="absolute right-3 top-[38px] text-lp-navy/50"
              >
                ✕
              </button>
            )}

            {(proveedoresFiltrados.length > 0 || puedeCrearProveedor) && (
              <div className="absolute z-30 mt-2 w-full bg-white border rounded-xl shadow-lg overflow-hidden">
                {proveedoresFiltrados.map((proveedor) => (
                  <button
                    key={proveedor.id}
                    type="button"
                    onClick={() => {
                      setProveedorSeleccionado(proveedor);
                      setProveedorBusqueda(proveedor.nombre);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-lp-light border-b last:border-b-0"
                  >
                    <p className="text-sm font-semibold text-lp-navy">
                      {proveedor.nombre}
                    </p>
                  </button>
                ))}

                {puedeCrearProveedor && (
                  <button
                    type="button"
                    onClick={crearProveedorRapido}
                    disabled={creatingProveedor}
                    className="w-full text-left px-4 py-3 bg-lp-light hover:bg-lp-gold/20 text-lp-navy"
                  >
                    <p className="text-sm font-bold">
                      {creatingProveedor
                        ? "Creando proveedor..."
                        : `+ Crear "${proveedorBusqueda.trim()}"`}
                    </p>
                    <p className="text-xs text-lp-navy/60">
                      Se guardará y quedará seleccionado.
                    </p>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            >
              {categorias.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {proveedorSeleccionado && (
          <div className="bg-lp-light border rounded-xl p-3">
            <p className="text-xs text-lp-navy/60">Proveedor seleccionado</p>
            <p className="text-sm font-bold text-lp-navy">
              {proveedorSeleccionado.nombre}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-lp-navy">Productos</h3>
            <p className="text-xs text-lp-navy/60">
              Ingresa el valor de cada línea antes de taxes.
            </p>
          </div>

          {items.map((item, index) => (
            <div
              key={index}
              className="border rounded-2xl p-3 space-y-3 bg-lp-light/40"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-lp-navy">
                  Producto
                </label>
                <input
                  value={item.nombre}
                  onChange={(e) =>
                    actualizarItem(index, "nombre", e.target.value)
                  }
                  placeholder="Ej: Clorox, trash bags, detergent..."
                  className="w-full border rounded-xl p-3 text-lp-navy bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-lp-navy">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) =>
                      actualizarItem(index, "cantidad", e.target.value)
                    }
                    className="w-full border rounded-xl p-3 text-lp-navy bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-lp-navy">
                    Precio base
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.precioBase}
                    onChange={(e) =>
                      actualizarItem(index, "precioBase", e.target.value)
                    }
                    placeholder="0.00"
                    className="w-full border rounded-xl p-3 text-lp-navy bg-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => eliminarItem(index)}
                disabled={items.length === 1}
                className="w-full border border-red-500 text-red-500 rounded-xl px-4 py-2 text-sm disabled:opacity-40"
              >
                Eliminar producto
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={agregarItem}
            className="w-full border border-lp-navy text-lp-navy rounded-xl px-4 py-3 font-semibold"
          >
            + Agregar producto
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumenCard label="Subtotal" value={formatMoney(subtotal)} />

          <div className="bg-lp-light rounded-xl p-3">
            <p className="text-xs text-lp-navy/60">Taxes</p>
            <input
              type="number"
              step="0.01"
              value={taxes}
              onChange={(e) => setTaxes(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full border rounded-xl p-2 text-lp-navy bg-white"
            />
          </div>

          <ResumenCard label="Total" value={formatMoney(total)} />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={guardarCompra}
            disabled={saving}
            className="w-full bg-lp-gold text-white rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
          >
            {saving
              ? "Guardando..."
              : editandoId
              ? "Actualizar compra"
              : "Guardar compra"}
          </button>

          {editandoId && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="w-full border border-lp-navy text-lp-navy rounded-xl font-semibold px-4 py-3 bg-white"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="font-bold text-lp-navy">Filtro</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full border rounded-xl p-3 text-lp-navy bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResumenCard label="Compras" value={resumen.cantidad} />
          <ResumenCard label="Subtotal" value={formatMoney(resumen.subtotal)} />
          <ResumenCard label="Taxes" value={formatMoney(resumen.taxes)} />
          <ResumenCard label="Total" value={formatMoney(resumen.total)} />
        </div>
      </div>

      {compras.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm text-lp-navy/70">
          No hay compras en este rango.
        </div>
      ) : (
        <div className="space-y-4">
          {compras.map((compra) => (
            <section
              key={compra.id}
              className="bg-white border rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="p-4 bg-lp-light border-b space-y-1">
                <p className="text-xs text-lp-navy/60">
                  {formatDate(compra.fecha)} · {categoriaLabel(compra.categoria)}
                </p>

                <h2 className="text-xl font-bold text-lp-navy">
                  {compra.proveedor.nombre}
                </h2>

                <p className="text-sm text-lp-navy/70">
                  Subtotal {formatMoney(compra.subtotal)} · Taxes{" "}
                  {formatMoney(compra.taxes)} · Total{" "}
                  <span className="font-bold text-lp-navy">
                    {formatMoney(compra.total)}
                  </span>
                </p>
              </div>

              <div className="p-4 space-y-3">
                {compra.items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-xl p-3 bg-white space-y-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-lp-navy">{item.nombre}</p>
                        <p className="text-xs text-lp-navy/60">
                          Cantidad: {item.cantidad}
                        </p>
                      </div>

                      <p className="text-sm font-bold text-lp-navy">
                        {formatMoney(item.precioFinal)}
                      </p>
                    </div>

                    <p className="text-xs text-lp-navy/60">
                      Base {formatMoney(item.precioBase)} + Tax asignado{" "}
                      {formatMoney(item.taxAsignado)}
                    </p>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => cargarCompraParaEditar(compra)}
                    className="w-full border border-lp-navy text-lp-navy rounded-xl font-semibold px-4 py-3 bg-white"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => eliminarCompra(compra.id)}
                    disabled={deletingId === compra.id}
                    className="w-full border border-red-500 text-red-500 rounded-xl font-semibold px-4 py-3 disabled:opacity-60"
                  >
                    {deletingId === compra.id ? "Eliminando..." : "Eliminar"}
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