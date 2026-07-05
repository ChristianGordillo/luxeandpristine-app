import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado");

    const unidades = await prisma.lPUnidad.findMany({
      where:
        estado === "activas"
          ? { activo: true }
          : estado === "inactivas"
          ? { activo: false }
          : {},
      include: {
        cliente: true,
        edificio: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ status: "success", unidades });
  } catch (error) {
    console.error("Error al listar unidades:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar unidades" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      nombre,
      habitaciones,
      banos,
      camas,
      camasDetalle,
      precio,
      clienteNombre,
      edificioNombre,
    } = body;

    if (
      !nombre ||
      !clienteNombre ||
      !edificioNombre ||
      habitaciones === undefined ||
      banos === undefined ||
      precio === undefined
    ) {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    const cliente = await prisma.lPCliente.upsert({
      where: { nombre: clienteNombre },
      update: {},
      create: { nombre: clienteNombre },
    });

    const edificio = await prisma.lPEdificio.upsert({
      where: { nombre: edificioNombre },
      update: {},
      create: { nombre: edificioNombre },
    });

    const unidad = await prisma.lPUnidad.create({
      data: {
        nombre,
        habitaciones: Number(habitaciones),
        banos: Number(banos),

        camas: camas !== undefined && camas !== "" ? Number(camas) : null,

        camasDetalle:
          camasDetalle && camasDetalle !== "" ? camasDetalle : null,

        precio: Number(precio),

        activo: true,

        clienteId: cliente.id,
        edificioId: edificio.id,
      },
      include: {
        cliente: true,
        edificio: true,
      },
    });

    return NextResponse.json({ status: "success", unidad });
  } catch (error) {
    console.error("Error al crear unidad:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear unidad" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      nombre,
      habitaciones,
      banos,
      camas,
      camasDetalle,
      precio,
      clienteNombre,
      edificioNombre,
      activo,
    } = body;

    if (!id) {
      return NextResponse.json(
        { status: "fail", message: "El ID es obligatorio" },
        { status: 400 }
      );
    }

    let clienteId: number | undefined;
    let edificioId: number | undefined;

    if (clienteNombre) {
      const cliente = await prisma.lPCliente.upsert({
        where: { nombre: clienteNombre },
        update: {},
        create: { nombre: clienteNombre },
      });

      clienteId = cliente.id;
    }

    if (edificioNombre) {
      const edificio = await prisma.lPEdificio.upsert({
        where: { nombre: edificioNombre },
        update: {},
        create: { nombre: edificioNombre },
      });

      edificioId = edificio.id;
    }

    const unidad = await prisma.lPUnidad.update({
      where: {
        id: Number(id),
      },
      data: {
        ...(nombre !== undefined && { nombre }),

        ...(habitaciones !== undefined && habitaciones !== "" && {
          habitaciones: Number(habitaciones),
        }),

        ...(banos !== undefined && banos !== "" && {
          banos: Number(banos),
        }),

        ...(camas !== undefined && {
          camas: camas !== "" ? Number(camas) : null,
        }),

        ...(camasDetalle !== undefined && {
          camasDetalle: camasDetalle !== "" ? camasDetalle : null,
        }),

        ...(precio !== undefined && precio !== "" && {
          precio: Number(precio),
        }),

        ...(activo !== undefined && { activo: Boolean(activo) }),

        ...(clienteId !== undefined && { clienteId }),
        ...(edificioId !== undefined && { edificioId }),
      },
      include: {
        cliente: true,
        edificio: true,
      },
    });

    return NextResponse.json({ status: "success", unidad });
  } catch (error) {
    console.error("Error al actualizar unidad:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar unidad" },
      { status: 500 }
    );
  }
}