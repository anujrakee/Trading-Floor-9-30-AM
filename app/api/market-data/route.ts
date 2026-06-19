import { NextResponse } from "next/server";
import { stocks } from "@/lib/stocks";

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ quotes: [] });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (!finnhubKey) {
    return NextResponse.json({
      configured: false,
      quotes: stocks
        .filter((stock) => symbols.includes(stock.ticker))
        .map((stock) => ({
          ticker: stock.ticker,
          price: stock.price,
          change: stock.change,
          high52: stock.high52,
          low52: stock.low52
        }))
    });
  }

  const fallbackQuotes = stocks
    .filter((stock) => symbols.includes(stock.ticker))
    .map((stock) => ({
      ticker: stock.ticker,
      price: stock.price,
      change: stock.change,
      high52: stock.high52,
      low52: stock.low52
    }));

  const quotes = await Promise.all(
    symbols.map(async (ticker) => {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`, {
          next: { revalidate: 60 }
        });

        if (!response.ok) return null;
        const quote = (await response.json()) as FinnhubQuote;
        if (!quote.c) return null;

        return {
          ticker,
          price: quote.c,
          dollarChange: quote.d ?? 0,
          change: quote.dp ?? 0,
          dayHigh: quote.h ?? null,
          dayLow: quote.l ?? null
        };
      } catch {
        return null;
      }
    })
  );

  const liveQuotes = quotes.filter(Boolean);

  return NextResponse.json({
    configured: true,
    live: liveQuotes.length > 0,
    quotes: liveQuotes.length > 0 ? liveQuotes : fallbackQuotes
  });
}
