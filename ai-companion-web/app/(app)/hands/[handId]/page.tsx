import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getHandRecord } from "@/app/actions/hand-records"
import { HandReviewDesk } from "@/components/hand-review/HandReviewDesk"
import { Button } from "@/components/ui/button"
import { getServerLocale } from "@/lib/i18n-server"
import { pickText } from "@/lib/i18n"

interface HandReviewPageProps {
  params: Promise<{
    handId: string
  }>
}

export default async function HandReviewPage({ params }: HandReviewPageProps) {
  const { handId } = await params
  const locale = await getServerLocale()
  const record = await getHandRecord(handId)

  if (!record) {
    notFound()
  }

  const copy = {
    back: pickText(locale, { zh: "返回手牌库", en: "Back to Hand Library" }),
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 px-6">
        <Link href="/hands">
          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回手牌库
          </Button>
        </Link>
        <div className="h-4 w-px bg-zinc-800" />
        <span className="text-sm font-medium text-zinc-400">手牌详情</span>
      </div>
      <main className="flex-1 overflow-y-auto mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-8">
        <HandReviewDesk record={record} locale={locale} />
      </main>
    </div>
  )
}
