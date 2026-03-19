import { cookies } from "next/headers"

import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n"

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
}
