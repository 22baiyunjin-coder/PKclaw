import Link from "next/link";

interface SiteHeaderProps {
  inverse?: boolean;
}

export function SiteHeader({ inverse = false }: SiteHeaderProps) {
  const mutedText = inverse ? "text-slate-300" : "text-slate-400";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/45 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-sm font-black text-black shadow-[0_0_28px_-8px_rgba(251,191,36,0.85)]">
            PK
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-amber-300/80">
              PKmind
            </div>
            <div className={`text-xs ${mutedText}`}>Poker replay and persona studio</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/game" className={`text-sm transition hover:text-white ${mutedText}`}>
            Arena
          </Link>
          <Link href="/personas" className={`text-sm transition hover:text-white ${mutedText}`}>
            Personas
          </Link>
          <Link href="/marketplace" className={`text-sm transition hover:text-white ${mutedText}`}>
            Marketplace
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/personas"
            className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10 sm:inline-flex"
          >
            Open Workshop
          </Link>
          <Link
            href="/game"
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Enter Arena
          </Link>
        </div>
      </div>
    </header>
  );
}
