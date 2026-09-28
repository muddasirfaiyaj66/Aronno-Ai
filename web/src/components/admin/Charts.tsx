"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "#1b5e4a",
  "#4fa883",
  "#b7791f",
  "#2d7a62",
  "#7a9e8e",
  "#0f2f26",
  "#8f6b2f",
  "#3d6b5a",
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--white)",
  color: "var(--ink)",
  fontSize: 13,
};

const tick = { fill: "currentColor", fontSize: 12 };

type Slice = { name: string; value: number };

export function RoleDonut({ data }: { data: Slice[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return <EmptyChart />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={92}
          paddingAngle={3}
          stroke="none"
        >
          {filtered.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StatusBars({ data }: { data: Slice[] }) {
  if (data.every((d) => d.value === 0)) return <EmptyChart />;
  return (
    <div className="text-muted">
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--panel)" }} />
        <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={56}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

export function DistrictBars({ data }: { data: Slice[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="text-muted">
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={88} tick={tick} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--panel)" }} />
        <Bar dataKey="value" fill="#1b5e4a" radius={[0, 8, 8, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

export function SignupArea({
  data,
  name = "New accounts",
}: {
  data: { label: string; count: number }[];
  name?: string;
}) {
  if (data.every((d) => d.count === 0)) return <EmptyChart />;
  return (
    <div className="text-muted">
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fa883" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#4fa883" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="count"
          name={name}
          stroke="#1b5e4a"
          strokeWidth={2.5}
          fill="url(#signupFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted">
      Not enough data yet.
    </div>
  );
}
