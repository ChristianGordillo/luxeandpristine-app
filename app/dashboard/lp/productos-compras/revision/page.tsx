"use client";

import { useEffect, useMemo, useState } from "react";
import ProductoAutocomplete, {
  type ProductoCompra,
} from "@/app/components/lp/ProductoAutocomplete";
import ComprasNav from "@/app/components/lp/ComprasNav";

type ProveedorResumen = {
  id: number;
  nombre: string;
  cantidadCompras: number;
  cantidadItems: number;
  cantidadTotal: number;
  gastoFinal: number;
};

type MovimientoHistorico = {
  itemId: number;
  compraId: number;
  fecha: string;
  proveedorId: number;
  proveedorNombre: string;
  cantidad: number;
  precioBase: number;
  taxAsignado: number;
  precioFinal: number;
};

type GrupoHistorico = {
  nombreHistorico: string;
  cantidadItems: number;
  cantidadTotal: number;
  gastoBase: number;
  taxAsignado: number;
  gastoFinal: number;
  primeraCompra: string;
  ultimaCompra: string;
  proveedores: ProveedorResumen[];
  movimientos: MovimientoHistorico[];
};

type ResumenRevision = {
  itemsPendientes: number;
  nombresPendientes: number;
  cantidadTotal: number;
  gastoBasePendiente: number;
  taxesPendientes: number;
  gastoFinalPendiente: number;
};

type RevisionResponse = {
  status: "success" | "fail";
  resumen?: ResumenRevision;
  grupos?: GrupoHistorico[];
  message?: string;
};

type Orden =
  | "MAYOR_GASTO"
  | "MAYOR_CANTIDAD"
  | "MAS_REGISTROS"
  | "NOMBRE";

const resumenInicial: ResumenRevision = {
  itemsPendientes: 0,
  nombresPendientes: 0,
  cantidadTotal: 0,
  gastoBasePendiente: 0,
  taxesPendientes: 0,
  gastoFinalPendiente: 0,
};

