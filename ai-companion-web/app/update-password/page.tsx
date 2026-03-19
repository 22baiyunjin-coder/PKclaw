"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/utils/supabase/client"
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

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [locale] = useState<Locale>(() => readClientLocale())
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [success, setSuccess] = useState(false)

  const copy = useMemo(
    () => ({
      invalidTitle: pickText(locale, { zh: "无效的重置链接", en: "Invalid Reset Link" }),
      invalidDesc: pickText(locale, {
        zh: "请重新申请密码重置。",
        en: "Please request a new password reset.",
      }),
      mismatchTitle: pickText(locale, { zh: "密码不匹配", en: "Passwords Do Not Match" }),
      mismatchDesc: pickText(locale, {
        zh: "两次输入的密码不一致。",
        en: "The two passwords do not match.",
      }),
      shortTitle: pickText(locale, { zh: "密码太短", en: "Password Too Short" }),
      shortDesc: pickText(locale, {
        zh: "密码至少需要 6 个字符。",
        en: "The password must be at least 6 characters long.",
      }),
      failed: pickText(locale, { zh: "更新失败", en: "Update Failed" }),
      successToast: pickText(locale, { zh: "密码更新成功", en: "Password Updated" }),
      successToastDesc: pickText(locale, {
        zh: "你现在可以使用新密码登录。",
        en: "You can now sign in with your new password.",
      }),
      verifying: pickText(locale, { zh: "验证重置链接...", en: "Verifying reset link..." }),
      back: pickText(locale, { zh: "返回登录", en: "Back to Login" }),
      successTitle: pickText(locale, { zh: "密码更新成功", en: "Password Updated" }),
      setTitle: pickText(locale, { zh: "设置新密码", en: "Set a New Password" }),
      redirecting: pickText(locale, { zh: "正在跳转到登录页...", en: "Redirecting to login..." }),
      enterNew: pickText(locale, { zh: "请输入你的新密码", en: "Enter your new password" }),
      doneBody: pickText(locale, {
        zh: "你的密码已经更新成功，即将跳转到登录页面。",
        en: "Your password has been updated. You will be redirected to the login page shortly.",
      }),
      goLogin: pickText(locale, { zh: "立即前往登录", en: "Go to Login" }),
      newPassword: pickText(locale, { zh: "新密码", en: "New Password" }),
      confirmPassword: pickText(locale, { zh: "确认新密码", en: "Confirm New Password" }),
      newPlaceholder: pickText(locale, { zh: "至少 6 个字符", en: "At least 6 characters" }),
      confirmPlaceholder: pickText(locale, { zh: "再次输入新密码", en: "Enter the new password again" }),
      submit: pickText(locale, { zh: "更新密码", en: "Update Password" }),
    }),
    [locale],
  )

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error(copy.invalidTitle, { description: copy.invalidDesc })
        router.push("/reset-password")
        return
      }

      setVerifying(false)
    }

    void checkSession()
  }, [copy.invalidDesc, copy.invalidTitle, router, supabase.auth])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error(copy.mismatchTitle, { description: copy.mismatchDesc })
      return
    }

    if (newPassword.length < 6) {
      toast.error(copy.shortTitle, { description: copy.shortDesc })
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      toast.error(copy.failed, { description: error.message })
      setLoading(false)
      return
    }

    setSuccess(true)
    toast.success(copy.successToast, { description: copy.successToastDesc })

    setTimeout(() => {
      router.push("/login")
    }, 3000)
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-violet-400" />
          <p className="text-slate-400">{copy.verifying}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4">
      {!success ? (
        <Link href="/login" className="absolute left-6 top-6">
          <Button variant="ghost" className="text-slate-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {copy.back}
          </Button>
        </Link>
      ) : null}

      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold text-violet-400">
            {success ? copy.successTitle : copy.setTitle}
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            {success ? copy.redirecting : copy.enterNew}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="animate-in fade-in zoom-in flex flex-col items-center justify-center space-y-6 py-6 text-center duration-300">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-green-500">{copy.successTitle}</h3>
                <p className="mx-auto max-w-[280px] text-sm text-slate-400">
                  {copy.doneBody}
                </p>
              </div>
              <Button
                className="w-full bg-violet-600 text-white hover:bg-violet-700"
                onClick={() => router.push("/login")}
              >
                {copy.goLogin}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{copy.newPassword}</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder={copy.newPlaceholder}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-slate-700 bg-slate-950"
                  autoFocus
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{copy.confirmPassword}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder={copy.confirmPlaceholder}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-700 bg-slate-950"
                  minLength={6}
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
