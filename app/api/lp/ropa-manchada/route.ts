import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const registros = await prisma.lPRopaManchada.findMany({
      orderBy: [
        { cambiada: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        unidad: {
          include: {
            edificio: true,
          },
        },
      },
    });

    return NextResponse.json({ registros });
  } catch (error) {
    console.error("Error obteniendo ropa manchada:", error);

    return NextResponse.json(
      { error: "Error obteniendo ropa manchada" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const unidadId = Number(body.unidadId);
    const item = String(body.item || "").trim();
    const cantidad = Number(body.cantidad || 1);

    if (!unidadId || !item || cantidad <= 0) {
      return NextResponse.json(
        { error: "Unidad, item y cantidad son requeridos" },
        { status: 400 }
      );
    }

    const registro = await prisma.lPRopaManchada.create({
      data: {
        unidadId,
        item,
        cantidad,
      },
      include: {
        unidad: {
          include: {
            edificio: true,
          },
        },
      },
    });

    return NextResponse.json({ registro });
  } catch (error) {
    console.error("Error creando ropa manchada:", error);

    return NextResponse.json(
      { error: "Error creando ropa manchada" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const id = Number(body.id);

    if (!id) {
      return NextResponse.json(
        { error: "ID requerido" },
        { status: 400 }
      );
    }

    const registro = await prisma.lPRopaManchada.update({
      where: { id },
      data: {
        cambiada: true,
        fechaCambio: new Date(),
      },
    });

    return NextResponse.json({ registro });
  } catch (error) {
    console.error("Error marcando ropa como cambiada:", error);

    return NextResponse.json(
      { error: "Error marcando ropa como cambiada" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.lPRopaManchada.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando ropa manchada:", error);

    return NextResponse.json(
      { error: "Error eliminando ropa manchada" },
      { status: 500 }
    );
  }
}