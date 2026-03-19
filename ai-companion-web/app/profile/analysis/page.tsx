"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { analyzePlayerStats, AnalysisResult } from "@/app/actions/analysis"
import { Loader2, Brain, TrendingUp, Target, ArrowLeft, RefreshCw, Crown, Quote, Sparkles, Activity, Gauge, Award, Camera, Heart, Flame, Zap, Clover } from "lucide-react"
import { toPng } from 'html-to-image'
import Link from "next/link"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import { cn } from "@/lib/utils"

// Custom Loader Component
const CoolLoader = () => (
    <div className="relative w-[200px] h-[200px] mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible origin-center">
            <g className="animate-[spin_3s_linear_infinite] origin-center">
                <circle fill="#fff" r={50} cy={50} cx={50} className="animate-[pulse_3s_infinite] origin-center opacity-10" />
                <circle r={4} cy={50} cx={5} className="fill-violet-400 animate-[ping_3s_infinite_-1.5s] origin-center" />
                <circle r={4} cy={50} cx={95} className="fill-violet-400 animate-[ping_3s_infinite] origin-center" />
            </g>
        </svg>
    </div>
)

const LOADING_TEXTS = [
    "正在读取你的微表情...",
    "正在计算底池赔率...",
    "正在回放你那愚蠢的 Bluff...",
    "AI 正在嘲笑你的跟注...",
    "分析你的下注尺度...",
    "正在与 GTO 策略库比对...",
    "检测到情绪波动...",
    "正在生成你的扑克人格..."
]

