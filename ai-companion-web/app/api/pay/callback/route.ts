import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCallbackSign } from '@/lib/xorpay'

// 使用 service_role 密钥以绕过 RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // 获取回调参数
    const formData = await request.formData()
    const aoid = formData.get('aoid') as string
    const orderId = formData.get('order_id') as string
    const payPrice = formData.get('pay_price') as string
    const payTime = formData.get('pay_time') as string
    const more = formData.get('more') as string
    const sign = formData.get('sign') as string

    console.log('收到支付回调:', { aoid, orderId, payPrice, payTime })

    // 验证签名
    if (!verifyCallbackSign(aoid, orderId, payPrice, payTime, sign)) {
      console.error('签名验证失败')
      return new NextResponse('签名验证失败', { status: 400 })
    }

    // 查询订单
    const { data: order, error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (orderError || !order) {
      console.error('订单不存在:', orderId)
      return new NextResponse('订单不存在', { status: 404 })
    }

    // 检查订单状态
    if (order.status === 'paid') {
      console.log('订单已支付，跳过处理')
      return new NextResponse('ok', { status: 200 })
    }

    // 解析订单附加信息
    const orderMore = more ? JSON.parse(more) : {}
    const chips = orderMore.chips || order.chips
    const userId = orderMore.userId || order.user_id

    // 更新订单状态
    const { error: updateOrderError } = await supabaseAdmin
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: payTime,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    if (updateOrderError) {
      console.error('更新订单状态失败:', updateOrderError)
      return new NextResponse('更新订单失败', { status: 500 })
    }

    // 增加用户筹码
    const { error: updateChipsError } = await supabaseAdmin.rpc('add_chips', {
      user_id_param: userId,
      chips_param: chips,
    })

    if (updateChipsError) {
      console.error('增加筹码失败:', updateChipsError)
      // 回滚订单状态
      await supabaseAdmin
        .from('payment_orders')
        .update({ status: 'pending' })
        .eq('order_id', orderId)
      return new NextResponse('增加筹码失败', { status: 500 })
    }

    console.log(`支付成功：用户 ${userId} 充值 ${chips} 筹码`)

    // 返回成功响应
    return new NextResponse('ok', { status: 200 })

  } catch (error) {
    console.error('支付回调处理错误:', error)
    return new NextResponse('处理失败', { status: 500 })
  }
}
