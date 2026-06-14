import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const hashString = async (input: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const siteUrl = Deno.env.get('SITE_URL') || 'https://skill-gate-b.vercel.app'

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  // Extract token from URL
  const url = new URL(req.url)
  const token = url.pathname.split('/').filter(Boolean).pop()

  if (!token) {
    return new Response('Not found', { status: 404 })
  }

  // Fetch job by token
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, is_active, link_expires_at, link_max_uses, link_use_count, assessment_link_token')
    .eq('assessment_link_token', token)
    .maybeSingle()

  if (jobError || !job) {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <body style="background:#0D1117;color:#E6EDF3;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
          <div style="text-align:center">
            <h1 style="font-size:2rem">404</h1>
            <p>Assessment link not found.</p>
          </div>
        </body>
      </html>
    `, { status: 404, headers: { 'Content-Type': 'text/html' } })
  }

  // Validation checks
  const now = new Date()

  if (!job.is_active) {
    return Response.redirect(`${siteUrl}/assess/expired`, 302)
  }

  if (job.link_expires_at && new Date(job.link_expires_at) < now) {
    return Response.redirect(`${siteUrl}/assess/expired`, 302)
  }

  if (job.link_max_uses && job.link_use_count >= job.link_max_uses) {
    return Response.redirect(`${siteUrl}/assess/expired`, 302)
  }

  // Rate limit check
  const ipRaw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = await hashString(ipRaw)
  const uaHash = await hashString(req.headers.get('user-agent') || 'unknown')

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  const { count: recentOpens } = await supabase
    .from('link_opens')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', job.id)
    .eq('ip_hash', ipHash)
    .gte('opened_at', oneHourAgo)

  // Log open (fire and forget) — skip if rate limited
  if (!recentOpens || recentOpens < 50) {
    supabase.from('link_opens').insert({
      job_id: job.id,
      ip_hash: ipHash,
      user_agent_hash: uaHash,
    }).then(() => {})
  }

  // Redirect to actual assessment
  return Response.redirect(`${siteUrl}/assess/${token}`, 302)
})
