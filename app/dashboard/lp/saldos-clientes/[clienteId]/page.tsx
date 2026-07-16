"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ResumenNavigation from "@/app/components/lp/ResumenNavigation";

type MovimientoTipo =
  | "ABONO"
  | "AJUSTE_CREDITO"
  | "AJUSTE_DEBITO"
  | "DEVOLUCION";

type Cliente = {
  id: number;
  nombre: string;
};

type ResumenEstadoCuenta = {
  saldoInicial: number;
  totalAbonos: number;
  totalAjustesCredito: number;
  totalTrabajos: number;
  cantidadTrabajos: number;
  totalAjustesDebito: number;
  totalDevoluciones: number;
  totalCreditos: number;
  totalDebitos: number;
  saldoFinal: number;
};

type MovimientoEstadoCuenta = {
  id: string;
  referenciaId: number;
  fecha: string;
  origen: "MOVIMIENTO" | "TRABAJO";
  tipo: string;
  naturaleza: "CREDITO" | "DEBITO";
  concepto: string;
  descripcion: string;
  cliente: string;
  edificio: string | null;
  unidad: string | null;
  tipoUnidad: string | null;
  tipoTrabajo: string | null;
  credito: number;
  debito: number;
  notas: string | null;
  saldo: number;
};

type EstadoCuentaResponse = {
  status: "success" | "fail";
  message?: string;
  cliente?: Cliente;
  resumen?: ResumenEstadoCuenta;
  movimientos?: MovimientoEstadoCuenta[];
};

type MovimientoManualResponse = {
  status: "success" | "fail";
  message?: string;
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(fecha: string) {
  const fechaLimpia = fecha.split("T")[0];
  const [year, month, day] = fechaLimpia.split("-");

  return `${month}/${day}/${year}`;
}

function formatTipo(tipo: string) {
  const etiquetas: Record<string, string> = {
    ABONO: "Abono",
    AJUSTE_CREDITO: "Ajuste a favor",
    AJUSTE_DEBITO: "Ajuste débito",
    DEVOLUCION: "Devolución",
    LIMPIEZA: "Limpieza",
    REPASO: "Repaso",
  };

  return (
    etiquetas[tipo] ||
    tipo
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^\w/, (letra) => letra.toUpperCase())
  );
}

function esMovimientoManual(movimiento: MovimientoEstadoCuenta) {
  return movimiento.origen === "MOVIMIENTO";
}

