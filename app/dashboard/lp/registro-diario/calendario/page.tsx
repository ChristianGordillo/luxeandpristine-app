"use client";

import { useEffect, useMemo, useState } from "react";
import RegistroCalendarioNav from "@/app/components/lp/RegistroCalendarioNav";

type TrabajoTipo =
  | "LIMPIEZA_INICIAL"
  | "LIMPIEZA"
  | "EXTRA"
  | "REPASO_LIMPIEZA";

type Cliente = {
  id: number;
  nombre: string;
};

type Edificio = {
  id?: number;
  nombre: string;
};

type Unidad = {
  id: number;
  nombre: string;
  cliente?: Cliente | null;
  edificio?: Edificio | null;
};

type Trabajo = {
  id: number;
  fecha: string;
  dia: string;
  tipo: TrabajoTipo;
  precio: number;
  notas?: string | null;
  checkIn?: boolean;
  unidadId?: number | null;
  unidad?: Unidad | null;
  unidadManual?: string | null;
};

type DiaCalendario = {
  date: Date;
  dateString: string;
  currentMonth: boolean;
};

const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const labelsTipo: Record<TrabajoTipo, string> = {
  LIMPIEZA_INICIAL: "Limpieza inicial",
  LIMPIEZA: "Limpieza",
  EXTRA: "Extra",
  REPASO_LIMPIEZA: "Repaso",
};

function getTodayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function dateToInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthRange(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    desde: dateToInputValue(firstDay),
    hasta: dateToInputValue(lastDay),
  };
}

function getCalendarDays(date: Date): DiaCalendario[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startingDay = (firstDay.getDay() + 6) % 7;

  const days: DiaCalendario[] = [];

  for (let index = startingDay; index > 0; index--) {
    const previousDate = new Date(year, month, 1 - index);

    days.push({
      date: previousDate,
      dateString: dateToInputValue(previousDate),
      currentMonth: false,
    });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const currentDate = new Date(year, month, day);

    days.push({
      date: currentDate,
      dateString: dateToInputValue(currentDate),
      currentMonth: true,
    });
  }

  let nextDay = 1;

  while (days.length % 7 !== 0 || days.length < 42) {
    const nextDate = new Date(year, month + 1, nextDay);

    days.push({
      date: nextDate,
      dateString: dateToInputValue(nextDate),
      currentMonth: false,
    });

    nextDay++;
  }

  return days;
}

