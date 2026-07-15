import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPGastoCategoria } from "@prisma/client";

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function crearFechaInicio(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function crearFechaFin(fecha: string) {
  return new Date(`${fecha}T23:59:59.999Z`);
}

function redondearDinero(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function esCategoriaValida(
  categoria: unknown
): categoria is LPGastoCategoria {
  return (
    typeof categoria === "string" &&
    Object.values(LPGastoCategoria).includes(
      categoria as LPGastoCategoria
    )
  );
}

function construirEtiquetaProducto(producto: {
  nombre: string;
  marca: string | null;
  presentacion: string | null;
}) {
  return [
    producto.nombre,
    producto.marca,
    producto.presentacion,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ");
}

type MovimientoAnalisis = {
  itemId: number;
  compraId: number;
  fecha: Date;
  proveedorId: number;
  proveedorNombre: string;
  categoria: LPGastoCategoria;
  nombreHistorico: string;
  cantidad: number;
  precioUnitarioBase: number;
  precioUnitarioFinal: number;
  gastoBase: number;
  taxes: number;
  gastoFinal: number;
};

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
  ultimaCompra: Date;
};

type ProductoAnalisisInterno = {
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

  sumaPrecioUnitarioPonderado: number;
  precioUnitarioMinimo: number;
  precioUnitarioMaximo: number;

  primeraCompra: Date;
  ultimaCompra: Date;

  proveedores: Map<number, ProveedorAnalisis>;
  movimientos: MovimientoAnalisis[];
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const today = getTodayInputValue();

    const desde = searchParams.get("desde") || today;
    const hasta = searchParams.get("hasta") || today;

    const categoriaParam = searchParams.get("categoria");
    const proveedorIdParam = searchParams.get("proveedorId");
    const productoIdParam = searchParams.get("productoId");

    const proveedorId = proveedorIdParam
      ? Number(proveedorIdParam)
      : null;

    const productoId = productoIdParam
      ? Number(productoIdParam)
      : null;

    const fechaDesde = crearFechaInicio(desde);
    const fechaHasta = crearFechaFin(hasta);

    if (
      Number.isNaN(fechaDesde.getTime()) ||
      Number.isNaN(fechaHasta.getTime())
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El rango de fechas no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (fechaDesde > fechaHasta) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha inicial no puede ser posterior a la fecha final.",
        },
        {
          status: 400,
        }
      );
    }

    const where: {
      compra: {
        fecha: {
          gte: Date;
          lte: Date;
        };
        categoria?: LPGastoCategoria;
        proveedorId?: number;
      };
      productoId?: number;
    } = {
      compra: {
        fecha: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
      },
    };

    if (esCategoriaValida(categoriaParam)) {
      where.compra.categoria = categoriaParam;
    }

    if (
      proveedorId !== null &&
      Number.isInteger(proveedorId) &&
      proveedorId > 0
    ) {
      where.compra.proveedorId = proveedorId;
    }

    if (
      productoId !== null &&
      Number.isInteger(productoId) &&
      productoId > 0
    ) {
      where.productoId = productoId;
    }

    const items = await prisma.lPCompraItem.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        cantidad: true,
        precioBase: true,
        taxAsignado: true,
        precioFinal: true,
        productoId: true,

        producto: {
          select: {
            id: true,
            nombre: true,
            marca: true,
            presentacion: true,
            activo: true,
          },
        },

        compra: {
          select: {
            id: true,
            fecha: true,
            categoria: true,

            proveedor: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },

      orderBy: [
        {
          compra: {
            fecha: "desc",
          },
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const productosMap = new Map<
      number,
      ProductoAnalisisInterno
    >();

    let itemsSinNormalizar = 0;
    let gastoSinNormalizar = 0;
    let cantidadSinNormalizar = 0;

    for (const item of items) {
      if (!item.productoId || !item.producto) {
        itemsSinNormalizar += 1;
        gastoSinNormalizar += item.precioFinal;
        cantidadSinNormalizar += item.cantidad;

        continue;
      }

      const cantidad =
        Number.isFinite(item.cantidad) && item.cantidad > 0
          ? item.cantidad
          : 0;

      const precioUnitarioBase =
        cantidad > 0
          ? redondearDinero(item.precioBase / cantidad)
          : 0;

      const precioUnitarioFinal =
        cantidad > 0
          ? redondearDinero(item.precioFinal / cantidad)
          : 0;

      const proveedor = item.compra.proveedor;
      const producto = item.producto;

      const movimiento: MovimientoAnalisis = {
        itemId: item.id,
        compraId: item.compra.id,
        fecha: item.compra.fecha,
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
        categoria: item.compra.categoria,
        nombreHistorico: item.nombre,
        cantidad,
        precioUnitarioBase,
        precioUnitarioFinal,
        gastoBase: redondearDinero(item.precioBase),
        taxes: redondearDinero(item.taxAsignado),
        gastoFinal: redondearDinero(item.precioFinal),
      };

      let grupo = productosMap.get(producto.id);

      if (!grupo) {
        grupo = {
          productoId: producto.id,
          nombre: producto.nombre,
          marca: producto.marca,
          presentacion: producto.presentacion,
          etiqueta: construirEtiquetaProducto(producto),

          cantidadItems: 0,
          cantidadTotal: 0,
          gastoBase: 0,
          taxes: 0,
          gastoFinal: 0,

          sumaPrecioUnitarioPonderado: 0,
          precioUnitarioMinimo: precioUnitarioBase,
          precioUnitarioMaximo: precioUnitarioBase,

          primeraCompra: item.compra.fecha,
          ultimaCompra: item.compra.fecha,

          proveedores: new Map(),
          movimientos: [],
        };

        productosMap.set(producto.id, grupo);
      }

      grupo.cantidadItems += 1;
      grupo.cantidadTotal += cantidad;
      grupo.gastoBase += item.precioBase;
      grupo.taxes += item.taxAsignado;
      grupo.gastoFinal += item.precioFinal;

      grupo.sumaPrecioUnitarioPonderado +=
        precioUnitarioBase * cantidad;

      if (
        grupo.cantidadItems === 1 ||
        precioUnitarioBase < grupo.precioUnitarioMinimo
      ) {
        grupo.precioUnitarioMinimo = precioUnitarioBase;
      }

      if (
        grupo.cantidadItems === 1 ||
        precioUnitarioBase > grupo.precioUnitarioMaximo
      ) {
        grupo.precioUnitarioMaximo = precioUnitarioBase;
      }

      if (item.compra.fecha < grupo.primeraCompra) {
        grupo.primeraCompra = item.compra.fecha;
      }

      if (item.compra.fecha > grupo.ultimaCompra) {
        grupo.ultimaCompra = item.compra.fecha;
      }

      grupo.movimientos.push(movimiento);

      let proveedorGrupo = grupo.proveedores.get(proveedor.id);

      if (!proveedorGrupo) {
        proveedorGrupo = {
          proveedorId: proveedor.id,
          proveedorNombre: proveedor.nombre,
          cantidadCompras: 0,
          cantidadItems: 0,
          cantidadTotal: 0,
          gastoBase: 0,
          taxes: 0,
          gastoFinal: 0,
          precioUnitarioPromedio: 0,
          precioUnitarioMinimo: precioUnitarioBase,
          precioUnitarioMaximo: precioUnitarioBase,
          ultimaCompra: item.compra.fecha,
        };

        grupo.proveedores.set(proveedor.id, proveedorGrupo);
      }

      proveedorGrupo.cantidadCompras += 1;
      proveedorGrupo.cantidadItems += 1;
      proveedorGrupo.cantidadTotal += cantidad;
      proveedorGrupo.gastoBase += item.precioBase;
      proveedorGrupo.taxes += item.taxAsignado;
      proveedorGrupo.gastoFinal += item.precioFinal;

      if (
        proveedorGrupo.cantidadItems === 1 ||
        precioUnitarioBase <
          proveedorGrupo.precioUnitarioMinimo
      ) {
        proveedorGrupo.precioUnitarioMinimo =
          precioUnitarioBase;
      }

      if (
        proveedorGrupo.cantidadItems === 1 ||
        precioUnitarioBase >
          proveedorGrupo.precioUnitarioMaximo
      ) {
        proveedorGrupo.precioUnitarioMaximo =
          precioUnitarioBase;
      }

      if (
        item.compra.fecha > proveedorGrupo.ultimaCompra
      ) {
        proveedorGrupo.ultimaCompra =
          item.compra.fecha;
      }
    }

    const productos = Array.from(productosMap.values())
      .map((grupo) => {
        const precioUnitarioPromedio =
          grupo.cantidadTotal > 0
            ? redondearDinero(
                grupo.sumaPrecioUnitarioPonderado /
                  grupo.cantidadTotal
              )
            : 0;

        const proveedores = Array.from(
          grupo.proveedores.values()
        )
          .map((proveedor) => ({
            ...proveedor,

            cantidadTotal: redondearDinero(
              proveedor.cantidadTotal
            ),

            gastoBase: redondearDinero(
              proveedor.gastoBase
            ),

            taxes: redondearDinero(proveedor.taxes),

            gastoFinal: redondearDinero(
              proveedor.gastoFinal
            ),

            precioUnitarioPromedio:
              proveedor.cantidadTotal > 0
                ? redondearDinero(
                    proveedor.gastoBase /
                      proveedor.cantidadTotal
                  )
                : 0,

            precioUnitarioMinimo: redondearDinero(
              proveedor.precioUnitarioMinimo
            ),

            precioUnitarioMaximo: redondearDinero(
              proveedor.precioUnitarioMaximo
            ),
          }))
          .sort(
            (a, b) =>
              a.precioUnitarioPromedio -
              b.precioUnitarioPromedio
          );

        const proveedorMasEconomico =
          proveedores.length > 0
            ? proveedores[0]
            : null;

        return {
          productoId: grupo.productoId,
          nombre: grupo.nombre,
          marca: grupo.marca,
          presentacion: grupo.presentacion,
          etiqueta: grupo.etiqueta,

          cantidadItems: grupo.cantidadItems,
          cantidadTotal: redondearDinero(
            grupo.cantidadTotal
          ),

          gastoBase: redondearDinero(grupo.gastoBase),
          taxes: redondearDinero(grupo.taxes),
          gastoFinal: redondearDinero(grupo.gastoFinal),

          precioUnitarioPromedio,
          precioUnitarioMinimo: redondearDinero(
            grupo.precioUnitarioMinimo
          ),
          precioUnitarioMaximo: redondearDinero(
            grupo.precioUnitarioMaximo
          ),

          primeraCompra: grupo.primeraCompra,
          ultimaCompra: grupo.ultimaCompra,

          proveedorMasEconomico,

          proveedores,

          movimientos: grupo.movimientos.sort(
            (a, b) =>
              b.fecha.getTime() - a.fecha.getTime()
          ),
        };
      })
      .sort((a, b) => b.gastoFinal - a.gastoFinal);

    const gastoBaseTotal = redondearDinero(
      productos.reduce(
        (acc, producto) => acc + producto.gastoBase,
        0
      )
    );

    const taxesTotal = redondearDinero(
      productos.reduce(
        (acc, producto) => acc + producto.taxes,
        0
      )
    );

    const gastoFinalTotal = redondearDinero(
      productos.reduce(
        (acc, producto) => acc + producto.gastoFinal,
        0
      )
    );

    const cantidadTotal = redondearDinero(
      productos.reduce(
        (acc, producto) => acc + producto.cantidadTotal,
        0
      )
    );

    const productoMayorGasto =
      productos.length > 0 ? productos[0] : null;

    const productoMayorCantidad =
      productos.length > 0
        ? [...productos].sort(
            (a, b) =>
              b.cantidadTotal - a.cantidadTotal
          )[0]
        : null;

    return NextResponse.json({
      status: "success",

      filtros: {
        desde,
        hasta,
        categoria:
          esCategoriaValida(categoriaParam)
            ? categoriaParam
            : null,
        proveedorId:
          proveedorId &&
          Number.isInteger(proveedorId) &&
          proveedorId > 0
            ? proveedorId
            : null,
        productoId:
          productoId &&
          Number.isInteger(productoId) &&
          productoId > 0
            ? productoId
            : null,
      },

      resumen: {
        productos: productos.length,
        items: productos.reduce(
          (acc, producto) =>
            acc + producto.cantidadItems,
          0
        ),
        cantidadTotal,
        gastoBase: gastoBaseTotal,
        taxes: taxesTotal,
        gastoFinal: gastoFinalTotal,

        productoMayorGasto: productoMayorGasto
          ? {
              productoId:
                productoMayorGasto.productoId,
              etiqueta: productoMayorGasto.etiqueta,
              gastoFinal:
                productoMayorGasto.gastoFinal,
            }
          : null,

        productoMayorCantidad: productoMayorCantidad
          ? {
              productoId:
                productoMayorCantidad.productoId,
              etiqueta:
                productoMayorCantidad.etiqueta,
              cantidadTotal:
                productoMayorCantidad.cantidadTotal,
            }
          : null,
      },

      pendientesNormalizacion: {
        items: itemsSinNormalizar,
        cantidadTotal: redondearDinero(
          cantidadSinNormalizar
        ),
        gastoFinal: redondearDinero(
          gastoSinNormalizar
        ),
      },

      productos,
    });
  } catch (error) {
    console.error(
      "Error cargando análisis de compras:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "No fue posible cargar el análisis de compras.",
      },
      {
        status: 500,
      }
    );
  }
}