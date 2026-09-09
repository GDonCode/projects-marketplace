"use client";

import { useState } from "react";

export function JobPhotoGallery({
  photoUrls,
  jobTitle,
}: {
  photoUrls: string[];
  jobTitle: string;
}) {
  const [selected, setSelected] = useState(0); // index of the photo shown large

  if (!photoUrls || photoUrls.length === 0) return null;

  return (
    <div className="mb-8">
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL */}
      <img
        src={photoUrls[selected]}
        alt={`${jobTitle} photo ${selected + 1}`}
        className="mb-2 aspect-video w-full rounded-lg object-cover"
      />

      {photoUrls.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {photoUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setSelected(i)}
              // Selected thumbnail gets a visible border ring; unselected ones stay flush
              className={`aspect-square overflow-hidden rounded-md border-2 ${
                i === selected ? "border-ink" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL */}
              <img
                src={url}
                alt={`${jobTitle} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}