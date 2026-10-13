import type { Metadata } from "next";
import { ExamplesView } from "@/components/ExamplesView";

export const metadata: Metadata = { title: "Examples" };

export default function Page() {
  return <ExamplesView />;
}
