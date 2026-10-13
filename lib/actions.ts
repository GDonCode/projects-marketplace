"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyInvited, notifyNewBid, notifyBidResults, notifyCancelled } from "@/lib/email";
import { notifyRequestApproved } from "@/lib/request-emails";

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
  const requestId = String(formData.get("request_id") || ""); // set when converting a hotel request
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
    // Posted from a hotel request? Claim it, copy its photos into this job, and email the hotel.
  if (requestId) {
    // Claiming first (status 'new' -> 'approved') means only one run can win,
    // so photos aren't copied and the hotel isn't emailed twice.
    const { data: claimed } = await supabase
      .from("job_requests")
      .update({ status: "approved", job_id: job.id })
      .eq("id", requestId)
      .eq("status", "new")
      .select("contact_name, contact_email, image_paths")
      .maybeSingle();

    if (claimed) {
      const copied: string[] = [];

      for (const srcPath of (claimed.image_paths ?? []) as string[]) {
        // Owner can read the private bucket (RLS), so this runs with the normal client
        const { data: blob } = await supabase.storage.from("job-request-images").download(srcPath);
        if (!blob) continue;

        const ext = srcPath.split(".").pop() ?? "jpg";
        // job.id-prefixed, same as manual uploads, so the job-photos RLS accepts it
        const destPath = `${job.id}/${crypto.randomUUID()}.${ext}`;
        const { error: copyError } = await supabase.storage
          .from("job-photos")
          .upload(destPath, blob, { contentType: blob.type });

        if (!copyError) {
          copied.push(supabase.storage.from("job-photos").getPublicUrl(destPath).data.publicUrl);
        }
      }

      if (copied.length > 0) {
        // Append to whatever photos were just uploaded by hand
        const { data: current } = await supabase
          .from("jobs")
          .select("photo_urls")
          .eq("id", job.id)
          .single();
        await supabase
          .from("jobs")
          .update({ photo_urls: [...(current?.photo_urls ?? []), ...copied] })
          .eq("id", job.id);
      }

      await notifyRequestApproved(claimed.contact_email, claimed.contact_name);
    }
  }
  if (tradesmanIds.length > 0) {
    await supabase
      .from("job_invites")
      .insert(tradesmanIds.map((tradesman_id) => ({ job_id: job.id, tradesman_id })));

    const { data: invited } = await supabase
      .from("tradesmen")
      .select("name, contact_email")
      .in("id", tradesmanIds);

    await notifyInvited(job.id, job.title, invited ?? []);
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

  // Checked before saving so the owner's email can say "new bid" vs "updated bid".
  const { data: existingBid } = await supabase
    .from("bids")
    .select("id")
    .eq("job_id", job_id)
    .eq("tradesman_id", profile.tradesman_id)
    .maybeSingle();

  const { error } = await supabase
    .from("bids")
    .upsert(
      { job_id, tradesman_id: profile.tradesman_id, amount, notes, status: "pending" },
      { onConflict: "job_id,tradesman_id" }
    );

  if (error) throw new Error(error.message);

  const [{ data: job }, { data: tradesman }] = await Promise.all([
    supabase.from("jobs").select("title, client_id").eq("id", job_id).single(),
    supabase.from("tradesmen").select("name").eq("id", profile.tradesman_id).single(),
  ]);

  if (job) {
    // The owner's email lives in Supabase Auth, which only the admin client can read.
    const { data: owner } = await createAdminClient().auth.admin.getUserById(job.client_id);
    if (owner.user?.email) {
      await notifyNewBid({
        to: owner.user.email,
        jobId: job_id,
        jobTitle: job.title,
        tradesmanName: tradesman?.name ?? "A tradesman",
        amount,
        isUpdate: !!existingBid, // !! turns "a bid row or null" into true/false
      });
    }
  }

  revalidatePath(`/portal/jobs/${job_id}`);
}

