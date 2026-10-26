"use client";

import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/features/workspace/client";
import type { CrmData } from "./model";

export function useCrmData() {
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await requestJson<CrmData>("/api/admin/crm")); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el panel"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const interval = setInterval(onFocus, 30000);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  return { data, error, loading, refresh };
}
