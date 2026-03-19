import Link from "next/link";

import { PersonaCard } from "@/components/persona/PersonaCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DEFAULT_PERSONA, PERSONA_LIBRARY } from "@/lib/persona";

const featureRows = [
  {
    eyebrow: "Replay Arena",
    title: "8-seat replay built for real hand reconstruction",
    body:
      "Turn freeform hand descriptions or voice input into a visible table state, then walk the action tree with an assistant that actually understands the spot.",
    bullets: ["Step-by-step replay controls", "Seat-aware lineups and hole-card previews", "Future-ready contract for pkbot replay output"],
  },
  {
    eyebrow: "Persona Workshop",
    title: "Custom player identity, not just a name field",
    body:
      "Design AI opponents and hero profiles with editable strategy prompts, style metrics, and a composable avatar system you can bring straight into the arena.",
    bullets: ["Visual avatar builder", "Hero persona handoff into the table", "Prompt + style package saved in browser"],
  },
  {
    eyebrow: "AI Review",
    title: "Chat that can follow the current node, not just generic questions",
    body:
      "The discussion panel can inherit replay context, making it a better fit for hand breakdowns, leak finding, and future solver-style follow-up.",
    bullets: ["Replay context passed into chat", "Speech-to-text input", "MiniMax-ready backend with local fallback"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,#030712_0%,#06101c_45%,#04070d_100%)] text-white">
      <SiteHeader />

      <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] rounded-full bg-amber-500/12 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-24 h-[360px] w-[360px] rounded-full bg-cyan-400/8 blur-[120px]" />

        <div className="mx-auto grid max-w-[1320px] gap-12 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="pt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-amber-200">
              PKmind Product Prototype
            </div>
            <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl xl:text-7xl">
              Build the poker product around the table, the personas, and the replay.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              This version takes the original chat MVP and pushes it toward a fuller product structure:
              marketing site, live arena, persona workshop, and a marketplace-like library for AI player identities.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/game"
                className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110"
              >
                Enter the Arena
              </Link>
              <Link
                href="/personas"
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
              >
                Open Persona Workshop
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Product Shape</div>
                <div className="mt-2 text-2xl font-semibold">Site + Arena + Workshop</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Replay Goal</div>
                <div className="mt-2 text-2xl font-semibold">8-seat hand visualization</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Model Layer</div>
                <div className="mt-2 text-2xl font-semibold">MiniMax-ready, mock-safe</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[36px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_90px_rgba(2,6,23,0.45)]">
              <div className="rounded-[30px] border border-white/10 bg-slate-950/85 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                      Featured Surface
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">PKmind Arena</h2>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                    Replay-ready
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <PersonaCard persona={DEFAULT_PERSONA} />
                  <div className="grid gap-4 md:grid-cols-2">
                    {PERSONA_LIBRARY.slice(1, 3).map((persona) => (
                      <PersonaCard key={persona.id} persona={persona} compact />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1320px] space-y-6">
          {featureRows.map((feature, index) => (
            <div
              key={feature.title}
              className={`grid gap-8 rounded-[34px] border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-2 lg:p-8 ${
                index % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
              }`}
            >
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
                  {feature.eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white">{feature.title}</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">{feature.body}</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
                <ul className="space-y-4">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm leading-7 text-slate-200">
                      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1320px] rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_42%),rgba(255,255,255,0.04)] p-8 text-center">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-amber-300/80">
            Next Step
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-white">
            Keep the current shell, then wire it into the real poker engine.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-300">
            The product structure is now in place. The natural continuation is to connect hand parsing,
            bot decision output, and richer replay data from the existing PKclaw code.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/game"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Open Live Arena
            </Link>
            <Link
              href="/marketplace"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Browse Persona Marketplace
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
