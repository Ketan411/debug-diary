import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Status = "Verified" | "Pending";

export interface RecentIncidentItem {
  id?: string;
  title: string;
  category: string;
  status: Status;
  updated: string;
}

interface RecentIncidentsProps {
  incidents?: RecentIncidentItem[] | undefined;
}

const defaultIncidents: RecentIncidentItem[] = [
  { title: "JWT Refresh Retry Loop", category: "Authentication", status: "Verified", updated: "2h ago" },
  { title: "Database Connection Timeout", category: "Database", status: "Verified", updated: "6h ago" },
  { title: "CI Pipeline Failure", category: "CI/CD", status: "Pending", updated: "1d ago" },
  { title: "Payment API Error", category: "API", status: "Verified", updated: "3d ago" },
];

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "Verified"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function RecentIncidents({ incidents = defaultIncidents }: RecentIncidentsProps) {
  return (
    <section className="rounded-lg border border-border bg-card/60">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium text-foreground">Recent Incidents</h2>
        <p className="text-xs text-muted-foreground">Latest bug-fix knowledge imported by your team.</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Incident</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow key={incident.title}>
              <TableCell className="pl-5 font-medium text-foreground">{incident.title}</TableCell>
              <TableCell className="text-muted-foreground">{incident.category}</TableCell>
              <TableCell>
                <StatusBadge status={incident.status} />
              </TableCell>
              <TableCell className="pr-5 text-right text-muted-foreground">{incident.updated}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
