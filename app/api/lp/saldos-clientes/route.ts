import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function crearFechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00.000Z`);
}

function fechaKey(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toISOString().split("T")[0];
}

function calcularValorMovimiento(
  tipo: "ABONO" | "AJUSTE_CREDITO" | "AJUSTE_DEBITO" | "DEVOLUCION",
  valor: number
) {
  if (tipo === "ABONO" || tipo === "AJUSTE_CREDITO") {
    return valor;
  }

  return -valor;
}

/*
 * GET
 *
 * Devuelve todos los clientes con su configuración y saldo actual.
 */
export async function GET() {
  try {
    const clientes = await prisma.lPCliente.findMany({
      select: {
        id: true,
        nombre: true,
        usaSaldoAnticipado: true,
        fechaInicioSaldo: true,
      },
      orderBy: {
        nombre: "asc",
      },
    });

    const clientesConSaldo = await Promise.all(
      clientes.map(async (cliente) => {
        if (
          !cliente.usaSaldoAnticipado ||
          !cliente.fechaInicioSaldo
        ) {
          return {
            id: cliente.id,
            nombre: cliente.nombre,
            usaSaldoAnticipado: cliente.usaSaldoAnticipado,
            fechaInicioSaldo: fechaKey(cliente.fechaInicioSaldo),

            totalAbonos: 0,
            totalCreditos: 0,
            totalTrabajos: 0,
            cantidadTrabajos: 0,
            totalDebitosManuales: 0,
            saldoActual: 0,
          };
        }

        const [movimientos, trabajos] = await Promise.all([
          prisma.lPMovimientoCliente.findMany({
            where: {
              clienteId: cliente.id,
              fecha: {
                gte: cliente.fechaInicioSaldo,
              },
            },
            select: {
              tipo: true,
              valor: true,
            },
          }),

          prisma.lPTrabajoDiario.findMany({
            where: {
              unidad: {
                clienteId: cliente.id,
              },
              fecha: {
                gte: cliente.fechaInicioSaldo,
              },
            },
            select: {
              precio: true,
            },
          }),
        ]);

        const resumenMovimientos = movimientos.reduce(
          (acc, movimiento) => {
            const valor = Number(movimiento.valor || 0);

            const valorFirmado = calcularValorMovimiento(
              movimiento.tipo,
              valor
            );

            if (movimiento.tipo === "ABONO") {
              acc.totalAbonos += valor;
            }

            if (
              movimiento.tipo === "ABONO" ||
              movimiento.tipo === "AJUSTE_CREDITO"
            ) {
              acc.totalCreditos += valor;
            }

            if (
              movimiento.tipo === "AJUSTE_DEBITO" ||
              movimiento.tipo === "DEVOLUCION"
            ) {
              acc.totalDebitosManuales += valor;
            }

            acc.saldoMovimientos += valorFirmado;

            return acc;
          },
          {
            totalAbonos: 0,
            totalCreditos: 0,
            totalDebitosManuales: 0,
            saldoMovimientos: 0,
          }
        );

        const totalTrabajos = trabajos.reduce(
          (acc, trabajo) => acc + Number(trabajo.precio || 0),
          0
        );

        return {
          id: cliente.id,
          nombre: cliente.nombre,
          usaSaldoAnticipado: cliente.usaSaldoAnticipado,
          fechaInicioSaldo: fechaKey(cliente.fechaInicioSaldo),

          totalAbonos: resumenMovimientos.totalAbonos,
          totalCreditos: resumenMovimientos.totalCreditos,
          totalTrabajos,
          cantidadTrabajos: trabajos.length,
          totalDebitosManuales:
            resumenMovimientos.totalDebitosManuales,

          saldoActual:
            resumenMovimientos.saldoMovimientos - totalTrabajos,
        };
      })
    );

    return NextResponse.json({
      status: "success",
      clientes: clientesConSaldo,
    });
  } catch (error) {
    console.error(
      "Error consultando saldos de clientes:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al consultar los saldos de clientes.",
      },
      { status: 500 }
    );
  }
}

/*
 * PATCH
 *
 * Activa, desactiva o cambia la fecha inicial.
 *
 * Body:
 *
 * {
 *   "clienteId": 3,
 *   "usaSaldoAnticipado": true,
 *   "fechaInicioSaldo": "2026-07-15"
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      clienteId,
      usaSaldoAnticipado,
      fechaInicioSaldo,
    } = body;

    const clienteIdNumerico = Number(clienteId);

    if (
      !Number.isInteger(clienteIdNumerico) ||
      clienteIdNumerico <= 0
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message: "El cliente indicado no es válido.",
        },
        { status: 400 }
      );
    }

    if (typeof usaSaldoAnticipado !== "boolean") {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes indicar si el cliente usa saldo anticipado.",
        },
        { status: 400 }
      );
    }

    if (
      usaSaldoAnticipado &&
      (
        typeof fechaInicioSaldo !== "string" ||
        !fechaInicioSaldo.trim()
      )
    ) {
      return NextResponse.json(
        {
          status: "fail",
          message:
            "Debes indicar la fecha de inicio del saldo.",
        },
        { status: 400 }
      );
    }

    const clienteExiste = await prisma.lPCliente.findUnique({
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
          message: "El cliente no existe.",
        },
        { status: 404 }
      );
    }

    const clienteActualizado = await prisma.lPCliente.update({
      where: {
        id: clienteIdNumerico,
      },
      data: {
        usaSaldoAnticipado,

        /*
         * Al desactivarlo dejamos la fecha en null.
         * Los movimientos manuales no se eliminan.
         */
        fechaInicioSaldo: usaSaldoAnticipado
          ? crearFechaLocal(fechaInicioSaldo)
          : null,
      },
      select: {
        id: true,
        nombre: true,
        usaSaldoAnticipado: true,
        fechaInicioSaldo: true,
      },
    });

    return NextResponse.json({
      status: "success",
      message: usaSaldoAnticipado
        ? "Saldo anticipado activado correctamente."
        : "Saldo anticipado desactivado correctamente.",

      cliente: {
        ...clienteActualizado,
        fechaInicioSaldo: fechaKey(
          clienteActualizado.fechaInicioSaldo
        ),
      },
    });
  } catch (error) {
    console.error(
      "Error actualizando configuración de saldo:",
      error
    );

    return NextResponse.json(
      {
        status: "fail",
        message:
          "Error al actualizar la configuración del cliente.",
      },
      { status: 500 }
    );
  }
}