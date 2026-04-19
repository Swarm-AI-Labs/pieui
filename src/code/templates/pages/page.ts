export const pageTemplate = (pageComponentName: string): string => `"use client";

import PiePage from "@/app/_shared/page";
import { Suspense } from "react";

export default function ${pageComponentName}() {
  return (
    <Suspense fallback={<></>}>
      <PiePage />
    </Suspense>
  );
}
`
