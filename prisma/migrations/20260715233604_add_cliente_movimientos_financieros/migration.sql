-- CreateEnum
CREATE TYPE "LPMovimientoClienteTipo" AS ENUM ('ABONO', 'AJUSTE_CREDITO', 'AJUSTE_DEBITO', 'DEVOLUCION');

-- CreateTable
CREATE TABLE "LPMovimientoCliente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "LPMovimientoClienteTipo" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPMovimientoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LPMovimientoCliente_clienteId_idx" ON "LPMovimientoCliente"("clienteId");

-- CreateIndex
CREATE INDEX "LPMovimientoCliente_fecha_idx" ON "LPMovimientoCliente"("fecha");

-- CreateIndex
CREATE INDEX "LPMovimientoCliente_clienteId_fecha_idx" ON "LPMovimientoCliente"("clienteId", "fecha");

-- AddForeignKey
ALTER TABLE "LPMovimientoCliente" ADD CONSTRAINT "LPMovimientoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "LPCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
