import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

function crearInicioDia(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function crearFinDia(fecha: string) {
  return new Date(`${fecha}T23:59:59.999Z`);
}

function normalizarInicioDia(fecha: Date) {
  const resultado = new Date(fecha);

  resultado.setUTCHours(0, 0, 0, 0);

  return resultado;
}

function fechaKey(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toISOString().split("T")[0];
}

function obtenerFechaMayor(
  fechaA: Date,
  fechaB: Date
) {
  return fechaA.getTime() >= fechaB.getTime()
    ? fechaA
    : fechaB;
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

function resumenVacio() {
  return {
    saldoInicial: 0,

    totalAbonos: 0,
    totalAnticipos: 0,

    totalAjustesCredito: 0,

    totalTrabajos: 0,
    totalServiciosDescontados: 0,
    cantidadTrabajos: 0,

    totalAjustesDebito: 0,
    totalDevoluciones: 0,

    totalCreditos: 0,
    totalDebitos: 0,

    saldoFinal: 0,
    saldoPendiente: 0,
    saldoAFavor: 0,
    saldoDisponible: 0,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(
      request.url
    );

    const clienteIdParam =
      searchParams.get("clienteId");

    const desde =
      searchParams.get("desde");

    const hasta =
      searchParams.get("hasta");

    const clienteId = Number(
      clienteIdParam
    );

    if (
      !clienteIdParam ||
      !Number.isInteger(clienteId) ||
      clienteId <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes enviar un clienteId válido.",
        },
        { status: 400 }
      );
    }

    if (
      desde &&
      hasta &&
      desde > hasta
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha inicial no puede ser posterior a la fecha final.",
        },
        { status: 400 }
      );
    }

    const cliente =
      await prisma.lPCliente.findUnique({
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
          message:
            "El cliente seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    if (
      cliente.usaSaldoAnticipado &&
      !cliente.fechaInicioSaldo
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El cliente usa saldo anticipado, pero no tiene una fecha de inicio configurada.",
        },
        { status: 409 }
      );
    }

    const modalidadCuenta =
      cliente.usaSaldoAnticipado
        ? "SALDO_ANTICIPADO"
        : "CICLOS";

    const [
      primerTrabajo,
      primerMovimiento,
    ] = await Promise.all([
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

    const fechaInicioSaldo =
      cliente.fechaInicioSaldo
        ? normalizarInicioDia(
            cliente.fechaInicioSaldo
          )
        : null;

    /*
     * Inicio general del estado de cuenta.
     *
     * Cliente anticipado:
     * puede comenzar con un anticipo recibido antes
     * de la fecha en que empiezan a descontarse servicios.
     *
     * Anna:
     * primer movimiento = 14 de julio
     * inicio de descuentos = 16 de julio
     * inicio del estado = 14 de julio
     */
    let fechaInicioCuenta: Date | null = null;

    if (cliente.usaSaldoAnticipado) {
      const fechas = [
        primerMovimiento?.fecha,
        fechaInicioSaldo,
      ].filter(
        (fecha): fecha is Date =>
          Boolean(fecha)
      );

      fechaInicioCuenta =
        fechas.length > 0
          ? new Date(
              Math.min(
                ...fechas.map(
                  (fecha) =>
                    fecha.getTime()
                )
              )
            )
          : null;
    } else {
      const fechas = [
        primerTrabajo?.fecha,
        primerMovimiento?.fecha,
      ].filter(
        (fecha): fecha is Date =>
          Boolean(fecha)
      );

      fechaInicioCuenta =
        fechas.length > 0
          ? new Date(
              Math.min(
                ...fechas.map(
                  (fecha) =>
                    fecha.getTime()
                )
              )
            )
          : null;
    }

    if (!fechaInicioCuenta) {
      return NextResponse.json({
        status: "success",

        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,

          modalidadCuenta,

          usaSaldoAnticipado:
            cliente.usaSaldoAnticipado,

          fechaInicioSaldo:
            fechaKey(
              cliente.fechaInicioSaldo
            ),

          fechaInicioCuenta: null,
        },

        filtros: {
          desde,
          hasta,
          fechaDesdeReal: null,
        },

        resumen: resumenVacio(),

        movimientos: [],
      });
    }

    const fechaDesdeFiltro = desde
      ? crearInicioDia(desde)
      : null;

    const fechaHasta = hasta
      ? crearFinDia(hasta)
      : null;

    const fechaDesdeReal =
      fechaDesdeFiltro &&
      fechaDesdeFiltro.getTime() >
        fechaInicioCuenta.getTime()
        ? fechaDesdeFiltro
        : fechaInicioCuenta;

    /*
     * Los trabajos de un cliente anticipado nunca
     * pueden comenzar antes de fechaInicioSaldo.
     *
     * Los movimientos financieros sí pueden ser
     * anteriores, como el anticipo de Anna.
     */
    const fechaDesdeTrabajos =
      cliente.usaSaldoAnticipado &&
      fechaInicioSaldo
        ? obtenerFechaMayor(
            fechaDesdeReal,
            fechaInicioSaldo
          )
        : fechaDesdeReal;

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

          modalidadCuenta,

          usaSaldoAnticipado:
            cliente.usaSaldoAnticipado,

          fechaInicioSaldo:
            fechaKey(
              cliente.fechaInicioSaldo
            ),

          fechaInicioCuenta:
            fechaKey(
              fechaInicioCuenta
            ),
        },

        filtros: {
          desde,
          hasta,

          fechaDesdeReal:
            fechaKey(
              fechaDesdeReal
            ),
        },

        resumen: resumenVacio(),

        movimientos: [],
      });
    }

    const tienePeriodoAnterior =
      fechaDesdeReal.getTime() >
      fechaInicioCuenta.getTime();

    /*
     * Para calcular trabajos anteriores al filtro,
     * debemos comenzar desde:
     *
     * - fechaInicioSaldo para clientes anticipados;
     * - fechaInicioCuenta para clientes normales.
     */
    const fechaBaseTrabajos =
      cliente.usaSaldoAnticipado &&
      fechaInicioSaldo
        ? fechaInicioSaldo
        : fechaInicioCuenta;

    const tieneTrabajosAnteriores =
      fechaDesdeTrabajos.getTime() >
      fechaBaseTrabajos.getTime();

    const [
      movimientosPeriodo,
      trabajosPeriodo,
      movimientosAnteriores,
      trabajosAnteriores,
    ] = await Promise.all([
      /*
       * Movimientos del período.
       *
       * En Anna esto sí incluye el anticipo del día 14
       * cuando no hay filtro desde.
       */
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
          {
            id: "asc",
          },
        ],
      }),

      /*
       * Trabajos del período.
       *
       * En saldo anticipado comienzan estrictamente
       * desde fechaInicioSaldo.
       */
      fechaHasta &&
      fechaHasta.getTime() <
        fechaDesdeTrabajos.getTime()
        ? Promise.resolve([])
        : prisma.lPTrabajoDiario.findMany({
            where: {
              unidad: {
                clienteId,
              },

              fecha: {
                gte: fechaDesdeTrabajos,

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
              {
                id: "asc",
              },
            ],
          }),

      /*
       * Créditos y débitos manuales anteriores al
       * filtro seleccionado.
       */
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

      /*
       * Trabajos anteriores al filtro, pero nunca
       * anteriores a fechaInicioSaldo cuando existe
       * saldo anticipado.
       */
      tieneTrabajosAnteriores
        ? prisma.lPTrabajoDiario.findMany({
            where: {
              unidad: {
                clienteId,
              },

              fecha: {
                gte: fechaBaseTrabajos,
                lt: fechaDesdeTrabajos,
              },
            },

            select: {
              precio: true,
            },
          })
        : Promise.resolve([]),
    ]);

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
          Number(
            trabajo.precio || 0
          ),
        0
      );

    const saldoInicial =
      saldoMovimientosAnteriores -
      totalTrabajosAnteriores;

    const movimientosManualesNormalizados =
      movimientosPeriodo.map(
        (movimiento) => {
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
            id:
              `movimiento-${movimiento.id}`,

            referenciaId:
              movimiento.id,

            fecha:
              fechaKey(
                movimiento.fecha
              ) || "",

            fechaOrden:
              movimiento.fecha.getTime(),

            prioridadOrden:
              esCredito ? 0 : 2,

            origen:
              "MOVIMIENTO" as const,

            tipo:
              movimiento.tipo,

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

            cliente:
              cliente.nombre,

            edificio: null,
            unidad: null,
            tipoUnidad: null,
            tipoTrabajo: null,

            credito:
              esCredito ? valor : 0,

            debito:
              esCredito ? 0 : valor,

            referencia:
              movimiento.referencia ||
              null,

            notas:
              movimiento.notas ||
              null,

            createdAt:
              movimiento.createdAt.getTime(),
          };
        }
      );

    const trabajosNormalizados =
      trabajosPeriodo.map(
        (trabajo) => {
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
            id:
              `trabajo-${trabajo.id}`,

            referenciaId:
              trabajo.id,

            fecha:
              fechaKey(
                trabajo.fecha
              ) || "",

            fechaOrden:
              trabajo.fecha.getTime(),

            prioridadOrden: 1,

            origen:
              "TRABAJO" as const,

            tipo:
              trabajo.tipo,

            naturaleza:
              "DEBITO" as const,

            concepto:
              cliente.usaSaldoAnticipado
                ? "Servicio descontado del anticipo"
                : "Cleaning service",

            descripcion:
              "Servicio de limpieza",

            cliente:
              cliente.nombre,

            edificio:
              trabajo.unidad?.edificio
                ?.nombre ||
              "Sin edificio",

            unidad:
              trabajo.unidad?.nombre ||
              trabajo.unidadManual ||
              "Unidad eventual",

            tipoUnidad,

            tipoTrabajo:
              trabajo.tipo,

            credito: 0,
            debito: precio,

            referencia: null,

            notas:
              trabajo.notas ||
              null,

            createdAt:
              trabajo.createdAt.getTime(),
          };
        }
      );

    const movimientosOrdenados = [
      ...movimientosManualesNormalizados,
      ...trabajosNormalizados,
    ].sort((a, b) => {
      if (
        a.fechaOrden !==
        b.fechaOrden
      ) {
        return (
          a.fechaOrden -
          b.fechaOrden
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

      return (
        a.createdAt -
        b.createdAt
      );
    });

    let saldoAcumulado =
      saldoInicial;

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
            saldo:
              saldoAcumulado,
          };
        }
      );

    const resumenMovimientos =
      movimientosPeriodo.reduce(
        (resumen, movimiento) => {
          const valor = Number(
            movimiento.valor || 0
          );

          switch (
            movimiento.tipo
          ) {
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
              resumen.ajustesDebito +=
                valor;

              resumen.debitosManuales +=
                valor;
              break;

            case LPMovimientoClienteTipo.DEVOLUCION:
              resumen.devoluciones +=
                valor;

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
          Number(
            trabajo.precio || 0
          ),
        0
      );

    const totalDebitos =
      totalTrabajos +
      resumenMovimientos
        .debitosManuales;

    const saldoFinal =
      saldoInicial +
      resumenMovimientos.creditos -
      totalDebitos;

    const saldoPendiente =
      saldoFinal < 0
        ? Math.abs(saldoFinal)
        : 0;

    const saldoAFavor =
      saldoFinal > 0
        ? saldoFinal
        : 0;

    return NextResponse.json({
      status: "success",

      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,

        modalidadCuenta,

        usaSaldoAnticipado:
          cliente.usaSaldoAnticipado,

        fechaInicioSaldo:
          fechaKey(
            cliente.fechaInicioSaldo
          ),

        fechaInicioCuenta:
          fechaKey(
            fechaInicioCuenta
          ),
      },

      filtros: {
        desde,
        hasta,

        fechaDesdeReal:
          fechaKey(
            fechaDesdeReal
          ),

        fechaDesdeTrabajos:
          fechaKey(
            fechaDesdeTrabajos
          ),
      },

      resumen: {
        saldoInicial,

        totalAbonos:
          resumenMovimientos.abonos,

        totalAnticipos:
          cliente.usaSaldoAnticipado
            ? resumenMovimientos.abonos
            : 0,

        totalAjustesCredito:
          resumenMovimientos
            .ajustesCredito,

        totalTrabajos,

        totalServiciosDescontados:
          cliente.usaSaldoAnticipado
            ? totalTrabajos
            : 0,

        cantidadTrabajos:
          trabajosPeriodo.length,

        totalAjustesDebito:
          resumenMovimientos
            .ajustesDebito,

        totalDevoluciones:
          resumenMovimientos
            .devoluciones,

        totalCreditos:
          resumenMovimientos.creditos,

        totalDebitos,

        saldoFinal,
        saldoPendiente,
        saldoAFavor,

        saldoDisponible:
          cliente.usaSaldoAnticipado
            ? saldoAFavor
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