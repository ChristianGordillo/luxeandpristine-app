import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const edificios = await prisma.lPEdificio.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ status: "success", edificios });
  } catch (error) {
    console.error("Error al listar edificios:", error);
    return NextResponse.json(
      { status: "fail", message: "Error al listar edificios" },
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

    const edificio = await prisma.lPEdificio.create({
      data: { nombre },
    });

    return NextResponse.json({ status: "success", edificio });
  } catch (error) {
    console.error("Error al crear edificio:", error);
    return NextResponse.json(
      { status: "fail", message: "Error al crear edificio" },
      { status: 500 }
    );
  }
}