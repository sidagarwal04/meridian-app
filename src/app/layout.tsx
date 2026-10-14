import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#070B14",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://meridian.meetsid.dev"),
  title: {
    default: "Meridian — Travel map animations",
    template: "%s · Meridian",
  },
  description: "Turn your trip into a clear, beautiful map animation for sharing or presenting.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Meridian — Travel map animations",
    description:
      "Turn every journey into a cinematic 3D map video. Plot flights, high-speed trains, road trips, and sea crossings on an interactive 3D globe.",
    url: "https://meridian.meetsid.dev/",
    siteName: "Meridian",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1564,
        height: 676,
        alt: "Meridian — Turn every journey into a cinematic 3D map video",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meridian — Travel map animations",
    description:
      "Turn every journey into a cinematic 3D map video. Plot flights, high-speed trains, road trips, and sea crossings on an interactive 3D globe.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Meridian",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { url: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/pwa-icon?size=180", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{window.__meridianDeferredPrompt=null;window.addEventListener("beforeinstallprompt",function(e){var ua=navigator.userAgent||"";var m=/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)||(window.matchMedia&&window.matchMedia("(max-width: 820px) and (pointer: coarse)").matches);if(!m)return;e.preventDefault();window.__meridianDeferredPrompt=e;window.dispatchEvent(new Event("meridian:pwa-prompt-ready"));});if("serviceWorker"in navigator){navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(function(){});}}catch(_){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
