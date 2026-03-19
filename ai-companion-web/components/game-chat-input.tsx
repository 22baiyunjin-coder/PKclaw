"use client"

import { useEffect, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { SendHorizontal } from "lucide-react"

interface GameChatInputProps {
  locale: "zh" | "en"
  value: string
  loading: boolean
  disabled?: boolean
  error?: string | null
  onChange: (value: string) => void
  onSend: () => void
}

function MicrophoneIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-white" : "text-slate-100"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5a2.8 2.8 0 0 1 2.8 2.8v5.4a2.8 2.8 0 1 1-5.6 0V6.3A2.8 2.8 0 0 1 12 3.5Z" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 17v3.5" />
      <path d="M9 20.5h6" />
    </svg>
  )
}

export function GameChatInput({
  locale,
  value,
  loading,
  disabled = false,
  error,
  onChange,
  onSend,
}: GameChatInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseValueRef = useRef("")
  const [isListening, setIsListening] = useState(false)
  const [speechMessage, setSpeechMessage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  const copy = {
    placeholder:
      locale === "zh"
        ? "直接描述一手牌也可以，例如：HJ open 2.5bb，我在 BB 拿到 AQs，翻牌 Kc 9d 2c ..."
        : "Describe the hand directly, for example: HJ opens 2.5bb, I defend BB with AQs, flop Kc 9d 2c ...",
    unsupported:
      locale === "zh"
        ? "当前浏览器不支持语音转文字，建议使用新版 Chrome 或 Edge。"
        : "This browser does not support speech-to-text. Try a recent Chrome or Edge build.",
    listening:
      locale === "zh"
        ? "正在听你说话，停下后会自动转成文字。"
        : "Listening now. Your speech will turn into text when you stop.",
    failed:
      locale === "zh"
        ? "语音识别没有成功，你可以再点一次麦克风重试。"
        : "Speech recognition did not complete. Tap the mic once more to retry.",
    complete:
      locale === "zh"
        ? "语音已经转成文字，你可以继续编辑后发送。"
        : "Speech has been converted to text. You can edit it before sending.",
    hintPrimary:
      locale === "zh"
        ? isListening
          ? "正在监听..."
          : "点麦克风可语音转文字"
        : isListening
          ? "Listening..."
          : "Click the mic for speech-to-text",
    hintSecondary:
      locale === "zh"
        ? "Enter 发送，Shift + Enter 换行"
        : "Press Enter to send, Shift + Enter for a new line",
    send: locale === "zh" ? "发送" : "Send",
    thinking: locale === "zh" ? "思考中..." : "Thinking...",
    startVoice: locale === "zh" ? "开始语音输入" : "Start voice input",
    stopVoice: locale === "zh" ? "停止语音输入" : "Stop voice input",
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSend()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  function stopRecognition() {
    recognitionRef.current?.stop()
  }

  function handleVoiceInput() {
    if (disabled || loading) {
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

    baseValueRef.current = baseValue
    recognitionRef.current = recognition
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

      onChange(nextValue)
    }

    recognition.onerror = () => {
      setSpeechMessage(copy.failed)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      setSpeechMessage((currentMessage) =>
        currentMessage === copy.listening ? copy.complete : currentMessage,
      )
    }

    recognition.start()
  }

  return (
    <div className="border-t border-white/10 bg-black/20 px-4 py-4">
      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {speechMessage ? (
        <div className="mb-3 rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm text-violet-50">
          {speechMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3 shadow-inner shadow-black/20">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={copy.placeholder}
            className="min-h-[110px] w-full resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-slate-500"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={disabled || loading}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                isListening
                  ? "border-violet-200 bg-violet-500 text-white shadow-[0_0_28px_rgba(139,92,246,0.38)]"
                  : "border-white/10 bg-white/5 text-slate-100 hover:border-violet-300/40 hover:bg-violet-300/10"
              } disabled:cursor-not-allowed disabled:opacity-55`}
              aria-label={isListening ? copy.stopVoice : copy.startVoice}
            >
              <MicrophoneIcon active={isListening} />
            </button>

            <div className="text-xs leading-6 text-slate-400">
              <p>{copy.hintPrimary}</p>
              <p>{copy.hintSecondary}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={disabled || loading || value.trim().length === 0}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <SendHorizontal className="h-4 w-4" />
            {loading ? copy.thinking : copy.send}
          </button>
        </div>
      </form>
    </div>
  )
}
