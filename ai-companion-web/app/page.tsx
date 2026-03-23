import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Bot,
  Coins,
  Heart,
  Spade,
  Target,
  Zap,
} from "lucide-react"

import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import { pickText } from "@/lib/i18n"
import { getServerLocale } from "@/lib/i18n-server"
import { hasSupabaseEnv } from "@/lib/supabase-env"
import { createClient } from "@/utils/supabase/server"

export default async function LandingPage() {
  const locale = await getServerLocale()
  let user = null

  if (hasSupabaseEnv()) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  const copy = {
    badge: "Beta v1.0 Live",
    stat: pickText(locale, {
      zh: "1,204 手牌今日已训练",
      en: "1,204 hands trained today",
    }),
    titleLead: pickText(locale, {
      zh: "把德州训练做成真正的",
      en: "Make poker training feel like a real",
    }),
    titleBrand: "PokerMind",
    subtitle: pickText(locale, {
      zh: "这不只是普通的扑克游戏，而是你的私人训练场、战术实验室和 AI 复盘系统。",
      en: "Not just a poker game, but your private training arena, strategy lab, and AI replay system.",
    }),
    enter: pickText(locale, { zh: "进入大厅", en: "Enter Arena" }),
    profile: pickText(locale, { zh: "战绩中心", en: "Profile" }),
    market: pickText(locale, { zh: "角色市场", en: "Marketplace" }),
    join: pickText(locale, { zh: "立即加入", en: "Join Now" }),
    guest: pickText(locale, { zh: "游客试玩", en: "Try as Guest" }),
    analysisTitle: pickText(locale, { zh: "AI 深度复盘", en: "AI Deep Analysis" }),
    analysisSub: pickText(locale, {
      zh: "世界级扑克教练风格的专属分析",
      en: "Personalized coaching in a high-end poker tone",
    }),
    analysisBody: pickText(locale, {
      zh: "让 AI 教练分析你最近 100 手牌，生成风格诊断、关键手牌复盘和针对性的提升建议。",
      en: "Let the AI coach analyze your latest 100 hands and generate style diagnosis, key-hand reviews, and concrete improvement suggestions.",
    }),
    analysisButton: pickText(locale, {
      zh: "立即生成我的复盘报告",
      en: "Generate My Report",
    }),
    feature1Title: pickText(locale, { zh: "真实战绩模拟", en: "Live bankroll simulation" }),
    feature1Body: pickText(locale, {
      zh: "每一局结果都会记入你的模拟账户，让每一个决策都带着真实压力和成长反馈。",
      en: "Every session updates your simulated bankroll, turning each decision into meaningful pressure and feedback.",
    }),
    feature1Bullets: pickText(locale, {
      zh: ["实时积分追踪", "模拟资金管理", "全局技术排行榜"],
      en: ["Live score tracking", "Bankroll simulation", "Global skill leaderboard"],
    }),
    feature2Title: pickText(locale, { zh: "AI 角色工坊", en: "AI persona workshop" }),
    feature2Body: pickText(locale, {
      zh: "定制 AI 对手的性格、打法和激进程度。你可以挑战疯子、学习 GTO，或者构建自己的训练阵容。",
      en: "Customize AI opponents by personality, style, and aggression. Build maniacs, GTO grinders, or your own training lineup.",
    }),
    workshop: pickText(locale, { zh: "我的工坊", en: "My Workshop" }),
    marketButton: pickText(locale, { zh: "角色市场", en: "Persona Market" }),
    feature3Title: pickText(locale, { zh: "深度复盘分析", en: "Deep replay analysis" }),
    feature3Body: pickText(locale, {
      zh: "不只是打牌，更是学习。AI 会从风格、下注、胜率波动和关键错误里拆出真正有用的提升点。",
      en: "This is not only about playing hands. The AI breaks down style, sizing, win-rate swings, and key mistakes into useful improvement paths.",
    }),
    feature3Bullets: pickText(locale, {
      zh: ["六维能力雷达图", "关键手牌复盘", "个性化打法建议"],
      en: ["Six-axis radar profile", "Key-hand reviews", "Personalized improvement advice"],
    }),
    ctaTitle: pickText(locale, {
      zh: "准备好开始你的训练局了吗？",
      en: "Ready to start your training run?",
    }),
    ctaBody: pickText(locale, {
      zh: "立即注册，领取初始筹码，进入 PokerMind 的训练桌。",
      en: "Sign up, claim your starting chips, and step into the PokerMind training table.",
    }),
    ctaButton: pickText(locale, { zh: "免费注册", en: "Create Free Account" }),
    footer: "© 2026 PokerMind. All rights reserved.",
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans selection:bg-violet-500/30">
      <SiteHeader />

      <main className="flex flex-1 flex-col">
        <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
          <div className="absolute left-0 top-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
          <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[120px] animate-pulse" />

          <div className="relative z-10 mx-auto max-w-5xl space-y-10">
            <div className="absolute left-10 top-0 hidden animate-bounce opacity-20 delay-100 md:block">
              <Spade className="h-24 w-24 rotate-12 text-slate-700" />
            </div>
            <div className="absolute bottom-20 right-10 hidden animate-bounce opacity-20 delay-300 md:block">
              <Heart className="h-24 w-24 -rotate-12 text-red-900" />
            </div>

            <div className="animate-in fade-in slide-in-from-top-4 mb-6 flex items-center justify-center gap-3 duration-1000">
              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-400">
                {copy.badge}
              </span>
              <span className="flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <Activity className="h-3 w-3" />
                {copy.stat}
              </span>
            </div>

            <h1 className="animate-in fade-in zoom-in text-6xl font-black tracking-tighter text-white drop-shadow-2xl duration-700 md:text-8xl">
              {copy.titleLead}{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
                {copy.titleBrand}
              </span>
            </h1>

            <p className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-3xl text-xl font-light leading-relaxed text-slate-400 duration-700 delay-200 md:text-3xl">
              {copy.subtitle}
            </p>

            <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center justify-center gap-6 pt-8 duration-700 delay-300 sm:flex-row">
              {user ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex flex-wrap justify-center gap-4">
                    <Link href="/game">
                      <Button
                        size="lg"
                        className="h-16 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-600 px-10 text-xl text-white shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)] transition-all hover:scale-105 hover:from-violet-500 hover:via-fuchsia-500 hover:to-purple-500 hover:shadow-[0_0_60px_-10px_rgba(139,92,246,0.7)]"
                      >
                        {copy.enter}
                        <ArrowRight className="ml-2 h-6 w-6" />
                      </Button>
                    </Link>

                    <Link href="/profile">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-16 rounded-2xl border-slate-700 px-10 text-xl text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        {copy.profile}
                      </Button>
                    </Link>

                    <Link href="/hands">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-16 rounded-2xl border-indigo-500/30 px-10 text-xl text-indigo-300 hover:bg-indigo-950/30 hover:text-indigo-200"
                      >
                        Hand Library
                      </Button>
                    </Link>

                    <Link href="/marketplace">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-16 rounded-2xl border-violet-500/30 px-10 text-xl text-violet-400 hover:bg-violet-950/30 hover:text-violet-300"
                      >
                        {copy.market}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <Link href="/login">
                    <Button
                      size="lg"
                        className="h-16 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-600 px-10 text-xl text-white shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)] transition-all hover:scale-105 hover:from-violet-500 hover:via-fuchsia-500 hover:to-purple-500 hover:shadow-[0_0_60px_-10px_rgba(139,92,246,0.7)]"
                    >
                      {copy.join}
                      <ArrowRight className="ml-2 h-6 w-6" />
                    </Button>
                  </Link>

                  <Link href="/game">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="h-16 rounded-2xl px-10 text-xl text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      {copy.guest}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-slate-600">
            <ArrowRight className="h-6 w-6 rotate-90" />
          </div>
        </section>

        {user ? (
          <section className="bg-gradient-to-b from-slate-950 to-slate-900 py-16">
            <div className="container mx-auto px-6">
              <Link href="/profile/analysis" className="group block">
                <div className="relative mx-auto max-w-5xl rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-1 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/50">
                  <div className="absolute -right-4 -top-4 z-10 rounded-full bg-violet-500 px-5 py-2 text-sm font-bold text-white shadow-lg animate-bounce">
                    Hot
                  </div>

                  <div className="rounded-[22px] bg-slate-900/95 p-8 md:p-12">
                    <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
                      <div className="flex-1 text-center lg:text-left">
                        <div className="mb-4 flex items-center justify-center gap-4 lg:justify-start">
                          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 animate-pulse">
                            <Bot className="h-10 w-10 text-white" />
                          </div>
                          <div>
                            <h2 className="mb-1 text-3xl font-black text-white md:text-4xl">
                              {copy.analysisTitle}
                            </h2>
                            <p className="text-sm text-purple-300 md:text-base">
                              {copy.analysisSub}
                            </p>
                          </div>
                        </div>

                        <p className="mb-6 max-w-2xl text-lg leading-relaxed text-indigo-200 md:text-xl">
                          {copy.analysisBody}
                        </p>

                        <Button
                          size="lg"
                          className="rounded-2xl bg-gradient-to-r from-white to-indigo-50 px-10 py-7 text-lg text-indigo-900 shadow-2xl transition-all hover:scale-105 hover:from-indigo-50 hover:to-white group-hover:shadow-xl md:text-xl"
                        >
                          {copy.analysisButton}
                          <Zap className="ml-2 h-6 w-6" />
                        </Button>
                      </div>

                      <div className="relative h-64 w-64 flex-shrink-0 lg:h-80 lg:w-80">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 blur-3xl animate-pulse" />
                        <div className="relative flex h-full w-full items-center justify-center">
                          <div className="absolute inset-8 rounded-full border border-green-500/30" />
                          <div className="absolute inset-16 rounded-full border border-green-500/20" />
                          <div className="h-32 w-32 rounded-full bg-green-500/20 blur-xl" />
                          <Zap className="relative z-10 h-16 w-16 text-green-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </section>
        ) : null}

        <section className="bg-slate-950 py-0">
          <div className="container mx-auto border-t border-white/5 px-6 py-24">
            <div className="flex flex-col items-center gap-12 md:flex-row">
              <div className="flex-1 space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                  <Coins className="h-8 w-8 text-violet-400" />
                </div>
                <h2 className="text-4xl font-bold text-white">{copy.feature1Title}</h2>
                <p className="text-xl leading-relaxed text-slate-400">{copy.feature1Body}</p>
                <ul className="space-y-3 text-slate-300">
                  {copy.feature1Bullets.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="group relative flex-1">
                <div className="absolute inset-0 bg-violet-500/20 blur-3xl transition-all duration-500 group-hover:bg-violet-500/30" />
                <div className="relative rotate-2 rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl transition-all duration-500 group-hover:rotate-0">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-slate-400">Total Score</span>
                    <span className="text-2xl font-black text-violet-400">1,240,500</span>
                  </div>
                  <div className="relative h-32 w-full overflow-hidden rounded-xl bg-slate-800/50">
                    <div className="absolute bottom-0 left-0 h-20 w-full bg-gradient-to-t from-violet-500/20 to-transparent" />
                    <svg className="h-full w-full text-violet-400" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <path d="M0 35 L10 30 L20 32 L30 20 L40 25 L50 15 L60 18 L70 5 L80 10 L90 2 L100 5 V40 H0 Z" fill="currentColor" opacity="0.2" />
                      <path d="M0 35 L10 30 L20 32 L30 20 L40 25 L50 15 L60 18 L70 5 L80 10 L90 2 L100 5" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-y border-white/5 bg-slate-900/30">
            <div className="container mx-auto px-6 py-24">
              <div className="flex flex-col items-center gap-12 md:flex-row-reverse">
                <div className="flex-1 space-y-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10">
                    <Bot className="h-8 w-8 text-indigo-500" />
                  </div>
                  <h2 className="text-4xl font-bold text-white">{copy.feature2Title}</h2>
                  <p className="text-xl leading-relaxed text-slate-400">{copy.feature2Body}</p>
                  <div className="flex gap-4 pt-2">
                    <Link href="/personas">
                      <Button
                        variant="outline"
                        className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                      >
                        {copy.workshop}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/marketplace">
                      <Button
                        variant="outline"
                        className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                      >
                        {copy.marketButton}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="group relative flex-1">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-3xl transition-all duration-500 group-hover:bg-indigo-500/30" />
                  <div className="relative -rotate-2 rounded-3xl border border-white/10 bg-slate-950 p-8 shadow-2xl transition-all duration-500 group-hover:rotate-0">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 font-bold text-red-500">
                          A
                        </div>
                        <div>
                          <div className="font-bold text-white">Aggressive Shark</div>
                          <div className="text-xs text-slate-500">VPIP: 45% | PFR: 35%</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 font-bold text-blue-500">
                          G
                        </div>
                        <div>
                          <div className="font-bold text-white">GTO Master</div>
                          <div className="text-xs text-slate-500">Balanced • Solver-first</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 font-bold text-violet-400">
                          T
                        </div>
                        <div>
                          <div className="font-bold text-white">Table Reader</div>
                          <div className="text-xs text-slate-500">Exploit • Pressure spots</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-6 py-24">
            <div className="flex flex-col items-center gap-12 md:flex-row">
              <div className="flex-1 space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10">
                  <Zap className="h-8 w-8 text-pink-500" />
                </div>
                <h2 className="text-4xl font-bold text-white">{copy.feature3Title}</h2>
                <p className="text-xl leading-relaxed text-slate-400">{copy.feature3Body}</p>
                <ul className="space-y-3 text-slate-300">
                  {copy.feature3Bullets.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-pink-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="group relative flex-1">
                <div className="absolute inset-0 bg-pink-500/20 blur-3xl transition-all duration-500 group-hover:bg-pink-500/30" />
                <div className="relative rotate-1 rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl transition-all duration-500 group-hover:rotate-0">
                  <div className="mb-6 text-sm uppercase tracking-[0.2em] text-slate-500">
                    Poker DNA
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Aggression", value: "78" },
                      { label: "Activity", value: "65" },
                      { label: "Bluff", value: "52" },
                      { label: "Survival", value: "61" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/5 bg-black/20 p-4">
                        <div className="text-xs text-slate-500">{item.label}</div>
                        <div className="mt-2 text-3xl font-black text-white">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 bg-slate-900/40 px-6 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-black text-white md:text-5xl">{copy.ctaTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400 md:text-xl">
              {copy.ctaBody}
            </p>
            <div className="mt-8">
              <Link href="/login">
                <Button
                  size="lg"
                  className="h-14 rounded-2xl bg-violet-600 px-10 text-lg font-bold text-white hover:bg-violet-500"
                >
                  {copy.ctaButton}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 px-6 py-6 text-center text-sm text-slate-500">
        {copy.footer}
      </footer>
    </div>
  )
}
