import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();

    const unidades = await prisma.lPUnidad.findMany({
      where: search
        ? {
            OR: [
              {
                nombre: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                edificio: {
                  nombre: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : undefined,
      include: {
        edificio: true,
        cliente: true,
        trabajos: {
          orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
          include: {
            asignaciones: {
              include: {
                cleaner: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
      orderBy: [
        {
          edificio: {
            nombre: "asc",
          },
        },
        {
          nombre: "asc",
        },
      ],
    });

    const trazabilidad = unidades.map((unidad) => {
      const ultimoTrabajo = unidad.trabajos[0] || null;

      return {
        id: unidad.id,
        nombre: unidad.nombre,
        habitaciones: unidad.habitaciones,
        banos: unidad.banos,
        precio: unidad.precio,
        edificio: unidad.edificio,
        cliente: unidad.cliente,

        ultimoTrabajo: ultimoTrabajo
          ? {
              id: ultimoTrabajo.id,
              fecha: ultimoTrabajo.fecha,
              dia: ultimoTrabajo.dia,
              tipo: ultimoTrabajo.tipo,
              precio: ultimoTrabajo.precio,
              notas: ultimoTrabajo.notas,
              asignaciones: ultimoTrabajo.asignaciones,
            }
          : null,

        historial: unidad.trabajos.map((trabajo) => ({
          id: trabajo.id,
          fecha: trabajo.fecha,
          dia: trabajo.dia,
          tipo: trabajo.tipo,
          precio: trabajo.precio,
          notas: trabajo.notas,
          asignaciones: trabajo.asignaciones,
        })),
      };
    });

    return NextResponse.json({
      status: "success",
      trazabilidad,
    });
  } catch (error) {
    console.error("Error al generar trazabilidad:", error);

    return NextResponse.json(
      {
        status: "fail",
        message: "Error al generar trazabilidad",
      },
      { status: 500 }
    );
  }
}