'use client'

import { useActionState } from 'react'
import { submitJobRequest, type RequestState } from '@/app/request-job/actions'

const initial: RequestState = { ok: false }

const input =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function JobRequestForm() {
  // state = whatever the action last returned; pending = true while it runs
  const [state, formAction, pending] = useActionState(submitJobRequest, initial)

  if (state.ok) {
    return (
      <div className="rounded-lg border border-good/30 bg-good/10 p-6 text-sm">
        Thank you. Your request has been received. Check your email for confirmation.
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Honeypot: hidden from humans and screen readers, bots fill it in */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <input name="company_name" required maxLength={120} placeholder="Hotel / company name *" className={input} />
      <input name="contact_name" required maxLength={120} placeholder="Your name *" className={input} />
      <input name="contact_email" type="email" required maxLength={200} placeholder="Email *" className={input} />
      <input name="contact_phone" maxLength={40} placeholder="Phone" className={input} />
      <input name="trade" required maxLength={80} placeholder="Type of work (e.g. HVAC, masonry) *" className={input} />
      <input name="site_location" required maxLength={200} placeholder="Site / location *" className={input} />
      <textarea name="description" required maxLength={2000} rows={5} placeholder="Describe the job *" className={input} />
      <input name="desired_timeline" maxLength={200} placeholder="Desired timeline" className={input} />

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Submit request'}
      </button>
    </form>
  )
}