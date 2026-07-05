"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaBars } from "react-icons/fa";
import { AuthProvider, useAuth } from "@/app/context/AuthContext";
import LPSidebar from "@/app/components/lp/LPSidebar";

const operationalLinks = [
  { href: "/dashboard/lp/registro-diario", label: "1. Programación" },
  { href: "/dashboard/lp/programacion", label: "2. Asignación" },
  { href: "/dashboard/lp/asignacion", label: "3. Confirmación" },
];

export default function LPLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LPLayout>{children}</LPLayout>
    </AuthProvider>
  );
}

function LPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasAccess } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

// TEMP: auth desactivado mientras migramos L&P
// useEffect(() => {
//   const token = localStorage.getItem("token");

//   if (!token) {
//     router.push("/authlogin");
//     return;
//   }

//   if (user && !hasAccess("LP")) {
//     router.push("/registrohoras");
//   }
// }, [user, hasAccess, router]);

// if (!user) return null;
// if (!hasAccess("LP")) return null;

  return (
    <div className="min-h-screen bg-lp-light">
      <nav className="bg-lp-navy text-white px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-full border border-white/20 p-3 text-white transition hover:bg-white/10 hover:text-lp-gold"
            >
              <FaBars size={18} />
            </button>

            <Link href="/dashboard/lp" className="flex items-center gap-3">
              <Image
                src="/images/lp-logo.jpeg"
                alt="L&P Luxury & Pristine"
                width={48}
                height={48}
                className="rounded-full object-cover"
              />

              <span className="font-semibold text-sm text-white">
                L&P Operations
              </span>
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 lg:pb-0 text-sm">
            {operationalLinks.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap px-3 py-2 rounded-full transition-colors ${
                    isActive
                      ? "bg-lp-gold text-lp-navy font-semibold"
                      : "text-white hover:bg-white/10 hover:text-lp-gold"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <LPSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}