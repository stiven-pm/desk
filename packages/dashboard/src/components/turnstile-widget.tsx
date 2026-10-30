"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!siteKey || rendered.current || !hostRef.current) return;

    const mount = () => {
      if (!hostRef.current || !window.turnstile || rendered.current) return;
      rendered.current = true;
      window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        callback: onToken,
        "error-callback": onError,
      });
    };

    if (window.turnstile) {
      mount();
      return;
    }

    const existing = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]',
    );
    if (existing) {
      existing.addEventListener("load", mount);
      return () => existing.removeEventListener("load", mount);
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = mount;
    document.head.appendChild(script);
  }, [siteKey, onToken, onError]);

  return <div ref={hostRef} className="flex justify-center py-2" />;
}
