"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "@/lib/api";

export type NativeInventoryState = {
  enabled: boolean;
  productCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const NativeInventoryContext = createContext<NativeInventoryState | null>(null);

export function NativeInventoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ enabled: boolean; productCount: number }>(
        "/v1/admin/commerce-inventory-mode",
      );
      setEnabled(d.enabled);
      setProductCount(d.productCount);
    } catch {
      setEnabled(false);
      setProductCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <NativeInventoryContext.Provider
      value={{ enabled, productCount, loading, refresh }}
    >
      {children}
    </NativeInventoryContext.Provider>
  );
}

export function useNativeInventory(): NativeInventoryState {
  const ctx = useContext(NativeInventoryContext);
  if (!ctx) {
    throw new Error("useNativeInventory requires NativeInventoryProvider");
  }
  return ctx;
}
