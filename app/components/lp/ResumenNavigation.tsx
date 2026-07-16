import LPTabs from "@/app/components/lp/LPTabs";

const opciones = [
  {
    label: "Resumen general",
    href: "/dashboard/lp/resumen",
  },
  {
    label: "Detalle de trabajos",
    href: "/dashboard/lp/resumen/detalle",
    match: "section" as const,
  },
  {
    label: "Saldos clientes",
    href: "/dashboard/lp/saldos-clientes",
    match: "section" as const,
  },
];

export default function ResumenNavigation() {
  return (
    <LPTabs
      opciones={opciones}
      ariaLabel="Navegación del resumen financiero"
    />
  );
}