export async function acceptBid(formData: FormData) {
  const supabase = await createClient();
  const job_id = String(formData.get("job_id"));
  const bid_id = String(formData.get("bid_id"));

  await supabase.from("bids").update({ status: "rejected" }).eq("job_id", job_id);
  await supabase.from("bids").update({ status: "accepted" }).eq("id", bid_id);
  await supabase.from("jobs").update({ status: "awarded" }).eq("id", job_id);

  const [{ data: job }, { data: bids }] = await Promise.all([
    supabase.from("jobs").select("title").eq("id", job_id).single(),
    // tradesmen(...) follows bids.tradesman_id to pull each bidder's name and email in the same query
    supabase.from("bids").select("id, tradesmen(name, contact_email)").eq("job_id", job_id),
  ]);

  if (job && bids) {
    // Without generated DB types, Supabase can't tell each bid has exactly one tradesman,
    // so it types the join as an array. This unwraps either shape into one record (or null).
    const one = (t: unknown) =>
      (Array.isArray(t) ? t[0] ?? null : t) as { name: string; contact_email: string | null } | null;

    const winner = one(bids.find((b) => b.id === bid_id)?.tradesmen ?? null);
    const others = bids
      .filter((b) => b.id !== bid_id)
      .flatMap((b) => {
        const t = one(b.tradesmen);
        return t ? [t] : []; // skips any bid whose tradesman was deleted
      });
    await notifyBidResults(job_id, job.title, winner, others);
  }

  revalidatePath(`/dashboard/jobs/${job_id}`);

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
    // With ignoreDuplicates, .select() returns only rows actually inserted,
    // so tradesmen who were already invited aren't emailed a second time.
    const { data: added, error } = await supabase
      .from("job_invites")
      .upsert(
        tradesmanIds.map((tradesman_id) => ({ job_id, tradesman_id })),
        { onConflict: "job_id,tradesman_id", ignoreDuplicates: true }
      )
      .select("tradesman_id");
    if (error) throw new Error(error.message);

    const newIds = (added ?? []).map((row) => row.tradesman_id);
    if (newIds.length > 0) {
      const [{ data: job }, { data: invited }] = await Promise.all([
        supabase.from("jobs").select("title").eq("id", job_id).single(),
        supabase.from("tradesmen").select("name, contact_email").in("id", newIds),
      ]);
      if (job) await notifyInvited(job_id, job.title, invited ?? []);
    }
  }

  revalidatePath(`/dashboard/jobs/${job_id}`);
}

export async function cancelJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const job_id = String(formData.get("job_id"));

  // .eq("status", "open") means only an open job can flip to closed, so a double-click
  // or a stale tab can't cancel a job that's already been awarded.
  const { data: job, error } = await supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("id", job_id)
    .eq("client_id", user.id)
    .eq("status", "open")
    .select("title")
    .maybeSingle();

  if (error) throw new Error(error.message);

  // job is null when nothing changed (already closed or awarded), so no emails go out twice.
  if (job) {
    const { data: invites } = await supabase
      .from("job_invites")
      .select("tradesmen(name, contact_email)")
      .eq("job_id", job_id);

    const recipients = (invites ?? []).flatMap((i) => {
      // Same array-vs-object unwrapping as acceptBid: Supabase types the join as an array.
      const t = Array.isArray(i.tradesmen) ? i.tradesmen[0] : i.tradesmen;
      return t ? [t as { name: string; contact_email: string | null }] : [];
    });

    await notifyCancelled(job.title, recipients);
  }

  revalidatePath(`/dashboard/jobs/${job_id}`);
  revalidatePath("/dashboard");
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


export async function generateInviteToken() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("invite_tokens")
    .insert({ created_by: user.id })
    .select("token")
    .single();

  if (error || !invite) throw new Error(error?.message || "Could not create invite link");

  revalidatePath("/dashboard");
  redirect(`/dashboard?invited=${invite.token}`);
}

