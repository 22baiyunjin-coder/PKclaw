// 积分充值包定义
export interface ChipsPackage {
  id: string
  name: string
  chips: number
  price: number
  bb: number // 大盲注数
  games: number // 预计游戏局数
  discount?: string
  popular?: boolean
}

// 充值包列表
export const CHIPS_PACKAGES: ChipsPackage[] = [
  {
    id: 'trial',
    name: '体验包',
    chips: 10000,
    price: 1.00,
    bb: 500,
    games: 2,
  },
  {
    id: 'starter',
    name: '入门包',
    chips: 50000,
    price: 3.88,
    bb: 2500,
    games: 12,
  },
  {
    id: 'standard',
    name: '标准包',
    chips: 200000,
    price: 12.88,
    bb: 10000,
    games: 50,
    popular: true,
  },
  {
    id: 'premium',
    name: '豪华包',
    chips: 500000,
    price: 28.88,
    bb: 25000,
    games: 125,
    discount: '优惠11%',
  },
  {
    id: 'ultimate',
    name: '至尊包',
    chips: 1000000,
    price: 48.88,
    bb: 50000,
    games: 250,
    discount: '优惠20%',
  },
]

// XorPay 支付订单
export interface PaymentOrder {
  orderId: string
  userId: string
  packageId: string
  chips: number
  price: number
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  aoid?: string // XorPay 平台订单号
  qrCode?: string // 支付二维码
  createdAt: Date
  paidAt?: Date
  expiresAt: Date
}

// XorPay 创建订单请求
export interface CreatePaymentRequest {
  name: string
  pay_type: 'alipay'
  price: string
  order_id: string
  order_uid?: string
  notify_url: string
  more?: string
  expire?: number
  sign: string
}

// XorPay 创建订单响应
export interface CreatePaymentResponse {
  status: string
  aoid?: string
  expire_in?: number
  info?: {
    qr: string
  }
}

// XorPay 支付回调
export interface PaymentCallback {
  aoid: string
  order_id: string
  pay_price: string
  pay_time: string
  more?: string
  detail?: string
  sign: string
}

// 订单状态查询响应
export interface OrderStatusResponse {
  status: 'not_exist' | 'new' | 'payed' | 'fee_error' | 'success' | 'expire'
}
