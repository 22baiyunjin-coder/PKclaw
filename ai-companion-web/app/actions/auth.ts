'use server'

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { hasSupabaseEnv } from "@/lib/supabase-env"

export async function signOut() {
  if (!hasSupabaseEnv()) {
    return redirect("/login")
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect("/login")
}
