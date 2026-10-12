'use server'

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server' // adjust to wherever your server client lives

export type RequestState = { ok: boolean; error?: string }

export async function submitJobRequest(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  // Honeypot: real people never see this field, bots fill it in.
  // If it has content, pretend success and quietly drop the submission.
  if (formData.get('website')) return { ok: true }

  const get = (k: string) => String(formData.get(k) ?? '').trim()

  const row = {
    company_name: get('company_name'),
    contact_name: get('contact_name'),
    contact_email: get('contact_email'),
    contact_phone: get('contact_phone') || null,
    trade: get('trade'),
    site_location: get('site_location'),
    description: get('description'),
    desired_timeline: get('desired_timeline') || null,
  }

  if (!row.company_name || !row.contact_name || !row.trade || !row.site_location || !row.description) {
    return { ok: false, error: 'Please fill in all required fields.' }
  }
  // Basic shape check: something@something.something
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact_email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  const supabase = await createClient()
  // No .select() here on purpose: anonymous visitors may insert but not read.
  const { error } = await supabase.from('job_requests').insert(row)
  if (error) return { ok: false, error: 'Something went wrong. Please try again.' }

  // Emails are best-effort: a failed email must not lose the request.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.RESEND_FROM_EMAIL! // reuse the sender you already use
    await Promise.all([
      resend.emails.send({
        from,
        to: process.env.FL_OWNER_EMAIL!,
        subject: `New job request: ${row.company_name} (${row.trade})`,
        text: `${row.contact_name} from ${row.company_name} submitted a request.\n\nTrade: ${row.trade}\nSite: ${row.site_location}\n\n${row.description}`,
      }),
      resend.emails.send({
        from,
        to: row.contact_email,
        subject: 'We received your job request',
        text: `Hi ${row.contact_name},\n\nThanks for your request. FL Projects has received it and will review it shortly. You'll hear from us by email.`,
      }),
    ])
  } catch {
    // swallow: request is already saved
  }

  return { ok: true }
}