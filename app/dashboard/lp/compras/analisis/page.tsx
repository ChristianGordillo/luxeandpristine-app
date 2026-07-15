"use client";

import { useEffect, useMemo, useState } from "react";
import ComprasNav from "@/app/components/lp/ComprasNav";

type Categoria =
  | "GASOLINA"
  | "REPUESTOS_CARRO"
  | "INSUMOS"
  | "TAXES"
  | "NOMINA"
  | "OTROS";

type PeriodoRapido =
  | "HOY"
  | "SEMANA"
  | "ULTIMOS_7_DIAS"
  | "QUINCENA"
  | "MES"
  | "PERSONALIZADO";

type OrdenProductos =
  | "MAYOR_GASTO"
  | "MAYOR_CANTIDAD"
  | "MENOR_PRECIO"
  | "MAYOR_PRECIO"
  | "NOMBRE";

type ProveedorAnalisis = {
  proveedorId: number;
  proveedorNombre: string;
  cantidadCompras: number;
  cantidadItems: number;
  cantidadTotal: number;
  gastoBase: number;
  taxes: number;
  gastoFinal: number;
  precioUnitarioPromedio: number;
  precioUnitarioMinimo: number;
  precioUnitarioMaximo: number;
  ultimaCompra: string;
};

type MovimientoAnalisis = {
  itemId: number;
  compraId: number;
  fecha: string;
  proveedorId: number;
  proveedorNombre: string;
  categoria: Categoria;
  nombreHistorico: string;
  cantidad: number;
  precioUnitarioBase: number;
  precioUnitarioFinal: number;
  gastoBase: number;
  taxes: number;
  gastoFinal: number;
};

type ProductoAnalisis = {
  productoId: number;
  nombre: string;
  marca: string | null;
  presentacion: string | null;
  etiqueta: string;

  cantidadItems: number;
  cantidadTotal: number;

  gastoBase: number;
  taxes: number;
  gastoFinal: number;

  precioUnitarioPromedio: number;
  precioUnitarioMinimo: number;
  precioUnitarioMaximo: number;

  primeraCompra: string;
  ultimaCompra: string;

  proveedorMasEconomico: ProveedorAnalisis | null;
  proveedores: ProveedorAnalisis[];
  movimientos: MovimientoAnalisis[];
};

type ResumenAnalisis = {
  productos: number;
  items: number;
  cantidadTotal: number;
  gastoBase: number;
  taxes: number;
  gastoFinal: number;

  productoMayorGasto: {
    productoId: number;
    etiqueta: string;
    gastoFinal: number;
  } | null;

  productoMayorCantidad: {
    productoId: number;
    etiqueta: string;
    cantidadTotal: number;
  } | null;
};

type PendientesNormalizacion = {
  items: number;
  cantidadTotal: number;
  gastoFinal: number;
};

type AnalisisResponse = {
  status: "success" | "fail";

  filtros?: {
    desde: string;
    hasta: string;
    categoria: Categoria | null;
    proveedorId: number | null;
    productoId: number | null;
  };

  resumen?: ResumenAnalisis;
  pendientesNormalizacion?: PendientesNormalizacion;
  productos?: ProductoAnalisis[];
  message?: string;
};

const categorias: {
  value: Categoria | "";
  label: string;
}[] = [
  { value: "", label: "Todas las categorías" },
  { value: "INSUMOS", label: "Insumos" },
  { value: "GASOLINA", label: "Gasolina" },
  { value: "REPUESTOS_CARRO", label: "Repuestos carro" },
  { value: "TAXES", label: "Taxes" },
  { value: "NOMINA", label: "Nómina" },
  { value: "OTROS", label: "Otros" },
];

const resumenInicial: ResumenAnalisis = {
  productos: 0,
  items: 0,
  cantidadTotal: 0,
  gastoBase: 0,
  taxes: 0,
  gastoFinal: 0,
  productoMayorGasto: null,
  productoMayorCantidad: null,
};

const pendientesIniciales: PendientesNormalizacion = {
  items: 0,
  cantidadTotal: 0,
  gastoFinal: 0,
};

function fechaInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function getHoy() {
  return fechaInput(new Date());
}

