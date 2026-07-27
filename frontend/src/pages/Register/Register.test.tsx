import { render, screen, waitFor } from "@/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routerPaths } from "@/app/routerPaths";
import { Register, DATA_TEST_ID } from "./Register";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

async function fillValidForm(email = "ada@partner.org") {
  await userEvent.type(screen.getByLabelText("Full name"), "Ada Lovelace");
  await userEvent.type(screen.getByLabelText("Organization"), "Analytical Engines");
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
  await userEvent.type(screen.getByLabelText("Confirm password"), "Passw0rd!");
}

describe("Register", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  describe("Render tests", () => {
    it("should render the heading and all five fields", () => {
      // GIVEN the register page
      // WHEN rendered
      render(<Register />);

      // THEN the real copy and every field are present
      expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
      expect(screen.getByLabelText("Full name")).toBeInTheDocument();
      expect(screen.getByLabelText("Organization")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    });

    it("should link back to the login page in the footer", () => {
      // GIVEN the register page
      // WHEN rendered
      render(<Register />);

      // THEN the footer link points to /login (hash-prefixed under HashRouter)
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_LINK)).toHaveAttribute("href", "#/login");
    });
  });

  describe("Live validation", () => {
    it("should keep the submit button disabled until the whole form is valid", async () => {
      // GIVEN the empty form
      render(<Register />);
      const submit = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);

      // THEN submit starts disabled
      expect(submit).toBeDisabled();

      // WHEN every field is filled validly
      await fillValidForm();

      // THEN submit becomes enabled
      expect(submit).toBeEnabled();
    });

    it("should show the password requirements as the user types and keep submit disabled", async () => {
      // GIVEN a weak password (a single character)
      render(<Register />);
      await userEvent.type(screen.getByLabelText("Password"), "a");

      // THEN the requirement checklist appears and submit stays disabled
      expect(screen.getByText(/at least 8 characters long/)).toBeInTheDocument();
      expect(screen.getByText(/one uppercase letter/)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON)).toBeDisabled();
    });

    it("should show the mismatch error live once the passwords differ", async () => {
      // GIVEN a strong password and a different confirmation
      render(<Register />);
      await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
      await userEvent.type(screen.getByLabelText("Confirm password"), "Different1!");

      // THEN the mismatch error shows immediately and submit stays disabled
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON)).toBeDisabled();
    });
  });

  describe("Submission", () => {
    it("should navigate to the root when the form is valid and submitted", async () => {
      // GIVEN a valid form
      render(<Register />);
      await fillValidForm();

      // WHEN submitting
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON));

      // THEN the app navigates to the root
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT));
    });

    it("should navigate to the root after Continue with Google", async () => {
      // GIVEN the register page
      render(<Register />);

      // WHEN clicking Continue with Google
      await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

      // THEN the Google flow signs in and navigates to the root
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT));
    });
  });
});
