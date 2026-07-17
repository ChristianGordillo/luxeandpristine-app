"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams } from "next/navigation";

import ResumenNavigation from "@/app/components/lp/ResumenNavigation";

import DetalleCuentaCiclos from "./DetalleCuentaCiclos";
import DetalleSaldoAnticipado from "./DetalleSaldoAnticipado";

type Cliente = {
  id: number;
  nombre: string;
  modalidadCuenta:
    | "SALDO_ANTICIPADO"
    | "CICLOS";

  usaSaldoAnticipado: boolean;

  fechaInicioSaldo:
    | string
    | null;

  fechaInicioCuenta:
    | string
    | null;
};

type EstadoCuentaResponse = {
  status:
    | "success"
    | "fail";

  message?: string;

  cliente?: Cliente;
};

export default function SaldoClientePage() {
  const params = useParams();

  const clienteIdParam =
    Array.isArray(
      params.clienteId
    )
      ? params.clienteId[0]
      : params.clienteId;

  const clienteId =
    Number(clienteIdParam);

  const [
    cliente,
    setCliente,
  ] =
    useState<Cliente | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const cargarModalidad =
    useCallback(async () => {
      if (
        !Number.isInteger(
          clienteId
        ) ||
        clienteId <= 0
      ) {
        setError(
          "El cliente indicado no es válido."
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `/api/lp/estado-cuenta-cliente?clienteId=${clienteId}`,
            {
              cache:
                "no-store",
            }
          );

        const data: EstadoCuentaResponse =
          await response.json();

        if (
          !response.ok ||
          data.status !==
            "success" ||
          !data.cliente
        ) {
          throw new Error(
            data.message ||
              "No fue posible cargar el cliente."
          );
        }

        setCliente(
          data.cliente
        );
      } catch (error) {
        console.error(
          "Error identificando modalidad de cuenta:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "No fue posible cargar el cliente."
        );
      } finally {
        setLoading(false);
      }
    }, [clienteId]);

  useEffect(() => {
    cargarModalidad();
  }, [cargarModalidad]);

  return (
    <div className="space-y-6 pb-24">
      <ResumenNavigation />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-lp-navy">
            Cargando cuenta del cliente...
          </p>
        </div>
      ) : (
        <>
          {!error &&
            cliente &&
            cliente.usaSaldoAnticipado && (
              <DetalleSaldoAnticipado
                clienteId={
                  clienteId
                }
              />
            )}

          {!error &&
            cliente &&
            !cliente.usaSaldoAnticipado && (
              <DetalleCuentaCiclos />
            )}
        </>
      )}
    </div>
  );
}