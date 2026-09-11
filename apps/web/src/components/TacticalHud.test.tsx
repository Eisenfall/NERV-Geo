import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { earthquakeFeature } from "../test/fixtures";
import { TacticalHud } from "./TacticalHud";

describe("TacticalHud", () => {
  it("shows operational disaster details and attribution", () => {
    render(
      <TacticalHud feature={earthquakeFeature} muted={false} onClose={() => undefined} onToggleMute={() => undefined} />
    );
    expect(screen.getByRole("dialog", { name: /earthquake alert/i })).toBeInTheDocument();
    expect(screen.getByText("Jakarta")).toBeInTheDocument();
    expect(screen.getByText("6.2 MAG")).toBeInTheDocument();
    expect(screen.getByText("Segera berlindung")).toBeInTheDocument();
    expect(screen.getByText(/sumber: bmkg/i)).toBeInTheDocument();
  });

  it("closes on Escape and exposes a mute control", async () => {
    const onClose = vi.fn();
    const onToggleMute = vi.fn();
    render(
      <TacticalHud feature={earthquakeFeature} muted={false} onClose={onClose} onToggleMute={onToggleMute} />
    );
    await userEvent.click(screen.getByRole("button", { name: /mute alarm/i }));
    expect(onToggleMute).toHaveBeenCalledOnce();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
