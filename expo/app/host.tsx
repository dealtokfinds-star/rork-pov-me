/**
 * host.tsx — real broadcast surface.
 * Launched from golive.tsx after a real Mux Live Stream is provisioned.
 * Renders HostScreen with the stream config + RTMP key passed via search params.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import HostScreen from "@/components/HostScreen";
import { CATEGORIES } from "@/constants/mock-data";
import type { PovCategory, StreamAccess } from "@/types";

export default function HostRoute(): React.ReactElement | null {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title: string;
    category: string;
    access: string;
    ppvPrice: string;
    streamId: string;
    rtmpUrl: string;
    rtmpKey: string;
    hlsUrl: string;
    source: string;
  }>();

  const category = (
    CATEGORIES.find((c) => c.id === params.category) ? params.category : "founder"
  ) as PovCategory;
  const access = (params.access ?? "public") as StreamAccess;
  const ppvPrice = params.ppvPrice ? parseFloat(params.ppvPrice) : undefined;

  return (
    <HostScreen
      title={params.title ?? "Untitled POV stream"}
      category={category}
      access={access}
      ppvPrice={ppvPrice}
      streamId={params.streamId ?? null}
      rtmpUrl={params.rtmpUrl ?? null}
      rtmpKey={params.rtmpKey ?? null}
      hlsUrl={params.hlsUrl ?? null}
      source={(params.source ?? "chest") as "chest" | "phone" | "desktop"}
      onStreamEnded={() => {
        router.replace("/(tabs)/studio");
      }}
    />
  );
}
