"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const opciones = [
  {
    label: "Registro diario",
    href: "/dashboard/lp/registro-diario",
  },
  {
    label: "Calendario",
    href: "/dashboard/lp/registro-diario/calendario",
  },
];

export default function RegistroCalendarioNav() {
  const pathname = usePathname();

  return (
    <div className="inline-flex w-full sm:w-auto rounded-2xl border bg-white p-1 shadow-sm">
      {opciones.map((opcion) => {
        const activo = pathname === opcion.href;

        return (
          <Link
            key={opcion.href}
            href={opcion.href}
            className={`
              flex-1
              sm:flex-none
              rounded-xl
              px-4
              py-2.5
              text-center
              text-sm
              font-semibold
              transition
              ${
                activo
                  ? "bg-lp-navy text-white shadow-sm"
                  : "text-lp-navy hover:bg-lp-light"
              }
            `}
          >
            {opcion.label}
          </Link>
        );
      })}
    </div>
  );
}