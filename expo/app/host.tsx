/**
 * host.tsx — real camera broadcast surface.
 * Launched from golive.tsx when the creator picks "This phone" as the source.
 * Renders HostScreen with the stream config passed via search params.
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
      onStreamEnded={() => {
        // Could route to a replay-publish flow; for now head back to Studio.
        router.replace("/(tabs)/studio");
      }}
    />
  );
}
