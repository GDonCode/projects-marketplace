import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const badge: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  approved: "bg-good/10 text-good",
  declined: "bg-danger/10 text-danger",
};

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("job_requests")
    .select("id, company_name, trade, site_location, status, created_at")
    .order("created_at", { ascending: false });

  // Show requests needing attention first
  const sorted = [...(requests ?? [])].sort(
    (a, b) => Number(b.status === "new") - Number(a.status === "new")
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="label mb-2">Projects Marketplace</p>
      <h1 className="mb-8 text-3xl font-semibold">Job requests</h1>

      {sorted.length === 0 && <p className="text-sm text-ink/60">No requests yet.</p>}

      <div className="space-y-3">
        {sorted.map((r) => (
          <Link key={r.id} href={`/dashboard/requests/${r.id}`} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">{r.company_name}</p>
              <p className="text-sm text-ink/60">
                {r.trade} · {r.site_location} · {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium uppercase ${badge[r.status]}`}>
              {r.status}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}