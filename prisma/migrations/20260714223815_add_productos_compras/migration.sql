-- AlterTable
ALTER TABLE "LPCompraItem" ADD COLUMN     "productoId" INTEGER;

-- CreateTable
CREATE TABLE "LPProductoCompra" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "marca" TEXT,
    "presentacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LPProductoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LPProductoCompra_nombreNormalizado_key" ON "LPProductoCompra"("nombreNormalizado");

-- CreateIndex
CREATE INDEX "LPProductoCompra_nombre_idx" ON "LPProductoCompra"("nombre");

-- CreateIndex
CREATE INDEX "LPProductoCompra_marca_idx" ON "LPProductoCompra"("marca");

-- CreateIndex
CREATE INDEX "LPProductoCompra_activo_idx" ON "LPProductoCompra"("activo");

-- CreateIndex
CREATE INDEX "LPCompra_fecha_idx" ON "LPCompra"("fecha");

-- CreateIndex
CREATE INDEX "LPCompra_categoria_idx" ON "LPCompra"("categoria");

-- CreateIndex
CREATE INDEX "LPCompra_proveedorId_idx" ON "LPCompra"("proveedorId");

-- CreateIndex
CREATE INDEX "LPCompraItem_compraId_idx" ON "LPCompraItem"("compraId");

-- CreateIndex
CREATE INDEX "LPCompraItem_productoId_idx" ON "LPCompraItem"("productoId");

-- CreateIndex
CREATE INDEX "LPCompraItem_nombre_idx" ON "LPCompraItem"("nombre");

-- CreateIndex
CREATE INDEX "LPProveedorCompra_activo_idx" ON "LPProveedorCompra"("activo");

-- AddForeignKey
ALTER TABLE "LPCompraItem" ADD CONSTRAINT "LPCompraItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "LPProductoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
