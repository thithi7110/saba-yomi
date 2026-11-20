"use client";

import { useEffect } from "react";

/** 本番ビルドでのみ Service Worker を登録し、オフラインでも遊べるようにする */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
