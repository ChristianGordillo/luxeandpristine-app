"use client";

import { useEffect, useMemo, useState } from "react";
import ProductoAutocomplete, {
  type ProductoCompra,
} from "@/app/components/lp/ProductoAutocomplete";
import ComprasNav from "@/app/components/lp/ComprasNav";

type Categoria =
  | "GASOLINA"
  | "REPUESTOS_CARRO"
  | "INSUMOS"
  | "TAXES"
  | "NOMINA"
  | "OTROS";

type TipoPrecio = "UNITARIO" | "TOTAL";

type Proveedor = {
  id: number;
  nombre: string;
};

type CompraItemForm = {
  producto: ProductoCompra | null;
  nombreHistorico: string;
  cantidad: string;
  valor: string;
  tipoPrecio: TipoPrecio;
};

type CompraItem = {
  id: number;
  productoId: number | null;
  producto: ProductoCompra | null;
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

const crearItemVacio = (): CompraItemForm => ({
  producto: null,
  nombreHistorico: "",
  cantidad: "1",
  valor: "",
  tipoPrecio: "UNITARIO",
});

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
  return categorias.find((item) => item.value === categoria)?.label || categoria;
}

function redondearDinero(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function obtenerCantidad(item: CompraItemForm) {
  const cantidad = Number(item.cantidad);

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return 0;
  }

  return cantidad;
}

function obtenerValorIngresado(item: CompraItemForm) {
  const valor = Number(item.valor);

  if (!Number.isFinite(valor) || valor <= 0) {
    return 0;
  }

  return valor;
}

function calcularTotalItem(item: CompraItemForm) {
  const cantidad = obtenerCantidad(item);
  const valor = obtenerValorIngresado(item);

  if (item.tipoPrecio === "UNITARIO") {
    return redondearDinero(cantidad * valor);
  }

  return redondearDinero(valor);
}

function calcularPrecioUnitario(item: CompraItemForm) {
  const cantidad = obtenerCantidad(item);
  const valor = obtenerValorIngresado(item);

  if (item.tipoPrecio === "UNITARIO") {
    return redondearDinero(valor);
  }

  if (cantidad <= 0) {
    return 0;
  }

  return redondearDinero(valor / cantidad);
}

