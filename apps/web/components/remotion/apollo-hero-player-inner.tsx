"use client";

import { Player } from "@remotion/player";
import { ApolloHeroVideo } from "@/remotion/ApolloHeroVideo";

export default function ApolloHeroPlayerInner() {
  return (
    <Player
      component={ApolloHeroVideo}
      durationInFrames={900}
      fps={30}
      compositionWidth={1280}
      compositionHeight={800}
      autoPlay
      loop
      style={{
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
      }}
      controls={false}
      clickToPlay={false}
      acknowledgeRemotionLicense
    />
  );
}
