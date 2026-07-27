import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SocialAuth } from "./SocialAuth";

describe("SocialAuth", () => {
  it("should render the divider and the Continue with Google button", () => {
    // GIVEN the component
    // WHEN rendered
    render(<SocialAuth onGoogle={vi.fn()} />);

    // THEN the real divider and Google button copy are shown
    expect(screen.getByText("OR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("should call onGoogle when the Google button is clicked", async () => {
    // GIVEN a handler
    const onGoogle = vi.fn();
    render(<SocialAuth onGoogle={onGoogle} />);

    // WHEN the button is clicked
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    // THEN the handler fires once
    expect(onGoogle).toHaveBeenCalledOnce();
  });

  it("should disable the Google button when disabled", () => {
    // GIVEN disabled=true
    // WHEN rendered
    render(<SocialAuth onGoogle={vi.fn()} disabled />);

    // THEN the button is disabled
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  });
});
