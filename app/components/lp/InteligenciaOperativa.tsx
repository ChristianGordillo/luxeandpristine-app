"use client";

import { ReactNode , useEffect, useMemo, useState, type ReactElement } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type PorDia = {
  fecha: string;
  dia: string;
  totalTrabajos: number;
  turnovers: number;
  limpiezas: number;
  limpiezasIniciales: number;
  extras: number;
  repasos: number;
};

type PorUnidad = {
  unidadId: number;
  unidad: string;
  edificioId: number | null;
  edificio: string;
  cliente: string;
  habitaciones: number;
  banos: number;
  totalTrabajos: number;
  turnovers: number;
  limpiezas: number;
  limpiezasIniciales: number;
  extras: number;
  repasos: number;
};

type PorEdificio = {
  edificioId: number;
  edificio: string;
  unidadesActivas: number;
  unidadesConMovimiento?: number;
  totalTrabajos: number;
  turnovers: number;
  limpiezas: number;
  limpiezasIniciales: number;
  extras: number;
  repasos: number;
  intensidadOperativa: number;
};

type PorDiaSemana = {
  dia: string;
  totalTrabajos: number;
  turnovers: number;
  limpiezas: number;
  limpiezasIniciales: number;
  extras: number;
  repasos: number;
};

type PorUnidadMes = {
  unidadId: number;
  unidad: string;
  edificio: string;
  mes: string;
  totalTrabajos: number;
  turnovers: number;
  limpiezas: number;
  limpiezasIniciales: number;
  extras: number;
  repasos: number;
};

type Resumen = {
  totalTrabajos: number;
  totalTurnovers: number;
  totalExtras: number;
  totalRepasos: number;
  totalLimpiezasIniciales: number;
  diasOperativos: number;
  unidadesActivas: number;
  unidadesConMovimiento?: number;
  edificiosActivos: number;
  promedioDiario: number;
  diaMayorDemanda: PorDia | null;
  unidadMayorMovimiento: PorUnidad | null;
  unidadMenorMovimiento: PorUnidad | null;
  edificioMayorMovimiento: PorEdificio | null;
};

