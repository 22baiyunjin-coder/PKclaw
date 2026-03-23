"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Coins, LogOut, ShoppingCart, Trophy, User } from "lucide-react"

import { signOut } from "@/app/actions/auth"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"
import { createOptionalClient } from "@/utils/supabase/client"

function headerCopy(locale: Locale) {
  return {
    brand: "PokerMind",
    chips: pickText(locale, { zh: "充值", en: "Top Up" }),
    profile: pickText(locale, { zh: "个人中心", en: "Profile" }),
    results: pickText(locale, { zh: "战绩复盘", en: "Results" }),
    shop: pickText(locale, { zh: "筹码商城", en: "Chip Store" }),
    logout: pickText(locale, { zh: "退出登录", en: "Log Out" }),
    login: pickText(locale, { zh: "登录", en: "Log In" }),
    register: pickText(locale, { zh: "立即注册", en: "Sign Up" }),
    player: pickText(locale, { zh: "玩家", en: "Player" }),
  }
}

export function SiteHeaderClient() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [locale, setLocale] = useState<Locale>("zh")
  const supabase = createOptionalClient()
  const copy = headerCopy(locale)

  useEffect(() => {
    setLocale(readClientLocale())
  }, [])

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setProfile(null)
      return
    }

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
        setProfile(data)
      }
    }

    void getUser()
  }, [supabase])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 font-bold text-white shadow-[0_0_15px_rgba(139,92,246,0.45)]">
              PM
            </div>
            {copy.brand}
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <LanguageSwitcher locale={locale} compact />

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 sm:gap-2 sm:px-3">
                <Coins className="h-3 w-3 text-violet-400 sm:h-4 sm:w-4" />
                <span className="text-xs font-medium text-violet-400 sm:text-sm">
                  {profile?.chips?.toLocaleString() ?? 0}
                </span>
              </div>

              <Link href="/shop">
                <Button
                  size="sm"
                  className="h-7 bg-violet-500 px-2 text-xs font-bold text-white hover:bg-violet-600 sm:h-8 sm:px-3 sm:text-sm md:h-9"
                >
                  <ShoppingCart className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">{copy.chips}</span>
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9 border border-white/10">
                      <AvatarImage src={profile?.avatar_url || ""} alt={profile?.username || ""} />
                      <AvatarFallback className="bg-violet-600 text-white">
                        {profile?.username?.[0]?.toUpperCase() || "P"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-56 border-slate-800 bg-slate-900 text-slate-200"
                  align="end"
                  forceMount
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-white">
                        {profile?.username || copy.player}
                      </p>
                      <p className="text-xs leading-none text-slate-400">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator className="bg-slate-800" />

                  <DropdownMenuItem asChild>
                    <Link
                      href="/hands"
                      className="cursor-pointer focus:bg-slate-800 focus:text-white"
                    >
                      <User className="mr-2 h-4 w-4" />
                      {copy.profile}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link
                      href="/shop"
                      className="cursor-pointer focus:bg-slate-800 focus:text-white"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4 text-violet-400" />
                      <span className="font-semibold text-violet-400">{copy.shop}</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link
                      href="/profile"
                      className="cursor-pointer focus:bg-slate-800 focus:text-white"
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      {copy.results}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-slate-800" />

                  <form action={signOut}>
                    <DropdownMenuItem asChild>
                      <button className="w-full cursor-pointer text-red-400 focus:bg-red-950/30 focus:text-red-400">
                        <LogOut className="mr-2 h-4 w-4" />
                        {copy.logout}
                      </button>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  {copy.login}
                </Button>
              </Link>
              <Link href="/login?tab=register">
                <Button className="border-none bg-violet-600 text-white hover:bg-violet-700">
                  {copy.register}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
