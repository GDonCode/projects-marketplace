"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyNewRequest, notifyRequestReceived } from "@/lib/request-emails";

export type RequestState = { ok: boolean; error?: string };

const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
// Allowed types mapped to an extension WE choose; the uploaded filename is never trusted.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function submitJobRequest(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  // Honeypot: humans never see this field, bots fill it in. Pretend success, drop it.
  if (formData.get("website")) return { ok: true };

  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const row = {
    company_name: get("company_name"),
    contact_name: get("contact_name"),
    contact_email: get("contact_email"),
    contact_phone: get("contact_phone") || null,
    trade: get("trade"),
    site_location: get("site_location"),
    description: get("description"),
    desired_timeline: get("desired_timeline") || null,
  };

  if (!row.company_name || !row.contact_name || !row.trade || !row.site_location || !row.description) {
    return { ok: false, error: "Please fill in all required fields." };
  }
  // Basic shape check: something@something.something
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact_email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // Browsers send one empty "file" when nothing was chosen, so keep only size > 0
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length > MAX_IMAGES) {
    return { ok: false, error: `Please attach at most ${MAX_IMAGES} images.` };
  }
  for (const f of files) {
    if (!(f.type in EXT)) return { ok: false, error: "Images must be JPEG, PNG, or WebP." };
    if (f.size > MAX_BYTES) return { ok: false, error: "Each image must be 5 MB or smaller." };
  }

  const supabase = await createClient();

  // Make the ID up front so the photo folder name matches the database row
  const requestId = crypto.randomUUID();
  const image_paths: string[] = [];

  for (const f of files) {
    const path = `${requestId}/${crypto.randomUUID()}.${EXT[f.type]}`;
    const { error: uploadError } = await supabase.storage
      .from("job-request-images")
      .upload(path, f, { contentType: f.type, upsert: false });
    if (uploadError) return { ok: false, error: "Image upload failed. Please try again." };
    image_paths.push(path);
  }

  // No .select() on purpose: anonymous visitors may insert but not read.
  const { error } = await supabase
    .from("job_requests")
    .insert({ id: requestId, ...row, image_paths });
  if (error) return { ok: false, error: "Something went wrong. Please try again." };

  await Promise.all([
    notifyNewRequest({ ...row, imageCount: files.length }),
    notifyRequestReceived(row.contact_email, row.contact_name),
  ]);

  return { ok: true };
}