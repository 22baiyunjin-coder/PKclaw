"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileJson2, Mic, Sparkles, WandSparkles } from "lucide-react"
import { toast } from "sonner"

import { createImportedHandRecord } from "@/app/actions/hand-records"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { Locale } from "@/lib/i18n"
import type { ReplyProvider } from "@/types/chat"

interface HandImportFormProps {
  locale: Locale
  disabled?: boolean
}

interface ParseResponse {
  payload: Record<string, unknown>
  provider: ReplyProvider
}

const examplePayload = `{
  "title": "CO open, Hero BB defend with AQs",
  "smallBlind": 10,
  "bigBlind": 20,
  "heroSeat": 0,
  "dealerSeat": 6,
  "players": [
    { "name": "Hero", "seatIndex": 0, "isHero": true, "holeCards": ["As", "Qs"], "startingStack": 4000, "endingStack": 4180, "totalCommitted": 260, "winnings": 440, "positionLabel": "BB" },
    { "name": "CO Reg", "seatIndex": 6, "holeCards": ["Kh", "Jd"], "startingStack": 4000, "endingStack": 3560, "totalCommitted": 440, "winnings": 0, "positionLabel": "CO" }
  ],
  "boardByStreet": {
    "preflop": [],
    "flop": ["Kc", "9d", "2c"],
    "turn": ["Kc", "9d", "2c", "7h"],
    "river": ["Kc", "9d", "2c", "7h", "As"]
  },
  "finalBoard": ["Kc", "9d", "2c", "7h", "As"],
  "finalStreet": "river",
  "actions": [
    "preflop: CO Reg Raise to 50",
    "preflop: Hero Call 50",
    "flop: CO Reg Bet 80",
    "flop: Hero Call 80",
    "turn: CO Reg Check",
    "turn: Hero Bet 130",
    "turn: CO Reg Call 130",
    "river: CO Reg Bet 180",
    "river: Hero Call 180"
  ],
  "winners": [
    { "playerId": 0, "playerName": "Hero", "amount": 440, "handLabel": "Pair of Aces", "handRankValue": 2 }
  ],
  "notes": ["manual_example"]
}`

