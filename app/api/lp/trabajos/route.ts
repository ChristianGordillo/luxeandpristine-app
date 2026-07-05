import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPTrabajoTipo } from "@prisma/client";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    let where = {};

    if (desde && hasta) {
      const fechaDesde = crearFechaLocal(desde);
      fechaDesde.setUTCHours(0, 0, 0, 0);

      const fechaHasta = crearFechaLocal(hasta);
      fechaHasta.setUTCHours(23, 59, 59, 999);

      where = {
        fecha: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
      };
    }

    const trabajos = await prisma.lPTrabajoDiario.findMany({
      where,
      include: {
        unidad: {
          include: {
            cliente: true,
            edificio: true,
            trabajos: {
              where: {
                incidenciaAbierta: true,
              },
              select: {
                id: true,
                fecha: true,
                notas: true,
              },
              orderBy: {
                fecha: "desc",
              },
            },
            ropaPendiente: {
              where: {
                activo: true,
              },
              select: {
                id: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });

    const total = trabajos.reduce((acc, trabajo) => acc + trabajo.precio, 0);

    const resumen = {
      cantidad: trabajos.length,
      total,
      limpiezaInicial: trabajos.filter(
        (t) => t.tipo === "LIMPIEZA_INICIAL"
      ).length,
      limpieza: trabajos.filter((t) => t.tipo === "LIMPIEZA").length,
      extra: trabajos.filter((t) => t.tipo === "EXTRA").length,
      repasoLimpieza: trabajos.filter(
        (t) => t.tipo === "REPASO_LIMPIEZA"
      ).length,
    };

    return NextResponse.json({
      status: "success",
      trabajos,
      resumen,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar trabajos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      unidadId,
      unidadManual,
      fecha,
      tipo,
      precio,
      notas,
      checkIn,
    } = body;

    const tieneUnidadCatalogo =
      unidadId !== null && unidadId !== undefined && unidadId !== "";

    const tieneUnidadManual =
      typeof unidadManual === "string" && unidadManual.trim().length > 0;

    if (!fecha || !tipo || precio === undefined) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!tieneUnidadCatalogo && !tieneUnidadManual) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Debes seleccionar una unidad o escribir una unidad manual",
        },
        { status: 400 }
      );
    }

    if (!Object.values(LPTrabajoTipo).includes(tipo)) {
      return NextResponse.json(
        { status: "fail", message: "Tipo de trabajo inválido" },
        { status: 400 }
      );
    }

    const fechaTrabajo = crearFechaLocal(fecha);
    const dia = getDiaSemana(fecha);

    const trabajo = await prisma.lPTrabajoDiario.create({
      data: {
        fecha: fechaTrabajo,
        dia,
        tipo,
        precio: Number(precio),
        notas: notas || "",
        checkIn: Boolean(checkIn),
        unidadId: tieneUnidadCatalogo ? Number(unidadId) : null,
        unidadManual: tieneUnidadCatalogo ? null : unidadManual.trim(),
      },
      include: {
        unidad: {
          include: {
            cliente: true,
            edificio: true,
            trabajos: {
              where: {
                incidenciaAbierta: true,
              },
              select: {
                id: true,
                fecha: true,
                notas: true,
              },
              orderBy: {
                fecha: "desc",
              },
            },
            ropaPendiente: {
              where: {
                activo: true,
              },
              select: {
                id: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      status: "success",
      trabajo,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear trabajo" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      unidadId,
      unidadManual,
      fecha,
      tipo,
      precio,
      notas,
      checkIn,
    } = body;

    const tieneUnidadCatalogo =
      unidadId !== null && unidadId !== undefined && unidadId !== "";

    const tieneUnidadManual =
      typeof unidadManual === "string" && unidadManual.trim().length > 0;

    if (!id || !fecha || !tipo || precio === undefined) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    if (!tieneUnidadCatalogo && !tieneUnidadManual) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Debes seleccionar una unidad o escribir una unidad manual",
        },
        { status: 400 }
      );
    }

    if (!Object.values(LPTrabajoTipo).includes(tipo)) {
      return NextResponse.json(
        { status: "fail", message: "Tipo de trabajo inválido" },
        { status: 400 }
      );
    }

    const fechaTrabajo = crearFechaLocal(fecha);
    const dia = getDiaSemana(fecha);

    const trabajo = await prisma.lPTrabajoDiario.update({
      where: {
        id: Number(id),
      },
      data: {
        fecha: fechaTrabajo,
        dia,
        tipo,
        precio: Number(precio),
        notas: notas || "",
        checkIn: Boolean(checkIn),
        unidadId: tieneUnidadCatalogo ? Number(unidadId) : null,
        unidadManual: tieneUnidadCatalogo ? null : unidadManual.trim(),
      },
      include: {
        unidad: {
          include: {
            cliente: true,
            edificio: true,
            trabajos: {
              where: {
                incidenciaAbierta: true,
              },
              select: {
                id: true,
                fecha: true,
                notas: true,
              },
              orderBy: {
                fecha: "desc",
              },
            },
            ropaPendiente: {
              where: {
                activo: true,
              },
              select: {
                id: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      status: "success",
      trabajo,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar trabajo" },
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

    await prisma.lPTrabajoDiario.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Trabajo eliminado correctamente",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { status: "fail", message: "Error al eliminar trabajo" },
      { status: 500 }
    );
  }
}