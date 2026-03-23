import { NextResponse } from "next/server"

import { ensureProfileForUser } from "@/lib/profile-bootstrap"
import { hasSupabaseEnv } from "@/lib/supabase-env"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next") ?? "/"

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(`${origin}/login?error=supabase-not-configured`)
  }

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash: tokenHash,
    })

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await ensureProfileForUser(supabase, user)
      }

      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/update-password`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const code = searchParams.get("code")
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await ensureProfileForUser(supabase, user)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
