import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const clientes = await prisma.lPCliente.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ status: "success", clientes });
  } catch (error) {
    console.error("Error al listar clientes:", error);
    return NextResponse.json(
      { status: "fail", message: "Error al listar clientes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nombre } = await request.json();

    if (!nombre) {
      return NextResponse.json(
        { status: "fail", message: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const cliente = await prisma.lPCliente.create({
      data: { nombre },
    });

    return NextResponse.json({ status: "success", cliente });
  } catch (error) {
    console.error("Error al crear cliente:", error);
    return NextResponse.json(
      { status: "fail", message: "Error al crear cliente" },
      { status: 500 }
    );
  }
}