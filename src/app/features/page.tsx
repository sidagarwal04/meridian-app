import type { Metadata } from "next";
import { FeatureList } from "@/components/FeatureList";

export const metadata: Metadata = { title: "Features" };

export default function Page() {
  return <FeatureList />;
}
