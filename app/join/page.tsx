"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { joinAsTradesman } from "@/lib/actions";

const TRADE_OPTIONS = ["Electrical", "Plumbing", "Masonry", "Painting", "HVAC", "Carpentry"];

// Simple point-per-signal scorer: length, and three character classes.
// 0-1 = weak, 2 = fair, 3 = good, 4 = strong. Not a security guarantee —
// just enough feedback to nudge someone off "password1".
function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-danger", "bg-danger", "bg-amber-500", "bg-blue-500", "bg-good"];
  return { score, label: labels[score], color: colors[score] };
}

export default function JoinPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const strength = getPasswordStrength(password);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-3xl font-semibold">Create your account</h1>
        <p className="mb-8 text-sm text-ink/60">
          You've been invited to bid on jobs through Projects Marketplace.
        </p>

        <form action={joinAsTradesman} className="space-y-4">
          {/* Carried from the URL so the server action can check it — the tradesman never has to type it in. */}
          <input type="hidden" name="token" value={token} />

          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" name="name" required className="field" />
          </div>

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="field" />
          </div>

                    <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                className="field pr-16"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 text-sm text-ink/50 hover:text-ink"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {/* four segments lighting up left-to-right as the score climbs — same idea as a phone signal bar */}
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded ${i < strength.score ? strength.color : "bg-ink/10"}`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink/50">{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <p className="label mb-2">Your trade(s)</p>
            <div className="card space-y-2">
              {TRADE_OPTIONS.map((trade) => (
                <label key={trade} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="trades" value={trade} />
                  <span>{trade}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">Create account</button>
        </form>
      </div>
    </main>
  );
}