import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/hooks/useNotifications";

// Bell icon with unread count — opens the Inbox. Used in the customer
// dashboard and admin headers.
export function InboxBell() {
  const unread = useUnreadCount();
  return (
    <Link to="/dashboard/inbox" aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}>
      <Button variant="ghost" size="sm" className="relative text-muted-foreground hover:text-foreground">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
    </Link>
  );
}
