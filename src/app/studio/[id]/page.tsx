"use client";

import dynamic from "next/dynamic";

const Studio = dynamic(() => import("@/components/Studio").then((mod) => mod.Studio), {
  ssr: false,
  loading: () => <div className="studio-loading">Opening studio…</div>,
});

export default function Page() {
  return <Studio />;
}
