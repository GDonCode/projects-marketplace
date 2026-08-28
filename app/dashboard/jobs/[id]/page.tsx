import { createClient } from "@/lib/supabase/server";
import { acceptBid, addInvites } from "@/lib/actions";
import { notFound } from "next/navigation";
import { formatWeeklyRate } from "@/lib/format";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const { data: bids } = await supabase
    .from("bids")
    .select("id, amount, notes, status, created_at, tradesmen(name)")
    .eq("job_id", id)
    .order("amount", { ascending: true });

  const { data: invites } = await supabase
    .from("job_invites")
    .select("tradesman_id")
    .eq("job_id", id);

  const invitedIds = new Set((invites ?? []).map((i: any) => i.tradesman_id));

  const { data: allTradesmen } = await supabase
    .from("tradesmen")
    .select("id, name, trade")
    .order("trade")
    .order("name");

  const uninvited = (allTradesmen ?? []).filter((t) => !invitedIds.has(t.id));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="label mb-2">Job</p>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{job.title}</h1>
        <span className={`badge badge-${job.status}`}>{job.status}</span>
      </div>
      {job.site && <p className="mb-1 text-sm font-medium text-steeldark">{job.site}</p>}
      <p className="mb-8 text-sm text-ink/60">
        {job.budget_range} · {job.timeline}
      </p>

      {job.description && (
        <p className="card mb-8 whitespace-pre-wrap text-sm">{job.description}</p>
      )}

      <h2 className="mb-3 text-xl font-semibold">Bids</h2>

      {(!bids || bids.length === 0) && (
        <div className="card text-center text-ink/60">
          No bids yet.
        </div>
      )}

      <ul className="mb-8 space-y-3">
        {bids?.map((bid: any) => (
          <li key={bid.id} className="card">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{bid.tradesmen?.name}</p>
              <span className={`badge badge-${bid.status === "accepted" ? "awarded" : bid.status === "rejected" ? "closed" : "open"}`}>
                {bid.status}
              </span>
            </div>
            {bid.amount != null && (
              <p className="mb-1 text-lg font-semibold">{formatWeeklyRate(bid.amount)}</p>
            )}
            {bid.notes && <p className="mb-3 text-sm text-ink/70">{bid.notes}</p>}
            {job.status === "open" && bid.status === "pending" && (
              <form action={acceptBid}>
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="bid_id" value={bid.id} />
                <button type="submit" className="btn-primary">
                  Accept this bid
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {job.status === "open" && (
        <>
          <h2 className="mb-3 text-xl font-semibold">Invite more tradesmen</h2>
          {uninvited.length === 0 ? (
            <p className="text-sm text-ink/60">
              Everyone on file is already invited to this job.
            </p>
          ) : (
            <form action={addInvites} className="card space-y-3">
              <input type="hidden" name="job_id" value={job.id} />
              {uninvited.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="tradesmen" value={t.id} className="accent-signal" />
                  <span>{t.name}</span>
                  {t.trade && <span className="text-ink/50">— {t.trade}</span>}
                </label>
              ))}
              <button type="submit" className="btn-primary">
                Send invites
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
