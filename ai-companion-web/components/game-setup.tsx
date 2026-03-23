"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Activity,
  Check,
  Home,
  Play,
  Settings2,
  Users,
  Zap,
} from "lucide-react"

import { Persona } from "@/lib/poker-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { type Locale, pickText } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface GameSetupProps {
  personas: Persona[]
  userProfile: any
  locale: Locale
  onStart: (selectedPersonaIds: string[]) => void
}

export function GameSetup({ personas, locale, onStart }: GameSetupProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    personas.slice(0, 5).map((persona) => persona.id),
  )

  const copy = useMemo(
    () => ({
      backHome: pickText(locale, { zh: "返回首页", en: "Back Home" }),
      title: pickText(locale, { zh: "牌桌配置", en: "Table Setup" }),
      subtitle: pickText(locale, {
        zh: "选择你想要一起上桌的 AI 对手。",
        en: "Choose the AI opponents you want at the table.",
      }),
      training: pickText(locale, { zh: "职业特训模式", en: "Pro Training Mode" }),
      party: pickText(locale, { zh: "娱乐混战模式", en: "Party Mode" }),
      market: pickText(locale, { zh: "角色市场", en: "Marketplace" }),
      customSelection: pickText(locale, { zh: "自定义选择", en: "Custom Selection" }),
      tapHint: pickText(locale, {
        zh: "点击头像选择或取消",
        en: "Tap a card to select or deselect",
      }),
      start: pickText(locale, { zh: "开始游戏", en: "Start Game" }),
    }),
    [locale],
  )

  copy.training = pickText(locale, { zh: "手牌复盘模式", en: "Hand Review Mode" })

  const togglePersona = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          return prev
        }
        return prev.filter((item) => item !== id)
      }

      if (prev.length >= 8) {
        return prev
      }

      return [...prev, id]
    })
  }

  const handlePresetSelect = (mode: "party") => {
    const funs = personas.filter((persona) =>
      ["river_ambassador", "evil_kuromi", "od_sao_nan", "cat_17"].includes(persona.id),
    )
    setSelectedIds(funs.map((persona) => persona.id))
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />

      <Link href="/" className="absolute left-6 top-6 z-20">
        <Button
          variant="ghost"
          className="text-slate-400 transition-all hover:bg-white/5 hover:text-white"
        >
          <Home className="mr-2 h-4 w-4" />
          {copy.backHome}
        </Button>
      </Link>

      <Card className="relative z-10 w-full max-w-5xl border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
        <CardHeader className="border-b border-white/5 pb-8 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-3xl font-black tracking-tight text-white">
            <Users className="h-8 w-8 text-violet-400" />
            {copy.title}
          </CardTitle>
          <CardDescription className="text-lg text-slate-400">
            {copy.subtitle}
          </CardDescription>

          <div className="mt-6 flex justify-center gap-4">
            <Link href="/hands">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950 hover:border-indigo-500 hover:bg-indigo-900/20 hover:text-indigo-400"
              >
                <Zap className="mr-2 h-4 w-4" />
                {copy.training}
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={() => handlePresetSelect("party")}
              className="border-slate-700 bg-slate-950 hover:border-violet-500 hover:bg-violet-900/20 hover:text-violet-400"
            >
              <Activity className="mr-2 h-4 w-4" />
              {copy.party}
            </Button>

            <Link href="/marketplace">
              <Button
                variant="outline"
              className="border-violet-500/50 bg-slate-950 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:border-violet-400 hover:bg-violet-900/20 hover:text-violet-300"
              >
                <Users className="mr-2 h-4 w-4" />
                {copy.market}
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-300">
              <Settings2 className="h-4 w-4" />
              {copy.customSelection} ({selectedIds.length}/8)
            </h3>
            <span className="text-xs text-slate-500">{copy.tapHint}</span>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {personas.map((persona) => {
                const isSelected = selectedIds.includes(persona.id)

                return (
                  <div
                    key={persona.id}
                    onClick={() => togglePersona(persona.id)}
                    className={cn(
                      "group relative flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200",
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900",
                    )}
                  >
                    <Avatar className="h-12 w-12 border border-white/10">
                      <AvatarFallback
                        className={cn(
                          "font-bold",
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-500",
                        )}
                      >
                        {Array.from(persona.name)[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <h4
                          className={cn(
                            "truncate font-bold",
                            isSelected ? "text-white" : "text-slate-400",
                          )}
                        >
                          {persona.name}
                        </h4>

                        {isSelected ? (
                          <div className="rounded-full bg-indigo-500 p-0.5">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        ) : null}
                      </div>

                      <Badge
                        variant="outline"
                        className="mb-2 border-white/10 bg-black/20 text-slate-500"
                      >
                        {persona.style}
                      </Badge>

                      <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-600">
                        {persona.description.replace(/\*\*/g, "").slice(0, 70)}...
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          <div className="mt-8 flex items-center justify-center">
            <Button
              size="lg"
              onClick={() => onStart(selectedIds)}
              className="rounded-full bg-violet-600 px-12 py-6 text-lg font-bold text-white shadow-lg shadow-violet-950/20 transition-all hover:scale-105 hover:bg-violet-700"
            >
              {copy.start}
              <Play className="ml-2 h-6 w-6 fill-current" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
