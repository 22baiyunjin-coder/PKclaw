'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { hasSupabaseEnv } from '@/lib/supabase-env'

export interface LeaderboardEntry {
  id: string
  user_id: string
  username: string
  score: number
  rank: string
  archetype: string
  power: number
  badge?: string
  stats?: any
  total_hands: number
  created_at: string
  updated_at: string
}

/**
 * 保存或更新玩家的排行榜数据
 */
export async function updateLeaderboard(data: {
  score: number
  rank: string
  archetype: string
  power: number
  badge?: string
  stats?: any
  totalHands: number
}): Promise<{ success: boolean; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { success: false, error: 'Supabase is not configured' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: '未登录' }
  }

  try {
    // 获取用户名
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const username = profile?.username || '匿名玩家'

    // 检查是否已有记录
    const { data: existing } = await supabase
      .from('leaderboards')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // 更新现有记录（只在得分更高时更新，或者总是更新以保持最新）
      const { error } = await supabase
        .from('leaderboards')
        .update({
          username,
          score: data.score,
          rank: data.rank,
          archetype: data.archetype,
          power: data.power,
          badge: data.badge,
          stats: data.stats,
          total_hands: data.totalHands,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) throw error
    } else {
      // 创建新记录
      const { error } = await supabase
        .from('leaderboards')
        .insert({
          user_id: user.id,
          username,
          score: data.score,
          rank: data.rank,
          archetype: data.archetype,
          power: data.power,
          badge: data.badge,
          stats: data.stats,
          total_hands: data.totalHands
        })

      if (error) throw error
    }

    // 重新验证排行榜页面的缓存
    revalidatePath('/leaderboard')

    return { success: true }
  } catch (error) {
    console.error('更新排行榜失败:', error)
    return { success: false, error: '更新排行榜失败' }
  }
}

/**
 * 获取排行榜前N名
 */
export async function getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
  if (!hasSupabaseEnv()) {
    return []
  }

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('leaderboards')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data as LeaderboardEntry[]) || []
  } catch (error) {
    console.error('获取排行榜失败:', error)
    return []
  }
}

/**
 * 获取当前用户的排行榜排名和数据
 */
export async function getMyLeaderboardEntry(): Promise<LeaderboardEntry | null> {
  if (!hasSupabaseEnv()) {
    return null
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  try {
    const { data, error } = await supabase
      .from('leaderboards')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // 如果没有记录，返回null
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data as LeaderboardEntry
  } catch (error) {
    console.error('获取用户排行榜数据失败:', error)
    return null
  }
}

/**
 * 获取用户在排行榜中的排名位置
 */
export async function getMyRank(): Promise<number | null> {
  if (!hasSupabaseEnv()) {
    return null
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  try {
    // 获取用户自己的得分
    const { data: myEntry } = await supabase
      .from('leaderboards')
      .select('score')
      .eq('user_id', user.id)
      .single()

    if (!myEntry) return null

    // 统计有多少人得分高于我
    const { count } = await supabase
      .from('leaderboards')
      .select('*', { count: 'exact', head: true })
      .gt('score', myEntry.score)

    // 排名 = 高分人数 + 1
    return (count || 0) + 1
  } catch (error) {
    console.error('获取排名失败:', error)
    return null
  }
}
