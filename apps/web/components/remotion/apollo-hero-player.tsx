"use client";

import dynamic from "next/dynamic";

const ApolloHeroPlayerInner = dynamic(
  () => import("./apollo-hero-player-inner"),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-video w-full rounded-xl border bg-card/50 animate-pulse"
        aria-label="Loading video preview"
      />
    ),
  }
);

export function ApolloHeroPlayer() {
  return <ApolloHeroPlayerInner />;
}
