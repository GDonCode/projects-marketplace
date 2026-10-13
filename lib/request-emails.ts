import { Resend } from "resend";

// Same settings as lib/email.ts so every email comes from one address
const FROM = process.env.EMAIL_FROM || "Projects Marketplace <onboarding@resend.dev>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

// Best-effort: a failed email must never undo a saved request or a posted job.
// replyTo defaults to the owner's address, but a caller can override it.
async function send(to: string, subject: string, text: string, replyTo = REPLY_TO) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Resend reports most failures (bad key, unverified domain) by RETURNING an
    // error rather than throwing, so we have to look at the result ourselves.
    const { error } = await resend.emails.send({ from: FROM, to, subject, text, replyTo });
    if (error) console.error("Email send failed:", error);
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

export async function notifyNewRequest(r: {
  company_name: string;
  contact_name: string;
  contact_email: string;
  trade: string;
  site_location: string;
  description: string;
  imageCount: number;
}) {
  await send(
    process.env.FL_OWNER_EMAIL!,
    `New job request: ${r.company_name} (${r.trade})`,
    `${r.contact_name} from ${r.company_name} submitted a request.\n\nTrade: ${r.trade}\nSite: ${r.site_location}\nImages attached: ${r.imageCount}\n\n${r.description}`,
    r.contact_email // owner hits Reply and writes straight back to the hotel
  );
}

export async function notifyRequestReceived(to: string, name: string) {
  await send(
    to,
    "We received your job request",
    `Hi ${name},\n\nThanks for your request. FL Projects has received it and will review it shortly. You'll hear from us by email.`
  );
}

export async function notifyRequestApproved(to: string, name: string) {
  await send(
    to,
    "Your job request has been accepted",
    `Hi ${name},\n\nGood news: FL Projects has accepted your request and is now lining up tradesmen for it. We'll be in touch with next steps.`
  );
}

export async function notifyRequestDeclined(to: string, name: string) {
  await send(
    to,
    "Update on your job request",
    `Hi ${name},\n\nThank you for your request. Unfortunately FL Projects is unable to take this job on at this time. We appreciate you thinking of us.`
  );
}