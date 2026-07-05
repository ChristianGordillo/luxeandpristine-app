import InteligenciaOperativa from "@/components/lp/InteligenciaOperativa";

export default function InteligenciaOperativaPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-5">
        <h1 className="text-3xl font-bold text-lp-navy">
          Inteligencia Operativa
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Demanda, recurrencia, intensidad operativa y comportamiento de las
          unidades.
        </p>
      </div>

      <div className="p-6">
        <InteligenciaOperativa />
      </div>
    </main>
  );
}