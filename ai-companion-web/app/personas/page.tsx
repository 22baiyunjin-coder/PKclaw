import { PersonaWorkshop } from "@/components/persona/PersonaWorkshop";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function PersonasPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_26%),linear-gradient(180deg,#030712_0%,#08111d_46%,#03060d_100%)] text-white">
      <SiteHeader />

      <section className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-amber-300/80">
            Persona Workshop
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white">
            Build custom poker identities for your table
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-300">
            This page is the first working version of the custom player-image feature you liked in the reference site.
            It stores personas locally, lets you promote one to the hero seat, and keeps the data structure reusable for bot logic later.
          </p>
        </div>

        <PersonaWorkshop />
      </section>

      <SiteFooter />
    </main>
  );
}
