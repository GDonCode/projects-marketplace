"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError("That email and password don't match an account.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.push(profile?.role === "client" ? "/dashboard" : "/portal");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-12 flex justify-center items-center">
          <Image src="/FL_LOGO.png" alt="Logo of FL Logistics LLC" width={200} height={200} />
        </div>

        <h1 className="text-3xl font-semibold mb-4">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                className="field pr-16" // extra right padding so typed text doesn't slide under the button
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button" // stops this button from submitting the form (buttons inside a <form> default to "submit")
                onClick={() => setShowPassword((prev) => !prev)} // flip to the opposite of the current value
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword} // tells screen readers this is an on/off toggle
                className="absolute inset-y-0 right-0 px-3 text-xs font-semibold"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-signal">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full text-md font-semibold">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
