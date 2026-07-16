/*
  Warnings:

  - You are about to drop the column `fechaInicioSaldo` on the `LPCliente` table. All the data in the column will be lost.
  - You are about to drop the column `usaSaldoAnticipado` on the `LPCliente` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LPCicloClienteTipo" AS ENUM ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'PERSONALIZADO');

-- AlterTable
ALTER TABLE "LPCliente" DROP COLUMN "fechaInicioSaldo",
DROP COLUMN "usaSaldoAnticipado";

-- AlterTable
ALTER TABLE "LPMovimientoCliente" ADD COLUMN     "referencia" TEXT;

-- CreateTable
CREATE TABLE "LPCicloCliente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "tipo" "LPCicloClienteTipo" NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "concepto" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPCicloCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LPAplicacionPagoCliente" (
    "id" SERIAL NOT NULL,
    "movimientoId" INTEGER NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "valorAplicado" DECIMAL(10,2) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPAplicacionPagoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LPCicloCliente_clienteId_idx" ON "LPCicloCliente"("clienteId");

-- CreateIndex
CREATE INDEX "LPCicloCliente_fechaInicio_idx" ON "LPCicloCliente"("fechaInicio");

-- CreateIndex
CREATE INDEX "LPCicloCliente_fechaFin_idx" ON "LPCicloCliente"("fechaFin");

-- CreateIndex
CREATE INDEX "LPCicloCliente_clienteId_fechaInicio_fechaFin_idx" ON "LPCicloCliente"("clienteId", "fechaInicio", "fechaFin");

-- CreateIndex
CREATE UNIQUE INDEX "LPCicloCliente_clienteId_fechaInicio_fechaFin_key" ON "LPCicloCliente"("clienteId", "fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "LPAplicacionPagoCliente_movimientoId_idx" ON "LPAplicacionPagoCliente"("movimientoId");

-- CreateIndex
CREATE INDEX "LPAplicacionPagoCliente_cicloId_idx" ON "LPAplicacionPagoCliente"("cicloId");

-- CreateIndex
CREATE UNIQUE INDEX "LPAplicacionPagoCliente_movimientoId_cicloId_key" ON "LPAplicacionPagoCliente"("movimientoId", "cicloId");

-- CreateIndex
CREATE INDEX "LPMovimientoCliente_tipo_idx" ON "LPMovimientoCliente"("tipo");

-- AddForeignKey
ALTER TABLE "LPCicloCliente" ADD CONSTRAINT "LPCicloCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "LPCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPAplicacionPagoCliente" ADD CONSTRAINT "LPAplicacionPagoCliente_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "LPMovimientoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LPAplicacionPagoCliente" ADD CONSTRAINT "LPAplicacionPagoCliente_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "LPCicloCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
