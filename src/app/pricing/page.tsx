import type { Metadata } from "next";
import { PricingView } from "@/components/PricingView";

export const metadata: Metadata = { title: "Pricing" };

export default function Page() {
  return <PricingView />;
}
