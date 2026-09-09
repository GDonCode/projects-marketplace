"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const site = String(formData.get("site") || "");
  const budget_range = String(formData.get("budget_range") || "");
  const timeline = String(formData.get("timeline") || "");
  const tradesmanIds = formData.getAll("tradesmen") as string[];

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ client_id: user.id, title, description, site, budget_range, timeline })
    .select()
    .single();

  if (error || !job) {
    throw new Error(error?.message || "Could not create job");
  }

  // ... existing code above ...
  // Browsers still submit an empty File object when nothing was picked —
  // size 0 is how we tell "no photo" apart from "a real photo."
  const photos = (formData.getAll("photos") as File[]).filter((f) => f.size > 0);

  if (photos.length > 0) {
    const uploadedUrls: string[] = [];

    for (const photo of photos) {
      // job.id-prefixed path so Storage RLS can check "does this job belong to me"
      // by reading the first folder segment — see the migration in Edit 4.
      const path = `${job.id}/${crypto.randomUUID()}-${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(path, photo);

      if (!uploadError) {
        const { data } = supabase.storage.from("job-photos").getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      await supabase.from("jobs").update({ photo_urls: uploadedUrls }).eq("id", job.id);
    }
  }

  if (tradesmanIds.length > 0) {
    await supabase
      .from("job_invites")
      .insert(tradesmanIds.map((tradesman_id) => ({ job_id: job.id, tradesman_id })));
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/jobs/${job.id}`);
}

export async function submitBid(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const job_id = String(formData.get("job_id"));
  const amount = Number(formData.get("amount"));
  const notes = String(formData.get("notes") || "");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tradesman_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tradesman_id) throw new Error("No tradesman record on this account");

  const { error } = await supabase
    .from("bids")
    .upsert(
      { job_id, tradesman_id: profile.tradesman_id, amount, notes, status: "pending" },
      { onConflict: "job_id,tradesman_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath(`/portal/jobs/${job_id}`);
}

export async function acceptBid(formData: FormData) {
  const supabase = await createClient();
  const job_id = String(formData.get("job_id"));
  const bid_id = String(formData.get("bid_id"));

  await supabase.from("bids").update({ status: "rejected" }).eq("job_id", job_id);
  await supabase.from("bids").update({ status: "accepted" }).eq("id", bid_id);
  await supabase.from("jobs").update({ status: "awarded" }).eq("id", job_id);

  revalidatePath(`/dashboard/jobs/${job_id}`);
}

export async function addInvites(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const job_id = String(formData.get("job_id"));
  const tradesmanIds = formData.getAll("tradesmen") as string[];

  if (tradesmanIds.length > 0) {
    const { error } = await supabase
      .from("job_invites")
      .upsert(
        tradesmanIds.map((tradesman_id) => ({ job_id, tradesman_id })),
        { onConflict: "job_id,tradesman_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/jobs/${job_id}`);
}

export async function deleteJobs(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jobIds = formData.getAll("job_ids") as string[];
  if (jobIds.length === 0) return;

  // .eq("client_id", ...) is belt-and-suspenders — RLS already blocks
  // deleting jobs that aren't yours, this just avoids a wasted round trip.
  const { error } = await supabase
    .from("jobs")
    .delete()
    .in("id", jobIds)
    .eq("client_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
