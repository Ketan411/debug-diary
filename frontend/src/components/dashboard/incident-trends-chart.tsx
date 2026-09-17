import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TrendItem {
  month: string;
  incidents: number;
}

interface IncidentTrendsChartProps {
  data?: TrendItem[] | undefined;
}

const defaultData: TrendItem[] = [
  { month: "Apr", incidents: 0 },
  { month: "May", incidents: 1 },
  { month: "Jun", incidents: 1 },
  { month: "Jul", incidents: 1 },
  { month: "Aug", incidents: 1 },
  { month: "Sep", incidents: 4 },
];

export function IncidentTrendsChart({ data = defaultData }: IncidentTrendsChartProps) {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-5">
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground">Incident Trends</h2>
        <p className="text-xs text-muted-foreground">Incidents captured over the last 6 months.</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border)" }}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-foreground)",
              }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
            />
            <Line
              type="monotone"
              dataKey="incidents"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
