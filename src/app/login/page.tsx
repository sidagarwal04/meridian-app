import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function Page() {
  const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <Suspense fallback={null}>
      <LoginForm googleReady={googleReady} />
    </Suspense>
  );
}
