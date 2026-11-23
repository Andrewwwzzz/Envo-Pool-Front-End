import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { validateDuration } from "@/hooks/useBooking";
import { slotKeyToDate } from "@/lib/bookingDay";
import type { WeekSchedule } from "@/hooks/useOperatingHours";

const sgt = (s: string) => new Date(`${s}+08:00`);
const DAY = sgt("2026-11-24T00:00:00");

// Open 10:00, public close 02:00 every day; 02:00–10:00 is members-only.
const hours: WeekSchedule = Object.fromEntries(
  ["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, { open: true, openTime: "10:00", closeTime: "02:00" }]),
);

type Booked = { start_time: string; end_time: string; status: string; created_at: string };
let picked: { start: string | null; end: string | null } = { start: null, end: null };

function Harness({ booked = [] }: { booked?: Booked[] }) {
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  picked = { start, end };
  return (
    <TimeSlotPicker
      date={DAY}
      bookedSlots={booked}
      operatingHours={hours}
      phDates={new Set()}
      phCloseTime="02:00"
      startSlot={start}
      endSlot={end}
      onSelectStart={setStart}
      onSelectEnd={setEnd}
    />
  );
}

const slot = (label: string) => screen.getAllByRole("button").find((b) => b.tagName === "BUTTON" && b.textContent === label)!;
const tap = (label: string) => fireEvent.click(slot(label));
const at = (iso: string) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(sgt(iso)); };
const booking = (from: string, to: string): Booked =>
  ({ start_time: sgt(from).toISOString(), end_time: sgt(to).toISOString(), status: "confirmed", created_at: new Date().toISOString() });

afterEach(() => vi.useRealTimers());

// Each test renders all 48 slots with tooltips — slow under a full parallel run.
describe("TimeSlotPicker — 6am day, tap each half-hour", { timeout: 20000 }, () => {
  it("shows 6:00 AM to 5:30 AM the next morning with a midnight divider", () => {
    at("2026-11-24T15:10:00");
    render(<Harness />);
    expect(slot("6:00 AM")).toBeTruthy();
    expect(slot("5:30 AM")).toBeTruthy();
    expect(screen.getByText(/After midnight — Wed 25 Nov/)).toBeInTheDocument();
    expect(slot("2:30 PM")).toBeDisabled();        // passed
    expect(slot("3:00 PM")).not.toBeDisabled();    // current half-hour still bookable
    expect(slot("1:30 AM")).not.toBeDisabled();    // tonight's spill-over past midnight
    expect(slot("2:00 AM")).toBeDisabled();        // members-only after public close
  });

  it("one tap is a 30-minute booking", () => {
    at("2026-11-24T15:10:00");
    render(<Harness />);
    tap("9:00 PM");
    expect(picked).toEqual({ start: "21:00", end: "21:30" });
    expect(screen.getByText("9:00 PM – 9:30 PM · 30m")).toBeInTheDocument();
    expect(validateDuration(slotKeyToDate(DAY, "21:00"), slotKeyToDate(DAY, "21:30"))).toBeNull();
  });

  it("tapping each next slot builds 11pm → 1am across midnight", () => {
    at("2026-11-24T15:10:00");
    render(<Harness />);
    tap("11:00 PM"); tap("11:30 PM"); tap("12:00 AM"); tap("12:30 AM");
    expect(picked).toEqual({ start: "23:00", end: "25:00" });
    expect(screen.getByText("11:00 PM – 1:00 AM · 2h")).toBeInTheDocument();
    expect(slotKeyToDate(DAY, "25:00").toISOString()).toBe(sgt("2026-11-25T01:00:00").toISOString());
  });

  it("can add a slot before the start, and remove from either end", () => {
    at("2026-11-24T15:10:00");
    render(<Harness />);
    tap("8:00 PM"); tap("8:30 PM"); tap("9:00 PM");
    tap("7:30 PM");                                   // just before → added
    expect(picked).toEqual({ start: "19:30", end: "21:30" });
    tap("9:00 PM");                                   // last → removed
    expect(picked).toEqual({ start: "19:30", end: "21:00" });
    tap("7:30 PM");                                   // first → removed
    expect(picked).toEqual({ start: "20:00", end: "21:00" });
    tap("8:00 PM"); tap("8:30 PM");                   // remove down to nothing
    expect(picked).toEqual({ start: "", end: "" });
  });

  it("a middle slot is left alone; a slot away from the selection starts a new one", () => {
    at("2026-11-24T15:10:00");
    render(<Harness />);
    tap("8:00 PM"); tap("8:30 PM"); tap("9:00 PM");
    tap("8:30 PM");
    expect(picked).toEqual({ start: "20:00", end: "21:30" });
    tap("10:30 PM");
    expect(picked).toEqual({ start: "22:30", end: "23:00" });
  });

  it("booked slots can't be added, so a selection never jumps over someone else's booking", () => {
    at("2026-11-24T15:10:00");
    render(<Harness booked={[booking("2026-11-25T00:00:00", "2026-11-25T01:00:00")]} />);
    tap("11:30 PM");
    expect(slot("12:00 AM")).toBeDisabled();
    tap("12:00 AM");
    expect(picked).toEqual({ start: "23:30", end: "24:00" });
  });

  it("after midnight, last night's date still offers the rest of the night", () => {
    at("2026-11-25T00:40:00");
    render(<Harness />);
    expect(slot("12:00 AM")).toBeDisabled();
    expect(slot("12:30 AM")).not.toBeDisabled();
    tap("12:30 AM"); tap("1:00 AM"); tap("1:30 AM");
    expect(picked).toEqual({ start: "24:30", end: "26:00" });
  });
});
