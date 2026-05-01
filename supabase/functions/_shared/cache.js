function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)

    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value)
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashKey(input) {
  try {
    const encoded = new TextEncoder().encode(stableStringify(input))
    const digest = await crypto.subtle.digest('SHA-256', encoded)

    return bytesToHex(new Uint8Array(digest))
  } catch (error) {
    console.error('[cache] hashKey failed', error)
    return ''
  }
}

export async function getCached(supabase, cacheKey) {
  try {
    const { data, error } = await supabase
      .from('cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (error) {
      console.error('[cache] getCached failed', error)
      return null
    }

    if (!data) {
      return null
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return null
    }

    return data.data
  } catch (error) {
    console.error('[cache] getCached failed', error)
    return null
  }
}

export async function setCache(supabase, cacheKey, type, data, ttlSeconds) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    const { error } = await supabase.from('cache').upsert(
      {
        cache_key: cacheKey,
        cache_type: type,
        data,
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' },
    )

    if (error) {
      console.error('[cache] setCache failed', error)
    }
  } catch (error) {
    console.error('[cache] setCache failed', error)
  }
}
