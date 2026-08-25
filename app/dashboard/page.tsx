import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";

const badgeClass: Record<string, string> = {
  open: "badge-open",
  awarded: "badge-awarded",
  closed: "badge-closed",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, site, status, budget_range, created_at, bids(count)")
    .eq("client_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="label mb-2">Projects Marketplace</p>
          <h1 className="text-3xl font-semibold">Your jobs</h1>
        </div>
        <form action={signOut}>
          <button className="btn-secondary">Sign out</button>
        </form>
      </div>

      <Link href="/dashboard/jobs/new" className="btn-primary mb-8 inline-flex">
        Post a job
      </Link>

      {(!jobs || jobs.length === 0) && (
        <div className="card text-center text-ink/60">
          <p>No jobs posted yet. Post one to start collecting bids.</p>
        </div>
      )}

      <ul className="space-y-3">
        {jobs?.map((job: any) => (
          <li key={job.id}>
            <Link
              href={`/dashboard/jobs/${job.id}`}
              className="card flex items-center justify-between hover:border-ink"
            >
              <div>
                <p className="font-medium">{job.title}</p>
                <p className="text-sm text-ink/60">
                  {job.site ? `${job.site} · ` : ""}
                  {job.budget_range || "No budget set"} ·{" "}
                  {job.bids?.[0]?.count ?? 0} bid
                  {(job.bids?.[0]?.count ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
              <span className={`badge ${badgeClass[job.status]}`}>
                {job.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
