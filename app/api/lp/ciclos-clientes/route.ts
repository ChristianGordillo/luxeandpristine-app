import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPCicloClienteTipo } from "@prisma/client";

const TIPOS_VALIDOS = Object.values(LPCicloClienteTipo);

function crearInicioDia(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function crearFinDia(fecha: string) {
  return new Date(`${fecha}T23:59:59.999Z`);
}

function crearFechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00.000Z`);
}

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

function validarTipo(
  tipo: unknown
): tipo is LPCicloClienteTipo {
  return (
    typeof tipo === "string" &&
    TIPOS_VALIDOS.includes(
      tipo as LPCicloClienteTipo
    )
  );
}

function validarFecha(fecha: unknown): fecha is string {
  if (
    typeof fecha !== "string" ||
    !fecha.trim()
  ) {
    return false;
  }

  const fechaNormalizada = fecha.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNormalizada)) {
    return false;
  }

  const fechaDate = crearFechaLocal(fechaNormalizada);

  return !Number.isNaN(fechaDate.getTime());
}

function calcularEstadoCiclo({
  totalTrabajado,
  totalAplicado,
}: {
  totalTrabajado: number;
  totalAplicado: number;
}) {
  const diferencia = totalAplicado - totalTrabajado;

  if (totalTrabajado === 0 && totalAplicado === 0) {
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

function tipoUnidad({
  habitaciones,
  banos,
}: {
  habitaciones: number | null | undefined;
  banos: number | null | undefined;
}) {
  if (
    habitaciones === null ||
    habitaciones === undefined ||
    banos === null ||
    banos === undefined
  ) {
    return null;
  }

  return `${habitaciones}/${banos}`;
}

/*
 * GET
 *
 * Consulta los ciclos financieros de un cliente.
 *
 * Ejemplos:
 *
 * /api/lp/ciclos-clientes?clienteId=1
 *
 * /api/lp/ciclos-clientes?clienteId=1&cicloId=3
 *
 * Cuando se envía cicloId, la API devuelve también:
 *
 * - detalle completo de trabajos;
 * - pagos aplicados;
 * - pagos disponibles del cliente.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const clienteIdParam =
      searchParams.get("clienteId");

    const cicloIdParam =
      searchParams.get("cicloId");

    const clienteId = Number(clienteIdParam);

    const cicloId = cicloIdParam
      ? Number(cicloIdParam)
      : null;

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
      cicloIdParam &&
      (
        !Number.isInteger(cicloId) ||
        Number(cicloId) <= 0
      )
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El cicloId indicado no es válido.",
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

    const ciclos =
      await prisma.lPCicloCliente.findMany({
        where: {
          clienteId,

          ...(cicloId
            ? {
                id: cicloId,
              }
            : {}),
        },

        include: {
          aplicacionesPago: {
            include: {
              movimiento: {
                select: {
                  id: true,
                  fecha: true,
                  tipo: true,
                  valor: true,
                  concepto: true,
                  referencia: true,
                  notas: true,
                },
              },
            },

            orderBy: {
              createdAt: "asc",
            },
          },
        },

        orderBy: [
          {
            fechaInicio: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    if (cicloId && ciclos.length === 0) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El ciclo seleccionado no existe o no pertenece al cliente.",
        },
        { status: 404 }
      );
    }

    /*
     * Calculamos cada ciclo con los trabajos que realmente
     * existen en el Registro Diario.
     */
    const ciclosCalculados = await Promise.all(
      ciclos.map(async (ciclo) => {
        const trabajos =
          await prisma.lPTrabajoDiario.findMany({
            where: {
              unidad: {
                clienteId,
              },

              fecha: {
                gte: crearInicioDia(
                  fechaKey(ciclo.fechaInicio) || ""
                ),

                lte: crearFinDia(
                  fechaKey(ciclo.fechaFin) || ""
                ),
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
                id: "asc",
              },
            ],
          });

        const totalTrabajado = trabajos.reduce(
          (total, trabajo) =>
            total +
            Number(trabajo.precio || 0),
          0
        );

        const totalAplicado =
          ciclo.aplicacionesPago.reduce(
            (total, aplicacion) =>
              total +
              Number(
                aplicacion.valorAplicado || 0
              ),
            0
          );

        const diferencia =
          totalAplicado - totalTrabajado;

        const saldoPendiente =
          diferencia < 0
            ? Math.abs(diferencia)
            : 0;

        const saldoAFavor =
          diferencia > 0
            ? diferencia
            : 0;

        const trabajosSerializados =
          trabajos.map((trabajo) => ({
            id: trabajo.id,
            fecha:
              fechaKey(trabajo.fecha),

            edificio:
              trabajo.unidad?.edificio
                ?.nombre || "Sin edificio",

            unidad:
              trabajo.unidad?.nombre ||
              trabajo.unidadManual ||
              "Unidad eventual",

            tipoUnidad: tipoUnidad({
              habitaciones:
                trabajo.unidad?.habitaciones,

              banos:
                trabajo.unidad?.banos,
            }),

            tipoTrabajo: trabajo.tipo,
            precio: Number(
              trabajo.precio || 0
            ),

            notas: trabajo.notas || null,
          }));

        const pagosAplicados =
          ciclo.aplicacionesPago.map(
            (aplicacion) => ({
              id: aplicacion.id,

              movimientoId:
                aplicacion.movimientoId,

              fecha:
                fechaKey(
                  aplicacion.movimiento.fecha
                ),

              tipo:
                aplicacion.movimiento.tipo,

              concepto:
                aplicacion.movimiento.concepto,

              referencia:
                aplicacion.movimiento
                  .referencia || null,

              valorPago: Number(
                aplicacion.movimiento.valor || 0
              ),

              valorAplicado: Number(
                aplicacion.valorAplicado || 0
              ),

              notas:
                aplicacion.notas ||
                aplicacion.movimiento.notas ||
                null,
            })
          );

        return {
          id: ciclo.id,
          clienteId: ciclo.clienteId,
          tipo: ciclo.tipo,

          fechaInicio:
            fechaKey(ciclo.fechaInicio),

          fechaFin:
            fechaKey(ciclo.fechaFin),

          concepto: ciclo.concepto,
          notas: ciclo.notas,

          cantidadTrabajos:
            trabajos.length,

          totalTrabajado,
          totalAplicado,

          diferencia,
          saldoPendiente,
          saldoAFavor,

          estado: calcularEstadoCiclo({
            totalTrabajado,
            totalAplicado,
          }),

          trabajos: trabajosSerializados,
          pagosAplicados,

          createdAt:
            ciclo.createdAt.toISOString(),

          updatedAt:
            ciclo.updatedAt.toISOString(),
        };
      })
    );

    /*
     * Buscamos pagos y créditos que todavía tengan saldo
     * disponible para aplicarse a algún ciclo.
     */
    const movimientosAplicables =
      await prisma.lPMovimientoCliente.findMany({
        where: {
          clienteId,

          tipo: {
            in: [
              "ABONO",
              "AJUSTE_CREDITO",
            ],
          },
        },

        include: {
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
      });

    const pagosDisponibles =
      movimientosAplicables
        .map((movimiento) => {
          const valor = Number(
            movimiento.valor || 0
          );

          const totalAplicado =
            movimiento.aplicacionesPago.reduce(
              (total, aplicacion) =>
                total +
                Number(
                  aplicacion.valorAplicado || 0
                ),
              0
            );

          const saldoDisponible =
            valor - totalAplicado;

          return {
            id: movimiento.id,

            fecha:
              fechaKey(movimiento.fecha),

            tipo: movimiento.tipo,

            concepto:
              movimiento.concepto,

            referencia:
              movimiento.referencia || null,

            valor,
            totalAplicado,

            saldoDisponible:
              Math.max(0, saldoDisponible),

            notas:
              movimiento.notas || null,
          };
        })
        .filter(
          (movimiento) =>
            movimiento.saldoDisponible > 0
        );

    const resumen = ciclosCalculados.reduce(
      (acc, ciclo) => {
        acc.totalTrabajado +=
          ciclo.totalTrabajado;

        acc.totalAplicado +=
          ciclo.totalAplicado;

        acc.totalPendiente +=
          ciclo.saldoPendiente;

        acc.totalSaldoAFavor +=
          ciclo.saldoAFavor;

        if (
          ciclo.estado === "CONCILIADO"
        ) {
          acc.ciclosConciliados += 1;
        } else {
          acc.ciclosPendientes += 1;
        }

        return acc;
      },
      {
        cantidadCiclos:
          ciclosCalculados.length,

        ciclosConciliados: 0,
        ciclosPendientes: 0,

        totalTrabajado: 0,
        totalAplicado: 0,
        totalPendiente: 0,
        totalSaldoAFavor: 0,

        pagosDisponibles:
          pagosDisponibles.reduce(
            (total, pago) =>
              total +
              pago.saldoDisponible,
            0
          ),
      }
    );

    return NextResponse.json({
      status: "success",

      cliente,

      resumen,

      ciclos: ciclosCalculados,

      /*
       * Solo resulta especialmente útil en el detalle,
       * pero lo devolvemos siempre para simplificar la UI.
       */
      pagosDisponibles,
    });
  } catch (error) {
    console.error(
      "Error consultando ciclos de clientes:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al consultar los ciclos del cliente.",
      },
      { status: 500 }
    );
  }
}

/*
 * POST
 *
 * Crea un ciclo para conciliar.
 *
 * Body:
 *
 * {
 *   "clienteId": 1,
 *   "tipo": "QUINCENAL",
 *   "fechaInicio": "2026-07-01",
 *   "fechaFin": "2026-07-15",
 *   "concepto": "First half of July",
 *   "notas": ""
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      clienteId,
      tipo,
      fechaInicio,
      fechaFin,
      concepto,
      notas,
    } = body;

    const clienteIdNumerico =
      Number(clienteId);

    if (
      !Number.isInteger(
        clienteIdNumerico
      ) ||
      clienteIdNumerico <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes seleccionar un cliente válido.",
        },
        { status: 400 }
      );
    }

    if (!validarTipo(tipo)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El tipo de ciclo no es válido.",
          tiposValidos: TIPOS_VALIDOS,
        },
        { status: 400 }
      );
    }

    if (!validarFecha(fechaInicio)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha inicial no es válida.",
        },
        { status: 400 }
      );
    }

    if (!validarFecha(fechaFin)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha final no es válida.",
        },
        { status: 400 }
      );
    }

    if (fechaInicio > fechaFin) {
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
          id: clienteIdNumerico,
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
          message:
            "El cliente seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    /*
     * Evitamos que un cliente tenga dos ciclos cuyos
     * rangos se superpongan.
     *
     * Un ciclo existente se solapa cuando:
     *
     * existente.fechaInicio <= nueva.fechaFin
     * y
     * existente.fechaFin >= nueva.fechaInicio
     */
    const cicloSuperpuesto =
      await prisma.lPCicloCliente.findFirst({
        where: {
          clienteId: clienteIdNumerico,

          fechaInicio: {
            lte: crearFinDia(fechaFin),
          },

          fechaFin: {
            gte: crearInicioDia(fechaInicio),
          },
        },

        select: {
          id: true,
          fechaInicio: true,
          fechaFin: true,
        },
      });

    if (cicloSuperpuesto) {
      return NextResponse.json(
        {
          status: "fail",

          message:
            `El rango se cruza con el ciclo ${fechaKey(
              cicloSuperpuesto.fechaInicio
            )} – ${fechaKey(
              cicloSuperpuesto.fechaFin
            )}.`,
        },
        { status: 409 }
      );
    }

    const ciclo =
      await prisma.lPCicloCliente.create({
        data: {
          clienteId:
            clienteIdNumerico,

          tipo,

          /*
           * Guardamos la fecha inicial y final al mediodía.
           * Al consultar trabajos usamos inicio y fin del día.
           */
          fechaInicio:
            crearFechaLocal(fechaInicio),

          fechaFin:
            crearFechaLocal(fechaFin),

          concepto:
            normalizarTextoOpcional(
              concepto
            ),

          notas:
            normalizarTextoOpcional(
              notas
            ),
        },
      });

    return NextResponse.json(
      {
        status: "success",
        message:
          "Ciclo creado correctamente.",

        ciclo: {
          ...ciclo,

          fechaInicio:
            fechaKey(ciclo.fechaInicio),

          fechaFin:
            fechaKey(ciclo.fechaFin),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Error creando ciclo del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al crear el ciclo del cliente.",
      },
      { status: 500 }
    );
  }
}

/*
 * PATCH
 *
 * Actualiza un ciclo existente.
 *
 * No permite cambiar el cliente del ciclo.
 *
 * Body:
 *
 * {
 *   "id": 3,
 *   "tipo": "QUINCENAL",
 *   "fechaInicio": "2026-07-01",
 *   "fechaFin": "2026-07-15",
 *   "concepto": "First half of July",
 *   "notas": ""
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      tipo,
      fechaInicio,
      fechaFin,
      concepto,
      notas,
    } = body;

    const cicloId = Number(id);

    if (
      !Number.isInteger(cicloId) ||
      cicloId <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El id del ciclo no es válido.",
        },
        { status: 400 }
      );
    }

    const cicloActual =
      await prisma.lPCicloCliente.findUnique({
        where: {
          id: cicloId,
        },

        include: {
          aplicacionesPago: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!cicloActual) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El ciclo seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    const nuevaFechaInicio =
      fechaInicio !== undefined
        ? fechaInicio
        : fechaKey(
            cicloActual.fechaInicio
          );

    const nuevaFechaFin =
      fechaFin !== undefined
        ? fechaFin
        : fechaKey(
            cicloActual.fechaFin
          );

    if (
      fechaInicio !== undefined &&
      !validarFecha(fechaInicio)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha inicial no es válida.",
        },
        { status: 400 }
      );
    }

    if (
      fechaFin !== undefined &&
      !validarFecha(fechaFin)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "La fecha final no es válida.",
        },
        { status: 400 }
      );
    }

    if (
      !nuevaFechaInicio ||
      !nuevaFechaFin ||
      nuevaFechaInicio > nuevaFechaFin
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

    /*
     * Si ya hay pagos aplicados, evitamos modificar las
     * fechas porque cambiarían los trabajos conciliados.
     */
    const cambiandoFechas =
      nuevaFechaInicio !==
        fechaKey(cicloActual.fechaInicio) ||
      nuevaFechaFin !==
        fechaKey(cicloActual.fechaFin);

    if (
      cambiandoFechas &&
      cicloActual.aplicacionesPago.length > 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No puedes cambiar las fechas de un ciclo que ya tiene pagos aplicados. Primero elimina sus aplicaciones.",
        },
        { status: 409 }
      );
    }

    if (tipo !== undefined && !validarTipo(tipo)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El tipo de ciclo no es válido.",
          tiposValidos: TIPOS_VALIDOS,
        },
        { status: 400 }
      );
    }

    if (cambiandoFechas) {
      const cicloSuperpuesto =
        await prisma.lPCicloCliente.findFirst({
          where: {
            clienteId:
              cicloActual.clienteId,

            id: {
              not: cicloActual.id,
            },

            fechaInicio: {
              lte: crearFinDia(
                nuevaFechaFin
              ),
            },

            fechaFin: {
              gte: crearInicioDia(
                nuevaFechaInicio
              ),
            },
          },

          select: {
            id: true,
            fechaInicio: true,
            fechaFin: true,
          },
        });

      if (cicloSuperpuesto) {
        return NextResponse.json(
          {
            status: "fail",

            message:
              `El rango se cruza con el ciclo ${fechaKey(
                cicloSuperpuesto.fechaInicio
              )} – ${fechaKey(
                cicloSuperpuesto.fechaFin
              )}.`,
          },
          { status: 409 }
        );
      }
    }

    const datosActualizacion: {
      tipo?: LPCicloClienteTipo;
      fechaInicio?: Date;
      fechaFin?: Date;
      concepto?: string | null;
      notas?: string | null;
    } = {};

    if (tipo !== undefined) {
      datosActualizacion.tipo = tipo;
    }

    if (fechaInicio !== undefined) {
      datosActualizacion.fechaInicio =
        crearFechaLocal(fechaInicio);
    }

    if (fechaFin !== undefined) {
      datosActualizacion.fechaFin =
        crearFechaLocal(fechaFin);
    }

    if (concepto !== undefined) {
      datosActualizacion.concepto =
        normalizarTextoOpcional(
          concepto
        );
    }

    if (notas !== undefined) {
      datosActualizacion.notas =
        normalizarTextoOpcional(
          notas
        );
    }

    if (
      Object.keys(datosActualizacion).length === 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No se enviaron datos para actualizar.",
        },
        { status: 400 }
      );
    }

    const cicloActualizado =
      await prisma.lPCicloCliente.update({
        where: {
          id: cicloId,
        },

        data: datosActualizacion,
      });

    return NextResponse.json({
      status: "success",
      message:
        "Ciclo actualizado correctamente.",

      ciclo: {
        ...cicloActualizado,

        fechaInicio:
          fechaKey(
            cicloActualizado.fechaInicio
          ),

        fechaFin:
          fechaKey(
            cicloActualizado.fechaFin
          ),
      },
    });
  } catch (error) {
    console.error(
      "Error actualizando ciclo del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al actualizar el ciclo del cliente.",
      },
      { status: 500 }
    );
  }
}

/*
 * DELETE
 *
 * Ejemplo:
 *
 * /api/lp/ciclos-clientes?id=3
 *
 * Solo permite eliminar ciclos sin pagos aplicados.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (
      !idParam ||
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El id del ciclo no es válido.",
        },
        { status: 400 }
      );
    }

    const ciclo =
      await prisma.lPCicloCliente.findUnique({
        where: {
          id,
        },

        include: {
          aplicacionesPago: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!ciclo) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El ciclo seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    if (ciclo.aplicacionesPago.length > 0) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No puedes eliminar un ciclo que tiene pagos aplicados. Primero elimina sus aplicaciones.",
        },
        { status: 409 }
      );
    }

    await prisma.lPCicloCliente.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      status: "success",
      message:
        "Ciclo eliminado correctamente.",
    });
  } catch (error) {
    console.error(
      "Error eliminando ciclo del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al eliminar el ciclo del cliente.",
      },
      { status: 500 }
    );
  }
}