export async function joinAsTradesman(formData: FormData) {
  const token = String(formData.get("token") || "");
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invite_tokens")
    .select("token, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) throw new Error("That invite link isn't valid.");
  if (invite.used_at) throw new Error("That invite link has already been used.");
  if (new Date(invite.expires_at) < new Date()) throw new Error("That invite link has expired.");

  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const trades = formData.getAll("trades") as string[];

  if (!name || !email || !password || trades.length === 0) {
    throw new Error("Name, email, password, and at least one trade are required.");
  }

  // The invite token already proves this person was sent the link by the owner,
  // so the account is created pre-confirmed and no confirmation email is sent.
  // (Variable names kept as signUpData/signUpError so the profile insert below still works.)
  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // marks the email as verified, so Supabase skips the confirmation email
  });

  if (signUpError || !signUpData.user) {
    throw new Error(signUpError?.message || "Could not create account");
  }

  const { data: tradesman, error: tradesmanError } = await admin
    .from("tradesmen")
    .insert({ name, trades, contact_email: email })
    .select()
    .single();

  if (tradesmanError || !tradesman) {
    throw new Error(tradesmanError?.message || "Could not create tradesman record");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: signUpData.user.id,
    role: "company",
    tradesman_id: tradesman.id,
    full_name: name,
  });

  if (profileError) throw new Error(profileError.message);

  // Burn the token now that account creation fully succeeded — it can't be replayed.
  await admin.from("invite_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);

  // Regular (non-admin) client so the login cookie is set in this tradesman's browser.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/login"); // account exists either way; they can sign in manually

  redirect("/portal");
}


const MAX_JOB_PHOTOS = 10;

export async function updateJob(formData: FormData) {
  const jobId = formData.get("job_id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const budget_range = formData.get("budget_range") as string;
  const timeline = formData.get("timeline") as string;
  // null means "this form has no site field", so we leave the site alone
  const siteRaw = formData.get("site");
  const removeUrls = formData.getAll("remove_photos") as string[];
  const newPhotos = (formData.getAll("photos") as File[]).filter((f) => f.size > 0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // .eq("client_id", user.id) stops a client from editing a job that isn't theirs
  const { data: job } = await supabase
    .from("jobs")
    .select("photo_urls")
    .eq("id", jobId)
    .eq("client_id", user.id)
    .single();
  if (!job) throw new Error("Job not found");

  const current: string[] = job.photo_urls ?? [];
  // Only honor removals of URLs that really belong to this job
  const toRemove = current.filter((u) => removeUrls.includes(u));
  const kept = current.filter((u) => !toRemove.includes(u));

  if (kept.length + newPhotos.length > MAX_JOB_PHOTOS) {
    throw new Error(`A job can have at most ${MAX_JOB_PHOTOS} photos.`);
  }

  // Public URL -> storage path: everything after "/job-photos/"
  const pathOf = (url: string) => decodeURIComponent(url.split("/job-photos/")[1] ?? "");
  const removePaths = toRemove.map(pathOf).filter(Boolean);
  if (removePaths.length > 0) {
    await supabase.storage.from("job-photos").remove(removePaths);
  }

  const added: string[] = [];
  for (const photo of newPhotos) {
    // job id first, so the job-photos RLS can check "is this job mine"
    const safeName = photo.name.replace(/[^\w.\-]/g, "_"); // strips spaces and odd characters
    const path = `${jobId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, photo);
    if (!uploadError) {
      added.push(supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl);
    }
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      description,
      budget_range,
      timeline,
      ...(siteRaw !== null && { site: String(siteRaw) }), // only include when the form sent it
      photo_urls: [...kept, ...added],
    })
    .eq("id", jobId)
    .eq("client_id", user.id);

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }

  revalidatePath(`/dashboard/jobs/${jobId}`);
  redirect(`/dashboard/jobs/${jobId}`);
}