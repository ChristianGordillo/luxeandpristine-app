import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  LPMovimientoClienteTipo,
  Prisma,
} from "@prisma/client";

function fechaKey(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toISOString().split("T")[0];
}

function normalizarTextoOpcional(valor: unknown) {
  if (
    typeof valor !== "string" ||
    !valor.trim()
  ) {
    return null;
  }

  return valor.trim();
}

function validarId(valor: unknown) {
  const numero = Number(valor);

  return (
    Number.isInteger(numero) &&
    numero > 0
  );
}

function validarValor(valor: unknown) {
  const numero = Number(valor);

  return (
    Number.isFinite(numero) &&
    numero > 0
  );
}

function esMovimientoAplicable(
  tipo: LPMovimientoClienteTipo
) {
  return (
    tipo === LPMovimientoClienteTipo.ABONO ||
    tipo ===
      LPMovimientoClienteTipo.AJUSTE_CREDITO
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

async function calcularTotalTrabajadoCiclo(
  tx: Prisma.TransactionClient,
  ciclo: {
    clienteId: number;
    fechaInicio: Date;
    fechaFin: Date;
  }
) {
  const resultado =
    await tx.lPTrabajoDiario.aggregate({
      where: {
        unidad: {
          clienteId: ciclo.clienteId,
        },

        fecha: {
          gte: new Date(
            `${fechaKey(
              ciclo.fechaInicio
            )}T00:00:00.000Z`
          ),

          lte: new Date(
            `${fechaKey(
              ciclo.fechaFin
            )}T23:59:59.999Z`
          ),
        },
      },

      _sum: {
        precio: true,
      },

      _count: {
        id: true,
      },
    });

  return {
    totalTrabajado: Number(
      resultado._sum.precio || 0
    ),

    cantidadTrabajos:
      resultado._count.id,
  };
}

function calcularEstadoCiclo({
  totalTrabajado,
  totalAplicado,
}: {
  totalTrabajado: number;
  totalAplicado: number;
}) {
  const diferencia =
    totalAplicado - totalTrabajado;

  if (
    totalTrabajado === 0 &&
    totalAplicado === 0
  ) {
    return "SIN_MOVIMIENTOS";
  }

  if (diferencia === 0) {
    return "CONCILIADO";
  }

  if (totalAplicado === 0) {
    return "SIN_PAGO";
  }

  if (diferencia < 0) {
    return "PAGO_PARCIAL";
  }

  return "SALDO_A_FAVOR";
}

function serializarAplicacion<
  T extends {
    id: number;
    valorAplicado: unknown;
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;

    movimiento: {
      id: number;
      clienteId: number;
      fecha: Date;
      tipo: LPMovimientoClienteTipo;
      valor: unknown;
      concepto: string;
      referencia: string | null;
      notas: string | null;
    };

    ciclo: {
      id: number;
      clienteId: number;
      tipo: string;
      fechaInicio: Date;
      fechaFin: Date;
      concepto: string | null;
      notas: string | null;
    };
  }
>(aplicacion: T) {
  return {
    id: aplicacion.id,

    valorAplicado: Number(
      aplicacion.valorAplicado || 0
    ),

    notas: aplicacion.notas,

    movimiento: {
      id: aplicacion.movimiento.id,

      clienteId:
        aplicacion.movimiento.clienteId,

      fecha:
        fechaKey(
          aplicacion.movimiento.fecha
        ),

      tipo: aplicacion.movimiento.tipo,

      valor: Number(
        aplicacion.movimiento.valor || 0
      ),

      concepto:
        aplicacion.movimiento.concepto,

      referencia:
        aplicacion.movimiento.referencia,

      notas:
        aplicacion.movimiento.notas,
    },

    ciclo: {
      id: aplicacion.ciclo.id,

      clienteId:
        aplicacion.ciclo.clienteId,

      tipo: aplicacion.ciclo.tipo,

      fechaInicio:
        fechaKey(
          aplicacion.ciclo.fechaInicio
        ),

      fechaFin:
        fechaKey(
          aplicacion.ciclo.fechaFin
        ),

      concepto:
        aplicacion.ciclo.concepto,

      notas:
        aplicacion.ciclo.notas,
    },

    createdAt:
      aplicacion.createdAt.toISOString(),

    updatedAt:
      aplicacion.updatedAt.toISOString(),
  };
}

/*
 * GET
 *
 * Ejemplos:
 *
 * /api/lp/aplicaciones-pagos-clientes
 *
 * /api/lp/aplicaciones-pagos-clientes?clienteId=1
 *
 * /api/lp/aplicaciones-pagos-clientes?cicloId=3
 *
 * /api/lp/aplicaciones-pagos-clientes?movimientoId=5
 */
export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(
      request.url
    );

    const clienteIdParam =
      searchParams.get("clienteId");

    const cicloIdParam =
      searchParams.get("cicloId");

    const movimientoIdParam =
      searchParams.get("movimientoId");

    if (
      clienteIdParam &&
      !validarId(clienteIdParam)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El clienteId no es válido.",
        },
        { status: 400 }
      );
    }

    if (
      cicloIdParam &&
      !validarId(cicloIdParam)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El cicloId no es válido.",
        },
        { status: 400 }
      );
    }

    if (
      movimientoIdParam &&
      !validarId(movimientoIdParam)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El movimientoId no es válido.",
        },
        { status: 400 }
      );
    }

    const clienteId = clienteIdParam
      ? Number(clienteIdParam)
      : null;

    const cicloId = cicloIdParam
      ? Number(cicloIdParam)
      : null;

    const movimientoId =
      movimientoIdParam
        ? Number(movimientoIdParam)
        : null;

    const aplicaciones =
      await prisma.lPAplicacionPagoCliente.findMany({
        where: {
          ...(cicloId
            ? {
                cicloId,
              }
            : {}),

          ...(movimientoId
            ? {
                movimientoId,
              }
            : {}),

          ...(clienteId
            ? {
                ciclo: {
                  clienteId,
                },
              }
            : {}),
        },

        include: {
          movimiento: {
            select: {
              id: true,
              clienteId: true,
              fecha: true,
              tipo: true,
              valor: true,
              concepto: true,
              referencia: true,
              notas: true,
            },
          },

          ciclo: {
            select: {
              id: true,
              clienteId: true,
              tipo: true,
              fechaInicio: true,
              fechaFin: true,
              concepto: true,
              notas: true,
            },
          },
        },

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    const totalAplicado =
      aplicaciones.reduce(
        (total, aplicacion) =>
          total +
          Number(
            aplicacion.valorAplicado || 0
          ),
        0
      );

    return NextResponse.json({
      status: "success",

      resumen: {
        cantidad: aplicaciones.length,
        totalAplicado,
      },

      aplicaciones:
        aplicaciones.map(
          serializarAplicacion
        ),
    });
  } catch (error) {
    console.error(
      "Error consultando aplicaciones de pagos:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al consultar las aplicaciones de pagos.",
      },
      { status: 500 }
    );
  }
}

