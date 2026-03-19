import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { getSupabaseMissingMessage, hasSupabaseServiceRoleEnv } from "@/lib/supabase-env"
import { verifyCallbackSign } from "@/lib/xorpay"

export async function POST(request: Request) {
  try {
    if (!hasSupabaseServiceRoleEnv()) {
      return new NextResponse(getSupabaseMissingMessage(), { status: 503 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const formData = await request.formData()
    const aoid = formData.get("aoid") as string
    const orderId = formData.get("order_id") as string
    const payPrice = formData.get("pay_price") as string
    const payTime = formData.get("pay_time") as string
    const more = formData.get("more") as string
    const sign = formData.get("sign") as string

    if (!verifyCallbackSign(aoid, orderId, payPrice, payTime, sign)) {
      return new NextResponse("Invalid callback signature", { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("payment_orders")
      .select("*")
      .eq("order_id", orderId)
      .single()

    if (orderError || !order) {
      return new NextResponse("Order not found", { status: 404 })
    }

    if (order.status === "paid") {
      return new NextResponse("ok", { status: 200 })
    }

    const orderMore = more ? JSON.parse(more) : {}
    const chips = orderMore.chips || order.chips
    const userId = orderMore.userId || order.user_id

    const { error: updateOrderError } = await supabaseAdmin
      .from("payment_orders")
      .update({
        status: "paid",
        paid_at: payTime,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)

    if (updateOrderError) {
      return new NextResponse("Failed to update order", { status: 500 })
    }

    const { error: updateChipsError } = await supabaseAdmin.rpc("add_chips", {
      user_id_param: userId,
      chips_param: chips,
    })

    if (updateChipsError) {
      await supabaseAdmin
        .from("payment_orders")
        .update({ status: "pending" })
        .eq("order_id", orderId)

      return new NextResponse("Failed to credit chips", { status: 500 })
    }

    return new NextResponse("ok", { status: 200 })
  } catch (error) {
    console.error("Payment callback error:", error)
    return new NextResponse("Payment callback failed", { status: 500 })
  }
}
