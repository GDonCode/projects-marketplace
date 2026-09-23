import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tradesman_id, tradesmen(name)")
    .eq("id", user!.id)
    .single();

  const { data: invites } = await supabase
    .from("job_invites")
    .select("jobs(id, title, site, status, budget_range, timeline, created_at)")
    .eq("tradesman_id", profile?.tradesman_id);
  
  const { data: myBids } = await supabase
    .from("bids")
    .select("job_id, status")
    .eq("tradesman_id", profile?.tradesman_id);

  // A Set is a quick "is this in the list?" lookup, holding the job ids this tradesman won.
  const wonJobIds = new Set(
    (myBids ?? []).filter((b) => b.status === "accepted").map((b) => b.job_id)
  );

  // An awarded job only reads "awarded" to the tradesman who won it; everyone else sees "closed".
  const statusFor = (job: { id: string; status: string }) =>
    job.status === "awarded" && !wonJobIds.has(job.id) ? "closed" : job.status;
 
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="label mb-2">{(profile as any)?.tradesmen?.name || "Projects Marketplace"}</p>
          <h1 className="text-3xl font-semibold">Jobs open to you</h1>
        </div>
        <form action={signOut}>
          <button className="btn-secondary">Sign out</button>
        </form>
      </div>

      {(!invites || invites.length === 0) && (
        <div className="card text-center text-ink/60">
          No jobs have been sent your way yet.
        </div>
      )}

      <ul className="space-y-3">
        {invites?.map((inv: any) => (
          <li key={inv.jobs.id}>
            <Link
              href={`/portal/jobs/${inv.jobs.id}`}
              className="card flex items-center justify-between hover:border-ink"
            >
              <div>
                <p className="font-medium">{inv.jobs.title}</p>
                <p className="text-sm text-ink/60">
                  {inv.jobs.site ? `${inv.jobs.site} · ` : ""}
                  {inv.jobs.budget_range || "No budget set"} · {inv.jobs.timeline}
                </p>
              </div>
              <span className={`badge badge-${statusFor(inv.jobs)}`}>{statusFor(inv.jobs)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
