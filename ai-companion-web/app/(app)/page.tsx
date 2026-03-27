"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Bot,
  BookOpen,
  Coins,
  GraduationCap,
  HandMetal,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  Spade,
  Trophy,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getDecisionBackendStatus } from "@/app/actions/poker-ai"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const quickActions = [
  {
    icon: Bot,
    label: "开始打牌",
    desc: "与 AI 对手进行德扑对战",
    href: "/game",
  },
  {
    icon: HandMetal,
    label: "角色工坊",
    desc: "创建和定制你的 AI 对手",
    href: "/personas",
  },
  {
    icon: BookOpen,
    label: "手牌仓库",
    desc: "管理历史手牌和导入记录",
    href: "/hands",
  },
  {
    icon: Wallet,
    label: "账本",
    desc: "查看筹码变化和战绩统计",
    href: "/profile",
  },
  {
    icon: Sparkles,
    label: "角色市场",
    desc: "发现其他玩家创建的 AI 对手",
    href: "/marketplace",
  },
  {
    icon: Trophy,
    label: "排行榜",
    desc: "查看全服玩家排名",
    href: "/leaderboard",
  },
]

const exampleQuestions = [
  "这手牌我应该怎么打？",
  "帮我分析一下这个 spots 的 EV",
  "我刚才那手牌有没有问题？",
]

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pkclawStatus, setPkclawStatus] = useState<{configured: boolean; healthy: boolean; url: string; message: string} | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check PKclaw backend status
  useEffect(() => {
    getDecisionBackendStatus().then(status => {
      console.log("[PKclaw Status]", status)
      setPkclawStatus({
        configured: status.pkclawConfigured,
        healthy: status.pkclawHealthy,
        url: status.pkclawBaseUrl || "",
        message: status.pkclawMessage || ""
      })
    }).catch(err => {
      console.error("[PKclaw Status Error]", err)
      setPkclawStatus({ configured: false, healthy: false, url: "", message: "Failed to check status" })
    })
  }, [])

  // Web Speech API for voice input
  const toggleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音识别功能")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "zh-CN"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onresult = (event) => {
      const results = event.results
      const lastResult = results[results.length - 1]
      if (lastResult.isFinal) {
        setInput(lastResult[0].transcript)
      }
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
    recognitionRef.current = recognition
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: input.trim() }] }),
      })
      const data = await response.json()
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply?.content || "抱歉，请稍后重试。",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "抱歉，请稍后重试。",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleClick = (question: string) => {
    setInput(question)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <Spade className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white">PokerMind</span>
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">Beta</span>
        </div>
        <Link href="/game">
          <Button size="sm" className="bg-violet-600 hover:bg-violet-500">
            <Bot className="mr-1.5 h-4 w-4" />
            开始打牌
          </Button>
        </Link>
        {/* PKclaw Status Indicator */}
        {pkclawStatus && (
          <div className="flex items-center gap-2 text-xs">
            {pkclawStatus.healthy ? (
              <span className="flex items-center gap-1 text-green-400">
                <Wifi className="h-3 w-3" />
                已连接
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-400" title={pkclawStatus.message}>
                <WifiOff className="h-3 w-3" />
                未连接
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full py-16 px-4">
            <div className="mb-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25 mx-auto">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">有什么可以帮你？</h2>
              <p className="text-sm text-zinc-500 max-w-md">
                输入任意手牌描述，AI 助手会帮你分析 EV、讨论策略、复盘关键决策。
              </p>
            </div>

            {/* Example Questions */}
            <div className="grid grid-cols-1 gap-3 w-full max-w-lg mb-12">
              {exampleQuestions.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(question)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left text-sm text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800/50 hover:text-zinc-200"
                >
                  {question}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="text-center">
              <p className="mb-4 text-xs text-zinc-600">或直接开始</p>
              <div className="flex flex-wrap justify-center gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link key={action.href} href={action.href}>
                      <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                        <Icon className="mr-1.5 h-4 w-4" />
                        {action.label}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4",
                  msg.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.role === "user"
                      ? "bg-violet-600"
                      : "bg-gradient-to-br from-violet-500 to-fuchsia-600"
                  )}
                >
                  {msg.role === "user" ? (
                    <span className="text-sm font-medium text-white">P</span>
                  ) : (
                    <Spade className="h-4 w-4 text-white" />
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 max-w-[80%]",
                    msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-900 text-zinc-200"
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                  <p className={cn(
                    "text-[10px] mt-2",
                    msg.role === "user" ? "text-violet-200" : "text-zinc-600"
                  )}>
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600">
                  <Spade className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-zinc-900">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="描述一手牌，或者直接开始讨论..."
              className="min-h-[60px] resize-none border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className={`h-[60px] w-12 shrink-0 ${isRecording ? "bg-red-600 hover:bg-red-500" : "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
              onClick={toggleVoiceInput}
              disabled={isLoading}
              title={isRecording ? "点击停止录音" : "点击开始语音输入"}
            >
              {isRecording ? (
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
                </div>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              className="h-[60px] w-12 shrink-0 bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-600">
            按 Enter 发送，Shift + Enter 换行
          </p>
        </div>
      </div>
    </div>
  )
}