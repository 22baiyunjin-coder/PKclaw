"use client"

import { Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Locale, setClientLocale } from "@/lib/i18n"

interface LanguageSwitcherProps {
  locale: Locale
  compact?: boolean
}

export function LanguageSwitcher({
  locale,
  compact = false,
}: LanguageSwitcherProps) {
  const labels = {
    zh: {
      title: "语言",
      english: "英文",
      chinese: "中文",
    },
    en: {
      title: "Language",
      english: "English",
      chinese: "Chinese",
    },
  }[locale]

  function updateLocale(nextLocale: Locale) {
    if (nextLocale === locale) {
      return
    }

    setClientLocale(nextLocale)
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
        >
          <Globe className="h-4 w-4" />
          {!compact ? <span className="ml-2 uppercase">{locale}</span> : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-40 border-slate-800 bg-slate-900 text-slate-200"
      >
        <DropdownMenuLabel>{labels.title}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem
          onClick={() => updateLocale("zh")}
          className="cursor-pointer focus:bg-slate-800 focus:text-white"
        >
          {labels.chinese}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => updateLocale("en")}
          className="cursor-pointer focus:bg-slate-800 focus:text-white"
        >
          {labels.english}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
