import { render, screen, waitFor } from "@/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routerPaths } from "@/app/routerPaths";
import { Login, DATA_TEST_ID } from "./Login";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("Login", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  describe("Render tests", () => {
    it("should render the sign-in heading, fields, and actions", () => {
      // GIVEN the login page
      // WHEN rendered
      render(<Login />);

      // THEN the real copy, both inputs, and both buttons are present
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sign in/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    });

    it("should link to the register page in the footer", () => {
      // GIVEN the login page
      // WHEN rendered
      render(<Login />);

      // THEN the footer link points to /register (hash-prefixed under HashRouter)
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_LINK)).toHaveAttribute("href", "#/register");
    });

    it("should render an inert Forgot password link", () => {
      // GIVEN the login page
      // WHEN rendered
      render(<Login />);

      // THEN the forgot-password link is present but goes nowhere real yet
      const link = screen.getByTestId(DATA_TEST_ID.FORGOT_PASSWORD_LINK);
      expect(link).toHaveTextContent("Forgot password?");
      expect(link).toHaveAttribute("href", "#");
    });
  });

  describe("Validation", () => {
    it("should keep the submit button disabled until both fields are filled", async () => {
      // GIVEN the empty form
      render(<Login />);
      const submit = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);

      // THEN submit starts disabled
      expect(submit).toBeDisabled();

      // WHEN only the email is filled
      await userEvent.type(screen.getByLabelText("Email"), "you@partner.org");

      // THEN submit stays disabled
      expect(submit).toBeDisabled();

      // WHEN the password is also filled
      await userEvent.type(screen.getByLabelText("Password"), "s3cret!");

      // THEN submit becomes enabled
      expect(submit).toBeEnabled();
    });
  });

  describe("Submission", () => {
    it("should navigate to the root when the form is submitted", async () => {
      // GIVEN a filled-in form
      render(<Login />);
      await userEvent.type(screen.getByLabelText("Email"), "you@partner.org");
      await userEvent.type(screen.getByLabelText("Password"), "s3cret!");

      // WHEN submitting
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON));

      // THEN the app navigates to the root
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT));
    });

    it("should navigate to the root after Continue with Google", async () => {
      // GIVEN the login page
      render(<Login />);

      // WHEN clicking Continue with Google
      await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

      // THEN the app navigates to the root
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT));
    });
  });
});