function construirEtiquetaProducto(producto: ProductoCompra | null) {
  if (!producto) {
    return "";
  }

  if (producto.etiqueta) {
    return producto.etiqueta;
  }

  return [producto.nombre, producto.marca, producto.presentacion]
    .filter(Boolean)
    .join(" · ");
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
  const [items, setItems] = useState<CompraItemForm[]>([crearItemVacio()]);

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

      if (!comprasRes.ok || !proveedoresRes.ok) {
        throw new Error("No se pudo cargar la información.");
      }

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
    try {
      const res = await fetch("/api/lp/proveedores-compras");

      if (!res.ok) {
        throw new Error("No se pudieron cargar los proveedores.");
      }

      const data = await res.json();

      setProveedores(data.proveedores || []);
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [desde, hasta]);

  const proveedoresFiltrados = useMemo(() => {
    const query = proveedorBusqueda.trim().toLowerCase();

    if (!query || proveedorSeleccionado) {
      return [];
    }

    return proveedores
      .filter((proveedor) =>
        proveedor.nombre.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [proveedorBusqueda, proveedores, proveedorSeleccionado]);

  const proveedorExisteExacto = useMemo(() => {
    const query = proveedorBusqueda.trim().toLowerCase();

    if (!query) {
      return false;
    }

    return proveedores.some(
      (proveedor) => proveedor.nombre.trim().toLowerCase() === query
    );
  }, [proveedorBusqueda, proveedores]);

  const puedeCrearProveedor =
    proveedorBusqueda.trim().length > 1 &&
    !proveedorSeleccionado &&
    !proveedorExisteExacto;

  const subtotal = useMemo(() => {
    const resultado = items.reduce(
      (acumulado, item) => acumulado + calcularTotalItem(item),
      0
    );

    return redondearDinero(resultado);
  }, [items]);

  const taxesNumber = useMemo(() => {
    const valor = Number(taxes);

    if (!Number.isFinite(valor) || valor < 0) {
      return 0;
    }

    return redondearDinero(valor);
  }, [taxes]);

  const total = redondearDinero(subtotal + taxesNumber);

  const resumen = useMemo(() => {
    return {
      cantidad: compras.length,

      subtotal: redondearDinero(
        compras.reduce(
          (acumulado, compra) => acumulado + Number(compra.subtotal || 0),
          0
        )
      ),

      taxes: redondearDinero(
        compras.reduce(
          (acumulado, compra) => acumulado + Number(compra.taxes || 0),
          0
        )
      ),

      total: redondearDinero(
        compras.reduce(
          (acumulado, compra) => acumulado + Number(compra.total || 0),
          0
        )
      ),
    };
  }, [compras]);

  const limpiarFormulario = () => {
    setFecha(getTodayInputValue());
    setProveedorBusqueda("");
    setProveedorSeleccionado(null);
    setCategoria("INSUMOS");
    setTaxes("");
    setItems([crearItemVacio()]);
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
      console.error("Error creando proveedor:", error);
      alert("Error al crear proveedor.");
    } finally {
      setCreatingProveedor(false);
    }
  };

  const actualizarItem = <K extends keyof CompraItemForm>(
    index: number,
    field: K,
    value: CompraItemForm[K]
  ) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const seleccionarProducto = (
    index: number,
    producto: ProductoCompra | null
  ) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              producto,
              nombreHistorico: producto ? "" : item.nombreHistorico,
            }
          : item
      )
    );
  };

  const cambiarTipoPrecio = (index: number, nuevoTipo: TipoPrecio) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index || item.tipoPrecio === nuevoTipo) {
          return item;
        }

        if (!item.valor.trim()) {
          return {
            ...item,
            tipoPrecio: nuevoTipo,
          };
        }

        const cantidad = obtenerCantidad(item);
        const totalActual = calcularTotalItem(item);

        if (nuevoTipo === "TOTAL") {
          return {
            ...item,
            tipoPrecio: "TOTAL",
            valor: totalActual > 0 ? String(totalActual) : "",
          };
        }

        const precioUnitario =
          cantidad > 0
            ? redondearDinero(totalActual / cantidad)
            : 0;

        return {
          ...item,
          tipoPrecio: "UNITARIO",
          valor: precioUnitario > 0 ? String(precioUnitario) : "",
        };
      })
    );
  };

  const agregarItem = () => {
    setItems((prev) => [...prev, crearItemVacio()]);
  };

  const eliminarItem = (index: number) => {
    setItems((prev) => {
      if (prev.length === 1) {
        return prev;
      }

      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const cargarCompraParaEditar = (compra: Compra) => {
    setEditandoId(compra.id);
    setFecha(formatDateInput(compra.fecha));
    setProveedorSeleccionado(compra.proveedor);
    setProveedorBusqueda(compra.proveedor.nombre);
    setCategoria(compra.categoria);
    setTaxes(compra.taxes ? String(compra.taxes) : "");

    setItems(
      compra.items.length > 0
        ? compra.items.map((item) => ({
            producto: item.producto || null,
            nombreHistorico: item.producto ? "" : item.nombre,
            cantidad: String(item.cantidad || 1),
            valor: String(item.precioBase || ""),
            tipoPrecio: "TOTAL" as TipoPrecio,
          }))
        : [crearItemVacio()]
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const guardarCompra = async () => {
    if (!fecha || !proveedorSeleccionado || !categoria) {
      alert("Completa fecha, proveedor y categoría.");
      return;
    }

    const lineasConInformacion = items.filter((item) => {
      return (
        item.producto !== null ||
        Boolean(item.nombreHistorico) ||
        Boolean(item.valor.trim()) ||
        item.cantidad.trim() !== "1"
      );
    });

    if (lineasConInformacion.length === 0) {
      alert("Agrega al menos un producto o concepto.");
      return;
    }

    const itemSinProducto = lineasConInformacion.find(
      (item) => !item.producto
    );

    if (itemSinProducto) {
      alert(
        itemSinProducto.nombreHistorico
          ? `Debes asociar "${itemSinProducto.nombreHistorico}" con un producto del catálogo antes de guardar.`
          : "Selecciona un producto o concepto en cada línea."
      );
      return;
    }

    const itemConCantidadInvalida = lineasConInformacion.find(
      (item) => obtenerCantidad(item) <= 0
    );

    if (itemConCantidadInvalida) {
      alert("La cantidad de cada producto debe ser mayor que cero.");
      return;
    }

    const itemConValorInvalido = lineasConInformacion.find(
      (item) => obtenerValorIngresado(item) <= 0
    );

    if (itemConValorInvalido) {
      alert("El valor de cada producto debe ser mayor que cero.");
      return;
    }

    const itemsValidos = lineasConInformacion.filter(
      (
        item
      ): item is CompraItemForm & {
        producto: ProductoCompra;
      } =>
        item.producto !== null &&
        obtenerCantidad(item) > 0 &&
        calcularTotalItem(item) > 0
    );

    if (itemsValidos.length === 0) {
      alert("Agrega al menos un producto válido.");
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
            productoId: item.producto.id,
            nombre: item.producto.nombre,
            cantidad: obtenerCantidad(item),
            precioBase: calcularTotalItem(item),
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
      console.error("Error guardando compra:", error);
      alert("Error al guardar compra.");
    } finally {
      setSaving(false);
    }
  };

  const eliminarCompra = async (id: number) => {
    const confirmar = confirm("¿Eliminar esta compra?");

    if (!confirmar) {
      return;
    }

    try {
      setDeletingId(id);

      const res = await fetch(`/api/lp/compras?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Error al eliminar compra.");
        return;
      }

      if (editandoId === id) {
        limpiarFormulario();
      }

      await fetchData();
    } catch (error) {
      console.error("Error eliminando compra:", error);
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
        <h1 className="text-2xl font-bold text-lp-navy">
          Compras
        </h1>
        <ComprasNav />
        <p className="mt-1 text-sm text-lp-navy/70">
          Registra compras y gastos usando un catálogo normalizado.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-lp-navy">
            {editandoId ? "Editar compra" : "Registrar compra"}
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
              Fecha
            </label>

            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>

          <div className="relative space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Proveedor
            </label>

            <input
              type="text"
              value={proveedorBusqueda}
              onChange={(event) => {
                setProveedorBusqueda(event.target.value);
                setProveedorSeleccionado(null);
              }}
              placeholder="Buscar o crear proveedor..."
              autoComplete="off"
              className="w-full rounded-xl border bg-white p-3 pr-10 text-lp-navy"
            />

            {proveedorBusqueda && (
              <button
                type="button"
                onClick={() => {
                  setProveedorBusqueda("");
                  setProveedorSeleccionado(null);
                }}
                className="absolute right-3 top-[38px] text-lp-navy/50"
                aria-label="Limpiar proveedor"
              >
                ✕
              </button>
            )}

            {(proveedoresFiltrados.length > 0 || puedeCrearProveedor) && (
              <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                {proveedoresFiltrados.map((proveedor) => (
                  <button
                    key={proveedor.id}
                    type="button"
                    onClick={() => {
                      setProveedorSeleccionado(proveedor);
                      setProveedorBusqueda(proveedor.nombre);
                    }}
                    className="w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-lp-light"
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
                    className="w-full bg-lp-light px-4 py-3 text-left text-lp-navy hover:bg-lp-gold/20 disabled:opacity-60"
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
              onChange={(event) =>
                setCategoria(event.target.value as Categoria)
              }
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            >
              {categorias.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {proveedorSeleccionado && (
          <div className="rounded-xl border bg-lp-light p-3">
            <p className="text-xs text-lp-navy/60">
              Proveedor seleccionado
            </p>

            <p className="text-sm font-bold text-lp-navy">
              {proveedorSeleccionado.nombre}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-lp-navy">
              Productos o conceptos
            </h3>

            <p className="text-xs text-lp-navy/60">
              Selecciona un producto del catálogo o créalo sin salir del
              registro.
            </p>
          </div>

          {items.map((item, index) => {
            const precioUnitario = calcularPrecioUnitario(item);
            const totalItem = calcularTotalItem(item);

            return (
              <div
                key={index}
                className="space-y-3 rounded-2xl border bg-lp-light/40 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-lp-navy/50">
                    Línea {index + 1}
                  </p>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarItem(index)}
                      className="text-xs font-semibold text-red-500"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                {item.nombreHistorico && !item.producto && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">
                      Producto histórico sin normalizar
                    </p>

                    <p className="mt-1 text-sm font-bold text-amber-900">
                      {item.nombreHistorico}
                    </p>

                    <p className="mt-1 text-xs text-amber-700">
                      Busca o crea el producto correcto para asociar esta
                      compra al catálogo.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-lp-navy">
                    Producto o concepto
                  </label>

                  <ProductoAutocomplete
                    value={item.producto}
                    onChange={(producto) =>
                      seleccionarProducto(index, producto)
                    }
                    placeholder={
                      item.nombreHistorico
                        ? `Buscar equivalente de ${item.nombreHistorico}...`
                        : "Buscar producto o concepto..."
                    }
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-lp-navy">
                      Cantidad
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={item.cantidad}
                      onChange={(event) =>
                        actualizarItem(
                          index,
                          "cantidad",
                          event.target.value
                        )
                      }
                      onWheel={(event) => event.currentTarget.blur()}
                      disabled={saving}
                      className="w-full rounded-xl border bg-white p-3 text-lp-navy disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-lp-navy">
                      ¿Qué valor tienes?
                    </label>

                    <select
                      value={item.tipoPrecio}
                      onChange={(event) =>
                        cambiarTipoPrecio(
                          index,
                          event.target.value as TipoPrecio
                        )
                      }
                      disabled={saving}
                      className="w-full rounded-xl border bg-white p-3 text-lp-navy disabled:opacity-60"
                    >
                      <option value="UNITARIO">
                        Precio unitario
                      </option>

                      <option value="TOTAL">
                        Total de la línea
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-lp-navy">
                      {item.tipoPrecio === "UNITARIO"
                        ? "Precio por unidad"
                        : "Valor total"}
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={item.valor}
                      onChange={(event) =>
                        actualizarItem(index, "valor", event.target.value)
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      onWheel={(event) => event.currentTarget.blur()}
                      disabled={saving}
                      placeholder="0.00"
                      className="w-full rounded-xl border bg-white p-3 text-lp-navy disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-xs text-lp-navy/60">
                      Precio unitario
                    </p>

                    <p className="text-base font-bold text-lp-navy">
                      {formatMoney(precioUnitario)}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-xs text-lp-navy/60">
                      Total de la línea
                    </p>

                    <p className="text-base font-bold text-lp-navy">
                      {formatMoney(totalItem)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={agregarItem}
            disabled={saving}
            className="w-full rounded-xl border border-lp-navy px-4 py-3 font-semibold text-lp-navy disabled:opacity-60"
          >
            + Agregar otro producto
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ResumenCard
            label="Subtotal"
            value={formatMoney(subtotal)}
          />

          <div className="rounded-xl bg-lp-light p-3">
            <p className="text-xs text-lp-navy/60">
              Taxes
            </p>

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={taxes}
              onChange={(event) => setTaxes(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onWheel={(event) => event.currentTarget.blur()}
              disabled={saving}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border bg-white p-2 text-lp-navy disabled:opacity-60"
            />
          </div>

          <ResumenCard
            label="Total"
            value={formatMoney(total)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={guardarCompra}
            disabled={saving}
            className="w-full rounded-xl bg-lp-gold px-4 py-3 font-semibold text-white disabled:opacity-60"
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
              disabled={saving}
              className="w-full rounded-xl border border-lp-navy bg-white px-4 py-3 font-semibold text-lp-navy disabled:opacity-60"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="font-bold text-lp-navy">
          Filtro
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Desde
            </label>

            <input
              type="date"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Hasta
            </label>

            <input
              type="date"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResumenCard
            label="Compras"
            value={resumen.cantidad}
          />

          <ResumenCard
            label="Subtotal"
            value={formatMoney(resumen.subtotal)}
          />

          <ResumenCard
            label="Taxes"
            value={formatMoney(resumen.taxes)}
          />

          <ResumenCard
            label="Total"
            value={formatMoney(resumen.total)}
          />
        </div>
      </div>

      {compras.length === 0 ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-lp-navy/70 shadow-sm">
          No hay compras en este rango.
        </div>
      ) : (
        <div className="space-y-4">
          {compras.map((compra) => (
            <section
              key={compra.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              <div className="space-y-1 border-b bg-lp-light p-4">
                <p className="text-xs text-lp-navy/60">
                  {formatDate(compra.fecha)} ·{" "}
                  {categoriaLabel(compra.categoria)}
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

              <div className="space-y-3 p-4">
                {compra.items.map((item) => {
                  const precioUnitario =
                    item.cantidad > 0
                      ? redondearDinero(
                          Number(item.precioBase || 0) / item.cantidad
                        )
                      : 0;

                  const nombreProducto =
                    construirEtiquetaProducto(item.producto) ||
                    item.nombre;

                  return (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-xl border bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-lp-navy">
                            {nombreProducto}
                          </p>

                          <p className="text-xs text-lp-navy/60">
                            {item.cantidad} unidad
                            {item.cantidad === 1 ? "" : "es"} ×{" "}
                            {formatMoney(precioUnitario)}
                          </p>

                          {!item.productoId && (
                            <p className="mt-1 text-xs font-semibold text-amber-600">
                              Pendiente de normalizar
                            </p>
                          )}
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
                  );
                })}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => cargarCompraParaEditar(compra)}
                    className="w-full rounded-xl border border-lp-navy bg-white px-4 py-3 font-semibold text-lp-navy"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => eliminarCompra(compra.id)}
                    disabled={deletingId === compra.id}
                    className="w-full rounded-xl border border-red-500 px-4 py-3 font-semibold text-red-500 disabled:opacity-60"
                  >
                    {deletingId === compra.id
                      ? "Eliminando..."
                      : "Eliminar"}
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
    <div className="min-w-0 rounded-xl bg-lp-light p-3">
      <p className="truncate text-xs text-lp-navy/60">
        {label}
      </p>

      <p className="truncate text-xl font-bold text-lp-navy">
        {value}
      </p>
    </div>
  );
}