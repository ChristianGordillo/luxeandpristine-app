import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

function fechaKey(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toISOString().split("T")[0];
}

function inicioDelDia(fecha: Date) {
  const fechaNormalizada = new Date(fecha);

  fechaNormalizada.setUTCHours(0, 0, 0, 0);

  return fechaNormalizada;
}

function finDelDia(fecha: Date) {
  const fechaNormalizada = new Date(fecha);

  fechaNormalizada.setUTCHours(23, 59, 59, 999);

  return fechaNormalizada;
}

function sumarValores(
  items: Array<{
    valor: unknown;
  }>
) {
  return items.reduce(
    (total, item) =>
      total + Number(item.valor || 0),
    0
  );
}

function sumarAplicaciones(
  aplicaciones: Array<{
    valorAplicado: unknown;
  }>
) {
  return aplicaciones.reduce(
    (total, aplicacion) =>
      total +
      Number(aplicacion.valorAplicado || 0),
    0
  );
}

export async function GET() {
  try {
    const clientes =
      await prisma.lPCliente.findMany({
        where: {
          activo: true,
        },

        select: {
          id: true,
          nombre: true,

          usaSaldoAnticipado: true,
          fechaInicioSaldo: true,

          unidades: {
            select: {
              trabajos: {
                select: {
                  id: true,
                  fecha: true,
                  precio: true,
                },

                orderBy: [
                  {
                    fecha: "asc",
                  },
                  {
                    id: "asc",
                  },
                ],
              },
            },
          },

          movimientosFinancieros: {
            select: {
              id: true,
              fecha: true,
              tipo: true,
              valor: true,

              aplicacionesPago: {
                select: {
                  valorAplicado: true,
                },
              },
            },

            orderBy: [
              {
                fecha: "asc",
              },
              {
                id: "asc",
              },
            ],
          },

          ciclosFinancieros: {
            select: {
              id: true,
              tipo: true,
              fechaInicio: true,
              fechaFin: true,

              aplicacionesPago: {
                select: {
                  valorAplicado: true,
                },
              },
            },

            orderBy: [
              {
                fechaInicio: "asc",
              },
              {
                id: "asc",
              },
            ],
          },
        },

        orderBy: {
          nombre: "asc",
        },
      });

    const clientesConEstado =
      await Promise.all(
        clientes.map(async (cliente) => {
          /*
           * Todos los trabajos históricos del cliente.
           */
          const trabajosHistoricos =
            cliente.unidades
              .flatMap(
                (unidad) => unidad.trabajos
              )
              .sort((a, b) => {
                const diferenciaFecha =
                  a.fecha.getTime() -
                  b.fecha.getTime();

                if (diferenciaFecha !== 0) {
                  return diferenciaFecha;
                }

                return a.id - b.id;
              });

          /*
           * Si el cliente usa saldo anticipado,
           * únicamente descontamos trabajos realizados
           * desde fechaInicioSaldo.
           *
           * Para clientes normales se incluyen todos
           * los trabajos registrados.
           */
          const fechaInicioCuenta =
            cliente.usaSaldoAnticipado &&
            cliente.fechaInicioSaldo
              ? inicioDelDia(
                  cliente.fechaInicioSaldo
                )
              : null;

          const trabajosCuenta =
            fechaInicioCuenta
              ? trabajosHistoricos.filter(
                  (trabajo) =>
                    trabajo.fecha.getTime() >=
                    fechaInicioCuenta.getTime()
                )
              : trabajosHistoricos;

          const primerTrabajoHistorico =
            trabajosHistoricos[0] || null;

          const ultimoTrabajoHistorico =
            trabajosHistoricos.length > 0
              ? trabajosHistoricos[
                  trabajosHistoricos.length - 1
                ]
              : null;

          const primerTrabajoCuenta =
            trabajosCuenta[0] || null;

          const ultimoTrabajoCuenta =
            trabajosCuenta.length > 0
              ? trabajosCuenta[
                  trabajosCuenta.length - 1
                ]
              : null;

          const totalTrabajosHistoricos =
            trabajosHistoricos.reduce(
              (total, trabajo) =>
                total +
                Number(trabajo.precio || 0),
              0
            );

          const totalTrabajos =
            trabajosCuenta.reduce(
              (total, trabajo) =>
                total +
                Number(trabajo.precio || 0),
              0
            );

          const abonos =
            cliente.movimientosFinancieros.filter(
              (movimiento) =>
                movimiento.tipo ===
                LPMovimientoClienteTipo.ABONO
            );

          const ajustesCredito =
            cliente.movimientosFinancieros.filter(
              (movimiento) =>
                movimiento.tipo ===
                LPMovimientoClienteTipo.AJUSTE_CREDITO
            );

          const ajustesDebito =
            cliente.movimientosFinancieros.filter(
              (movimiento) =>
                movimiento.tipo ===
                LPMovimientoClienteTipo.AJUSTE_DEBITO
            );

          const devoluciones =
            cliente.movimientosFinancieros.filter(
              (movimiento) =>
                movimiento.tipo ===
                LPMovimientoClienteTipo.DEVOLUCION
            );

          const totalPagos =
            sumarValores(abonos);

          const totalAjustesCredito =
            sumarValores(ajustesCredito);

          const totalAjustesDebito =
            sumarValores(ajustesDebito);

          const totalDevoluciones =
            sumarValores(devoluciones);

          const totalCreditos =
            totalPagos +
            totalAjustesCredito;

          /*
           * En modalidad anticipada:
           *
           * solo los servicios desde fechaInicioSaldo
           * consumen el anticipo.
           *
           * En modalidad normal:
           *
           * se consideran todos los trabajos.
           */
          const totalDebitos =
            totalTrabajos +
            totalAjustesDebito +
            totalDevoluciones;

          /*
           * Saldo contable:
           *
           * positivo = dinero disponible o a favor
           * cero     = cuenta conciliada
           * negativo = dinero pendiente para L&P
           */
          const saldoCuenta =
            totalCreditos - totalDebitos;

          const saldoPendiente =
            saldoCuenta < 0
              ? Math.abs(saldoCuenta)
              : 0;

          const saldoAFavor =
            saldoCuenta > 0
              ? saldoCuenta
              : 0;

          /*
           * Aplicaciones manuales a ciclos.
           *
           * Solo se usan operativamente para clientes
           * que trabajan bajo conciliación por ciclos.
           */
          const totalPagosAplicadosCiclos =
            abonos.reduce(
              (total, movimiento) =>
                total +
                sumarAplicaciones(
                  movimiento.aplicacionesPago
                ),
              0
            );

          /*
           * Para saldo anticipado, el dinero aplicado es
           * el valor ya consumido por trabajos y débitos.
           *
           * Nunca puede superar el total de pagos
           * recibidos.
           */
          const totalConsumidoAnticipo =
            Math.min(
              totalPagos,
              Math.max(
                0,
                totalTrabajos +
                  totalAjustesDebito +
                  totalDevoluciones -
                  totalAjustesCredito
              )
            );

          const totalPagosAplicados =
            cliente.usaSaldoAnticipado
              ? totalConsumidoAnticipo
              : totalPagosAplicadosCiclos;

          /*
           * En cuenta normal:
           * pagos todavía no aplicados a ciclos.
           *
           * En saldo anticipado:
           * dinero que continúa disponible.
           */
          const pagosSinAplicar =
            cliente.usaSaldoAnticipado
              ? Math.max(
                  0,
                  totalPagos -
                    totalConsumidoAnticipo
                )
              : Math.max(
                  0,
                  totalPagos -
                    totalPagosAplicadosCiclos
                );

          /*
           * Ciclos financieros.
           *
           * Se mantienen para clientes con cuenta
           * corriente. En clientes con saldo anticipado
           * no afectan el cálculo del saldo disponible.
           */
          const ciclosCalculados =
            await Promise.all(
              cliente.ciclosFinancieros.map(
                async (ciclo) => {
                  const trabajosCiclo =
                    await prisma.lPTrabajoDiario.findMany({
                      where: {
                        unidad: {
                          clienteId:
                            cliente.id,
                        },

                        fecha: {
                          gte: inicioDelDia(
                            ciclo.fechaInicio
                          ),

                          lte: finDelDia(
                            ciclo.fechaFin
                          ),
                        },
                      },

                      select: {
                        precio: true,
                      },
                    });

                  const totalTrabajadoCiclo =
                    trabajosCiclo.reduce(
                      (total, trabajo) =>
                        total +
                        Number(
                          trabajo.precio || 0
                        ),
                      0
                    );

                  const totalAplicadoCiclo =
                    sumarAplicaciones(
                      ciclo.aplicacionesPago
                    );

                  const diferencia =
                    totalAplicadoCiclo -
                    totalTrabajadoCiclo;

                  let estado:
                    | "SIN_MOVIMIENTOS"
                    | "SIN_PAGO"
                    | "PAGO_PARCIAL"
                    | "CONCILIADO"
                    | "SALDO_A_FAVOR";

                  if (
                    totalTrabajadoCiclo === 0 &&
                    totalAplicadoCiclo === 0
                  ) {
                    estado =
                      "SIN_MOVIMIENTOS";
                  } else if (
                    diferencia === 0
                  ) {
                    estado = "CONCILIADO";
                  } else if (
                    totalAplicadoCiclo === 0
                  ) {
                    estado = "SIN_PAGO";
                  } else if (
                    diferencia < 0
                  ) {
                    estado =
                      "PAGO_PARCIAL";
                  } else {
                    estado =
                      "SALDO_A_FAVOR";
                  }

                  return {
                    id: ciclo.id,
                    tipo: ciclo.tipo,

                    fechaInicio: fechaKey(
                      ciclo.fechaInicio
                    ),

                    fechaFin: fechaKey(
                      ciclo.fechaFin
                    ),

                    totalTrabajado:
                      totalTrabajadoCiclo,

                    totalAplicado:
                      totalAplicadoCiclo,

                    saldoPendiente:
                      diferencia < 0
                        ? Math.abs(
                            diferencia
                          )
                        : 0,

                    saldoAFavor:
                      diferencia > 0
                        ? diferencia
                        : 0,

                    estado,
                  };
                }
              )
            );

          const ciclosConciliados =
            ciclosCalculados.filter(
              (ciclo) =>
                ciclo.estado ===
                "CONCILIADO"
            ).length;

          const ciclosPendientes =
            ciclosCalculados.filter(
              (ciclo) =>
                ciclo.estado !==
                "CONCILIADO" &&
                ciclo.estado !==
                "SIN_MOVIMIENTOS"
            ).length;

          const ultimoCiclo =
            ciclosCalculados.length > 0
              ? ciclosCalculados[
                  ciclosCalculados.length -
                    1
                ]
              : null;

          let estadoCuenta:
            | "SIN_MOVIMIENTOS"
            | "CONCILIADO"
            | "PENDIENTE"
            | "SALDO_A_FAVOR";

          if (
            trabajosCuenta.length === 0 &&
            cliente
              .movimientosFinancieros
              .length === 0
          ) {
            estadoCuenta =
              "SIN_MOVIMIENTOS";
          } else if (saldoCuenta < 0) {
            estadoCuenta = "PENDIENTE";
          } else if (saldoCuenta > 0) {
            estadoCuenta =
              "SALDO_A_FAVOR";
          } else {
            estadoCuenta = "CONCILIADO";
          }

          return {
            id: cliente.id,
            nombre: cliente.nombre,

            modalidadCuenta:
              cliente.usaSaldoAnticipado
                ? "SALDO_ANTICIPADO"
                : "CICLOS",

            usaSaldoAnticipado:
              cliente.usaSaldoAnticipado,

            fechaInicioSaldo: fechaKey(
              cliente.fechaInicioSaldo
            ),

            /*
             * Fechas dentro del período que afecta
             * el estado de cuenta.
             */
            fechaPrimerTrabajo: fechaKey(
              primerTrabajoCuenta?.fecha ||
                null
            ),

            fechaUltimoTrabajo: fechaKey(
              ultimoTrabajoCuenta?.fecha ||
                null
            ),

            /*
             * Información histórica adicional.
             */
            fechaPrimerTrabajoHistorico:
              fechaKey(
                primerTrabajoHistorico?.fecha ||
                  null
              ),

            fechaUltimoTrabajoHistorico:
              fechaKey(
                ultimoTrabajoHistorico?.fecha ||
                  null
              ),

            totalTrabajosHistoricos,
            cantidadTrabajosHistoricos:
              trabajosHistoricos.length,

            /*
             * Estos son los trabajos que realmente
             * afectan el saldo actual.
             */
            totalTrabajos,
            cantidadTrabajos:
              trabajosCuenta.length,

            totalPagos,
            totalAnticipos: totalPagos,

            totalAjustesCredito,
            totalAjustesDebito,
            totalDevoluciones,

            totalCreditos,
            totalDebitos,

            saldoCuenta,
            saldoPendiente,
            saldoAFavor,

            /*
             * Campos específicos de anticipo.
             */
            totalServiciosDescontados:
              cliente.usaSaldoAnticipado
                ? totalTrabajos
                : 0,

            saldoDisponible:
              cliente.usaSaldoAnticipado
                ? saldoAFavor
                : 0,

            totalPagosAplicados,
            pagosSinAplicar,

            cantidadCiclos:
              ciclosCalculados.length,

            ciclosConciliados,
            ciclosPendientes,

            ultimoCiclo,
            estadoCuenta,
          };
        })
      );

    const resumenGeneral =
      clientesConEstado.reduce(
        (resumen, cliente) => {
          /*
           * En clientes anticipados solo se suma lo
           * trabajado desde fechaInicioSaldo.
           */
          resumen.totalFacturado +=
            cliente.totalTrabajos;

          resumen.totalFacturadoHistorico +=
            cliente.totalTrabajosHistoricos;

          resumen.totalRecibido +=
            cliente.totalPagos;

          resumen.totalPendiente +=
            cliente.saldoPendiente;

          resumen.totalSaldoAFavor +=
            cliente.saldoAFavor;

          resumen.totalPagosSinAplicar +=
            cliente.pagosSinAplicar;

          if (
            cliente.usaSaldoAnticipado
          ) {
            resumen.clientesConAnticipo +=
              1;

            resumen.totalAnticipos +=
              cliente.totalAnticipos;

            resumen.totalServiciosDescontados +=
              cliente.totalServiciosDescontados;

            resumen.totalSaldoDisponible +=
              cliente.saldoDisponible;
          }

          if (
            cliente.estadoCuenta ===
            "PENDIENTE"
          ) {
            resumen.clientesPendientes +=
              1;
          }

          if (
            cliente.estadoCuenta ===
            "SALDO_A_FAVOR"
          ) {
            resumen.clientesConSaldoAFavor +=
              1;
          }

          return resumen;
        },
        {
          totalFacturado: 0,
          totalFacturadoHistorico: 0,
          totalRecibido: 0,
          totalPendiente: 0,
          totalSaldoAFavor: 0,
          totalPagosSinAplicar: 0,

          clientesPendientes: 0,
          clientesConSaldoAFavor: 0,

          clientesConAnticipo: 0,
          totalAnticipos: 0,
          totalServiciosDescontados: 0,
          totalSaldoDisponible: 0,
        }
      );

    return NextResponse.json({
      status: "success",
      resumen: resumenGeneral,
      clientes: clientesConEstado,
    });
  } catch (error) {
    console.error(
      "Error consultando cuentas de clientes:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al consultar las cuentas de clientes.",
      },
      {
        status: 500,
      }
    );
  }
}