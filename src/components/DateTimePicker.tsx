import { useState, useMemo } from "react";
import { format, addMinutes, isBefore, isSameDay } from "date-fns";
import { nowSG, isTodaySG } from "@/lib/sgTime";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DateTimePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date | null;
  minTime?: Date | null; // if set, times before this on the same day are disabled
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}

const ALL_TIME_SLOTS = generateTimeSlots();

export function DateTimePicker({ label, value, onChange, minDate, minTime }: DateTimePickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = useMemo(() => {
    const sg = nowSG();
    sg.setHours(0, 0, 0, 0);
    return sg;
  }, []);
  const effectiveMinDate = minDate ? (() => { const d = new Date(minDate); d.setHours(0,0,0,0); return d; })() : today;

  const selectedDate = value ? startOfDay(value) : undefined;
  const selectedTimeStr = value
    ? `${value.getHours().toString().padStart(2, "0")}:${value.getMinutes().toString().padStart(2, "0")}`
    : "";

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return ALL_TIME_SLOTS;

    const now = new Date();
    const isSelectedToday = isToday(selectedDate);
    const minTimeDate = minTime && isSameDay(selectedDate, startOfDay(minTime)) ? minTime : null;

    return ALL_TIME_SLOTS.filter((slot) => {
      const [h, m] = slot.split(":").map(Number);
      const slotDate = new Date(selectedDate);
      slotDate.setHours(h, m, 0, 0);

      // Block past times if today
      if (isSelectedToday && isBefore(slotDate, now)) return false;

      // Block times before minTime on same day
      if (minTimeDate && isBefore(slotDate, minTimeDate)) return false;

      return true;
    });
  }, [selectedDate, minTime]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setCalendarOpen(false);
    if (value) {
      const combined = new Date(date);
      combined.setHours(value.getHours(), value.getMinutes(), 0, 0);
      // If combined is now in the past, clear time
      if (isBefore(combined, new Date())) {
        onChange(startOfDay(date));
      } else {
        onChange(combined);
      }
    } else {
      onChange(startOfDay(date));
    }
  };

  const handleTimeSelect = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const base = selectedDate ? new Date(selectedDate) : new Date();
    if (!selectedDate) {
      // auto-set to today
      const todayDate = new Date();
      base.setFullYear(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    }
    base.setHours(h, m, 0, 0);
    onChange(base);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {/* Date Picker */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !value && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "dd MMM yyyy") : "Pick date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => isBefore(date, effectiveMinDate)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Time Picker */}
        <Select value={selectedTimeStr} onValueChange={handleTimeSelect}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {availableTimeSlots.map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
