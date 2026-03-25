"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  BookOpen,
  Coins,
  Ghost,
  GraduationCap,
  HandMetal,
  Hash,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Spade,
  Trophy,
  Wallet,
} from "lucide-react"
import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: string
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const mainNav: NavSection[] = [
  {
    label: "核心功能",
    items: [
      { icon: Bot, label: "开始打牌", href: "/game" },
      { icon: MessageSquare, label: "手牌讨论", href: "/chat" },
      { icon: GraduationCap, label: "AI 复盘", href: "/analysis" },
    ],
  },
  {
    label: "我的资产",
    items: [
      { icon: Wallet, label: "账本", href: "/profile" },
      { icon: Coins, label: "充值", href: "/shop" },
      { icon: Trophy, label: "排行榜", href: "/leaderboard" },
    ],
  },
  {
    label: "内容库",
    items: [
      { icon: HandMetal, label: "角色工坊", href: "/personas" },
      { icon: BookOpen, label: "手牌仓库", href: "/hands" },
      { icon: Sparkles, label: "角色市场", href: "/marketplace" },
    ],
  },
]

const bottomNav: NavSection[] = [
  {
    items: [
      { icon: Settings, label: "设置", href: "/settings" },
      { icon: Hash, label: "帮助", href: "/help" },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await signOut()
    window.location.href = "/"
  }

  const NavSection = ({ section }: { section: NavSection }) => (
    <div className="space-y-0.5">
      {section.label && (
        <div className="px-3 pt-4 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {section.label}
          </span>
        </div>
      )}
      {section.items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
        const Icon = item.icon

        return (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 mx-1.5 text-sm transition-all duration-150",
                isActive
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                  {item.badge}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 font-black text-white shadow-lg shadow-violet-500/25">
          <Spade className="h-4 w-4" />
        </div>
        <div>
          <span className="font-bold text-white">PokerMind</span>
          <span className="ml-1.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
            Beta
          </span>
        </div>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {mainNav.map((section) => (
          <NavSection key={section.label} section={section} />
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-zinc-800 px-1 py-2">
        <NavSection section={bottomNav[0]} />

        {/* Sign Out */}
        <form action={handleSignOut} className="mt-1">
          <button
            type="submit"
            disabled={isSigningOut}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 mx-1.5 text-sm text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-300 disabled:opacity-50"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span>{isSigningOut ? "退出中..." : "退出登录"}</span>
          </button>
        </form>

        {/* User Profile Mini */}
        <div className="mt-2 flex items-center gap-2.5 rounded-lg mx-1.5 px-3 py-2.5 bg-zinc-900/50 border border-zinc-800">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-violet-600 text-xs text-white">P</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-zinc-300">Player</div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Coins className="h-2.5 w-2.5 text-violet-400" />
              <span>4,000</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
