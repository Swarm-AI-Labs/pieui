export const sharedPageTemplate = `"use client";

import { useRouter } from "next/navigation";
import { PieRoot } from "@swarm.ing/pieui";
import "@/piecomponents/registry";
import { usePathname, useSearchParams } from "next/navigation";

export default function PiePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <PieRoot
      location={{ pathname, search }}
      config={{
        apiServer: process.env.PIE_API_SERVER!,
        centrifugeServer: process.env.PIE_CENTRIFUGE_SERVER!,
        enableRenderingLog: true,
      }}
      onNavigate={(url) => router.push(url)}
      fallback={<></>}
    />
  );
}
`
