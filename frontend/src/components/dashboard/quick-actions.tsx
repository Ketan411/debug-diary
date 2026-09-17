import { GitBranch, ListChecks, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

const actions = [
  { label: "Connect Repository", icon: GitBranch },
  { label: "Search Previous Fix", icon: Search },
  { label: "Review Pending Incidents", icon: ListChecks },
];

export function QuickActions() {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-5">
      <h2 className="text-sm font-medium text-foreground">Quick Actions</h2>
      <p className="text-xs text-muted-foreground">Common workspace tasks.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            className="h-10 justify-start gap-2 border-border/70 bg-background/50 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <action.icon className="h-4 w-4 text-muted-foreground" />
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
