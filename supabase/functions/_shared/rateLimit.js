export function getLimit(tier) {
  if (tier === 'pro' || tier === 'starter') return 50
  if (tier === 'enterprise') return Infinity
  return 10
}

function getUtcDayStart() {
  const now = new Date()

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

export async function checkRateLimit(supabase, identifier, action, maxPerDay) {
  try {
    if (maxPerDay === Infinity) {
      return { allowed: true, count: 0 }
    }

    const windowStart = getUtcDayStart()
    const { data, error } = await supabase.rpc('increment_ratelimit', {
      p_identifier: identifier,
      p_action: action,
      p_window_start: windowStart,
    })

    if (error) {
      console.error('[rateLimit] checkRateLimit failed', error)
      return { allowed: false, count: 0 }
    }

    const count = Number(Array.isArray(data) ? data[0]?.count : data?.count ?? data)

    if (!Number.isFinite(count)) {
      console.error('[rateLimit] checkRateLimit returned invalid count', data)
      return { allowed: false, count: 0 }
    }

    return { allowed: count <= maxPerDay, count }
  } catch (error) {
    console.error('[rateLimit] checkRateLimit failed', error)
    return { allowed: false, count: 0 }
  }
}