const palabrasPrioritarias = [
  "fabuloso",
  "clorox",
  "cloro",
  "bleach",
  "vinagre",
  "vinegar",
  "alcohol",
  "suavizante",
  "softener",
  "fabric softener",
  "papel de cocina",
  "paper towel",
  "paper towels",
  "papel de baño",
  "papel baño",
  "papel higienico",
  "toilet paper",
  "jabon de loza",
  "jabon loza",
  "dish soap",
  "lavaplatos",
  "esponja",
  "esponjas",
  "sponge",
  "sponges",
  "bolsa de basura",
  "bolsas de basura",
  "trash bag",
  "trash bags",
  "garbage bag",
  "garbage bags",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(fecha: string) {
  if (!fecha) {
    return "—";
  }

  const date = new Date(fecha);

  return new Intl.DateTimeFormat("es-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function normalizarTexto(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function esPrioritario(nombre: string) {
  const nombreNormalizado = normalizarTexto(nombre);

  return palabrasPrioritarias.some((palabra) =>
    nombreNormalizado.includes(normalizarTexto(palabra))
  );
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

export default function RevisionProductosComprasPage() {
  const [resumen, setResumen] =
    useState<ResumenRevision>(resumenInicial);

  const [grupos, setGrupos] = useState<GrupoHistorico[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    new Set()
  );

  const [productoDestino, setProductoDestino] =
    useState<ProductoCompra | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [soloPrioritarios, setSoloPrioritarios] = useState(false);
  const [orden, setOrden] = useState<Orden>("MAYOR_GASTO");

  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [asociando, setAsociando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargarRevision = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/lp/productos-compras/revision",
        {
          cache: "no-store",
        }
      );

      const data = (await response.json()) as RevisionResponse;

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message ||
            "No fue posible cargar los productos pendientes."
        );
      }

      setResumen(data.resumen || resumenInicial);
      setGrupos(data.grupos || []);

      setSeleccionados((actuales) => {
        const nombresDisponibles = new Set(
          (data.grupos || []).map((grupo) => grupo.nombreHistorico)
        );

        return new Set(
          [...actuales].filter((nombre) =>
            nombresDisponibles.has(nombre)
          )
        );
      });
    } catch (error) {
      console.error("Error cargando revisión:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar la revisión."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRevision();
  }, []);

  const gruposFiltrados = useMemo(() => {
    const query = normalizarTexto(busqueda);

    const resultado = grupos.filter((grupo) => {
      if (soloPrioritarios && !esPrioritario(grupo.nombreHistorico)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const proveedores = grupo.proveedores
        .map((proveedor) => proveedor.nombre)
        .join(" ");

      const texto = normalizarTexto(
        `${grupo.nombreHistorico} ${proveedores}`
      );

      return texto.includes(query);
    });

    return [...resultado].sort((a, b) => {
      if (orden === "MAYOR_CANTIDAD") {
        return b.cantidadTotal - a.cantidadTotal;
      }

      if (orden === "MAS_REGISTROS") {
        return b.cantidadItems - a.cantidadItems;
      }

      if (orden === "NOMBRE") {
        return a.nombreHistorico.localeCompare(
          b.nombreHistorico,
          "es",
          {
            sensitivity: "base",
          }
        );
      }

      return b.gastoFinal - a.gastoFinal;
    });
  }, [grupos, busqueda, soloPrioritarios, orden]);

  const nombresVisibles = useMemo(
    () => gruposFiltrados.map((grupo) => grupo.nombreHistorico),
    [gruposFiltrados]
  );

  const todosVisiblesSeleccionados =
    nombresVisibles.length > 0 &&
    nombresVisibles.every((nombre) => seleccionados.has(nombre));

  const gruposSeleccionados = useMemo(
    () =>
      grupos.filter((grupo) =>
        seleccionados.has(grupo.nombreHistorico)
      ),
    [grupos, seleccionados]
  );

  const resumenSeleccion = useMemo(() => {
    return gruposSeleccionados.reduce(
      (acc, grupo) => ({
        nombres: acc.nombres + 1,
        items: acc.items + grupo.cantidadItems,
        cantidad: acc.cantidad + grupo.cantidadTotal,
        gasto: acc.gasto + grupo.gastoFinal,
      }),
      {
        nombres: 0,
        items: 0,
        cantidad: 0,
        gasto: 0,
      }
    );
  }, [gruposSeleccionados]);

  const alternarSeleccion = (nombreHistorico: string) => {
    setMensaje("");

    setSeleccionados((actuales) => {
      const nuevos = new Set(actuales);

      if (nuevos.has(nombreHistorico)) {
        nuevos.delete(nombreHistorico);
      } else {
        nuevos.add(nombreHistorico);
      }

      return nuevos;
    });
  };

  const alternarTodosVisibles = () => {
    setMensaje("");

    setSeleccionados((actuales) => {
      const nuevos = new Set(actuales);

      if (todosVisiblesSeleccionados) {
        nombresVisibles.forEach((nombre) => nuevos.delete(nombre));
      } else {
        nombresVisibles.forEach((nombre) => nuevos.add(nombre));
      }

      return nuevos;
    });
  };

  const limpiarSeleccion = () => {
    setSeleccionados(new Set());
    setProductoDestino(null);
    setMensaje("");
  };

  const asociarSeleccionados = async () => {
    if (seleccionados.size === 0) {
      setError("Selecciona al menos un nombre histórico.");
      return;
    }

    if (!productoDestino) {
      setError("Selecciona el producto correcto del catálogo.");
      return;
    }

    const etiquetaDestino =
      construirEtiquetaProducto(productoDestino);

    const confirmar = confirm(
      `¿Asociar ${seleccionados.size} nombre${
        seleccionados.size === 1 ? "" : "s"
      } histórico${
        seleccionados.size === 1 ? "" : "s"
      } con "${etiquetaDestino}"?\n\nSe actualizarán ${
        resumenSeleccion.items
      } registros por un total de ${formatMoney(
        resumenSeleccion.gasto
      )}.`
    );

    if (!confirmar) {
      return;
    }

    try {
      setAsociando(true);
      setError("");
      setMensaje("");

      const response = await fetch(
        "/api/lp/productos-compras/revision",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productoId: productoDestino.id,
            nombresHistoricos: [...seleccionados],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message ||
            "No fue posible asociar los productos históricos."
        );
      }

      setMensaje(
        data.message ||
          "Los registros fueron asociados correctamente."
      );

      setSeleccionados(new Set());
      setProductoDestino(null);
      setGrupoExpandido(null);

      await cargarRevision();
    } catch (error) {
      console.error("Error asociando históricos:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible realizar la asociación."
      );
    } finally {
      setAsociando(false);
    }
  };

  return (
    <div className="space-y-5 pb-32">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Revisión de productos
        </h1>
        <ComprasNav />
        <p className="mt-1 text-sm text-lp-navy/70">
          Asocia los nombres históricos con los productos correctos del
          catálogo.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start justify-between gap-3">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              className="font-bold"
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
          {mensaje}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumenCard
          label="Ítems pendientes"
          value={resumen.itemsPendientes}
        />

        <ResumenCard
          label="Nombres distintos"
          value={resumen.nombresPendientes}
        />

        <ResumenCard
          label="Cantidad acumulada"
          value={formatNumber(resumen.cantidadTotal)}
        />

        <ResumenCard
          label="Gasto pendiente"
          value={formatMoney(resumen.gastoFinalPendiente)}
        />
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-bold text-lp-navy">
            Buscar nombres históricos
          </h2>

          <p className="text-xs text-lp-navy/60">
            Puedes seleccionar diferentes formas de escribir un mismo
            producto.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar nombre o proveedor..."
            autoComplete="off"
            className="w-full rounded-xl border bg-white p-3 text-lp-navy"
          />

          <select
            value={orden}
            onChange={(event) =>
              setOrden(event.target.value as Orden)
            }
            className="w-full rounded-xl border bg-white p-3 text-lp-navy"
          >
            <option value="MAYOR_GASTO">
              Mayor gasto primero
            </option>

            <option value="MAYOR_CANTIDAD">
              Mayor cantidad primero
            </option>

            <option value="MAS_REGISTROS">
              Más registros primero
            </option>

            <option value="NOMBRE">Orden alfabético</option>
          </select>

          <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-lp-light px-4 text-sm font-semibold text-lp-navy">
            <input
              type="checkbox"
              checked={soloPrioritarios}
              onChange={(event) =>
                setSoloPrioritarios(event.target.checked)
              }
              className="h-4 w-4"
            />

            Mostrar prioritarios
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-lp-navy">
              {gruposFiltrados.length} nombre
              {gruposFiltrados.length === 1 ? "" : "s"} visible
              {gruposFiltrados.length === 1 ? "" : "s"}
            </p>

            <p className="text-xs text-lp-navy/60">
              {seleccionados.size} seleccionado
              {seleccionados.size === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={alternarTodosVisibles}
              disabled={gruposFiltrados.length === 0}
              className="rounded-xl border border-lp-navy bg-white px-4 py-2 text-sm font-semibold text-lp-navy disabled:opacity-40"
            >
              {todosVisiblesSeleccionados
                ? "Quitar visibles"
                : "Seleccionar visibles"}
            </button>

            <button
              type="button"
              onClick={limpiarSeleccion}
              disabled={seleccionados.size === 0}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-lp-navy disabled:opacity-40"
            >
              Limpiar selección
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-lp-navy/70 shadow-sm">
          Cargando productos pendientes...
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
          <p className="text-lg font-bold text-green-800">
            Todo el histórico está normalizado
          </p>

          <p className="mt-1 text-sm text-green-700">
            No quedan productos pendientes de asociación.
          </p>
        </div>
      ) : gruposFiltrados.length === 0 ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-lp-navy/70 shadow-sm">
          No hay nombres que coincidan con los filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {gruposFiltrados.map((grupo) => {
            const seleccionado = seleccionados.has(
              grupo.nombreHistorico
            );

            const expandido =
              grupoExpandido === grupo.nombreHistorico;

            const prioritario = esPrioritario(
              grupo.nombreHistorico
            );

            return (
              <section
                key={grupo.nombreHistorico}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                  seleccionado
                    ? "border-lp-gold ring-2 ring-lp-gold/20"
                    : ""
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      onChange={() =>
                        alternarSeleccion(grupo.nombreHistorico)
                      }
                      className="mt-1 h-5 w-5 shrink-0"
                      aria-label={`Seleccionar ${grupo.nombreHistorico}`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        alternarSeleccion(grupo.nombreHistorico)
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-bold text-lp-navy">
                          {grupo.nombreHistorico}
                        </h3>

                        {prioritario && (
                          <span className="rounded-full bg-lp-gold/20 px-2 py-1 text-[11px] font-bold text-lp-navy">
                            Prioritario
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-lp-navy/60">
                        {grupo.cantidadItems} registro
                        {grupo.cantidadItems === 1 ? "" : "s"} ·{" "}
                        {formatNumber(grupo.cantidadTotal)} unidades
                      </p>
                    </button>

                    <div className="shrink-0 text-right">
                      <p className="font-bold text-lp-navy">
                        {formatMoney(grupo.gastoFinal)}
                      </p>

                      <p className="text-xs text-lp-navy/50">
                        con taxes
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <DatoCard
                      label="Base"
                      value={formatMoney(grupo.gastoBase)}
                    />

                    <DatoCard
                      label="Taxes"
                      value={formatMoney(grupo.taxAsignado)}
                    />

                    <DatoCard
                      label="Primera compra"
                      value={formatDate(grupo.primeraCompra)}
                    />

                    <DatoCard
                      label="Última compra"
                      value={formatDate(grupo.ultimaCompra)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setGrupoExpandido(
                        expandido ? null : grupo.nombreHistorico
                      )
                    }
                    className="mt-3 w-full rounded-xl border px-4 py-2 text-sm font-semibold text-lp-navy"
                  >
                    {expandido
                      ? "Ocultar detalle"
                      : `Ver detalle (${grupo.movimientos.length})`}
                  </button>
                </div>

                {expandido && (
                  <div className="space-y-4 border-t bg-lp-light/40 p-4">
                    <div>
                      <h4 className="text-sm font-bold text-lp-navy">
                        Proveedores
                      </h4>

                      <div className="mt-2 space-y-2">
                        {grupo.proveedores.map((proveedor) => (
                          <div
                            key={proveedor.id}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"
                          >
                            <div>
                              <p className="text-sm font-bold text-lp-navy">
                                {proveedor.nombre}
                              </p>

                              <p className="text-xs text-lp-navy/60">
                                {proveedor.cantidadCompras} registro
                                {proveedor.cantidadCompras === 1
                                  ? ""
                                  : "s"}{" "}
                                ·{" "}
                                {formatNumber(
                                  proveedor.cantidadTotal
                                )}{" "}
                                unidades
                              </p>
                            </div>

                            <p className="text-sm font-bold text-lp-navy">
                              {formatMoney(proveedor.gastoFinal)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-lp-navy">
                        Movimientos
                      </h4>

                      <div className="mt-2 space-y-2">
                        {grupo.movimientos.map((movimiento) => {
                          const precioUnitario =
                            movimiento.cantidad > 0
                              ? movimiento.precioBase /
                                movimiento.cantidad
                              : 0;

                          return (
                            <div
                              key={movimiento.itemId}
                              className="rounded-xl border bg-white p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-lp-navy">
                                    {movimiento.proveedorNombre}
                                  </p>

                                  <p className="text-xs text-lp-navy/60">
                                    {formatDate(movimiento.fecha)} ·{" "}
                                    {formatNumber(
                                      movimiento.cantidad
                                    )}{" "}
                                    unidades ×{" "}
                                    {formatMoney(precioUnitario)}
                                  </p>
                                </div>

                                <p className="text-sm font-bold text-lp-navy">
                                  {formatMoney(
                                    movimiento.precioFinal
                                  )}
                                </p>
                              </div>

                              <p className="mt-1 text-xs text-lp-navy/50">
                                Base{" "}
                                {formatMoney(
                                  movimiento.precioBase
                                )}{" "}
                                + Tax{" "}
                                {formatMoney(
                                  movimiento.taxAsignado
                                )}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {seleccionados.size > 0 && (
        <section className="sticky bottom-4 z-40 space-y-4 rounded-2xl border border-lp-gold bg-white p-4 shadow-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-lp-navy">
                Asociar selección
              </h2>

              <p className="text-xs text-lp-navy/60">
                {resumenSeleccion.nombres} nombre
                {resumenSeleccion.nombres === 1 ? "" : "s"} ·{" "}
                {resumenSeleccion.items} registro
                {resumenSeleccion.items === 1 ? "" : "s"} ·{" "}
                {formatMoney(resumenSeleccion.gasto)}
              </p>
            </div>

            <button
              type="button"
              onClick={limpiarSeleccion}
              disabled={asociando}
              className="text-sm font-semibold text-lp-navy/60 disabled:opacity-40"
            >
              Cancelar selección
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Producto correcto del catálogo
            </label>

            <ProductoAutocomplete
              value={productoDestino}
              onChange={setProductoDestino}
              placeholder="Buscar o crear producto destino..."
              disabled={asociando}
            />
          </div>

          {productoDestino && (
            <div className="rounded-xl border bg-lp-light p-3">
              <p className="text-xs text-lp-navy/60">
                Resultado de la asociación
              </p>

              <p className="mt-1 font-bold text-lp-navy">
                {seleccionados.size} nombre
                {seleccionados.size === 1 ? "" : "s"} histórico
                {seleccionados.size === 1 ? "" : "s"}
                {" → "}
                {construirEtiquetaProducto(productoDestino)}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={asociarSeleccionados}
            disabled={
              asociando ||
              seleccionados.size === 0 ||
              !productoDestino
            }
            className="w-full rounded-xl bg-lp-gold px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {asociando
              ? "Asociando..."
              : `Asociar ${resumenSeleccion.items} registro${
                  resumenSeleccion.items === 1 ? "" : "s"
                }`}
          </button>
        </section>
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
    <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm">
      <p className="truncate text-xs text-lp-navy/60">
        {label}
      </p>

      <p className="mt-1 truncate text-xl font-bold text-lp-navy">
        {value}
      </p>
    </div>
  );
}

function DatoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-lp-light p-3">
      <p className="truncate text-[11px] text-lp-navy/50">
        {label}
      </p>

      <p className="mt-0.5 truncate text-sm font-bold text-lp-navy">
        {value}
      </p>
    </div>
  );
}