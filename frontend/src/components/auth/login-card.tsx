import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Github, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/logo";
import { authApi } from "@/lib/api";

export function LoginCard() {
  const [email, setEmail] = useState("demo@debugdiary.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (eEmail?: string, ePassword?: string) => {
    const targetEmail = eEmail || email;
    const targetPassword = ePassword || password;

    if (!targetEmail || !targetPassword) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login(targetEmail, targetPassword);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error("Sign-in failed", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleLogin();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      toast.error("GitHub Sign-In Failed", {
        description: decodeURIComponent(err),
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleDemoSignIn = () => {
    setEmail("demo@debugdiary.com");
    setPassword("password123");
    handleLogin("demo@debugdiary.com", "password123");
  };

  const handleGithubSignIn = () => {
    setLoading(true);
    window.location.href = authApi.getGithubAuthUrl();
  };

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-2 text-center">
        <Logo className="justify-center" />
        <p className="text-sm text-muted-foreground">Evidence-backed debugging knowledge.</p>
      </div>

      <div className="mt-8 space-y-2">
        <Button
          type="button"
          className="h-10 w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleDemoSignIn}
          disabled={loading}
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Signing in..." : "Demo Sign In (1-Click)"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center gap-2 border-border/70 bg-background/50 hover:bg-accent"
          onClick={handleGithubSignIn}
          disabled={loading}
        >
          <Github className="h-4 w-4" />
          {loading ? "Redirecting to GitHub..." : "Continue with GitHub"}
        </Button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 bg-background/50"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 bg-background/50"
            required
          />
        </div>

        <Button
          type="submit"
          variant="outline"
          disabled={loading}
          className="h-10 w-full border-border/70 bg-background/50 hover:bg-accent hover:text-accent-foreground"
        >
          {loading ? "Signing in..." : "Sign In with Password"}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}
