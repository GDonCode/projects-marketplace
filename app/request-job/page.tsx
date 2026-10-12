import JobRequestForm from '@/components/JobRequestForm'

export default function RequestJobPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Submit a job to FL Projects</h1>
      <p className="mt-2 mb-8 text-sm text-gray-600">
        Tell us what you need done. We'll review your request and follow up by email.
      </p>
      <JobRequestForm />
    </main>
  )
}