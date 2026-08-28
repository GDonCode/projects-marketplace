"use client";

export function ConfirmDeleteButton() {
  return (
    <button
      type="submit"
      className="btn-secondary border-signal text-signal hover:border-signal"
      onClick={(e) => {
        if (
          !confirm(
            "Delete the selected job(s)? This also removes their invites and bids, and can't be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      Delete selected
    </button>
  );
}
