import { cn } from "@/lib/utils";
import { Bug } from "lucide-react";

interface LogoProps {
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
  textClassName?: string;
}

export function Logo({ className, showIcon = true, iconClassName, textClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary",
            iconClassName,
          )}
        >
          <Bug className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
      )}
      <span className={cn("text-lg font-semibold tracking-tight text-foreground", textClassName)}>
        DebugDiary
      </span>
    </div>
  );
}
