"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Edit2,
  FileText,
  Globe,
  Lock,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { deletePersona, publishPersona } from "@/app/actions/personas"
import { PersonaEditor } from "@/components/persona-editor"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"
import { Persona } from "@/lib/poker-types"
import { cn } from "@/lib/utils"

interface PersonaCardProps {
  persona: Persona & {
    is_default?: boolean
    created_by?: string
    is_active?: boolean
    is_published?: boolean
  }
  currentUserId?: string
}

export function PersonaCard({ persona, currentUserId }: PersonaCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [locale] = useState<Locale>(() => readClientLocale())
  const [isPublished, setIsPublished] = useState(persona.is_published || false)

  const isOwner = persona.created_by === currentUserId
  const isDefault = persona.is_default

  const copy = useMemo(
    () => ({
      system: pickText(locale, { zh: "系统", en: "System" }),
      custom: pickText(locale, { zh: "自定义", en: "Custom" }),
      published: pickText(locale, { zh: "已发布", en: "Published" }),
      fullProfile: pickText(locale, { zh: "完整设定", en: "Full Profile" }),
      delete: pickText(locale, { zh: "删除", en: "Delete" }),
      edit: pickText(locale, { zh: "编辑", en: "Edit" }),
      publishedButton: pickText(locale, {
        zh: "已发布到市场",
        en: "Published to Marketplace",
      }),
      privateButton: pickText(locale, {
        zh: "私有角色（点击发布）",
        en: "Private Persona (Click to Publish)",
      }),
      preset: pickText(locale, { zh: "预设角色", en: "Preset Persona" }),
      publishSuccess: pickText(locale, {
        zh: "角色已发布到市场",
        en: "Persona published to marketplace",
      }),
      unpublishSuccess: pickText(locale, {
        zh: "角色已从市场下架",
        en: "Persona removed from marketplace",
      }),
      actionFailed: pickText(locale, { zh: "操作失败", en: "Action failed" }),
      deleteConfirm: pickText(locale, {
        zh: "确定要删除这个角色吗？此操作无法撤销。",
        en: "Delete this persona? This action cannot be undone.",
      }),
      deleteSuccess: pickText(locale, { zh: "角色已删除", en: "Persona deleted" }),
      deleteFailed: pickText(locale, { zh: "删除失败", en: "Delete failed" }),
    }),
    [locale],
  )

  const handlePublishToggle = async () => {
    const nextState = !isPublished
    setIsPublished(nextState)

    try {
      await publishPersona(persona.id, nextState)
      toast.success(nextState ? copy.publishSuccess : copy.unpublishSuccess)
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error(copy.actionFailed, { description: error.message })
      setIsPublished(!nextState)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(copy.deleteConfirm)) {
      return
    }

    setLoading(true)
    try {
      await deletePersona(persona.id)
      toast.success(copy.deleteSuccess)
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error(copy.deleteFailed, { description: error.message })
      setLoading(false)
    }
  }

  const formatPersonaText = (text: string) => {
    if (!text) {
      return null
    }

    return text.split(/\\n|\n/).map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return <div key={index} className="h-2" />
      }

      const isList = trimmed.startsWith("- ")
      const content = isList ? trimmed.slice(2) : trimmed
      const parts = content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <span key={i} className="font-bold text-indigo-300">
              {part.slice(2, -2)}
            </span>
          )
        }

        return part
      })

      return (
        <div
          key={index}
          className={cn("break-words text-xs leading-relaxed", isList && "flex gap-1 pl-3")}
        >
          {isList ? <span className="select-none text-slate-600">•</span> : null}
          <span className={isList ? "flex-1" : ""}>{parts}</span>
        </div>
      )
    })
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden border-slate-800 bg-slate-900 transition-all hover:border-slate-700 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-slate-700 bg-slate-950">
              <AvatarFallback className="bg-slate-800 font-bold text-violet-400">
                {Array.from(persona.name)[0]}
              </AvatarFallback>
            </Avatar>

            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-100">
                {persona.name}
                {isDefault ? (
                  <Badge className="h-5 bg-slate-800 text-[10px] text-slate-400">
                    {copy.system}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="h-5 border-violet-500/50 text-[10px] text-violet-400"
                  >
                    {copy.custom}
                  </Badge>
                )}
                {isPublished ? (
                  <Badge className="h-5 bg-green-900/50 text-[10px] text-green-400 hover:bg-green-900/50">
                    {copy.published}
                  </Badge>
                ) : null}
              </CardTitle>

              <CardDescription className="mt-1 text-xs text-slate-400">
                {persona.style}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="group relative h-[100px] cursor-help overflow-hidden rounded-md bg-slate-950/50 p-3 font-mono text-xs text-slate-400">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/90 transition-colors group-hover:to-slate-950/70" />
              <div className="space-y-0.5">{formatPersonaText(persona.description)}</div>
              <div className="absolute bottom-1 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                <FileText className="h-3 w-3 text-slate-500" />
              </div>
            </div>
          </HoverCardTrigger>

          <HoverCardContent className="w-80 border-slate-800 bg-slate-950 p-4 text-slate-300 shadow-2xl">
            <div className="space-y-1 text-xs">
              <h4 className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2 font-bold text-slate-100">
                {persona.name}
                <span className="font-normal text-slate-500">{copy.fullProfile}</span>
              </h4>
              {formatPersonaText(persona.description)}
            </div>
          </HoverCardContent>
        </HoverCard>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-0">
        {isOwner ? (
          <>
            <div className="flex w-full gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {copy.delete}
              </Button>

              <PersonaEditor
                initialPersona={persona}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    {copy.edit}
                  </Button>
                }
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              className={cn(
                "w-full transition-colors",
                isPublished
                  ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white",
              )}
              onClick={handlePublishToggle}
            >
              {isPublished ? (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  {copy.publishedButton}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {copy.privateButton}
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-default text-slate-500 hover:bg-transparent"
          >
            <Check className="mr-2 h-4 w-4" />
            {copy.preset}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
