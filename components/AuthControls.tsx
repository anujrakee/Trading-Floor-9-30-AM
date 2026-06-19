"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect } from "react";

export default function AuthControls() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!clerkEnabled) {
    return (
      <div className="rounded-full border border-line bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-400">
        Auth ready
      </div>
    );
  }

  return <ClerkAuthControls />;
}

function ClerkAuthControls() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <SignInButton mode="modal">
      <button className="shine-button rounded-md bg-mint px-4 py-2 text-sm font-black text-ink">Sign in</button>
    </SignInButton>
  );
}

export function AuthIdentityBridge({ onUserId }: { onUserId: (userId: string) => void }) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!clerkEnabled) {
    return null;
  }

  return <ClerkIdentityBridge onUserId={onUserId} />;
}

function ClerkIdentityBridge({ onUserId }: { onUserId: (userId: string) => void }) {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    onUserId(user?.id ? `clerk:${user.id}` : "");
  }, [isLoaded, onUserId, user?.id]);

  return null;
}
