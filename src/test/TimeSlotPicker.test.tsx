import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import type { WeekSchedule } from "@/hooks/useOperatingHours";

const sgt = (s: string) => new Date(`${s}+08:00`);

// Open 10:00, public close 02:00 every day; 02:00–10:00 is members-only.
const hours: WeekSchedule = Object.fromEntries(
  ["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, { open: true, openTime: "10:00", closeTime: "02:00" }]),
);

type Booked = { start_time: string; end_time: string; status: string; created_at: string };

function Harness({ date, booked = [], onPick }: { date: Date; booked?: Booked[]; onPick?: (s: string | null, e: string | null) => void }) {
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  return (
    <TimeSlotPicker
      date={date}
      bookedSlots={booked}
      operatingHours={hours}
      phDates={new Set()}
      phCloseTime="02:00"
      startSlot={start}
      endSlot={end}
      onSelectStart={(s) => { setStart(s); onPick?.(s, end); }}
      onSelectEnd={(e) => { setEnd(e); onPick?.(start, e); }}
    />
  );
}

const slot = (label: string) => screen.getAllByRole("button").find((b) => b.textContent === label && b.tagName === "BUTTON")!;

afterEach(() => vi.useRealTimers());

describe("TimeSlotPicker — 6am booking day", () => {
  it("shows 6:00 AM to 5:30 AM the next morning with a midnight divider", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(sgt("2026-11-24T15:10:00"));
    render(<Harness date={sgt("2026-11-24T00:00:00")} />);
    expect(slot("6:00 AM")).toBeTruthy();
    expect(slot("5:30 AM")).toBeTruthy();
    expect(screen.getByText(/After midnight — Wed 25 Nov/)).toBeInTheDocument();
    // Past half-hours are disabled; the current one (3:00 PM at 3:10 PM) is still open.
    expect(slot("2:30 PM")).toBeDisabled();
    expect(slot("3:00 PM")).not.toBeDisabled();
    // Opening hours: 1:30 AM is the previous evening's spill-over, 2:00 AM is members-only.
    expect(slot("1:30 AM")).not.toBeDisabled();
    expect(slot("2:00 AM")).toBeDisabled();
  });

  it("books 11pm past midnight in one go, offering only lengths that are free", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(sgt("2026-11-24T15:10:00"));
    const picks: Array<[string | null, string | null]> = [];
    render(
      <Harness
        date={sgt("2026-11-24T00:00:00")}
        booked={[{ start_time: sgt("2026-11-25T00:30:00").toISOString(), end_time: sgt("2026-11-25T01:30:00").toISOString(), status: "confirmed", created_at: new Date().toISOString() }]}
        onPick={(s, e) => picks.push([s, e])}
      />,
    );
    expect(slot("12:30 AM")).toBeDisabled();

    fireEvent.click(slot("11:00 PM"));
    expect(screen.getByText(/How long will you play/)).toBeInTheDocument();
    // 11:00 PM, 11:30 PM, 12:00 AM are free; 12:30 AM is booked → 1h or 1.5h only.
    expect(screen.getByRole("button", { name: "1h" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1.5h" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2h" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "1.5h" }));
    expect(picks.at(-1)).toEqual(["23:00", "24:30"]);
    expect(screen.getByText(/Tue,? 24 Nov, 11:00\sPM → Wed,? 25 Nov, 12:30\sAM · 1 hour 30 min/)).toBeInTheDocument();
  });

  it("says so when less than an hour is free from the chosen start", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(sgt("2026-11-24T15:10:00"));
    render(
      <Harness
        date={sgt("2026-11-24T00:00:00")}
        booked={[{ start_time: sgt("2026-11-24T20:30:00").toISOString(), end_time: sgt("2026-11-24T22:00:00").toISOString(), status: "confirmed", created_at: new Date().toISOString() }]}
      />,
    );
    fireEvent.click(slot("8:00 PM"));
    expect(screen.getByText(/Less than 1 hour is free/)).toBeInTheDocument();
  });

  it("after midnight, last night's date still offers the rest of the night", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(sgt("2026-11-25T00:40:00"));
    render(<Harness date={sgt("2026-11-24T00:00:00")} />);
    expect(slot("11:30 PM")).toBeDisabled();
    expect(slot("12:00 AM")).toBeDisabled();
    expect(slot("12:30 AM")).not.toBeDisabled();
    fireEvent.click(slot("12:30 AM"));
    // 12:30–2:00 is public hours: 1h and 1.5h.
    const lengths = within(screen.getByText(/How long will you play/).parentElement!).getAllByRole("button").map((b) => b.textContent);
    expect(lengths).toEqual(["1h", "1.5h"]);
  });

  it("shows More… when many lengths are free", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(sgt("2026-11-24T08:00:00"));
    render(<Harness date={sgt("2026-11-24T00:00:00")} />);
    fireEvent.click(slot("10:00 AM"));
    expect(screen.getByRole("button", { name: "4h" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "4.5h" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More…" }));
    expect(screen.getByRole("button", { name: "16h" })).toBeInTheDocument(); // 10am → 2am close
    expect(screen.queryByRole("button", { name: "16.5h" })).toBeNull();
  });
});
