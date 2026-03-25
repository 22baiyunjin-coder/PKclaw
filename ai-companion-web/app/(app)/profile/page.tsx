import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Bot,
  Coins,
  Trophy,
  TrendingUp,
} from "lucide-react"

import ProfileChart from "./profile-chart"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { pickText } from "@/lib/i18n"
import { getServerLocale } from "@/lib/i18n-server"
import { ensureProfileForUser } from "@/lib/profile-bootstrap"
import { hasSupabaseEnv } from "@/lib/supabase-env"
import { createClient } from "@/utils/supabase/server"

export default async function ProfilePage() {
  const locale = await getServerLocale()

  const copy = {
    title: pickText(locale, { zh: "账本", en: "Account" }),
    analysisTitle: pickText(locale, { zh: "AI 深度复盘", en: "AI Deep Analysis" }),
    analysisSub: pickText(locale, {
      zh: "让 AI 教练拆解你最近 100 手牌，生成风格诊断和改进建议。",
      en: "Let the AI coach break down your latest 100 hands into style diagnosis and improvement advice.",
    }),
    analyzeNow: pickText(locale, { zh: "立即分析", en: "Analyze Now" }),
    leaderboardTitle: pickText(locale, { zh: "全服排行榜", en: "Global Leaderboard" }),
    leaderboardSub: pickText(locale, {
      zh: "查看你在更大样本下的相对位置。",
      en: "See how you stack up against the rest of the field.",
    }),
    leaderboardButton: pickText(locale, { zh: "查看排名", en: "View Ranking" }),
    mysterious: pickText(locale, { zh: "神秘玩家", en: "Mystery Player" }),
    chips: pickText(locale, { zh: "当前筹码", en: "Current Chips" }),
    rate: pickText(locale, { zh: "胜率", en: "Win Rate" }),
    games: pickText(locale, { zh: "总场次", en: "Games" }),
    chart: pickText(locale, { zh: "筹码波动趋势（近 100 局）", en: "Chip Trend (Last 100 Sessions)" }),
    noData: pickText(locale, {
      zh: "暂时还没有对局数据，先去打几把吧。",
      en: "No sessions yet. Play a few hands first.",
    }),
    history: pickText(locale, { zh: "近期战绩", en: "Recent Results" }),
    time: pickText(locale, { zh: "时间", en: "Time" }),
    profit: pickText(locale, { zh: "盈亏", en: "Profit" }),
    balance: pickText(locale, { zh: "结余", en: "Balance" }),
    detail: pickText(locale, { zh: "详情", en: "Detail" }),
    view: pickText(locale, { zh: "查看", en: "View" }),
    emptyHistory: pickText(locale, { zh: "暂无记录", en: "No records yet" }),
    unavailable: pickText(locale, {
      zh: "当前公网演示环境未配置 Supabase，所以个人中心、战绩和充值功能暂时不可用。",
      en: "Supabase is not configured for this public demo yet, so profile, results, and top-up features are temporarily unavailable.",
    }),
  }

  // Top bar - matches sidebar style
  const TopBar = () => (
    <div className="flex h-14 shrink-0 items-center border-b border-zinc-800 px-6">
      <h1 className="text-sm font-medium text-zinc-400">{copy.title}</h1>
    </div>
  )

  if (!hasSupabaseEnv()) {
    return (
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <Card className="border-amber-500/20 bg-amber-500/10 text-amber-100">
              <CardHeader>
                <CardTitle>{copy.title}</CardTitle>
                <CardDescription className="text-amber-200/80">
                  {copy.unavailable}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  const profile = await ensureProfileForUser(supabase, user)

  const { data: history } = await supabase
    .from("game_history")
    .select("*")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .limit(100)

  const totalGames = history?.length || 0
  const totalWins = history?.filter((item) => item.profit > 0).length || 0
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0"

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* AI Analysis Card */}
          <Link href="/analysis" className="group block">
            <div className="relative rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-1 shadow-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-indigo-500/50">
              <div className="absolute -right-3 -top-3 rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white shadow-lg animate-bounce">
                Hot
              </div>
              <div className="rounded-xl bg-slate-900/95 p-6 md:p-8">
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-3">
                        <Bot className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white md:text-3xl">
                          {copy.analysisTitle}
                        </h3>
                        <p className="text-sm text-purple-300">{copy.analysisSub}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    className="whitespace-nowrap bg-white px-8 py-6 text-lg font-bold text-indigo-900 hover:bg-indigo-50"
                  >
                    {copy.analyzeNow}
                    <TrendingUp className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </Link>

          {/* Leaderboard Banner */}
          <Link href="/leaderboard" className="group block">
            <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-900/50 to-fuchsia-900/40 p-6 transition-all hover:from-violet-900/70 hover:to-fuchsia-900/60">
              <div>
                <h3 className="mb-1 text-lg font-bold text-white">{copy.leaderboardTitle}</h3>
                <p className="text-sm text-violet-200">{copy.leaderboardSub}</p>
              </div>
              <Button className="bg-white font-bold text-violet-900 hover:bg-violet-50 shrink-0">
                <Trophy className="mr-2 h-4 w-4" />
                {copy.leaderboardButton}
              </Button>
            </div>
          </Link>

          {/* Stats + Chart Row */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Profile Card */}
            <Card className="border-slate-800 bg-slate-900 md:col-span-1">
              <CardHeader className="flex flex-row items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-violet-500">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="bg-slate-700 text-xl">
                    {profile?.username?.substring(0, 2).toUpperCase() || "P"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl text-white">
                    {profile?.username || copy.mysterious}
                  </CardTitle>
                  <CardDescription className="text-slate-400 truncate max-w-[150px]">{user.email}</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-violet-400" />
                    <span className="text-slate-400">{copy.chips}</span>
                  </div>
                  <span className="text-2xl font-bold text-violet-400">
                    {profile?.chips?.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-center">
                    <div className="mb-1 text-xs text-slate-500">{copy.rate}</div>
                    <div className="text-lg font-bold text-green-400">{winRate}%</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-center">
                    <div className="mb-1 text-xs text-slate-500">{copy.games}</div>
                    <div className="text-lg font-bold text-blue-400">{totalGames}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chart */}
            <Card className="border-slate-800 bg-slate-900 md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  {copy.chart}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                {history && history.length > 0 ? (
                  <ProfileChart history={history} />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    {copy.noData}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* History Table */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="h-5 w-5 text-violet-400" />
                {copy.history}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-slate-800/50">
                      <TableHead className="text-slate-400">{copy.time}</TableHead>
                      <TableHead className="text-slate-400">{copy.profit}</TableHead>
                      <TableHead className="text-slate-400">{copy.balance}</TableHead>
                      <TableHead className="text-right text-slate-400">{copy.detail}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.map((game) => (
                      <TableRow key={game.id} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="font-mono text-xs text-slate-300">
                          {new Date(game.played_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              game.profit > 0
                                ? "border-green-800 bg-green-950 text-green-400"
                                : game.profit < 0
                                  ? "border-red-800 bg-red-950 text-red-400"
                                  : "border-slate-700 bg-slate-800 text-slate-400"
                            }
                          >
                            {game.profit > 0 ? "+" : ""}
                            {game.profit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {game.chips_after.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-500">
                            {copy.view}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!history?.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                          {copy.emptyHistory}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
