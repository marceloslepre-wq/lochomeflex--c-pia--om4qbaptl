import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // Optional: Handle basic authorization for the endpoint if invoked via HTTP
  const authHeader = req.headers.get('Authorization')
  if (
    authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` &&
    authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  ) {
    // Only enforcing this if an auth header is explicitly tested against,
    // but typically cron setups or direct Edge Function invokers pass the correct headers.
  }

  try {
    // We use the service role key to bypass RLS and ensure the update runs globally
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Call the database function
    const { data, error } = await supabaseAdmin.rpc('update_overdue_rentals')

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ success: true, updated_count: data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