export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingText, setLoadingText] = useState(LOADING_TEXTS[0])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isLoading) {
        let i = 0
        interval = setInterval(() => {
            i = (i + 1) % LOADING_TEXTS.length
            setLoadingText(LOADING_TEXTS[i])
        }, 2000)
    }
    return () => clearInterval(interval)
  }, [isLoading])

  const handleCapture = async () => {
    if (!captureRef.current) return
    
    try {
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: '#050505',
        pixelRatio: 2
      })
      
      const link = document.createElement('a')
      link.download = `poker-dna-${new Date().getTime()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Capture failed:", err)
    }
  }

  const handleAnalyze = async () => {
    setIsLoading(true)
    try {
      const data = await analyzePlayerStats()
      setResult(data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  // Format data for Recharts
  const chartData = result ? [
    { subject: '进攻', A: result.dimensions.aggression, fullMark: 100 },
    { subject: '入池', A: result.dimensions.activity, fullMark: 100 },
    { subject: '诈唬', A: result.dimensions.bluff, fullMark: 100 },
    { subject: '抗压', A: result.dimensions.survival, fullMark: 100 },
    { subject: '运气', A: result.dimensions.luck, fullMark: 100 },
    { subject: '决策', A: result.dimensions.wisdom, fullMark: 100 },
  ] : []

  return (
    <div className="min-h-screen bg-[#050505] p-4 font-sans text-slate-100 selection:bg-violet-500/30 md:p-8">
       {/* Background Effects */}
       <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/15 via-black to-black" />
       
      <div className="max-w-5xl mx-auto space-y-12 relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/profile">
            <Button variant="ghost" className="text-slate-500 hover:text-white hover:bg-white/5 transition-all">
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回战绩
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-2">
                <Brain className="h-5 w-5 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-200 tracking-wide">
              POKER <span className="text-violet-400">DNA</span> ANALYSIS
            </h1>
          </div>
          <div className="w-[100px] flex justify-end">
            {result && (
                <Button variant="outline" size="sm" onClick={handleCapture} className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
                    <Camera className="w-4 h-4 mr-2" /> 保存
                </Button>
            )}
          </div>
        </div>

        {/* Hero / Empty State - Enhanced Version */}
        {!result && !isLoading && (
          <div className="text-center py-20 md:py-32 space-y-8 animate-in fade-in zoom-in duration-700">
            {/* Animated Brain Icon */}
            <div className="relative w-32 h-32 mx-auto mb-8 group cursor-pointer" onClick={handleAnalyze}>
                <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-2xl transition-all duration-500 animate-pulse group-hover:bg-violet-500/40" />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-violet-500/30 bg-gradient-to-br from-slate-800 via-slate-900 to-black shadow-2xl shadow-violet-900/30 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <Brain className="h-14 w-14 animate-pulse text-violet-400 transition-colors group-hover:text-violet-300" />
                </div>
                {/* Orbiting dots */}
                <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-violet-400" />
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{animationDelay: '1s'}} />
            </div>

            {/* Title & Description */}
            <div className="space-y-6 max-w-2xl mx-auto px-4">
                <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 tracking-tight leading-tight">
                直面你的<br/>
                <span className="animate-gradient bg-gradient-to-r from-violet-400 via-fuchsia-300 to-purple-500 bg-clip-text text-transparent">
                  扑克灵魂
                </span>
                </h2>
                <p className="text-slate-400 text-base md:text-lg font-light leading-relaxed max-w-xl mx-auto">
                AI 教练将解构你的最近 <span className="font-bold text-white">100</span> 手牌局<br/>
                从入池欲望到诈唬频率，从运气成分到决策质量<br/>
                准备好接受 <span className="text-violet-300 font-semibold">残酷的真相</span> 了吗？
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap justify-center gap-3 pt-4">
                  <div className="px-4 py-2 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 rounded-full text-sm text-indigo-200 backdrop-blur-sm">
                    ✨ 风格诊断
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-full text-sm text-purple-200 backdrop-blur-sm">
                    📊 6维能力雷达
                  </div>
                  <div className="rounded-full border border-violet-500/20 bg-gradient-to-r from-violet-900/30 to-fuchsia-900/30 px-4 py-2 text-sm text-violet-200 backdrop-blur-sm">
                    🎯 关键手点评
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/20 rounded-full text-sm text-green-200 backdrop-blur-sm">
                    🚀 提升建议
                  </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6">
              <Button
                size="lg"
                onClick={handleAnalyze}
                className="relative overflow-hidden rounded-2xl border-2 border-violet-400/50 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 px-12 py-8 text-lg font-bold text-white shadow-[0_0_40px_-5px_rgba(139,92,246,0.5)] transition-all duration-300 hover:scale-105 hover:from-violet-500 hover:via-fuchsia-400 hover:to-purple-400 hover:shadow-[0_0_60px_-5px_rgba(139,92,246,0.7)] active:scale-95 md:text-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Sparkles className="mr-3 h-6 w-6 animate-pulse" />
                <span className="relative z-10">生成深度报告</span>
                <TrendingUp className="ml-3 h-6 w-6" />
              </Button>
              <p className="text-slate-600 text-xs mt-4">预计分析时间：10-20 秒</p>
            </div>

            {/* Stats Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8">
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm hover:border-slate-700 transition-colors">
                <div className="mb-1 text-2xl font-bold text-violet-400">100</div>
                <div className="text-slate-500 text-xs">分析手牌数</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm hover:border-slate-700 transition-colors">
                <div className="text-purple-500 text-2xl font-bold mb-1">6</div>
                <div className="text-slate-500 text-xs">能力维度</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm hover:border-slate-700 transition-colors">
                <div className="text-pink-500 text-2xl font-bold mb-1">5+</div>
                <div className="text-slate-500 text-xs">关键手点评</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm hover:border-slate-700 transition-colors">
                <div className="text-green-500 text-2xl font-bold mb-1">AI</div>
                <div className="text-slate-500 text-xs">深度分析</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-40 space-y-6 animate-in fade-in duration-500">
            <CoolLoader />
            <div className="space-y-2">
                <h3 className="text-xl font-medium text-slate-200 tracking-wider animate-pulse">
                    {loadingText}
                </h3>
                <p className="text-slate-500 text-sm font-mono">正在读取你的最近 100 场手牌...</p>
                <p className="mt-4 font-mono text-xs text-violet-400/70" id="hands-count">正在连接数据库...</p>
            </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && (
          <div ref={captureRef} className="grid lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-10 duration-700 p-4 bg-[#050505]">
            
            {/* Left Column: Archetype & Radar (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
                {/* Archetype Card */}
                <Card className="group relative overflow-hidden border-violet-500/30 bg-gradient-to-b from-slate-900 to-black transition-colors duration-500 hover:border-violet-500/50">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-50" />
                    
                    <CardHeader className="text-center pb-2 pt-10 relative z-10">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10">
                            <Crown className="h-6 w-6 text-violet-400" />
                        </div>
                        <CardTitle className="mb-2 text-sm font-mono uppercase tracking-widest text-violet-400/80">Your Archetype</CardTitle>
                        <div className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-2xl">
                            {result.archetype.title}
                        </div>
                    </CardHeader>
                    <CardContent className="text-center relative z-10 pb-10">
                        <div className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                            {result.archetype.description}
                        </div>
                        <div className="relative p-6 bg-white/5 rounded-xl border border-white/5 mx-4">
                            <Quote className="absolute left-3 top-3 h-4 w-4 text-violet-800 opacity-50" />
                            <p className="font-serif italic leading-relaxed text-violet-100/90">
                                "{result.archetype.quote}"
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Fun Stats Card - New! */}
                {result.funStats && (
                    <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/30">
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">趣味统计</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* 最爱手牌 */}
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <Heart className="w-4 h-4 text-red-400" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-slate-500 uppercase">最爱手牌</div>
                                        <div className="text-sm font-bold text-slate-200 truncate">{result.funStats.favoriteHand}</div>
                                    </div>
                                </div>

                                {/* 最幸运手牌 */}
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <Clover className="w-4 h-4 text-green-400" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-slate-500 uppercase">最幸运</div>
                                        <div className="text-sm font-bold text-slate-200 truncate">{result.funStats.luckiestHand}</div>
                                    </div>
                                </div>

                                {/* 最倒霉手牌 */}
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <Zap className="w-4 h-4 text-violet-300" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-slate-500 uppercase">最倒霉</div>
                                        <div className="text-sm font-bold text-slate-200 truncate">{result.funStats.unluckiestHand}</div>
                                    </div>
                                </div>

                                {/* 诈唬倾向 */}
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <Flame className="w-4 h-4 text-fuchsia-400" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-slate-500 uppercase">风格</div>
                                        <div className="text-sm font-bold text-slate-200 truncate">{result.funStats.bluffTendency}</div>
                                    </div>
                                </div>

                                {/* All-in频率 */}
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <Activity className="w-4 h-4 text-blue-400" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-slate-500 uppercase">All-in</div>
                                        <div className="text-sm font-bold text-slate-200">{result.funStats.allinFrequency}%</div>
                                    </div>
                                </div>

                                {/* 强牌胜率 */}
                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <Award className="w-4 h-4 text-violet-300" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-slate-500 uppercase">强牌胜率</div>
                                        <div className="text-sm font-bold text-slate-200">{result.funStats.premiumHandWinRate}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* 打法风格标签 */}
                            <div className="pt-2 border-t border-white/5">
                                <div className="text-[10px] text-slate-500 mb-1">打法类型</div>
                                <div className="text-sm font-bold text-purple-300 bg-purple-500/10 inline-block px-3 py-1 rounded-full border border-purple-500/20">
                                    {result.funStats.playStyle}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Level / Power Card - New! */}
                {result.level && (
                    <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Capability Score
                                </span>
                                <div className="text-4xl font-black text-white italic tracking-tighter">
                                    {result.level.power.toLocaleString()}
                                    <span className="text-sm not-italic font-medium text-white/50 ml-1">/ 100</span>
                                </div>
                            </div>
                            
                            <div className="h-12 w-px bg-white/10" />

                            <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                                    <Award className="w-3 h-3" /> Skill Tier
                                </span>
                                <div className="text-xl font-bold text-white text-right">
                                    {result.level.rank}
                                </div>
                                <div className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                                    {result.level.badge}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Radar Chart */}
                <Card className="bg-black/40 border-white/5">
                    <CardContent className="p-6 h-[320px] relative">
                        <div className="absolute top-4 left-4 text-xs font-mono text-slate-500">
                            MBTI: <span className="font-bold text-violet-400">{result.mbti}</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                            <PolarGrid stroke="#333" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar
                                name="Capability"
                                dataKey="A"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                fill="#8b5cf6"
                                fillOpacity={0.4}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff' }}
                                itemStyle={{ color: '#8b5cf6' }}
                            />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Analysis & Details (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
                
                {/* Deep Analysis */}
                <Card className="bg-slate-900/50 border-white/10 h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between text-lg font-light text-slate-300">
                            <div className="flex items-center gap-3">
                                <Target className="w-5 h-5 text-indigo-400" />
                                <span>深度剖析</span>
                            </div>
                            {result.stats && (
                                <div className="text-right space-y-1">
                                    <div className="text-xs font-mono text-slate-500">
                                        已读取 {result.stats.totalHands} 场对局
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-600">
                                        VPIP: {result.stats.vpip}% | PFR: {result.stats.pfr}% | 胜率: {result.stats.winRate}%
                                    </div>
                                    {result.stats.preflopFoldRate !== undefined && (
                                        <div className="text-[10px] font-mono text-slate-600">
                                            翻前弃牌: {result.stats.preflopFoldRate}% | 连胜: {result.stats.maxConsecutiveWins} | 连败: {result.stats.maxConsecutiveLosses}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="prose prose-invert max-w-none">
                            <p className="text-slate-300 leading-8 text-lg font-light">
                                {result.analysis}
                            </p>
                        </div>

                        {/* Highlight Hand */}
                        {result.highlight && (
                            <div className="mt-8 pt-8 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-4 h-4 text-green-400" />
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Highlight Moment</h4>
                                </div>
                                <div className="bg-black/30 rounded-xl p-5 border border-white/5 flex gap-4 items-start">
                                    <div className="flex-shrink-0 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-white border border-white/10">
                                        #{result.highlight.handIndex}
                                    </div>
                                    <div>
                                        <p className="mb-1 italic text-violet-200/90">
                                            "{result.highlight.comment}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Multiple Highlights */}
                        {result.highlights && result.highlights.length > 0 && (
                             <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="w-4 h-4 text-blue-400" />
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Key Hands Review</h4>
                                </div>
                                <div className="grid gap-4">
                                    {result.highlights.map((h, i) => (
                                        <div key={i} className="bg-white/5 rounded-lg p-4 border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <span className="text-xs font-mono text-slate-500 mt-1">HAND #{h.handIndex}</span>
                                                <p className="text-slate-300 text-sm leading-relaxed">
                                                    {h.comment}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        )}

                        {/* Fun Facts */}
                        {result.funFacts && result.funFacts.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fun Facts</h4>
                                </div>
                                <ul className="space-y-3">
                                    {result.funFacts.map((fact, i) => (
                                        <li key={i} className="flex items-start gap-3 text-slate-400 text-sm group">
                                            <span className="text-purple-500 mt-1">•</span>
                                            <span className="group-hover:text-purple-200 transition-colors">{fact}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <div className="flex justify-end pt-4">
                    <Button 
                        variant="outline" 
                        onClick={handleAnalyze} 
                        className="border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重新分析 (Re-Analyze)
                    </Button>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
