import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateJob } from "@/lib/actions";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, budget_range, timeline, status, client_id")
    .eq("id", id)
    .single();

  if (!job) notFound();
  if (job.client_id !== user!.id) notFound(); // not your job — don't leak it

  if (job.status !== "open") {
    // locked once no longer open — bounce back to the read-only detail view
    redirect(`/dashboard/jobs/${job.id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-12 pt-4">
      <Link
        href={`/dashboard/jobs/${job.id}`}
        className="label text-[1rem] mb-6 inline-flex items-center gap-1 hover:underline"
      >
        ← Back
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">Edit job</h1>

      <form action={updateJob} className="card space-y-4">
        <input type="hidden" name="job_id" value={job.id} />

        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            type="text"
            name="title"
            defaultValue={job.title}
            required
            className="w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            name="description"
            defaultValue={job.description ?? ""}
            rows={5}
            className="w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Budget range</label>
          <input
            type="text"
            name="budget_range"
            defaultValue={job.budget_range ?? ""}
            className="w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Timeline</label>
          <input
            type="text"
            name="timeline"
            defaultValue={job.timeline ?? ""}
            className="w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary">
            Save changes
          </button>
          <Link href={`/dashboard/jobs/${job.id}`} className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}