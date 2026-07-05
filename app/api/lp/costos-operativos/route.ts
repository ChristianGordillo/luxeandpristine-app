import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function crearFechaLocal(fechaString: string) {
  return new Date(`${fechaString}T12:00:00.000Z`);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    const where =
      desde && hasta
        ? {
            fecha: {
              gte: new Date(`${desde}T00:00:00.000Z`),
              lte: new Date(`${hasta}T23:59:59.999Z`),
            },
          }
        : {};

    const costos = await prisma.lPCostoOperativoDiario.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      status: "success",
      costos,
    });
  } catch (error) {
    console.error("Error al listar costos operativos:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar costos operativos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fecha, concepto, valor, notas } = await request.json();

    if (!fecha || !concepto || valor === undefined) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    const costo = await prisma.lPCostoOperativoDiario.create({
      data: {
        fecha: crearFechaLocal(fecha),
        concepto: concepto.trim(),
        valor: Number(valor),
        notas: notas?.trim() || null,
      },
    });

    return NextResponse.json({
      status: "success",
      costo,
    });
  } catch (error) {
    console.error("Error al crear costo operativo:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear costo operativo" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, fecha, concepto, valor, notas } = await request.json();

    if (!id || !fecha || !concepto || valor === undefined) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    const costo = await prisma.lPCostoOperativoDiario.update({
      where: {
        id: Number(id),
      },
      data: {
        fecha: crearFechaLocal(fecha),
        concepto: concepto.trim(),
        valor: Number(valor),
        notas: notas?.trim() || null,
      },
    });

    return NextResponse.json({
      status: "success",
      costo,
    });
  } catch (error) {
    console.error("Error al actualizar costo operativo:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar costo operativo" },
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

    await prisma.lPCostoOperativoDiario.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Costo operativo eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar costo operativo:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al eliminar costo operativo" },
      { status: 500 }
    );
  }
}