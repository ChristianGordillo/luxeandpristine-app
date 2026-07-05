import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPProgramacionEstado, LPTrabajoTipo } from "@prisma/client";

function crearFechaLocal(fechaString: string) {
  return new Date(`${fechaString}T12:00:00.000Z`);
}

function getDiaSemana(fechaString: string) {
  const [year, month, day] = fechaString.split("-").map(Number);
  const fechaUTC = new Date(Date.UTC(year, month - 1, day));

  return fechaUTC.toLocaleDateString("es-ES", {
    weekday: "long",
    timeZone: "UTC",
  });
}

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function addDays(fechaString: string, days: number) {
  const [year, month, day] = fechaString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde") || getTodayInputValue();
    const hasta = searchParams.get("hasta") || addDays(desde, 14);

    const fechaDesde = crearFechaLocal(desde);
    fechaDesde.setUTCHours(0, 0, 0, 0);

    const fechaHasta = crearFechaLocal(hasta);
    fechaHasta.setUTCHours(23, 59, 59, 999);

    const programaciones = await prisma.lPProgramacionTrabajo.findMany({
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
      },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      status: "success",
      programaciones,
      rango: {
        desde,
        hasta,
      },
    });
  } catch (error) {
    console.error("Error al listar programación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar programación" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { fecha, tipo, unidadId, unidadManual } = body;

    const tieneUnidadCatalogo =
      unidadId !== null && unidadId !== undefined && unidadId !== "";

    const tieneUnidadManual =
      typeof unidadManual === "string" && unidadManual.trim().length > 0;

    if (!fecha || !tipo) {
      return NextResponse.json(
        { status: "fail", message: "Fecha y tipo son obligatorios" },
        { status: 400 }
      );
    }

    if (!tieneUnidadCatalogo && !tieneUnidadManual) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Selecciona una unidad o escribe una unidad manual",
        },
        { status: 400 }
      );
    }

    if (!Object.values(LPTrabajoTipo).includes(tipo)) {
      return NextResponse.json(
        { status: "fail", message: "Tipo inválido" },
        { status: 400 }
      );
    }

    const programacion = await prisma.lPProgramacionTrabajo.create({
      data: {
        fecha: crearFechaLocal(fecha),
        dia: getDiaSemana(fecha),
        tipo,
        unidadId: tieneUnidadCatalogo ? Number(unidadId) : null,
        unidadManual: tieneUnidadCatalogo ? null : unidadManual.trim(),
        estado: "PROGRAMADO",
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
      programacion,
    });
  } catch (error) {
    console.error("Error al crear programación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear programación" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, fecha, tipo, unidadId, unidadManual, estado } = body;

    const tieneUnidadCatalogo =
      unidadId !== null && unidadId !== undefined && unidadId !== "";

    const tieneUnidadManual =
      typeof unidadManual === "string" && unidadManual.trim().length > 0;

    if (!id || !fecha || !tipo) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!tieneUnidadCatalogo && !tieneUnidadManual) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Selecciona una unidad o escribe una unidad manual",
        },
        { status: 400 }
      );
    }

    if (!Object.values(LPTrabajoTipo).includes(tipo)) {
      return NextResponse.json(
        { status: "fail", message: "Tipo inválido" },
        { status: 400 }
      );
    }

    if (estado && !Object.values(LPProgramacionEstado).includes(estado)) {
      return NextResponse.json(
        { status: "fail", message: "Estado inválido" },
        { status: 400 }
      );
    }

    const programacion = await prisma.lPProgramacionTrabajo.update({
      where: {
        id: Number(id),
      },
      data: {
        fecha: crearFechaLocal(fecha),
        dia: getDiaSemana(fecha),
        tipo,
        unidadId: tieneUnidadCatalogo ? Number(unidadId) : null,
        unidadManual: tieneUnidadCatalogo ? null : unidadManual.trim(),
        estado: estado || "PROGRAMADO",
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
      programacion,
    });
  } catch (error) {
    console.error("Error al actualizar programación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar programación" },
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

    await prisma.lPProgramacionTrabajo.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Programación eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar programación:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al eliminar programación" },
      { status: 500 }
    );
  }
}