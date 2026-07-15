"use client";

import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ProductoCompra = {
  id: number;
  nombre: string;
  nombreNormalizado: string;
  marca: string | null;
  presentacion: string | null;
  activo: boolean;
  etiqueta: string;
};

type ProductoAutocompleteProps = {
  value: ProductoCompra | null;
  onChange: (producto: ProductoCompra | null) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

type CrearProductoForm = {
  nombre: string;
  marca: string;
  presentacion: string;
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

export default function ProductoAutocomplete({
  value,
  onChange,
  disabled = false,
  placeholder = "Buscar producto o concepto...",
  autoFocus = false,
}: ProductoAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  const [busqueda, setBusqueda] = useState(
    value ? construirEtiqueta(value) : ""
  );

  const [productos, setProductos] = useState<ProductoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [creating, setCreating] = useState(false);

  const [crearForm, setCrearForm] = useState<CrearProductoForm>({
    nombre: "",
    marca: "",
    presentacion: "",
  });

  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setBusqueda(value ? construirEtiqueta(value) : "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setMostrarCrear(false);

        if (value) {
          setBusqueda(construirEtiqueta(value));
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value]);

  useEffect(() => {
    const query = busqueda.trim();

    if (
      disabled ||
      value ||
      mostrarCrear ||
      query.length < 1
    ) {
      setProductos([]);
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      requestRef.current?.abort();

      const controller = new AbortController();
      requestRef.current = controller;

      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/lp/productos-compras?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "No se pudieron buscar los productos."
          );
        }

        setProductos(data.productos || []);
        setOpen(true);
        setActiveIndex(-1);
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }

        console.error("Error buscando productos:", fetchError);

        setProductos([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "No se pudieron buscar los productos."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [busqueda, disabled, value, mostrarCrear]);

  const existeCoincidenciaExacta = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) {
      return false;
    }

    return productos.some((producto) => {
      const etiqueta = construirEtiqueta(producto).toLowerCase();
      const nombre = producto.nombre.trim().toLowerCase();

      return etiqueta === query || nombre === query;
    });
  }, [busqueda, productos]);

  const puedeCrear =
    busqueda.trim().length > 1 &&
    !value &&
    !existeCoincidenciaExacta;

  const seleccionarProducto = (producto: ProductoCompra) => {
    onChange(producto);
    setBusqueda(construirEtiqueta(producto));
    setProductos([]);
    setOpen(false);
    setMostrarCrear(false);
    setError("");
    setActiveIndex(-1);
  };

  const limpiarSeleccion = () => {
    onChange(null);
    setBusqueda("");
    setProductos([]);
    setOpen(false);
    setMostrarCrear(false);
    setError("");
    setActiveIndex(-1);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const abrirFormularioCrear = () => {
    const nombre = busqueda.trim();

    setCrearForm({
      nombre,
      marca: "",
      presentacion: "",
    });

    setMostrarCrear(true);
    setOpen(false);
    setError("");
  };

  const cancelarCreacion = () => {
    setMostrarCrear(false);
    setCrearForm({
      nombre: "",
      marca: "",
      presentacion: "",
    });

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const crearProducto = async () => {
    const nombre = crearForm.nombre.trim();
    const marca = crearForm.marca.trim();
    const presentacion = crearForm.presentacion.trim();

    if (!nombre) {
      setError("Escribe el nombre del producto o concepto.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await fetch("/api/lp/productos-compras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre,
          marca: marca || null,
          presentacion: presentacion || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "No fue posible crear el producto."
        );
      }

      const producto: ProductoCompra = data.producto;

      seleccionarProducto(producto);

      setCrearForm({
        nombre: "",
        marca: "",
        presentacion: "",
      });
    } catch (createError) {
      console.error("Error creando producto:", createError);

      setError(
        createError instanceof Error
          ? createError.message
          : "No fue posible crear el producto."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (texto: string) => {
    setBusqueda(texto);
    setError("");
    setMostrarCrear(false);

    if (value) {
      onChange(null);
    }

    setOpen(Boolean(texto.trim()));
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (mostrarCrear) {
      return;
    }

    const cantidadOpciones =
      productos.length + (puedeCrear ? 1 : 0);

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setOpen(true);
      setActiveIndex((current) =>
        Math.min(current + 1, cantidadOpciones - 1)
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((current) =>
        Math.max(current - 1, 0)
      );

      return;
    }

    if (event.key === "Enter") {
      if (!open) {
        setOpen(true);
        return;
      }

      event.preventDefault();

      if (
        activeIndex >= 0 &&
        activeIndex < productos.length
      ) {
        seleccionarProducto(productos[activeIndex]);
        return;
      }

      if (
        puedeCrear &&
        activeIndex === productos.length
      ) {
        abrirFormularioCrear();
        return;
      }

      if (productos.length === 1) {
        seleccionarProducto(productos[0]);
      }

      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setMostrarCrear(false);

      if (value) {
        setBusqueda(construirEtiqueta(value));
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative space-y-2"
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={busqueda}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => {
            if (!value && busqueda.trim()) {
              setOpen(true);
            }
          }}
          onChange={(event) =>
            handleInputChange(event.target.value)
          }
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border bg-white p-3 pr-10 text-lp-navy disabled:cursor-not-allowed disabled:opacity-60"
        />

        {(busqueda || value) && !disabled && (
          <button
            type="button"
            onClick={limpiarSeleccion}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-lp-navy/50 hover:text-lp-navy"
            aria-label="Limpiar producto"
          >
            ✕
          </button>
        )}
      </div>

      {value && (
        <div className="rounded-xl border bg-lp-light p-3">
          <p className="text-xs text-lp-navy/60">
            Producto seleccionado
          </p>

          <p className="text-sm font-bold text-lp-navy">
            {value.nombre}
          </p>

          {(value.marca || value.presentacion) && (
            <p className="mt-1 text-xs text-lp-navy/60">
              {[value.marca, value.presentacion]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      {open && !value && !mostrarCrear && (
        <div className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-white shadow-xl">
          {loading && (
            <div className="px-4 py-3 text-sm text-lp-navy/60">
              Buscando productos...
            </div>
          )}

          {!loading &&
            productos.map((producto, index) => (
              <button
                key={producto.id}
                type="button"
                onMouseEnter={() =>
                  setActiveIndex(index)
                }
                onClick={() =>
                  seleccionarProducto(producto)
                }
                className={`w-full border-b px-4 py-3 text-left last:border-b-0 ${
                  activeIndex === index
                    ? "bg-lp-light"
                    : "bg-white hover:bg-lp-light"
                }`}
              >
                <p className="text-sm font-bold text-lp-navy">
                  {producto.nombre}
                </p>

                {(producto.marca ||
                  producto.presentacion) && (
                  <p className="mt-0.5 text-xs text-lp-navy/60">
                    {[
                      producto.marca,
                      producto.presentacion,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </button>
            ))}

          {!loading &&
            productos.length === 0 &&
            busqueda.trim() &&
            !error && (
              <div className="px-4 py-3 text-sm text-lp-navy/60">
                No encontramos coincidencias.
              </div>
            )}

          {!loading && puedeCrear && (
            <button
              type="button"
              onMouseEnter={() =>
                setActiveIndex(productos.length)
              }
              onClick={abrirFormularioCrear}
              className={`w-full px-4 py-3 text-left text-lp-navy ${
                activeIndex === productos.length
                  ? "bg-lp-gold/20"
                  : "bg-lp-light hover:bg-lp-gold/20"
              }`}
            >
              <p className="text-sm font-bold">
                + Crear “{busqueda.trim()}”
              </p>

              <p className="mt-0.5 text-xs text-lp-navy/60">
                Puedes agregar marca y presentación.
              </p>
            </button>
          )}
        </div>
      )}

      {mostrarCrear && (
        <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
          <div>
            <p className="font-bold text-lp-navy">
              Crear producto o concepto
            </p>

            <p className="text-xs text-lp-navy/60">
              Marca y presentación son opcionales.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Nombre
            </label>

            <input
              type="text"
              value={crearForm.nombre}
              onChange={(event) =>
                setCrearForm((current) => ({
                  ...current,
                  nombre: event.target.value,
                }))
              }
              autoComplete="off"
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
              placeholder="Ej: Bleach"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-lp-navy">
                Marca
              </label>

              <input
                type="text"
                value={crearForm.marca}
                onChange={(event) =>
                  setCrearForm((current) => ({
                    ...current,
                    marca: event.target.value,
                  }))
                }
                autoComplete="off"
                className="w-full rounded-xl border bg-white p-3 text-lp-navy"
                placeholder="Ej: Clorox"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-lp-navy">
                Presentación
              </label>

              <input
                type="text"
                value={crearForm.presentacion}
                onChange={(event) =>
                  setCrearForm((current) => ({
                    ...current,
                    presentacion: event.target.value,
                  }))
                }
                autoComplete="off"
                className="w-full rounded-xl border bg-white p-3 text-lp-navy"
                placeholder="Ej: 1 gal"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cancelarCreacion}
              disabled={creating}
              className="rounded-xl border border-lp-navy bg-white px-4 py-3 font-semibold text-lp-navy disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={crearProducto}
              disabled={
                creating || !crearForm.nombre.trim()
              }
              className="rounded-xl bg-lp-gold px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {creating
                ? "Creando..."
                : "Crear y seleccionar"}
            </button>
          </div>
        </div>
      )}

      {error && !mostrarCrear && (
        <p className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}