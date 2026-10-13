import { createClient } from "@/lib/supabase/server";
import { createJob } from "@/lib/actions";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createClient();
  const { data: tradesmen } = await supabase
  .from("tradesmen")
  .select("id, name, trades")
  .order("name");

  const { from } = await searchParams;
  // Arrived from the requests inbox? Load that request to prefill the form.
  // RLS means only the FL owner can read it; anyone else just gets an empty form.
  const { data: fromRequest } = from
    ? await supabase
        .from("job_requests")
        .select("id, company_name, trade, site_location, description, desired_timeline, image_paths")
        .eq("id", from)
        .eq("status", "new")
        .maybeSingle()
    : { data: null };

  // undefined = leave the field blank. Contact details are deliberately NOT copied:
  // tradesmen shouldn't see the hotel's email/phone.
  const prefill = {
    title: fromRequest ? `${fromRequest.trade} — ${fromRequest.site_location}` : undefined,
    site: fromRequest?.company_name,
    description: fromRequest?.description,
    timeline: fromRequest?.desired_timeline ?? undefined,
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="label mb-2">Projects Marketplace</p>
      <h1 className="mb-8 text-3xl font-semibold">Post a job</h1>

      <form action={createJob} className="space-y-5">
        {/* Tells createJob which request this job came from */}
        {fromRequest && <input type="hidden" name="request_id" value={fromRequest.id} />}
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={prefill.title} required className="field" placeholder="e.g. Pool deck retiling — 2nd floor" />
        </div>

        <div>
          <label className="label" htmlFor="site">Hotel / site</label>
          <input id="site" name="site" defaultValue={prefill.site} className="field" placeholder="e.g. Round Hill Hotel" />
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={prefill.description} rows={5} className="field" placeholder="What needs doing, where on the property, and any specifics tradesmen should know before bidding." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="budget_range">Budget range</label>
            <input id="budget_range" name="budget_range" className="field" placeholder="e.g. $800,000–1,200,000" />
          </div>
          <div>
            <label className="label" htmlFor="timeline">Timeline</label>
            <input id="timeline" name="timeline" defaultValue={prefill.timeline} className="field" placeholder="e.g. Within 2 weeks" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="photos">Photos</label>
          <input
            id="photos"
            name="photos"
            type="file"
            accept="image/*"
            multiple
            className="field"
          />
          <p className="mt-1 text-xs text-ink/50">
            Optional — add photos of the work area to help tradesmen bid accurately.
          </p>
          {fromRequest && (fromRequest.image_paths?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-ink/70">
              {fromRequest.image_paths.length} photo(s) from the hotel's request will be attached automatically.
            </p>
          )}
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
                <input type="checkbox" name="tradesmen" value={t.id} />
                <span>{t.name}</span>
                {t.trades?.length > 0 && (
                  <span className="text-ink/50">— {t.trades.join(", ")}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">Post job</button>
      </form>
    </main>
  );
}
