import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthLayout, DATA_TEST_ID } from "./AuthLayout";

describe("AuthLayout", () => {
  describe("Render tests", () => {
    it("should render the brand panel copy from the real translations", () => {
      // GIVEN the layout with slot content
      // WHEN it is rendered
      render(
        <AuthLayout>
          <div>form slot</div>
        </AuthLayout>
      );

      // THEN the brand headline, subcopy, and footer are present
      expect(screen.getByText("The dashboard behind every deployment.")).toBeInTheDocument();
      expect(screen.getByText(/how engaged they are/)).toBeInTheDocument();
      expect(screen.getByText("Open-source digital public infrastructure for jobs.")).toBeInTheDocument();
    });

    it("should render the provided form content in the form panel", () => {
      // GIVEN slot content
      // WHEN rendered
      render(
        <AuthLayout>
          <button>Sign in</button>
        </AuthLayout>
      );

      // THEN the slot content appears inside the form panel
      const formPanel = screen.getByTestId(DATA_TEST_ID.FORM_PANEL);
      expect(formPanel).toContainElement(screen.getByRole("button", { name: "Sign in" }));
    });

    it("should render both the brand and form panels", () => {
      // GIVEN the layout
      // WHEN rendered
      render(
        <AuthLayout>
          <div>form</div>
        </AuthLayout>
      );

      // THEN both structural panels exist
      expect(screen.getByTestId(DATA_TEST_ID.BRAND_PANEL)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.FORM_PANEL)).toBeInTheDocument();
    });
  });
});
