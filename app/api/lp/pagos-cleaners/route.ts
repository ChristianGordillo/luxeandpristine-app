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
    const cleanerId = searchParams.get("cleanerId");

    if (!desde || !hasta) {
      return NextResponse.json(
        { status: "fail", message: "Desde y hasta son obligatorios" },
        { status: 400 }
      );
    }

    const fechaDesde = crearFechaLocal(desde);
    fechaDesde.setUTCHours(0, 0, 0, 0);

    const fechaHasta = crearFechaLocal(hasta);
    fechaHasta.setUTCHours(23, 59, 59, 999);

    const asignaciones = await prisma.lPAsignacionTrabajo.findMany({
      where: {
        ...(cleanerId && cleanerId !== "TODOS"
          ? { cleanerId: Number(cleanerId) }
          : {}),
        trabajo: {
          fecha: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
      },
      include: {
        cleaner: true,
        trabajo: {
          include: {
            unidad: {
              include: {
                edificio: true,
                cliente: true,
              },
            },
          },
        },
      },
      orderBy: {
        trabajo: {
          fecha: "asc",
        },
      },
    });

    const resumenPorCleaner = asignaciones.reduce((acc: any, asignacion) => {
      const id = asignacion.cleanerId;
      const ingresoLP = Number(asignacion.trabajo.precio || 0);
      const valorPago = Number(asignacion.valorPago || 0);
      const utilidad = ingresoLP - valorPago;

      const cliente =
        asignacion.trabajo.unidad?.cliente?.nombre || "Cliente eventual";

      if (!acc[id]) {
        acc[id] = {
          cleanerId: id,
          cleaner: asignacion.cleaner.nombre,
          total: 0,
          ingresoLP: 0,
          utilidad: 0,
          trabajos: 0,
          detalle: [],
        };
      }

      acc[id].total += valorPago;
      acc[id].ingresoLP += ingresoLP;
      acc[id].utilidad += utilidad;
      acc[id].trabajos += 1;

      acc[id].detalle.push({
        id: asignacion.id,
        fecha: asignacion.trabajo.fecha,
        unidad:
          asignacion.trabajo.unidad?.nombre ||
          asignacion.trabajo.unidadManual ||
          "Unidad eventual",
        edificio: asignacion.trabajo.unidad?.edificio?.nombre || "Eventual",
        cliente,
        tipo: asignacion.trabajo.tipo,
        rol: asignacion.rol,
        ingresoLP,
        valorPago,
        utilidad,
        notas: asignacion.notas,
      });

      return acc;
    }, {});

    const resumenPorCliente = asignaciones.reduce((acc: any, asignacion) => {
      const cliente =
        asignacion.trabajo.unidad?.cliente?.nombre || "Cliente eventual";

      const ingresoLP = Number(asignacion.trabajo.precio || 0);
      const valorPago = Number(asignacion.valorPago || 0);
      const utilidad = ingresoLP - valorPago;

      if (!acc[cliente]) {
        acc[cliente] = {
          cliente,
          trabajos: 0,
          ingresoLP: 0,
          total: 0,
          utilidad: 0,
        };
      }

      acc[cliente].trabajos += 1;
      acc[cliente].ingresoLP += ingresoLP;
      acc[cliente].total += valorPago;
      acc[cliente].utilidad += utilidad;

      return acc;
    }, {});

    const totalGeneral = asignaciones.reduce(
      (sum, item) => sum + Number(item.valorPago || 0),
      0
    );

    const totalIngresoLP = asignaciones.reduce(
      (sum, item) => sum + Number(item.trabajo.precio || 0),
      0
    );

    return NextResponse.json({
      status: "success",
      resumen: Object.values(resumenPorCleaner),
      resumenPorCliente: Object.values(resumenPorCliente),
      totalGeneral,
      totalIngresoLP,
      utilidadGeneral: totalIngresoLP - totalGeneral,
      totalTrabajos: asignaciones.length,
    });
  } catch (error) {
    console.error("Error generando pagos cleaners:", error);

    return NextResponse.json(
      { status: "fail", message: "Error generando pagos cleaners" },
      { status: 500 }
    );
  }
}