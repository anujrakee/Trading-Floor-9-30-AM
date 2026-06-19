import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stocks } from "@/lib/stocks";

type StockAlert = {
  id: string;
  ticker: string;
  type: "price_above" | "price_below" | "ai_score" | "earnings" | "news";
  target?: number;
};

type TriggeredAlert = {
  id: string;
  triggeredAt: string;
};

type ClerkUser = {
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string;
};

function normalizeAlerts(value: unknown): StockAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const alert = item as Partial<StockAlert>;
      if (!alert.id || !alert.ticker || !alert.type) return null;
      return {
        id: alert.id,
        ticker: alert.ticker.toUpperCase(),
        type: alert.type,
        ...(typeof alert.target === "number" ? { target: alert.target } : {})
      };
    })
    .filter((item): item is StockAlert => Boolean(item));
}

function normalizeTriggered(value: unknown): TriggeredAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const triggered = item as Partial<TriggeredAlert>;
      if (!triggered.id || !triggered.triggeredAt) return null;
      return { id: triggered.id, triggeredAt: triggered.triggeredAt };
    })
    .filter((item): item is TriggeredAlert => Boolean(item));
}

function shouldTrigger(alert: StockAlert) {
  const stock = stocks.find((item) => item.ticker === alert.ticker);
  if (!stock) return null;

  if (alert.type === "price_above" && typeof alert.target === "number" && stock.price >= alert.target) {
    return `${stock.ticker} is at ${formatMoney(stock.price)}, above your ${formatMoney(alert.target)} alert.`;
  }

  if (alert.type === "price_below" && typeof alert.target === "number" && stock.price <= alert.target) {
    return `${stock.ticker} is at ${formatMoney(stock.price)}, below your ${formatMoney(alert.target)} alert.`;
  }

  if (alert.type === "ai_score" && typeof alert.target === "number" && stock.aiScore >= alert.target) {
    return `${stock.ticker} has an AI score of ${stock.aiScore}/10, meeting your ${alert.target}/10 alert.`;
  }

  // Earnings/news alerts are saved now; production versions should connect these to real event/news feeds.
  return null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

async function getClerkEmail(userId: string) {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret || !userId.startsWith("clerk:")) return null;

  const clerkUserId = userId.replace("clerk:", "");
  const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    headers: { Authorization: `Bearer ${clerkSecret}` }
  });

  if (!response.ok) return null;
  const user = (await response.json()) as ClerkUser;
  const primary = user.email_addresses?.find((email) => email.id === user.primary_email_address_id);
  return primary?.email_address ?? user.email_addresses?.[0]?.email_address ?? null;
}

async function sendAlertEmail(to: string, subject: string, body: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Trading Floor Alerts <onboarding@resend.dev>",
      to,
      subject,
      text: body
    })
  });

  return response.ok;
}

export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, reason: "DATABASE_URL is not configured" }, { status: 200 });
  }

  const states = await prisma.userState.findMany();
  let sent = 0;
  let checked = 0;

  for (const state of states) {
    const alerts = normalizeAlerts(state.alerts);
    const triggered = normalizeTriggered(state.triggeredAlerts);
    const triggeredIds = new Set(triggered.map((alert) => alert.id));
    const email = await getClerkEmail(state.userId);
    const nextTriggered = [...triggered];

    if (!email) continue;

    for (const alert of alerts) {
      checked += 1;
      if (triggeredIds.has(alert.id)) continue;

      const message = shouldTrigger(alert);
      if (!message) continue;

      const didSend = await sendAlertEmail(email, `Trading Floor alert: ${alert.ticker}`, message);
      if (!didSend) continue;

      sent += 1;
      nextTriggered.push({ id: alert.id, triggeredAt: new Date().toISOString() });
    }

    if (nextTriggered.length !== triggered.length) {
      await prisma.userState.update({
        where: { userId: state.userId },
        data: { triggeredAlerts: nextTriggered }
      });
    }
  }

  return NextResponse.json({ ok: true, checked, sent });
}

export async function GET() {
  return POST();
}
