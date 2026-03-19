import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { queryOrderStatus } from '@/lib/xorpay'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // 验证用户登录
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 获取订单ID
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: '缺少订单ID' }, { status: 400 })
    }

    // 从数据库查询订单
    const { data: order, error: dbError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .single()

    if (dbError || !order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 如果订单已支付，直接返回
    if (order.status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        order,
      })
    }

    // 如果订单还在pending状态，查询XorPay订单状态
    try {
      const xorpayStatus = await queryOrderStatus(orderId)

      // 如果XorPay显示已支付但数据库还是pending，更新数据库
      if (xorpayStatus.status === 'success' || xorpayStatus.status === 'payed') {
        await supabase
          .from('payment_orders')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)

        return NextResponse.json({
          status: 'paid',
          order: { ...order, status: 'paid' },
        })
      }

      // 返回当前状态
      return NextResponse.json({
        status: xorpayStatus.status,
        order,
      })

    } catch (xorpayError) {
      console.error('查询XorPay订单状态失败:', xorpayError)
      // 即使XorPay查询失败，也返回数据库中的状态
      return NextResponse.json({
        status: order.status,
        order,
      })
    }

  } catch (error) {
    console.error('查询订单错误:', error)
    return NextResponse.json({
      error: '查询订单失败',
      message: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
