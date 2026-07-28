import {
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
import type { Summary, TrendPoint } from "../lib/types";
import { formatEuro, formatMonth } from "../lib/format";

interface Props {
  summary: Summary;
  trend: TrendPoint[];
}

const AXIS = "#9aa3b2";
const GRID = "#2a2f3a";
const MAX_SLICES = 6; // darüber hinaus wird zu „Sonstige" gebündelt

export default function Dashboard({ summary, trend }: Props) {
  const net = summary.net;
  const expenseTotal = summary.expense || 1; // Division-Schutz für Prozente

  return (
    <div className="dashboard">
      {/* --- Kacheln --- */}
      <div className="stat-row">
        <StatTile label="Einnahmen" value={summary.income} tone="income" />
        <StatTile label="Ausgaben" value={summary.expense} tone="expense" />
        <StatTile label="Gespart" value={net} tone={net >= 0 ? "income" : "expense"} />
      </div>

      <div className="chart-grid">
        {/* --- Kategorie-Aufschlüsselung (Ausgaben) als Donut --- */}
        <div className="card chart-card">
          <h3 className="section-title">Ausgaben nach Kategorie</h3>
          {summary.byCategory.length === 0 ? (
            <p className="muted-note">Noch keine Ausgaben in {formatMonth(summary.month)}.</p>
          ) : (
            <CategoryDonut data={summary.byCategory} total={expenseTotal} />
          )}
        </div>

        {/* --- Monatsverlauf --- */}
        <div className="card chart-card">
          <h3 className="section-title">Verlauf (6 Monate)</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => m.slice(5)}
                stroke={AXIS}
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke={AXIS}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              />
              <Tooltip
                contentStyle={{ background: "#181b22", border: "1px solid #2a2f3a", borderRadius: 10, color: "#e7eaf0" }}
                formatter={(v: number, name) => [formatEuro(v), name === "income" ? "Einnahmen" : "Ausgaben"]}
                labelFormatter={(m: string) => formatMonth(m)}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Legend
                formatter={(v) => (v === "income" ? "Einnahmen" : "Ausgaben")}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Donut für „Ausgaben nach Kategorie": zeigt die Anteile zueinander.
// Kleinstkategorien über MAX_SLICES hinaus werden zu „Sonstige" gebündelt
// (kein Hue-Zyklus, siehe dataviz-Regeln).
function CategoryDonut({
  data,
  total,
}: {
  data: { name: string; color: string; total: number }[];
  total: number;
}) {
  let slices = data;
  if (data.length > MAX_SLICES) {
    const head = data.slice(0, MAX_SLICES - 1);
    const restTotal = data.slice(MAX_SLICES - 1).reduce((s, c) => s + c.total, 0);
    slices = [...head, { name: "Sonstige", color: "#64748b", total: restTotal }];
  }

  return (
    <div className="donut-wrap">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={85}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s, i) => (
                <Cell key={`${s.name}-${i}`} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#181b22", border: "1px solid #2a2f3a", borderRadius: 10, color: "#e7eaf0" }}
              formatter={(v: number, name) => [`${formatEuro(v)} · ${Math.round((v / total) * 100)}%`, name as string]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-center-label">Gesamt</span>
          <span className="donut-center-value">{formatEuro(total)}</span>
        </div>
      </div>

      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={`${s.name}-${i}`}>
            <span className="tx-dot" style={{ background: s.color }} />
            <span className="legend-name">{s.name}</span>
            <span className="legend-amount">{formatEuro(s.total)}</span>
            <span className="legend-pct">{Math.round((s.total / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{formatEuro(value)}</span>
    </div>
  );
}
