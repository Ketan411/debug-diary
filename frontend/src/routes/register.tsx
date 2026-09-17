import { createFileRoute } from "@tanstack/react-router";

import { RegisterCard } from "@/components/auth/register-card";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account — DebugDiary" },
      {
        name: "description",
        content:
          "Create your DebugDiary account to build and reuse your software engineering debugging knowledge.",
      },
      { property: "og:title", content: "Create Account — DebugDiary" },
      {
        property: "og:description",
        content:
          "Create your DebugDiary account to build and reuse your software engineering debugging knowledge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <main className="auth-background auth-grid relative flex min-h-screen w-full items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex w-full flex-col items-center">
        <RegisterCard />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Debug smarter. Reuse what your team already learned.
        </p>
      </div>
    </main>
  );
}
