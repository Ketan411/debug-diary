"use client";

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Github, Sparkles, UserPlus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/logo";
import { authApi } from "@/lib/api";

export function RegisterCard() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password too short", {
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match", {
        description: "Please make sure your passwords match.",
      });
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.register(email.trim(), password, name.trim());
      toast.success("Account created successfully!", {
        description: `Welcome to DebugDiary, ${data.user.name}!`,
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error("Registration failed", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = () => {
    setLoading(true);
    window.location.href = authApi.getGithubAuthUrl();
  };

  return (
    <div className="w-full max-w-[440px] rounded-xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-2 text-center">
        <Logo className="justify-center" />
        <p className="text-sm text-muted-foreground">
          Create your engineering knowledge account.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center gap-2 border-border/70 bg-background/50 hover:bg-accent"
          onClick={handleGithubSignIn}
          disabled={loading}
        >
          <Github className="h-4 w-4" />
          Continue with GitHub
        </Button>
      </div>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or register with email</span>
        </div>
      </div>

      <form onSubmit={handleRegister} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="e.g. Alex Rivera"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 bg-background/50 text-sm"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="alex@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 bg-background/50 text-sm"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 bg-background/50 text-sm"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Re-type password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-9 bg-background/50 text-sm"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-2 h-10 w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          {loading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in here
        </Link>
      </div>
    </div>
  );
}
