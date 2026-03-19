"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { createOptionalClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"

export default function ResetPasswordPage() {
  const supabase = createOptionalClient()
  const [locale] = useState<Locale>(() => readClientLocale())
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [emailSent, setEmailSent] = useState(false)

  const copy = useMemo(
    () => ({
      back: pickText(locale, { zh: "返回登录", en: "Back to Login" }),
      title: pickText(locale, { zh: "重置密码", en: "Reset Password" }),
      subtitle: pickText(locale, {
        zh: "输入你的邮箱地址以接收密码重置链接。",
        en: "Enter your email to receive a password reset link.",
      }),
      sentSubtitle: pickText(locale, {
        zh: "邮件已发送",
        en: "Email Sent",
      }),
      sentTitle: pickText(locale, {
        zh: "重置邮件已发出",
        en: "Reset Email Sent",
      }),
      sentBody: pickText(locale, {
        zh: "我们已经向以下邮箱发送了重置邮件，请打开邮箱并点击链接完成密码重置。",
        en: "We sent a password reset email to the address below. Open your inbox and click the link to continue.",
      }),
      expire: pickText(locale, { zh: "链接将在 15 分钟后失效。", en: "The link expires in 15 minutes." }),
      resend: pickText(locale, { zh: "重新发送", en: "Send Again" }),
      email: pickText(locale, { zh: "邮箱地址", en: "Email Address" }),
      submit: pickText(locale, { zh: "发送重置邮件", en: "Send Reset Email" }),
      failed: pickText(locale, { zh: "发送失败", en: "Failed to send email" }),
      success: pickText(locale, { zh: "重置邮件已发送", en: "Reset email sent" }),
      successDesc: pickText(locale, {
        zh: "请查收邮箱并点击链接重置密码。",
        en: "Please check your inbox and click the reset link.",
      }),
      unavailable: pickText(locale, {
        zh: "当前演示环境未配置 Supabase，重置密码暂时不可用。",
        en: "Supabase is not configured for this demo yet, so password reset is currently unavailable.",
      }),
    }),
    [locale],
  )

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      toast.error(copy.failed, { description: copy.unavailable })
      return
    }
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      toast.error(copy.failed, { description: error.message })
    } else {
      setEmailSent(true)
      toast.success(copy.success, { description: copy.successDesc })
    }

    setLoading(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Link href="/login" className="absolute left-6 top-6">
        <Button variant="ghost" className="text-slate-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {copy.back}
        </Button>
      </Link>

      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold text-violet-400">
            {copy.title}
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            {emailSent ? copy.sentSubtitle : copy.subtitle}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!supabase ? (
            <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {copy.unavailable}
            </div>
          ) : null}
          {emailSent ? (
            <div className="animate-in fade-in zoom-in flex flex-col items-center justify-center space-y-6 py-6 text-center duration-300">
              <div className="rounded-full bg-violet-500/10 p-4">
                <Mail className="h-12 w-12 text-violet-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-violet-400">{copy.sentTitle}</h3>
                <p className="mx-auto max-w-[280px] text-sm text-slate-400">
                  {copy.sentBody}
                  <span className="mt-1 block font-medium text-slate-200">{email}</span>
                </p>
                <p className="mt-4 text-xs text-slate-500">{copy.expire}</p>
              </div>
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  setEmailSent(false)
                  setEmail("")
                }}
              >
                {copy.resend}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{copy.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-slate-700 bg-slate-950"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-violet-600 text-white hover:bg-violet-700"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {copy.submit}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
