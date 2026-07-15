"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const active = pathname === opcion.href;

        return (
          <Link
            key={opcion.href}
            href={opcion.href}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              active
                ? "border-lp-navy bg-lp-navy text-white"
                : "border-lp-navy/20 bg-white text-lp-navy hover:bg-lp-light"
            }`}
          >
            {opcion.label}
          </Link>
        );
      })}
    </nav>
  );
}