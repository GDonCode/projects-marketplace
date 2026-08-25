import { createClient } from "@/lib/supabase/server";
import { submitBid } from "@/lib/actions";
import { notFound } from "next/navigation";

export default async function CompanyJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tradesman_id")
    .eq("id", user!.id)
    .single();

  const { data: myBid } = await supabase
    .from("bids")
    .select("*")
    .eq("job_id", id)
    .eq("tradesman_id", profile?.tradesman_id)
    .maybeSingle();

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

      <h2 className="mb-3 text-xl font-semibold">Your bid</h2>

      {myBid && (
        <div className="card mb-6">
          <p className="mb-1 text-lg font-semibold">${myBid.amount}</p>
          {myBid.notes && <p className="text-sm text-ink/70">{myBid.notes}</p>}
          <span className={`badge badge-${myBid.status === "accepted" ? "awarded" : myBid.status === "rejected" ? "closed" : "open"} mt-2`}>
            {myBid.status}
          </span>
        </div>
      )}

      {job.status === "open" && (
        <form action={submitBid} className="card space-y-4">
          <input type="hidden" name="job_id" value={job.id} />
          <div>
            <label className="label" htmlFor="amount">
              {myBid ? "Update your bid amount" : "Your bid amount"}
            </label>
            <input id="amount" name="amount" type="number" step="0.01" required className="field" defaultValue={myBid?.amount ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} className="field" defaultValue={myBid?.notes ?? ""} placeholder="Crew size, timing, anything the client should know." />
          </div>
          <button type="submit" className="btn-primary">
            {myBid ? "Update bid" : "Submit bid"}
          </button>
        </form>
      )}

      {job.status !== "open" && !myBid && (
        <p className="text-sm text-ink/60">This job is no longer open for bids.</p>
      )}
    </main>
  );
}
