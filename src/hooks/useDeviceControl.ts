import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type DeviceState = "ON" | "OFF" | null;

interface DeviceStatus {
  state: DeviceState;
  loading: boolean;
  error: string | null;
}

async function callDeviceControl(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("device-control", { body: payload });
  if (error) throw new Error(error.message || "Device control request failed");
  return data;
}

export function useDeviceState(hardwareId: string | null | undefined, pollInterval = 3000) {
  const [status, setStatus] = useState<DeviceStatus>({ state: null, loading: false, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchState = useCallback(async () => {
    if (!hardwareId) return;
    try {
      const data: any = await callDeviceControl({ action: "status", hardwareId });
      if (mountedRef.current) {
        setStatus({ state: (data?.state ?? null) as DeviceState, loading: false, error: null });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setStatus((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    }
  }, [hardwareId]);

  useEffect(() => {
    if (!hardwareId) {
      setStatus({ state: null, loading: false, error: null });
      return;
    }
    setStatus((prev) => ({ ...prev, loading: true }));
    fetchState();
    const id = setInterval(fetchState, pollInterval);
    return () => clearInterval(id);
  }, [hardwareId, pollInterval, fetchState]);

  return status;
}

export function useDeviceControl(hardwareId: string | null | undefined) {
  const [pending, setPending] = useState(false);

  const controlDevice = useCallback(async (state: "ON" | "OFF") => {
    if (!hardwareId) return;
    setPending(true);
    try {
      await callDeviceControl({ action: "control", hardwareId, state });
    } catch (err: any) {
      console.error("Device control error:", err.message);
    } finally {
      setPending(false);
    }
  }, [hardwareId]);

  const clearOverride = useCallback(async () => {
    if (!hardwareId) return;
    setPending(true);
    try {
      await callDeviceControl({ action: "clear", hardwareId });
    } catch (err: any) {
      console.error("Clear override error:", err.message);
    } finally {
      setPending(false);
    }
  }, [hardwareId]);

  return { controlDevice, clearOverride, pending };
}
