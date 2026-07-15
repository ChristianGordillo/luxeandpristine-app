import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type ProductoPayload = {
  id?: number;
  nombre?: string;
  marca?: string | null;
  presentacion?: string | null;
  activo?: boolean;
};

function limpiarTexto(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

function limpiarTextoOpcional(value: unknown) {
  const texto = limpiarTexto(value);

  return texto || null;
}

function normalizarTexto(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function construirNombreNormalizado({
  nombre,
  marca,
  presentacion,
}: {
  nombre: string;
  marca?: string | null;
  presentacion?: string | null;
}) {
  return [nombre, marca, presentacion]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizarTexto)
    .filter(Boolean)
    .join("|");
}

function productoParaRespuesta(producto: {
  id: number;
  nombre: string;
  nombreNormalizado: string;
  marca: string | null;
  presentacion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: producto.id,
    nombre: producto.nombre,
    nombreNormalizado: producto.nombreNormalizado,
    marca: producto.marca,
    presentacion: producto.presentacion,
    activo: producto.activo,
    etiqueta: [
      producto.nombre,
      producto.marca,
      producto.presentacion,
    ]
      .filter(Boolean)
      .join(" · "),
    createdAt: producto.createdAt,
    updatedAt: producto.updatedAt,
  };
}

/**
 * GET /api/lp/productos-compras
 *
 * Ejemplos:
 * /api/lp/productos-compras
 * /api/lp/productos-compras?q=clorox
 * /api/lp/productos-compras?incluirInactivos=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query = limpiarTexto(searchParams.get("q"));
    const incluirInactivos =
      searchParams.get("incluirInactivos") === "true";

    const productos = await prisma.lPProductoCompra.findMany({
      where: {
        ...(incluirInactivos ? {} : { activo: true }),

        ...(query
          ? {
              OR: [
                {
                  nombre: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  marca: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  presentacion: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
                {
                  nombreNormalizado: {
                    contains: normalizarTexto(query),
                  },
                },
              ],
            }
          : {}),
      },

      orderBy: [
        {
          activo: "desc",
        },
        {
          nombre: "asc",
        },
        {
          marca: "asc",
        },
        {
          presentacion: "asc",
        },
      ],
    });

    return NextResponse.json({
      productos: productos.map(productoParaRespuesta),
    });
  } catch (error) {
    console.error("Error obteniendo productos de compras:", error);

    return NextResponse.json(
      {
        message: "No fue posible cargar el catálogo de compras.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * POST /api/lp/productos-compras
 *
 * Body:
 * {
 *   "nombre": "Bleach",
 *   "marca": "Clorox",
 *   "presentacion": "1 gal"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProductoPayload;

    const nombre = limpiarTexto(body.nombre);
    const marca = limpiarTextoOpcional(body.marca);
    const presentacion = limpiarTextoOpcional(body.presentacion);

    if (!nombre) {
      return NextResponse.json(
        {
          message: "El nombre del producto o concepto es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    const nombreNormalizado = construirNombreNormalizado({
      nombre,
      marca,
      presentacion,
    });

    const productoExistente =
      await prisma.lPProductoCompra.findUnique({
        where: {
          nombreNormalizado,
        },
      });

    if (productoExistente) {
      if (!productoExistente.activo) {
        const productoReactivado =
          await prisma.lPProductoCompra.update({
            where: {
              id: productoExistente.id,
            },
            data: {
              activo: true,
            },
          });

        return NextResponse.json(
          {
            producto: productoParaRespuesta(productoReactivado),
            message:
              "El producto ya existía y fue activado nuevamente.",
            reactivado: true,
          },
          {
            status: 200,
          }
        );
      }

      return NextResponse.json(
        {
          producto: productoParaRespuesta(productoExistente),
          message:
            "Este producto o concepto ya existe en el catálogo.",
          existente: true,
        },
        {
          status: 200,
        }
      );
    }

    const producto = await prisma.lPProductoCompra.create({
      data: {
        nombre,
        nombreNormalizado,
        marca,
        presentacion,
        activo: true,
      },
    });

    return NextResponse.json(
      {
        producto: productoParaRespuesta(producto),
        message: "Producto creado correctamente.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Error creando producto de compra:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "Ya existe un producto con el mismo nombre, marca y presentación.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        message: "No fue posible crear el producto.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * PATCH /api/lp/productos-compras
 *
 * Body:
 * {
 *   "id": 1,
 *   "nombre": "Bleach",
 *   "marca": "Clorox",
 *   "presentacion": "1 gal",
 *   "activo": true
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as ProductoPayload;

    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          message: "El ID del producto no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const productoActual =
      await prisma.lPProductoCompra.findUnique({
        where: {
          id,
        },
      });

    if (!productoActual) {
      return NextResponse.json(
        {
          message: "El producto no existe.",
        },
        {
          status: 404,
        }
      );
    }

    const nombre =
      body.nombre === undefined
        ? productoActual.nombre
        : limpiarTexto(body.nombre);

    const marca =
      body.marca === undefined
        ? productoActual.marca
        : limpiarTextoOpcional(body.marca);

    const presentacion =
      body.presentacion === undefined
        ? productoActual.presentacion
        : limpiarTextoOpcional(body.presentacion);

    const activo =
      typeof body.activo === "boolean"
        ? body.activo
        : productoActual.activo;

    if (!nombre) {
      return NextResponse.json(
        {
          message: "El nombre del producto no puede estar vacío.",
        },
        {
          status: 400,
        }
      );
    }

    const nombreNormalizado = construirNombreNormalizado({
      nombre,
      marca,
      presentacion,
    });

    const duplicado = await prisma.lPProductoCompra.findFirst({
      where: {
        nombreNormalizado,
        id: {
          not: id,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        {
          message:
            "Ya existe otro producto con el mismo nombre, marca y presentación.",
          productoExistente: productoParaRespuesta(duplicado),
        },
        {
          status: 409,
        }
      );
    }

    const productoActualizado =
      await prisma.lPProductoCompra.update({
        where: {
          id,
        },
        data: {
          nombre,
          nombreNormalizado,
          marca,
          presentacion,
          activo,
        },
      });

    return NextResponse.json({
      producto: productoParaRespuesta(productoActualizado),
      message: "Producto actualizado correctamente.",
    });
  } catch (error) {
    console.error("Error actualizando producto:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "Ya existe otro producto con el mismo nombre, marca y presentación.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        message: "No fue posible actualizar el producto.",
      },
      {
        status: 500,
      }
    );
  }
}