import { CompanionDesk } from "@/components/CompanionDesk";
import { DEFAULT_PERSONA } from "@/lib/persona";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_58%)]" />
      <div className="pointer-events-none absolute right-0 top-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-pink-300/10 blur-3xl" />
      <CompanionDesk persona={DEFAULT_PERSONA} />
    </main>
  );
}
