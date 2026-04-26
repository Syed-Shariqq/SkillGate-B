Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ status: 'ok' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})