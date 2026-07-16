"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type LPTabOption = {
  label: string;
  href: string;

  /*
   * Exacto:
   * solo se activa cuando pathname === href.
   *
   * Sección:
   * también se activa en rutas hijas.
   */
  match?: "exact" | "section";
};

type LPTabsProps = {
  opciones: LPTabOption[];
  ariaLabel?: string;
  className?: string;
};

export default function LPTabs({
  opciones,
  ariaLabel = "Navegación de sección",
  className = "",
}: LPTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {opciones.map((opcion) => {
        const activo =
          opcion.match === "section"
            ? pathname === opcion.href ||
              pathname.startsWith(`${opcion.href}/`)
            : pathname === opcion.href;

        return (
          <Link
            key={opcion.href}
            href={opcion.href}
            aria-current={activo ? "page" : undefined}
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
    </nav>
  );
}