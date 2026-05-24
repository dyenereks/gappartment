"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Mounts inside the dashboard. As soon as Convex has authenticated, ensures
 * the Clerk user has a corresponding row in `users`. Idempotent.
 */
export default function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const sync = useMutation(api.users.sync);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !clerkUser) return;
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email;
    sync({
      name,
      email,
      imageUrl: clerkUser.imageUrl ?? null,
    }).catch((err) => {
      console.error("Failed to sync user to Convex:", err);
    });
  }, [isAuthenticated, isLoaded, clerkUser, sync]);

  return null;
}
