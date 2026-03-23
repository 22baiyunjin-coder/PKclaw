'use server'

import { ensureProfileForUser } from '@/lib/profile-bootstrap'
import { hasSupabaseEnv } from '@/lib/supabase-env'
import { createClient } from '@/utils/supabase/server'

export async function saveGameResult(profit: number, handDetails: any) {
  if (!hasSupabaseEnv()) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Use the RPC function we created for atomic update
  const { data: newChips, error } = await supabase.rpc('record_game_result', {
    p_user_id: user.id,
    p_profit: profit,
    p_hand_details: handDetails
  })

  if (error) {
    console.error('Error saving game result:', error)
    // We don't throw here to avoid crashing the UI, but we log it
    return null
  }
  
  return newChips
}

export async function getUserProfile() {
  if (!hasSupabaseEnv()) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  return ensureProfileForUser(supabase, user)
}
