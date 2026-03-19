"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Coins, LogOut, RefreshCw, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type Locale, pickText } from "@/lib/i18n"

interface RebuyDialogProps {
  isOpen: boolean
  onRebuy: () => void
  onExit: () => void
  balance: number
  buyInAmount: number
  locale: Locale
}

export function RebuyDialog({
  isOpen,
  onRebuy,
  onExit,
  balance,
  buyInAmount,
  locale,
}: RebuyDialogProps) {
  const canAfford = balance >= buyInAmount

  const copy = useMemo(
    () => ({
      title: pickText(locale, { zh: "筹码不足", en: "Low on Chips" }),
      subtitle: pickText(locale, {
        zh: "你的本桌筹码已经见底。",
        en: "Your table stack has run out.",
      }),
      balance: pickText(locale, { zh: "当前账户余额", en: "Current Balance" }),
      insufficient: pickText(locale, {
        zh: `余额不足，无法买入 ${buyInAmount}`,
        en: `Balance too low to rebuy ${buyInAmount}`,
      }),
      topUp: pickText(locale, { zh: "前往商城充值", en: "Go to Chip Store" }),
      exit: pickText(locale, { zh: "退出牌局", en: "Leave Table" }),
      rebuy: pickText(locale, { zh: `买入 ${buyInAmount}`, en: `Rebuy ${buyInAmount}` }),
    }),
    [buyInAmount, locale],
  )

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="border-slate-800 bg-slate-900 text-white sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center text-2xl font-bold">
            <Coins className="h-8 w-8 text-violet-400" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-center text-lg text-slate-400">
            {copy.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
            <div className="mb-1 text-sm text-slate-500">{copy.balance}</div>
            <div className="text-2xl font-bold text-violet-400">
              ${balance.toLocaleString()}
            </div>
          </div>

          {!canAfford ? (
            <div className="w-full space-y-3">
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-center text-sm font-medium text-red-400">
                {copy.insufficient}
              </div>
              <Link href="/shop" className="block">
                <Button className="h-11 w-full bg-violet-500 font-bold text-white shadow-lg shadow-violet-900/20 hover:bg-violet-600">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {copy.topUp}
                </Button>
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={onExit}
            className="h-12 w-full border-slate-700 bg-slate-950/50 transition-colors hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-400"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {copy.exit}
          </Button>
          <Button
            onClick={onRebuy}
            disabled={!canAfford}
            className="h-12 w-full bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.rebuy}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
