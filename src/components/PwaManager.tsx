"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type PwaContextValue = {
  isStandalone: boolean;
  canInstall: boolean;
  isIos: boolean;
  showIosModal: boolean;
  setShowIosModal: (open: boolean) => void;
  triggerInstall: () => Promise<void>;
};

const PwaContext = createContext<PwaContextValue>({
  isStandalone: false,
  canInstall: false,
  isIos: false,
  showIosModal: false,
  setShowIosModal: () => {},
  triggerInstall: async () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [updateToast, setUpdateToast] = useState(false);
  const refreshingRef = useRef(false);

  // Detect standalone mode & iOS Safari
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(standalone);
    };

    checkStandalone();

    const ua = window.navigator.userAgent || "";
    const iosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIos(iosDevice);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onChange = () => checkStandalone();
    mediaQuery.addEventListener?.("change", onChange);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowIosModal(false);
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

        // Periodically check for updates every 5 minutes and whenever tab regains focus
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

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch {
        // user dismissed
      }
      return;
    }
    setShowIosModal(true);
  }, [deferredPrompt]);

  const canInstall = !isStandalone && (Boolean(deferredPrompt) || isIos);

  const value = useMemo<PwaContextValue>(
    () => ({
      isStandalone,
      canInstall,
      isIos,
      showIosModal,
      setShowIosModal,
      triggerInstall,
    }),
    [isStandalone, canInstall, isIos, showIosModal, triggerInstall]
  );

  return (
    <PwaContext.Provider value={value}>
      {children}

      {updateToast ? (
        <div className="pwa-toast" role="status" aria-live="polite">
          <span>✦ Updating Meridian to the latest version…</span>
        </div>
      ) : null}

      {showIosModal ? (
        <div className="pwa-modal-backdrop" onClick={() => setShowIosModal(false)}>
          <div
            className="pwa-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pwa-modal-head">
              <strong id="pwa-install-title">📲 Install Meridian as an App</strong>
              <button
                type="button"
                className="action-btn"
                aria-label="Close"
                onClick={() => setShowIosModal(false)}
              >
                ×
              </button>
            </div>
            {isIos ? (
              <div className="pwa-modal-steps">
                <p>Install Meridian on your iPhone or iPad for a full-screen studio experience:</p>
                <ol>
                  <li>
                    Tap the <strong>Share</strong> button <span className="pwa-kbd">⎋</span> in Safari’s toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong> <span className="pwa-kbd">＋</span>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> in the top-right corner.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="pwa-modal-steps">
                <p>To install Meridian as a standalone app on your device:</p>
                <ol>
                  <li>
                    Open your browser’s address bar or menu (<span className="pwa-kbd">⋮</span>).
                  </li>
                  <li>
                    Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                </ol>
              </div>
            )}
            <div className="pwa-modal-actions">
              <button type="button" className="btn primary sm" onClick={() => setShowIosModal(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PwaContext.Provider>
  );
}