export default function InteligenciaOperativa() {
  const [desde, setDesde] = useState("2026-05-01");
  const [hasta, setHasta] = useState("2026-05-31");

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [porDia, setPorDia] = useState<PorDia[]>([]);
  const [porUnidad, setPorUnidad] = useState<PorUnidad[]>([]);
  const [porEdificio, setPorEdificio] = useState<PorEdificio[]>([]);
  const [porDiaSemana, setPorDiaSemana] = useState<PorDiaSemana[]>([]);
  const [porUnidadMes, setPorUnidadMes] = useState<PorUnidadMes[]>([]);
  const [loading, setLoading] = useState(false);

  const topUnidadesMayorMovimiento = useMemo(() => {
    return [...porUnidad].sort((a, b) => b.turnovers - a.turnovers).slice(0, 10);
  }, [porUnidad]);

  const topUnidadesMenorMovimiento = useMemo(() => {
    return [...porUnidad]
      .sort((a, b) => {
        if (a.turnovers === b.turnovers) {
          return a.totalTrabajos - b.totalTrabajos;
        }
        return a.turnovers - b.turnovers;
      })
      .slice(0, 5);
  }, [porUnidad]);

  const unidadesConMovimiento =
    resumen?.unidadesConMovimiento ??
    porUnidad.filter((unidad) => unidad.totalTrabajos > 0).length;

  const cargarDatos = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/lp/inteligencia-operativa?desde=${desde}&hasta=${hasta}`
      );

      const json = await res.json();

      if (json.status === "success") {
        setResumen(json.resumen);
        setPorDia(json.porDia || []);
        setPorUnidad(json.porUnidad || []);
        setPorEdificio(json.porEdificio || []);
        setPorDiaSemana(json.porDiaSemana || []);
        setPorUnidadMes(json.porUnidadMes || []);
      }
    } catch (error) {
      console.error("Error cargando inteligencia operativa:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-3 py-4 sm:px-4 md:space-y-6 md:px-6">
      <section className="rounded-3xl bg-lp-navy px-5 py-6 text-white shadow-sm md:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lp-gold">
          L&P Analytics
        </p>

        <h1 className="mt-2 text-2xl font-bold leading-tight md:text-4xl">
          Inteligencia operativa
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75 md:text-base">
          Demanda, recurrencia, intensidad operativa y movimiento por unidad y
          edificio.
        </p>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />

          <button
            onClick={cargarDatos}
            disabled={loading}
            className="h-12 rounded-2xl bg-lp-navy px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 sm:self-end"
          >
            {loading ? "Analizando..." : "Analizar"}
          </button>
        </div>
      </section>

      {resumen && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              title="Turnovers reales"
              value={resumen.totalTurnovers}
              tone="primary"
            />
            <MetricCard title="Trabajos" value={resumen.totalTrabajos} />
            <MetricCard title="Promedio diario" value={resumen.promedioDiario} />
            <MetricCard title="Unidades activas" value={resumen.unidadesActivas} />
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              title="Con movimiento"
              value={unidadesConMovimiento}
              helper="Unidades con trabajos"
            />
            <MetricCard title="Extras" value={resumen.totalExtras} />
            <MetricCard title="Repasos" value={resumen.totalRepasos} />
            <MetricCard title="Edificios" value={resumen.edificiosActivos} />
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InsightCard
              label="Día de mayor demanda"
              title={
                resumen.diaMayorDemanda
                  ? `${resumen.diaMayorDemanda.turnovers} turnovers`
                  : "-"
              }
              detail={
                resumen.diaMayorDemanda
                  ? `${resumen.diaMayorDemanda.fecha} · ${resumen.diaMayorDemanda.dia}`
                  : ""
              }
            />

            <InsightCard
              label="Unidad con más movimiento"
              title={resumen.unidadMayorMovimiento?.unidad || "-"}
              detail={
                resumen.unidadMayorMovimiento
                  ? `${resumen.unidadMayorMovimiento.edificio} · ${resumen.unidadMayorMovimiento.turnovers} turnovers`
                  : ""
              }
            />

            <InsightCard
              label="Edificio con más movimiento"
              title={resumen.edificioMayorMovimiento?.edificio || "-"}
              detail={
                resumen.edificioMayorMovimiento
                  ? `${resumen.edificioMayorMovimiento.turnovers} turnovers · ${resumen.edificioMayorMovimiento.unidadesActivas} unidades`
                  : ""
              }
            />
          </section>
        </>
      )}

      <ChartCard
        title="Demanda diaria"
        description="Evolución de turnovers, extras y repasos dentro del rango."
      >
        <LineChart data={porDia}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="turnovers"
            stroke="#0B3551"
            strokeWidth={3}
            name="Turnovers"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="extras"
            stroke="#C9A24A"
            strokeWidth={2}
            name="Extras"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="repasos"
            stroke="#64748B"
            strokeWidth={2}
            name="Repasos"
            dot={false}
          />
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Comparativo por edificio"
        description="Turnovers, unidades activas e intensidad operativa."
      >
        <BarChart data={porEdificio}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="edificio" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="turnovers" name="Turnovers" fill="#0B3551" radius={[8, 8, 0, 0]} />
          <Bar dataKey="unidadesActivas" name="Unidades activas" fill="#C9A24A" radius={[8, 8, 0, 0]} />
          <Bar dataKey="intensidadOperativa" name="Intensidad" fill="#94A3B8" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="Demanda por día de la semana"
        description="Detecta qué días concentran mayor carga operativa."
      >
        <BarChart data={porDiaSemana}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="turnovers" name="Turnovers" fill="#0B3551" radius={[8, 8, 0, 0]} />
          <Bar dataKey="extras" name="Extras" fill="#C9A24A" radius={[8, 8, 0, 0]} />
          <Bar dataKey="repasos" name="Repasos" fill="#94A3B8" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartCard>

      <TablaEdificios data={porEdificio} />

      <TablaUnidades
        title="Top 10 unidades con más movimiento"
        description="Unidades que concentran mayor número de turnovers."
        data={topUnidadesMayorMovimiento}
      />

      <TablaUnidades
        title="Top 5 unidades con menor movimiento"
        description="Unidades activas con menor actividad operativa en el rango."
        data={topUnidadesMenorMovimiento}
      />

      <TablaUnidadMes data={porUnidadMes} />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none transition focus:border-lp-gold focus:bg-white focus:ring-2 focus:ring-lp-gold/20"
      />
    </label>
  );
}

function MetricCard({
  title,
  value,
  helper,
  tone = "default",
}: {
  title: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "primary";
}) {
  const primary = tone === "primary";

  return (
    <article
      className={`rounded-3xl border p-4 shadow-sm ${
        primary
          ? "border-lp-navy bg-lp-navy text-white"
          : "border-gray-100 bg-white text-lp-navy"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          primary ? "text-lp-gold" : "text-gray-500"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold leading-none md:text-3xl">{value}</p>
      {helper && (
        <p className={`mt-2 text-xs ${primary ? "text-white/65" : "text-gray-400"}`}>
          {helper}
        </p>
      )}
    </article>
  );
}

