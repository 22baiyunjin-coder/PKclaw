"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Bot,
  BookOpen,
  Coins,
  GraduationCap,
  HandMetal,
  MessageSquare,
  Sparkles,
  Spade,
  Trophy,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const quickActions = [
  {
    icon: Bot,
    label: "开始打牌",
    desc: "与 AI 对手进行德扑对战",
    href: "/game",
    color: "from-violet-600 to-purple-600",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: MessageSquare,
    label: "讨论手牌",
    desc: "用自然语言讨论任意手牌",
    href: "/chat",
    color: "from-blue-600 to-cyan-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: GraduationCap,
    label: "AI 复盘",
    desc: "深度分析你最近的手牌数据",
    href: "/analysis",
    color: "from-emerald-600 to-teal-600",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Wallet,
    label: "账本",
    desc: "查看筹码变化和战绩统计",
    href: "/profile",
    color: "from-amber-600 to-orange-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: HandMetal,
    label: "角色工坊",
    desc: "创建和定制你的 AI 对手",
    href: "/personas",
    color: "from-pink-600 to-rose-600",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: BookOpen,
    label: "手牌仓库",
    desc: "管理历史手牌和导入记录",
    href: "/hands",
    color: "from-indigo-600 to-violet-600",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    iconColor: "text-indigo-400",
  },
  {
    icon: Sparkles,
    label: "角色市场",
    desc: "发现其他玩家创建的 AI 对手",
    href: "/marketplace",
    color: "from-fuchsia-600 to-pink-600",
    bg: "bg-fuchsia-500/10",
    border: "border-fuchsia-500/20",
    iconColor: "text-fuchsia-400",
  },
  {
    icon: Trophy,
    label: "排行榜",
    desc: "查看全服玩家排名",
    href: "/leaderboard",
    color: "from-yellow-600 to-amber-600",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    iconColor: "text-yellow-400",
  },
]

export default function HomePage() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center border-b border-zinc-800 px-6">
        <h1 className="text-sm font-medium text-zinc-400">首页</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-12">
          {/* Welcome */}
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25">
              <Spade className="h-7 w-7 text-white" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">欢迎来到 PokerMind</h2>
            <p className="text-sm text-zinc-500">
              选择一个功能开始，或直接开始打牌
            </p>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              const isHovered = hoveredIndex === index

              return (
                <Link key={action.href} href={action.href}>
                  <div
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition-all duration-200",
                      action.border,
                      action.bg,
                      isHovered ? "scale-[1.02] border-opacity-60" : "border-opacity-30"
                    )}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Glow */}
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300",
                        `bg-gradient-to-br ${action.color}`,
                        isHovered && "opacity-5"
                      )}
                    />

                    <div className="relative flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          `bg-gradient-to-br ${action.color}`,
                          "shadow-lg"
                        )}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 font-semibold text-white group-hover:text-zinc-200">
                          {action.label}
                        </div>
                        <div className="text-xs leading-relaxed text-zinc-500">
                          {action.desc}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <Link href="/game">
              <Button
                size="lg"
                className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-10 font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-105 hover:shadow-violet-500/40"
              >
                <Bot className="mr-2 h-5 w-5" />
                立即开始打牌
              </Button>
            </Link>
            <p className="mt-3 text-xs text-zinc-600">
              不需要注册，直接以游客身份开始体验
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
