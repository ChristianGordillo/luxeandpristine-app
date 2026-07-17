import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

function crearInicioDia(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function crearFinDia(fecha: string) {
  return new Date(`${fecha}T23:59:59.999Z`);
}

function fechaKey(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toISOString().split("T")[0];
}

function obtenerNaturalezaMovimiento(
  tipo: LPMovimientoClienteTipo
): "CREDITO" | "DEBITO" {
  if (
    tipo === LPMovimientoClienteTipo.ABONO ||
    tipo === LPMovimientoClienteTipo.AJUSTE_CREDITO
  ) {
    return "CREDITO";
  }

  return "DEBITO";
}

function descripcionTipoMovimiento(
  tipo: LPMovimientoClienteTipo
) {
  switch (tipo) {
    case LPMovimientoClienteTipo.ABONO:
      return "Pago recibido";

    case LPMovimientoClienteTipo.AJUSTE_CREDITO:
      return "Ajuste a favor";

    case LPMovimientoClienteTipo.AJUSTE_DEBITO:
      return "Ajuste débito";

    case LPMovimientoClienteTipo.DEVOLUCION:
      return "Devolución";

    default:
      return "Movimiento";
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const clienteIdParam = searchParams.get("clienteId");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    const clienteId = Number(clienteIdParam);

    if (
      !clienteIdParam ||
      !Number.isInteger(clienteId) ||
      clienteId <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Debes enviar un clienteId válido.",
        },
        { status: 400 }
      );
    }

    if (desde && hasta && desde > hasta) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha inicial no puede ser posterior a la fecha final.",
        },
        { status: 400 }
      );
    }

    const cliente = await prisma.lPCliente.findUnique({
      where: {
        id: clienteId,
      },
      select: {
        id: true,
        nombre: true,
      },
    });

    if (!cliente) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El cliente seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    /*
     * Buscamos el primer trabajo y el primer movimiento.
     *
     * Normalmente el estado comienza con el primer trabajo.
     * Si existe un pago anterior —por ejemplo un anticipo—
     * también debe formar parte del estado de cuenta.
     */
    const [primerTrabajo, primerMovimiento] = await Promise.all([
      prisma.lPTrabajoDiario.findFirst({
        where: {
          unidad: {
            clienteId,
          },
        },
        select: {
          fecha: true,
        },
        orderBy: [
          {
            fecha: "asc",
          },
          {
            id: "asc",
          },
        ],
      }),

      prisma.lPMovimientoCliente.findFirst({
        where: {
          clienteId,
        },
        select: {
          fecha: true,
        },
        orderBy: [
          {
            fecha: "asc",
          },
          {
            id: "asc",
          },
        ],
      }),
    ]);

    const fechasIniciales = [
      primerTrabajo?.fecha,
      primerMovimiento?.fecha,
    ].filter((fecha): fecha is Date => Boolean(fecha));

    const fechaInicioCuenta =
      fechasIniciales.length > 0
        ? new Date(
            Math.min(
              ...fechasIniciales.map((fecha) =>
                fecha.getTime()
              )
            )
          )
        : null;

    /*
     * Cliente sin trabajos ni movimientos.
     */
    if (!fechaInicioCuenta) {
      return NextResponse.json({
        status: "success",

        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          fechaInicioCuenta: null,
        },

        filtros: {
          desde,
          hasta,
          fechaDesdeReal: null,
        },

        resumen: {
          saldoInicial: 0,
          totalAbonos: 0,
          totalAjustesCredito: 0,
          totalTrabajos: 0,
          cantidadTrabajos: 0,
          totalAjustesDebito: 0,
          totalDevoluciones: 0,
          totalCreditos: 0,
          totalDebitos: 0,
          saldoFinal: 0,
          saldoPendiente: 0,
          saldoAFavor: 0,
        },

        movimientos: [],
      });
    }

    const fechaDesdeFiltro = desde
      ? crearInicioDia(desde)
      : null;

    const fechaHasta = hasta
      ? crearFinDia(hasta)
      : null;

    /*
     * El rango nunca puede comenzar antes del primer
     * movimiento real de la cuenta.
     */
    const fechaDesdeReal =
      fechaDesdeFiltro &&
      fechaDesdeFiltro.getTime() >
        fechaInicioCuenta.getTime()
        ? fechaDesdeFiltro
        : fechaInicioCuenta;

    /*
     * Si el filtro termina antes del inicio de la cuenta,
     * devolvemos una respuesta vacía.
     */
    if (
      fechaHasta &&
      fechaHasta.getTime() <
        fechaInicioCuenta.getTime()
    ) {
      return NextResponse.json({
        status: "success",

        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          fechaInicioCuenta:
            fechaKey(fechaInicioCuenta),
        },

        filtros: {
          desde,
          hasta,
          fechaDesdeReal:
            fechaKey(fechaDesdeReal),
        },

        resumen: {
          saldoInicial: 0,
          totalAbonos: 0,
          totalAjustesCredito: 0,
          totalTrabajos: 0,
          cantidadTrabajos: 0,
          totalAjustesDebito: 0,
          totalDevoluciones: 0,
          totalCreditos: 0,
          totalDebitos: 0,
          saldoFinal: 0,
          saldoPendiente: 0,
          saldoAFavor: 0,
        },

        movimientos: [],
      });
    }

    const tienePeriodoAnterior =
      fechaDesdeReal.getTime() >
      fechaInicioCuenta.getTime();

    const [
      movimientosPeriodo,
      trabajosPeriodo,
      movimientosAnteriores,
      trabajosAnteriores,
    ] = await Promise.all([
      prisma.lPMovimientoCliente.findMany({
        where: {
          clienteId,
          fecha: {
            gte: fechaDesdeReal,
            ...(fechaHasta
              ? {
                  lte: fechaHasta,
                }
              : {}),
          },
        },
        orderBy: [
          {
            fecha: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      }),

      prisma.lPTrabajoDiario.findMany({
        where: {
          unidad: {
            clienteId,
          },
          fecha: {
            gte: fechaDesdeReal,
            ...(fechaHasta
              ? {
                  lte: fechaHasta,
                }
              : {}),
          },
        },
        include: {
          unidad: {
            include: {
              edificio: true,
            },
          },
        },
        orderBy: [
          {
            fecha: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      }),

      tienePeriodoAnterior
        ? prisma.lPMovimientoCliente.findMany({
            where: {
              clienteId,
              fecha: {
                gte: fechaInicioCuenta,
                lt: fechaDesdeReal,
              },
            },
            select: {
              tipo: true,
              valor: true,
            },
          })
        : Promise.resolve([]),

      tienePeriodoAnterior
        ? prisma.lPTrabajoDiario.findMany({
            where: {
              unidad: {
                clienteId,
              },
              fecha: {
                gte: fechaInicioCuenta,
                lt: fechaDesdeReal,
              },
            },
            select: {
              precio: true,
            },
          })
        : Promise.resolve([]),
    ]);

    /*
     * Saldo anterior al rango seleccionado.
     */
    const saldoMovimientosAnteriores =
      movimientosAnteriores.reduce(
        (total, movimiento) => {
          const valor = Number(
            movimiento.valor || 0
          );

          const naturaleza =
            obtenerNaturalezaMovimiento(
              movimiento.tipo
            );

          return naturaleza === "CREDITO"
            ? total + valor
            : total - valor;
        },
        0
      );

    const totalTrabajosAnteriores =
      trabajosAnteriores.reduce(
        (total, trabajo) =>
          total +
          Number(trabajo.precio || 0),
        0
      );

    const saldoInicial =
      saldoMovimientosAnteriores -
      totalTrabajosAnteriores;

    /*
     * Movimientos manuales normalizados.
     */
    const movimientosManualesNormalizados =
      movimientosPeriodo.map((movimiento) => {
        const valor = Number(
          movimiento.valor || 0
        );

        const naturaleza =
          obtenerNaturalezaMovimiento(
            movimiento.tipo
          );

        const esCredito =
          naturaleza === "CREDITO";

        return {
          id: `movimiento-${movimiento.id}`,
          referenciaId: movimiento.id,

          fecha: fechaKey(movimiento.fecha) || "",
          fechaOrden: movimiento.fecha.getTime(),

          /*
           * En una misma fecha:
           * 0 = créditos
           * 1 = trabajos
           * 2 = débitos manuales
           */
          prioridadOrden: esCredito ? 0 : 2,

          origen: "MOVIMIENTO" as const,
          tipo: movimiento.tipo,
          naturaleza,

          concepto:
            movimiento.concepto ||
            descripcionTipoMovimiento(
              movimiento.tipo
            ),

          descripcion:
            descripcionTipoMovimiento(
              movimiento.tipo
            ),

          cliente: cliente.nombre,
          edificio: null,
          unidad: null,
          tipoUnidad: null,
          tipoTrabajo: null,

          credito: esCredito ? valor : 0,
          debito: esCredito ? 0 : valor,

          referencia:
            movimiento.referencia || null,

          notas: movimiento.notas || null,

          createdAt:
            movimiento.createdAt.getTime(),
        };
      });

    /*
     * Trabajos normalizados.
     *
     * Este detalle después servirá para mostrar todos
     * los trabajos realizados dentro de cada ciclo.
     */
    const trabajosNormalizados =
      trabajosPeriodo.map((trabajo) => {
        const habitaciones =
          trabajo.unidad?.habitaciones;

        const banos =
          trabajo.unidad?.banos;

        const tipoUnidad =
          habitaciones !== null &&
          habitaciones !== undefined &&
          banos !== null &&
          banos !== undefined
            ? `${habitaciones}/${banos}`
            : null;

        const precio = Number(
          trabajo.precio || 0
        );

        return {
          id: `trabajo-${trabajo.id}`,
          referenciaId: trabajo.id,

          fecha: fechaKey(trabajo.fecha) || "",
          fechaOrden: trabajo.fecha.getTime(),
          prioridadOrden: 1,

          origen: "TRABAJO" as const,
          tipo: trabajo.tipo,
          naturaleza: "DEBITO" as const,

          concepto: "Cleaning service",
          descripcion: "Servicio de limpieza",

          cliente: cliente.nombre,

          edificio:
            trabajo.unidad?.edificio?.nombre ||
            "Sin edificio",

          unidad:
            trabajo.unidad?.nombre ||
            trabajo.unidadManual ||
            "Unidad eventual",

          tipoUnidad,
          tipoTrabajo: trabajo.tipo,

          credito: 0,
          debito: precio,

          referencia: null,
          notas: trabajo.notas || null,

          createdAt:
            trabajo.createdAt.getTime(),
        };
      });

    /*
     * Unificamos trabajos y movimientos.
     */
    const movimientosOrdenados = [
      ...movimientosManualesNormalizados,
      ...trabajosNormalizados,
    ].sort((a, b) => {
      if (
        a.fechaOrden !== b.fechaOrden
      ) {
        return (
          a.fechaOrden - b.fechaOrden
        );
      }

      if (
        a.prioridadOrden !==
        b.prioridadOrden
      ) {
        return (
          a.prioridadOrden -
          b.prioridadOrden
        );
      }

      return a.createdAt - b.createdAt;
    });

    /*
     * Calculamos el saldo acumulado.
     */
    let saldoAcumulado = saldoInicial;

    const movimientos =
      movimientosOrdenados.map(
        (movimiento) => {
          saldoAcumulado +=
            movimiento.credito;

          saldoAcumulado -=
            movimiento.debito;

          const {
            fechaOrden,
            prioridadOrden,
            createdAt,
            ...movimientoPublico
          } = movimiento;

          return {
            ...movimientoPublico,
            saldo: saldoAcumulado,
          };
        }
      );

    /*
     * Resumen de movimientos manuales.
     */
    const resumenMovimientos =
      movimientosPeriodo.reduce(
        (resumen, movimiento) => {
          const valor = Number(
            movimiento.valor || 0
          );

          switch (movimiento.tipo) {
            case LPMovimientoClienteTipo.ABONO:
              resumen.abonos += valor;
              resumen.creditos += valor;
              break;

            case LPMovimientoClienteTipo.AJUSTE_CREDITO:
              resumen.ajustesCredito +=
                valor;

              resumen.creditos += valor;
              break;

            case LPMovimientoClienteTipo.AJUSTE_DEBITO:
              resumen.ajustesDebito += valor;
              resumen.debitosManuales +=
                valor;
              break;

            case LPMovimientoClienteTipo.DEVOLUCION:
              resumen.devoluciones += valor;
              resumen.debitosManuales +=
                valor;
              break;
          }

          return resumen;
        },
        {
          abonos: 0,
          ajustesCredito: 0,
          ajustesDebito: 0,
          devoluciones: 0,
          creditos: 0,
          debitosManuales: 0,
        }
      );

    const totalTrabajos =
      trabajosPeriodo.reduce(
        (total, trabajo) =>
          total +
          Number(trabajo.precio || 0),
        0
      );

    const totalDebitos =
      totalTrabajos +
      resumenMovimientos.debitosManuales;

    const saldoFinal =
      saldoInicial +
      resumenMovimientos.creditos -
      totalDebitos;

    return NextResponse.json({
      status: "success",

      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        fechaInicioCuenta:
          fechaKey(fechaInicioCuenta),
      },

      filtros: {
        desde,
        hasta,
        fechaDesdeReal:
          fechaKey(fechaDesdeReal),
      },

      resumen: {
        saldoInicial,

        totalAbonos:
          resumenMovimientos.abonos,

        totalAjustesCredito:
          resumenMovimientos.ajustesCredito,

        totalTrabajos,
        cantidadTrabajos:
          trabajosPeriodo.length,

        totalAjustesDebito:
          resumenMovimientos.ajustesDebito,

        totalDevoluciones:
          resumenMovimientos.devoluciones,

        totalCreditos:
          resumenMovimientos.creditos,

        totalDebitos,
        saldoFinal,

        saldoPendiente:
          saldoFinal < 0
            ? Math.abs(saldoFinal)
            : 0,

        saldoAFavor:
          saldoFinal > 0
            ? saldoFinal
            : 0,
      },

      movimientos,
    });
  } catch (error) {
    console.error(
      "Error generando estado de cuenta del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al generar el estado de cuenta del cliente.",
      },
      { status: 500 }
    );
  }
}