import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

// Tapping a phone notification opens the app with ?n=<notificationId>.
// Records that as "opened from the phone notification" (announcement
// analytics), then strips the parameter from the address bar.
export function NotificationTapTracker() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("n");
    if (!id || !user) return;
    apiFetch(`/api/notifications/${id}/read`, { method: "POST", body: JSON.stringify({ via: "push" }) })
      .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => {});
    params.delete("n");
    const qs = params.toString();
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "", hash: location.hash }, { replace: true });
  }, [location.search, user]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