/*
 * POST
 *
 * Aplica parte o la totalidad de un pago a un ciclo.
 *
 * Body:
 *
 * {
 *   "movimientoId": 5,
 *   "cicloId": 3,
 *   "valorAplicado": 700,
 *   "notas": "Aplicación del anticipo"
 * }
 */
export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      movimientoId,
      cicloId,
      valorAplicado,
      notas,
    } = body;

    if (!validarId(movimientoId)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El movimientoId no es válido.",
        },
        { status: 400 }
      );
    }

    if (!validarId(cicloId)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El cicloId no es válido.",
        },
        { status: 400 }
      );
    }

    if (!validarValor(valorAplicado)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El valor aplicado debe ser mayor que cero.",
        },
        { status: 400 }
      );
    }

    const resultado =
      await prisma.$transaction(
        async (tx) => {
          const movimiento =
            await tx.lPMovimientoCliente.findUnique({
              where: {
                id: Number(movimientoId),
              },

              include: {
                aplicacionesPago: {
                  select: {
                    valorAplicado: true,
                  },
                },
              },
            });

          if (!movimiento) {
            throw new Error(
              "MOVIMIENTO_NO_EXISTE"
            );
          }

          if (
            !esMovimientoAplicable(
              movimiento.tipo
            )
          ) {
            throw new Error(
              "MOVIMIENTO_NO_APLICABLE"
            );
          }

          const ciclo =
            await tx.lPCicloCliente.findUnique({
              where: {
                id: Number(cicloId),
              },

              include: {
                aplicacionesPago: {
                  select: {
                    valorAplicado: true,
                  },
                },
              },
            });

          if (!ciclo) {
            throw new Error(
              "CICLO_NO_EXISTE"
            );
          }

          if (
            movimiento.clienteId !==
            ciclo.clienteId
          ) {
            throw new Error(
              "CLIENTES_DIFERENTES"
            );
          }

          const aplicacionExistente =
            await tx.lPAplicacionPagoCliente.findUnique({
              where: {
                movimientoId_cicloId: {
                  movimientoId:
                    movimiento.id,

                  cicloId:
                    ciclo.id,
                },
              },
            });

          if (aplicacionExistente) {
            throw new Error(
              "APLICACION_EXISTENTE"
            );
          }

          const totalAplicadoMovimiento =
            sumarAplicaciones(
              movimiento.aplicacionesPago
            );

          const saldoDisponiblePago =
            Number(movimiento.valor) -
            totalAplicadoMovimiento;

          const valorNuevo =
            Number(valorAplicado);

          if (
            valorNuevo >
            saldoDisponiblePago
          ) {
            throw new Error(
              `SALDO_PAGO_INSUFICIENTE:${saldoDisponiblePago}`
            );
          }

          const {
            totalTrabajado,
            cantidadTrabajos,
          } =
            await calcularTotalTrabajadoCiclo(
              tx,
              ciclo
            );

          const totalAplicadoCiclo =
            sumarAplicaciones(
              ciclo.aplicacionesPago
            );

          const saldoPendienteCiclo =
            Math.max(
              0,
              totalTrabajado -
                totalAplicadoCiclo
            );

          if (totalTrabajado <= 0) {
            throw new Error(
              "CICLO_SIN_TRABAJOS"
            );
          }

          if (
            saldoPendienteCiclo <= 0
          ) {
            throw new Error(
              "CICLO_CONCILIADO"
            );
          }

          if (
            valorNuevo >
            saldoPendienteCiclo
          ) {
            throw new Error(
              `VALOR_SUPERA_PENDIENTE:${saldoPendienteCiclo}`
            );
          }

          const aplicacion =
            await tx.lPAplicacionPagoCliente.create({
              data: {
                movimientoId:
                  movimiento.id,

                cicloId:
                  ciclo.id,

                valorAplicado:
                  valorNuevo,

                notas:
                  normalizarTextoOpcional(
                    notas
                  ),
              },

              include: {
                movimiento: {
                  select: {
                    id: true,
                    clienteId: true,
                    fecha: true,
                    tipo: true,
                    valor: true,
                    concepto: true,
                    referencia: true,
                    notas: true,
                  },
                },

                ciclo: {
                  select: {
                    id: true,
                    clienteId: true,
                    tipo: true,
                    fechaInicio: true,
                    fechaFin: true,
                    concepto: true,
                    notas: true,
                  },
                },
              },
            });

          const nuevoTotalAplicadoCiclo =
            totalAplicadoCiclo +
            valorNuevo;

          const nuevoSaldoDisponiblePago =
            saldoDisponiblePago -
            valorNuevo;

          const nuevoSaldoPendienteCiclo =
            Math.max(
              0,
              totalTrabajado -
                nuevoTotalAplicadoCiclo
            );

          return {
            aplicacion,

            conciliacion: {
              cantidadTrabajos,
              totalTrabajado,

              totalAplicado:
                nuevoTotalAplicadoCiclo,

              saldoPendiente:
                nuevoSaldoPendienteCiclo,

              estado:
                calcularEstadoCiclo({
                  totalTrabajado,

                  totalAplicado:
                    nuevoTotalAplicadoCiclo,
                }),
            },

            pago: {
              valor: Number(
                movimiento.valor
              ),

              totalAplicado:
                totalAplicadoMovimiento +
                valorNuevo,

              saldoDisponible:
                Math.max(
                  0,
                  nuevoSaldoDisponiblePago
                ),
            },
          };
        }
      );

    return NextResponse.json(
      {
        status: "success",

        message:
          resultado.conciliacion
            .saldoPendiente === 0
            ? "El ciclo quedó conciliado correctamente."
            : "El pago fue aplicado parcialmente al ciclo.",

        aplicacion:
          serializarAplicacion(
            resultado.aplicacion
          ),

        conciliacion:
          resultado.conciliacion,

        pago:
          resultado.pago,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Error aplicando pago al ciclo:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "";

    if (
      mensaje ===
      "MOVIMIENTO_NO_EXISTE"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El pago seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    if (
      mensaje ===
      "MOVIMIENTO_NO_APLICABLE"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Solo los pagos y ajustes a favor pueden aplicarse a un ciclo.",
        },
        { status: 400 }
      );
    }

    if (
      mensaje === "CICLO_NO_EXISTE"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El ciclo seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    if (
      mensaje ===
      "CLIENTES_DIFERENTES"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El pago y el ciclo pertenecen a clientes diferentes.",
        },
        { status: 409 }
      );
    }

    if (
      mensaje ===
      "APLICACION_EXISTENTE"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Este pago ya está aplicado al ciclo. Edita la aplicación existente.",
        },
        { status: 409 }
      );
    }

    if (
      mensaje ===
      "CICLO_SIN_TRABAJOS"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El ciclo no tiene trabajos para conciliar.",
        },
        { status: 409 }
      );
    }

    if (
      mensaje ===
      "CICLO_CONCILIADO"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El ciclo ya está completamente conciliado.",
        },
        { status: 409 }
      );
    }

    if (
      mensaje.startsWith(
        "SALDO_PAGO_INSUFICIENTE:"
      )
    ) {
      const disponible =
        Number(
          mensaje.split(":")[1] || 0
        );

      return NextResponse.json(
        {
          status: "fail",
          message:
            `El pago solo tiene $${disponible.toFixed(
              2
            )} disponibles.`,
        },
        { status: 409 }
      );
    }

    if (
      mensaje.startsWith(
        "VALOR_SUPERA_PENDIENTE:"
      )
    ) {
      const pendiente =
        Number(
          mensaje.split(":")[1] || 0
        );

      return NextResponse.json(
        {
          status: "fail",
          message:
            `El ciclo solo tiene $${pendiente.toFixed(
              2
            )} pendientes. El excedente debe permanecer disponible en el pago.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al aplicar el pago al ciclo.",
      },
      { status: 500 }
    );
  }
}

/*
 * PATCH
 *
 * Modifica el valor de una aplicación existente.
 *
 * Body:
 *
 * {
 *   "id": 4,
 *   "valorAplicado": 650,
 *   "notas": ""
 * }
 */
export async function PATCH(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      id,
      valorAplicado,
      notas,
    } = body;

    if (!validarId(id)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El id de la aplicación no es válido.",
        },
        { status: 400 }
      );
    }

    if (
      valorAplicado !== undefined &&
      !validarValor(valorAplicado)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El valor aplicado debe ser mayor que cero.",
        },
        { status: 400 }
      );
    }

    const resultado =
      await prisma.$transaction(
        async (tx) => {
          const aplicacionActual =
            await tx.lPAplicacionPagoCliente.findUnique({
              where: {
                id: Number(id),
              },

              include: {
                movimiento: {
                  include: {
                    aplicacionesPago: {
                      select: {
                        id: true,
                        valorAplicado: true,
                      },
                    },
                  },
                },

                ciclo: {
                  include: {
                    aplicacionesPago: {
                      select: {
                        id: true,
                        valorAplicado: true,
                      },
                    },
                  },
                },
              },
            });

          if (!aplicacionActual) {
            throw new Error(
              "APLICACION_NO_EXISTE"
            );
          }

          const valorActual =
            Number(
              aplicacionActual.valorAplicado
            );

          const nuevoValor =
            valorAplicado !== undefined
              ? Number(valorAplicado)
              : valorActual;

          const totalOtrasAplicacionesPago =
            aplicacionActual.movimiento
              .aplicacionesPago
              .filter(
                (aplicacion) =>
                  aplicacion.id !==
                  aplicacionActual.id
              )
              .reduce(
                (total, aplicacion) =>
                  total +
                  Number(
                    aplicacion.valorAplicado ||
                      0
                  ),
                0
              );

          const maximoDisponiblePago =
            Number(
              aplicacionActual.movimiento
                .valor
            ) -
            totalOtrasAplicacionesPago;

          if (
            nuevoValor >
            maximoDisponiblePago
          ) {
            throw new Error(
              `SALDO_PAGO_INSUFICIENTE:${maximoDisponiblePago}`
            );
          }

          const {
            totalTrabajado,
            cantidadTrabajos,
          } =
            await calcularTotalTrabajadoCiclo(
              tx,
              aplicacionActual.ciclo
            );

          const totalOtrasAplicacionesCiclo =
            aplicacionActual.ciclo
              .aplicacionesPago
              .filter(
                (aplicacion) =>
                  aplicacion.id !==
                  aplicacionActual.id
              )
              .reduce(
                (total, aplicacion) =>
                  total +
                  Number(
                    aplicacion.valorAplicado ||
                      0
                  ),
                0
              );

          const maximoPendienteCiclo =
            Math.max(
              0,
              totalTrabajado -
                totalOtrasAplicacionesCiclo
            );

          if (
            nuevoValor >
            maximoPendienteCiclo
          ) {
            throw new Error(
              `VALOR_SUPERA_PENDIENTE:${maximoPendienteCiclo}`
            );
          }

          const datosActualizacion: {
            valorAplicado?: number;
            notas?: string | null;
          } = {};

          if (
            valorAplicado !== undefined
          ) {
            datosActualizacion.valorAplicado =
              nuevoValor;
          }

          if (notas !== undefined) {
            datosActualizacion.notas =
              normalizarTextoOpcional(
                notas
              );
          }

          if (
            Object.keys(
              datosActualizacion
            ).length === 0
          ) {
            throw new Error(
              "SIN_CAMBIOS"
            );
          }

          const aplicacionActualizada =
            await tx.lPAplicacionPagoCliente.update({
              where: {
                id:
                  aplicacionActual.id,
              },

              data:
                datosActualizacion,

              include: {
                movimiento: {
                  select: {
                    id: true,
                    clienteId: true,
                    fecha: true,
                    tipo: true,
                    valor: true,
                    concepto: true,
                    referencia: true,
                    notas: true,
                  },
                },

                ciclo: {
                  select: {
                    id: true,
                    clienteId: true,
                    tipo: true,
                    fechaInicio: true,
                    fechaFin: true,
                    concepto: true,
                    notas: true,
                  },
                },
              },
            });

          const nuevoTotalAplicadoCiclo =
            totalOtrasAplicacionesCiclo +
            nuevoValor;

          const nuevoTotalAplicadoPago =
            totalOtrasAplicacionesPago +
            nuevoValor;

          return {
            aplicacion:
              aplicacionActualizada,

            conciliacion: {
              cantidadTrabajos,
              totalTrabajado,

              totalAplicado:
                nuevoTotalAplicadoCiclo,

              saldoPendiente:
                Math.max(
                  0,
                  totalTrabajado -
                    nuevoTotalAplicadoCiclo
                ),

              estado:
                calcularEstadoCiclo({
                  totalTrabajado,

                  totalAplicado:
                    nuevoTotalAplicadoCiclo,
                }),
            },

            pago: {
              valor: Number(
                aplicacionActual.movimiento
                  .valor
              ),

              totalAplicado:
                nuevoTotalAplicadoPago,

              saldoDisponible:
                Math.max(
                  0,
                  Number(
                    aplicacionActual
                      .movimiento.valor
                  ) -
                    nuevoTotalAplicadoPago
                ),
            },
          };
        }
      );

    return NextResponse.json({
      status: "success",

      message:
        "Aplicación actualizada correctamente.",

      aplicacion:
        serializarAplicacion(
          resultado.aplicacion
        ),

      conciliacion:
        resultado.conciliacion,

      pago: resultado.pago,
    });
  } catch (error) {
    console.error(
      "Error actualizando aplicación:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "";

    if (
      mensaje ===
      "APLICACION_NO_EXISTE"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La aplicación seleccionada no existe.",
        },
        { status: 404 }
      );
    }

    if (mensaje === "SIN_CAMBIOS") {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No se enviaron datos para actualizar.",
        },
        { status: 400 }
      );
    }

    if (
      mensaje.startsWith(
        "SALDO_PAGO_INSUFICIENTE:"
      )
    ) {
      const disponible =
        Number(
          mensaje.split(":")[1] || 0
        );

      return NextResponse.json(
        {
          status: "fail",
          message:
            `El pago permite aplicar como máximo $${disponible.toFixed(
              2
            )}.`,
        },
        { status: 409 }
      );
    }

    if (
      mensaje.startsWith(
        "VALOR_SUPERA_PENDIENTE:"
      )
    ) {
      const pendiente =
        Number(
          mensaje.split(":")[1] || 0
        );

      return NextResponse.json(
        {
          status: "fail",
          message:
            `El ciclo permite aplicar como máximo $${pendiente.toFixed(
              2
            )}.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al actualizar la aplicación.",
      },
      { status: 500 }
    );
  }
}

