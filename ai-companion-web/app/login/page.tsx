"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Locale, readClientLocale, pickText } from "@/lib/i18n"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [locale, setLocale] = useState<Locale>("zh")
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")
  const [showEmailVerification, setShowEmailVerification] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [username, setUsername] = useState("")

  useEffect(() => {
    setLocale(readClientLocale())
  }, [])

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab === "register") {
      setActiveTab("register")
    }
  }, [searchParams])

  const copy = useMemo(
    () => ({
      back: pickText(locale, { zh: "返回首页", en: "Back Home" }),
      title: pickText(locale, {
        zh: "PokerMind 账号中心",
        en: "PokerMind Account Center",
      }),
      subtitle: pickText(locale, {
        zh: "登录或注册，以保存你的筹码、战绩和训练进度。",
        en: "Log in or create an account to keep your chips, results, and training progress.",
      }),
      login: pickText(locale, { zh: "登录", en: "Log In" }),
      register: pickText(locale, { zh: "注册", en: "Sign Up" }),
      email: pickText(locale, { zh: "邮箱", en: "Email" }),
      password: pickText(locale, { zh: "密码", en: "Password" }),
      username: pickText(locale, { zh: "昵称", en: "Display Name" }),
      forgotPassword: pickText(locale, { zh: "忘记密码？", en: "Forgot password?" }),
      registerButton: pickText(locale, {
        zh: "注册并领取初始筹码",
        en: "Create Account & Claim Starter Chips",
      }),
      usernamePlaceholder: pickText(locale, {
        zh: "例如：RiverReader",
        en: "For example: RiverReader",
      }),
      verifyTitle: pickText(locale, {
        zh: "验证邮件已发送",
        en: "Verification Email Sent",
      }),
      verifyBody: pickText(locale, {
        zh: "我们需要先验证你的邮箱。请前往收件箱并点击激活链接，然后回来登录。",
        en: "Please verify your email first. Open your inbox, click the activation link, then come back and sign in.",
      }),
      backToLogin: pickText(locale, { zh: "返回登录", en: "Back to Login" }),
      loginFailed: pickText(locale, { zh: "登录失败", en: "Login Failed" }),
      loginSuccess: pickText(locale, { zh: "登录成功", en: "Logged In" }),
      welcomeBack: pickText(locale, {
        zh: "欢迎回到 PokerMind。",
        en: "Welcome back to PokerMind.",
      }),
      registerFailed: pickText(locale, { zh: "注册失败", en: "Registration Failed" }),
      registerSuccess: pickText(locale, { zh: "注册成功", en: "Registration Successful" }),
      verifyNotice: pickText(locale, {
        zh: "请前往邮箱完成验证后再登录。",
        en: "Please verify your email before signing in.",
      }),
      joinNotice: pickText(locale, {
        zh: "欢迎加入 PokerMind。",
        en: "Welcome to PokerMind.",
      }),
      emailExists: pickText(locale, {
        zh: "该邮箱已被注册",
        en: "This email is already registered",
      }),
      emailExistsDesc: pickText(locale, {
        zh: "请直接登录，或换一个邮箱重新注册。",
        en: "Please log in directly or use a different email.",
      }),
    }),
    [locale],
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error(copy.loginFailed, { description: error.message })
    } else {
      toast.success(copy.loginSuccess, { description: copy.welcomeBack })
      router.push("/")
      router.refresh()
    }

    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: emailExists, error: checkError } = await supabase.rpc(
      "check_email_exists",
      {
        email_to_check: regEmail,
      },
    )

    if (!checkError && emailExists) {
      toast.error(copy.emailExists, { description: copy.emailExistsDesc })
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: {
          username,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(copy.registerFailed, { description: error.message })
    } else if (data.user && !data.session) {
      setShowEmailVerification(true)
      toast.success(copy.registerSuccess, { description: copy.verifyNotice })
    } else {
      toast.success(copy.registerSuccess, { description: copy.joinNotice })
      router.push("/")
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Link href="/" className="absolute left-6 top-6">
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
            {copy.subtitle}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "login" | "register")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-800">
              <TabsTrigger value="login">{copy.login}</TabsTrigger>
              <TabsTrigger value="register">{copy.register}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-4 space-y-4">
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
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{copy.password}</Label>
                    <Link
                      href="/reset-password"
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      {copy.forgotPassword}
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-slate-700 bg-slate-950"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-violet-600 text-white hover:bg-violet-700"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {copy.login}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              {showEmailVerification ? (
                <div className="animate-in fade-in zoom-in flex flex-col items-center justify-center space-y-6 py-6 text-center duration-300">
                  <div className="rounded-full bg-violet-500/10 p-4">
                    <Mail className="h-12 w-12 text-violet-400" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-violet-400">
                      {copy.verifyTitle}
                    </h3>
                    <p className="mx-auto max-w-[280px] text-sm text-slate-400">
                      {copy.verifyBody}
                      <span className="mt-1 block font-medium text-slate-200">
                        {regEmail}
                      </span>
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                    onClick={() => {
                      setShowEmailVerification(false)
                      setActiveTab("login")
                    }}
                  >
                    {copy.backToLogin}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">{copy.email}</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="border-slate-700 bg-slate-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">{copy.username}</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder={copy.usernamePlaceholder}
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="border-slate-700 bg-slate-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">{copy.password}</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="border-slate-700 bg-slate-950"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-violet-600 text-white hover:bg-violet-700"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {copy.registerButton}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
