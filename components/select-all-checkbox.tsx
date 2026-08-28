"use client";

export function SelectAllCheckbox() {
  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    document
      .querySelectorAll<HTMLInputElement>('input[name="job_ids"]')
      .forEach((cb) => {
        cb.checked = checked;
      });
  }

  return (
    <input
      type="checkbox"
      onChange={toggleAll}
      aria-label="Select all jobs"
    />
  );
}
