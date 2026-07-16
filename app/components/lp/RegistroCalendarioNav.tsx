import LPTabs from "@/app/components/lp/LPTabs";

const opciones = [
  {
    label: "Registro diario",
    href: "/dashboard/lp/registro-diario",
  },
  {
    label: "Calendario",
    href: "/dashboard/lp/registro-diario/calendario",
    match: "section" as const,
  },
];

export default function RegistroCalendarioNav() {
  return (
    <LPTabs
      opciones={opciones}
      ariaLabel="Navegación del registro diario"
    />
  );
}