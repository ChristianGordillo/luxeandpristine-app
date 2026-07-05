import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const cleaners = await prisma.lPCleaner.findMany({
      orderBy: {
        nombre: "asc",
      },
    });

    return NextResponse.json({
      status: "success",
      cleaners,
    });
  } catch (error) {
    console.error("Error al listar cleaners:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar cleaners" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { nombre, telefono, paisOrigen } = body;

    if (!nombre || nombre.trim() === "") {
      return NextResponse.json(
        { status: "fail", message: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const cleaner = await prisma.lPCleaner.create({
      data: {
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        paisOrigen: paisOrigen?.trim() || null,
      },
    });

    return NextResponse.json({
      status: "success",
      cleaner,
    });
  } catch (error) {
    console.error("Error al crear cleaner:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear cleaner" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, nombre, telefono, paisOrigen, activo } = body;

    if (!id || !nombre || nombre.trim() === "") {
      return NextResponse.json(
        { status: "fail", message: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    const cleaner = await prisma.lPCleaner.update({
      where: {
        id: Number(id),
      },
      data: {
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        paisOrigen: paisOrigen?.trim() || null,
        activo: activo === undefined ? true : Boolean(activo),
      },
    });

    return NextResponse.json({
      status: "success",
      cleaner,
    });
  } catch (error) {
    console.error("Error al actualizar cleaner:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar cleaner" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { status: "fail", message: "ID requerido" },
        { status: 400 }
      );
    }

    await prisma.lPCleaner.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Cleaner eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar cleaner:", error);

    return NextResponse.json(
      {
        status: "fail",
        message:
          "No se pudo eliminar. Puede que este cleaner ya tenga asignaciones registradas.",
      },
      { status: 500 }
    );
  }
}