import LPTabs from "@/app/components/lp/LPTabs";

const opciones = [
  {
    label: "Registro",
    href: "/dashboard/lp/compras",
  },
  {
    label: "Análisis",
    href: "/dashboard/lp/compras/analisis",
  },
  {
    label: "Catálogo",
    href: "/dashboard/lp/productos-compras",
  },
  {
    label: "Revisión",
    href: "/dashboard/lp/productos-compras/revision",
  },
];

export default function ComprasNav() {
  return (
    <LPTabs
      opciones={opciones}
      ariaLabel="Navegación de compras"
    />
  );
}