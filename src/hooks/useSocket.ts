import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const SOCKET_URL = "https://api.envopoolsg.com";

export function useSocket() {
  const queryClient = useQueryClient();
  const { refreshUser, token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("booking_updated", () => {
      console.log("Socket: booking_updated");
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booking-logs"] });
    });

    socket.on("users_updated", () => {
      console.log("Socket: users_updated");
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    });

    socket.on("wallet_updated", () => {
      console.log("Socket: wallet_updated");
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
    });

    socket.on("transaction_updated", () => {
      console.log("Socket: transaction_updated");
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
    };
  }, [token, queryClient, refreshUser]);
}
