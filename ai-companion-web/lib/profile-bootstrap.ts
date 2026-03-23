const STARTER_CHIPS = 10000

function sanitizeUsername(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim().slice(0, 32)
}

function deriveUsername(user: any) {
  const metadataUsername = sanitizeUsername(user?.user_metadata?.username)
  if (metadataUsername) {
    return metadataUsername
  }

  const emailPrefix =
    typeof user?.email === "string" ? user.email.split("@")[0] : ""
  const safeEmailPrefix = sanitizeUsername(emailPrefix)

  return safeEmailPrefix || "Player"
}

function buildProfileSeed(user: any) {
  return {
    id: user.id,
    username: deriveUsername(user),
    avatar_url:
      typeof user?.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
    chips: STARTER_CHIPS,
  }
}

export async function ensureProfileForUser(supabase: any, userOverride?: any) {
  const user =
    userOverride ??
    (await supabase.auth.getUser()).data?.user

  if (!user) {
    return null
  }

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (existing) {
    return existing
  }

  if (existingError) {
    console.error("Failed to read profile during bootstrap:", existingError)
  }

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .upsert(buildProfileSeed(user), { onConflict: "id" })
    .select("*")
    .single()

  if (createError) {
    console.error("Failed to create profile during bootstrap:", createError)
    return null
  }

  return created
}

export { STARTER_CHIPS }
