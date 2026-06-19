"use client";

import { ClerkProvider } from "@clerk/nextjs";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkKey) {
    return <>{children}</>;
  }

  return <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider>;
}
