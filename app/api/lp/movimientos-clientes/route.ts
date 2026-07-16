import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LPMovimientoClienteTipo } from "@prisma/client";

const TIPOS_VALIDOS = Object.values(LPMovimientoClienteTipo);

function crearFechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00.000Z`);
}

function crearRangoFechas(desde?: string | null, hasta?: string | null) {
  return {
    ...(desde
      ? {
          gte: new Date(`${desde}T00:00:00.000Z`),
        }
      : {}),
    ...(hasta
      ? {
          lte: new Date(`${hasta}T23:59:59.999Z`),
        }
      : {}),
  };
}

function serializarMovimiento<
  T extends {
    valor: unknown;
    fecha: Date;
  }
>(movimiento: T) {
  return {
    ...movimiento,
    valor: Number(movimiento.valor || 0),
    fecha: movimiento.fecha.toISOString().split("T")[0],
  };
}

function validarTipo(
  tipo: unknown
): tipo is LPMovimientoClienteTipo {
  return (
    typeof tipo === "string" &&
    TIPOS_VALIDOS.includes(tipo as LPMovimientoClienteTipo)
  );
}

function validarValor(valor: unknown) {
  const valorNumerico = Number(valor);

  return (
    Number.isFinite(valorNumerico) &&
    valorNumerico > 0
  );
}

/*
 * GET
 *
 * Consulta movimientos financieros.
 *
 * Ejemplos:
 *
 * /api/lp/movimientos-clientes
 * /api/lp/movimientos-clientes?clienteId=3
 * /api/lp/movimientos-clientes?clienteId=3&desde=2026-07-01&hasta=2026-07-31
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const clienteIdParam = searchParams.get("clienteId");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    const clienteId = clienteIdParam
      ? Number(clienteIdParam)
      : null;

    if (
      clienteIdParam &&
      (!Number.isInteger(clienteId) || Number(clienteId) <= 0)
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El clienteId no es válido.",
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

    const rangoFechas = crearRangoFechas(desde, hasta);

    const movimientos =
      await prisma.lPMovimientoCliente.findMany({
        where: {
          ...(clienteId
            ? {
                clienteId,
              }
            : {}),
          ...(Object.keys(rangoFechas).length > 0
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

    const movimientosSerializados = movimientos.map(
      serializarMovimiento
    );

    const resumen = movimientos.reduce(
      (acc, movimiento) => {
        const valor = Number(movimiento.valor || 0);

        if (
          movimiento.tipo ===
            LPMovimientoClienteTipo.ABONO ||
          movimiento.tipo ===
            LPMovimientoClienteTipo.AJUSTE_CREDITO
        ) {
          acc.creditos += valor;
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
      }
    );

    return NextResponse.json({
      status: "success",
      movimientos: movimientosSerializados,
      resumen: {
        cantidad: movimientos.length,
        totalCreditos: resumen.creditos,
        totalDebitos: resumen.debitos,
        saldoMovimientos:
          resumen.creditos - resumen.debitos,
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
 *
 * Registra un nuevo abono, ajuste o devolución.
 *
 * Body:
 *
 * {
 *   "clienteId": 3,
 *   "fecha": "2026-07-15",
 *   "tipo": "ABONO",
 *   "valor": 1000,
 *   "concepto": "Initial advance payment",
 *   "notas": "Advance for future cleaning services"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      clienteId,
      fecha,
      tipo,
      valor,
      concepto,
      notas,
    } = body;

    const clienteIdNumerico = Number(clienteId);

    if (
      !Number.isInteger(clienteIdNumerico) ||
      clienteIdNumerico <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Debes seleccionar un cliente válido.",
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
          message: "Debes indicar la fecha.",
        },
        { status: 400 }
      );
    }

    if (!validarTipo(tipo)) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El tipo de movimiento no es válido.",
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
          message: "Debes ingresar un concepto.",
        },
        { status: 400 }
      );
    }

    const cliente = await prisma.lPCliente.findUnique({
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
          message: "El cliente seleccionado no existe.",
        },
        { status: 404 }
      );
    }

    const movimiento =
      await prisma.lPMovimientoCliente.create({
        data: {
          clienteId: clienteIdNumerico,
          fecha: crearFechaLocal(fecha),
          tipo,
          valor: Number(valor),
          concepto: concepto.trim(),
          notas:
            typeof notas === "string" &&
            notas.trim()
              ? notas.trim()
              : null,
        },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

    return NextResponse.json(
      {
        status: "success",
        message: "Movimiento registrado correctamente.",
        movimiento: serializarMovimiento(movimiento),
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
 *
 * Actualiza un movimiento existente.
 *
 * Body:
 *
 * {
 *   "id": 1,
 *   "fecha": "2026-07-15",
 *   "tipo": "ABONO",
 *   "valor": 1000,
 *   "concepto": "Initial advance payment",
 *   "notas": ""
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      clienteId,
      fecha,
      tipo,
      valor,
      concepto,
      notas,
    } = body;

    const movimientoId = Number(id);

    if (
      !Number.isInteger(movimientoId) ||
      movimientoId <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El id del movimiento no es válido.",
        },
        { status: 400 }
      );
    }

    const movimientoActual =
      await prisma.lPMovimientoCliente.findUnique({
        where: {
          id: movimientoId,
        },
      });

    if (!movimientoActual) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El movimiento no existe.",
        },
        { status: 404 }
      );
    }

    const datosActualizacion: {
      clienteId?: number;
      fecha?: Date;
      tipo?: LPMovimientoClienteTipo;
      valor?: number;
      concepto?: string;
      notas?: string | null;
    } = {};

    if (
      clienteId !== undefined &&
      clienteId !== null
    ) {
      const clienteIdNumerico = Number(clienteId);

      if (
        !Number.isInteger(clienteIdNumerico) ||
        clienteIdNumerico <= 0
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message: "El clienteId no es válido.",
          },
          { status: 400 }
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
            message: "El cliente seleccionado no existe.",
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
            message: "La fecha no es válida.",
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
            tiposValidos: TIPOS_VALIDOS,
          },
          { status: 400 }
        );
      }

      datosActualizacion.tipo = tipo;
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

      datosActualizacion.valor = Number(valor);
    }

    if (concepto !== undefined) {
      if (
        typeof concepto !== "string" ||
        !concepto.trim()
      ) {
        return NextResponse.json(
          {
            status: "fail",
            message: "El concepto no es válido.",
          },
          { status: 400 }
        );
      }

      datosActualizacion.concepto =
        concepto.trim();
    }

    if (notas !== undefined) {
      datosActualizacion.notas =
        typeof notas === "string" &&
        notas.trim()
          ? notas.trim()
          : null;
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

    const movimientoActualizado =
      await prisma.lPMovimientoCliente.update({
        where: {
          id: movimientoId,
        },
        data: datosActualizacion,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

    return NextResponse.json({
      status: "success",
      message: "Movimiento actualizado correctamente.",
      movimiento: serializarMovimiento(
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
 *
 * Ejemplo:
 *
 * /api/lp/movimientos-clientes?id=1
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
          message: "El id del movimiento no es válido.",
        },
        { status: 400 }
      );
    }

    const movimiento =
      await prisma.lPMovimientoCliente.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
        },
      });

    if (!movimiento) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El movimiento no existe.",
        },
        { status: 404 }
      );
    }

    await prisma.lPMovimientoCliente.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Movimiento eliminado correctamente.",
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