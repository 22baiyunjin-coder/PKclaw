"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function ChatPage() {
  const [message, setMessage] = useState("")

  const TopBar = () => (
    <div className="flex h-14 shrink-0 items-center border-b border-zinc-800 px-6">
      <h1 className="text-sm font-medium text-zinc-400">手牌讨论</h1>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* Empty State */}
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <Send className="h-8 w-8 text-violet-400" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">手牌讨论助手</h2>
            <p className="mb-8 max-w-md text-sm text-zinc-500">
              输入任意手牌描述，AI 助手会帮你分析 EV、讨论策略、复盘关键决策。
            </p>

            <div className="grid grid-cols-1 gap-3 text-left w-full max-w-lg">
              {[
                "这手牌我应该继续还是放弃？",
                "帮我按街拆一下这手牌的 EV 问题",
                "我想用语音把整手牌说出来，你来帮我还原",
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(example)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left text-sm text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800/50 hover:text-zinc-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="描述一手牌，或者直接开始讨论..."
              className="min-h-[60px] resize-none border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  // TODO: send message
                }
              }}
            />
            <Button
              size="icon"
              className="h-[60px] w-12 shrink-0 bg-violet-600 hover:bg-violet-500"
              disabled={!message.trim()}
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