function inicioSemana(date: Date) {
  const fecha = new Date(date);
  const dia = fecha.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;

  fecha.setDate(fecha.getDate() + diferencia);

  return fecha;
}

function finSemana(date: Date) {
  const inicio = inicioSemana(date);
  const fin = new Date(inicio);

  fin.setDate(inicio.getDate() + 6);

  return fin;
}

function obtenerRangoPeriodo(periodo: PeriodoRapido) {
  const hoy = new Date();

  if (periodo === "HOY") {
    const fecha = fechaInput(hoy);

    return {
      desde: fecha,
      hasta: fecha,
    };
  }

  if (periodo === "SEMANA") {
    return {
      desde: fechaInput(inicioSemana(hoy)),
      hasta: fechaInput(finSemana(hoy)),
    };
  }

  if (periodo === "ULTIMOS_7_DIAS") {
    const desde = new Date(hoy);

    desde.setDate(hoy.getDate() - 6);

    return {
      desde: fechaInput(desde),
      hasta: fechaInput(hoy),
    };
  }

  if (periodo === "QUINCENA") {
    const year = hoy.getFullYear();
    const month = hoy.getMonth();
    const day = hoy.getDate();

    if (day <= 15) {
      return {
        desde: fechaInput(new Date(year, month, 1)),
        hasta: fechaInput(new Date(year, month, 15)),
      };
    }

    return {
      desde: fechaInput(new Date(year, month, 16)),
      hasta: fechaInput(new Date(year, month + 1, 0)),
    };
  }

  if (periodo === "MES") {
    return {
      desde: fechaInput(
        new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      ),
      hasta: fechaInput(
        new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      ),
    };
  }

  return {
    desde: getHoy(),
    hasta: getHoy(),
  };
}

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

  return new Intl.DateTimeFormat("es-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(fecha));
}

function categoriaLabel(categoria: Categoria) {
  return (
    categorias.find((item) => item.value === categoria)?.label ||
    categoria
  );
}

