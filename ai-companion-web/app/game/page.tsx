import { PokerTable } from "@/components/poker-table"
import { SiteHeader } from "@/components/layout/site-header"
import { createClient } from "@/utils/supabase/server"
import { getPersonas } from "@/app/actions/personas"
import { getServerLocale } from "@/lib/i18n-server"
import type { Viewport } from "next"

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function GamePage() {
  const locale = await getServerLocale()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialProfile = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    initialProfile = data
  }

  // Fetch personas on server side to ensure they are available immediately
  const personas = await getPersonas()

  return (
    <div className="fixed inset-0 flex flex-col bg-black overflow-hidden">
      <PokerTable initialProfile={initialProfile} initialPersonas={personas} initialLocale={locale} />
    </div>
  )
}
