import { NextResponse } from "next/server"

import { getSupabaseMissingMessage, hasSupabaseEnv } from "@/lib/supabase-env"
import { createPaymentOrder, generateQRCodeUrl } from "@/lib/xorpay"
import { CHIPS_PACKAGES } from "@/types/payment"
import { createClient } from "@/utils/supabase/server"

export async function POST(request: Request) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ error: getSupabaseMissingMessage() }, { status: 503 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { packageId } = body
    const chipsPackage = CHIPS_PACKAGES.find((pkg) => pkg.id === packageId)

    if (!chipsPackage) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 })
    }

    const orderId = `ORDER_${Date.now()}_${user.id.slice(0, 8)}`
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const notifyUrl = `${siteUrl}/api/pay/callback`

    const paymentResponse = await createPaymentOrder(
      `PokerMind - ${chipsPackage.name}`,
      chipsPackage.price,
      orderId,
      user.email || user.id,
      notifyUrl,
      JSON.stringify({ packageId, chips: chipsPackage.chips, userId: user.id }),
    )

    if (paymentResponse.status !== "ok") {
      return NextResponse.json(
        {
          error: "Failed to create payment order",
          message: paymentResponse.status,
        },
        { status: 500 },
      )
    }

    const { error: dbError } = await supabase.from("payment_orders").insert({
      order_id: orderId,
      user_id: user.id,
      package_id: packageId,
      chips: chipsPackage.chips,
      price: chipsPackage.price,
      status: "pending",
      aoid: paymentResponse.aoid,
      qr_code: paymentResponse.info?.qr,
      expires_at: new Date(Date.now() + (paymentResponse.expire_in || 7200) * 1000),
    })

    if (dbError) {
      console.error("Failed to persist order:", dbError)
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      orderId,
      aoid: paymentResponse.aoid,
      qrCode: paymentResponse.info?.qr,
      qrCodeImage: generateQRCodeUrl(paymentResponse.info?.qr || ""),
      expiresIn: paymentResponse.expire_in,
      chips: chipsPackage.chips,
      price: chipsPackage.price,
    })
  } catch (error) {
    console.error("Create order error:", error)
    return NextResponse.json(
      {
        error: "Failed to create order",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
