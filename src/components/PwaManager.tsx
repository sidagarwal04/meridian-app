"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "meridian-pwa-banner-dismissed";
const DISMISS_DAYS = 7;

function isBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function dismissBannerForWeek() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
  } catch {
    // ignore storage errors
  }
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [updateToast, setUpdateToast] = useState(false);
  const refreshingRef = useRef(false);

  // Detect mobile device, standalone mode, and beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkEnvironment = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(standalone);

      const ua = window.navigator.userAgent || "";
      const iosDevice =
        /iPad|iPhone|iPod/.test(ua) ||
        (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
      setIsIos(iosDevice);

      const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua) || iosDevice;
      const mobileViewport = window.matchMedia("(max-width: 820px) and (pointer: coarse)").matches;
      setIsMobile(mobileUa || mobileViewport);
    };

    checkEnvironment();
    setDismissed(isBannerDismissed());

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onChange = () => checkEnvironment();
    mediaQuery.addEventListener?.("change", onChange);

    const onBeforeInstallPrompt = (e: Event) => {
      const ua = window.navigator.userAgent || "";
      const isMobileDevice =
        /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
        window.matchMedia("(max-width: 820px) and (pointer: coarse)").matches;
      if (!isMobileDevice) return;
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowIosGuide(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      mediaQuery.removeEventListener?.("change", onChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Register Service Worker & handle automatic updates
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let updateInterval: ReturnType<typeof setInterval> | null = null;

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setUpdateToast(true);
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        reg = registration;

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        updateInterval = setInterval(() => {
          registration.update().catch(() => {});
        }, 5 * 60 * 1000);
      })
      .catch(() => {});

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && reg) {
        reg.update().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
          setIsStandalone(true);
        } else {
          dismissBannerForWeek();
          setDismissed(true);
        }
      } catch {
        // user dismissed
      }
      return;
    }
    if (isIos) {
      setShowIosGuide((prev) => !prev);
    }
  }, [deferredPrompt, isIos]);

  const handleDismiss = useCallback(() => {
    dismissBannerForWeek();
    setDismissed(true);
    setShowIosGuide(false);
  }, []);

  const showMobilePrompt = isMobile && !isStandalone && !dismissed && (Boolean(deferredPrompt) || isIos);

  return (
    <>
      {children}

      {updateToast ? (
        <div className="pwa-toast" role="status" aria-live="polite">
          <span>✦ Updating Meridian to the latest version…</span>
        </div>
      ) : null}

      {showMobilePrompt ? (
        <div className="pwa-mobile-sheet" role="region" aria-label={t("installApp")}>
          <div className="pwa-mobile-sheet-row">
            <img
              src="/icon.svg"
              alt=""
              width={40}
              height={40}
              className="pwa-mobile-sheet-icon"
            />
            <div className="pwa-mobile-sheet-copy">
              <strong>Meridian</strong>
              <span>Install app for full-screen 3D route studio</span>
            </div>
            <div className="pwa-mobile-sheet-actions">
              <button
                type="button"
                className="btn primary sm"
                onClick={() => void handleInstallClick()}
              >
                {showIosGuide ? "Done" : "Install"}
              </button>
              <button
                type="button"
                className="pwa-mobile-sheet-close"
                aria-label="Dismiss install banner"
                onClick={handleDismiss}
              >
                ×
              </button>
            </div>
          </div>

          {showIosGuide && isIos ? (
            <div className="pwa-ios-inline-steps">
              <span>
                1. Tap <strong>Share</strong> <kbd className="pwa-kbd">⎋</kbd> in Safari
              </span>
              <span>
                2. Tap <strong>Add to Home Screen</strong> <kbd className="pwa-kbd">＋</kbd>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