/*
 * DELETE
 *
 * Libera el dinero aplicado para que vuelva a quedar
 * disponible dentro del pago.
 *
 * Ejemplo:
 *
 * /api/lp/aplicaciones-pagos-clientes?id=4
 */
export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(
      request.url
    );

    const idParam =
      searchParams.get("id");

    if (!validarId(idParam)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El id de la aplicación no es válido.",
        },
        { status: 400 }
      );
    }

    const resultado =
      await prisma.$transaction(
        async (tx) => {
          const aplicacion =
            await tx.lPAplicacionPagoCliente.findUnique({
              where: {
                id: Number(idParam),
              },

              include: {
                movimiento: {
                  include: {
                    aplicacionesPago: {
                      select: {
                        id: true,
                        valorAplicado: true,
                      },
                    },
                  },
                },

                ciclo: {
                  include: {
                    aplicacionesPago: {
                      select: {
                        id: true,
                        valorAplicado: true,
                      },
                    },
                  },
                },
              },
            });

          if (!aplicacion) {
            throw new Error(
              "APLICACION_NO_EXISTE"
            );
          }

          const valorLiberado =
            Number(
              aplicacion.valorAplicado
            );

          const {
            totalTrabajado,
            cantidadTrabajos,
          } =
            await calcularTotalTrabajadoCiclo(
              tx,
              aplicacion.ciclo
            );

          await tx.lPAplicacionPagoCliente.delete({
            where: {
              id: aplicacion.id,
            },
          });

          const totalAplicadoCiclo =
            aplicacion.ciclo
              .aplicacionesPago
              .filter(
                (item) =>
                  item.id !==
                  aplicacion.id
              )
              .reduce(
                (total, item) =>
                  total +
                  Number(
                    item.valorAplicado || 0
                  ),
                0
              );

          const totalAplicadoPago =
            aplicacion.movimiento
              .aplicacionesPago
              .filter(
                (item) =>
                  item.id !==
                  aplicacion.id
              )
              .reduce(
                (total, item) =>
                  total +
                  Number(
                    item.valorAplicado || 0
                  ),
                0
              );

          return {
            valorLiberado,

            conciliacion: {
              cantidadTrabajos,
              totalTrabajado,
              totalAplicado:
                totalAplicadoCiclo,

              saldoPendiente:
                Math.max(
                  0,
                  totalTrabajado -
                    totalAplicadoCiclo
                ),

              estado:
                calcularEstadoCiclo({
                  totalTrabajado,
                  totalAplicado:
                    totalAplicadoCiclo,
                }),
            },

            pago: {
              valor: Number(
                aplicacion.movimiento.valor
              ),

              totalAplicado:
                totalAplicadoPago,

              saldoDisponible:
                Math.max(
                  0,
                  Number(
                    aplicacion.movimiento
                      .valor
                  ) -
                    totalAplicadoPago
                ),
            },
          };
        }
      );

    return NextResponse.json({
      status: "success",

      message:
        "Aplicación eliminada correctamente. El valor volvió a quedar disponible.",

      valorLiberado:
        resultado.valorLiberado,

      conciliacion:
        resultado.conciliacion,

      pago: resultado.pago,
    });
  } catch (error) {
    console.error(
      "Error eliminando aplicación:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "";

    if (
      mensaje ===
      "APLICACION_NO_EXISTE"
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La aplicación seleccionada no existe.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al eliminar la aplicación.",
      },
      { status: 500 }
    );
  }
}