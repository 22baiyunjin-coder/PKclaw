"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Loader2,
  QrCode,
  Star,
  Zap,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CHIPS_PACKAGES, type ChipsPackage } from "@/types/payment"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"

export default function ShopPage() {
  const router = useRouter()
  const supabase = createClient()

  const [locale] = useState<Locale>(() => readClientLocale())
  const [loading, setLoading] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<ChipsPackage | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    orderId: string
    qrCodeImage: string
    price: number
    chips: number
    expiresIn: number
  } | null>(null)

  const copy = useMemo(
    () => ({
      back: pickText(locale, { zh: "返回首页", en: "Back Home" }),
      title: pickText(locale, { zh: "筹码商城", en: "Chip Store" }),
      subtitle: pickText(locale, {
        zh: "选择适合你的充值包，继续在 PokerMind 里训练。",
        en: "Choose the package that fits you and keep training inside PokerMind.",
      }),
      hottest: pickText(locale, { zh: "最热门", en: "Most Popular" }),
      chips: pickText(locale, { zh: "筹码", en: "chips" }),
      buyNow: pickText(locale, { zh: "立即购买", en: "Buy Now" }),
      creating: pickText(locale, { zh: "创建订单中...", en: "Creating order..." }),
      notes: pickText(locale, { zh: "购买须知", en: "Purchase Notes" }),
      noteItems: pickText(locale, {
        zh: [
          "支持支付宝扫码支付，到账速度快。",
          "充值成功后筹码会自动发放到你的账户。",
          "大盲注为 20，标准买入为 4000 筹码（200BB）。",
          "筹码长期有效，可以随时用于训练桌。",
          "如有支付问题，可联系管理员排查。",
        ],
        en: [
          "Alipay QR payments are supported for a fast checkout flow.",
          "Chips are credited to your account automatically after payment.",
          "The default big blind is 20, and a standard buy-in is 4000 chips (200BB).",
          "Chips do not expire and can be used at any time.",
          "If a payment fails, contact the admin for support.",
        ],
      }),
      loginRequired: pickText(locale, { zh: "请先登录", en: "Please log in first" }),
      buyFailed: pickText(locale, { zh: "购买失败", en: "Purchase failed" }),
      orderFailed: pickText(locale, { zh: "创建订单失败", en: "Failed to create order" }),
      paymentSuccess: pickText(locale, { zh: "支付成功", en: "Payment successful" }),
      paymentDesc: pickText(locale, {
        zh: "已成功充值",
        en: "Successfully credited",
      }),
      payTitle: pickText(locale, { zh: "扫码支付", en: "Scan to Pay" }),
      payDesc: pickText(locale, {
        zh: "请使用支付宝扫码完成支付。",
        en: "Please use Alipay to scan and complete the payment.",
      }),
      orderChips: pickText(locale, { zh: "充值筹码", en: "Chips" }),
      amount: pickText(locale, { zh: "支付金额", en: "Amount" }),
      orderId: pickText(locale, { zh: "订单号", en: "Order ID" }),
      waiting: pickText(locale, { zh: "等待支付确认中...", en: "Waiting for payment confirmation..." }),
      expired: pickText(locale, { zh: "二维码时效", en: "QR Expires In" }),
      minutes: pickText(locale, { zh: "分钟", en: "minutes" }),
    }),
    [locale],
  )

  const handleBuyPackage = async (pkg: ChipsPackage) => {
    setSelectedPackage(pkg)
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error(copy.loginRequired)
        router.push("/login")
        return
      }

      const response = await fetch("/api/pay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId: pkg.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || copy.orderFailed)
      }

      setPaymentData({
        orderId: data.orderId,
        qrCodeImage: data.qrCodeImage,
        price: data.price,
        chips: data.chips,
        expiresIn: data.expiresIn,
      })
      setShowPaymentDialog(true)
      startPollingOrderStatus(data.orderId)
    } catch (error) {
      console.error("Purchase failed:", error)
      toast.error(copy.buyFailed, {
        description: error instanceof Error ? error.message : copy.buyFailed,
      })
    } finally {
      setLoading(false)
    }
  }

  const startPollingOrderStatus = (orderId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pay/query?orderId=${orderId}`)
        const data = await response.json()

        if (data.status === "paid") {
          clearInterval(pollInterval)
          setShowPaymentDialog(false)
          toast.success(copy.paymentSuccess, {
            description: `${copy.paymentDesc} ${paymentData?.chips.toLocaleString()} ${copy.chips}`,
          })
          router.refresh()
        }
      } catch (error) {
        console.error("Failed to query order status:", error)
      }
    }, 3000)

    setTimeout(() => {
      clearInterval(pollInterval)
    }, 7200000)
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto mb-6 max-w-6xl">
        <Link href="/">
          <Button variant="ghost" className="text-slate-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {copy.back}
          </Button>
        </Link>
      </div>

      <div className="mx-auto mb-8 max-w-6xl text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Coins className="h-10 w-10 text-violet-400" />
          <h1 className="text-4xl font-bold text-white">{copy.title}</h1>
        </div>
        <p className="text-lg text-slate-400">{copy.subtitle}</p>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {CHIPS_PACKAGES.map((pkg) => (
          <Card
            key={pkg.id}
            className={`relative border-2 bg-slate-900 transition-all hover:scale-105 ${
              pkg.popular
                ? "border-violet-500 shadow-lg shadow-violet-500/20"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            {pkg.popular ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-violet-500 px-4 py-1 font-bold text-white">
                  <Star className="mr-1 h-3 w-3" />
                  {copy.hottest}
                </Badge>
              </div>
            ) : null}

            {pkg.discount ? (
              <div className="absolute -right-3 -top-3">
                <Badge className="bg-red-500 px-3 py-1 font-bold text-white">
                  {pkg.discount}
                </Badge>
              </div>
            ) : null}

            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-2xl font-bold text-white">{pkg.name}</CardTitle>
              <CardDescription className="text-slate-400">
                {pkg.games} games • {pkg.bb}BB
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950 py-6 text-center">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <Coins className="h-6 w-6 text-violet-400" />
                  <span className="text-3xl font-bold text-violet-400">
                    {pkg.chips.toLocaleString()}
                  </span>
                </div>
                <span className="text-sm text-slate-500">{copy.chips}</span>
              </div>

              <div className="text-center">
                <div className="mb-1 text-4xl font-bold text-white">
                  ¥{pkg.price.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500">
                  ¥{(pkg.price / pkg.chips * 1000).toFixed(4)} / 1k {copy.chips}
                </div>
              </div>

              <Button
                onClick={() => handleBuyPackage(pkg)}
                disabled={loading && selectedPackage?.id === pkg.id}
                className={`w-full py-6 font-bold text-white ${
                  pkg.popular
                    ? "bg-violet-500 hover:bg-violet-600"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {loading && selectedPackage?.id === pkg.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.creating}
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    {copy.buyNow}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-6xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          {copy.notes}
        </h3>
        <ul className="space-y-2 text-sm text-slate-400">
          {copy.noteItems.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[400px] border-slate-800 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">{copy.payTitle}</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              {copy.payDesc}
            </DialogDescription>
          </DialogHeader>

          {paymentData ? (
            <div className="space-y-6 py-4">
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{copy.orderChips}</span>
                  <span className="font-bold text-violet-400">
                    {paymentData.chips.toLocaleString()} {copy.chips}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{copy.amount}</span>
                  <span className="font-bold text-white">¥{paymentData.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{copy.orderId}</span>
                  <span className="font-mono text-xs text-slate-300">
                    {paymentData.orderId}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-3">
                <div className="rounded-xl bg-white p-4 shadow-lg">
                  <Image
                    src={paymentData.qrCodeImage}
                    alt="Payment QR Code"
                    width={220}
                    height={220}
                    className="h-[220px] w-[220px]"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-violet-400">
                  <QrCode className="h-4 w-4" />
                  {copy.waiting}
                </div>
                <div className="text-xs text-slate-500">
                  {copy.expired}: {Math.ceil(paymentData.expiresIn / 60)} {copy.minutes}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
