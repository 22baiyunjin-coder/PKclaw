import Link from "next/link"
import { Crown, Medal, TrendingUp, Trophy, User } from "lucide-react"

import { getLeaderboard, getMyLeaderboardEntry, getMyRank } from "@/app/actions/leaderboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getServerLocale } from "@/lib/i18n-server"
import { pickText } from "@/lib/i18n"

export const dynamic = "force-dynamic"
export const revalidate = 60

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-6 w-6 text-violet-300" />
  if (rank === 2) return <Medal className="h-6 w-6 text-gray-300" />
  if (rank === 3) return <Medal className="h-6 w-6 text-fuchsia-400" />
  return (
    <span className="flex h-6 w-6 items-center justify-center text-sm font-bold text-zinc-400">
      #{rank}
    </span>
  )
}

function getRankColor(rank: number) {
  if (rank === 1) return "text-violet-300"
  if (rank === 2) return "text-gray-300"
  if (rank === 3) return "text-fuchsia-400"
  if (rank <= 10) return "text-purple-400"
  if (rank <= 50) return "text-blue-400"
  return "text-zinc-400"
}

function getRankBadgeColor(rank: number) {
  if (rank === 1) return "border-violet-500/30 bg-violet-500/20"
  if (rank === 2) return "border-gray-400/30 bg-gray-400/20"
  if (rank === 3) return "border-fuchsia-500/30 bg-fuchsia-500/20"
  if (rank <= 10) return "border-purple-500/30 bg-purple-500/20"
  if (rank <= 50) return "border-blue-500/30 bg-blue-500/20"
  return "border-zinc-500/30 bg-zinc-500/20"
}

export default async function LeaderboardPage() {
  const locale = await getServerLocale()
  const [leaderboard, myEntry, myRank] = await Promise.all([
    getLeaderboard(100),
    getMyLeaderboardEntry(),
    getMyRank(),
  ])

  const copy = {
    title: pickText(locale, { zh: "德州扑克排行榜", en: "Texas Hold'em Leaderboard" }),
    subtitle: pickText(locale, {
      zh: "基于综合得分、技术水平和稳定度的多维度评估。",
      en: "A multi-dimensional ranking based on score, skill level, and consistency.",
    }),
    myRank: pickText(locale, { zh: "我的排名", en: "My Rank" }),
    score: pickText(locale, { zh: "综合得分", en: "Score" }),
    tier: pickText(locale, { zh: "段位", en: "Tier" }),
    archetype: pickText(locale, { zh: "称号", en: "Archetype" }),
    power: pickText(locale, { zh: "战斗力", en: "Power" }),
    rank: pickText(locale, { zh: "排名", en: "Rank" }),
    player: pickText(locale, { zh: "玩家", en: "Player" }),
    you: pickText(locale, { zh: "你", en: "YOU" }),
    sessions: pickText(locale, { zh: "场对局", en: "sessions" }),
    empty: pickText(locale, { zh: "暂时没有排行榜数据", en: "No leaderboard data yet" }),
    emptySub: pickText(locale, {
      zh: "完成至少 5 场对局后，你的数据将显示在这里。",
      en: "Play at least 5 sessions and your data will appear here.",
    }),
    backProfile: pickText(locale, { zh: "返回个人中心", en: "Back to Profile" }),
    startGame: pickText(locale, { zh: "开始游戏", en: "Start Game" }),
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      <div className="flex h-14 shrink-0 items-center border-b border-zinc-800 px-6">
        <h1 className="text-sm font-medium text-zinc-400">排行榜</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Trophy className="h-12 w-12 text-violet-400" />
            <h1 className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-violet-400 bg-clip-text text-4xl font-black text-transparent md:text-5xl">
              {copy.title}
            </h1>
          </div>
          <p className="text-sm text-zinc-400 md:text-base">{copy.subtitle}</p>
        </div>

        {myEntry ? (
          <Card className="mb-6 rounded-2xl border-2 border-violet-500/30 bg-gradient-to-r from-violet-900/30 via-fuchsia-900/20 to-violet-900/30 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`text-3xl font-black ${getRankColor(myRank || 0)}`}>
                  #{myRank}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-violet-400" />
                    <div className="text-sm font-bold uppercase tracking-wider text-violet-400">
                      {copy.myRank}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">{myEntry.username}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
                  {copy.score}
                </div>
                <div className="text-2xl font-black text-violet-300">
                  {myEntry.score.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-black/30 p-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
                  {copy.tier}
                </div>
                <div className="text-sm font-bold text-white">{myEntry.rank}</div>
              </div>
              <div className="rounded-lg bg-black/30 p-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
                  {copy.archetype}
                </div>
                <div className="text-sm font-bold text-white">{myEntry.archetype}</div>
              </div>
              <div className="rounded-lg bg-black/30 p-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
                  {copy.power}
                </div>
                <div className="text-sm font-bold text-purple-400">{myEntry.power}</div>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl">
          <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-black/30 p-4">
            <div className="col-span-1 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
              {copy.rank}
            </div>
            <div className="col-span-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
              {copy.player}
            </div>
            <div className="col-span-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
              {copy.tier}
            </div>
            <div className="col-span-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
              {copy.archetype}
            </div>
            <div className="col-span-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
              {copy.power}
            </div>
            <div className="col-span-1 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
              {copy.score}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {leaderboard.map((entry, index) => {
              const rank = index + 1
              const isMe = myEntry && entry.user_id === myEntry.user_id

              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 items-center gap-4 p-4 transition-all hover:bg-white/5 ${
                    isMe ? "border-l-4 border-violet-500 bg-violet-500/10" : ""
                  }`}
                >
                  <div className={`col-span-1 flex justify-center ${getRankColor(rank)}`}>
                    {getRankIcon(rank)}
                  </div>

                  <div className="col-span-4">
                    <div className={`text-sm font-bold ${isMe ? "text-violet-300" : "text-white"}`}>
                      {entry.username}
                      {isMe ? (
                        <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">
                          {copy.you}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {entry.total_hands} {copy.sessions}
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    <div
                      className={`rounded-lg border px-2 py-1 text-xs font-bold ${getRankBadgeColor(rank)}`}
                    >
                      {entry.rank}
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    <div className="truncate px-2 text-sm font-bold text-white" title={entry.archetype}>
                      {entry.archetype}
                    </div>
                    {entry.badge ? (
                      <div className="truncate px-2 text-xs text-purple-400" title={entry.badge}>
                        {entry.badge}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-span-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3 text-purple-400" />
                      <span className="text-sm font-bold text-purple-400">{entry.power}</span>
                    </div>
                  </div>

                  <div className="col-span-1 text-center">
                    <div className="text-sm font-black text-violet-300">
                      {entry.score.toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="mx-auto mb-4 h-16 w-16 text-zinc-600" />
              <p className="text-zinc-400">{copy.empty}</p>
              <p className="mt-2 text-sm text-zinc-500">{copy.emptySub}</p>
            </div>
          ) : null}
        </Card>

        <div className="mt-8 flex justify-center gap-4">
          <Link href="/profile">
            <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
              {copy.backProfile}
            </Button>
          </Link>
          <Link href="/game">
            <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 font-black text-white hover:from-violet-400 hover:to-fuchsia-400">
              {copy.startGame}
            </Button>
          </Link>
        </div>
        </div>
      </div>
    </div>
  )
}
