import crypto from 'crypto'
import type { CreatePaymentRequest, CreatePaymentResponse, OrderStatusResponse } from '@/types/payment'

// XorPay 配置
const XORPAY_CONFIG = {
  appId: process.env.XORPAY_APP_ID!,
  appSecret: process.env.XORPAY_APP_SECRET!,
  apiBase: 'https://xorpay.com',
}

/**
 * 生成 MD5 签名
 */
function generateMD5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex')
}

/**
 * 生成支付签名
 * 规则: name + pay_type + price + order_id + notify_url + app_secret
 */
export function generatePaymentSign(
  name: string,
  payType: string,
  price: string,
  orderId: string,
  notifyUrl: string
): string {
  const str = `${name}${payType}${price}${orderId}${notifyUrl}${XORPAY_CONFIG.appSecret}`
  return generateMD5(str)
}

/**
 * 生成回调签名验证
 * 规则: aoid + order_id + pay_price + pay_time + app_secret
 */
export function generateCallbackSign(
  aoid: string,
  orderId: string,
  payPrice: string,
  payTime: string
): string {
  const str = `${aoid}${orderId}${payPrice}${payTime}${XORPAY_CONFIG.appSecret}`
  return generateMD5(str)
}

/**
 * 生成订单查询签名
 * 规则: order_id + app_secret
 */
export function generateQuerySign(orderId: string): string {
  const str = `${orderId}${XORPAY_CONFIG.appSecret}`
  return generateMD5(str)
}

/**
 * 创建支付订单
 */
export async function createPaymentOrder(
  name: string,
  price: number,
  orderId: string,
  orderUid: string,
  notifyUrl: string,
  more?: string
): Promise<CreatePaymentResponse> {
  const priceStr = price.toFixed(2)
  const payType = 'alipay'

  const sign = generatePaymentSign(name, payType, priceStr, orderId, notifyUrl)

  const params = new URLSearchParams({
    name,
    pay_type: payType,
    price: priceStr,
    order_id: orderId,
    order_uid: orderUid,
    notify_url: notifyUrl,
    sign,
    expire: '7200', // 2小时过期
  })

  if (more) {
    params.append('more', more)
  }

  const response = await fetch(`${XORPAY_CONFIG.apiBase}/api/pay/${XORPAY_CONFIG.appId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`XorPay API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data
}

/**
 * 查询订单状态
 */
export async function queryOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  const sign = generateQuerySign(orderId)

  const response = await fetch(
    `${XORPAY_CONFIG.apiBase}/api/query2/${XORPAY_CONFIG.appId}?order_id=${orderId}&sign=${sign}`
  )

  if (!response.ok) {
    throw new Error(`XorPay Query API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data
}

/**
 * 验证回调签名
 */
export function verifyCallbackSign(
  aoid: string,
  orderId: string,
  payPrice: string,
  payTime: string,
  sign: string
): boolean {
  const expectedSign = generateCallbackSign(aoid, orderId, payPrice, payTime)
  return expectedSign === sign
}

/**
 * 生成二维码URL
 */
export function generateQRCodeUrl(data: string): string {
  return `${XORPAY_CONFIG.apiBase}/qr?data=${encodeURIComponent(data)}`
}
