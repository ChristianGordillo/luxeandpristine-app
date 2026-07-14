-- CreateEnum
CREATE TYPE "TipoCama" AS ENUM ('KING', 'QUEEN', 'TWIN', 'SOFA_CAMA');

-- CreateEnum
CREATE TYPE "LPTrabajoTipo" AS ENUM ('LIMPIEZA_INICIAL', 'LIMPIEZA', 'EXTRA', 'REPASO_LIMPIEZA');

-- CreateEnum
CREATE TYPE "LPRolOperativo" AS ENUM ('CLEANER', 'VOLANTE');

-- CreateEnum
CREATE TYPE "LPProgramacionEstado" AS ENUM ('PROGRAMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "LPRevisionEstado" AS ENUM ('SIN_NOVEDADES', 'NOVEDAD_REGISTRADA', 'INCIDENCIA_ABIERTA');

-- CreateEnum
CREATE TYPE "LPGastoCategoria" AS ENUM ('GASOLINA', 'REPUESTOS_CARRO', 'INSUMOS', 'TAXES', 'NOMINA', 'OTROS');

-- CreateTable
CREATE TABLE "LPUnidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "habitaciones" INTEGER NOT NULL,
    "banos" DOUBLE PRECISION NOT NULL,
    "camas" INTEGER,
    "camasDetalle" TEXT,
    "precio" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "clienteId" INTEGER NOT NULL,
    "edificioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPCliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPEdificio" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT DEFAULT 'Miami',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPEdificio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPTrabajoDiario" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "dia" TEXT NOT NULL,
    "tipo" "LPTrabajoTipo" NOT NULL DEFAULT 'LIMPIEZA',
    "precio" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "incidenciaAbierta" BOOLEAN NOT NULL DEFAULT false,
    "fechaCierreIncidencia" TIMESTAMP(3),
    "unidadId" INTEGER,
    "unidadManual" TEXT,
    "checkIn" BOOLEAN NOT NULL DEFAULT false,
    "revisionEstado" "LPRevisionEstado",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPTrabajoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPPagoPeriodo" (
    "id" SERIAL NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPPagoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPCleaner" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "paisOrigen" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPCleaner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPAsignacionTrabajo" (
    "id" SERIAL NOT NULL,
    "trabajoId" INTEGER NOT NULL,
    "cleanerId" INTEGER NOT NULL,
    "rol" "LPRolOperativo" NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPAsignacionTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPCostoOperativoDiario" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "concepto" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPCostoOperativoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPProgramacionTrabajo" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "dia" TEXT NOT NULL,
    "tipo" "LPTrabajoTipo" NOT NULL DEFAULT 'LIMPIEZA',
    "unidadId" INTEGER,
    "unidadManual" TEXT,
    "estado" "LPProgramacionEstado" NOT NULL DEFAULT 'PROGRAMADO',
    "checkIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPProgramacionTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPRopaPendiente" (
    "id" SERIAL NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cerradoAt" TIMESTAMP(3),

    CONSTRAINT "LPRopaPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPProveedorCompra" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPProveedorCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPCompra" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "categoria" "LPGastoCategoria" NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxes" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPCompraItem" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioBase" DOUBLE PRECISION NOT NULL,
    "taxAsignado" DOUBLE PRECISION NOT NULL,
    "precioFinal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPRopaManchada" (
    "id" SERIAL NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "cambiada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fechaCambio" TIMESTAMP(3),

    CONSTRAINT "LPRopaManchada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LPCliente_nombre_key" ON "LPCliente"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "LPEdificio_nombre_key" ON "LPEdificio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "LPPagoPeriodo_fechaInicio_fechaFin_key" ON "LPPagoPeriodo"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE UNIQUE INDEX "LPProveedorCompra_nombre_key" ON "LPProveedorCompra"("nombre");

-- AddForeignKey
ALTER TABLE "LPUnidad" ADD CONSTRAINT "LPUnidad_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "LPCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPUnidad" ADD CONSTRAINT "LPUnidad_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "LPEdificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPTrabajoDiario" ADD CONSTRAINT "LPTrabajoDiario_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "LPUnidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPAsignacionTrabajo" ADD CONSTRAINT "LPAsignacionTrabajo_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "LPTrabajoDiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPAsignacionTrabajo" ADD CONSTRAINT "LPAsignacionTrabajo_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "LPCleaner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPProgramacionTrabajo" ADD CONSTRAINT "LPProgramacionTrabajo_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "LPUnidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPRopaPendiente" ADD CONSTRAINT "LPRopaPendiente_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "LPUnidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPCompra" ADD CONSTRAINT "LPCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "LPProveedorCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPCompraItem" ADD CONSTRAINT "LPCompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "LPCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPRopaManchada" ADD CONSTRAINT "LPRopaManchada_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "LPUnidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
