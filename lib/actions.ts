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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
