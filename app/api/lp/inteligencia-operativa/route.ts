import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function crearFechaLocal(fechaString: string) {
  return new Date(`${fechaString}T12:00:00.000Z`);
}

function formatearFecha(fecha: Date) {
  return fecha.toISOString().split("T")[0];
}

function obtenerMesKey(fecha: Date) {
  return fecha.toISOString().slice(0, 7);
}

function crearContadoresBase() {
  return {
    totalTrabajos: 0,
    turnovers: 0,
    limpiezas: 0,
    limpiezasIniciales: 0,
    extras: 0,
    repasos: 0,
  };
}

function sumarTipo(item: any, tipo: string) {
  item.totalTrabajos += 1;

  if (tipo === "LIMPIEZA") {
    item.limpiezas += 1;
    item.turnovers += 1;
  }

  if (tipo === "LIMPIEZA_INICIAL") {
    item.limpiezasIniciales += 1;
    item.turnovers += 1;
  }

  if (tipo === "EXTRA") item.extras += 1;
  if (tipo === "REPASO_LIMPIEZA") item.repasos += 1;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");
    const edificioId = searchParams.get("edificioId");
    const clienteId = searchParams.get("clienteId");

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

    const trabajos = await prisma.lPTrabajoDiario.findMany({
      where: {
        fecha: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
        unidad: {
          ...(edificioId ? { edificioId: Number(edificioId) } : {}),
          ...(clienteId ? { clienteId: Number(clienteId) } : {}),
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
      orderBy: {
        fecha: "asc",
      },
    });

    const porDiaMap = new Map<string, any>();
    const porUnidadMap = new Map<number, any>();
    const porEdificioMap = new Map<number, any>();
    const porDiaSemanaMap = new Map<string, any>();
    const porUnidadMesMap = new Map<string, any>();

    for (const trabajo of trabajos) {
      const fechaKey = formatearFecha(trabajo.fecha);
      const mesKey = obtenerMesKey(trabajo.fecha);
      const unidad = trabajo.unidad;
      const edificio = unidad?.edificio;
      const tipo = trabajo.tipo;

      if (!porDiaMap.has(fechaKey)) {
        porDiaMap.set(fechaKey, {
          fecha: fechaKey,
          dia: trabajo.dia,
          ...crearContadoresBase(),
        });
      }

      sumarTipo(porDiaMap.get(fechaKey), tipo);

      if (!porDiaSemanaMap.has(trabajo.dia)) {
        porDiaSemanaMap.set(trabajo.dia, {
          dia: trabajo.dia,
          ...crearContadoresBase(),
        });
      }

      sumarTipo(porDiaSemanaMap.get(trabajo.dia), tipo);

      if (unidad) {
        if (!porUnidadMap.has(unidad.id)) {
          porUnidadMap.set(unidad.id, {
            unidadId: unidad.id,
            unidad: unidad.nombre,
            edificioId: edificio?.id ?? null,
            edificio: edificio?.nombre ?? "Sin edificio",
            cliente: unidad.cliente?.nombre ?? "Sin cliente",
            habitaciones: unidad.habitaciones,
            banos: unidad.banos,
            ...crearContadoresBase(),
          });
        }

        sumarTipo(porUnidadMap.get(unidad.id), tipo);

        const unidadMesKey = `${unidad.id}-${mesKey}`;

        if (!porUnidadMesMap.has(unidadMesKey)) {
          porUnidadMesMap.set(unidadMesKey, {
            unidadId: unidad.id,
            unidad: unidad.nombre,
            edificio: edificio?.nombre ?? "Sin edificio",
            mes: mesKey,
            ...crearContadoresBase(),
          });
        }

        sumarTipo(porUnidadMesMap.get(unidadMesKey), tipo);
      }

      if (edificio) {
        if (!porEdificioMap.has(edificio.id)) {
          porEdificioMap.set(edificio.id, {
            edificioId: edificio.id,
            edificio: edificio.nombre,
            unidades: new Set<number>(),
            ...crearContadoresBase(),
          });
        }

        const itemEdificio = porEdificioMap.get(edificio.id);
        sumarTipo(itemEdificio, tipo);

        if (unidad) itemEdificio.unidades.add(unidad.id);
      }
    }

    const porDia = Array.from(porDiaMap.values());

    const porUnidad = Array.from(porUnidadMap.values()).sort(
      (a, b) => b.turnovers - a.turnovers
    );

    const porEdificio = Array.from(porEdificioMap.values())
      .map((item) => ({
        edificioId: item.edificioId,
        edificio: item.edificio,
        unidadesActivas: item.unidades.size,
        totalTrabajos: item.totalTrabajos,
        turnovers: item.turnovers,
        limpiezas: item.limpiezas,
        limpiezasIniciales: item.limpiezasIniciales,
        extras: item.extras,
        repasos: item.repasos,
        intensidadOperativa:
          item.unidades.size > 0
            ? Number((item.turnovers / item.unidades.size).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.turnovers - a.turnovers);

    const ordenDias = [
      "lunes",
      "martes",
      "miércoles",
      "miercoles",
      "jueves",
      "viernes",
      "sábado",
      "sabado",
      "domingo",
    ];

    const porDiaSemana = Array.from(porDiaSemanaMap.values()).sort(
      (a, b) =>
        ordenDias.indexOf(a.dia.toLowerCase()) -
        ordenDias.indexOf(b.dia.toLowerCase())
    );

    const porUnidadMes = Array.from(porUnidadMesMap.values()).sort((a, b) => {
      if (a.mes === b.mes) return b.turnovers - a.turnovers;
      return a.mes.localeCompare(b.mes);
    });

    const totalTrabajos = trabajos.length;
    const totalTurnovers = porDia.reduce((acc, item) => acc + item.turnovers, 0);
    const totalExtras = porDia.reduce((acc, item) => acc + item.extras, 0);
    const totalRepasos = porDia.reduce((acc, item) => acc + item.repasos, 0);
    const totalLimpiezasIniciales = porDia.reduce(
      (acc, item) => acc + item.limpiezasIniciales,
      0
    );

    const diasOperativos = porDia.length;
    const unidadesActivas = porUnidad.length;
    const edificiosActivos = porEdificio.length;

    const promedioDiario =
      diasOperativos > 0 ? totalTurnovers / diasOperativos : 0;

    const diaMayorDemanda =
      porDia.length > 0
        ? porDia.reduce((max, item) =>
            item.turnovers > max.turnovers ? item : max
          )
        : null;

        const unidadesInventario = await prisma.lPUnidad.findMany({
        where: {
            activo: true,
            ...(edificioId ? { edificioId: Number(edificioId) } : {}),
            ...(clienteId ? { clienteId: Number(clienteId) } : {}),
        },
        include: {
            edificio: true,
            cliente: true,
        },
        });

    return NextResponse.json({
      status: "success",
      resumen: {
        totalTrabajos,
        totalTurnovers,
        totalExtras,
        totalRepasos,
        totalLimpiezasIniciales,
        diasOperativos,
        unidadesActivas,
        edificiosActivos,
        promedioDiario: Number(promedioDiario.toFixed(2)),
        diaMayorDemanda,
        unidadMayorMovimiento: porUnidad[0] || null,
        unidadMenorMovimiento:
          porUnidad.length > 0 ? porUnidad[porUnidad.length - 1] : null,
        edificioMayorMovimiento: porEdificio[0] || null,
      },
      porDia,
      porUnidad,
      porEdificio,
      porDiaSemana,
      porUnidadMes,
    });
  } catch (error) {
    console.error("Error al generar inteligencia operativa:", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al generar inteligencia operativa",
      },
      { status: 500 }
    );
  }
}