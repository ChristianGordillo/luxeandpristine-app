import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function crearRangoFechas(desde: string, hasta: string) {
  return {
    fechaDesde: new Date(`${desde}T00:00:00.000Z`),
    fechaHasta: new Date(`${hasta}T23:59:59.999Z`),
  };
}

function fechaKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function calcularPagoSugerido(precioTrabajo: number) {
  if (Number(precioTrabajo) === 80) return 60;
  if (Number(precioTrabajo) === 68) return 55;
  if (Number(precioTrabajo) === 65) return 50;
  if (Number(precioTrabajo) === 55) return 40;
  if (Number(precioTrabajo) === 20) return 10;

  return 0;
}

function construirTipoUnidad(
  habitaciones?: number | null,
  banos?: number | null
) {
  if (habitaciones === null || habitaciones === undefined) {
    return "—";
  }

  if (banos === null || banos === undefined) {
    return `${habitaciones}/—`;
  }

  return `${habitaciones}/${banos}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");
    const cliente = searchParams.get("cliente") || "TODOS";

    if (!desde || !hasta) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Debes enviar desde y hasta",
        },
        { status: 400 }
      );
    }

    const { fechaDesde, fechaHasta } = crearRangoFechas(desde, hasta);

    const [trabajos, costosOperativos, clientes] = await Promise.all([
      prisma.lPTrabajoDiario.findMany({
        where: {
          fecha: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
          ...(cliente !== "TODOS"
            ? {
                unidad: {
                  cliente: {
                    nombre: cliente,
                  },
                },
              }
            : {}),
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
          },
        },
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      }),

      prisma.lPCostoOperativoDiario.findMany({
        where: {
          fecha: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      }),

      prisma.lPCliente.findMany({
        orderBy: {
          nombre: "asc",
        },
      }),
    ]);

    /*
     * Los costos operativos todavía no están asociados a clientes.
     * Por eso solamente se incluyen cuando la vista está en TODOS.
     */
    const costosAplicables = cliente === "TODOS" ? costosOperativos : [];

    const totalTrabajado = trabajos.reduce(
      (acc, trabajo) => acc + Number(trabajo.precio || 0),
      0
    );

    const totalAsignadoCleaners = trabajos.reduce((acc, trabajo) => {
      const totalAsignaciones = trabajo.asignaciones.reduce(
        (sum, asignacion) => sum + Number(asignacion.valorPago || 0),
        0
      );

      return acc + totalAsignaciones;
    }, 0);

    const trabajosPendientes = trabajos.filter(
      (trabajo) => trabajo.asignaciones.length === 0
    );

    const totalPendienteAsignar = trabajosPendientes.reduce((acc, trabajo) => {
      return acc + calcularPagoSugerido(Number(trabajo.precio || 0));
    }, 0);

    const totalCostosOperativos = costosAplicables.reduce(
      (acc, costo) => acc + Number(costo.valor || 0),
      0
    );

    const margenEstimado =
      totalTrabajado -
      totalAsignadoCleaners -
      totalPendienteAsignar -
      totalCostosOperativos;

    /*
     * RESUMEN FINANCIERO AGRUPADO POR DÍA
     */

    const mapaDias = new Map<
      string,
      {
        fecha: string;
        dia: string;
        trabajos: number;
        totalTrabajado: number;
        totalAsignadoCleaners: number;
        totalPendienteAsignar: number;
        totalCostosOperativos: number;
        margenEstimado: number;
      }
    >();

    trabajos.forEach((trabajo) => {
      const key = fechaKey(trabajo.fecha);

      if (!mapaDias.has(key)) {
        mapaDias.set(key, {
          fecha: key,
          dia: trabajo.dia,
          trabajos: 0,
          totalTrabajado: 0,
          totalAsignadoCleaners: 0,
          totalPendienteAsignar: 0,
          totalCostosOperativos: 0,
          margenEstimado: 0,
        });
      }

      const item = mapaDias.get(key)!;

      const asignado = trabajo.asignaciones.reduce(
        (sum, asignacion) => sum + Number(asignacion.valorPago || 0),
        0
      );

      const pendiente =
        trabajo.asignaciones.length === 0
          ? calcularPagoSugerido(Number(trabajo.precio || 0))
          : 0;

      item.trabajos += 1;
      item.totalTrabajado += Number(trabajo.precio || 0);
      item.totalAsignadoCleaners += asignado;
      item.totalPendienteAsignar += pendiente;
    });

    costosAplicables.forEach((costo) => {
      const key = fechaKey(costo.fecha);

      if (!mapaDias.has(key)) {
        mapaDias.set(key, {
          fecha: key,
          dia: "",
          trabajos: 0,
          totalTrabajado: 0,
          totalAsignadoCleaners: 0,
          totalPendienteAsignar: 0,
          totalCostosOperativos: 0,
          margenEstimado: 0,
        });
      }

      const item = mapaDias.get(key)!;

      item.totalCostosOperativos += Number(costo.valor || 0);
    });

    const resumenDias = Array.from(mapaDias.values())
      .map((item) => ({
        ...item,
        margenEstimado:
          item.totalTrabajado -
          item.totalAsignadoCleaners -
          item.totalPendienteAsignar -
          item.totalCostosOperativos,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    /*
     * DETALLE PLANO DE TRABAJOS
     *
     * Esta colección será utilizada para:
     * - Mostrar la nueva pantalla.
     * - Exportar CSV.
     * - Exportar Excel.
     */

    const trabajosDetalle = trabajos.map((trabajo) => {
      const totalPagoCleaners = trabajo.asignaciones.reduce(
        (sum, asignacion) => sum + Number(asignacion.valorPago || 0),
        0
      );

      const pagoPendiente =
        trabajo.asignaciones.length === 0
          ? calcularPagoSugerido(Number(trabajo.precio || 0))
          : 0;

      return {
        id: trabajo.id,
        fecha: fechaKey(trabajo.fecha),
        dia: trabajo.dia,

        cliente: trabajo.unidad?.cliente?.nombre || "Sin cliente",
        edificio: trabajo.unidad?.edificio?.nombre || "Eventual",
        unidad:
          trabajo.unidad?.nombre ||
          trabajo.unidadManual ||
          "Unidad eventual",

        habitaciones: trabajo.unidad?.habitaciones ?? null,
        banos: trabajo.unidad?.banos ?? null,
        tipoUnidad: construirTipoUnidad(
          trabajo.unidad?.habitaciones,
          trabajo.unidad?.banos
        ),

        tipoTrabajo: trabajo.tipo,
        precio: Number(trabajo.precio || 0),
        notas: trabajo.notas || null,

        asignado: trabajo.asignaciones.length > 0,
        cantidadAsignaciones: trabajo.asignaciones.length,
        totalPagoCleaners,
        pagoPendiente,

        utilidadEstimada:
          Number(trabajo.precio || 0) -
          totalPagoCleaners -
          pagoPendiente,

        cleaners: trabajo.asignaciones.map((asignacion) => ({
          id: asignacion.cleaner.id,
          nombre: asignacion.cleaner.nombre,
          rol: asignacion.rol,
          valorPago: Number(asignacion.valorPago || 0),
        })),
      };
    });

    /*
     * DETALLE DE TRABAJOS AGRUPADO POR DÍA
     *
     * Esto facilita la visualización móvil y permite mostrar
     * el subtotal de cada fecha.
     */

    const mapaDetalleDias = new Map<
      string,
      {
        fecha: string;
        dia: string;
        cantidadTrabajos: number;
        totalPrecio: number;
        trabajos: typeof trabajosDetalle;
      }
    >();

    trabajosDetalle.forEach((trabajo) => {
      if (!mapaDetalleDias.has(trabajo.fecha)) {
        mapaDetalleDias.set(trabajo.fecha, {
          fecha: trabajo.fecha,
          dia: trabajo.dia,
          cantidadTrabajos: 0,
          totalPrecio: 0,
          trabajos: [],
        });
      }

      const grupo = mapaDetalleDias.get(trabajo.fecha)!;

      grupo.cantidadTrabajos += 1;
      grupo.totalPrecio += trabajo.precio;
      grupo.trabajos.push(trabajo);
    });

    const detalleDias = Array.from(mapaDetalleDias.values()).sort((a, b) =>
      b.fecha.localeCompare(a.fecha)
    );

    return NextResponse.json({
      status: "success",

      filtros: {
        desde,
        hasta,
        cliente,
      },

      clientes: clientes.map((item) => item.nombre),

      resumen: {
        trabajos: trabajos.length,
        trabajosAsignados: trabajos.length - trabajosPendientes.length,
        trabajosPendientes: trabajosPendientes.length,
        totalTrabajado,
        totalAsignadoCleaners,
        totalPendienteAsignar,
        totalCostosOperativos,
        margenEstimado,
      },

      resumenDias,

      /*
       * Datos nuevos para la pantalla de detalle.
       */
      trabajosDetalle,
      detalleDias,

      /*
       * Se mantienen temporalmente para no afectar
       * ninguna pantalla que ya los esté consumiendo.
       */
      trabajos,
      costosOperativos: costosAplicables,
    });
  } catch (error) {
    console.error("Error al generar resumen financiero:", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al generar resumen financiero",
      },
      { status: 500 }
    );
  }
}