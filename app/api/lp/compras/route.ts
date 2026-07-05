import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPGastoCategoria } from "@prisma/client";

function crearFechaLocal(fechaString: string) {
  return new Date(`${fechaString}T12:00:00.000Z`);
}

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

type CompraItemInput = {
  nombre?: string;
  cantidad?: number | string;
  precioBase?: number | string;
};

function limpiarItems(items: CompraItemInput[]) {
  return items
    .map((item) => ({
      nombre: String(item.nombre || "").trim(),
      cantidad: Number(item.cantidad || 1),
      precioBase: Number(item.precioBase || 0),
    }))
    .filter((item) => item.nombre && item.precioBase > 0);
}

function calcularItemsConTaxes(
  items: CompraItemInput[],
  subtotal: number,
  taxes: number
) {
  return items.map((item) => {
    const nombre = String(item.nombre || "").trim();
    const cantidad = Number(item.cantidad || 1);
    const precioBase = Number(item.precioBase || 0);

    const proporcion = subtotal > 0 ? precioBase / subtotal : 0;
    const taxAsignado = taxes * proporcion;
    const precioFinal = precioBase + taxAsignado;

    return {
      nombre,
      cantidad,
      precioBase,
      taxAsignado,
      precioFinal,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde") || getTodayInputValue();
    const hasta = searchParams.get("hasta") || getTodayInputValue();
    const categoria = searchParams.get("categoria");
    const proveedorId = searchParams.get("proveedorId");

    const fechaDesde = crearFechaLocal(desde);
    fechaDesde.setUTCHours(0, 0, 0, 0);

    const fechaHasta = crearFechaLocal(hasta);
    fechaHasta.setUTCHours(23, 59, 59, 999);

    const where: {
      fecha: {
        gte: Date;
        lte: Date;
      };
      categoria?: LPGastoCategoria;
      proveedorId?: number;
    } = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    };

    if (
      categoria &&
      Object.values(LPGastoCategoria).includes(categoria as LPGastoCategoria)
    ) {
      where.categoria = categoria as LPGastoCategoria;
    }

    if (proveedorId) {
      where.proveedorId = Number(proveedorId);
    }

    const compras = await prisma.lPCompra.findMany({
      where,
      include: {
        proveedor: true,
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });

    const resumen = {
      cantidad: compras.length,
      subtotal: compras.reduce((acc, compra) => acc + compra.subtotal, 0),
      taxes: compras.reduce((acc, compra) => acc + compra.taxes, 0),
      total: compras.reduce((acc, compra) => acc + compra.total, 0),
    };

    return NextResponse.json({
      status: "success",
      compras,
      resumen,
    });
  } catch (error) {
    console.error("Error al listar compras:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar compras" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { fecha, proveedorId, categoria, taxes, items } = body;

    if (!fecha || !proveedorId || !categoria || !Array.isArray(items)) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!Object.values(LPGastoCategoria).includes(categoria)) {
      return NextResponse.json(
        { status: "fail", message: "Categoría inválida" },
        { status: 400 }
      );
    }

    const itemsLimpios = limpiarItems(items);

    if (itemsLimpios.length === 0) {
      return NextResponse.json(
        { status: "fail", message: "Debes agregar al menos un producto" },
        { status: 400 }
      );
    }

    const subtotal = itemsLimpios.reduce(
      (acc, item) => acc + item.precioBase,
      0
    );

    const taxesNumber = Number(taxes || 0);
    const total = subtotal + taxesNumber;

    const itemsCalculados = calcularItemsConTaxes(
      itemsLimpios,
      subtotal,
      taxesNumber
    );

    const compra = await prisma.lPCompra.create({
      data: {
        fecha: crearFechaLocal(fecha),
        proveedorId: Number(proveedorId),
        categoria,
        subtotal,
        taxes: taxesNumber,
        total,
        items: {
          create: itemsCalculados,
        },
      },
      include: {
        proveedor: true,
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      status: "success",
      compra,
    });
  } catch (error) {
    console.error("Error al crear compra:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear compra" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, fecha, proveedorId, categoria, taxes, items } = body;

    if (!id || !fecha || !proveedorId || !categoria || !Array.isArray(items)) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!Object.values(LPGastoCategoria).includes(categoria)) {
      return NextResponse.json(
        { status: "fail", message: "Categoría inválida" },
        { status: 400 }
      );
    }

    const compraActual = await prisma.lPCompra.findUnique({
      where: {
        id: Number(id),
      },
      select: {
        id: true,
      },
    });

    if (!compraActual) {
      return NextResponse.json(
        { status: "fail", message: "Compra no encontrada" },
        { status: 404 }
      );
    }

    const itemsLimpios = limpiarItems(items);

    if (itemsLimpios.length === 0) {
      return NextResponse.json(
        { status: "fail", message: "Debes agregar al menos un producto" },
        { status: 400 }
      );
    }

    const subtotal = itemsLimpios.reduce(
      (acc, item) => acc + item.precioBase,
      0
    );

    const taxesNumber = Number(taxes || 0);
    const total = subtotal + taxesNumber;

    const itemsCalculados = calcularItemsConTaxes(
      itemsLimpios,
      subtotal,
      taxesNumber
    );

    const compra = await prisma.$transaction(async (tx) => {
      await tx.lPCompraItem.deleteMany({
        where: {
          compraId: Number(id),
        },
      });

      return tx.lPCompra.update({
        where: {
          id: Number(id),
        },
        data: {
          fecha: crearFechaLocal(fecha),
          proveedorId: Number(proveedorId),
          categoria,
          subtotal,
          taxes: taxesNumber,
          total,
          items: {
            create: itemsCalculados,
          },
        },
        include: {
          proveedor: true,
          items: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    });

    return NextResponse.json({
      status: "success",
      compra,
    });
  } catch (error) {
    console.error("Error al actualizar compra:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar compra" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { status: "fail", message: "ID requerido" },
        { status: 400 }
      );
    }

    await prisma.lPCompra.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Compra eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar compra:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al eliminar compra" },
      { status: 500 }
    );
  }
}