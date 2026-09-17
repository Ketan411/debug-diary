import { createFileRoute } from "@tanstack/react-router";

import { LoginCard } from "@/components/auth/login-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — DebugDiary" },
      {
        name: "description",
        content:
          "Sign in to DebugDiary, the evidence-backed debugging knowledge platform for software development teams.",
      },
      { property: "og:title", content: "Sign in — DebugDiary" },
      {
        property: "og:description",
        content:
          "Evidence-backed debugging knowledge for software development teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="auth-background auth-grid relative flex min-h-screen w-full items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex w-full flex-col items-center">
        <LoginCard />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Debug smarter. Reuse what your team already learned.
        </p>
      </div>
    </main>
  );
}
