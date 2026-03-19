import Link from "next/link";

import { SiteHeader } from "@/components/site/SiteHeader";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.1),transparent_24%),linear-gradient(180deg,#020617_0%,#07111d_42%,#02040a_100%)] text-white">
      <SiteHeader />

      <section className="mx-auto flex max-w-[1320px] items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg rounded-[34px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_28px_90px_rgba(2,6,23,0.42)]">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-amber-300/80">
            Identity Layer
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Auth is not wired yet</h1>
          <p className="mt-4 text-base leading-8 text-slate-300">
            The product shell is already in place, but login remains intentionally lightweight for this MVP.
            You can still explore the arena, the persona workshop, and the marketplace right now.
          </p>

          <div className="mt-8 grid gap-4">
            <div className="rounded-[24px] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              Planned next step: add a persistent account layer for custom personas, saved hands, and replay history.
            </div>
            <Link
              href="/game"
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-center text-sm font-semibold text-black transition hover:brightness-110"
            >
              Continue to Arena
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
