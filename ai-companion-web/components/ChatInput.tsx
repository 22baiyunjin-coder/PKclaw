"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  loading: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
}

function MicrophoneIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-black" : "text-slate-100"}`}
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
  );
}

export function ChatInput({
  value,
  loading,
  disabled = false,
  error,
  onChange,
  onSend,
}: ChatInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseValueRef = useRef("");
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  function stopRecognition() {
    recognitionRef.current?.stop();
  }

  function handleVoiceInput() {
    if (disabled || loading) {
      return;
    }

    if (isListening) {
      stopRecognition();
      return;
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechMessage("当前浏览器不支持语音转文字。建议使用新版 Chrome 或 Edge。");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    const baseValue = value.trim();

    baseValueRef.current = baseValue;
    recognitionRef.current = recognition;
    recognition.lang = navigator.language.startsWith("zh") ? "zh-CN" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechMessage("正在听你说话，停下后会自动转成文字。");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }

      const nextValue = [baseValueRef.current, transcript.trim()]
        .filter(Boolean)
        .join(baseValueRef.current ? "\n" : "");

      onChange(nextValue);
    };

    recognition.onerror = () => {
      setSpeechMessage("语音识别没有成功，你可以再点一次麦克风重试。");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      setSpeechMessage((currentMessage) =>
        currentMessage?.startsWith("正在听")
          ? "语音已经转成文字，你可以继续编辑后发送。"
          : currentMessage,
      );
    };

    recognition.start();
  }

  return (
    <div className="border-t border-white/10 bg-black/30 px-4 py-4 sm:px-5">
      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {speechMessage ? (
        <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
          {speechMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3 shadow-inner shadow-black/20">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="直接描述手牌也可以，例如：HJ open 2.5bb，我在 BB 拿 AQs，翻牌 Kc 9d 2c ..."
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
                  ? "border-amber-200 bg-amber-300 text-black shadow-[0_0_28px_rgba(251,191,36,0.38)]"
                  : "border-white/10 bg-white/5 text-slate-100 hover:border-amber-300/40 hover:bg-amber-300/10"
              } disabled:cursor-not-allowed disabled:opacity-55`}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              <MicrophoneIcon active={isListening} />
            </button>

            <div className="text-xs leading-6 text-slate-400">
              <p>{isListening ? "Listening..." : "Click the mic for speech-to-text."}</p>
              <p>Press Enter to send, Shift + Enter for a new line.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={disabled || loading || value.trim().length === 0}
            className="inline-flex min-w-[132px] items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
