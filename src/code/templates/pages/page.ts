export const pageTemplate = (pageComponentName: string): string => `"use client";

import PiePage from "@/app/_shared/simple";
import { Suspense } from "react";
import LoadingScreen from "@/components/LoadingScreen";

export default function ${pageComponentName}() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PiePage />
    </Suspense>
  );
}
`
