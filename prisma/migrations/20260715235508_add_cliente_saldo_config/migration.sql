-- AlterTable
ALTER TABLE "LPCliente" ADD COLUMN     "fechaInicioSaldo" TIMESTAMP(3),
ADD COLUMN     "usaSaldoAnticipado" BOOLEAN NOT NULL DEFAULT false;
