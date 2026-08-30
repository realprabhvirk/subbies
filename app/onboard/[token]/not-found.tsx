import { Logo } from "@/app/components/logo";

export default function OnboardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-6" />
      <h1 className="text-lg font-semibold">This link isn&apos;t valid</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The upload link may have expired or been mistyped. Check the most recent
        email you received, or reply to it to ask for a new link.
      </p>
    </main>
  );
}
