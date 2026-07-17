import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

function fechaKey(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toISOString().split("T")[0];
}

function sumarValores(
  items: Array<{
    valor: unknown;
  }>
) {
  return items.reduce(
    (total, item) => total + Number(item.valor || 0),
    0
  );
}

export async function GET() {
  try {
    const clientes = await prisma.lPCliente.findMany({
      where: {
        activo: true,
      },
      select: {
        id: true,
        nombre: true,

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

    const clientesConEstado = await Promise.all(
      clientes.map(async (cliente) => {
        /*
         * Unificamos los trabajos de todas las unidades
         * pertenecientes al cliente.
         */
        const trabajos = cliente.unidades
          .flatMap((unidad) => unidad.trabajos)
          .sort((a, b) => {
            const diferenciaFecha =
              a.fecha.getTime() - b.fecha.getTime();

            if (diferenciaFecha !== 0) {
              return diferenciaFecha;
            }

            return a.id - b.id;
          });

        const primerTrabajo = trabajos[0] || null;
        const ultimoTrabajo =
          trabajos.length > 0
            ? trabajos[trabajos.length - 1]
            : null;

        const totalTrabajos = trabajos.reduce(
          (total, trabajo) =>
            total + Number(trabajo.precio || 0),
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

        const totalPagos = sumarValores(abonos);
        const totalAjustesCredito =
          sumarValores(ajustesCredito);

        const totalAjustesDebito =
          sumarValores(ajustesDebito);

        const totalDevoluciones =
          sumarValores(devoluciones);

        const totalCreditos =
          totalPagos + totalAjustesCredito;

        const totalDebitos =
          totalTrabajos +
          totalAjustesDebito +
          totalDevoluciones;

        /*
         * Saldo contable:
         *
         * positivo = dinero a favor del cliente
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
         * Solo los ABONOS representan pagos recibidos.
         *
         * La parte que todavía no esté aplicada a ciclos
         * queda disponible como anticipo o excedente.
         */
        const totalPagosAplicados = abonos.reduce(
          (total, movimiento) => {
            const aplicadoMovimiento =
              movimiento.aplicacionesPago.reduce(
                (subtotal, aplicacion) =>
                  subtotal +
                  Number(
                    aplicacion.valorAplicado || 0
                  ),
                0
              );

            return total + aplicadoMovimiento;
          },
          0
        );

        const pagosSinAplicar = Math.max(
          0,
          totalPagos - totalPagosAplicados
        );

        /*
         * Resumen de ciclos.
         *
         * El valor trabajado se consulta dinámicamente
         * porque no está almacenado en LPCicloCliente.
         */
        const ciclosCalculados = await Promise.all(
          cliente.ciclosFinancieros.map(
            async (ciclo) => {
              const trabajosCiclo =
                await prisma.lPTrabajoDiario.findMany({
                  where: {
                    unidad: {
                      clienteId: cliente.id,
                    },
                    fecha: {
                      gte: ciclo.fechaInicio,
                      lte: ciclo.fechaFin,
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
                    Number(trabajo.precio || 0),
                  0
                );

              const totalAplicadoCiclo =
                ciclo.aplicacionesPago.reduce(
                  (total, aplicacion) =>
                    total +
                    Number(
                      aplicacion.valorAplicado || 0
                    ),
                  0
                );

              const diferencia =
                totalAplicadoCiclo -
                totalTrabajadoCiclo;

              const estado =
                diferencia === 0
                  ? "CONCILIADO"
                  : totalAplicadoCiclo === 0
                    ? "SIN_PAGO"
                    : "PAGO_PARCIAL";

              return {
                id: ciclo.id,
                tipo: ciclo.tipo,
                fechaInicio: fechaKey(
                  ciclo.fechaInicio
                ),
                fechaFin: fechaKey(ciclo.fechaFin),
                totalTrabajado:
                  totalTrabajadoCiclo,
                totalAplicado:
                  totalAplicadoCiclo,
                saldoPendiente:
                  diferencia < 0
                    ? Math.abs(diferencia)
                    : 0,
                estado,
              };
            }
          )
        );

        const ciclosConciliados =
          ciclosCalculados.filter(
            (ciclo) =>
              ciclo.estado === "CONCILIADO"
          ).length;

        const ciclosPendientes =
          ciclosCalculados.filter(
            (ciclo) =>
              ciclo.estado !== "CONCILIADO"
          ).length;

        const ultimoCiclo =
          ciclosCalculados.length > 0
            ? ciclosCalculados[
                ciclosCalculados.length - 1
              ]
            : null;

        let estadoCuenta:
          | "SIN_MOVIMIENTOS"
          | "CONCILIADO"
          | "PENDIENTE"
          | "SALDO_A_FAVOR";

        if (
          trabajos.length === 0 &&
          cliente.movimientosFinancieros.length === 0
        ) {
          estadoCuenta = "SIN_MOVIMIENTOS";
        } else if (saldoCuenta < 0) {
          estadoCuenta = "PENDIENTE";
        } else if (saldoCuenta > 0) {
          estadoCuenta = "SALDO_A_FAVOR";
        } else {
          estadoCuenta = "CONCILIADO";
        }

        return {
          id: cliente.id,
          nombre: cliente.nombre,

          fechaPrimerTrabajo: fechaKey(
            primerTrabajo?.fecha || null
          ),

          fechaUltimoTrabajo: fechaKey(
            ultimoTrabajo?.fecha || null
          ),

          totalTrabajos,
          cantidadTrabajos: trabajos.length,

          totalPagos,
          totalAjustesCredito,
          totalAjustesDebito,
          totalDevoluciones,

          totalCreditos,
          totalDebitos,

          saldoCuenta,
          saldoPendiente,
          saldoAFavor,

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
          resumen.totalFacturado +=
            cliente.totalTrabajos;

          resumen.totalRecibido +=
            cliente.totalPagos;

          resumen.totalPendiente +=
            cliente.saldoPendiente;

          resumen.totalSaldoAFavor +=
            cliente.saldoAFavor;

          resumen.totalPagosSinAplicar +=
            cliente.pagosSinAplicar;

          if (
            cliente.estadoCuenta === "PENDIENTE"
          ) {
            resumen.clientesPendientes += 1;
          }

          if (
            cliente.estadoCuenta ===
            "SALDO_A_FAVOR"
          ) {
            resumen.clientesConSaldoAFavor += 1;
          }

          return resumen;
        },
        {
          totalFacturado: 0,
          totalRecibido: 0,
          totalPendiente: 0,
          totalSaldoAFavor: 0,
          totalPagosSinAplicar: 0,
          clientesPendientes: 0,
          clientesConSaldoAFavor: 0,
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