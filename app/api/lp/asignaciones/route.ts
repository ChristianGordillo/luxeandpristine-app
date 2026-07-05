import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPRolOperativo, LPRevisionEstado } from "@prisma/client";

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function crearFechaLocal(fechaString: string) {
  return new Date(`${fechaString}T12:00:00.000Z`);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha") || getTodayInputValue();

    const fechaDesde = crearFechaLocal(fecha);
    fechaDesde.setUTCHours(0, 0, 0, 0);

    const fechaHasta = crearFechaLocal(fecha);
    fechaHasta.setUTCHours(23, 59, 59, 999);

    const [trabajos, cleaners] = await Promise.all([
      prisma.lPTrabajoDiario.findMany({
        where: {
          fecha: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
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
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      }),

      prisma.lPCleaner.findMany({
        where: {
          activo: true,
        },
        orderBy: {
          nombre: "asc",
        },
      }),
    ]);

    return NextResponse.json({
      status: "success",
      trabajos,
      cleaners,
    });
  } catch (error) {
    console.error("Error al cargar asignaciones:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al cargar asignaciones" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { trabajoId, cleanerId, rol, valorPago, metodoPago, notas } = body;

    if (!trabajoId || !cleanerId || !rol || valorPago === undefined) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!Object.values(LPRolOperativo).includes(rol)) {
      return NextResponse.json(
        { status: "fail", message: "Rol inválido" },
        { status: 400 }
      );
    }

    const asignacion = await prisma.lPAsignacionTrabajo.create({
      data: {
        trabajoId: Number(trabajoId),
        cleanerId: Number(cleanerId),
        rol,
        valorPago: Number(valorPago),
        metodoPago: metodoPago || null,
        notas: notas || null,
      },
      include: {
        cleaner: true,
      },
    });

    return NextResponse.json({
      status: "success",
      asignacion,
    });
  } catch (error) {
    console.error("Error al crear asignación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear asignación" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      trabajoId,
      cleanerId,
      rol,
      valorPago,
      metodoPago,
      notas,
      revisionEstado,
    } = body;

    // MODO 1: revisión de incidencias desde /asignacion
    if (trabajoId && revisionEstado !== undefined) {
      if (!Object.values(LPRevisionEstado).includes(revisionEstado)) {
        return NextResponse.json(
          { status: "fail", message: "Estado de revisión inválido" },
          { status: 400 }
        );
      }

      const esIncidenciaAbierta =
        revisionEstado === LPRevisionEstado.INCIDENCIA_ABIERTA;

      const trabajo = await prisma.lPTrabajoDiario.update({
        where: {
          id: Number(trabajoId),
        },
        data: {
          notas: notas || null,
          revisionEstado,
          incidenciaAbierta: esIncidenciaAbierta,
          fechaCierreIncidencia: esIncidenciaAbierta ? null : new Date(),
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
      });

      return NextResponse.json({
        status: "success",
        trabajo,
      });
    }

    // MODO 2: compatibilidad vieja desde /asignacion con incidenciaAbierta
    // Puedes eliminar este bloque más adelante cuando el front ya esté migrado.
    if (trabajoId && body.incidenciaAbierta !== undefined) {
      const esIncidenciaAbierta = Boolean(body.incidenciaAbierta);

      const trabajo = await prisma.lPTrabajoDiario.update({
        where: {
          id: Number(trabajoId),
        },
        data: {
          notas: notas || null,
          revisionEstado: esIncidenciaAbierta
            ? LPRevisionEstado.INCIDENCIA_ABIERTA
            : LPRevisionEstado.SIN_NOVEDADES,
          incidenciaAbierta: esIncidenciaAbierta,
          fechaCierreIncidencia: esIncidenciaAbierta ? null : new Date(),
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
      });

      return NextResponse.json({
        status: "success",
        trabajo,
      });
    }

    // MODO 3: actualización normal de asignación desde /programacion
    if (!id || !cleanerId || !rol || valorPago === undefined) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!Object.values(LPRolOperativo).includes(rol)) {
      return NextResponse.json(
        { status: "fail", message: "Rol inválido" },
        { status: 400 }
      );
    }

    const asignacionActual = await prisma.lPAsignacionTrabajo.findUnique({
      where: {
        id: Number(id),
      },
      select: {
        trabajoId: true,
      },
    });

    if (!asignacionActual) {
      return NextResponse.json(
        { status: "fail", message: "Asignación no encontrada" },
        { status: 404 }
      );
    }

    const asignacion = await prisma.lPAsignacionTrabajo.update({
      where: {
        id: Number(id),
      },
      data: {
        cleanerId: Number(cleanerId),
        rol,
        valorPago: Number(valorPago),
        metodoPago: metodoPago || null,
        notas: notas || null,
      },
      include: {
        cleaner: true,
      },
    });

    await prisma.lPTrabajoDiario.update({
      where: {
        id: asignacionActual.trabajoId,
      },
      data: {
        notas: notas || null,
      },
    });

    return NextResponse.json({
      status: "success",
      asignacion,
    });
  } catch (error) {
    console.error("Error al actualizar asignación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar asignación" },
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

    await prisma.lPAsignacionTrabajo.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Asignación eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar asignación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al eliminar asignación" },
      { status: 500 }
    );
  }
}