"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { formatVND } from "@/lib/utils";

const formatTooltipVND = (v: unknown) => formatVND(Number(v ?? 0));

const GOLD = "hsl(38 78% 50%)";
const GOLD_LIGHT = "hsl(44 80% 65%)";
const FOREST = "hsl(156 50% 18%)";
const FOREST_LIGHT = "hsl(156 35% 35%)";
const CREAM = "hsl(42 60% 80%)";

function formatShortVND(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

export type RevenueTaxPoint = {
  label: string;
  revenue: number;
  tax: number;
};

export function RevenueTaxLineChart({ data }: { data: RevenueTaxPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FOREST} stopOpacity={0.25} />
              <stop offset="100%" stopColor={FOREST} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(41 30% 80%)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(156 30% 25%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatShortVND}
            tick={{ fontSize: 11, fill: "hsl(38 60% 35%)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatShortVND}
            tick={{ fontSize: 11, fill: "hsl(156 40% 25%)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: GOLD, strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{
              background: "hsl(44 80% 96%)",
              border: "1px solid hsl(41 50% 70%)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={formatTooltipVND}
          />
          <Legend
            verticalAlign="top"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            name="Doanh thu"
            stroke={GOLD}
            strokeWidth={2.5}
            dot={{ r: 3, stroke: GOLD, fill: "#fff", strokeWidth: 1.5 }}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="tax"
            name="Thuế GTGT"
            stroke={FOREST}
            strokeWidth={2.5}
            dot={{ r: 3, stroke: FOREST, fill: "#fff", strokeWidth: 1.5 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type CategoryShare = {
  name: string;
  value: number;
  color?: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Vàng ta": GOLD,
  "Vàng tây": CREAM,
  Bạc: FOREST,
  default: FOREST_LIGHT,
};

export function CategoryDonut({
  data,
  totalLabel,
}: {
  data: CategoryShare[];
  totalLabel: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="h-[280px] w-full grid grid-cols-1 sm:grid-cols-[1fr_180px] items-center">
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value ?? 0);
                return [
                  `${formatVND(v)} (${total > 0 ? ((v / total) * 100).toFixed(1) : "0.0"}%)`,
                  String(name),
                ];
              }}
              contentStyle={{
                background: "hsl(44 80% 96%)",
                border: "1px solid hsl(41 50% 70%)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="hsl(44 60% 96%)"
              strokeWidth={2}
            >
              {data.map((d, idx) => (
                <Cell
                  key={idx}
                  fill={
                    d.color ?? CATEGORY_COLORS[d.name] ?? CATEGORY_COLORS.default
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[11px] text-emerald-900/60">Tổng doanh thu</div>
            <div className="text-base font-semibold text-forest">
              {totalLabel}
            </div>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li key={d.name} className="flex flex-col">
              <span className="flex items-center gap-2 text-[13px] text-emerald-900">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    background:
                      d.color ?? CATEGORY_COLORS[d.name] ?? CATEGORY_COLORS.default,
                  }}
                />
                {d.name}
              </span>
              <span className="ml-4.5 pl-[18px] text-[12px] text-emerald-900/70">
                {formatVND(d.value)}{" "}
                <span className="text-emerald-900/50">({pct.toFixed(1)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type VATBarPoint = {
  label: string;
  vat: number;
};

export function VATBarChart({ data }: { data: VATBarPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 24, right: 8, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="vatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD_LIGHT} />
              <stop offset="100%" stopColor={GOLD} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(41 30% 80%)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(156 30% 25%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatShortVND}
            tick={{ fontSize: 11, fill: "hsl(38 60% 35%)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "hsla(44 60% 80% / 0.3)" }}
            contentStyle={{
              background: "hsl(44 80% 96%)",
              border: "1px solid hsl(41 50% 70%)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={formatTooltipVND}
          />
          <Bar dataKey="vat" name="Thuế GTGT" fill="url(#vatGrad)" radius={[6, 6, 0, 0]}>
            <LabelList
              dataKey="vat"
              position="top"
              formatter={(v) => formatShortVND(Number(v ?? 0))}
              style={{ fill: "hsl(36 70% 30%)", fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type AreaPoint = { label: string; value: number };
export function MiniArea({ data, color = GOLD }: { data: AreaPoint[]; color?: string }) {
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`mini-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#mini-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
