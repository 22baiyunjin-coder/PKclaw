import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createPaymentOrder, generateQRCodeUrl } from '@/lib/xorpay'
import { CHIPS_PACKAGES } from '@/types/payment'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 验证用户登录
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 获取请求参数
    const body = await request.json()
    const { packageId } = body

    // 验证充值包
    const chipsPackage = CHIPS_PACKAGES.find(pkg => pkg.id === packageId)
    if (!chipsPackage) {
      return NextResponse.json({ error: '无效的充值包' }, { status: 400 })
    }

    // 生成订单ID
    const orderId = `ORDER_${Date.now()}_${user.id.slice(0, 8)}`

    // 获取回调地址 - 使用环境变量或默认本地地址
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const notifyUrl = `${siteUrl}/api/pay/callback`

    // 创建支付订单
    const paymentResponse = await createPaymentOrder(
      `PokerMind - ${chipsPackage.name}`,
      chipsPackage.price,
      orderId,
      user.email || user.id,
      notifyUrl,
      JSON.stringify({ packageId, chips: chipsPackage.chips, userId: user.id })
    )

    // 检查支付订单创建结果
    if (paymentResponse.status !== 'ok') {
      return NextResponse.json({
        error: '创建支付订单失败',
        message: paymentResponse.status
      }, { status: 500 })
    }

    // 保存订单到数据库
    const { error: dbError } = await supabase
      .from('payment_orders')
      .insert({
        order_id: orderId,
        user_id: user.id,
        package_id: packageId,
        chips: chipsPackage.chips,
        price: chipsPackage.price,
        status: 'pending',
        aoid: paymentResponse.aoid,
        qr_code: paymentResponse.info?.qr,
        expires_at: new Date(Date.now() + (paymentResponse.expire_in || 7200) * 1000),
      })

    if (dbError) {
      console.error('保存订单失败:', dbError)
      return NextResponse.json({ error: '保存订单失败' }, { status: 500 })
    }

    // 返回支付信息
    return NextResponse.json({
      success: true,
      orderId,
      aoid: paymentResponse.aoid,
      qrCode: paymentResponse.info?.qr,
      qrCodeImage: generateQRCodeUrl(paymentResponse.info?.qr || ''),
      expiresIn: paymentResponse.expire_in,
      chips: chipsPackage.chips,
      price: chipsPackage.price,
    })

  } catch (error) {
    console.error('创建支付订单错误:', error)
    return NextResponse.json({
      error: '创建支付订单失败',
      message: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
