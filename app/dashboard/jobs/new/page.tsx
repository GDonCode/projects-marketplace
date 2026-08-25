import { createClient } from "@/lib/supabase/server";
import { createJob } from "@/lib/actions";

export default async function NewJobPage() {
  const supabase = await createClient();
  const { data: tradesmen } = await supabase
    .from("tradesmen")
    .select("id, name, trade")
    .order("trade")
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="label mb-2">Projects Marketplace</p>
      <h1 className="mb-8 text-3xl font-semibold">Post a job</h1>

      <form action={createJob} className="space-y-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="field" placeholder="e.g. Pool deck retiling — 2nd floor" />
        </div>

        <div>
          <label className="label" htmlFor="site">Hotel / site</label>
          <input id="site" name="site" className="field" placeholder="e.g. Round Hill Hotel" />
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={5} className="field" placeholder="What needs doing, where on the property, and any specifics tradesmen should know before bidding." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="budget_range">Budget range</label>
            <input id="budget_range" name="budget_range" className="field" placeholder="e.g. $800,000–1,200,000" />
          </div>
          <div>
            <label className="label" htmlFor="timeline">Timeline</label>
            <input id="timeline" name="timeline" className="field" placeholder="e.g. Within 2 weeks" />
          </div>
        </div>

        <div>
          <p className="label mb-2">Invite tradesmen to bid</p>
          <div className="card space-y-2">
            {(!tradesmen || tradesmen.length === 0) && (
              <p className="text-sm text-ink/60">
                No tradesmen on file yet — add them in Supabase first.
              </p>
            )}
            {tradesmen?.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tradesmen" value={t.id} className="accent-signal" />
                <span>{t.name}</span>
                {t.trade && <span className="text-ink/50">— {t.trade}</span>}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">Post job</button>
      </form>
    </main>
  );
}
