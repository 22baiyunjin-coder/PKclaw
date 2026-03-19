import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  // 处理 PKCE 流程（邮件验证和密码重置）
  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      // 如果是密码重置，重定向到更新密码页面
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/update-password`)
      }
      // 其他类型（如邮箱验证）重定向到指定页面
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 处理旧的授权码流程（OAuth等）
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