function getFechaTrabajo(fecha: string) {
  return fecha.split("T")[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatFechaCompleta(fechaString: string) {
  const [year, month, day] = fechaString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatFechaMobile(fechaString: string) {
  const [year, month, day] = fechaString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return {
    diaSemana: date
      .toLocaleDateString("es-ES", {
        weekday: "long",
      })
      .toUpperCase(),

    dia: String(day).padStart(2, "0"),

    mes: date
      .toLocaleDateString("es-ES", {
        month: "short",
      })
      .replace(".", "")
      .toUpperCase(),
  };
}

function tipoLabel(tipo: TrabajoTipo) {
  return labelsTipo[tipo] || tipo;
}

function nombreUnidad(trabajo: Trabajo) {
  if (trabajo.unidad) {
    return `Unidad ${trabajo.unidad.nombre}`;
  }

  return trabajo.unidadManual || "Unidad eventual";
}

function nombreEdificio(trabajo: Trabajo) {
  return trabajo.unidad?.edificio?.nombre || "Eventual";
}

function nombreCliente(trabajo: Trabajo) {
  return trabajo.unidad?.cliente?.nombre || "Cliente eventual";
}

export default function CalendarioPage() {
  const today = getTodayInputValue();

  const [mesActual, setMesActual] = useState(() => {
    const [year, month] = today.split("-").map(Number);

    return new Date(year, month - 1, 1);
  });

  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(today);
  const [clienteFiltro, setClienteFiltro] = useState("todos");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const rangoMes = useMemo(() => {
    return getMonthRange(mesActual);
  }, [mesActual]);

  const diasCalendario = useMemo(() => {
    return getCalendarDays(mesActual);
  }, [mesActual]);

  const clientesDisponibles = useMemo(() => {
    const clientes = trabajos.map((trabajo) => nombreCliente(trabajo));

    return Array.from(new Set(clientes)).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [trabajos]);

  const trabajosFiltrados = useMemo(() => {
    if (clienteFiltro === "todos") {
      return trabajos;
    }

    return trabajos.filter(
      (trabajo) => nombreCliente(trabajo) === clienteFiltro
    );
  }, [trabajos, clienteFiltro]);

  const trabajosPorFecha = useMemo(() => {
    return trabajosFiltrados.reduce<Record<string, Trabajo[]>>(
      (accumulator, trabajo) => {
        const fecha = getFechaTrabajo(trabajo.fecha);

        if (!accumulator[fecha]) {
          accumulator[fecha] = [];
        }

        accumulator[fecha].push(trabajo);

        return accumulator;
      },
      {}
    );
  }, [trabajosFiltrados]);

  const fechasConTrabajos = useMemo(() => {
    return Object.entries(trabajosPorFecha)
      .sort(([fechaA], [fechaB]) => fechaA.localeCompare(fechaB))
      .map(([fecha, trabajosDia]) => ({
        fecha,
        trabajos: trabajosDia,
      }));
  }, [trabajosPorFecha]);

  const trabajosFechaSeleccionada = useMemo(() => {
    return trabajosPorFecha[fechaSeleccionada] || [];
  }, [trabajosPorFecha, fechaSeleccionada]);

  const resumenMes = useMemo(() => {
    const unidades = new Set(
      trabajosFiltrados.map((trabajo) => {
        if (trabajo.unidadId) {
          return `catalogo-${trabajo.unidadId}`;
        }

        if (trabajo.unidadManual) {
          return `manual-${trabajo.unidadManual}`;
        }

        return `eventual-${trabajo.id}`;
      })
    );

    return {
      trabajos: trabajosFiltrados.length,

      total: trabajosFiltrados.reduce(
        (accumulator, trabajo) =>
          accumulator + Number(trabajo.precio || 0),
        0
      ),

      checkIns: trabajosFiltrados.filter((trabajo) => trabajo.checkIn).length,

      unidades: unidades.size,
    };
  }, [trabajosFiltrados]);

  const fetchTrabajos = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/lp/trabajos?desde=${rangoMes.desde}&hasta=${rangoMes.hasta}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el calendario");
      }

      setTrabajos(data.trabajos || []);
    } catch (error) {
      console.error("Error cargando calendario:", error);

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el calendario"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrabajos();
  }, [rangoMes.desde, rangoMes.hasta]);

  useEffect(() => {
    if (
      clienteFiltro !== "todos" &&
      !clientesDisponibles.includes(clienteFiltro)
    ) {
      setClienteFiltro("todos");
    }
  }, [clientesDisponibles, clienteFiltro]);

  useEffect(() => {
    if (trabajosFiltrados.length === 0) {
      return;
    }

    const fechaSeleccionadaExiste = Boolean(
      trabajosPorFecha[fechaSeleccionada]?.length
    );

    if (!fechaSeleccionadaExiste) {
      const primeraFecha = Object.keys(trabajosPorFecha).sort()[0];

      if (primeraFecha) {
        setFechaSeleccionada(primeraFecha);
      }
    }
  }, [trabajosFiltrados, trabajosPorFecha, fechaSeleccionada]);

  const irMesAnterior = () => {
    setMesActual(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  };

  const irMesSiguiente = () => {
    setMesActual(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  };

  const irHoy = () => {
    const [year, month] = today.split("-").map(Number);

    setMesActual(new Date(year, month - 1, 1));
    setFechaSeleccionada(today);
  };

  const seleccionarFecha = (
    fechaString: string,
    currentMonth: boolean
  ) => {
    setFechaSeleccionada(fechaString);

    if (!currentMonth) {
      const [year, month] = fechaString.split("-").map(Number);

      setMesActual(new Date(year, month - 1, 1));
    }
  };

  return (
    <div className="space-y-5 pb-24 sm:space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-lp-navy">
            Calendario de trabajos
          </h1>

          <p className="mt-1 text-sm text-lp-navy/70">
            Consulta la programación futura por fecha, unidad y cliente.
          </p>
        </div>

        <RegistroCalendarioNav />
      </div>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <button
            type="button"
            onClick={irMesAnterior}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-lp-navy/10 bg-white text-lg font-bold text-lp-navy transition hover:bg-lp-light"
            aria-label="Mes anterior"
          >
            ←
          </button>

          <div className="min-w-0 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lp-navy/45">
              Vista mensual
            </p>

            <h2 className="truncate text-xl font-bold text-lp-navy sm:text-2xl">
              {meses[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h2>
          </div>

          <button
            type="button"
            onClick={irMesSiguiente}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-lp-navy/10 bg-white text-lg font-bold text-lp-navy transition hover:bg-lp-light"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>

        <div className="border-t px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={irHoy}
            className="w-full rounded-2xl bg-lp-navy px-4 py-3 text-sm font-bold text-white transition hover:opacity-95 sm:w-auto"
          >
            Ir a hoy
          </button>
        </div>
      </section>

      {trabajos.length > 0 && (
        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-lp-navy/45">
              Filtrar calendario
            </p>

            <h2 className="font-bold text-lp-navy">Cliente</h2>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setClienteFiltro("todos")}
              className={`
                whitespace-nowrap
                rounded-full
                border
                px-4
                py-2.5
                text-sm
                font-semibold
                transition
                ${
                  clienteFiltro === "todos"
                    ? "border-lp-navy bg-lp-navy text-white shadow-sm"
                    : "border-lp-navy/15 bg-white text-lp-navy hover:bg-lp-light"
                }
              `}
            >
              Todos
            </button>

            {clientesDisponibles.map((cliente) => (
              <button
                key={cliente}
                type="button"
                onClick={() => setClienteFiltro(cliente)}
                className={`
                  whitespace-nowrap
                  rounded-full
                  border
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  transition
                  ${
                    clienteFiltro === cliente
                      ? "border-lp-navy bg-lp-navy text-white shadow-sm"
                      : "border-lp-navy/15 bg-white text-lp-navy hover:bg-lp-light"
                  }
                `}
              >
                {cliente}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumenCard
          label="Trabajos"
          value={resumenMes.trabajos}
          secondary={
            clienteFiltro === "todos" ? "Este mes" : clienteFiltro
          }
        />

        <ResumenCard
          label="Facturación"
          value={formatMoney(resumenMes.total)}
          secondary="Ingreso estimado"
        />

        <ResumenCard
          label="Unidades"
          value={resumenMes.unidades}
          secondary="Unidades activas"
        />

        <ResumenCard
          label="Check-ins"
          value={resumenMes.checkIns}
          secondary="Mismo día"
        />
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <CalendarioSkeleton />
      ) : trabajosFiltrados.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lp-light text-2xl">
            ◷
          </div>

          <h2 className="mt-4 font-bold text-lp-navy">
            No hay trabajos programados
          </h2>

          <p className="mt-1 text-sm text-lp-navy/60">
            No se encontraron trabajos para este mes y cliente.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: agenda profesional */}
          <section className="space-y-4 sm:hidden">
            {fechasConTrabajos.map(({ fecha, trabajos: trabajosDia }) => {
              const fechaFormateada = formatFechaMobile(fecha);
              const esHoy = fecha === today;

              return (
                <article
                  key={fecha}
                  className="overflow-hidden rounded-3xl border bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setFechaSeleccionada(fecha)}
                    className="flex w-full items-center gap-4 border-b bg-lp-light/70 p-4 text-left"
                  >
                    <div
                      className={`
                        flex
                        h-16
                        w-16
                        shrink-0
                        flex-col
                        items-center
                        justify-center
                        rounded-2xl
                        ${
                          esHoy
                            ? "bg-lp-navy text-white"
                            : "bg-white text-lp-navy shadow-sm"
                        }
                      `}
                    >
                      <span className="text-[10px] font-bold tracking-wide">
                        {fechaFormateada.mes}
                      </span>

                      <span className="text-2xl font-bold leading-none">
                        {fechaFormateada.dia}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-bold capitalize text-lp-navy">
                          {fechaFormateada.diaSemana.toLowerCase()}
                        </h3>

                        {esHoy && (
                          <span className="rounded-full bg-lp-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lp-navy">
                            Hoy
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-lp-navy/60">
                        {trabajosDia.length}{" "}
                        {trabajosDia.length === 1
                          ? "trabajo programado"
                          : "trabajos programados"}
                      </p>
                    </div>

                    <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-lp-navy px-2 text-xs font-bold text-white">
                      {trabajosDia.length}
                    </span>
                  </button>

                  <div className="divide-y">
                    {trabajosDia.map((trabajo) => (
                      <TrabajoMobileCard
                        key={trabajo.id}
                        trabajo={trabajo}
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </section>

          {/* Desktop y tablet: calendario mensual */}
          <section className="hidden overflow-hidden rounded-3xl border bg-white shadow-sm sm:block">
            <div className="grid grid-cols-7 border-b bg-lp-light">
              {diasSemana.map((dia) => (
                <div
                  key={dia}
                  className="border-r px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-lp-navy/55 last:border-r-0"
                >
                  {dia}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {diasCalendario.map((dia, index) => {
                const trabajosDia =
                  trabajosPorFecha[dia.dateString] || [];

                const esHoy = dia.dateString === today;

                const seleccionado =
                  dia.dateString === fechaSeleccionada;

                return (
                  <button
                    key={dia.dateString}
                    type="button"
                    onClick={() =>
                      seleccionarFecha(
                        dia.dateString,
                        dia.currentMonth
                      )
                    }
                    className={`
                      min-h-36
                      border-b
                      border-r
                      p-2
                      text-left
                      align-top
                      transition
                      hover:bg-lp-light/70
                      ${(index + 1) % 7 === 0 ? "border-r-0" : ""}
                      ${
                        dia.currentMonth
                          ? "bg-white"
                          : "bg-slate-50 text-lp-navy/35"
                      }
                      ${
                        seleccionado
                          ? "ring-2 ring-inset ring-lp-gold"
                          : ""
                      }
                    `}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-full
                          text-xs
                          font-bold
                          ${
                            esHoy
                              ? "bg-lp-navy text-white"
                              : "text-lp-navy"
                          }
                        `}
                      >
                        {dia.date.getDate()}
                      </span>

                      {trabajosDia.length > 0 && (
                        <span className="rounded-full bg-lp-gold/20 px-2 py-0.5 text-[10px] font-bold text-lp-navy">
                          {trabajosDia.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {trabajosDia.slice(0, 3).map((trabajo) => (
                        <div
                          key={trabajo.id}
                          className="rounded-lg border border-lp-navy/5 bg-lp-light px-2 py-1.5"
                          title={`${nombreEdificio(
                            trabajo
                          )} · ${nombreUnidad(trabajo)}`}
                        >
                          <p className="truncate text-[11px] font-bold text-lp-navy">
                            {nombreUnidad(trabajo)}
                          </p>

                          <p className="truncate text-[9px] text-lp-navy/50">
                            {nombreEdificio(trabajo)}
                          </p>
                        </div>
                      ))}

                      {trabajosDia.length > 3 && (
                        <p className="px-1 text-[10px] font-semibold text-lp-navy/55">
                          +{trabajosDia.length - 3} más
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Detalle de día para tablet y desktop */}
          <section className="hidden overflow-hidden rounded-3xl border bg-white shadow-sm sm:block">
            <div className="flex items-center justify-between gap-4 border-b bg-lp-light/60 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-lp-navy/45">
                  Día seleccionado
                </p>

                <h2 className="font-bold capitalize text-lp-navy">
                  {formatFechaCompleta(fechaSeleccionada)}
                </h2>
              </div>

              <span className="rounded-full bg-lp-navy px-3 py-1 text-xs font-bold text-white">
                {trabajosFechaSeleccionada.length}
              </span>
            </div>

            {trabajosFechaSeleccionada.length === 0 ? (
              <div className="p-6 text-sm text-lp-navy/60">
                No hay trabajos registrados para esta fecha.
              </div>
            ) : (
              <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                {trabajosFechaSeleccionada.map((trabajo) => (
                  <TrabajoDesktopCard
                    key={trabajo.id}
                    trabajo={trabajo}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TrabajoMobileCard({ trabajo }: { trabajo: Trabajo }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-lp-navy/50">
            {nombreEdificio(trabajo)}
          </p>

          <h4 className="truncate text-lg font-bold text-lp-navy">
            {nombreUnidad(trabajo)}
          </h4>

          <p className="truncate text-sm text-lp-navy/60">
            {nombreCliente(trabajo)}
          </p>
        </div>

        <p className="shrink-0 text-lg font-bold text-lp-navy">
          {formatMoney(trabajo.precio)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-lp-light px-3 py-1 text-xs font-semibold text-lp-navy">
          {tipoLabel(trabajo.tipo)}
        </span>

        {trabajo.checkIn && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            Check-in
          </span>
        )}
      </div>

      {trabajo.notas && (
        <div className="rounded-2xl bg-lp-light/70 p-3">
          <p className="text-xs font-semibold text-lp-navy/45">
            Nota
          </p>

          <p className="mt-1 text-sm text-lp-navy/70">
            {trabajo.notas}
          </p>
        </div>
      )}
    </div>
  );
}

function TrabajoDesktopCard({ trabajo }: { trabajo: Trabajo }) {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-lp-navy/50">
            {nombreEdificio(trabajo)}
          </p>

          <h3 className="truncate text-lg font-bold text-lp-navy">
            {nombreUnidad(trabajo)}
          </h3>

          <p className="truncate text-sm text-lp-navy/60">
            {nombreCliente(trabajo)}
          </p>
        </div>

        <p className="shrink-0 font-bold text-lp-navy">
          {formatMoney(trabajo.precio)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-lp-light px-3 py-1 text-xs font-semibold text-lp-navy">
          {tipoLabel(trabajo.tipo)}
        </span>

        {trabajo.checkIn && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            Check-in
          </span>
        )}
      </div>

      {trabajo.notas && (
        <p className="text-sm text-lp-navy/70">
          {trabajo.notas}
        </p>
      )}
    </div>
  );
}

function ResumenCard({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string | number;
  secondary: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border bg-white p-4 shadow-sm">
      <p className="truncate text-xs font-semibold text-lp-navy/45">
        {label}
      </p>

      <p className="mt-1 truncate text-xl font-bold text-lp-navy sm:text-2xl">
        {value}
      </p>

      <p className="mt-1 truncate text-[11px] text-lp-navy/45">
        {secondary}
      </p>
    </div>
  );
}

function CalendarioSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="animate-pulse overflow-hidden rounded-3xl border bg-white shadow-sm"
        >
          <div className="h-24 bg-lp-light" />

          <div className="space-y-3 p-4">
            <div className="h-4 w-1/3 rounded bg-lp-light" />
            <div className="h-6 w-2/3 rounded bg-lp-light" />
            <div className="h-4 w-1/2 rounded bg-lp-light" />
          </div>
        </div>
      ))}
    </div>
  );
}