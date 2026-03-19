export type Locale = "zh" | "en"

export const LOCALE_COOKIE_NAME = "pokermind-locale"
export const DEFAULT_LOCALE: Locale = "zh"

export function normalizeLocale(value?: string | null): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE
}

export function readClientLocale(): Locale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]+)`),
  )

  return normalizeLocale(match?.[1] ?? null)
}

export function setClientLocale(locale: Locale): void {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`
}

export function pickText<T>(locale: Locale, texts: { zh: T; en: T }): T {
  return locale === "en" ? texts.en : texts.zh
}
