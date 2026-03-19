'use server'

import { createClient } from '@/utils/supabase/server'
import { updateLeaderboard } from '@/app/actions/leaderboard'

export interface AnalysisResult {
  archetype: {
    title: string
    quote: string
    description: string
  }
  dimensions: {
    aggression: number // 进攻
    activity: number   // 入池
    bluff: number      // 诈唬
    survival: number   // 抗压
    luck: number       // 运气
    wisdom: number     // 决策
  }
  mbti: string
  analysis: string
  highlight: {
    handIndex: number
    comment: string
  } | null
  highlights?: {
    handIndex: number
    comment: string
  }[]
  funFacts?: string[]
  level?: {
    rank: string      // 段位 (e.g. 青铜鱼, 钻石鲨)
    power: number     // 战斗力 (0-9999)
    badge: string     // 勋章图标/名称
  }
  stats?: {
    totalHands: number
    vpip: number
    pfr: number
    winRate: number
    totalProfit: number
    preflopFoldRate: number
    maxWin: number
    maxLoss: number
    maxConsecutiveWins: number
    maxConsecutiveLosses: number
    recent10Profit: number
    recent10WinRate: number
  }
  funStats?: {
    favoriteHand: string      // 最喜欢的起手牌
    luckiestHand: string       // 最幸运的起手牌
    unluckiestHand: string     // 最倒霉的起手牌
    allinFrequency: number     // All-in频率
    bluffTendency: string      // 诈唬倾向
    playStyle: string          // 打法风格
    premiumHandWinRate: number // 强牌胜率(AA/KK/QQ/AK)
    biggestComeback: number    // 最大翻盘
    biggestCollapse: number    // 最大崩盘
    avgHandDuration: string    // 平均每手时长
  }
}

// Helper to calculate raw stats from history
function calculateStats(history: any[]) {
  let vpipCount = 0
  let pfrCount = 0
  let totalHands = history.length
  let wins = 0
  let totalProfit = 0
  let aggressiveActions = 0
  let passiveActions = 0

  history.forEach(h => {
    const details = h.hand_details || {}
    const actionLog = details.actionLog || []
    const userMetadata = details.userMetadata || {}
    const profit = h.profit

    // 所有发到手里的牌都计入统计（包括翻前弃牌）
    // 使用 voluntarilyEntered 标记判断是否主动入局
    // voluntarilyEntered = true 的情况：
    // 1. Call（跟注）
    // 2. Raise（加注）
    // 3. All-in（全下）
    // 4. 翻前Check（通常是Big Blind位置）
    if (userMetadata.voluntarilyEntered) {
      vpipCount++
    }

    // 统计PFR（基于翻前加注动作）
    const userLog = actionLog.join(" ")
    if (userLog.includes("Raise") || userLog.includes("All-in")) {
      // 只统计翻前阶段的加注
      const hasPreflopRaise = actionLog.some((log: string) =>
        (log.includes("Raise") || log.includes("All-in")) &&
        log.toLowerCase().includes("preflop")
      )
      if (hasPreflopRaise) {
        pfrCount++
      }
    }

    totalProfit += profit
    if (profit > 0) wins++

    // Aggression ratio（仅统计有主动动作的手牌）
    if (userMetadata.voluntarilyEntered) {
      const raises = (userLog.match(/Raise/g) || []).length + (userLog.match(/All-in/g) || []).length
      const calls = (userLog.match(/Call/g) || []).length
      aggressiveActions += raises
      passiveActions += calls
    }
  })

  console.log(`[深度复盘] VPIP统计: ${vpipCount}/${totalHands} = ${Math.round((vpipCount / totalHands) * 100)}%`)
  console.log(`[深度复盘] PFR统计: ${pfrCount}/${totalHands} = ${Math.round((pfrCount / totalHands) * 100)}%`)
  console.log(`[深度复盘] 总手牌数: ${totalHands}`)

  return {
    vpip: Math.round((vpipCount / totalHands) * 100) || 0,
    pfr: Math.round((pfrCount / totalHands) * 100) || 0,
    winRate: Math.round((wins / totalHands) * 100) || 0,
    aggressionFactor: passiveActions > 0 ? (aggressiveActions / passiveActions).toFixed(2) : aggressiveActions,
    totalProfit
  }
}

