'use server'

import { createClient } from '@/utils/supabase/server'
import { Persona } from '@/lib/poker-types'
import { revalidatePath } from 'next/cache'
import { AI_PERSONAS } from '@/lib/ai-personas'
import { hasSupabaseEnv } from '@/lib/supabase-env'

// --- Marketplace & Library Actions ---

export async function getMarketplacePersonas(sort: 'popular' | 'newest' = 'popular') {
  if (!hasSupabaseEnv()) {
    return AI_PERSONAS.map((persona) => ({
      ...persona,
      likes: 0,
      is_published: false,
      created_at: new Date(0).toISOString(),
    })) as (Persona & { likes: number, is_published: boolean })[]
  }

  const supabase = await createClient()
  
  let query = supabase
    .from('ai_personas')
    .select('*')
    .eq('is_active', true)
    .or('is_published.eq.true,is_default.eq.true')

  if (sort === 'popular') {
    query = query.order('likes', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return AI_PERSONAS.map((persona) => ({
      ...persona,
      likes: 0,
      is_published: false,
    })) as (Persona & { likes: number, is_published: boolean })[]
  }

  if (!data || data.length === 0) {
    return AI_PERSONAS.map((persona) => ({
      ...persona,
      likes: 0,
      is_published: false,
    })) as (Persona & { likes: number, is_published: boolean })[]
  }

  return data as (Persona & { likes: number, is_published: boolean })[]
}

export async function publishPersona(id: string, isPublished: boolean) {
  if (!hasSupabaseEnv()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify ownership
  const { data: existing } = await supabase
    .from('ai_personas')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!existing) throw new Error('Persona not found')
  if (existing.created_by !== user.id) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('ai_personas')
    .update({ is_published: isPublished })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/marketplace')
  revalidatePath('/personas')
}

export async function addToLibrary(personaId: string) {
  if (!hasSupabaseEnv()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Increment download count
  await supabase.rpc('increment_persona_downloads', { p_id: personaId })

  const { error } = await supabase
    .from('user_persona_library')
    .insert({ user_id: user.id, persona_id: personaId })

  // Ignore unique violation (already added)
  if (error && error.code !== '23505') throw error
  
  revalidatePath('/marketplace')
  revalidatePath('/game')
}

export async function removeFromLibrary(personaId: string) {
  if (!hasSupabaseEnv()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('user_persona_library')
    .delete()
    .eq('user_id', user.id)
    .eq('persona_id', personaId)

  if (error) throw error
  revalidatePath('/marketplace')
  revalidatePath('/game')
}

export async function votePersona(personaId: string, voteType: 'like' | 'dislike') {
  if (!hasSupabaseEnv()) return
  console.log(`[votePersona] Starting vote: ${voteType} for ${personaId}`)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
      console.error('[votePersona] No authenticated user')
      throw new Error('Not authenticated')
  }

  // Check if already voted
  const { data: existingVote, error: fetchError } = await supabase
    .from('persona_votes')
    .select('vote_type')
    .eq('user_id', user.id)
    .eq('persona_id', personaId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.error('[votePersona] Error fetching existing vote:', fetchError)
      throw fetchError
  }

  console.log(`[votePersona] Existing vote:`, existingVote)

  try {
    if (existingVote) {
        if (existingVote.vote_type === voteType) {
        // Remove vote (toggle off)
        console.log('[votePersona] Removing vote')
        const { error: delError } = await supabase
            .from('persona_votes')
            .delete()
            .eq('user_id', user.id)
            .eq('persona_id', personaId)
        
        if (delError) throw delError
        
        // Decrement count
        const { error: rpcError } = await supabase.rpc(voteType === 'like' ? 'decrement_likes' : 'decrement_dislikes', { p_id: personaId })
        if (rpcError) throw rpcError
        } else {
        // Change vote
        console.log('[votePersona] Changing vote')
        const { error: updateError } = await supabase
            .from('persona_votes')
            .update({ vote_type: voteType })
            .eq('user_id', user.id)
            .eq('persona_id', personaId)
        
        if (updateError) throw updateError
        
        // Update counts
        if (voteType === 'like') {
            const { error: e1 } = await supabase.rpc('increment_likes', { p_id: personaId })
            const { error: e2 } = await supabase.rpc('decrement_dislikes', { p_id: personaId })
            if (e1 || e2) throw e1 || e2
        } else {
            const { error: e1 } = await supabase.rpc('increment_dislikes', { p_id: personaId })
            const { error: e2 } = await supabase.rpc('decrement_likes', { p_id: personaId })
            if (e1 || e2) throw e1 || e2
        }
        }
    } else {
        // New vote
        console.log('[votePersona] Inserting new vote')
        const { error: insertError } = await supabase
        .from('persona_votes')
        .insert({ user_id: user.id, persona_id: personaId, vote_type: voteType })
        
        if (insertError) throw insertError
        
        // Increment count
        console.log('[votePersona] Incrementing count RPC')
        const { error: rpcError } = await supabase.rpc(voteType === 'like' ? 'increment_likes' : 'increment_dislikes', { p_id: personaId })
        if (rpcError) throw rpcError
    }
  } catch (e) {
      console.error('[votePersona] Transaction failed:', e)
      throw e
  }

  revalidatePath('/marketplace')
}

export async function getUserLibraryIds() {
  if (!hasSupabaseEnv()) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('user_persona_library')
    .select('persona_id')
    .eq('user_id', user.id)

  return data?.map(row => row.persona_id) || []
}

// --- Modified Existing Actions ---

export async function getPersonas(): Promise<Persona[]> {
  if (!hasSupabaseEnv()) {
    return AI_PERSONAS
  }

  // This function now returns "My Available Personas" for the game setup
  // Includes: Default + Created + Collected
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('ai_personas')
    .select('*')
    .eq('is_active', true)

  if (user) {
    // Get collected IDs
    const { data: library, error: libraryError } = await supabase
      .from('user_persona_library')
      .select('persona_id')
      .eq('user_id', user.id)

    const collectedIds = library?.map(l => l.persona_id) || []

    const orFilters = [
      'is_default.eq.true',
      `created_by.eq.${user.id}`,
    ]

    if (collectedIds.length > 0) {
      orFilters.push(`id.in.(${collectedIds.join(',')})`)
    }

    query = query.or(orFilters.join(','))
  } else {
    query = query.eq('is_default', true)
  }

  const { data, error } = await query

  if (error) {
    return AI_PERSONAS
  }

  if (!data || data.length === 0) {
    return AI_PERSONAS
  }

  return data as Persona[]
}

export async function createPersona(persona: Omit<Persona, 'id'>) {
  if (!hasSupabaseEnv()) throw new Error('Supabase is not configured')
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('ai_personas')
    .insert({
      ...persona,
      created_by: user.id,
      is_default: false
    })
    .select()
    .single()

  if (error) throw error
  
  revalidatePath('/personas')
  revalidatePath('/game')
  
  return data
}

export async function updatePersona(id: string, updates: Partial<Persona>) {
  if (!hasSupabaseEnv()) throw new Error('Supabase is not configured')
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check ownership
  const { data: existing } = await supabase
    .from('ai_personas')
    .select('created_by, is_default')
    .eq('id', id)
    .single()

  if (!existing) throw new Error('Persona not found')
  if (existing.is_default) throw new Error('Cannot modify default personas')
  if (existing.created_by !== user.id) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('ai_personas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  
  revalidatePath('/personas')
  revalidatePath('/game')

  return data
}

export async function deletePersona(id: string) {
  if (!hasSupabaseEnv()) throw new Error('Supabase is not configured')
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check ownership
  const { data: existing } = await supabase
    .from('ai_personas')
    .select('created_by, is_default')
    .eq('id', id)
    .single()

  if (!existing) throw new Error('Persona not found')
  if (existing.is_default) throw new Error('Cannot delete default personas')
  if (existing.created_by !== user.id) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('ai_personas')
    .delete()
    .eq('id', id)

  if (error) throw error
  
  revalidatePath('/personas')
  revalidatePath('/game')

  return true
}

export async function togglePersonaActive(id: string, isActive: boolean) {
    if (!hasSupabaseEnv()) throw new Error('Supabase is not configured')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: existing } = await supabase
        .from('ai_personas')
        .select('created_by')
        .eq('id', id)
        .single()
    
    if (!existing) throw new Error('Persona not found')
    if (existing.created_by !== user.id) throw new Error('Cannot modify system personas')

    const { error } = await supabase
        .from('ai_personas')
        .update({ is_active: isActive })
        .eq('id', id)
    
    if (error) throw error
    
    revalidatePath('/personas')
    revalidatePath('/game')
    
    return true
}
