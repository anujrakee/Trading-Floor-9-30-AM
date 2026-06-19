"use client";

import {
  Activity,
  Bell,
  CandlestickChart,
  ChevronRight,
  CircleDollarSign,
  LineChart,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Sun,
  TrendingDown,
  TrendingUp,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import AuthControls, { AuthIdentityBridge } from "@/components/AuthControls";
import { marketNews, recentSearches, Stock, stocks, trendingSearches } from "@/lib/stocks";

type Holding = {
  ticker: string;
  shares: number;
};

type StockAlert = {
  id: string;
  ticker: string;
  type: "price_above" | "price_below" | "ai_score" | "earnings" | "news";
  target?: number;
};

type PersistedUserState = {
  watchlistTickers: string[];
  portfolio: Holding[];
  alerts: StockAlert[];
};

type MarketQuote = {
  ticker: string;
  price?: number;
  change?: number;
  dollarChange?: number;
  dayHigh?: number | null;
  dayLow?: number | null;
};

const USER_ID_KEY = "stockranker:user-id";
const USER_STATE_KEY = "stockranker:user-state";

function createBrowserUserId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getBrowserUserId() {
  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const userId = createBrowserUserId();
  window.localStorage.setItem(USER_ID_KEY, userId);
  return userId;
}

function readLocalUserState(userId: string): PersistedUserState {
  try {
    const raw = window.localStorage.getItem(`${USER_STATE_KEY}:${userId}`);
    if (!raw) return { watchlistTickers: [], portfolio: [], alerts: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedUserState>;
    return {
      watchlistTickers: Array.isArray(parsed.watchlistTickers) ? parsed.watchlistTickers : [],
      portfolio: Array.isArray(parsed.portfolio) ? parsed.portfolio : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : []
    };
  } catch {
    return { watchlistTickers: [], portfolio: [], alerts: [] };
  }
}

function writeLocalUserState(userId: string, state: PersistedUserState) {
  window.localStorage.setItem(`${USER_STATE_KEY}:${userId}`, JSON.stringify(state));
}

const ranges = ["1D", "1W", "1M", "6M", "1Y", "5Y"];
const sectors = ["All", "Technology", "Healthcare", "Financial Services"];
const rangeLabels: Record<string, string[]> = {
  "1D": ["9:30", "10:30", "11:30", "12:30", "1:30", "2:30", "3:30", "4:00"],
  "1W": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "1M": ["Week 1", "Week 2", "Week 3", "Week 4"],
  "6M": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "1Y": ["Jul", "Sep", "Nov", "Jan", "Mar", "May"],
  "5Y": ["2022", "2023", "2024", "2025", "2026"]
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function getRatingTone(score: number) {
  if (score >= 8) return "bg-mint/15 text-mint border-mint/30";
  if (score >= 5) return "bg-amber/15 text-amber border-amber/30";
  return "bg-danger/15 text-danger border-danger/30";
}

function LogoMark({ stock }: { stock: Stock }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-gradient-to-br from-mint/35 via-ocean/25 to-white/10 text-sm font-black text-white shadow-glow">
      {stock.logo}
    </div>
  );
}

function MiniChart({ values, positive }: { values: number[]; positive: boolean }) {
  const max = Math.max(...values);
  const min = Math.min(...values);

  return (
    <div className="mini-bars flex h-9 w-24 items-end gap-1" aria-hidden="true">
      {values.slice(-9).map((value, index) => {
        const height = 24 + ((value - min) / Math.max(max - min, 1)) * 76;
        return (
          <span
            key={`${value}-${index}`}
            className={`w-full rounded-full ${positive ? "bg-mint" : "bg-danger"}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="soft-card rounded-lg border border-line bg-white/[0.04] p-4 light:bg-white">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-black ${accent ? "text-mint" : ""}`}>{value}</p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ payload: { value: number; dollarChange: number; percentChange: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const positive = point.dollarChange >= 0;

  return (
    <div className="rounded-md border border-line bg-[#182018] px-3 py-2 text-sm shadow-[4px_4px_0_#d82418]">
      <p className="font-bold text-[#f8edcf]">{label}</p>
      <p className="mt-1 font-black text-mint">{formatCurrency(point.value)}</p>
      <p className={positive ? "font-bold text-mint" : "font-bold text-danger"}>
        {positive ? "+" : ""}
        {formatCurrency(point.dollarChange)}
      </p>
      <p className={positive ? "text-xs font-bold text-mint" : "text-xs font-bold text-danger"}>
        {positive ? "+" : ""}
        {point.percentChange.toFixed(2)}%
      </p>
    </div>
  );
}

function SearchBox({
  inputRef,
  universe,
  onSelect,
  onAddToWatchlist,
  watchlistTickers
}: {
  inputRef: RefObject<HTMLInputElement>;
  universe: Stock[];
  onSelect: (stock: Stock) => void;
  onAddToWatchlist: (stock: Stock) => void;
  watchlistTickers: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universe.slice(0, 5);
    return universe.filter((stock) =>
      [stock.ticker, stock.name, stock.industry, stock.sector, stock.marketCap, stock.country]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, universe]);

  return (
    <div className="relative w-full max-w-3xl">
      <div className="glass premium-ring flex items-center gap-3 rounded-lg px-4 py-3">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          ref={inputRef}
          className="w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-slate-500 light:text-slate-950"
          placeholder="Search ticker, company, sector, industry, market cap, or country"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <div className="hidden rounded-md border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-bold text-mint sm:block">
          AI Search
        </div>
      </div>

      {open && (
        <div className="glass absolute left-0 right-0 top-14 z-30 overflow-hidden rounded-lg sm:top-16">
          <div className="border-b border-line px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Instant suggestions</p>
          </div>
          <div className="max-h-96 overflow-auto">
            {suggestions.map((stock) => {
              const saved = watchlistTickers.includes(stock.ticker);
              return (
                <div key={stock.ticker} className="flex flex-wrap items-center gap-3 px-3 py-3 transition hover:bg-white/8 sm:flex-nowrap sm:px-4 light:hover:bg-slate-900/5">
                  <button
                    className="soft-card flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
                    onClick={() => {
                      onSelect(stock);
                      setQuery(`${stock.name} (${stock.ticker})`);
                      setOpen(false);
                    }}
                  >
                    <LogoMark stock={stock} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{stock.name}</span>
                        <span className="text-sm text-slate-400">{stock.ticker}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${getRatingTone(stock.aiScore)}`}>
                          {stock.aiScore}/10
                        </span>
                      </div>
                      <p className="truncate text-sm text-slate-400">
                        {stock.sector} • {stock.industry} • {stock.country}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(stock.price)}</p>
                      <p className={stock.change >= 0 ? "text-sm text-mint" : "text-sm text-danger"}>
                        {stock.change >= 0 ? "+" : ""}
                        {stock.change}%
                      </p>
                    </div>
                  </button>
                  <button
                    className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                      saved ? "border-amber/40 bg-amber/15 text-amber" : "border-line text-slate-300 hover:border-mint/40 hover:text-mint"
                    }`}
                    aria-label={`${saved ? "Saved" : "Add"} ${stock.ticker} to watchlist`}
                    onClick={() => onAddToWatchlist(stock)}
                  >
                    {saved ? <Star className="h-4 w-4 fill-current" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {[...recentSearches, ...trendingSearches.slice(0, 3)].map((item) => (
          <button
            key={item}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-mint/50 hover:text-white light:border-slate-200 light:bg-white light:text-slate-700"
            onClick={() => {
              setQuery(item);
              setOpen(true);
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Dashboard({
  selected,
  saved,
  onToggleWatchlist
}: {
  selected: Stock;
  saved: boolean;
  onToggleWatchlist: (stock: Stock) => void;
}) {
  const [tick, setTick] = useState(selected.price);
  const [activeRange, setActiveRange] = useState("1D");
  const [showWhy, setShowWhy] = useState(false);
  const rangeBoost = ranges.indexOf(activeRange) + 1;
  const labels = rangeLabels[activeRange];
  const chartData = labels.map((label, index) => {
    const sourceIndex = Math.round((index / Math.max(labels.length - 1, 1)) * (selected.chart.length - 1));
    const value = Number((selected.chart[sourceIndex] + index * rangeBoost * 0.35).toFixed(2));
    const open = selected.chart[0];
    return {
      index: label,
      value,
      dollarChange: Number((value - open).toFixed(2)),
      percentChange: Number((((value - open) / open) * 100).toFixed(2))
    };
  });
  const latestPoint = chartData[chartData.length - 1];
  const latestPositive = latestPoint.dollarChange >= 0;

  useEffect(() => {
    setTick(selected.price);
    const timer = window.setInterval(() => {
      setTick((price) => Number((price + (Math.random() - 0.48) * 0.42).toFixed(2)));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [selected]);

  return (
    <section id="dashboard" className="glass premium-ring rounded-lg p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <LogoMark stock={selected} />
          <div>
            <p className="text-sm font-semibold text-slate-400">{selected.sector} • {selected.industry}</p>
            <h2 className="text-3xl font-black">
              {selected.name} <span className="text-slate-400">{selected.ticker}</span>
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className={`rounded-md border px-3 py-2 font-black ${getRatingTone(selected.aiScore)}`}>
              AI Score {selected.aiScore}/10
            </div>
            <button
              className="mt-2 w-full rounded-md border border-line bg-white/[0.04] px-3 py-1.5 text-sm font-black transition hover:border-mint/40"
              onClick={() => {
                setShowWhy((value) => !value);
                window.setTimeout(() => document.getElementById("why-ai-rating")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
              }}
            >
              Why?
            </button>
          </div>
          <button
            className={`shine-button flex items-center gap-2 rounded-md px-4 py-2 font-black ${
              saved ? "bg-amber text-ink" : "bg-mint text-ink"
            }`}
            onClick={() => onToggleWatchlist(selected)}
          >
            {saved ? <Star className="h-4 w-4 fill-current" /> : <Plus className="h-4 w-4" />}
            {saved ? "Saved" : "Watchlist"}
          </button>
        </div>
      </div>

      {showWhy && (
        <div id="why-ai-rating" className="mt-6 rounded-lg border border-line bg-white/[0.04] p-5 light:bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Why this rating</p>
              <h3 className="mt-1 text-xl font-black">{selected.name} scores {selected.aiScore}/10</h3>
            </div>
            <div className={`rounded-md border px-3 py-2 text-sm font-black ${getRatingTone(selected.aiScore)}`}>
              {selected.recommendation} • {selected.confidence}% confidence
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">{selected.outlook}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MetricCard label="Growth" value={`${selected.revenueGrowth}% rev / ${selected.earningsGrowth}% EPS`} accent={selected.revenueGrowth > 15} />
            <MetricCard label="Profitability" value={`${selected.margin}% margin`} accent={selected.margin > 30} />
            <MetricCard label="Valuation" value={selected.valuation} />
            <MetricCard label="Debt" value={selected.debt} />
            <MetricCard label="Sentiment" value={selected.sentiment} accent={selected.sentiment.toLowerCase().includes("bullish")} />
            <MetricCard label="Risk" value={selected.risk} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
              <h4 className="font-black text-mint">What helps the score</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                {selected.strengths.map((item) => (
                  <p key={item}>+ {item}</p>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
              <h4 className="font-black text-danger">What holds it back</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                {selected.weaknesses.map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Live price" value={formatCurrency(tick)} accent />
        <MetricCard label="Market cap" value={selected.marketCap} />
        <MetricCard label="Volume" value={selected.volume} />
        <MetricCard label="P/E ratio" value={`${selected.pe}`} />
        <MetricCard label="EPS" value={`$${selected.eps}`} />
        <MetricCard label="Dividend yield" value={selected.dividend} />
        <MetricCard label="52-week high" value={formatCurrency(selected.high52)} />
        <MetricCard label="52-week low" value={formatCurrency(selected.low52)} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="soft-card rounded-lg border border-line bg-white/[0.03] p-4 light:bg-white">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black">Interactive Performance</h3>
              <p className="text-sm text-slate-400">Daily, weekly, monthly, and yearly market movement</p>
              <div className="mt-3 inline-flex flex-col border-l-4 border-[#d82418] pl-3">
                <span className={latestPositive ? "text-xl font-black text-mint" : "text-xl font-black text-danger"}>
                  {latestPositive ? "+" : ""}
                  {formatCurrency(latestPoint.dollarChange)}
                </span>
                <span className={latestPositive ? "text-sm font-bold text-mint" : "text-sm font-bold text-danger"}>
                  {latestPositive ? "+" : ""}
                  {latestPoint.percentChange.toFixed(2)}%
                </span>
              </div>
            </div>
          <div className="flex max-w-full overflow-x-auto rounded-md border border-line p-1">
              {ranges.map((range) => (
                <button
                  key={range}
                  className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold ${
                    activeRange === range ? "bg-white/10 text-white light:bg-slate-900/10 light:text-slate-950" : "text-slate-300 light:text-slate-700"
                  }`}
                  onClick={() => setActiveRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="stockLine" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#00D19A" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#00D19A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="index" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} domain={["dataMin - 8", "dataMax + 8"]} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#00D19A" strokeWidth={3} fill="url(#stockLine)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="soft-card rounded-lg border border-line bg-white/[0.03] p-4 light:bg-white">
          <h3 className="font-black">AI Analysis</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{selected.outlook}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard label="Confidence" value={`${selected.confidence}%`} accent />
            <MetricCard label="Risk" value={selected.risk} />
            <MetricCard label="Revenue growth" value={`${selected.revenueGrowth}%`} />
            <MetricCard label="Margins" value={`${selected.margin}%`} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StockTable({
  title,
  icon,
  items,
  watchlistTickers,
  onAddToWatchlist,
  onSelect
}: {
  title: string;
  icon: ReactNode;
  items: Stock[];
  watchlistTickers: string[];
  onAddToWatchlist: (stock: Stock) => void;
  onSelect: (stock: Stock) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 5);

  return (
    <section className="glass premium-ring rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-black">{title}</h2>
        </div>
        <button className="text-sm font-bold text-mint" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : "View all"}
        </button>
      </div>
      <div className="space-y-3">
        {visibleItems.map((stock) => {
          const saved = watchlistTickers.includes(stock.ticker);
          return (
            <div key={`${title}-${stock.ticker}`} className="soft-card grid gap-3 rounded-md border border-line bg-white/[0.03] p-3 light:bg-white sm:grid-cols-[1fr_auto] sm:items-center">
              <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => onSelect(stock)}>
                <LogoMark stock={stock} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{stock.name}</p>
                  <p className="text-sm text-slate-400">{stock.ticker} • {formatCurrency(stock.price)}</p>
                </div>
              </button>
              <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
                <MiniChart values={stock.chart} positive={stock.change >= 0} />
                <div className="w-20 text-right">
                  <p className={stock.change >= 0 ? "font-black text-mint" : "font-black text-danger"}>
                    {stock.change >= 0 ? "+" : ""}
                    {stock.change}%
                  </p>
                  <p className="text-xs text-slate-400">AI {stock.aiScore}</p>
                </div>
                <button
                  className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                    saved ? "border-amber/40 bg-amber/15 text-amber" : "border-line text-slate-300 hover:border-mint/40 hover:text-mint"
                  }`}
                  aria-label={`${saved ? "Saved" : "Add"} ${stock.ticker} to watchlist`}
                  onClick={() => onAddToWatchlist(stock)}
                >
                  {saved ? <Star className="h-4 w-4 fill-current" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Rankings({ universe, onSelect }: { universe: Stock[]; onSelect: (stock: Stock) => void }) {
  const [activeSector, setActiveSector] = useState("All");
  const screen = activeSector === "All" ? universe : universe.filter((stock) => stock.sector === activeSector);
  const pool = screen.length >= 4 ? screen : universe;
  const rankings = [
    { label: "Highest AI Score", description: "Model-ranked conviction leaders", stocks: [...pool].sort((a, b) => b.aiScore - a.aiScore).slice(0, 4) },
    { label: "Best Value Stocks", description: "Quality adjusted valuation screens", stocks: [...pool].sort((a, b) => a.pe - b.pe).slice(0, 4) },
    { label: "Fastest Growing", description: "Revenue and earnings acceleration", stocks: [...pool].sort((a, b) => b.revenueGrowth - a.revenueGrowth).slice(0, 4) },
    { label: "Best Dividend", description: "Yield with balance-sheet support", stocks: [...pool].sort((a, b) => parseFloat(b.dividend) - parseFloat(a.dividend)).slice(0, 4) },
    { label: "Most Popular", description: "Watchlist and user activity leaders", stocks: [universe[1], universe[0], universe[3], universe[2]].filter(Boolean) },
    { label: "Momentum Stocks", description: "Price strength across key windows", stocks: [...pool].sort((a, b) => b.month - a.month).slice(0, 4) }
  ];

  return (
    <section id="rankings" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-mint">Rankings</p>
          <h2 className="mt-1 text-3xl font-black">Institutional-grade stock lists</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {sectors.map((sector) => (
            <button
              key={sector}
              className={`rounded-md border px-3 py-2 text-sm font-bold ${
                activeSector === sector ? "border-mint text-mint" : "border-line text-slate-300 light:text-slate-700"
              }`}
              onClick={() => setActiveSector(sector)}
            >
              {sector}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rankings.map((ranking) => (
          <div key={ranking.label} className="glass premium-ring rounded-lg p-5">
            <h3 className="font-black">{ranking.label}</h3>
            <p className="mt-1 text-sm text-slate-400">{ranking.description}</p>
            <div className="mt-4 space-y-3">
              {ranking.stocks.map((stock, index) => (
                <button
                  key={`${ranking.label}-${stock.ticker}`}
                  className="soft-card flex w-full items-center gap-3 rounded-md border border-line bg-white/[0.03] p-3 text-left light:bg-white"
                  onClick={() => onSelect(stock)}
                >
                  <span className="w-5 text-sm font-black text-slate-500">{index + 1}</span>
                  <LogoMark stock={stock} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{stock.name}</p>
                    <p className="text-sm text-slate-400">{stock.ticker}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-black ${getRatingTone(stock.aiScore)}`}>
                    {stock.aiScore}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailPanel({ selected }: { selected: Stock }) {
  return (
    <section id="analysis" className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="glass premium-ring rounded-lg p-5">
        <h2 className="text-xl font-black">Stock Detail Page</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {selected.name} operates in {selected.industry}, within the {selected.sector} sector. The AI model weighs growth,
          profitability, valuation, sentiment, insider activity, technical indicators, and industry outlook.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <MetricCard label="Recommendation" value={selected.recommendation} accent={selected.aiScore >= 8} />
          <MetricCard label="Analyst sentiment" value={selected.sentiment} />
          <MetricCard label="Insider activity" value={selected.insider} />
          <MetricCard label="Relative valuation" value={selected.valuation} />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="glass rounded-lg p-5">
          <h3 className="font-black text-mint">Strengths</h3>
          <div className="mt-4 space-y-3">
            {selected.strengths.map((item) => (
              <div key={item} className="flex gap-3 text-sm text-slate-300 light:text-slate-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-lg p-5">
          <h3 className="font-black text-amber">Weaknesses</h3>
          <div className="mt-4 space-y-3">
            {selected.weaknesses.map((item) => (
              <div key={item} className="flex gap-3 text-sm text-slate-300 light:text-slate-700">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass rounded-lg p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">Financials & News</h3>
          <button className="flex items-center gap-1 text-sm font-bold text-mint">
            Full filings <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {[
              ["Income Statement", "Revenue growth", `${selected.revenueGrowth}%`],
              ["Balance Sheet", "Debt level", selected.debt],
              ["Cash Flow", "Profit margin", `${selected.margin}%`]
            ].map(([title, label, value]) => (
              <div key={title} className="rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {label}: <span className="text-white light:text-slate-950">{value}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {marketNews.map((item) => (
              <div key={item} className="rounded-md border border-line bg-white/[0.03] p-4 text-sm leading-6 text-slate-300 light:bg-white light:text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WatchlistPortfolio({
  watchlist,
  portfolio,
  universe,
  onAddToWatchlist,
  onRemove,
  onCreateWatchlist,
  onAddHolding,
  onUpdateHolding,
  onRemoveHolding,
  onSelect
}: {
  watchlist: Stock[];
  portfolio: Holding[];
  universe: Stock[];
  onAddToWatchlist: (stock: Stock) => void;
  onRemove: (ticker: string) => void;
  onCreateWatchlist: () => void;
  onAddHolding: (stock: Stock, mode: "shares" | "dollars", amount: number) => void;
  onUpdateHolding: (ticker: string, shares: number) => void;
  onRemoveHolding: (ticker: string) => void;
  onSelect: (stock: Stock) => void;
}) {
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [watchlistStock, setWatchlistStock] = useState<Stock | null>(null);
  const [watchlistSearchOpen, setWatchlistSearchOpen] = useState(false);
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [portfolioStock, setPortfolioStock] = useState<Stock | null>(null);
  const [portfolioSearchOpen, setPortfolioSearchOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"shares" | "dollars">("shares");
  const [entryAmount, setEntryAmount] = useState("1");
  const portfolioRows = portfolio
    .map((holding) => {
      const stock = universe.find((item) => item.ticker === holding.ticker);
      if (!stock) return null;
      const value = stock.price * holding.shares;
      return { holding, stock, value };
    })
    .filter((row): row is { holding: Holding; stock: Stock; value: number } => Boolean(row));
  const portfolioValue = portfolioRows.reduce((sum, row) => sum + row.value, 0);
  const unrealizedGain = portfolioRows.reduce((sum, row) => sum + row.value * (row.stock.month / 100), 0);
  const benchmarkDelta = portfolioRows.length ? portfolioRows.reduce((sum, row) => sum + row.stock.month, 0) / portfolioRows.length - 3.1 : 0;
  const portfolioSuggestions = useMemo(() => {
    const query = portfolioQuery.trim().toLowerCase();
    if (!query) return universe.slice(0, 5);
    return universe
      .filter((stock) => `${stock.ticker} ${stock.name} ${stock.sector} ${stock.industry}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [portfolioQuery, universe]);
  const watchlistSuggestions = useMemo(() => {
    const query = watchlistQuery.trim().toLowerCase();
    if (!query) return universe.slice(0, 5);
    return universe
      .filter((stock) => `${stock.ticker} ${stock.name} ${stock.sector} ${stock.industry}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [watchlistQuery, universe]);
  const typedWatchlistMatch =
    watchlistStock ??
    universe.find((stock) => {
      const query = watchlistQuery.trim().toLowerCase();
      return query === stock.ticker.toLowerCase() || query === stock.name.toLowerCase() || query === `${stock.name} (${stock.ticker})`.toLowerCase();
    }) ??
    null;
  const typedPortfolioMatch =
    portfolioStock ??
    universe.find((stock) => {
      const query = portfolioQuery.trim().toLowerCase();
      return query === stock.ticker.toLowerCase() || query === stock.name.toLowerCase() || query === `${stock.name} (${stock.ticker})`.toLowerCase();
    }) ??
    null;
  function commitWatchlistSelection() {
    const stock = typedWatchlistMatch ?? watchlistSuggestions[0] ?? null;
    if (!stock) return;
    onAddToWatchlist(stock);
    setWatchlistQuery("");
    setWatchlistStock(null);
    setWatchlistSearchOpen(false);
  }
  function commitPortfolioSelection() {
    const stock = typedPortfolioMatch ?? portfolioSuggestions[0] ?? null;
    if (!stock) return;
    const typedAmount = Number(entryAmount);
    const amount = Number.isFinite(typedAmount) && typedAmount > 0 ? typedAmount : entryMode === "shares" ? 1 : stock.price;
    onAddHolding(stock, entryMode, amount);
    setPortfolioQuery("");
    setPortfolioStock(null);
    setPortfolioSearchOpen(false);
  }
  const allocation = portfolioRows.length
    ? portfolioRows.reduce<Array<{ name: string; value: number; color: string }>>((items, row) => {
        const stock = row.stock;
        const existing = items.find((item) => item.name === stock.sector);
        if (existing) existing.value += row.value;
        else {
          const colors = ["#00D19A", "#1C8BFF", "#F6C84C", "#FF5B6E", "#315F35", "#D82418"];
          items.push({ name: stock.sector, value: row.value, color: colors[items.length % colors.length] });
        }
        return items;
      }, [])
    : [{ name: "Empty", value: 1, color: "rgba(24, 32, 24, 0.14)" }];

  return (
    <section id="portfolio" className="grid gap-5 lg:grid-cols-2">
      <div className="glass premium-ring rounded-lg p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Watchlist</h2>
            <p className="mt-1 text-sm text-slate-400">Saved stocks, alerts, AI rating changes, earnings, and breaking news.</p>
          </div>
          <button className="rounded-md bg-white px-3 py-2 font-black text-ink" onClick={onCreateWatchlist}>
            Create
          </button>
        </div>
        <div className="mt-5 rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Add to watchlist</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <div className="flex items-center gap-2 rounded-md border border-line bg-white/[0.04] px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-500"
                  placeholder="Search watchlist stock"
                  value={watchlistQuery}
                  onChange={(event) => {
                    setWatchlistQuery(event.target.value);
                    setWatchlistStock(null);
                    setWatchlistSearchOpen(true);
                  }}
                  onFocus={() => setWatchlistSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    commitWatchlistSelection();
                  }}
                />
              </div>
              {watchlistSearchOpen && (watchlistQuery || watchlistSuggestions.length > 0) && (
                <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-md border border-line bg-[#fbf3df] shadow-[5px_5px_0_#182018]">
                  {watchlistSuggestions.length > 0 ? (
                    watchlistSuggestions.map((stock) => (
                      <button
                        key={`watchlist-search-${stock.ticker}`}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-bold hover:bg-white/60"
                        onClick={() => {
                          setWatchlistStock(stock);
                          setWatchlistQuery(`${stock.name} (${stock.ticker})`);
                          setWatchlistSearchOpen(false);
                        }}
                      >
                        <span>{stock.name}</span>
                        <span className="text-slate-400">{stock.ticker}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm font-bold text-slate-400">No watchlist match</div>
                  )}
                </div>
              )}
            </div>
            <button
              className={`shine-button rounded-md px-4 py-2 text-sm font-black ${
                typedWatchlistMatch ? "bg-mint text-ink" : "cursor-not-allowed bg-slate-300 text-slate-600"
              }`}
              disabled={!typedWatchlistMatch}
              onClick={commitWatchlistSelection}
            >
              {typedWatchlistMatch ? `Add ${typedWatchlistMatch.ticker}` : "Choose stock"}
            </button>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {watchlist.length === 0 ? (
            <div className="rounded-md border border-line bg-white/[0.03] p-4 text-sm text-slate-400 light:bg-white">
              No stocks saved yet. Use the watchlist search above to add one.
            </div>
          ) : (
            watchlist.map((stock) => (
              <div key={`watch-${stock.ticker}`} className="flex items-center gap-3 rounded-md border border-line bg-white/[0.03] p-3 light:bg-white">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onSelect(stock)}>
                  <Star className="h-4 w-4 fill-amber text-amber" />
                  <div className="min-w-0">
                    <p className="font-bold">{stock.ticker}</p>
                    <p className="truncate text-sm text-slate-400">{stock.recommendation} • Alert at {formatCurrency(stock.price * 1.06)}</p>
                  </div>
                </button>
                <Bell className="h-4 w-4 text-mint" />
                <button className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-400 hover:text-danger" onClick={() => onRemove(stock.ticker)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="glass rounded-lg p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Portfolio Tracker</h2>
            <p className="mt-1 text-sm text-slate-400">
              {portfolioRows.length
                ? "Holdings, gains/losses, allocation, returns, and S&P 500 benchmark."
                : "No holdings yet. Add a stock when you want this to start tracking real positions."}
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Add holding</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(12rem,1fr)_auto_6.5rem_auto]">
            <div className="relative">
              <div className="flex items-center gap-2 rounded-md border border-line bg-white/[0.04] px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-500"
                  placeholder="Search portfolio stock"
                  value={portfolioQuery}
                  onChange={(event) => {
                    setPortfolioQuery(event.target.value);
                    setPortfolioStock(null);
                    setPortfolioSearchOpen(true);
                  }}
                  onFocus={() => setPortfolioSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    commitPortfolioSelection();
                  }}
                />
              </div>
              {portfolioSearchOpen && (portfolioQuery || portfolioSuggestions.length > 0) && (
                <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-md border border-line bg-[#fbf3df] shadow-[5px_5px_0_#182018]">
                  {portfolioSuggestions.length > 0 ? (
                    portfolioSuggestions.map((stock) => (
                      <button
                        key={`portfolio-search-${stock.ticker}`}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-bold hover:bg-white/60"
                        onClick={() => {
                          setPortfolioStock(stock);
                          setPortfolioQuery(`${stock.name} (${stock.ticker})`);
                          setPortfolioSearchOpen(false);
                        }}
                      >
                        <span>{stock.name}</span>
                        <span className="text-slate-400">{stock.ticker}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm font-bold text-slate-400">No portfolio match</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex rounded-md border border-line p-1">
              {(["shares", "dollars"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`flex-1 rounded px-3 py-2 text-sm font-black capitalize ${entryMode === mode ? "bg-[#d82418] text-[#fff8e7]" : ""}`}
                  onClick={() => setEntryMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <input
              className="w-full rounded-md border border-line bg-white/[0.04] px-3 py-2 text-sm font-bold outline-none"
              min="0"
              step="0.01"
              type="number"
              value={entryAmount}
              onChange={(event) => setEntryAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                commitPortfolioSelection();
              }}
              placeholder={entryMode === "shares" ? "Shares" : "Dollars"}
            />
            <button
              className={`shine-button rounded-md px-4 py-2 text-sm font-black ${
                typedPortfolioMatch || portfolioSuggestions.length ? "bg-mint text-ink" : "cursor-not-allowed bg-slate-300 text-slate-600"
              }`}
              disabled={!typedPortfolioMatch && !portfolioSuggestions.length}
              onClick={commitPortfolioSelection}
            >
              {typedPortfolioMatch ? `Add ${typedPortfolioMatch.ticker}` : portfolioSuggestions[0] ? `Add ${portfolioSuggestions[0].ticker}` : "Choose stock"}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation} dataKey="value" innerRadius={54} outerRadius={82} paddingAngle={4}>
                  {allocation.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <MetricCard label="Total value" value={formatCurrency(portfolioValue)} accent={portfolioValue > 0} />
            <MetricCard
              label="Unrealized gain"
              value={`${unrealizedGain >= 0 ? "+" : ""}${formatCurrency(unrealizedGain)}`}
              accent={unrealizedGain > 0}
            />
            <MetricCard label="Vs S&P 500" value={`${benchmarkDelta >= 0 ? "+" : ""}${benchmarkDelta.toFixed(1)}%`} />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {portfolioRows.length === 0 ? (
            <div className="rounded-md border border-line bg-white/[0.03] p-4 text-sm text-slate-400 light:bg-white">
              Portfolio starts at zero. Use the portfolio search above to add shares or a dollar amount.
            </div>
          ) : (
            portfolioRows.map(({ holding, stock, value }) => (
              <div key={`holding-${stock.ticker}`} className="grid gap-3 rounded-md border border-line bg-white/[0.03] p-3 light:bg-white md:grid-cols-2 lg:grid-cols-[1fr_0.8fr_0.8fr_auto]">
                <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => onSelect(stock)}>
                  <LogoMark stock={stock} />
                  <div className="min-w-0">
                    <p className="font-black">{stock.ticker}</p>
                    <p className="truncate text-sm text-slate-400">{stock.name}</p>
                  </div>
                </button>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Shares
                  <input
                    className="mt-1 w-full rounded-md border border-line bg-white/[0.04] px-3 py-2 text-sm font-bold outline-none"
                    min="0"
                    step="0.01"
                    type="number"
                    value={Number(holding.shares.toFixed(4))}
                    onChange={(event) => onUpdateHolding(stock.ticker, Number(event.target.value))}
                  />
                </label>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Dollar value
                  <input
                    className="mt-1 w-full rounded-md border border-line bg-white/[0.04] px-3 py-2 text-sm font-bold outline-none"
                    min="0"
                    step="0.01"
                    type="number"
                    value={Number(value.toFixed(2))}
                    onChange={(event) => onUpdateHolding(stock.ticker, Number(event.target.value) / stock.price)}
                  />
                </label>
                <button className="flex h-10 w-full items-center justify-center self-end rounded-md border border-line text-slate-400 hover:text-danger md:w-10" onClick={() => onRemoveHolding(stock.ticker)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function AlertsSection({
  alerts,
  universe,
  onAddAlert,
  onRemoveAlert
}: {
  alerts: StockAlert[];
  universe: Stock[];
  onAddAlert: (alert: Omit<StockAlert, "id">) => void;
  onRemoveAlert: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedAlertStock, setSelectedAlertStock] = useState<Stock | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<StockAlert["type"]>("price_above");
  const [target, setTarget] = useState("");
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universe.slice(0, 5);
    return universe
      .filter((stock) => `${stock.ticker} ${stock.name} ${stock.sector} ${stock.industry}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, universe]);
  const stockMatch =
    selectedAlertStock ??
    universe.find((stock) => {
      const q = query.trim().toLowerCase();
      return q === stock.ticker.toLowerCase() || q === stock.name.toLowerCase() || q === `${stock.name} (${stock.ticker})`.toLowerCase();
    }) ??
    null;
  const needsTarget = type === "price_above" || type === "price_below" || type === "ai_score";

  function labelForAlert(alert: StockAlert) {
    if (alert.type === "price_above") return `Price above ${formatCurrency(alert.target ?? 0)}`;
    if (alert.type === "price_below") return `Price below ${formatCurrency(alert.target ?? 0)}`;
    if (alert.type === "ai_score") return `AI score at/above ${alert.target ?? 0}`;
    if (alert.type === "earnings") return "Earnings announcement";
    return "Breaking news";
  }

  function commitAlert() {
    const stock = stockMatch ?? suggestions[0] ?? null;
    if (!stock) return;
    const numericTarget = Number(target);
    const fallbackTarget = type === "ai_score" ? stock.aiScore : stock.price;
    onAddAlert({
      ticker: stock.ticker,
      type,
      ...(needsTarget ? { target: Number.isFinite(numericTarget) && numericTarget > 0 ? numericTarget : fallbackTarget } : {})
    });
    setQuery("");
    setSelectedAlertStock(null);
    setOpen(false);
    setTarget("");
  }

  return (
    <section id="alerts" className="glass premium-ring rounded-lg p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-mint">Alerts</p>
          <h2 className="mt-1 text-2xl font-black">Market tripwires</h2>
          <p className="mt-1 text-sm text-slate-400">Price moves, AI rating changes, earnings, and breaking news.</p>
        </div>
        <Bell className="h-6 w-6 text-mint" />
      </div>

      <div className="mt-5 rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_0.85fr_7rem_auto]">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-md border border-line bg-white/[0.04] px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-500"
                placeholder="Search alert stock"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedAlertStock(null);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  commitAlert();
                }}
              />
            </div>
            {open && (query || suggestions.length > 0) && (
              <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-md border border-line bg-[#fbf3df] shadow-[5px_5px_0_#182018]">
                {suggestions.map((stock) => (
                  <button
                    key={`alert-search-${stock.ticker}`}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-bold hover:bg-white/60"
                    onClick={() => {
                      setSelectedAlertStock(stock);
                      setQuery(`${stock.name} (${stock.ticker})`);
                      setOpen(false);
                    }}
                  >
                    <span>{stock.name}</span>
                    <span className="text-slate-400">{stock.ticker}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            className="rounded-md border border-line bg-white/[0.04] px-3 py-2 text-sm font-black outline-none"
            value={type}
            onChange={(event) => setType(event.target.value as StockAlert["type"])}
          >
            <option value="price_above">Price above</option>
            <option value="price_below">Price below</option>
            <option value="ai_score">AI score change</option>
            <option value="earnings">Earnings</option>
            <option value="news">Breaking news</option>
          </select>
          <input
            className="rounded-md border border-line bg-white/[0.04] px-3 py-2 text-sm font-bold outline-none disabled:opacity-45"
            disabled={!needsTarget}
            min="0"
            step="0.01"
            type="number"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              commitAlert();
            }}
            placeholder={type === "ai_score" ? "Score" : "Target"}
          />
          <button
            className={`shine-button rounded-md px-4 py-2 text-sm font-black ${
              stockMatch || suggestions.length ? "bg-mint text-ink" : "cursor-not-allowed bg-slate-300 text-slate-600"
            }`}
            disabled={!stockMatch && !suggestions.length}
            onClick={commitAlert}
          >
            Add alert
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {alerts.length === 0 ? (
          <div className="rounded-md border border-line bg-white/[0.03] p-4 text-sm text-slate-400 light:bg-white">
            No alerts yet. Add one above and it will stay saved with the account.
          </div>
        ) : (
          alerts.map((alert) => {
            const stock = universe.find((item) => item.ticker === alert.ticker);
            return (
              <div key={alert.id} className="soft-card rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{alert.ticker}</p>
                    <p className="mt-1 text-sm font-bold text-slate-400">{labelForAlert(alert)}</p>
                    {stock && <p className="mt-2 text-xs text-slate-400">Current: {formatCurrency(stock.price)} • AI {stock.aiScore}</p>}
                  </div>
                  <button className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-400 hover:text-danger" onClick={() => onRemoveAlert(alert.id)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function StockRankerApp() {
  const [selected, setSelected] = useState(stocks[0]);
  const [liveStocks, setLiveStocks] = useState(stocks);
  const [light, setLight] = useState(false);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] = useState("");
  const [persistenceUserId, setPersistenceUserId] = useState("");
  const [hasLoadedUserState, setHasLoadedUserState] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedStock = liveStocks.find((stock) => stock.ticker === selected.ticker) ?? selected;
  const gainers = [...liveStocks].sort((a, b) => b.change - a.change);
  const losers = [...liveStocks].sort((a, b) => a.change - b.change);
  const active = [...liveStocks].sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));
  const watchlist = liveStocks.filter((stock) => watchlistTickers.includes(stock.ticker));

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const timer = window.setTimeout(() => setToastVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketData() {
      try {
        const symbols = stocks.map((stock) => stock.ticker).join(",");
        const response = await fetch(`/api/market-data?symbols=${encodeURIComponent(symbols)}`);
        if (!response.ok) throw new Error("Unable to load market data");
        const data = (await response.json()) as { quotes?: MarketQuote[] };
        const quotes = data.quotes ?? [];
        if (!quotes.length || cancelled) return;

        setLiveStocks((current) =>
          current.map((stock) => {
            const quote = quotes.find((item) => item.ticker === stock.ticker);
            if (!quote) return stock;
            const price = typeof quote.price === "number" ? quote.price : stock.price;
            return {
              ...stock,
              price,
              change: typeof quote.change === "number" ? Number(quote.change.toFixed(2)) : stock.change,
              day: typeof quote.change === "number" ? Number(quote.change.toFixed(2)) : stock.day,
              high52: typeof quote.dayHigh === "number" && quote.dayHigh > 0 ? Math.max(stock.high52, quote.dayHigh) : stock.high52,
              low52: typeof quote.dayLow === "number" && quote.dayLow > 0 ? Math.min(stock.low52, quote.dayLow) : stock.low52,
              chart: [...stock.chart.slice(1), Number(price.toFixed(2))]
            };
          })
        );
      } catch {
        // Static seed data remains available when no market API key is configured.
      }
    }

    loadMarketData();
    const interval = window.setInterval(loadMarketData, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUserState() {
      const userId = authenticatedUserId || getBrowserUserId();
      const localState = readLocalUserState(userId);

      setHasLoadedUserState(false);
      setPersistenceUserId(userId);
      setWatchlistTickers(localState.watchlistTickers);
      setPortfolio(localState.portfolio);
      setAlerts(localState.alerts);

      try {
        const response = await fetch(`/api/user-state?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Unable to load user state");
        const data = (await response.json()) as Partial<PersistedUserState> & { configured?: boolean };
        if (!cancelled && data.configured) {
          setWatchlistTickers(Array.isArray(data.watchlistTickers) ? data.watchlistTickers : []);
          setPortfolio(Array.isArray(data.portfolio) ? data.portfolio : []);
          setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        }
      } catch {
        // Local browser persistence keeps the app usable if the production database is not configured yet.
      } finally {
        if (!cancelled) setHasLoadedUserState(true);
      }
    }

    loadUserState();
    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId]);

  useEffect(() => {
    if (!hasLoadedUserState || !persistenceUserId) return;
    const state = { watchlistTickers, portfolio, alerts };
    writeLocalUserState(persistenceUserId, state);

    const timeout = window.setTimeout(() => {
      fetch("/api/user-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: persistenceUserId, ...state })
      }).catch(() => {
        // Local browser persistence already saved the latest state.
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [hasLoadedUserState, persistenceUserId, watchlistTickers, portfolio, alerts]);

  function showToast(message: string) {
    setToast({ message, id: Date.now() });
  }

  function addToWatchlist(stock: Stock) {
    setWatchlistTickers((current) => (current.includes(stock.ticker) ? current : [...current, stock.ticker]));
    showToast(`${stock.ticker} added to watchlist`);
  }

  function toggleWatchlist(stock: Stock) {
    setWatchlistTickers((current) => {
      if (current.includes(stock.ticker)) {
        showToast(`${stock.ticker} removed from watchlist`);
        return current.filter((ticker) => ticker !== stock.ticker);
      }
      showToast(`${stock.ticker} added to watchlist`);
      return [...current, stock.ticker];
    });
  }

  function createMomentumWatchlist() {
    const topGainerTickers = gainers.slice(0, 3).map((stock) => stock.ticker);
    setWatchlistTickers((current) => Array.from(new Set([...current, ...topGainerTickers])));
    showToast("Created Momentum watchlist from top gainers");
  }

  function addHolding(stock: Stock, mode: "shares" | "dollars", amount: number) {
    const cleanAmount = Number.isFinite(amount) && amount > 0 ? amount : stock.price;
    const shares = mode === "shares" ? cleanAmount : cleanAmount / stock.price;
    setPortfolio((current) => {
      const existing = current.find((holding) => holding.ticker === stock.ticker);
      if (existing) {
        return current.map((holding) =>
          holding.ticker === stock.ticker ? { ...holding, shares: holding.shares + shares } : holding
        );
      }
      return [...current, { ticker: stock.ticker, shares }];
    });
    showToast(`${stock.ticker} added to portfolio`);
  }

  function updateHolding(ticker: string, shares: number) {
    const cleanShares = Number.isFinite(shares) && shares > 0 ? shares : 0;
    setPortfolio((current) =>
      cleanShares === 0
        ? current.filter((holding) => holding.ticker !== ticker)
        : current.map((holding) => (holding.ticker === ticker ? { ...holding, shares: cleanShares } : holding))
    );
    showToast(`${ticker} holding updated`);
  }

  function removeHolding(ticker: string) {
    setPortfolio((current) => current.filter((holding) => holding.ticker !== ticker));
    showToast(`${ticker} removed from portfolio`);
  }

  function addAlert(alert: Omit<StockAlert, "id">) {
    setAlerts((current) => [
      ...current,
      {
        ...alert,
        id: `${alert.ticker}-${alert.type}-${Date.now()}`
      }
    ]);
    showToast(`${alert.ticker} alert added`);
  }

  function removeAlert(id: string) {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    showToast("Alert removed");
  }

  function focusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="editorial-market min-h-screen overflow-hidden">
      <AuthIdentityBridge onUserId={setAuthenticatedUserId} />
      <header className="sticky top-0 z-40 border-b border-line bg-ink/82 shadow-bloom backdrop-blur-xl light:bg-white/86">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:py-4">
          <nav className="hidden items-center gap-5 text-sm font-bold text-slate-300 lg:flex light:text-slate-700">
            <a href="#dashboard">Dashboard</a>
            <a href="#markets">Markets</a>
            <a href="#rankings">Rankings</a>
            <a href="#analysis">Analysis</a>
            <a href="#portfolio">Portfolio</a>
            <a href="#alerts">Alerts</a>
          </nav>
          <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto text-xs font-black text-slate-300 lg:hidden light:text-slate-700">
            <a className="shrink-0 rounded-full border border-line bg-white/[0.04] px-3 py-1.5" href="#dashboard">Dashboard</a>
            <a className="shrink-0 rounded-full border border-line bg-white/[0.04] px-3 py-1.5" href="#markets">Markets</a>
            <a className="shrink-0 rounded-full border border-line bg-white/[0.04] px-3 py-1.5" href="#portfolio">Portfolio</a>
            <a className="shrink-0 rounded-full border border-line bg-white/[0.04] px-3 py-1.5" href="#alerts">Alerts</a>
          </nav>
          <button aria-label="Toggle theme" className="ml-auto flex h-10 w-10 items-center justify-center rounded-md border border-line lg:ml-0" onClick={() => setLight((value) => !value)}>
            {light ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <AuthControls />
        </div>
      </header>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-mint/30 bg-ink/90 px-4 py-2 text-sm font-bold text-mint shadow-glow backdrop-blur-xl transition-all duration-500 ${
            toastVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
          onTransitionEnd={() => {
            if (!toastVisible) setToast(null);
          }}
        >
          {toast.message}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 lg:py-10">
        <section className="relative grid min-h-[520px] items-center gap-8 py-4 sm:min-h-[620px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="pointer-events-none absolute right-4 top-8 hidden rotate-6 border border-ink/30 bg-[#d82418] px-5 py-2 font-serif text-5xl italic text-[#fff8e7] shadow-[6px_6px_0_#182018] lg:block">
            market field notes
          </div>
          <div className="pointer-events-none absolute bottom-12 left-[42%] hidden h-24 w-44 -rotate-3 border border-ink/25 bg-[#315f35] opacity-90 shadow-[5px_5px_0_#182018] lg:block" />
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-3 py-1.5 text-sm font-bold text-mint shadow-glow">
              <CandlestickChart className="h-4 w-4" />
              strange little stock intelligence, printed fresh
            </div>
            <h1 className="max-w-4xl bg-gradient-to-br from-white via-slate-100 to-mint bg-clip-text text-4xl font-black leading-[1.02] text-transparent sm:text-6xl lg:text-7xl light:from-slate-950 light:via-slate-800 light:to-ocean">
              Trading Floor, 9:30 AM
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300 light:text-slate-700">
              Market insights provided by Rakee Capital.
            </p>
            <div className="mt-7">
              <SearchBox
                inputRef={searchInputRef}
                universe={liveStocks}
                onSelect={setSelected}
                onAddToWatchlist={addToWatchlist}
                watchlistTickers={watchlistTickers}
              />
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="shine-button rounded-md bg-mint px-5 py-3 font-black text-ink" onClick={focusSearch}>Search Stocks</button>
              <a href="#rankings" className="rounded-md border border-line bg-white/5 px-5 py-3 font-black transition hover:border-mint/40 hover:bg-white/10">Explore Rankings</a>
            </div>
          </div>
          <div className="glass premium-ring rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Highest Rated Stocks</p>
                <h2 className="mt-1 text-2xl font-black">AI conviction board</h2>
              </div>
              <LineChart className="h-7 w-7 text-mint" />
            </div>
            <div className="mt-5 space-y-3">
              {[...liveStocks].sort((a, b) => b.aiScore - a.aiScore).slice(0, 5).map((stock) => (
                <button
                  key={`popular-${stock.ticker}`}
                  className="soft-card flex w-full items-center gap-3 rounded-md border border-line bg-white/[0.04] p-3 text-left light:bg-white"
                  onClick={() => setSelected(stock)}
                >
                  <LogoMark stock={stock} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{stock.name}</p>
                    <p className="text-sm text-slate-400">{stock.ticker} • {stock.marketCap}</p>
                  </div>
                  <MiniChart values={stock.chart} positive={stock.change >= 0} />
                  <div className="text-right">
                    <p className="font-black text-mint">{stock.aiScore}</p>
                    <p className="text-xs text-slate-400">{stock.recommendation}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-8">
          <Dashboard selected={selectedStock} saved={watchlistTickers.includes(selectedStock.ticker)} onToggleWatchlist={toggleWatchlist} />

          <section id="markets" className="grid gap-5 xl:grid-cols-3">
            <StockTable title="Top Gainers" icon={<TrendingUp className="h-5 w-5 text-mint" />} items={gainers} watchlistTickers={watchlistTickers} onAddToWatchlist={addToWatchlist} onSelect={setSelected} />
            <StockTable title="Top Losers" icon={<TrendingDown className="h-5 w-5 text-danger" />} items={losers} watchlistTickers={watchlistTickers} onAddToWatchlist={addToWatchlist} onSelect={setSelected} />
            <StockTable title="Most Active" icon={<CircleDollarSign className="h-5 w-5 text-ocean" />} items={active} watchlistTickers={watchlistTickers} onAddToWatchlist={addToWatchlist} onSelect={setSelected} />
          </section>

          <Rankings universe={liveStocks} onSelect={setSelected} />
          <DetailPanel selected={selectedStock} />
          <WatchlistPortfolio
            watchlist={watchlist}
            portfolio={portfolio}
            universe={liveStocks}
            onAddToWatchlist={addToWatchlist}
            onRemove={(ticker) => setWatchlistTickers((current) => current.filter((item) => item !== ticker))}
            onCreateWatchlist={createMomentumWatchlist}
            onAddHolding={addHolding}
            onUpdateHolding={updateHolding}
            onRemoveHolding={removeHolding}
            onSelect={setSelected}
          />
          <AlertsSection alerts={alerts} universe={liveStocks} onAddAlert={addAlert} onRemoveAlert={removeAlert} />

          <section className="glass premium-ring rounded-lg p-5">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["Premium AI Analysis", "Advanced scoring, portfolio optimization, smart recommendations, and institutional rankings."],
                ["Real-Time Alerts", "Price moves, AI rating changes, earnings events, breaking news, email, and push alerts."],
                ["Platform Integrations", "Designed for PostgreSQL, Prisma, Clerk/Auth.js, OpenAI scoring, TradingView, and Stripe."]
              ].map(([title, body]) => (
                <div key={title} className="soft-card rounded-md border border-line bg-white/[0.03] p-4 light:bg-white">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="pb-3 text-center text-[11px] leading-5 text-slate-500 light:text-slate-600">
            Fine print: investing in stocks always involves risk, including the possible loss of money.
            AI ratings, market data, rankings, and analysis on Trading Floor, 9:30 are not absolute,
            guaranteed, or personal financial advice. Always do your own research before buying or selling.
          </p>
        </div>
      </div>
    </main>
  );
}
