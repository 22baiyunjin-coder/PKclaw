"use client"

import { useEffect, useState } from "react"
import { RotateCw } from "lucide-react"

export function LandscapePrompt() {
  const [isPortrait, setIsPortrait] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth
      const mobile = window.innerWidth < 768
      setIsPortrait(portrait)
      setIsMobile(mobile)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // 只在移动端且竖屏时显示提示
  if (!isMobile || !isPortrait) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="text-center px-6 space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-violet-500/20 flex items-center justify-center animate-pulse">
            <RotateCw className="w-12 h-12 text-violet-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            请旋转设备
          </h2>
          <p className="text-slate-400">
            为了获得最佳游戏体验<br />
            请将设备横向放置
          </p>
        </div>

        <div className="text-xs text-slate-500">
          建议使用横屏模式游玩
        </div>
      </div>
    </div>
  )
}
