import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";

type DeviceState = "ON" | "OFF" | null;

interface DeviceStatus {
  state: DeviceState;
  loading: boolean;
  error: string | null;
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
      const res = await apiFetch(`/api/device/${hardwareId}`);
      const data = await res.json();
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
      await apiFetch(`/api/device-control/control/${hardwareId}`, {
        method: "POST",
        body: JSON.stringify({ state }),
      });
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
      await apiFetch(`/api/device-control/clear/${hardwareId}`, {
        method: "POST",
      });
    } catch (err: any) {
      console.error("Clear override error:", err.message);
    } finally {
      setPending(false);
    }
  }, [hardwareId]);

  return { controlDevice, clearOverride, pending };
}
