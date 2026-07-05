"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaTimes,
  FaBuilding,
  FaMapMarkedAlt,
  FaUsers,
  FaMoneyBillWave,
  FaChartPie,
  FaChartLine,
  FaExclamationTriangle,
  FaTshirt,
  FaShoppingCart,
  FaRecycle,
} from "react-icons/fa";

type LPSidebarProps = {
  open: boolean;
  onClose: () => void;
};

const macroLinks = [
  {
    href: "/dashboard/lp/unidades",
    label: "Unidades",
    icon: FaBuilding,
  },
  {
    href: "/dashboard/lp/trazabilidad",
    label: "Trazabilidad",
    icon: FaMapMarkedAlt,
  },
  {
    href: "/dashboard/lp/cleaners",
    label: "Cleaners",
    icon: FaUsers,
  },
  {
    href: "/dashboard/lp/pagos-cleaners",
    label: "Pagos cleaners",
    icon: FaMoneyBillWave,
  },
  {
    href: "/dashboard/lp/compras",
    label: "Compras",
    icon: FaShoppingCart,
  },
  {
    href: "/dashboard/lp/incidencias",
    label: "Incidencias",
    icon: FaExclamationTriangle,
  },
  {
    href: "/dashboard/lp/ropa-pendiente",
    label: "Ropa pendiente",
    icon: FaTshirt,
  },
  {
    href: "/dashboard/lp/ropa-manchada",
    label: "Ropa manchada",
    icon: FaRecycle,
  },
  {
    href: "/dashboard/lp/resumen",
    label: "Resumen",
    icon: FaChartPie,
  },
  {
    href: "/dashboard/lp/inteligencia-operativa",
    label: "Inteligencia operativa",
    icon: FaChartLine,
  },
];

export default function LPSidebar({ open, onClose }: LPSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="bg-lp-navy px-5 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-lp-gold">
                L&P
              </p>

              <h2 className="text-lg font-semibold">Gestión macro</h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 transition hover:bg-white/10"
            >
              <FaTimes size={18} />
            </button>
          </div>

          <p className="mt-3 text-xs text-white/70">
            Unidades, equipos, compras, incidencias, ropa y control financiero.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          {macroLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  isActive
                    ? "bg-lp-gold text-lp-navy font-semibold shadow-sm"
                    : "text-gray-700 hover:bg-lp-light hover:text-lp-navy"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isActive ? "bg-white/50" : "bg-gray-100"
                  }`}
                >
                  <Icon size={16} />
                </span>

                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}