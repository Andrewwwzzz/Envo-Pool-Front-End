import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useOperatingHours,
  useSaveOperatingHours,
  DAY_NAMES,
  DEFAULT_SCHEDULE,
  type WeekSchedule,
} from "@/hooks/useOperatingHours";

export function OperatingHoursSection() {
  const { data, isLoading } = useOperatingHours();
  const save = useSaveOperatingHours();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  useEffect(() => {
    if (data) setSchedule(data);
  }, [data]);

  const updateDay = (idx: number, patch: Partial<WeekSchedule[string]>) => {
    setSchedule((prev) => ({
      ...prev,
      [String(idx)]: { ...prev[String(idx)], ...patch },
    }));
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync(schedule);
      toast({ title: "Operating hours saved" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="text-lg">Operating Hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Close time can be past midnight (e.g. 04:00 means 4 AM the next day).
        </p>
        <div className="space-y-2">
          {DAY_NAMES.map((name, idx) => {
            const day = schedule[String(idx)] ?? DEFAULT_SCHEDULE[String(idx)];
            return (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[140px_120px_1fr_1fr] gap-3 items-center border rounded-lg p-3"
              >
                <div className="font-medium">{name}</div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.open}
                    onCheckedChange={(v) => updateDay(idx, { open: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {day.open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Open</Label>
                  <Input
                    type="time"
                    value={day.openTime}
                    disabled={!day.open}
                    onChange={(e) => updateDay(idx, { openTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Close</Label>
                  <Input
                    type="time"
                    value={day.closeTime}
                    disabled={!day.open}
                    onChange={(e) => updateDay(idx, { closeTime: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={save.isPending || isLoading}>
            {save.isPending ? "Saving…" : "Save Operating Hours"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
