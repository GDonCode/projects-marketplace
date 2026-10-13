"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyRequestDeclined } from "@/lib/request-emails";

export async function declineRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  // .eq("status","new") means a double-click can't decline (or email) twice.
  // RLS blocks non-owners, so for them zero rows update.
  const { data: updated } = await supabase
    .from("job_requests")
    .update({ status: "declined" })
    .eq("id", id)
    .eq("status", "new")
    .select("contact_name, contact_email")
    .maybeSingle();

  if (updated) await notifyRequestDeclined(updated.contact_email, updated.contact_name);

  revalidatePath("/dashboard/requests");
  redirect("/dashboard/requests");
}