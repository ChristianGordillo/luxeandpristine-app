import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPGastoCategoria } from "@prisma/client";

type CompraItemInput = {
  productoId?: number | string | null;
  nombre?: string;
  cantidad?: number | string;
  precioBase?: number | string;
};

type CompraItemLimpio = {
  productoId: number;
  nombre: string;
  cantidad: number;
  precioBase: number;
};

function crearFechaLocal(fechaString: string) {
  return new Date(`${fechaString}T12:00:00.000Z`);
}

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function redondearDinero(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function construirEtiquetaProducto(producto: {
  nombre: string;
  marca: string | null;
  presentacion: string | null;
}) {
  return [producto.nombre, producto.marca, producto.presentacion]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ");
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

function limpiarItemsIniciales(items: CompraItemInput[]) {
  return items
    .map((item) => {
      const productoId = Number(item.productoId);
      const cantidad = Number(item.cantidad || 1);
      const precioBase = Number(item.precioBase || 0);

      return {
        productoId,
        nombre: String(item.nombre || "").trim(),
        cantidad,
        precioBase: redondearDinero(precioBase),
      };
    })
    .filter(
      (item) =>
        Number.isInteger(item.productoId) &&
        item.productoId > 0 &&
        Number.isFinite(item.cantidad) &&
        item.cantidad > 0 &&
        Number.isFinite(item.precioBase) &&
        item.precioBase > 0
    );
}

async function prepararItemsConProductos(
  items: CompraItemInput[]
): Promise<CompraItemLimpio[]> {
  const itemsIniciales = limpiarItemsIniciales(items);

  if (itemsIniciales.length === 0) {
    return [];
  }

  const productoIds = [
    ...new Set(itemsIniciales.map((item) => item.productoId)),
  ];

  const productos = await prisma.lPProductoCompra.findMany({
    where: {
      id: {
        in: productoIds,
      },
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      marca: true,
      presentacion: true,
    },
  });

  const productosPorId = new Map(
    productos.map((producto) => [producto.id, producto])
  );

  const productoFaltante = productoIds.find(
    (productoId) => !productosPorId.has(productoId)
  );

  if (productoFaltante) {
    throw new Error(
      `El producto ${productoFaltante} no existe o está inactivo.`
    );
  }

  return itemsIniciales.map((item) => {
    const producto = productosPorId.get(item.productoId);

    if (!producto) {
      throw new Error(
        `No fue posible encontrar el producto ${item.productoId}.`
      );
    }

    return {
      productoId: producto.id,

      /*
       * Conservamos una copia histórica de la etiqueta.
       * Si el catálogo cambia después, la compra mantiene
       * el nombre usado cuando fue registrada.
       */
      nombre: construirEtiquetaProducto(producto),

      cantidad: item.cantidad,
      precioBase: item.precioBase,
    };
  });
}

function calcularItemsConTaxes(
  items: CompraItemLimpio[],
  subtotal: number,
  taxes: number
) {
  let taxesAcumulados = 0;

  return items.map((item, index) => {
    const esUltimoItem = index === items.length - 1;

    const proporcion =
      subtotal > 0 ? item.precioBase / subtotal : 0;

    /*
     * En el último producto asignamos la diferencia restante.
     * Así evitamos que los redondeos de centavos hagan que la
     * suma de taxes asignados sea distinta al tax total.
     */
    const taxAsignado = esUltimoItem
      ? redondearDinero(taxes - taxesAcumulados)
      : redondearDinero(taxes * proporcion);

    taxesAcumulados = redondearDinero(
      taxesAcumulados + taxAsignado
    );

    const precioFinal = redondearDinero(
      item.precioBase + taxAsignado
    );

    return {
      productoId: item.productoId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioBase: item.precioBase,
      taxAsignado,
      precioFinal,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde =
      searchParams.get("desde") || getTodayInputValue();

    const hasta =
      searchParams.get("hasta") || getTodayInputValue();

    const categoria = searchParams.get("categoria");
    const proveedorIdParam = searchParams.get("proveedorId");
    const productoIdParam = searchParams.get("productoId");

    const fechaDesde = crearFechaLocal(desde);
    fechaDesde.setUTCHours(0, 0, 0, 0);

    const fechaHasta = crearFechaLocal(hasta);
    fechaHasta.setUTCHours(23, 59, 59, 999);

    const proveedorId = proveedorIdParam
      ? Number(proveedorIdParam)
      : null;

    const productoId = productoIdParam
      ? Number(productoIdParam)
      : null;

    const where: {
      fecha: {
        gte: Date;
        lte: Date;
      };
      categoria?: LPGastoCategoria;
      proveedorId?: number;
      items?: {
        some: {
          productoId: number;
        };
      };
    } = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    };

    if (esCategoriaValida(categoria)) {
      where.categoria = categoria;
    }

    if (
      proveedorId !== null &&
      Number.isInteger(proveedorId) &&
      proveedorId > 0
    ) {
      where.proveedorId = proveedorId;
    }

    if (
      productoId !== null &&
      Number.isInteger(productoId) &&
      productoId > 0
    ) {
      where.items = {
        some: {
          productoId,
        },
      };
    }

    const compras = await prisma.lPCompra.findMany({
      where,
      include: {
        proveedor: true,

        items: {
          include: {
            producto: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: [
        {
          fecha: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const resumen = {
      cantidad: compras.length,

      subtotal: redondearDinero(
        compras.reduce(
          (acc, compra) => acc + compra.subtotal,
          0
        )
      ),

      taxes: redondearDinero(
        compras.reduce(
          (acc, compra) => acc + compra.taxes,
          0
        )
      ),

      total: redondearDinero(
        compras.reduce(
          (acc, compra) => acc + compra.total,
          0
        )
      ),
    };

    return NextResponse.json({
      status: "success",
      compras,
      resumen,
    });
  } catch (error) {
    console.error("Error al listar compras:", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al listar compras.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      fecha,
      proveedorId,
      categoria,
      taxes,
      items,
    } = body;

    const proveedorIdNumber = Number(proveedorId);
    const taxesNumber = Number(taxes || 0);

    if (
      !fecha ||
      !Number.isInteger(proveedorIdNumber) ||
      proveedorIdNumber <= 0 ||
      !categoria ||
      !Array.isArray(items)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Completa fecha, proveedor, categoría y productos.",
        },
        {
          status: 400,
        }
      );
    }

    if (!esCategoriaValida(categoria)) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Categoría inválida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(taxesNumber) ||
      taxesNumber < 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El valor de taxes no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const proveedor =
      await prisma.lPProveedorCompra.findFirst({
        where: {
          id: proveedorIdNumber,
          activo: true,
        },
        select: {
          id: true,
        },
      });

    if (!proveedor) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El proveedor no existe o está inactivo.",
        },
        {
          status: 400,
        }
      );
    }

    let itemsLimpios: CompraItemLimpio[];

    try {
      itemsLimpios =
        await prepararItemsConProductos(items);
    } catch (error) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            error instanceof Error
              ? error.message
              : "Uno de los productos no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (itemsLimpios.length === 0) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes agregar al menos un producto válido.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Evita que una línea incompleta sea ignorada silenciosamente.
     * Todas las líneas recibidas deben ser válidas.
     */
    if (itemsLimpios.length !== items.length) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Revisa los productos. Cada línea debe tener producto, cantidad y valor.",
        },
        {
          status: 400,
        }
      );
    }

    const subtotal = redondearDinero(
      itemsLimpios.reduce(
        (acc, item) => acc + item.precioBase,
        0
      )
    );

    const taxesRedondeados =
      redondearDinero(taxesNumber);

    const total = redondearDinero(
      subtotal + taxesRedondeados
    );

    const itemsCalculados = calcularItemsConTaxes(
      itemsLimpios,
      subtotal,
      taxesRedondeados
    );

    const compra = await prisma.lPCompra.create({
      data: {
        fecha: crearFechaLocal(fecha),
        proveedorId: proveedorIdNumber,
        categoria,
        subtotal,
        taxes: taxesRedondeados,
        total,

        items: {
          create: itemsCalculados,
        },
      },

      include: {
        proveedor: true,

        items: {
          include: {
            producto: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(
      {
        status: "success",
        compra,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Error al crear compra:", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al crear compra.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      fecha,
      proveedorId,
      categoria,
      taxes,
      items,
    } = body;

    const idNumber = Number(id);
    const proveedorIdNumber = Number(proveedorId);
    const taxesNumber = Number(taxes || 0);

    if (
      !Number.isInteger(idNumber) ||
      idNumber <= 0 ||
      !fecha ||
      !Number.isInteger(proveedorIdNumber) ||
      proveedorIdNumber <= 0 ||
      !categoria ||
      !Array.isArray(items)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Completa todos los datos obligatorios.",
        },
        {
          status: 400,
        }
      );
    }

    if (!esCategoriaValida(categoria)) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Categoría inválida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(taxesNumber) ||
      taxesNumber < 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El valor de taxes no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const [compraActual, proveedor] =
      await Promise.all([
        prisma.lPCompra.findUnique({
          where: {
            id: idNumber,
          },
          select: {
            id: true,
          },
        }),

        prisma.lPProveedorCompra.findFirst({
          where: {
            id: proveedorIdNumber,
            activo: true,
          },
          select: {
            id: true,
          },
        }),
      ]);

    if (!compraActual) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Compra no encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    if (!proveedor) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El proveedor no existe o está inactivo.",
        },
        {
          status: 400,
        }
      );
    }

    let itemsLimpios: CompraItemLimpio[];

    try {
      itemsLimpios =
        await prepararItemsConProductos(items);
    } catch (error) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            error instanceof Error
              ? error.message
              : "Uno de los productos no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      itemsLimpios.length === 0 ||
      itemsLimpios.length !== items.length
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Revisa los productos. Cada línea debe tener producto, cantidad y valor.",
        },
        {
          status: 400,
        }
      );
    }

    const subtotal = redondearDinero(
      itemsLimpios.reduce(
        (acc, item) => acc + item.precioBase,
        0
      )
    );

    const taxesRedondeados =
      redondearDinero(taxesNumber);

    const total = redondearDinero(
      subtotal + taxesRedondeados
    );

    const itemsCalculados = calcularItemsConTaxes(
      itemsLimpios,
      subtotal,
      taxesRedondeados
    );

    const compra = await prisma.$transaction(
      async (tx) => {
        await tx.lPCompraItem.deleteMany({
          where: {
            compraId: idNumber,
          },
        });

        return tx.lPCompra.update({
          where: {
            id: idNumber,
          },

          data: {
            fecha: crearFechaLocal(fecha),
            proveedorId: proveedorIdNumber,
            categoria,
            subtotal,
            taxes: taxesRedondeados,
            total,

            items: {
              create: itemsCalculados,
            },
          },

          include: {
            proveedor: true,

            items: {
              include: {
                producto: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      }
    );

    return NextResponse.json({
      status: "success",
      compra,
    });
  } catch (error) {
    console.error(
      "Error al actualizar compra:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al actualizar compra.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          status: "fail",
          message: "ID requerido.",
        },
        {
          status: 400,
        }
      );
    }

    const compra = await prisma.lPCompra.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!compra) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Compra no encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.lPCompra.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Compra eliminada correctamente.",
    });
  } catch (error) {
    console.error("Error al eliminar compra:", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al eliminar compra.",
      },
      {
        status: 500,
      }
    );
  }
}