export async function analyzePlayerStats(): Promise<AnalysisResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // 1. Fetch last 100 hands
  const { data: history } = await supabase
    .from('game_history')
    .select('*')
    .eq('user_id', user.id)
    .order('played_at', { ascending: false })
    .limit(100)

  console.log(`[深度复盘] 用户 ${user.id} 的手牌历史:`, history?.length || 0, "场")

  // 调试：打印前5条手牌数据来了解数据结构
  if (history && history.length > 0) {
    for (let i = 0; i < Math.min(5, history.length); i++) {
      const h = history[i]
      const actionLog = h.hand_details?.actionLog || []
      console.log(`[深度复盘] 手牌${i+1}:`, {
        id: h.id?.substring(0, 8),
        profit: h.profit,
        hasDetails: !!h.hand_details,
        hasCards: !!h.hand_details?.cards,
        cards: h.hand_details?.cards?.map((c: any) => `${c.suit}${c.rank}`).join(" ") || "无",
        actionLogLength: actionLog.length,
        actionLogFirst3: actionLog.slice(0, 3),
        actionLogLast3: actionLog.slice(-3)
      })
    }
  }

  if (!history || history.length < 5) {
      // Return a mock "Not enough data" result structure
      return {
          archetype: { title: "见习牌手", quote: "牌桌上的路还很长。", description: "数据不足，无法分析。" },
          dimensions: { aggression: 0, activity: 0, bluff: 0, survival: 0, luck: 0, wisdom: 0 },
          mbti: "N/A",
          analysis: "请先进行至少5场对局以便AI分析您的牌风。",
          highlight: null
      }
  }

  // 2. Local Stats Calculation
  const stats = calculateStats(history)

  // 3. 准备更丰富的数据用于AI分析

  // 3.1 起手牌分析
  const handStats = new Map<string, { played: number, wins: number, profit: number }>()
  const premiumHands = ['AA', 'KK', 'QQ', 'AK']
  let premiumHandsPlayed = 0
  let premiumHandsWon = 0

  history.forEach(h => {
    const details = h.hand_details || {}
    const cards = details.cards || []
    if (cards.length === 2) {
      const c1 = cards[0]
      const c2 = cards[1]
      // 组合起手牌表示（如AKs, AKo, TT等）
      let handKey = ""
      const ranks = [c1.rank, c2.rank].sort((a: any, b: any) => {
        const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
        return rankOrder.indexOf(b) - rankOrder.indexOf(a)
      })

      if (c1.rank === c2.rank) {
        handKey = ranks[0] + ranks[0]  // 对子
      } else if (c1.suit === c2.suit) {
        handKey = ranks[0] + ranks[1] + 's'  // 同花
      } else {
        handKey = ranks[0] + ranks[1] + 'o'  // 非同花
      }

      if (!handStats.has(handKey)) {
        handStats.set(handKey, { played: 0, wins: 0, profit: 0 })
      }
      const stat = handStats.get(handKey)!
      stat.played++
      stat.profit += h.profit
      if (h.profit > 0) stat.wins++

      // 统计强牌表现
      if (premiumHands.includes(handKey.replace('s', '').replace('o', ''))) {
        premiumHandsPlayed++
        if (h.profit > 0) premiumHandsWon++
      }
    }
  })

  // 找出最喜欢的手牌（玩得最多的）
  let favoriteHand = "无数据"
  let maxPlayed = 0
  handStats.forEach((stat, hand) => {
    if (stat.played > maxPlayed) {
      maxPlayed = stat.played
      favoriteHand = hand
    }
  })

  // 找出最幸运的手牌（胜率最高的，至少玩过3次）
  let luckiestHand = "无数据"
  let maxWinRate = 0
  handStats.forEach((stat, hand) => {
    if (stat.played >= 3) {
      const winRate = stat.wins / stat.played
      if (winRate > maxWinRate) {
        maxWinRate = winRate
        luckiestHand = hand
      }
    }
  })

  // 找出最倒霉的手牌（玩得最多但胜率很低的）
  let unluckiestHand = "无数据"
  let minWinRate = 1
  handStats.forEach((stat, hand) => {
    if (stat.played >= 3) {
      const winRate = stat.wins / stat.played
      if (winRate < minWinRate) {
        minWinRate = winRate
        unluckiestHand = hand
      }
    }
  })

  // 3.2 All-in频率分析
  let allinCount = 0
  history.forEach(h => {
    const log = h.hand_details?.actionLog || []
    const fullLog = log.join(" ")
    if (fullLog.includes("All-in")) allinCount++
  })
  const allinFrequency = Math.round((allinCount / history.length) * 100)

  // 3.3 诈唬倾向分析（基于激进系数和入池率）
  let bluffTendency = "未知"
  const aggressionNum = typeof stats.aggressionFactor === 'number' ? stats.aggressionFactor : parseFloat(stats.aggressionFactor as string)

  if (aggressionNum > 2 && stats.vpip > 30) {
    bluffTendency = "激进诈唬型"
  } else if (aggressionNum > 1.5 && stats.vpip > 25) {
    bluffTendency = "偶尔诈唬型"
  } else if (aggressionNum < 1 && stats.vpip < 20) {
    bluffTendency = "超级保守型"
  } else if (aggressionNum < 1) {
    bluffTendency = "被动跟注型"
  } else {
    bluffTendency = "稳健价值型"
  }

  // 3.4 打法风格
  let playStyle = ""
  if (stats.vpip > 40 && aggressionNum > 1.5) {
    playStyle = "LAG-松凶型"
  } else if (stats.vpip < 25 && aggressionNum > 1.5) {
    playStyle = "TAG-紧凶型"
  } else if (stats.vpip > 40) {
    playStyle = "Loose Passive-松弱型"
  } else if (stats.vpip < 20) {
    playStyle = "Nit-超紧型"
  } else {
    playStyle = "Balanced-平衡型"
  }

  // 3.5 筹码波动分析
  const profitArray = history.map(h => h.profit)
  const maxWin = Math.max(...profitArray)
  const maxLoss = Math.min(...profitArray)
  const avgWin = profitArray.filter(p => p > 0).reduce((a, b) => a + b, 0) / (profitArray.filter(p => p > 0).length || 1)
  const avgLoss = profitArray.filter(p => p < 0).reduce((a, b) => a + b, 0) / (profitArray.filter(p => p < 0).length || 1)

  // 3.6 最大翻盘和崩盘
  const biggestComeback = maxWin
  const biggestCollapse = maxLoss

  // 3.2 连续输赢分析
  let maxConsecutiveWins = 0
  let maxConsecutiveLosses = 0
  let currentWins = 0
  let currentLosses = 0

  history.forEach(h => {
    if (h.profit > 0) {
      currentWins++
      currentLosses = 0
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins)
    } else if (h.profit < 0) {
      currentLosses++
      currentWins = 0
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses)
    }
  })

  // 3.3 最近10场趋势
  const recent10Hands = history.slice(0, 10)
  const recent10Profit = recent10Hands.reduce((sum, h) => sum + h.profit, 0)
  const recent10WinRate = recent10Hands.filter(h => h.profit > 0).length / 10

  // 3.4 翻前弃牌率（判断是否太紧）
  // 统计所有发到手里的牌中，有多少是翻前弃牌的
  let preflopFolds = 0
  const totalHandsDealt = history.length

  history.forEach(h => {
    const userMetadata = h.hand_details?.userMetadata || {}
    // 使用 metadata 标记判断是否在翻前弃牌
    if (userMetadata.foldedStage === 'preflop') {
      preflopFolds++
    }
  })

  const preflopFoldRate = totalHandsDealt > 0 ? Math.round((preflopFolds / totalHandsDealt) * 100) : 0

  console.log(`[深度复盘] 翻前弃牌统计: ${preflopFolds}/${totalHandsDealt} = ${preflopFoldRate}%`)

  // 3.5 选取更多关键手牌（增加到20场，涵盖不同类型）
  const sortedByImpact = [...history].sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
  const top10 = sortedByImpact.slice(0, 10)  // 最大10场输赢
  const worstLosses = sortedByImpact.filter(h => h.profit < 0).slice(0, 5)  // 最大5场失利
  const bestWins = sortedByImpact.filter(h => h.profit > 0).slice(0, 5)  // 最大5场胜利
  const recentHands = history.slice(0, 10)  // 最近10场

  // 合并去重
  const allKeyHands = new Map()
  top10.forEach(h => allKeyHands.set(h.id, h))
  worstLosses.forEach(h => allKeyHands.set(h.id, h))
  bestWins.forEach(h => allKeyHands.set(h.id, h))
  recentHands.forEach(h => allKeyHands.set(h.id, h))

  const selectedHands = Array.from(allKeyHands.values()).slice(0, 20)

  const keyHandsDetails = selectedHands.map((h, i) => {
      const details = h.hand_details || {}
      const actionLog = details.actionLog || []
      const cards = details.cards?.map((c: any) => `${c.suit}${c.rank}`).join(" ") || "未知"
      const logText = actionLog.length > 0 ? actionLog.slice(-6).join(" → ") : "无记录"

      return `#${i+1} ${h.profit > 0 ? '✓' : '✗'} 盈亏:${h.profit} | 手牌:[${cards}] | ${logText}`
  }).join("\n")

  console.log(`[深度复盘] 提取了 ${selectedHands.length} 场关键手牌用于AI分析`)
  console.log(`[深度复盘] 筹码数据 - 最大盈利:${maxWin} 最大亏损:${maxLoss} 平均盈利:${Math.round(avgWin)} 平均亏损:${Math.round(avgLoss)}`)

  // 3.6 构建更详细的数据摘要
  const dataSummary = `
【基础数据】
- 总局数: ${history.length}
- VPIP (入池率): ${stats.vpip}%
- PFR (翻前加注率): ${stats.pfr}%
- 翻前弃牌率: ${preflopFoldRate}%
- 胜率: ${stats.winRate}%
- 激进系数: ${stats.aggressionFactor}
- 总盈亏: ${stats.totalProfit}

【筹码波动】
- 单场最大盈利: ${maxWin}
- 单场最大亏损: ${maxLoss}
- 平均盈利: ${Math.round(avgWin)}
- 平均亏损: ${Math.round(avgLoss)}
- 连续最高获胜: ${maxConsecutiveWins} 场
- 连续最高失利: ${maxConsecutiveLosses} 场

【近期表现】
- 最近10场盈亏: ${recent10Profit}
- 最近10场胜率: ${(recent10WinRate * 100).toFixed(1)}%

【起手牌偏好】
- 最爱手牌: ${favoriteHand} (玩得最多)
- 最幸运手牌: ${luckiestHand} (胜率最高)
- 最倒霉手牌: ${unluckiestHand} (总玩但不赢)
- 强牌胜率(AA/KK/QQ/AK): ${premiumHandsPlayed > 0 ? Math.round((premiumHandsWon / premiumHandsPlayed) * 100) : 0}%

【性格特征】
- All-in频率: ${allinFrequency}% (${allinFrequency > 20 ? '非常激进' : allinFrequency > 10 ? '适当' : '保守'})
- 诈唬倾向: ${bluffTendency}
- 打法风格: ${playStyle}

【关键手牌记录】(${selectedHands.length}场)
${keyHandsDetails}
`

  const systemPrompt = `你是一位世界顶级的德州扑克心理学大师和数据分析专家，擅长用毒舌、幽默但极具洞察力的方式分析玩家。
你的任务是根据玩家的完整对局数据生成一份"高能牌风报告"。

【分析重点】
1. **风格识别**：根据VPIP/PFR/激进系数判断是LAG/TAG/PASSIVE/MANIAC等哪种类型
2. **心态分析**：通过连续输赢、最大亏损判断是否容易上头（Tilt）
3. **技术评估**：分析翻前弃牌率是否过紧、入池率是否过松、下注尺度是否合理
4. **近期趋势**：对比最近10场与整体数据，判断是在进步还是衰退
5. **运气成分**：通过盈亏波动与胜率的对比，评估运气vs技术的比例
6. **具体问题**：指出最大的3-5个失误点，并给出改进建议

【输出要求】
- 分析必须基于提供的数据，不能凭空捏造
- 对关键手牌（特别是大输局）要有具体点评
- 语言要辛辣有趣，但要有实质内容
- 改进建议要具有可操作性

请严格按照以下 JSON 格式输出（不要包含 Markdown 标记）：
{
  "archetype": {
    "title": "玩家称号 (如：冷血鲨鱼、慈善赌王、绝命毒师、铁头娃...)",
    "quote": "一句符合该称号的经典台词",
    "description": "对称号的简短解释，结合数据说明"
  },
  "dimensions": {
    "aggression": 0-100, // 进攻性 - 基于激进系数和加注频率
    "activity": 0-100,   // 入池欲望 - 基于VPIP和翻前弃牌率
    "bluff": 0-100,      // 诈唬指数 - 基于输赢波动和打法风格推断
    "survival": 0-100,   // 抗压/生存能力 - 基于连续失利后的恢复能力
    "luck": 0-100,       // 运气值 - 基于胜率与盈亏的对比
    "wisdom": 0-100      // 决策合理性 - 综合评估
  },
  "mbti": "扑克人格类型 (如 LAG-T, TAG-A, PASSIVE-F等)",
  "analysis": "一段 300-500 字的深度分析，必须包含：1)风格定位 2)最大问题 3)心态稳定性 4)技术层面的问题 5)与平均水平对比。风格要辛辣有趣但言之有物。",
  "highlight": {
    "handIndex": 1, // 对应关键手牌记录中的序号 (1-20)
    "comment": "对这手牌的犀利点评，指出具体错误"
  },
  "highlights": [
      {"handIndex": 1, "comment": "点评1"},
      {"handIndex": 2, "comment": "点评2"},
      {"handIndex": 3, "comment": "点评3"},
      {"handIndex": 4, "comment": "点评4"},
      {"handIndex": 5, "comment": "点评5"}
  ],
  "funFacts": [
      "你的打牌风格像极了...",
      "如果德州扑克是...",
      "你的对手可能会...",
      "根据数据，你最容易在...情况下失误"
  ],
  "level": {
    "rank": "真实技术评级 (如：新手鱼苗、普通路人、小盈利玩家、稳健Pro、GTO大神)",
    "power": 综合能力评分(0-100，基于长期盈利能力、技术稳定性和心态控制),
    "badge": "核心特质标签 (如：过度诈唬、铁头娃、看牌特工、坚若磐石、情绪化管理大师)"
  }
}`

  const userPrompt = `你正在分析一位德州扑克玩家的${history.length}场对局数据。

${dataSummary}

请根据以上数据进行全方位画像分析，重点关注：
1. 玩家的风格类型（LAG/TAG/PASSIVE/MANIAC等）
2. 筹码管理能力和心态稳定性（是否有上头倾向）
3. 近期状态（是否在进步或衰退）
4. 具体的改进建议（哪些手牌打得不好，为什么）
5. 运气成分与技术成分的比例评估

请给出辛辣有趣但有深度的分析。`

  // 4. Call Yingdao API
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000) // 90s Timeout

  try {
    const response = await fetch("https://power-api.yingdao.com/oapi/power/v1/rest/flow/10d6e620-221d-4911-b37c-1785f12a4b8b/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer AP_dCrLlKaPO864JhEw"
      },
      signal: controller.signal,
      body: JSON.stringify({
        input: {
            user_prompt: userPrompt,
            system_prompt: systemPrompt
        }
      })
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`)
    }

    const result = await response.json()
    console.log("Yingdao API Response:", JSON.stringify(result, null, 2))

    // Parse the response structure from Yingdao Flow
    let content = ""
    // Yingdao usually returns { code: 0, msg: "success", data: { runRecordId: ..., status: "success", result: { output_text_0: "..." } } }
    
    if (result.data && result.data.result && result.data.result.output_text_0) {
        content = result.data.result.output_text_0
    } else if (result.data && result.data.output) {
        content = result.data.output
    } else if (result.data && typeof result.data === 'string') {
        content = result.data
    } else if (result.output) {
         content = result.output
    } else {
        content = JSON.stringify(result)
    }
    
    // If content is an object (already parsed by fetch), stringify it to standardize extraction
    if (typeof content !== 'string') {
        content = JSON.stringify(content)
    }

    // Clean and Parse JSON
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim()
    
    // Attempt to extract JSON if mixed with text
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    
    let parsedData = null
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        try {
            parsedData = JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1))
        } catch (e) {
            console.error("JSON Parse Error (Substring):", e)
        }
    }
    
    if (!parsedData) {
        try {
            parsedData = JSON.parse(jsonStr)
        } catch (e) {
             console.error("JSON Parse Error (Direct):", e)
             throw new Error("Invalid JSON format from AI")
        }
    }
    
    // Validate structure (Optional but good for safety)
    if (!parsedData.dimensions) {
        // Fix for "Cannot read properties of undefined (reading 'aggression')"
        // If AI returns incomplete data, fill with defaults
        parsedData.dimensions = { aggression: 50, activity: 50, bluff: 50, survival: 50, luck: 50, wisdom: 50 }
    }
    if (!parsedData.archetype) {
        parsedData.archetype = { title: "未知玩家", quote: "数据迷雾...", description: "AI未能识别" }
    }

    // 添加统计数据
    parsedData.stats = {
        totalHands: history.length,
        vpip: stats.vpip,
        pfr: stats.pfr,
        winRate: stats.winRate,
        totalProfit: stats.totalProfit,
        preflopFoldRate: preflopFoldRate,
        maxWin: maxWin,
        maxLoss: maxLoss,
        maxConsecutiveWins: maxConsecutiveWins,
        maxConsecutiveLosses: maxConsecutiveLosses,
        recent10Profit: recent10Profit,
        recent10WinRate: Math.round(recent10WinRate * 100)
    }

    // 添加有趣的统计数据
    parsedData.funStats = {
        favoriteHand: favoriteHand,
        luckiestHand: luckiestHand,
        unluckiestHand: unluckiestHand,
        allinFrequency: allinFrequency,
        bluffTendency: bluffTendency,
        playStyle: playStyle,
        premiumHandWinRate: premiumHandsPlayed > 0 ? Math.round((premiumHandsWon / premiumHandsPlayed) * 100) : 0,
        biggestComeback: biggestComeback,
        biggestCollapse: biggestCollapse,
        avgHandDuration: "标准速度"
    }

    console.log(`[深度复盘] 分析完成，返回结果:`, JSON.stringify(parsedData.stats))

    // 保存到排行榜
    if (parsedData.level) {
      const leaderboardData = {
        score: parsedData.level.power * 100 + (parsedData.stats?.winRate || 0) + (parsedData.stats?.totalHands || 0), // 综合得分算法
        rank: parsedData.level.rank,
        archetype: parsedData.archetype.title,
        power: parsedData.level.power,
        badge: parsedData.level.badge,
        stats: parsedData.stats,
        totalHands: parsedData.stats?.totalHands || 0
      }

      const result = await updateLeaderboard(leaderboardData)
      if (result.success) {
        console.log('[深度复盘] 排行榜已更新')
      } else {
        console.error('[深度复盘] 排行榜更新失败:', result.error)
      }
    }

    return parsedData

  } catch (error) {
    console.error("Analysis Failed:", error)
    return {
        archetype: { title: "网络隐士", quote: "信号在虚空中迷失...", description: "AI 连接超时。" },
        dimensions: { aggression: 50, activity: 50, bluff: 50, survival: 50, luck: 50, wisdom: 50 },
        mbti: "N/A",
        analysis: "分析服务暂时不可用，请稍后再试。",
        highlight: null
    }
  }
}
