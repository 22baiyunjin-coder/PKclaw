import Link from "next/link"
import { ArrowRight, Database, FileClock, Library } from "lucide-react"

import { listHandRecords } from "@/app/actions/hand-records"
import { HandImportForm } from "@/components/hand-review/HandImportForm"
import { SiteHeader } from "@/components/layout/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerLocale } from "@/lib/i18n-server"
import { pickText } from "@/lib/i18n"
import { hasSupabaseEnv } from "@/lib/supabase-env"

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export default async function HandsPage() {
  const locale = await getServerLocale()
  const hands = await listHandRecords(60)

  const copy = {
    title: pickText(locale, { zh: "手牌库", en: "Hand Library" }),
    subtitle: pickText(locale, {
      zh: "所有站内对局、导入手牌和后续复盘，都会在这里沉淀成可检索、可回放的手牌记忆。",
      en: "Every live hand, imported hand, and future replay branch lands here as a searchable hand memory.",
    }),
    openGame: pickText(locale, { zh: "返回牌桌", en: "Back to Table" }),
    cardsTitle: pickText(locale, { zh: "已存手牌", en: "Saved Hands" }),
    cardsSub: pickText(locale, {
      zh: "按时间回看、筛选、继续提问。",
      en: "Review by time, filter by source, and keep asking follow-up questions.",
    }),
    noData: pickText(locale, {
      zh: "还没有真实手牌记录。先打一局，或者先导入一手讨论牌。",
      en: "No real hand records yet. Play a hand first or import one for discussion.",
    }),
    open: pickText(locale, { zh: "打开复盘", en: "Open Review" }),
    recordedAt: pickText(locale, { zh: "记录时间", en: "Recorded At" }),
    source: pickText(locale, { zh: "来源", en: "Source" }),
    profit: pickText(locale, { zh: "Hero 盈亏", en: "Hero P/L" }),
    unavailable: pickText(locale, {
      zh: "当前部署还没接上 Supabase，页面会展示 demo 样例，但不会真正持久化。",
      en: "Supabase is not configured for this deployment yet. The page shows a demo sample, but persistence is disabled.",
    }),
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
        <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
                  <Library className="h-6 w-6" />
                </div>
                <Badge className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/20">
                  PokerMind Review System
                </Badge>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                {copy.subtitle}
              </p>
            </div>

            <Link href="/game">
              <Button className="bg-violet-600 text-white hover:bg-violet-500">
                {copy.openGame}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {!hasSupabaseEnv() ? (
          <Card className="border-amber-500/20 bg-amber-500/10 text-amber-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Supabase
              </CardTitle>
              <CardDescription className="text-amber-100/80">
                {copy.unavailable}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-800 bg-slate-900/80">
            <CardHeader>
              <CardTitle className="text-white">{copy.cardsTitle}</CardTitle>
              <CardDescription className="text-slate-400">{copy.cardsSub}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hands.map((hand) => (
                <div
                  key={hand.id}
                  className="rounded-[24px] border border-slate-800 bg-slate-950/75 p-5 transition hover:border-slate-700"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/20">
                          {hand.source}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {hand.status}
                        </Badge>
                        {hand.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="border-slate-700 text-slate-400">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{hand.title}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-400">{hand.summary}</p>
                      </div>
                      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{copy.recordedAt}</div>
                          <div className="mt-1">{formatDate(hand.createdAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{copy.source}</div>
                          <div className="mt-1">{hand.tableName}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{copy.profit}</div>
                          <div className={`mt-1 font-semibold ${hand.heroProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {hand.heroProfit > 0 ? "+" : ""}
                            {hand.heroProfit}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Link href={`/hands/${hand.id}`}>
                      <Button variant="outline" className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800">
                        {copy.open}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}

              {hands.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/60 p-6 text-slate-400">
                  <div className="flex items-center gap-3">
                    <FileClock className="h-5 w-5 text-violet-400" />
                    <span>{copy.noData}</span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <HandImportForm locale={locale} disabled={!hasSupabaseEnv()} />
        </div>
      </main>
    </div>
  )
}
