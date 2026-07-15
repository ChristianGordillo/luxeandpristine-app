import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Shirt,
  Sparkles,
  Users,
} from "lucide-react";

const URL ="https://luxeandpristine.com";

const WHATSAPP_URL =
  "https://wa.me/17864482284?text=Hello%20Luxe%20%26%20Pristine%2C%20I%20would%20like%20to%20learn%20more%20about%20your%20Cleaning%20Intelligence%20services.";

const operationModules = [
  {
    title: "Daily Operations",
    description:
      "Register every scheduled turnover, check-in and operational requirement.",
    icon: CalendarDays,
  },
  {
    title: "Scheduling",
    description:
      "Coordinate daily workloads and assign cleaners efficiently across every property.",
    icon: Clock3,
  },
  {
    title: "Assignments",
    description:
      "Track active turnovers, assigned team members and operational progress in real time.",
    icon: Users,
  },
  {
    title: "Issues & Maintenance",
    description:
      "Centralize operational issues, maintenance requests and quality observations.",
    icon: ClipboardCheck,
  },
  {
    title: "Linen Tracking",
    description:
      "Monitor damaged linens, replacements and inventory across every property.",
    icon: Shirt,
  },
  {
    title: "Operational Insights",
    description:
      "Measure performance, revenue and operational efficiency across your portfolio.",
    icon: BarChart3,
  },
];

const operationalSteps = [
  {
    number: "01",
    title: "Schedule",
    description:
      "Every turnover enters the operation with its property details, priority and arrival time.",
  },
  {
    number: "02",
    title: "Dispatch",
    description:
      "Coordinate cleaners with clear assignments and complete operational visibility.",
  },
  {
    number: "03",
    title: "Verify",
    description:
      "Close every turnover with inspections, incident reporting and complete traceability.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F5F0] text-[#082A46]">
      <section className="relative overflow-hidden border-b border-[#082A46]/10 bg-[#082A46] text-white">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#D6AF68]/10 blur-3xl" />
        <div className="absolute -bottom-52 -left-32 h-[480px] w-[480px] rounded-full bg-white/5 blur-3xl" />

        <div className="relative mx-auto flex min-h-[680px] max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <Link
              href={URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D6AF68]/40 bg-[#D6AF68]/10">
                <Sparkles className="h-5 w-5 text-[#E8C686]" />
              </div>

              <div>
                <p className="text-sm font-semibold tracking-[0.24em] text-white">
                  LUXE &amp; PRISTINE
                </p>

                <p className="text-xs tracking-[0.18em] text-[#E8C686]">
                  CLEANING INTELLIGENCE
                </p>
              </div>
            </Link>

            <Link
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:border-[#D6AF68]/50 hover:bg-white/15 sm:flex"
            >
              Talk to Our Team
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          <div className="grid flex-1 items-center gap-14 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#D6AF68]/30 bg-[#D6AF68]/10 px-4 py-2 text-sm text-[#F1D79F]">
                <CheckCircle2 className="h-4 w-4" />
                Built for Professional Turnover Operations
              </div>

              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                Every Turnover.

                <span className="block text-[#E8C686]">
                  Executed with Precision.
                </span>
              </h1>

              <p className="mt-8 max-w-2xl text-lg leading-8 text-white/70 sm:text-xl">
                Cleaning Intelligence designed for short-term rental
                operators. Coordinate teams, inspections, linen management and
                operational visibility from one structured workflow.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#D6AF68] px-7 font-semibold text-[#082A46] transition hover:bg-[#E8C686]"
                >
                  Book a Demo
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <Link
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/20 px-7 font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                >
                  Talk to Our Team
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
              <div className="rounded-[24px] bg-[#F7F5F0] p-6 text-[#082A46]">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium text-[#082A46]/50">
                      Operational Framework
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      From Assignment to Verified Completion
                    </h2>
                  </div>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6AF68]/15">
                    <Sparkles className="h-5 w-5 text-[#A87925]" />
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {operationalSteps.map((step) => (
                    <div
                      key={step.number}
                      className="flex gap-4 rounded-2xl border border-[#082A46]/8 bg-white p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#082A46] text-xs font-semibold text-[#E8C686]">
                        {step.number}
                      </div>

                      <div>
                        <h3 className="font-semibold">{step.title}</h3>

                        <p className="mt-1 text-sm leading-6 text-[#082A46]/60">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#082A46] px-5 py-4 text-white">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#E8C686]">
                      Luxe &amp; Pristine
                    </p>

                    <p className="mt-1 text-sm text-white/70">
                      Cleaning Intelligence for Modern Hospitality
                    </p>
                  </div>

                  <CheckCircle2 className="h-6 w-6 text-[#E8C686]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#A87925]">
            Cleaning Intelligence Platform
          </p>

          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#082A46] sm:text-5xl">
            Everything Your Cleaning Operation Needs.
          </h2>

          <p className="mt-5 text-lg leading-8 text-[#082A46]/60">
            Replace scattered communication and manual processes with one
            operational workflow built specifically for vacation rental
            housekeeping.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {operationModules.map((module) => {
            const Icon = module.icon;

            return (
              <Link
                key={module.title}
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-[28px] border border-[#082A46]/10 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#D6AF68]/60 hover:shadow-xl hover:shadow-[#082A46]/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#082A46] text-[#E8C686] transition group-hover:bg-[#D6AF68] group-hover:text-[#082A46]">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-7 text-xl font-semibold tracking-tight">
                  {module.title}
                </h3>

                <p className="mt-3 min-h-[72px] text-sm leading-6 text-[#082A46]/60">
                  {module.description}
                </p>

                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#A87925]">
                  Explore Module
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-[#082A46]/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:px-8 md:grid-cols-3 lg:px-12">
          <div>
            <p className="text-4xl font-semibold tracking-[-0.04em]">
              Operational Clarity
            </p>

            <p className="mt-3 text-sm leading-6 text-[#082A46]/60">
              Every cleaner knows exactly what to do, where to go and when the
              turnover must be completed.
            </p>
          </div>

          <div>
            <p className="text-4xl font-semibold tracking-[-0.04em]">
              Complete Traceability
            </p>

            <p className="mt-3 text-sm leading-6 text-[#082A46]/60">
              Every turnover is documented from assignment through verified
              completion.
            </p>
          </div>

          <div>
            <p className="text-4xl font-semibold tracking-[-0.04em]">
              Scalable Operations
            </p>

            <p className="mt-3 text-sm leading-6 text-[#082A46]/60">
              Deliver the same operational standard across every property,
              building and client.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[36px] bg-[#082A46] px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#E8C686]">
              Let&apos;s Build Together
            </p>

            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Transform Your Cleaning Operation with Intelligence.
            </h2>

            <p className="mt-4 max-w-xl leading-7 text-white/60">
              Whether you manage one property or an entire portfolio, Luxe
              &amp; Pristine helps you standardize and improve every turnover.
            </p>
          </div>

          <Link
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#D6AF68] px-7 font-semibold text-[#082A46] transition hover:bg-[#E8C686] lg:mt-0"
          >
            Schedule a Demo
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#082A46]/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-[#082A46]/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© 2026 Luxe &amp; Pristine.</p>

          <p>Cleaning Intelligence for Short-Term Rental Operators.</p>
        </div>
      </footer>
    </main>
  );
}