"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Edit, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { createPersona, updatePersona } from "@/app/actions/personas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"
import { Persona } from "@/lib/poker-types"

interface PersonaEditorProps {
  initialPersona?: Persona
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function PersonaEditor({
  initialPersona,
  trigger,
  onSuccess,
}: PersonaEditorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locale] = useState<Locale>(() => readClientLocale())

  const [name, setName] = useState(initialPersona?.name || "")
  const [style, setStyle] = useState(initialPersona?.style || "")
  const [description, setDescription] = useState(initialPersona?.description || "")

  const isEditing = !!initialPersona

  const copy = useMemo(
    () => ({
      create: pickText(locale, { zh: "创建新角色", en: "Create Persona" }),
      edit: pickText(locale, { zh: "编辑角色", en: "Edit Persona" }),
      createTitle: pickText(locale, { zh: "创建新的 AI 角色", en: "Create a New AI Persona" }),
      editTitle: pickText(locale, { zh: "编辑角色", en: "Edit Persona" }),
      createDescription: pickText(locale, {
        zh: "定义这个角色的风格、语气和打牌策略，让它成为你训练桌上的固定对手。",
        en: "Define this persona's style, tone, and strategy so it becomes a reliable training opponent.",
      }),
      editDescription: pickText(locale, {
        zh: "调整角色的人设和打牌风格，这会直接影响 AI 的决策方式。",
        en: "Tune the persona's identity and playing style. This directly affects AI decisions.",
      }),
      name: pickText(locale, { zh: "角色名称", en: "Persona Name" }),
      style: pickText(locale, { zh: "风格标签", en: "Style Tag" }),
      prompt: pickText(locale, { zh: "完整角色设定（Prompt）", en: "Full Persona Prompt" }),
      namePlaceholder: pickText(locale, {
        zh: "例如：河牌解题手",
        en: "For example: River Solver",
      }),
      stylePlaceholder: pickText(locale, {
        zh: "例如：Loose Aggressive",
        en: "For example: Loose Aggressive",
      }),
      styleHint: pickText(locale, {
        zh: "会展示在头像下方，适合用一句短标签概括。",
        en: "Shown below the avatar. Keep it short and memorable.",
      }),
      promptHint: pickText(locale, {
        zh: "这是发送给 AI 的核心设定，尽量把打法、情绪和说话习惯写具体。",
        en: "This is the core instruction sent to the AI. Be specific about play style, emotions, and speaking habits.",
      }),
      cancel: pickText(locale, { zh: "取消", en: "Cancel" }),
      save: pickText(locale, { zh: "保存修改", en: "Save Changes" }),
      createNow: pickText(locale, { zh: "立即创建", en: "Create Now" }),
      createSuccess: pickText(locale, { zh: "新角色创建成功", en: "Persona created" }),
      updateSuccess: pickText(locale, { zh: "角色更新成功", en: "Persona updated" }),
      actionFailed: pickText(locale, { zh: "操作失败", en: "Action failed" }),
    }),
    [locale],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isEditing && initialPersona) {
        await updatePersona(initialPersona.id, { name, style, description })
        toast.success(copy.updateSuccess)
      } else {
        await createPersona({ name, style, description })
        toast.success(copy.createSuccess)
      }

      setOpen(false)
      router.refresh()
      onSuccess?.()

      if (!isEditing) {
        setName("")
        setStyle("")
        setDescription("")
      }
    } catch (error: any) {
      console.error(error)
      toast.error(copy.actionFailed, { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {copy.create}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] border-slate-800 bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-violet-400">
            {isEditing ? copy.editTitle : copy.createTitle}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditing ? copy.editDescription : copy.createDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{copy.name}</Label>
            <Input
              id="name"
              placeholder={copy.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-slate-700 bg-slate-950"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="style">{copy.style}</Label>
            <Input
              id="style"
              placeholder={copy.stylePlaceholder}
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              required
              className="border-slate-700 bg-slate-950"
            />
            <p className="text-xs text-slate-500">{copy.styleHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{copy.prompt}</Label>
            <Textarea
              id="description"
              placeholder={`**Core Identity**: ...
**Play Style**: ...
**Personality**: ...
**Conversation Tone**: ...`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="min-h-[200px] border-slate-700 bg-slate-950 font-mono text-sm"
            />
            <p className="text-xs text-slate-500">{copy.promptHint}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {copy.cancel}
            </Button>
            <Button
              type="submit"
              className="bg-violet-600 text-white hover:bg-violet-700"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? copy.save : copy.createNow}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