export default function SaldoClientePage() {
  const params = useParams();

  const clienteIdParam = Array.isArray(params.clienteId)
    ? params.clienteId[0]
    : params.clienteId;

  const clienteId = Number(clienteIdParam);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [resumen, setResumen] = useState<ResumenEstadoCuenta | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoEstadoCuenta[]>([]);

  /*
   * Dejamos el rango vacío inicialmente para consultar
   * todo el historial del cliente.
   */
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [fecha, setFecha] = useState(getTodayInputValue());
  const [tipo, setTipo] = useState<MovimientoTipo>("ABONO");
  const [valor, setValor] = useState("");
  const [concepto, setConcepto] = useState("");
  const [notas, setNotas] = useState("");

  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargarEstadoCuenta = useCallback(async () => {
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      setError("El cliente indicado no es válido.");
      setLoading(false);
      return;
    }

    if (desde && hasta && desde > hasta) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        clienteId: String(clienteId),
      });

      if (desde) query.set("desde", desde);
      if (hasta) query.set("hasta", hasta);

      const response = await fetch(
        `/api/lp/estado-cuenta-cliente?${query.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data: EstadoCuentaResponse = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message || "No fue posible consultar el estado de cuenta."
        );
      }

      setCliente(data.cliente || null);
      setResumen(data.resumen || null);
      setMovimientos(data.movimientos || []);
    } catch (error) {
      console.error("Error cargando estado de cuenta:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No fue posible consultar el estado de cuenta."
      );

      setCliente(null);
      setResumen(null);
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, desde, hasta]);

  useEffect(() => {
    cargarEstadoCuenta();
  }, [cargarEstadoCuenta]);

  const limpiarFormulario = () => {
    setEditandoId(null);
    setFecha(getTodayInputValue());
    setTipo("ABONO");
    setValor("");
    setConcepto("");
    setNotas("");
  };

  const guardarMovimiento = async () => {
    if (!fecha || !valor || !concepto.trim()) {
      alert("Completa fecha, valor y concepto.");
      return;
    }

    const valorNumerico = Number(valor);

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      alert("El valor debe ser mayor que cero.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/lp/movimientos-clientes", {
        method: editandoId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editandoId ? { id: editandoId } : { clienteId }),
          fecha,
          tipo,
          valor: valorNumerico,
          concepto: concepto.trim(),
          notas: notas.trim(),
        }),
      });

      const data: MovimientoManualResponse = await response.json();

      if (!response.ok || data.status !== "success") {
        alert(data.message || "No fue posible guardar el movimiento.");
        return;
      }

      limpiarFormulario();
      await cargarEstadoCuenta();
    } catch (error) {
      console.error("Error guardando movimiento:", error);
      alert("No fue posible guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  };

  const editarMovimiento = (movimiento: MovimientoEstadoCuenta) => {
    if (!esMovimientoManual(movimiento)) return;

    setEditandoId(movimiento.referenciaId);
    setFecha(movimiento.fecha);
    setTipo(movimiento.tipo as MovimientoTipo);

    const importe =
      movimiento.credito > 0 ? movimiento.credito : movimiento.debito;

    setValor(String(importe));
    setConcepto(movimiento.concepto);
    setNotas(movimiento.notas || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const eliminarMovimiento = async (
    movimiento: MovimientoEstadoCuenta
  ) => {
    if (!esMovimientoManual(movimiento)) return;

    const confirmar = window.confirm(
      `¿Eliminar el movimiento "${movimiento.concepto}"?`
    );

    if (!confirmar) return;

    try {
      const response = await fetch(
        `/api/lp/movimientos-clientes?id=${movimiento.referenciaId}`,
        {
          method: "DELETE",
        }
      );

      const data: MovimientoManualResponse = await response.json();

      if (!response.ok || data.status !== "success") {
        alert(data.message || "No fue posible eliminar el movimiento.");
        return;
      }

      if (editandoId === movimiento.referenciaId) {
        limpiarFormulario();
      }

      await cargarEstadoCuenta();
    } catch (error) {
      console.error("Error eliminando movimiento:", error);
      alert("No fue posible eliminar el movimiento.");
    }
  };

  const limpiarRango = () => {
    setDesde("");
    setHasta("");
  };

  const movimientosDescendentes = useMemo(() => {
    return [...movimientos].reverse();
  }, [movimientos]);

  return (
    <div className="space-y-6 pb-24">
      <ResumenNavigation />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-lp-navy/50">
          Saldos de clientes
        </p>
        
        <h1 className="mt-1 text-2xl font-bold text-lp-navy">
          {cliente?.nombre || "Estado de cuenta"}
        </h1>

        <p className="mt-1 text-sm text-lp-navy/70">
          Control de anticipos, ajustes y servicios descontados del saldo del
          cliente.
        </p>
      </div>
      
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-bold text-lp-navy">
              Período del estado de cuenta
            </h2>

            <p className="mt-1 text-xs text-lp-navy/60">
              Deja las fechas vacías para consultar todo el historial.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label
                htmlFor="saldo-desde"
                className="text-xs font-semibold text-lp-navy"
              >
                Desde
              </label>

              <input
                id="saldo-desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="w-full rounded-xl border bg-white p-3 text-lp-navy"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="saldo-hasta"
                className="text-xs font-semibold text-lp-navy"
              >
                Hasta
              </label>

              <input
                id="saldo-hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="w-full rounded-xl border bg-white p-3 text-lp-navy"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={limpiarRango}
                disabled={!desde && !hasta}
                className="w-full rounded-xl border border-lp-navy px-4 py-3 text-sm font-semibold text-lp-navy disabled:cursor-not-allowed disabled:opacity-40"
              >
                Todo el historial
              </button>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-lp-navy">
            Cargando estado de cuenta...
          </p>
        </div>
      ) : (
        <>
          {resumen && (
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <ResumenCard
                label="Saldo inicial"
                value={formatMoney(resumen.saldoInicial)}
              />

              <ResumenCard
                label="Abonos"
                value={formatMoney(resumen.totalAbonos)}
                valueClassName="text-green-700"
              />

              <ResumenCard
                label="Limpiezas"
                value={formatMoney(resumen.totalTrabajos)}
              />

              <ResumenCard
                label="Cantidad de trabajos"
                value={resumen.cantidadTrabajos}
              />

              <ResumenCard
                label="Otros débitos"
                value={formatMoney(
                  resumen.totalAjustesDebito + resumen.totalDevoluciones
                )}
              />

              <ResumenCard
                label="Saldo disponible"
                value={formatMoney(resumen.saldoFinal)}
                valueClassName={
                  resumen.saldoFinal > 200
                    ? "text-green-700"
                    : resumen.saldoFinal >= 0
                    ? "text-amber-700"
                    : "text-red-600"
                }
                destacado
              />
            </section>
          )}

          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-lp-navy">
                  {editandoId
                    ? "Editar movimiento"
                    : "Registrar movimiento"}
                </h2>

                <p className="mt-1 text-xs text-lp-navy/60">
                  Las limpiezas se descuentan automáticamente desde el Registro
                  Diario.
                </p>
              </div>

              {editandoId && (
                <span className="w-fit rounded-full bg-lp-light px-3 py-1 text-xs font-bold text-lp-navy">
                  Editando movimiento #{editandoId}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1">
                <label
                  htmlFor="movimiento-fecha"
                  className="text-xs font-semibold text-lp-navy"
                >
                  Fecha
                </label>

                <input
                  id="movimiento-fecha"
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  className="w-full rounded-xl border bg-white p-3 text-lp-navy"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="movimiento-tipo"
                  className="text-xs font-semibold text-lp-navy"
                >
                  Tipo
                </label>

                <select
                  id="movimiento-tipo"
                  value={tipo}
                  onChange={(event) =>
                    setTipo(event.target.value as MovimientoTipo)
                  }
                  className="w-full rounded-xl border bg-white p-3 text-lp-navy"
                >
                  <option value="ABONO">Abono recibido</option>
                  <option value="AJUSTE_CREDITO">Ajuste a favor</option>
                  <option value="AJUSTE_DEBITO">Ajuste débito</option>
                  <option value="DEVOLUCION">Devolución</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="movimiento-valor"
                  className="text-xs font-semibold text-lp-navy"
                >
                  Valor
                </label>

                <input
                  id="movimiento-valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border bg-white p-3 text-lp-navy"
                />
              </div>

              <div className="space-y-1 xl:col-span-2">
                <label
                  htmlFor="movimiento-concepto"
                  className="text-xs font-semibold text-lp-navy"
                >
                  Concepto
                </label>

                <input
                  id="movimiento-concepto"
                  value={concepto}
                  onChange={(event) => setConcepto(event.target.value)}
                  placeholder="Initial advance payment..."
                  className="w-full rounded-xl border bg-white p-3 text-lp-navy"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="movimiento-notas"
                className="text-xs font-semibold text-lp-navy"
              >
                Notas
              </label>

              <input
                id="movimiento-notas"
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                placeholder="Notas opcionales..."
                className="w-full rounded-xl border bg-white p-3 text-lp-navy"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:flex">
              <button
                type="button"
                onClick={guardarMovimiento}
                disabled={saving}
                className="rounded-xl bg-lp-gold px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Guardando..."
                  : editandoId
                  ? "Actualizar movimiento"
                  : "Registrar movimiento"}
              </button>

              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  disabled={saving}
                  className="rounded-xl border border-lp-navy px-5 py-3 text-sm font-semibold text-lp-navy"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-bold text-lp-navy">
                  Estado de cuenta
                </h2>

                <p className="mt-1 text-xs text-lp-navy/60">
                  Abonos, ajustes y limpiezas ordenados por fecha.
                </p>
              </div>

              <span className="rounded-full bg-lp-light px-3 py-1 text-sm font-bold text-lp-navy">
                {movimientos.length}
              </span>
            </div>

            {movimientos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-lp-navy">
                  No hay movimientos registrados
                </p>

                <p className="mt-1 text-sm text-lp-navy/60">
                  Registra un abono o revisa el período seleccionado.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm text-lp-navy">
                    <thead className="bg-lp-navy text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Movimiento</th>
                        <th className="px-4 py-3 text-left">Detalle</th>
                        <th className="px-4 py-3 text-right">Crédito</th>
                        <th className="px-4 py-3 text-right">Débito</th>
                        <th className="px-4 py-3 text-right">Saldo</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {movimientosDescendentes.map((movimiento) => (
                        <tr
                          key={movimiento.id}
                          className="border-b last:border-b-0 hover:bg-lp-light/50"
                        >
                          <td className="whitespace-nowrap px-4 py-4">
                            {formatDate(movimiento.fecha)}
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-bold">
                              {movimiento.concepto}
                            </p>

                            <p className="mt-0.5 text-xs text-lp-navy/55">
                              {formatTipo(movimiento.tipo)}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            {movimiento.origen === "TRABAJO" ? (
                              <div>
                                <p className="font-semibold">
                                  {movimiento.edificio} · Unidad{" "}
                                  {movimiento.unidad}
                                </p>

                                {movimiento.tipoUnidad && (
                                  <p className="mt-0.5 text-xs text-lp-navy/55">
                                    Tipo {movimiento.tipoUnidad}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-lp-navy/70">
                                {movimiento.notas || "—"}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4 text-right font-bold text-green-700">
                            {movimiento.credito > 0
                              ? formatMoney(movimiento.credito)
                              : "—"}
                          </td>

                          <td className="px-4 py-4 text-right font-bold">
                            {movimiento.debito > 0
                              ? formatMoney(movimiento.debito)
                              : "—"}
                          </td>

                          <td
                            className={`px-4 py-4 text-right font-bold ${
                              movimiento.saldo >= 0
                                ? "text-lp-navy"
                                : "text-red-600"
                            }`}
                          >
                            {formatMoney(movimiento.saldo)}
                          </td>

                          <td className="px-4 py-4">
                            {esMovimientoManual(movimiento) ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    editarMovimiento(movimiento)
                                  }
                                  className="rounded-lg border border-lp-navy px-3 py-1.5 text-xs font-semibold text-lp-navy"
                                >
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    eliminarMovimiento(movimiento)
                                  }
                                  className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-600"
                                >
                                  Eliminar
                                </button>
                              </div>
                            ) : (
                              <p className="text-right text-xs text-lp-navy/40">
                                Registro Diario
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y lg:hidden">
                  {movimientosDescendentes.map((movimiento) => (
                    <MovimientoCard
                      key={movimiento.id}
                      movimiento={movimiento}
                      onEditar={editarMovimiento}
                      onEliminar={eliminarMovimiento}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MovimientoCard({
  movimiento,
  onEditar,
  onEliminar,
}: {
  movimiento: MovimientoEstadoCuenta;
  onEditar: (movimiento: MovimientoEstadoCuenta) => void;
  onEliminar: (movimiento: MovimientoEstadoCuenta) => void;
}) {
  const manual = esMovimientoManual(movimiento);

  return (
    <article className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-lp-navy/55">
            {formatDate(movimiento.fecha)}
          </p>

          <h3 className="mt-0.5 font-bold text-lp-navy">
            {movimiento.concepto}
          </h3>

          <p className="mt-0.5 text-xs text-lp-navy/55">
            {formatTipo(movimiento.tipo)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {movimiento.credito > 0 ? (
            <p className="font-bold text-green-700">
              +{formatMoney(movimiento.credito)}
            </p>
          ) : (
            <p className="font-bold text-lp-navy">
              -{formatMoney(movimiento.debito)}
            </p>
          )}

          <p
            className={`mt-1 text-xs font-bold ${
              movimiento.saldo >= 0
                ? "text-lp-navy/60"
                : "text-red-600"
            }`}
          >
            Saldo {formatMoney(movimiento.saldo)}
          </p>
        </div>
      </div>

      {movimiento.origen === "TRABAJO" ? (
        <div className="grid grid-cols-2 gap-2">
          <MiniItem
            label="Edificio"
            value={movimiento.edificio || "—"}
          />

          <MiniItem
            label="Unidad"
            value={movimiento.unidad || "—"}
          />

          <MiniItem
            label="Tipo de unidad"
            value={movimiento.tipoUnidad || "—"}
          />

          <MiniItem
            label="Origen"
            value="Registro Diario"
          />
        </div>
      ) : (
        movimiento.notas && (
          <div className="rounded-xl bg-lp-light p-3">
            <p className="text-xs text-lp-navy/60">Notas</p>
            <p className="mt-1 text-sm text-lp-navy">
              {movimiento.notas}
            </p>
          </div>
        )
      )}

      {manual && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEditar(movimiento)}
            className="rounded-xl border border-lp-navy px-4 py-2 text-sm font-semibold text-lp-navy"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={() => onEliminar(movimiento)}
            className="rounded-xl border border-red-500 px-4 py-2 text-sm font-semibold text-red-600"
          >
            Eliminar
          </button>
        </div>
      )}
    </article>
  );
}

function ResumenCard({
  label,
  value,
  valueClassName = "text-lp-navy",
  destacado = false,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-sm ${
        destacado
          ? "border-lp-gold/40 bg-lp-gold/10"
          : "border-lp-navy/10 bg-white"
      }`}
    >
      <p className="text-xs text-lp-navy/60">{label}</p>

      <p className={`mt-1 truncate text-xl font-bold ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function MiniItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-lp-light p-3">
      <p className="text-xs text-lp-navy/60">{label}</p>
      <p className="mt-0.5 break-words font-bold text-lp-navy">
        {value}
      </p>
    </div>
  );
}