export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://dazoheoggmfkjllxsebl.supabase.co';
const NOTIFY_TO    = 'rileynolan013@gmail.com';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { name, email, phone, event_type, event_date, guest_count, message } = body;

  if (!name?.trim() || !email?.trim()) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400 });
  }

  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const resendKey   = process.env.RESEND_API_KEY;

  // ── Insert into Supabase ──
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ name, email, phone, event_type, event_date, guest_count, message }),
  });

  if (!dbRes.ok) {
    const err = await dbRes.text();
    console.error('Supabase insert failed:', err);
    return new Response(JSON.stringify({ error: 'Failed to save inquiry. Please try again.' }), { status: 500 });
  }

  // ── Send notification email via Resend ──
  const rows = [
    ['Name', name],
    ['Email', email],
    phone       && ['Phone', phone],
    event_type  && ['Event Type', event_type],
    event_date  && ['Preferred Date', event_date],
    guest_count && ['Expected Guests', guest_count],
    message     && ['Message', message],
  ].filter(Boolean);

  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 12px;font-weight:600;color:#6B5040;white-space:nowrap;">${k}</td><td style="padding:6px 12px;color:#2C1A0E;">${v}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;background:#F5ECD7;border-radius:8px;overflow:hidden;border:1px solid #e8d9be;">
      <div style="background:#2C1A0E;padding:28px 32px;">
        <h1 style="margin:0;color:#E8A85A;font-size:1.4rem;letter-spacing:.06em;">New Inquiry — The Bar-N</h1>
        <p style="margin:6px 0 0;color:rgba(245,236,215,.5);font-family:'Helvetica Neue',sans-serif;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;">Lake Toxaway, NC</p>
      </div>
      <div style="padding:28px 32px;">
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e8d9be;">
          ${tableRows}
        </table>
        <p style="margin:20px 0 0;font-family:'Helvetica Neue',sans-serif;font-size:.78rem;color:#8B7060;">
          Submitted ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} ET
        </p>
      </div>
    </div>
  `;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'The Bar-N <onboarding@resend.dev>',
      to: NOTIFY_TO,
      subject: `New inquiry from ${name} — The Bar-N`,
      html,
    }),
  });

  if (!emailRes.ok) {
    console.error('Resend error:', await emailRes.text());
    // Data saved — don't fail the whole request over notification
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
