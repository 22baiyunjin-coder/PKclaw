import { NextResponse } from "next/server"

import { getSupabaseMissingMessage, hasSupabaseEnv } from "@/lib/supabase-env"
import { queryOrderStatus } from "@/lib/xorpay"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 })
    }

    const { data: order, error: dbError } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("order_id", orderId)
      .eq("user_id", user.id)
      .single()

    if (dbError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.status === "paid") {
      return NextResponse.json({
        status: "paid",
        order,
      })
    }

    try {
      const xorpayStatus = await queryOrderStatus(orderId)

      if (xorpayStatus.status === "success" || xorpayStatus.status === "payed") {
        await supabase
          .from("payment_orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)

        return NextResponse.json({
          status: "paid",
          order: { ...order, status: "paid" },
        })
      }

      return NextResponse.json({
        status: xorpayStatus.status,
        order,
      })
    } catch (xorpayError) {
      console.error("Query XorPay status failed:", xorpayError)
      return NextResponse.json({
        status: order.status,
        order,
      })
    }
  } catch (error) {
    console.error("Query order error:", error)
    return NextResponse.json(
      {
        error: "Failed to query order",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
