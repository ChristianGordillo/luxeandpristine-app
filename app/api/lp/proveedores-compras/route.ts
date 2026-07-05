import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const proveedores = await prisma.lPProveedorCompra.findMany({
      where: {
        activo: true,
      },
      orderBy: {
        nombre: "asc",
      },
    });

    return NextResponse.json({
      status: "success",
      proveedores,
    });
  } catch (error) {
    console.error("Error al listar proveedores de compras:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al listar proveedores" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();

    if (!nombre) {
      return NextResponse.json(
        { status: "fail", message: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const existente = await prisma.lPProveedorCompra.findUnique({
      where: {
        nombre,
      },
    });

    if (existente) {
      return NextResponse.json(
        { status: "fail", message: "Este proveedor ya existe" },
        { status: 400 }
      );
    }

    const proveedor = await prisma.lPProveedorCompra.create({
      data: {
        nombre,
      },
    });

    return NextResponse.json({
      status: "success",
      proveedor,
    });
  } catch (error) {
    console.error("Error al crear proveedor de compra:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al crear proveedor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nombre, activo } = body;

    if (!id) {
      return NextResponse.json(
        { status: "fail", message: "ID requerido" },
        { status: 400 }
      );
    }

    const proveedor = await prisma.lPProveedorCompra.update({
      where: {
        id: Number(id),
      },
      data: {
        ...(nombre !== undefined ? { nombre: String(nombre).trim() } : {}),
        ...(activo !== undefined ? { activo: Boolean(activo) } : {}),
      },
    });

    return NextResponse.json({
      status: "success",
      proveedor,
    });
  } catch (error) {
    console.error("Error al actualizar proveedor de compra:", error);

    return NextResponse.json(
      { status: "fail", message: "Error al actualizar proveedor" },
      { status: 500 }
    );
  }
}