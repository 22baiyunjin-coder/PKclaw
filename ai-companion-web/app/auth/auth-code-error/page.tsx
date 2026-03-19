'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'

function AuthCodeErrorContent() {
  const searchParams = useSearchParams()

  const errorCode = searchParams.get('error_code') || ''
  const errorDescription = searchParams.get('error_description') || ''

  const getErrorMessage = () => {
    switch (errorCode) {
      case 'otp_expired':
        return {
          title: '验证链接已过期',
          message: '该验证链接已过期或已被使用。请重新申请验证。',
          suggestion: '验证链接仅在15分钟内有效，请尽快使用。'
        }
      case 'otp_disabled':
        return {
          title: '验证码已失效',
          message: '该验证码已被禁用或失效。',
          suggestion: '请重新申请新的验证码。'
        }
      case 'access_denied':
        return {
          title: '访问被拒绝',
          message: errorDescription || '无法访问该资源。',
          suggestion: '请检查您的权限或重新尝试。'
        }
      default:
        return {
          title: '验证失败',
          message: errorDescription || '发生了未知错误，请重试。',
          suggestion: '如果问题持续存在，请联系客服。'
        }
    }
  }

  const error = getErrorMessage()

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4 relative">
      {/* 返回登录按钮 */}
      <Link href="/login" className="absolute top-6 left-6">
        <Button variant="ghost" className="text-slate-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回登录
        </Button>
      </Link>

      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-red-500 flex items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8" />
            {error.title}
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            {error.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400">
              💡 提示：{error.suggestion}
            </p>
          </div>

          {errorCode === 'otp_expired' && (
            <div className="space-y-3">
              <Link href="/reset-password" className="block">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                  <Mail className="mr-2 h-4 w-4" />
                  重新申请密码重置
                </Button>
              </Link>
              <Link href="/login" className="block">
                <Button variant="outline" className="w-full border-slate-700 bg-transparent hover:bg-slate-800">
                  返回登录页面
                </Button>
              </Link>
            </div>
          )}

          {errorCode !== 'otp_expired' && (
            <Link href="/login" className="block">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                返回登录页面
              </Button>
            </Link>
          )}

          {errorCode && (
            <div className="text-xs text-slate-600 text-center pt-4 border-t border-slate-800">
              错误代码: {errorCode}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-4" />
        <p className="text-slate-400">加载中...</p>
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCodeErrorContent />
    </Suspense>
  )
}
