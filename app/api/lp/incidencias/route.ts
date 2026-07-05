import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const incidencias = await prisma.lPTrabajoDiario.findMany({
      where: {
        incidenciaAbierta: true,
      },
      include: {
        unidad: {
          include: {
            edificio: true,
            cliente: true,
          },
        },
        asignaciones: {
          include: {
            cleaner: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        fecha: "desc",
      },
    });

    return NextResponse.json({
      status: "success",
      incidencias,
    });
  } catch (error) {
    console.error("Error al cargar incidencias:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al cargar incidencias" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { trabajoId } = body;

    if (!trabajoId) {
      return NextResponse.json(
        { status: "fail", message: "Trabajo requerido" },
        { status: 400 }
      );
    }

    const trabajo = await prisma.lPTrabajoDiario.update({
      where: {
        id: Number(trabajoId),
      },
      data: {
        incidenciaAbierta: false,
        fechaCierreIncidencia: new Date(),
      },
    });

    return NextResponse.json({
      status: "success",
      trabajo,
    });
  } catch (error) {
    console.error("Error al cerrar incidencia:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al cerrar incidencia" },
      { status: 500 }
    );
  }
}