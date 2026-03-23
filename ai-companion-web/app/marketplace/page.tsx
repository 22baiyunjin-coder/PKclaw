"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Calendar,
  Check,
  Download,
  Loader2,
  Search,
  Star,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { SiteHeaderClient } from "@/components/layout/site-header-client"
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
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  addToLibrary,
  getMarketplacePersonas,
  getUserLibraryIds,
  removeFromLibrary,
  votePersona,
} from "@/app/actions/personas"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"
import { Persona } from "@/lib/poker-types"
import { hasSupabaseEnv } from "@/lib/supabase-env"

type MarketplacePersona = Persona & {
  likes: number
  is_published: boolean
  created_at: string
}

export default function MarketplacePage() {
  const [locale, setLocale] = useState<Locale>("zh")
  const [personas, setPersonas] = useState<MarketplacePersona[]>([])
  const [libraryIds, setLibraryIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<"popular" | "newest">("popular")
  const [search, setSearch] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    setLocale(readClientLocale())
  }, [])

  const copy = useMemo(
    () => ({
      title: pickText(locale, { zh: "AI 角色市场", en: "AI Persona Marketplace" }),
      subtitle: pickText(locale, {
        zh: "发现、收藏并测试其他玩家创建的 AI 对手。",
        en: "Discover, save, and test AI opponents created by other players.",
      }),
      myWorkshop: pickText(locale, { zh: "我的工坊", en: "My Workshop" }),
      searchPlaceholder: pickText(locale, {
        zh: "搜索角色名称或风格...",
        en: "Search by persona name or style...",
      }),
      popular: pickText(locale, { zh: "最热门", en: "Most Popular" }),
      newest: pickText(locale, { zh: "最新发布", en: "Newest" }),
      loadFailed: pickText(locale, { zh: "加载失败", en: "Failed to load data" }),
      addSuccess: pickText(locale, {
        zh: "已添加到我的角色库",
        en: "Added to your persona library",
      }),
      addFailed: pickText(locale, { zh: "添加失败", en: "Failed to add persona" }),
      removeSuccess: pickText(locale, {
        zh: "已从角色库移除",
        en: "Removed from your persona library",
      }),
      removeFailed: pickText(locale, { zh: "移除失败", en: "Failed to remove persona" }),
      voteSuccess: pickText(locale, { zh: "投票成功", en: "Vote submitted" }),
      voteFailed: pickText(locale, { zh: "投票失败", en: "Vote failed" }),
      empty: pickText(locale, {
        zh: "暂时没有匹配的角色，试试别的关键词。",
        en: "No matching personas yet. Try a different keyword.",
      }),
      added: pickText(locale, { zh: "已收藏", en: "Saved" }),
      addToLibrary: pickText(locale, { zh: "添加到角色库", en: "Add to Library" }),
      beta: "Beta",
      demoUnavailable: pickText(locale, {
        zh: "当前演示环境还没接上数据库，这个角色库动作暂时不可用。",
        en: "This public demo is not connected to the database yet, so this library action is unavailable.",
      }),
    }),
    [locale],
  )

  useEffect(() => {
    void loadData()
  }, [sort])

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, libIds] = await Promise.all([
        getMarketplacePersonas(sort),
        getUserLibraryIds(),
      ])
      setPersonas(list as MarketplacePersona[])
      setLibraryIds(libIds)
    } catch (error) {
      console.error(error)
      toast.error(copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (id: string) => {
    if (!hasSupabaseEnv()) {
      toast.info(copy.demoUnavailable)
      return
    }

    setProcessingId(id)
    try {
      await addToLibrary(id)
      setLibraryIds((prev) => [...prev, id])
      toast.success(copy.addSuccess)
    } catch (error) {
      console.error(error)
      toast.error(copy.addFailed)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRemove = async (id: string) => {
    if (!hasSupabaseEnv()) {
      toast.info(copy.demoUnavailable)
      return
    }

    setProcessingId(id)
    try {
      await removeFromLibrary(id)
      setLibraryIds((prev) => prev.filter((item) => item !== id))
      toast.success(copy.removeSuccess)
    } catch (error) {
      console.error(error)
      toast.error(copy.removeFailed)
    } finally {
      setProcessingId(null)
    }
  }

  const handleVote = async (id: string, type: "like" | "dislike") => {
    if (!hasSupabaseEnv()) {
      toast.info(copy.demoUnavailable)
      return
    }

    try {
      await votePersona(id, type)
      toast.success(copy.voteSuccess)
      await loadData()
    } catch (error) {
      console.error(error)
      toast.error(copy.voteFailed)
    }
  }

  const filteredPersonas = personas.filter((persona) => {
    const keyword = search.toLowerCase()
    return (
      persona.name.toLowerCase().includes(keyword) ||
      persona.style.toLowerCase().includes(keyword)
    )
  })

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <SiteHeaderClient />

      <main className="container mx-auto flex-1 px-4 py-8 max-w-6xl">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-white">
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                {copy.title}
              </span>
              <Badge variant="outline" className="border-violet-500/30 text-violet-400">
                {copy.beta}
              </Badge>
            </h1>
            <p className="mt-2 text-slate-400">{copy.subtitle}</p>
          </div>

          <Link href="/personas">
            <Button variant="outline" className="border-white/10 hover:bg-white/5">
              <User className="mr-2 h-4 w-4" />
              {copy.myWorkshop}
            </Button>
          </Link>
        </div>

        <div className="sticky top-0 z-10 -mx-4 mb-8 flex flex-col gap-4 border-b border-white/5 bg-zinc-950/80 px-4 py-4 backdrop-blur-md sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder={copy.searchPlaceholder}
              className="border-white/10 bg-white/5 pl-9 focus:border-violet-500/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Tabs
            value={sort}
            onValueChange={(value) => setSort(value as "popular" | "newest")}
            className="w-full sm:w-auto"
          >
            <TabsList className="w-full border border-white/10 bg-white/5 sm:w-auto">
              <TabsTrigger value="popular" className="flex-1 sm:flex-none">
                <Star className="mr-2 h-4 w-4" />
                {copy.popular}
              </TabsTrigger>
              <TabsTrigger value="newest" className="flex-1 sm:flex-none">
                <Calendar className="mr-2 h-4 w-4" />
                {copy.newest}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : filteredPersonas.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <p>{copy.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPersonas.map((persona) => {
              const isAdded = libraryIds.includes(persona.id)
              const isProcessing = processingId === persona.id

              return (
                <Card
                  key={persona.id}
                  className="group flex flex-col overflow-hidden border-white/10 bg-zinc-900 transition-all hover:border-violet-500/30"
                >
                  <CardHeader className="relative pb-3">
                    <div className="absolute right-0 top-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:text-green-400"
                          onClick={() => handleVote(persona.id, "like")}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:text-red-400"
                          onClick={() => handleVote(persona.id, "dislike")}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white shadow-lg">
                        {persona.name[0]}
                      </div>

                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg text-white">
                          {persona.name}
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2">
                          <Badge className="rounded-sm border-none bg-white/5 px-1.5 py-0 text-zinc-400 hover:bg-white/10">
                            {persona.style}
                          </Badge>
                          <span className="flex items-center text-xs text-violet-400">
                            <ThumbsUp className="mr-1 h-3 w-3" />
                            {persona.likes || 0}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <p className="line-clamp-3 text-sm leading-relaxed text-slate-400">
                      {persona.description}
                    </p>
                  </CardContent>

                  <CardFooter className="mt-4 border-t border-white/5 bg-black/20 p-4 pt-0">
                    {isAdded ? (
                      <Button
                        variant="outline"
                        className="w-full border-green-500/30 text-green-400 transition-all hover:border-green-500/50 hover:bg-green-500/10 hover:text-green-300"
                        onClick={() => handleRemove(persona.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        {copy.added}
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-violet-600 font-bold text-white shadow-lg shadow-violet-950/20 hover:bg-violet-500"
                        onClick={() => handleAdd(persona.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {copy.addToLibrary}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
