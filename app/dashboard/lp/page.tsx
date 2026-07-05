import Link from "next/link";

export default function LPHomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Link href="/dashboard/lp/programacion">
            <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer">
              <h2 className="text-xl font-semibold text-gray-900">
                L&P Luxury & Pristine
              </h2>
              <p className="text-gray-600 mt-2">
                Nueva operación de limpieza, unidades y clientes.
              </p>
            </div>
          </Link>
    </main>
  );
}