function normalizarTexto(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export default function AnalisisComprasPage() {
  const rangoInicial = obtenerRangoPeriodo("MES");

  const [periodo, setPeriodo] =
    useState<PeriodoRapido>("MES");

  const [desde, setDesde] = useState(rangoInicial.desde);
  const [hasta, setHasta] = useState(rangoInicial.hasta);

  const [categoria, setCategoria] = useState<Categoria | "">("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] =
    useState<OrdenProductos>("MAYOR_GASTO");

  const [resumen, setResumen] =
    useState<ResumenAnalisis>(resumenInicial);

  const [pendientes, setPendientes] =
    useState<PendientesNormalizacion>(pendientesIniciales);

  const [productos, setProductos] =
    useState<ProductoAnalisis[]>([]);

  const [productoExpandido, setProductoExpandido] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cambiarPeriodo = (nuevoPeriodo: PeriodoRapido) => {
    setPeriodo(nuevoPeriodo);

    if (nuevoPeriodo === "PERSONALIZADO") {
      return;
    }

    const nuevoRango = obtenerRangoPeriodo(nuevoPeriodo);

    setDesde(nuevoRango.desde);
    setHasta(nuevoRango.hasta);
  };

  const cargarAnalisis = async () => {
    if (!desde || !hasta) {
      return;
    }

    if (desde > hasta) {
      setError(
        "La fecha inicial no puede ser posterior a la fecha final."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        desde,
        hasta,
      });

      if (categoria) {
        params.set("categoria", categoria);
      }

      const response = await fetch(
        `/api/lp/compras/analisis?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = (await response.json()) as AnalisisResponse;

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message ||
            "No fue posible cargar el análisis de compras."
        );
      }

      setResumen(data.resumen || resumenInicial);
      setPendientes(
        data.pendientesNormalizacion || pendientesIniciales
      );
      setProductos(data.productos || []);

      setProductoExpandido((actual) => {
        if (
          actual &&
          !(data.productos || []).some(
            (producto) => producto.productoId === actual
          )
        ) {
          return null;
        }

        return actual;
      });
    } catch (error) {
      console.error("Error cargando análisis:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el análisis."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAnalisis();
  }, [desde, hasta, categoria]);

  const productosFiltrados = useMemo(() => {
    const query = normalizarTexto(busqueda);

    const filtrados = productos.filter((producto) => {
      if (!query) {
        return true;
      }

      const texto = normalizarTexto(
        [
          producto.nombre,
          producto.marca,
          producto.presentacion,
          producto.etiqueta,
          ...producto.proveedores.map(
            (proveedor) => proveedor.proveedorNombre
          ),
        ]
          .filter(Boolean)
          .join(" ")
      );

      return texto.includes(query);
    });

    return [...filtrados].sort((a, b) => {
      if (orden === "MAYOR_CANTIDAD") {
        return b.cantidadTotal - a.cantidadTotal;
      }

      if (orden === "MENOR_PRECIO") {
        return (
          a.precioUnitarioPromedio -
          b.precioUnitarioPromedio
        );
      }

      if (orden === "MAYOR_PRECIO") {
        return (
          b.precioUnitarioPromedio -
          a.precioUnitarioPromedio
        );
      }

      if (orden === "NOMBRE") {
        return a.etiqueta.localeCompare(b.etiqueta, "es", {
          sensitivity: "base",
        });
      }

      return b.gastoFinal - a.gastoFinal;
    });
  }, [productos, busqueda, orden]);

  const gastoVisible = useMemo(
    () =>
      productosFiltrados.reduce(
        (acumulado, producto) =>
          acumulado + producto.gastoFinal,
        0
      ),
    [productosFiltrados]
  );

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-lp-navy">
          Análisis de compras
        </h1>
        <ComprasNav />
        <p className="mt-1 text-sm text-lp-navy/70">
          Revisa cuánto se gasta por producto, dónde se compra y
          cuál proveedor ofrece el mejor precio.
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

      {pendientes.items > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="font-bold text-amber-900">
            Hay información pendiente de normalizar
          </p>

          <p className="mt-1 text-sm text-amber-800">
            {pendientes.items} registro
            {pendientes.items === 1 ? "" : "s"} por{" "}
            {formatMoney(pendientes.gastoFinal)} todavía no están
            incluidos en el análisis por producto.
          </p>

          <a
            href="/dashboard/lp/productos-compras/revision"
            className="mt-3 inline-flex rounded-xl border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-800"
          >
            Revisar pendientes
          </a>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-bold text-lp-navy">
            Periodo de análisis
          </h2>

          <p className="text-xs text-lp-navy/60">
            Usa un periodo rápido o selecciona fechas personalizadas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <PeriodoButton
            label="Hoy"
            active={periodo === "HOY"}
            onClick={() => cambiarPeriodo("HOY")}
          />

          <PeriodoButton
            label="Semana"
            active={periodo === "SEMANA"}
            onClick={() => cambiarPeriodo("SEMANA")}
          />

          <PeriodoButton
            label="Últimos 7 días"
            active={periodo === "ULTIMOS_7_DIAS"}
            onClick={() => cambiarPeriodo("ULTIMOS_7_DIAS")}
          />

          <PeriodoButton
            label="Quincena"
            active={periodo === "QUINCENA"}
            onClick={() => cambiarPeriodo("QUINCENA")}
          />

          <PeriodoButton
            label="Mes"
            active={periodo === "MES"}
            onClick={() => cambiarPeriodo("MES")}
          />

          <PeriodoButton
            label="Personalizado"
            active={periodo === "PERSONALIZADO"}
            onClick={() => cambiarPeriodo("PERSONALIZADO")}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Desde
            </label>

            <input
              type="date"
              value={desde}
              onChange={(event) => {
                setPeriodo("PERSONALIZADO");
                setDesde(event.target.value);
              }}
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
              onChange={(event) => {
                setPeriodo("PERSONALIZADO");
                setHasta(event.target.value);
              }}
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-lp-navy">
              Categoría
            </label>

            <select
              value={categoria}
              onChange={(event) =>
                setCategoria(
                  event.target.value as Categoria | ""
                )
              }
              className="w-full rounded-xl border bg-white p-3 text-lp-navy"
            >
              {categorias.map((item) => (
                <option key={item.value || "TODAS"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumenCard
          label="Gasto total"
          value={formatMoney(resumen.gastoFinal)}
          description={`${formatMoney(resumen.gastoBase)} antes de taxes`}
        />

        <ResumenCard
          label="Productos"
          value={resumen.productos}
          description={`${resumen.items} registros`}
        />

        <ResumenCard
          label="Cantidad comprada"
          value={formatNumber(resumen.cantidadTotal)}
          description="Unidades registradas"
        />

        <ResumenCard
          label="Taxes"
          value={formatMoney(resumen.taxes)}
          description="Asignados a productos"
        />
      </section>

      {(resumen.productoMayorGasto ||
        resumen.productoMayorCantidad) && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {resumen.productoMayorGasto && (
            <DestacadoCard
              label="Mayor gasto"
              title={resumen.productoMayorGasto.etiqueta}
              value={formatMoney(
                resumen.productoMayorGasto.gastoFinal
              )}
            />
          )}

          {resumen.productoMayorCantidad && (
            <DestacadoCard
              label="Mayor cantidad"
              title={resumen.productoMayorCantidad.etiqueta}
              value={`${formatNumber(
                resumen.productoMayorCantidad.cantidadTotal
              )} unidades`}
            />
          )}
        </section>
      )}

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-bold text-lp-navy">
            Productos
          </h2>

          <p className="text-xs text-lp-navy/60">
            {productosFiltrados.length} producto
            {productosFiltrados.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(gastoVisible)} visibles
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="text"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar producto, marca o proveedor..."
            autoComplete="off"
            className="w-full rounded-xl border bg-white p-3 text-lp-navy"
          />

          <select
            value={orden}
            onChange={(event) =>
              setOrden(event.target.value as OrdenProductos)
            }
            className="w-full rounded-xl border bg-white p-3 text-lp-navy"
          >
            <option value="MAYOR_GASTO">
              Mayor gasto primero
            </option>

            <option value="MAYOR_CANTIDAD">
              Mayor cantidad primero
            </option>

            <option value="MENOR_PRECIO">
              Menor precio promedio
            </option>

            <option value="MAYOR_PRECIO">
              Mayor precio promedio
            </option>

            <option value="NOMBRE">
              Orden alfabético
            </option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-lp-navy/70 shadow-sm">
          Cargando análisis...
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <p className="font-bold text-lp-navy">
            No hay productos para este periodo
          </p>

          <p className="mt-1 text-sm text-lp-navy/60">
            Prueba con otro rango de fechas o categoría.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {productosFiltrados.map((producto, index) => {
            const expandido =
              productoExpandido === producto.productoId;

            return (
              <section
                key={producto.productoId}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-lp-light px-2 text-xs font-bold text-lp-navy">
                          {index + 1}
                        </span>

                        <h3 className="break-words text-lg font-bold text-lp-navy">
                          {producto.etiqueta}
                        </h3>
                      </div>

                      <p className="mt-2 text-xs text-lp-navy/60">
                        {producto.cantidadItems} registro
                        {producto.cantidadItems === 1 ? "" : "s"} ·{" "}
                        {formatNumber(producto.cantidadTotal)} unidades
                        · Última compra{" "}
                        {formatDate(producto.ultimaCompra)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-lp-navy">
                        {formatMoney(producto.gastoFinal)}
                      </p>

                      <p className="text-xs text-lp-navy/50">
                        gasto total
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <DatoCard
                      label="Precio promedio"
                      value={formatMoney(
                        producto.precioUnitarioPromedio
                      )}
                    />

                    <DatoCard
                      label="Precio mínimo"
                      value={formatMoney(
                        producto.precioUnitarioMinimo
                      )}
                    />

                    <DatoCard
                      label="Precio máximo"
                      value={formatMoney(
                        producto.precioUnitarioMaximo
                      )}
                    />

                    <DatoCard
                      label="Taxes"
                      value={formatMoney(producto.taxes)}
                    />
                  </div>

                  {producto.proveedorMasEconomico && (
                    <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
                      <p className="text-xs font-semibold text-green-700">
                        Proveedor con menor precio promedio
                      </p>

                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="font-bold text-green-900">
                          {
                            producto.proveedorMasEconomico
                              .proveedorNombre
                          }
                        </p>

                        <p className="font-bold text-green-900">
                          {formatMoney(
                            producto.proveedorMasEconomico
                              .precioUnitarioPromedio
                          )}{" "}
                          / unidad
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setProductoExpandido(
                        expandido ? null : producto.productoId
                      )
                    }
                    className="mt-3 w-full rounded-xl border border-lp-navy px-4 py-2 text-sm font-semibold text-lp-navy"
                  >
                    {expandido
                      ? "Ocultar detalle"
                      : "Comparar proveedores y movimientos"}
                  </button>
                </div>

                {expandido && (
                  <div className="space-y-5 border-t bg-lp-light/30 p-4">
                    <div>
                      <h4 className="font-bold text-lp-navy">
                        Comparación por proveedor
                      </h4>

                      <p className="text-xs text-lp-navy/60">
                        Ordenados desde el menor precio promedio.
                      </p>

                      <div className="mt-3 space-y-2">
                        {producto.proveedores.map(
                          (proveedor, proveedorIndex) => (
                            <div
                              key={proveedor.proveedorId}
                              className="rounded-xl border bg-white p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold text-lp-navy">
                                      {proveedor.proveedorNombre}
                                    </p>

                                    {proveedorIndex === 0 && (
                                      <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">
                                        Mejor precio
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-1 text-xs text-lp-navy/60">
                                    {proveedor.cantidadCompras} compra
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

                                <div className="text-right">
                                  <p className="font-bold text-lp-navy">
                                    {formatMoney(
                                      proveedor
                                        .precioUnitarioPromedio
                                    )}
                                  </p>

                                  <p className="text-xs text-lp-navy/50">
                                    promedio / unidad
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <DatoCard
                                  label="Gasto"
                                  value={formatMoney(
                                    proveedor.gastoFinal
                                  )}
                                />

                                <DatoCard
                                  label="Mínimo"
                                  value={formatMoney(
                                    proveedor
                                      .precioUnitarioMinimo
                                  )}
                                />

                                <DatoCard
                                  label="Máximo"
                                  value={formatMoney(
                                    proveedor
                                      .precioUnitarioMaximo
                                  )}
                                />

                                <DatoCard
                                  label="Última compra"
                                  value={formatDate(
                                    proveedor.ultimaCompra
                                  )}
                                />
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-lp-navy">
                        Historial de compras
                      </h4>

                      <div className="mt-3 space-y-2">
                        {producto.movimientos.map((movimiento) => (
                          <div
                            key={movimiento.itemId}
                            className="rounded-xl border bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-lp-navy">
                                  {movimiento.proveedorNombre}
                                </p>

                                <p className="mt-1 text-xs text-lp-navy/60">
                                  {formatDate(movimiento.fecha)} ·{" "}
                                  {categoriaLabel(
                                    movimiento.categoria
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-lp-navy/60">
                                  {formatNumber(
                                    movimiento.cantidad
                                  )}{" "}
                                  unidades ×{" "}
                                  {formatMoney(
                                    movimiento.precioUnitarioBase
                                  )}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="font-bold text-lp-navy">
                                  {formatMoney(
                                    movimiento.gastoFinal
                                  )}
                                </p>

                                <p className="text-xs text-lp-navy/50">
                                  con taxes
                                </p>
                              </div>
                            </div>

                            {movimiento.nombreHistorico !==
                              producto.etiqueta && (
                              <p className="mt-2 text-xs text-lp-navy/40">
                                Registrado como:{" "}
                                {movimiento.nombreHistorico}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodoButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-lp-navy bg-lp-navy text-white"
          : "border-lp-navy/20 bg-white text-lp-navy hover:bg-lp-light"
      }`}
    >
      {label}
    </button>
  );
}

function ResumenCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm">
      <p className="truncate text-xs text-lp-navy/60">
        {label}
      </p>

      <p className="mt-1 truncate text-xl font-bold text-lp-navy">
        {value}
      </p>

      <p className="mt-1 truncate text-xs text-lp-navy/50">
        {description}
      </p>
    </div>
  );
}

function DestacadoCard({
  label,
  title,
  value,
}: {
  label: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-lp-light p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-lp-navy/50">
        {label}
      </p>

      <p className="mt-1 font-bold text-lp-navy">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold text-lp-navy">
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