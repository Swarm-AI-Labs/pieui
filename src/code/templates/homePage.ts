export const homePageTemplate = `"use client";

import PiePage from "@/app/_shared/page";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense fallback={<></>}>
      <PiePage />
    </Suspense>
  );
}
`