function InsightCard({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-lp-navy md:text-xl">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{detail || "Sin datos"}</p>
    </article>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactElement;
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-lp-navy md:text-xl">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="h-72 min-w-[620px] md:h-80 md:min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function TablaEdificios({ data }: { data: PorEdificio[] }) {
  return (
    <DataSection
      title="Ranking por edificio"
      description="Concentración de turnovers, unidades activas e intensidad operativa."
    >
      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <MobileCard key={item.edificioId} title={item.edificio}>
            <Stat label="Turnovers" value={item.turnovers} highlight />
            <Stat label="Trabajos" value={item.totalTrabajos} />
            <Stat label="Unidades" value={item.unidadesActivas} />
            <Stat label="Extras" value={item.extras} />
            <Stat label="Repasos" value={item.repasos} />
            <Stat label="Intensidad" value={item.intensidadOperativa} highlight />
          </MobileCard>
        ))}
      </div>

      <DesktopTable>
        <thead className="bg-gray-50">
          <tr>
            <Th>Edificio</Th>
            <Th>Turnovers</Th>
            <Th>Trabajos</Th>
            <Th>Unidades</Th>
            <Th>Extras</Th>
            <Th>Repasos</Th>
            <Th>Intensidad</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.edificioId} className="border-t border-gray-100">
              <Td strong>{item.edificio}</Td>
              <Td strong>{item.turnovers}</Td>
              <Td>{item.totalTrabajos}</Td>
              <Td>{item.unidadesActivas}</Td>
              <Td>{item.extras}</Td>
              <Td>{item.repasos}</Td>
              <Td strong>{item.intensidadOperativa}</Td>
            </tr>
          ))}
        </tbody>
      </DesktopTable>
    </DataSection>
  );
}

function TablaUnidades({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: PorUnidad[];
}) {
  return (
    <DataSection title={title} description={description}>
      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <MobileCard
            key={item.unidadId}
            title={item.unidad}
            subtitle={`${item.edificio} · ${item.cliente}`}
          >
            <Stat label="Turnovers" value={item.turnovers} highlight />
            <Stat label="Trabajos" value={item.totalTrabajos} />
            <Stat label="Extras" value={item.extras} />
            <Stat label="Repasos" value={item.repasos} />
          </MobileCard>
        ))}
      </div>

      <DesktopTable>
        <thead className="bg-gray-50">
          <tr>
            <Th>Unidad</Th>
            <Th>Edificio</Th>
            <Th>Cliente</Th>
            <Th>Turnovers</Th>
            <Th>Trabajos</Th>
            <Th>Extras</Th>
            <Th>Repasos</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.unidadId} className="border-t border-gray-100">
              <Td strong>{item.unidad}</Td>
              <Td>{item.edificio}</Td>
              <Td>{item.cliente}</Td>
              <Td strong>{item.turnovers}</Td>
              <Td>{item.totalTrabajos}</Td>
              <Td>{item.extras}</Td>
              <Td>{item.repasos}</Td>
            </tr>
          ))}
        </tbody>
      </DesktopTable>

      {data.length === 0 && <EmptyState />}
    </DataSection>
  );
}

function TablaUnidadMes({ data }: { data: PorUnidadMes[] }) {
  return (
    <DataSection
      title="Turnovers por unidad por mes"
      description="Detecta unidades estrella, unidades frías y tendencia de recurrencia."
    >
      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <MobileCard
            key={`${item.unidadId}-${item.mes}`}
            title={item.unidad}
            subtitle={`${item.mes} · ${item.edificio}`}
          >
            <Stat label="Turnovers" value={item.turnovers} highlight />
            <Stat label="Trabajos" value={item.totalTrabajos} />
            <Stat label="Extras" value={item.extras} />
            <Stat label="Repasos" value={item.repasos} />
          </MobileCard>
        ))}
      </div>

      <DesktopTable>
        <thead className="bg-gray-50">
          <tr>
            <Th>Mes</Th>
            <Th>Unidad</Th>
            <Th>Edificio</Th>
            <Th>Turnovers</Th>
            <Th>Trabajos</Th>
            <Th>Extras</Th>
            <Th>Repasos</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={`${item.unidadId}-${item.mes}`} className="border-t border-gray-100">
              <Td>{item.mes}</Td>
              <Td strong>{item.unidad}</Td>
              <Td>{item.edificio}</Td>
              <Td strong>{item.turnovers}</Td>
              <Td>{item.totalTrabajos}</Td>
              <Td>{item.extras}</Td>
              <Td>{item.repasos}</Td>
            </tr>
          ))}
        </tbody>
      </DesktopTable>

      {data.length === 0 && <EmptyState />}
    </DataSection>
  );
}

function DataSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-lp-navy md:text-xl">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MobileCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactElement | ReactElement[];
}) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <h3 className="font-bold text-lp-navy">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">{children}</div>
    </article>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold ${highlight ? "text-lp-navy" : "text-gray-700"}`}>
        {value}
      </p>
    </div>
  );
}

function DesktopTable({ children }: { children: ReactElement | ReactElement[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: string }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

function Td({
  children,
  strong = false,
}: {
  children: string | number;
  strong?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 ${
        strong ? "font-bold text-lp-navy" : "text-gray-600"
      }`}
    >
      {children}
    </td>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
      No hay datos para mostrar en este rango.
    </div>
  );
}