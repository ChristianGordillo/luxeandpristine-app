import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const ropaPendiente = await prisma.lPRopaPendiente.findMany({
      where: {
        activo: true,
      },
      include: {
        unidad: {
          include: {
            edificio: true,
            cliente: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      status: "success",
      ropaPendiente,
    });
  } catch (error) {
    console.error("Error al cargar ropa pendiente:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al cargar ropa pendiente" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { unidadId } = body;

    if (!unidadId) {
      return NextResponse.json(
        { status: "fail", message: "Unidad requerida" },
        { status: 400 }
      );
    }

    const existente = await prisma.lPRopaPendiente.findFirst({
      where: {
        unidadId: Number(unidadId),
        activo: true,
      },
    });

    if (existente) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Esta unidad ya tiene ropa pendiente activa",
        },
        { status: 400 }
      );
    }

    const ropa = await prisma.lPRopaPendiente.create({
      data: {
        unidadId: Number(unidadId),
        activo: true,
      },
      include: {
        unidad: {
          include: {
            edificio: true,
            cliente: true,
          },
        },
      },
    });

    return NextResponse.json({
      status: "success",
      ropa,
    });
  } catch (error) {
    console.error("Error al crear ropa pendiente:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear ropa pendiente" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { status: "fail", message: "ID requerido" },
        { status: 400 }
      );
    }

    const ropa = await prisma.lPRopaPendiente.update({
      where: {
        id: Number(id),
      },
      data: {
        activo: false,
        cerradoAt: new Date(),
      },
      include: {
        unidad: {
          include: {
            edificio: true,
          },
        },
      },
    });

    return NextResponse.json({
      status: "success",
      ropa,
    });
  } catch (error) {
    console.error("Error al cerrar ropa pendiente:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al cerrar ropa pendiente" },
      { status: 500 }
    );
  }
}