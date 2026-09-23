"use client";

export function CancelJobButton() {
  return (
    <button
      type="submit"
      className="btn-secondary"
      onClick={(e) => {
        // confirm() shows the browser's OK/Cancel dialog; preventDefault stops the form submitting if they back out
        if (!confirm("Cancel this job? Invited tradesmen will be notified and no more bids can be placed.")) {
          e.preventDefault();
        }
      }}
    >
      Cancel job
    </button>
  );
}