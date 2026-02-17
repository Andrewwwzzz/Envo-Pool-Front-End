import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useTables, useCreateBooking, TableStatus } from "@/hooks/useBooking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogOut, Clock, CalendarDays } from "lucide-react";

const statusColor: Record<TableStatus, string> = {
  Available: "bg-green-500/15 text-green-700 border-green-300",
  Booked: "bg-destructive/15 text-destructive border-destructive/30",
  "Pending Payment": "bg-yellow-500/15 text-yellow-700 border-yellow-300",
};

const Booking = () => {
  const { user, loading, signOut } = useAuth();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const startDate = useMemo(() => (startTime ? new Date(startTime) : null), [startTime]);
  const endDate = useMemo(() => (endTime ? new Date(endTime) : null), [endTime]);

  const { data: tables, isLoading: tablesLoading } = useTables(startDate, endDate);
  const createBooking = useCreateBooking();

  const durationDisplay = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return null;
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hours`;
  }, [startDate, endDate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleBook = () => {
    if (!selectedTable || !startDate || !endDate) return;
    createBooking.mutate({ tableId: selectedTable, startTime: startDate, endTime: endDate });
  };

  const selectedTableData = tables?.find((t) => t.id === selectedTable);
  const canBook = selectedTable && startDate && endDate && endDate > startDate && selectedTableData?.status === "Available";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Book a Table</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-8">
        {/* Time Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" /> Select Time
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min={startTime}
              />
            </div>
            {durationDisplay && (
              <div className="sm:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Duration: {durationDisplay}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select a Table</CardTitle>
          </CardHeader>
          <CardContent>
            {tablesLoading ? (
              <p className="text-muted-foreground">Loading tables...</p>
            ) : !tables?.length ? (
              <p className="text-muted-foreground">No tables available.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => table.status === "Available" && setSelectedTable(table.id)}
                    disabled={table.status !== "Available"}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      selectedTable === table.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    } ${table.status !== "Available" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <p className="font-medium text-foreground">Table {table.table_number}</p>
                    <Badge variant="outline" className={`mt-2 text-xs ${statusColor[table.status]}`}>
                      {table.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Book Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!canBook || createBooking.isPending}
            onClick={handleBook}
          >
            {createBooking.isPending ? "Creating..." : "Book Table"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Booking;
