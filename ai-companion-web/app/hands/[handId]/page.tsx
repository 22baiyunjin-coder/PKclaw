import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getHandRecord } from "@/app/actions/hand-records"
import { HandReviewDesk } from "@/components/hand-review/HandReviewDesk"
import { SiteHeader } from "@/components/layout/site-header"
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex items-center justify-between">
          <Link href="/hands">
            <Button variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.back}
            </Button>
          </Link>
        </div>

        <HandReviewDesk record={record} locale={locale} />
      </main>
    </div>
  )
}
