import { Resend } from "resend";
import { formatWeeklyRate } from "@/lib/format";

const resend = new Resend(process.env.RESEND_API_KEY);

// Until a domain is verified in Resend, only onboarding@resend.dev works,
// and it only delivers to the email on your own Resend account.
const FROM = process.env.EMAIL_FROM || "Projects Marketplace <onboarding@resend.dev>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Recipient = { name: string; contact_email: string | null };
type Email = { to: string; subject: string; html: string };

// Titles, names and notes are typed by users. Escaping turns characters like < and >
// into harmless text, so "<b>Pool</b>" displays literally instead of acting as HTML.
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, body: string, linkPath: string, linkLabel: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <p style="font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #666;">Projects Marketplace</p>
      <h1 style="font-size: 20px;">${heading}</h1>
      ${body}
      <p><a href="${SITE}${linkPath}" style="display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">${linkLabel}</a></p>
    </div>`;
}

// Sends every email in one request and never throws. A failed email gets logged,
// but it must not undo a job post, bid, or award that already saved.
async function sendAll(emails: Email[]) {
  const valid = emails.filter((e) => e.to);
  if (valid.length === 0) return;
  try {
    const { error } = await resend.batch.send(valid.map((e) => ({ from: FROM, ...e })));
    if (error) console.error("Email send failed:", error);
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

export async function notifyInvited(jobId: string, jobTitle: string, recipients: Recipient[]) {
  await sendAll(
    recipients.map((r) => ({
      to: r.contact_email ?? "",
      subject: `You're invited to bid: ${jobTitle}`,
      html: layout(
        `New job: ${esc(jobTitle)}`,
        `<p>Hi ${esc(r.name)}, FL Projects has invited you to bid on this job.</p>`,
        `/portal/jobs/${jobId}`,
        "View job & bid"
      ),
    }))
  );
}

export async function notifyCancelled(jobTitle: string, recipients: Recipient[]) {
  await sendAll(
    recipients.map((r) => ({
      to: r.contact_email ?? "",
      subject: `Job cancelled: ${jobTitle}`,
      html: layout(
        `Job cancelled: ${esc(jobTitle)}`,
        `<p>Hi ${esc(r.name)}, FL Projects has cancelled this job, so it's no longer taking bids. No action is needed from you.</p>`,
        `/portal`,
        "View your jobs"
      ),
    }))
  );
}

export async function notifyNewBid(opts: {
  to: string;
  jobId: string;
  jobTitle: string;
  tradesmanName: string;
  amount: number;
  isUpdate: boolean;
}) {
  const verb = opts.isUpdate ? "updated their bid" : "placed a bid";
  await sendAll([
    {
      to: opts.to,
      subject: `${opts.tradesmanName} ${verb} on ${opts.jobTitle}`,
      html: layout(
        esc(opts.jobTitle),
        `<p>${esc(opts.tradesmanName)} ${verb}: <strong>${formatWeeklyRate(opts.amount)}</strong>.</p>`,
        `/dashboard/jobs/${opts.jobId}`,
        "Review bids"
      ),
    },
  ]);
}

export async function notifyBidResults(
  jobId: string,
  jobTitle: string,
  winner: Recipient | null,
  others: Recipient[]
) {
  const emails: Email[] = others.map((r) => ({
    to: r.contact_email ?? "",
    subject: `Update on ${jobTitle}`,
    html: layout(
      esc(jobTitle),
      `<p>Hi ${esc(r.name)}, thanks for bidding. This job has been awarded to another tradesman. We'll keep you in mind for future work.</p>`,
      `/portal`,
      "View your jobs"
    ),
  }));

  if (winner) {
    emails.push({
      to: winner.contact_email ?? "",
      subject: `Your bid was accepted: ${jobTitle}`,
      html: layout(
        `You got the job: ${esc(jobTitle)}`,
        `<p>Hi ${esc(winner.name)}, FL Projects accepted your bid. They'll be in touch with next steps.</p>`,
        `/portal/jobs/${jobId}`,
        "View job"
      ),
    });
  }

  await sendAll(emails);
}