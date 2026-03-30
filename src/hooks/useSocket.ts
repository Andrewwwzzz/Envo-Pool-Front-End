import { useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const SOCKET_URL = "https://api.envopoolsg.com";

let socketInstance: Socket | null = null;

// Global listeners for components to subscribe to specific booking updates
type BookingListener = (bookingId: string, status: string) => void;
const bookingListeners = new Set<BookingListener>();

// Global listeners for points updates
type PointsListener = (earned: number, total: number) => void;
const pointsListeners = new Set<PointsListener>();

export function onBookingUpdated(listener: BookingListener) {
  bookingListeners.add(listener);
  return () => { bookingListeners.delete(listener); };
}

export function onPointsUpdated(listener: PointsListener) {
  pointsListeners.add(listener);
  return () => { pointsListeners.delete(listener); };
}

export function useSocket() {
  const queryClient = useQueryClient();
  const { refreshUser, token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketInstance = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    // New event name from backend
    socket.on("bookingUpdated", (payload: any) => {
      console.log("Socket: bookingUpdated", payload);
      const bookingId = payload?.bookingId;
      const status = payload?.status;

      // Notify all listeners (e.g. PaymentVerification page)
      if (bookingId && status) {
        bookingListeners.forEach((fn) => fn(bookingId, status));
      }

      // Refresh booking-related queries
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booking-logs"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
    });

    socket.on("walletUpdated", (payload: any) => {
      console.log("Socket: walletUpdated", payload);
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
    });

    socket.on("pointsUpdated", (payload: any) => {
      console.log("Socket: pointsUpdated", payload);
      const earned = payload?.earned ?? 0;
      const total = payload?.points ?? 0;

      // Notify listeners (e.g. BookingConfirmed page)
      pointsListeners.forEach((fn) => fn(earned, total));

      // Refresh user data
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
    });

    // Keep old events as fallback in case backend still emits them
    socket.on("booking_updated", () => {
      console.log("Socket: booking_updated (legacy)");
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booking-logs"] });
    });

    socket.on("users_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    });

    socket.on("wallet_updated", () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
    });

    socket.on("transaction_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketInstance = null;
    };
  }, [token, queryClient, refreshUser]);
}
