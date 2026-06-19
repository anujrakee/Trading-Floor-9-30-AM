import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

type UserStatePayload = {
  userId?: string;
  watchlistTickers?: string[];
  portfolio?: Holding[];
  alerts?: StockAlert[];
};

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function normalizeTickers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizePortfolio(value: unknown): Holding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const maybeHolding = item as Partial<Holding>;
      const ticker = typeof maybeHolding.ticker === "string" ? maybeHolding.ticker.trim().toUpperCase() : "";
      const shares = Number(maybeHolding.shares);
      if (!ticker || !Number.isFinite(shares) || shares <= 0) return null;
      return { ticker, shares };
    })
    .filter((item): item is Holding => Boolean(item));
}

function normalizeAlerts(value: unknown): StockAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const alert = item as Partial<StockAlert>;
      const ticker = typeof alert.ticker === "string" ? alert.ticker.trim().toUpperCase() : "";
      const type = alert.type;
      const validTypes = ["price_above", "price_below", "ai_score", "earnings", "news"];
      if (!ticker || !validTypes.includes(String(type))) return null;
      const target = Number(alert.target);
      return {
        id: typeof alert.id === "string" && alert.id ? alert.id : `${ticker}-${type}-${Date.now()}`,
        ticker,
        type: type as StockAlert["type"],
        ...(Number.isFinite(target) && target > 0 ? { target } : {})
      };
    })
    .filter((item): item is StockAlert => Boolean(item));
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ configured: false, watchlistTickers: [], portfolio: [], alerts: [] });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const state = await prisma.userState.findUnique({ where: { userId } });

  return NextResponse.json({
    configured: true,
    watchlistTickers: state?.watchlistTickers ?? [],
    portfolio: normalizePortfolio(state?.portfolio),
    alerts: normalizeAlerts(state?.alerts)
  });
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const body = (await request.json()) as UserStatePayload;
  const userId = typeof body.userId === "string" ? body.userId : "";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const watchlistTickers = normalizeTickers(body.watchlistTickers);
  const portfolio = normalizePortfolio(body.portfolio);
  const alerts = normalizeAlerts(body.alerts);

  await prisma.userState.upsert({
    where: { userId },
    create: {
      userId,
      watchlistTickers,
      portfolio,
      alerts
    },
    update: {
      watchlistTickers,
      portfolio,
      alerts
    }
  });

  return NextResponse.json({ configured: true, ok: true });
}
