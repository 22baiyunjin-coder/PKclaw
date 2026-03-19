import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Bot, Plus } from "lucide-react"

import { PersonaCard } from "@/components/persona-card"
import { PersonaEditor } from "@/components/persona-editor"
import { Button } from "@/components/ui/button"
import { AI_PERSONAS } from "@/lib/ai-personas"
import { pickText } from "@/lib/i18n"
import { getServerLocale } from "@/lib/i18n-server"
import { hasSupabaseEnv } from "@/lib/supabase-env"
import { createClient } from "@/utils/supabase/server"

export default async function PersonasPage() {
  const locale = await getServerLocale()

  const copy = {
    back: pickText(locale, { zh: "返回", en: "Back" }),
    title: pickText(locale, { zh: "AI 角色工坊", en: "AI Persona Workshop" }),
    subtitle: pickText(locale, {
      zh: "创建、调整并管理你的专属训练对手。",
      en: "Create, tune, and manage your custom training opponents.",
    }),
    mySection: pickText(locale, { zh: "我创建的角色", en: "My Personas" }),
    systemSection: pickText(locale, { zh: "系统预设角色", en: "System Personas" }),
    emptyTitle: pickText(locale, {
      zh: "你还没有创建自定义角色",
      en: "You have not created a custom persona yet",
    }),
    emptyBody: pickText(locale, {
      zh: "你可以根据训练目标创建不同风格的 AI 对手，比如激进型、GTO 型，或者专门模仿某位真实玩家的版本。",
      en: "Build AI opponents for different training goals, such as aggressive players, GTO grinders, or personas inspired by real opponents.",
    }),
    createNow: pickText(locale, { zh: "立即创建", en: "Create Now" }),
    unavailable: pickText(locale, {
      zh: "当前公网演示环境未配置 Supabase，所以暂时只能浏览系统角色，无法保存你自己创建的角色。",
      en: "Supabase is not configured for this public demo yet, so you can browse default personas but cannot save your own personas yet.",
    }),
  }

  if (!hasSupabaseEnv()) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex w-full items-center gap-4 md:w-auto">
              <Link href="/">
                <Button variant="ghost" className="text-slate-400 hover:text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {copy.back}
                </Button>
              </Link>

              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-violet-400">
                  <Bot className="h-6 w-6" />
                  {copy.title}
                </h1>
                <p className="text-sm text-slate-400">{copy.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {copy.unavailable}
          </div>

          <div className="space-y-4 border-t border-slate-900 pt-4">
            <h2 className="flex items-center gap-2 border-l-4 border-slate-700 pl-3 text-lg font-semibold text-slate-300">
              {copy.systemSection}
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500">
                {AI_PERSONAS.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {AI_PERSONAS.map((persona) => (
                <PersonaCard key={persona.id} persona={persona} />
              ))}
            </div>
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

  const { data: defaultPersonas, error: defaultError } = await supabase
    .from("ai_personas")
    .select("*")
    .eq("is_default", true)
    .order("name", { ascending: true })

  const { data: myPersonas, error: customError } = await supabase
    .from("ai_personas")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })

  if (defaultError) {
    console.error("Error fetching default personas", defaultError)
  }

  if (customError) {
    console.error("Error fetching custom personas", customError)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex w-full items-center gap-4 md:w-auto">
            <Link href="/">
              <Button variant="ghost" className="text-slate-400 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {copy.back}
              </Button>
            </Link>

            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-violet-400">
                <Bot className="h-6 w-6" />
                {copy.title}
              </h1>
              <p className="text-sm text-slate-400">{copy.subtitle}</p>
            </div>
          </div>

          <PersonaEditor />
        </div>

        <div className="space-y-4">
          <h2 className="flex items-center gap-2 border-l-4 border-violet-500 pl-3 text-lg font-semibold text-white">
            {copy.mySection}
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500">
              {myPersonas?.length || 0}
            </span>
          </h2>

          {(myPersonas?.length || 0) > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myPersonas!.map((persona) => (
                <PersonaCard key={persona.id} persona={persona} currentUserId={user.id} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/50 py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
                <Bot className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="font-medium text-slate-300">{copy.emptyTitle}</h3>
              <p className="mb-4 mt-1 max-w-xs text-center text-sm text-slate-500">
                {copy.emptyBody}
              </p>

              <PersonaEditor
                trigger={
                  <Button
                    variant="outline"
                    className="border-violet-500 text-violet-400 hover:bg-violet-600 hover:text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {copy.createNow}
                  </Button>
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-4 border-t border-slate-900 pt-4">
          <h2 className="flex items-center gap-2 border-l-4 border-slate-700 pl-3 text-lg font-semibold text-slate-300">
            {copy.systemSection}
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500">
              {defaultPersonas?.length || 0}
            </span>
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {defaultPersonas?.map((persona) => (
              <PersonaCard key={persona.id} persona={persona} currentUserId={user.id} />
            )) || []}
          </div>
        </div>
      </div>
    </div>
  )
}
