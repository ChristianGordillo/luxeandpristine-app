"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const opciones = [
  {
    label: "Resumen general",
    href: "/dashboard/lp/resumen",
    descripcion: "Totales, costos y utilidad",
  },
  {
    label: "Detalle de trabajos",
    href: "/dashboard/lp/resumen/detalle",
    descripcion: "Unidades, tipos y precios",
  },
];

export default function ResumenNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación del resumen financiero"
      className="bg-white border rounded-2xl shadow-sm p-2"
    >
      <div className="grid grid-cols-2 gap-2">
        {opciones.map((opcion) => {
          const activo =
            opcion.href === "/resumen"
              ? pathname === "/resumen"
              : pathname.startsWith(opcion.href);

          return (
          <Link
            key={opcion.href}
            href={opcion.href}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              activo
                ? "border-lp-navy bg-lp-navy text-white"
                : "border-lp-navy/20 bg-white text-lp-navy hover:bg-lp-light"
            }`}
          >
            {opcion.label}
          </Link>
          );
        })}
      </div>
    </nav>
  );
}