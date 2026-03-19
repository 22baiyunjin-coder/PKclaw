import { MarketplaceGrid } from "@/components/persona/MarketplaceGrid";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_22%),linear-gradient(180deg,#030712_0%,#08111d_46%,#03060d_100%)] text-white">
      <SiteHeader />

      <section className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-indigo-300/80">
              Persona Marketplace
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white">
              Browse table-ready AI player archetypes
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-300">
              This page mirrors the market/workshop split of the reference product, but uses our own PKmind roster
              and a one-click clone flow back into the local workshop.
            </p>
          </div>
        </div>

        <MarketplaceGrid />
      </section>

      <SiteFooter />
    </main>
  );
}
