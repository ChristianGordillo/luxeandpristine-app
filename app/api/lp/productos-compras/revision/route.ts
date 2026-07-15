import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function redondearDinero(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function limpiarTexto(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

type AsociarPayload = {
  productoId?: number | string;
  nombresHistoricos?: unknown[];
};

export async function GET() {
  try {
    const itemsPendientes = await prisma.lPCompraItem.findMany({
      where: {
        productoId: null,
      },
      select: {
        id: true,
        nombre: true,
        cantidad: true,
        precioBase: true,
        taxAsignado: true,
        precioFinal: true,
        createdAt: true,

        compra: {
          select: {
            id: true,
            fecha: true,

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
          nombre: "asc",
        },
        {
          compra: {
            fecha: "desc",
          },
        },
      ],
    });

    const gruposMap = new Map<
      string,
      {
        nombreHistorico: string;
        cantidadItems: number;
        cantidadTotal: number;
        gastoBase: number;
        taxAsignado: number;
        gastoFinal: number;
        primeraCompra: Date;
        ultimaCompra: Date;
        proveedoresMap: Map<
          number,
          {
            id: number;
            nombre: string;
            cantidadCompras: number;
            cantidadItems: number;
            cantidadTotal: number;
            gastoFinal: number;
          }
        >;
        movimientos: {
          itemId: number;
          compraId: number;
          fecha: Date;
          proveedorId: number;
          proveedorNombre: string;
          cantidad: number;
          precioBase: number;
          taxAsignado: number;
          precioFinal: number;
        }[];
      }
    >();

    for (const item of itemsPendientes) {
      const nombreHistorico = limpiarTexto(item.nombre);

      if (!nombreHistorico) {
        continue;
      }

      const fechaCompra = item.compra.fecha;
      const proveedor = item.compra.proveedor;

      const grupoExistente = gruposMap.get(nombreHistorico);

      if (!grupoExistente) {
        const proveedoresMap = new Map<
          number,
          {
            id: number;
            nombre: string;
            cantidadCompras: number;
            cantidadItems: number;
            cantidadTotal: number;
            gastoFinal: number;
          }
        >();

        proveedoresMap.set(proveedor.id, {
          id: proveedor.id,
          nombre: proveedor.nombre,
          cantidadCompras: 1,
          cantidadItems: 1,
          cantidadTotal: item.cantidad,
          gastoFinal: item.precioFinal,
        });

        gruposMap.set(nombreHistorico, {
          nombreHistorico,
          cantidadItems: 1,
          cantidadTotal: item.cantidad,
          gastoBase: item.precioBase,
          taxAsignado: item.taxAsignado,
          gastoFinal: item.precioFinal,
          primeraCompra: fechaCompra,
          ultimaCompra: fechaCompra,
          proveedoresMap,
          movimientos: [
            {
              itemId: item.id,
              compraId: item.compra.id,
              fecha: fechaCompra,
              proveedorId: proveedor.id,
              proveedorNombre: proveedor.nombre,
              cantidad: item.cantidad,
              precioBase: item.precioBase,
              taxAsignado: item.taxAsignado,
              precioFinal: item.precioFinal,
            },
          ],
        });

        continue;
      }

      grupoExistente.cantidadItems += 1;
      grupoExistente.cantidadTotal += item.cantidad;
      grupoExistente.gastoBase += item.precioBase;
      grupoExistente.taxAsignado += item.taxAsignado;
      grupoExistente.gastoFinal += item.precioFinal;

      if (fechaCompra < grupoExistente.primeraCompra) {
        grupoExistente.primeraCompra = fechaCompra;
      }

      if (fechaCompra > grupoExistente.ultimaCompra) {
        grupoExistente.ultimaCompra = fechaCompra;
      }

      const proveedorExistente =
        grupoExistente.proveedoresMap.get(proveedor.id);

      if (proveedorExistente) {
        proveedorExistente.cantidadCompras += 1;
        proveedorExistente.cantidadItems += 1;
        proveedorExistente.cantidadTotal += item.cantidad;
        proveedorExistente.gastoFinal += item.precioFinal;
      } else {
        grupoExistente.proveedoresMap.set(proveedor.id, {
          id: proveedor.id,
          nombre: proveedor.nombre,
          cantidadCompras: 1,
          cantidadItems: 1,
          cantidadTotal: item.cantidad,
          gastoFinal: item.precioFinal,
        });
      }

      grupoExistente.movimientos.push({
        itemId: item.id,
        compraId: item.compra.id,
        fecha: fechaCompra,
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
        cantidad: item.cantidad,
        precioBase: item.precioBase,
        taxAsignado: item.taxAsignado,
        precioFinal: item.precioFinal,
      });
    }

    const grupos = Array.from(gruposMap.values())
      .map((grupo) => ({
        nombreHistorico: grupo.nombreHistorico,
        cantidadItems: grupo.cantidadItems,
        cantidadTotal: redondearDinero(grupo.cantidadTotal),
        gastoBase: redondearDinero(grupo.gastoBase),
        taxAsignado: redondearDinero(grupo.taxAsignado),
        gastoFinal: redondearDinero(grupo.gastoFinal),
        primeraCompra: grupo.primeraCompra,
        ultimaCompra: grupo.ultimaCompra,

        proveedores: Array.from(grupo.proveedoresMap.values())
          .map((proveedor) => ({
            ...proveedor,
            cantidadTotal: redondearDinero(
              proveedor.cantidadTotal
            ),
            gastoFinal: redondearDinero(
              proveedor.gastoFinal
            ),
          }))
          .sort((a, b) => b.gastoFinal - a.gastoFinal),

        movimientos: grupo.movimientos.sort(
          (a, b) =>
            b.fecha.getTime() - a.fecha.getTime()
        ),
      }))
      .sort((a, b) => b.gastoFinal - a.gastoFinal);

    const resumen = {
      itemsPendientes: itemsPendientes.length,
      nombresPendientes: grupos.length,
      cantidadTotal: redondearDinero(
        grupos.reduce(
          (acc, grupo) => acc + grupo.cantidadTotal,
          0
        )
      ),
      gastoBasePendiente: redondearDinero(
        grupos.reduce(
          (acc, grupo) => acc + grupo.gastoBase,
          0
        )
      ),
      taxesPendientes: redondearDinero(
        grupos.reduce(
          (acc, grupo) => acc + grupo.taxAsignado,
          0
        )
      ),
      gastoFinalPendiente: redondearDinero(
        grupos.reduce(
          (acc, grupo) => acc + grupo.gastoFinal,
          0
        )
      ),
    };

    return NextResponse.json({
      status: "success",
      resumen,
      grupos,
    });
  } catch (error) {
    console.error(
      "Error cargando revisión de productos:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "No fue posible cargar los productos pendientes de revisión.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as AsociarPayload;

    const productoId = Number(body.productoId);

    const nombresHistoricos = Array.isArray(
      body.nombresHistoricos
    )
      ? [
          ...new Set(
            body.nombresHistoricos
              .map((nombre) => limpiarTexto(nombre))
              .filter(Boolean)
          ),
        ]
      : [];

    if (
      !Number.isInteger(productoId) ||
      productoId <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Selecciona un producto válido del catálogo.",
        },
        {
          status: 400,
        }
      );
    }

    if (nombresHistoricos.length === 0) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Selecciona al menos un nombre histórico.",
        },
        {
          status: 400,
        }
      );
    }

    const producto =
      await prisma.lPProductoCompra.findFirst({
        where: {
          id: productoId,
          activo: true,
        },
        select: {
          id: true,
          nombre: true,
          marca: true,
          presentacion: true,
        },
      });

    if (!producto) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El producto seleccionado no existe o está inactivo.",
        },
        {
          status: 404,
        }
      );
    }

    const itemsPendientes =
      await prisma.lPCompraItem.findMany({
        where: {
          productoId: null,
          nombre: {
            in: nombresHistoricos,
          },
        },
        select: {
          id: true,
          nombre: true,
        },
      });

    if (itemsPendientes.length === 0) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No se encontraron ítems pendientes con esos nombres.",
        },
        {
          status: 404,
        }
      );
    }

    const nombresEncontrados = new Set(
      itemsPendientes.map((item) => item.nombre)
    );

    const nombresNoEncontrados =
      nombresHistoricos.filter(
        (nombre) => !nombresEncontrados.has(nombre)
      );

    const resultado =
      await prisma.lPCompraItem.updateMany({
        where: {
          productoId: null,
          nombre: {
            in: nombresHistoricos,
          },
        },
        data: {
          productoId: producto.id,
        },
      });

    return NextResponse.json({
      status: "success",
      message: `${resultado.count} ítem${
        resultado.count === 1 ? "" : "s"
      } asociado${
        resultado.count === 1 ? "" : "s"
      } correctamente.`,

      producto: {
        id: producto.id,
        nombre: producto.nombre,
        marca: producto.marca,
        presentacion: producto.presentacion,
        etiqueta: [
          producto.nombre,
          producto.marca,
          producto.presentacion,
        ]
          .filter(Boolean)
          .join(" · "),
      },

      resultado: {
        itemsActualizados: resultado.count,
        nombresSolicitados:
          nombresHistoricos.length,
        nombresEncontrados:
          nombresEncontrados.size,
        nombresNoEncontrados,
      },
    });
  } catch (error) {
    console.error(
      "Error asociando productos históricos:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "No fue posible asociar los productos históricos.",
      },
      {
        status: 500,
      }
    );
  }
}