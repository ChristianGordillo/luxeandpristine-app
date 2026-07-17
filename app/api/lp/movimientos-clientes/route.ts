import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

const TIPOS_VALIDOS = Object.values(
  LPMovimientoClienteTipo
);

function crearFechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00.000Z`);
}

function crearRangoFechas(
  desde?: string | null,
  hasta?: string | null
) {
  return {
    ...(desde
      ? {
          gte: new Date(
            `${desde}T00:00:00.000Z`
          ),
        }
      : {}),

    ...(hasta
      ? {
          lte: new Date(
            `${hasta}T23:59:59.999Z`
          ),
        }
      : {}),
  };
}

function validarTipo(
  tipo: unknown
): tipo is LPMovimientoClienteTipo {
  return (
    typeof tipo === "string" &&
    TIPOS_VALIDOS.includes(
      tipo as LPMovimientoClienteTipo
    )
  );
}

function validarValor(valor: unknown) {
  const valorNumerico = Number(valor);

  return (
    Number.isFinite(valorNumerico) &&
    valorNumerico > 0
  );
}

function esTipoAplicable(
  tipo: LPMovimientoClienteTipo
) {
  return (
    tipo === LPMovimientoClienteTipo.ABONO ||
    tipo ===
      LPMovimientoClienteTipo.AJUSTE_CREDITO
  );
}

function calcularTotalAplicado(
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

function serializarMovimiento<
  T extends {
    valor: unknown;
    fecha: Date;
    tipo: LPMovimientoClienteTipo;
    aplicacionesPago?: Array<{
      valorAplicado: unknown;
    }>;
  }
>(movimiento: T) {
  const valor = Number(movimiento.valor || 0);

  const totalAplicado =
    calcularTotalAplicado(
      movimiento.aplicacionesPago || []
    );

  return {
    ...movimiento,

    valor,

    fecha:
      movimiento.fecha
        .toISOString()
        .split("T")[0],

    totalAplicado,

    saldoDisponible: esTipoAplicable(
      movimiento.tipo
    )
      ? Math.max(
          0,
          valor - totalAplicado
        )
      : 0,
  };
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

/*
 * GET
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

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    const clienteId = clienteIdParam
      ? Number(clienteIdParam)
      : null;

    if (
      clienteIdParam &&
      (
        !Number.isInteger(clienteId) ||
        Number(clienteId) <= 0
      )
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

    const rangoFechas =
      crearRangoFechas(desde, hasta);

    const movimientos =
      await prisma.lPMovimientoCliente.findMany({
        where: {
          ...(clienteId
            ? {
                clienteId,
              }
            : {}),

          ...(Object.keys(rangoFechas)
            .length > 0
            ? {
                fecha: rangoFechas,
              }
            : {}),
        },

        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },

          aplicacionesPago: {
            select: {
              id: true,
              valorAplicado: true,
              cicloId: true,

              ciclo: {
                select: {
                  fechaInicio: true,
                  fechaFin: true,
                  tipo: true,
                },
              },
            },
          },
        },

        orderBy: [
          {
            fecha: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

    const movimientosSerializados =
      movimientos.map(
        serializarMovimiento
      );

    const resumen = movimientos.reduce(
      (acc, movimiento) => {
        const valor = Number(
          movimiento.valor || 0
        );

        const totalAplicado =
          calcularTotalAplicado(
            movimiento.aplicacionesPago
          );

        if (
          movimiento.tipo ===
            LPMovimientoClienteTipo.ABONO ||
          movimiento.tipo ===
            LPMovimientoClienteTipo.AJUSTE_CREDITO
        ) {
          acc.creditos += valor;
          acc.aplicado += totalAplicado;

          acc.disponible += Math.max(
            0,
            valor - totalAplicado
          );
        }

        if (
          movimiento.tipo ===
            LPMovimientoClienteTipo.AJUSTE_DEBITO ||
          movimiento.tipo ===
            LPMovimientoClienteTipo.DEVOLUCION
        ) {
          acc.debitos += valor;
        }

        return acc;
      },
      {
        creditos: 0,
        debitos: 0,
        aplicado: 0,
        disponible: 0,
      }
    );

    return NextResponse.json({
      status: "success",

      movimientos:
        movimientosSerializados,

      resumen: {
        cantidad: movimientos.length,
        totalCreditos:
          resumen.creditos,
        totalDebitos:
          resumen.debitos,
        totalAplicado:
          resumen.aplicado,
        totalDisponible:
          resumen.disponible,
        saldoMovimientos:
          resumen.creditos -
          resumen.debitos,
      },
    });
  } catch (error) {
    console.error(
      "Error consultando movimientos de clientes:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al consultar los movimientos del cliente.",
      },
      { status: 500 }
    );
  }
}

/*
 * POST
 */
export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      clienteId,
      fecha,
      tipo,
      valor,
      concepto,
      referencia,
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

    if (
      typeof fecha !== "string" ||
      !fecha.trim()
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes indicar la fecha.",
        },
        { status: 400 }
      );
    }

    if (!validarTipo(tipo)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El tipo de movimiento no es válido.",
          tiposValidos: TIPOS_VALIDOS,
        },
        { status: 400 }
      );
    }

    if (!validarValor(valor)) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El valor debe ser un número mayor que cero.",
        },
        { status: 400 }
      );
    }

    if (
      typeof concepto !== "string" ||
      !concepto.trim()
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes ingresar un concepto.",
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

    const movimiento =
      await prisma.lPMovimientoCliente.create({
        data: {
          clienteId:
            clienteIdNumerico,

          fecha:
            crearFechaLocal(fecha),

          tipo,

          valor: Number(valor),

          concepto:
            concepto.trim(),

          referencia:
            normalizarTextoOpcional(
              referencia
            ),

          notas:
            normalizarTextoOpcional(
              notas
            ),
        },

        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },

          aplicacionesPago: {
            select: {
              valorAplicado: true,
            },
          },
        },
      });

    return NextResponse.json(
      {
        status: "success",

        message:
          tipo ===
          LPMovimientoClienteTipo.ABONO
            ? "Pago registrado correctamente."
            : "Movimiento registrado correctamente.",

        movimiento:
          serializarMovimiento(
            movimiento
          ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Error registrando movimiento del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al registrar el movimiento del cliente.",
      },
      { status: 500 }
    );
  }
}

/*
 * PATCH
 */
export async function PATCH(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      id,
      clienteId,
      fecha,
      tipo,
      valor,
      concepto,
      referencia,
      notas,
    } = body;

    const movimientoId = Number(id);

    if (
      !Number.isInteger(
        movimientoId
      ) ||
      movimientoId <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El id del movimiento no es válido.",
        },
        { status: 400 }
      );
    }

    const movimientoActual =
      await prisma.lPMovimientoCliente.findUnique({
        where: {
          id: movimientoId,
        },

        include: {
          aplicacionesPago: {
            select: {
              valorAplicado: true,
            },
          },
        },
      });

    if (!movimientoActual) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El movimiento no existe.",
        },
        { status: 404 }
      );
    }

    const totalAplicado =
      calcularTotalAplicado(
        movimientoActual.aplicacionesPago
      );

    const datosActualizacion: {
      clienteId?: number;
      fecha?: Date;
      tipo?: LPMovimientoClienteTipo;
      valor?: number;
      concepto?: string;
      referencia?: string | null;
      notas?: string | null;
    } = {};

    if (
      clienteId !== undefined &&
      clienteId !== null
    ) {
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
              "El clienteId no es válido.",
          },
          { status: 400 }
        );
      }

      if (
        totalAplicado > 0 &&
        clienteIdNumerico !==
          movimientoActual.clienteId
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "No puedes cambiar el cliente de un pago que ya tiene valores aplicados.",
          },
          { status: 409 }
        );
      }

      const clienteExiste =
        await prisma.lPCliente.findUnique({
          where: {
            id: clienteIdNumerico,
          },
          select: {
            id: true,
          },
        });

      if (!clienteExiste) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "El cliente seleccionado no existe.",
          },
          { status: 404 }
        );
      }

      datosActualizacion.clienteId =
        clienteIdNumerico;
    }

    if (fecha !== undefined) {
      if (
        typeof fecha !== "string" ||
        !fecha.trim()
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "La fecha no es válida.",
          },
          { status: 400 }
        );
      }

      datosActualizacion.fecha =
        crearFechaLocal(fecha);
    }

    if (tipo !== undefined) {
      if (!validarTipo(tipo)) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "El tipo de movimiento no es válido.",
            tiposValidos:
              TIPOS_VALIDOS,
          },
          { status: 400 }
        );
      }

      if (
        totalAplicado > 0 &&
        !esTipoAplicable(tipo)
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "No puedes convertir un pago aplicado en un débito o devolución.",
          },
          { status: 409 }
        );
      }

      datosActualizacion.tipo =
        tipo;
    }

    if (valor !== undefined) {
      if (!validarValor(valor)) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "El valor debe ser un número mayor que cero.",
          },
          { status: 400 }
        );
      }

      const valorNumerico =
        Number(valor);

      if (
        valorNumerico <
        totalAplicado
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              `El movimiento tiene ${totalAplicado.toFixed(
                2
              )} aplicados. El nuevo valor no puede ser inferior.`,
          },
          { status: 409 }
        );
      }

      datosActualizacion.valor =
        valorNumerico;
    }

    if (concepto !== undefined) {
      if (
        typeof concepto !== "string" ||
        !concepto.trim()
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message:
              "El concepto no es válido.",
          },
          { status: 400 }
        );
      }

      datosActualizacion.concepto =
        concepto.trim();
    }

    if (
      referencia !== undefined
    ) {
      datosActualizacion.referencia =
        normalizarTextoOpcional(
          referencia
        );
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
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No se enviaron datos para actualizar.",
        },
        { status: 400 }
      );
    }

    const movimientoActualizado =
      await prisma.lPMovimientoCliente.update({
        where: {
          id: movimientoId,
        },

        data:
          datosActualizacion,

        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },

          aplicacionesPago: {
            select: {
              valorAplicado: true,
            },
          },
        },
      });

    return NextResponse.json({
      status: "success",

      message:
        "Movimiento actualizado correctamente.",

      movimiento:
        serializarMovimiento(
          movimientoActualizado
        ),
    });
  } catch (error) {
    console.error(
      "Error actualizando movimiento del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al actualizar el movimiento del cliente.",
      },
      { status: 500 }
    );
  }
}

/*
 * DELETE
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
            "El id del movimiento no es válido.",
        },
        { status: 400 }
      );
    }

    const movimiento =
      await prisma.lPMovimientoCliente.findUnique({
        where: {
          id,
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
      return NextResponse.json(
        {
          status: "fail",
          message:
            "El movimiento no existe.",
        },
        { status: 404 }
      );
    }

    const totalAplicado =
      calcularTotalAplicado(
        movimiento.aplicacionesPago
      );

    if (totalAplicado > 0) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "No puedes eliminar un pago que ya tiene valores aplicados a ciclos. Primero elimina sus aplicaciones.",
        },
        { status: 409 }
      );
    }

    await prisma.lPMovimientoCliente.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      status: "success",
      message:
        "Movimiento eliminado correctamente.",
    });
  } catch (error) {
    console.error(
      "Error eliminando movimiento del cliente:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al eliminar el movimiento del cliente.",
      },
      { status: 500 }
    );
  }
}