export function HandImportForm({ locale, disabled = false }: HandImportFormProps) {
  const router = useRouter()
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseValueRef = useRef("")
  const [value, setValue] = useState("")
  const [speechMessage, setSpeechMessage] = useState<string | null>(null)
  const [structureMessage, setStructureMessage] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [lastProvider, setLastProvider] = useState<ReplyProvider | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  const copy = {
    title: locale === "zh" ? "导入一手讨论牌" : "Import a discussion hand",
    body:
      locale === "zh"
        ? "支持直接粘贴文字、点麦克风说一手牌，再交给 LLM 整理成结构化 replay payload。"
        : "Paste text, dictate a hand by voice, then let the LLM structure it into a replay-ready payload.",
    placeholder:
      locale === "zh"
        ? "例如：HJ open 2.5bb，我在 BB 拿到 AQs。翻牌 Kc 9d 2c，对手 cbet 80，我 call..."
        : "Example: HJ opens 2.5bb, I defend BB with AQs. Flop Kc 9d 2c, villain cbets 80 and I call...",
    save: locale === "zh" ? "保存到手牌库" : "Save to Hand Library",
    sample: locale === "zh" ? "填入示例" : "Load Example",
    structure: locale === "zh" ? "LLM 整理" : "Structure with LLM",
    listening:
      locale === "zh"
        ? "正在听你描述手牌，停下来后会自动转成文字。"
        : "Listening now. Your hand description will turn into text automatically.",
    complete:
      locale === "zh"
        ? "语音已经转成文字，你可以继续编辑或者直接点 LLM 整理。"
        : "Speech has been converted to text. You can edit it or send it to the LLM.",
    unsupported:
      locale === "zh"
        ? "当前浏览器不支持语音转文字，建议使用新版 Chrome 或 Edge。"
        : "This browser does not support speech-to-text. Try a recent Chrome or Edge build.",
    voiceFailed:
      locale === "zh"
        ? "语音识别没有成功，再点一次麦克风试试。"
        : "Speech recognition did not complete. Tap the mic once more to retry.",
    structureReady:
      locale === "zh"
        ? "结构化结果已经写回输入框，现在可以直接保存。"
        : "Structured JSON has been written back into the editor. You can save it now.",
    structureFailed:
      locale === "zh"
        ? "LLM 整理失败了，请稍后重试。"
        : "The LLM could not structure the hand just now. Please retry.",
    disabled:
      locale === "zh"
        ? "当前部署未配置数据库，所以暂时只能整理，不能真正保存。"
        : "This deployment has no database configured yet, so you can structure hands but not persist them.",
    micHint:
      locale === "zh"
        ? isListening
          ? "正在监听..."
          : "点麦克风可以直接口述一手牌"
        : isListening
          ? "Listening..."
          : "Use the microphone to dictate a hand",
    provider:
      lastProvider === "minimax"
        ? locale === "zh"
          ? "当前使用 MiniMax 整理"
          : "Structured with MiniMax"
        : lastProvider === "mock"
          ? locale === "zh"
            ? "当前使用本地 mock 草稿"
            : "Structured with local mock draft"
          : null,
    startVoice: locale === "zh" ? "开始语音输入" : "Start voice input",
    stopVoice: locale === "zh" ? "停止语音输入" : "Stop voice input",
  }

  function stopRecognition() {
    recognitionRef.current?.stop()
  }

  function handleVoiceInput() {
    if (isPending || isParsing) {
      return
    }

    if (isListening) {
      stopRecognition()
      return
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setSpeechMessage(copy.unsupported)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    const baseValue = value.trim()

    recognitionRef.current = recognition
    baseValueRef.current = baseValue
    recognition.lang = locale === "zh" ? "zh-CN" : "en-US"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setSpeechMessage(copy.listening)
    }

    recognition.onresult = (event) => {
      let transcript = ""

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? ""
      }

      const nextValue = [baseValueRef.current, transcript.trim()]
        .filter(Boolean)
        .join(baseValueRef.current ? "\n" : "")

      setValue(nextValue)
    }

    recognition.onerror = () => {
      setSpeechMessage(copy.voiceFailed)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      setSpeechMessage((current) => (current === copy.listening ? copy.complete : current))
    }

    recognition.start()
  }

  async function handleStructure() {
    const input = value.trim()

    if (!input || isParsing || isPending) {
      return
    }

    setIsParsing(true)
    setStructureMessage(null)

    try {
      const response = await fetch("/api/hand-import/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      })

      const payload = (await response.json()) as ParseResponse | { error?: string }

      if (!response.ok || !("payload" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : copy.structureFailed)
      }

      setValue(JSON.stringify(payload.payload, null, 2))
      setLastProvider(payload.provider)
      setStructureMessage(copy.structureReady)
      toast.success(copy.structureReady)
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.structureFailed
      setStructureMessage(message)
      toast.error(message)
    } finally {
      setIsParsing(false)
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createImportedHandRecord(value)

      if (!result.ok) {
        toast.error(result.message || "Failed to import hand.")
        return
      }

      toast.success(locale === "zh" ? "手牌已保存" : "Hand saved")
      setValue("")
      setStructureMessage(null)
      setLastProvider(null)
      if (result.id) {
        router.push(`/hands/${result.id}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <Card className="border-slate-800 bg-slate-900/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <FileJson2 className="h-5 w-5 text-violet-400" />
          {copy.title}
        </CardTitle>
        <CardDescription className="text-slate-400">{copy.body}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {copy.disabled}
          </div>
        ) : null}

        {speechMessage ? (
          <div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm text-violet-50">
            {speechMessage}
          </div>
        ) : null}

        {structureMessage ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
            {structureMessage}
          </div>
        ) : null}

        {copy.provider ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
            {copy.provider}
          </div>
        ) : null}

        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={copy.placeholder}
          className="min-h-[240px] border-slate-700 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-500"
          disabled={isPending || isParsing}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleVoiceInput}
            disabled={isPending || isParsing}
            className={isListening ? "border-violet-300 bg-violet-500/20 text-violet-50" : "border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"}
          >
            <Mic className="mr-2 h-4 w-4" />
            {copy.micHint}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleStructure}
            disabled={isPending || isParsing || value.trim().length === 0}
            className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isParsing ? (locale === "zh" ? "整理中..." : "Structuring...") : copy.structure}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setValue(examplePayload)}
            className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
          >
            <WandSparkles className="mr-2 h-4 w-4" />
            {copy.sample}
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || isParsing || value.trim().length === 0 || disabled}
            className="bg-violet-600 text-white hover:bg-violet-500"
          >
            <FileJson2 className="mr-2 h-4 w-4" />
            {copy.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
