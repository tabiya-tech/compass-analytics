import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Mail } from "lucide-react";
import { Field, DATA_TEST_ID } from "./Field";

describe("Field", () => {
  describe("Render tests", () => {
    it("should associate the label with the input for accessibility", () => {
      // GIVEN a field with a label
      // WHEN it is rendered
      render(<Field id="email" label="Email" icon={<Mail />} />);

      // THEN the input is reachable by its accessible name
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    it("should visually hide the label by default but keep it accessible", () => {
      // GIVEN a default field
      // WHEN it is rendered
      render(<Field id="email" label="Email" />);

      // THEN the label is present but visually hidden (sr-only)
      expect(screen.getByText("Email")).toHaveClass("sr-only");
    });

    it("should show a visible label when labelHidden is false", () => {
      // GIVEN labelHidden=false
      // WHEN it is rendered
      render(<Field id="email" label="Email" labelHidden={false} />);

      // THEN the label is not sr-only
      expect(screen.getByText("Email")).not.toHaveClass("sr-only");
    });
  });

  describe("Error state", () => {
    it("should announce the error and mark the input invalid", () => {
      // GIVEN a field with an error
      // WHEN it is rendered
      render(<Field id="email" label="Email" error="Enter a valid email address." />);

      // THEN the error is announced via role=alert
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
      // AND the input is flagged invalid and points to the error via aria-describedby
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "email-error");
    });

    it("should not render an error node when there is no error", () => {
      // GIVEN a field without an error
      // WHEN it is rendered
      render(<Field id="email" label="Email" />);

      // THEN there is no alert
      expect(screen.queryByTestId(DATA_TEST_ID.FIELD_ERROR)).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("should forward typed input to the onChange handler", async () => {
      // GIVEN a field with an onChange handler
      const handleChange = vi.fn();
      render(<Field id="email" label="Email" onChange={handleChange} />);

      // WHEN the user types
      await userEvent.type(screen.getByLabelText("Email"), "hi");

      // THEN the handler is called for each keystroke
      expect(handleChange).toHaveBeenCalledTimes(2);
    });
  });
});
