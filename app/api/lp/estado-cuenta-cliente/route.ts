import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

function crearInicioDia(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function crearFinDia(fecha: string) {
  return new Date(`${fecha}T23:59:59.999Z`);
}

function fechaKey(fecha: Date) {
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

function descripcionTipoMovimiento(tipo: LPMovimientoClienteTipo) {
  switch (tipo) {
    case LPMovimientoClienteTipo.ABONO:
      return "Abono recibido";

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

    const fechaDesdeFiltro = desde ? crearInicioDia(desde) : null;
    const fechaHasta = hasta ? crearFinDia(hasta) : null;

    const cliente = await prisma.lPCliente.findUnique({
      where: {
        id: clienteId,
      },
      select: {
        id: true,
        nombre: true,
        usaSaldoAnticipado: true,
        fechaInicioSaldo: true,
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
     * Si el cliente todavía no usa saldo anticipado,
     * devolvemos una respuesta válida sin movimientos.
     */
    if (!cliente.usaSaldoAnticipado) {
      return NextResponse.json({
        status: "success",

        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          usaSaldoAnticipado: false,
          fechaInicioSaldo: null,
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
        },

        movimientos: [],
        configuracionPendiente: true,

        message:
          "Este cliente todavía no está configurado para trabajar con saldo anticipado.",
      });
    }

    if (!cliente.fechaInicioSaldo) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El cliente usa saldo anticipado, pero no tiene fecha de inicio configurada.",
        },
        { status: 400 }
      );
    }

    /*
     * Después de esta validación, TypeScript ya sabe que
     * fechaInicioSaldo es un Date.
     */
    const fechaInicioAcuerdo: Date = cliente.fechaInicioSaldo;

    /*
     * La fecha real será la más reciente entre:
     *
     * - fechaInicioSaldo
     * - filtro desde
     */
    const fechaDesdeReal: Date =
      fechaDesdeFiltro &&
      fechaDesdeFiltro.getTime() > fechaInicioAcuerdo.getTime()
        ? fechaDesdeFiltro
        : fechaInicioAcuerdo;

    /*
     * Si el rango termina antes de que comience el acuerdo,
     * devolvemos una respuesta vacía.
     */
    if (
      fechaHasta &&
      fechaDesdeReal.getTime() > fechaHasta.getTime()
    ) {
      return NextResponse.json({
        status: "success",

        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          usaSaldoAnticipado: true,
          fechaInicioSaldo: fechaKey(fechaInicioAcuerdo),
        },

        filtros: {
          desde,
          hasta,
          fechaDesdeReal: fechaKey(fechaDesdeReal),
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
        },

        movimientos: [],
        configuracionPendiente: false,

        message:
          "No hay movimientos porque el rango termina antes del inicio del saldo anticipado.",
      });
    }

    /*
     * Solo existe período anterior cuando el filtro desde
     * es posterior al inicio del acuerdo.
     */
    const tienePeriodoAnterior =
      fechaDesdeReal.getTime() > fechaInicioAcuerdo.getTime();

    const [
      movimientosPeriodo,
      trabajosPeriodo,
      movimientosAnteriores,
      trabajosAnteriores,
    ] = await Promise.all([
      /*
       * Movimientos manuales del período.
       */
      prisma.lPMovimientoCliente.findMany({
        where: {
          clienteId,
          fecha: {
            gte: fechaDesdeReal,
            ...(fechaHasta ? { lte: fechaHasta } : {}),
          },
        },
        orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
      }),

      /*
       * Trabajos del período.
       */
      prisma.lPTrabajoDiario.findMany({
        where: {
          unidad: {
            clienteId,
          },
          fecha: {
            gte: fechaDesdeReal,
            ...(fechaHasta ? { lte: fechaHasta } : {}),
          },
        },
        include: {
          unidad: {
            include: {
              edificio: true,
            },
          },
        },
        orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
      }),

      /*
       * Movimientos anteriores al filtro para calcular
       * el saldo inicial del rango.
       */
      tienePeriodoAnterior
        ? prisma.lPMovimientoCliente.findMany({
            where: {
              clienteId,
              fecha: {
                gte: fechaInicioAcuerdo,
                lt: fechaDesdeReal,
              },
            },
            select: {
              tipo: true,
              valor: true,
            },
          })
        : Promise.resolve([]),

      /*
       * Trabajos anteriores al filtro para calcular
       * el saldo inicial del rango.
       */
      tienePeriodoAnterior
        ? prisma.lPTrabajoDiario.findMany({
            where: {
              unidad: {
                clienteId,
              },
              fecha: {
                gte: fechaInicioAcuerdo,
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
     * SALDO ANTERIOR AL RANGO
     */

    const saldoMovimientosAnteriores = movimientosAnteriores.reduce(
      (acc, movimiento) => {
        const valor = Number(movimiento.valor || 0);
        const naturaleza = obtenerNaturalezaMovimiento(movimiento.tipo);

        return naturaleza === "CREDITO"
          ? acc + valor
          : acc - valor;
      },
      0
    );

    const totalTrabajosAnteriores = trabajosAnteriores.reduce(
      (acc, trabajo) => acc + Number(trabajo.precio || 0),
      0
    );

    const saldoInicial =
      saldoMovimientosAnteriores - totalTrabajosAnteriores;

    /*
     * NORMALIZAR MOVIMIENTOS MANUALES
     */

    const movimientosManualesNormalizados = movimientosPeriodo.map(
      (movimiento) => {
        const valor = Number(movimiento.valor || 0);
        const naturaleza = obtenerNaturalezaMovimiento(movimiento.tipo);
        const esCredito = naturaleza === "CREDITO";

        return {
          id: `movimiento-${movimiento.id}`,
          referenciaId: movimiento.id,
          fecha: fechaKey(movimiento.fecha),
          fechaOrden: movimiento.fecha.getTime(),

          /*
           * En una misma fecha:
           *
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
            descripcionTipoMovimiento(movimiento.tipo),

          descripcion: descripcionTipoMovimiento(movimiento.tipo),

          cliente: cliente.nombre,
          edificio: null,
          unidad: null,
          tipoUnidad: null,
          tipoTrabajo: null,

          credito: esCredito ? valor : 0,
          debito: esCredito ? 0 : valor,

          notas: movimiento.notas || null,
          createdAt: movimiento.createdAt.getTime(),
        };
      }
    );

    /*
     * NORMALIZAR TRABAJOS
     */

    const trabajosNormalizados = trabajosPeriodo.map((trabajo) => {
      const habitaciones = trabajo.unidad?.habitaciones;
      const banos = trabajo.unidad?.banos;

      const tipoUnidad =
        habitaciones !== null &&
        habitaciones !== undefined &&
        banos !== null &&
        banos !== undefined
          ? `${habitaciones}/${banos}`
          : null;

      const precio = Number(trabajo.precio || 0);

      return {
        id: `trabajo-${trabajo.id}`,
        referenciaId: trabajo.id,
        fecha: fechaKey(trabajo.fecha),
        fechaOrden: trabajo.fecha.getTime(),
        prioridadOrden: 1,

        origen: "TRABAJO" as const,
        tipo: trabajo.tipo,
        naturaleza: "DEBITO" as const,

        concepto: "Cleaning service",
        descripcion: "Servicio de limpieza",

        cliente: cliente.nombre,
        edificio:
          trabajo.unidad?.edificio?.nombre || "Sin edificio",

        unidad:
          trabajo.unidad?.nombre ||
          trabajo.unidadManual ||
          "Unidad eventual",

        tipoUnidad,
        tipoTrabajo: trabajo.tipo,

        credito: 0,
        debito: precio,

        notas: trabajo.notas || null,
        createdAt: trabajo.createdAt.getTime(),
      };
    });

    /*
     * UNIFICAR Y ORDENAR LOS MOVIMIENTOS
     */

    const movimientosOrdenados = [
      ...movimientosManualesNormalizados,
      ...trabajosNormalizados,
    ].sort((a, b) => {
      if (a.fechaOrden !== b.fechaOrden) {
        return a.fechaOrden - b.fechaOrden;
      }

      if (a.prioridadOrden !== b.prioridadOrden) {
        return a.prioridadOrden - b.prioridadOrden;
      }

      return a.createdAt - b.createdAt;
    });

    /*
     * CALCULAR EL SALDO ACUMULADO
     */

    let saldoAcumulado = saldoInicial;

    const movimientos = movimientosOrdenados.map((movimiento) => {
      saldoAcumulado += movimiento.credito;
      saldoAcumulado -= movimiento.debito;

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
    });

    /*
     * RESUMEN DE MOVIMIENTOS MANUALES DEL PERÍODO
     */

    const resumenMovimientos = movimientosPeriodo.reduce(
      (acc, movimiento) => {
        const valor = Number(movimiento.valor || 0);

        switch (movimiento.tipo) {
          case LPMovimientoClienteTipo.ABONO:
            acc.abonos += valor;
            acc.creditos += valor;
            break;

          case LPMovimientoClienteTipo.AJUSTE_CREDITO:
            acc.ajustesCredito += valor;
            acc.creditos += valor;
            break;

          case LPMovimientoClienteTipo.AJUSTE_DEBITO:
            acc.ajustesDebito += valor;
            acc.debitosManuales += valor;
            break;

          case LPMovimientoClienteTipo.DEVOLUCION:
            acc.devoluciones += valor;
            acc.debitosManuales += valor;
            break;
        }

        return acc;
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

    /*
     * TOTAL DE TRABAJOS DEL PERÍODO
     */

    const totalTrabajos = trabajosPeriodo.reduce(
      (acc, trabajo) =>
        acc + Number(trabajo.precio || 0),
      0
    );

    const totalDebitos =
      totalTrabajos + resumenMovimientos.debitosManuales;

    const saldoFinal =
      saldoInicial +
      resumenMovimientos.creditos -
      totalDebitos;

    return NextResponse.json({
      status: "success",

      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        usaSaldoAnticipado:
          cliente.usaSaldoAnticipado,
        fechaInicioSaldo:
          fechaKey(fechaInicioAcuerdo),
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
      },

      movimientos,
      configuracionPendiente: false,
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