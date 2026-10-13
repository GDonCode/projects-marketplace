import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { declineRequest } from "../actions";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: r } = await supabase.from("job_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound(); // missing, invalid id, or not the owner

  // Private bucket: make links that expire after 1 hour (3600 seconds)
  const paths: string[] = r.image_paths ?? [];
  const { data: signed } = paths.length
    ? await supabase.storage.from("job-request-images").createSignedUrls(paths, 3600)
    : { data: [] };
  const imageUrls = (signed ?? [])
    .map((s) => s.signedUrl)
    // "u is string" is a promise to TypeScript: anything that passes this test is a string, not null
    .filter((u): u is string => !!u);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/dashboard/requests" className="text-sm text-ink/60">← All requests</Link>
      <h1 className="mb-1 mt-4 text-3xl font-semibold">{r.company_name}</h1>
      <p className="mb-8 text-sm uppercase text-ink/50">Status: {r.status}</p>

      <div className="card mb-6 space-y-2 text-sm">
        <p><span className="label">Contact</span> {r.contact_name}</p>
        <p>
          <span className="label">Email</span>{" "}
          <a href={`mailto:${r.contact_email}`} className="underline">{r.contact_email}</a>
        </p>
        {r.contact_phone && <p><span className="label">Phone</span> {r.contact_phone}</p>}
        <p><span className="label">Trade</span> {r.trade}</p>
        <p><span className="label">Site</span> {r.site_location}</p>
        {r.desired_timeline && <p><span className="label">Timeline</span> {r.desired_timeline}</p>}
      </div>

      <p className="label mb-2">Description</p>
      {/* whitespace-pre-wrap keeps the hotel's line breaks */}
      <p className="card mb-6 whitespace-pre-wrap text-sm">{r.description}</p>

      {imageUrls.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          {imageUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {/* Plain <img>: signed URLs change every load, so next/image caching adds nothing */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Attached by requester" className="aspect-square w-full rounded-md object-cover" />
            </a>
          ))}
        </div>
      )}

      {r.status === "new" && (
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/jobs/new?from=${r.id}`} className="btn-primary">Convert to job</Link>
          <form action={declineRequest}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="rounded-md px-4 py-2 text-sm text-danger">Decline</button>
          </form>
        </div>
      )}

      {r.status === "approved" && r.job_id && (
        <Link href={`/dashboard/jobs/${r.job_id}`} className="btn-primary">View the job</Link>
      )}
    </main>
  );
}