import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordRequirements, isStrongPassword } from "./PasswordRequirements";

describe("PasswordRequirements", () => {
  it("should list all five requirements", () => {
    // GIVEN an empty password
    const givenPassword = "";
    // WHEN rendered
    render(<PasswordRequirements password={givenPassword} />);

    // THEN every rule is shown
    expect(screen.getByText(/at least 8 characters long/)).toBeInTheDocument();
    expect(screen.getByText(/one uppercase letter/)).toBeInTheDocument();
    expect(screen.getByText(/one lowercase letter/)).toBeInTheDocument();
    expect(screen.getByText(/one number/)).toBeInTheDocument();
    expect(screen.getByText(/one special character/)).toBeInTheDocument();
  });

  it("should mark a met rule green and an unmet rule as an error", () => {
    // GIVEN a password that only satisfies the lowercase rule
    const givenPassword = "abc";
    // WHEN rendered
    render(<PasswordRequirements password={givenPassword} />);

    // THEN the lowercase rule is met
    expect(screen.getByText(/one lowercase letter/).closest("li")).toHaveClass("text-green-3");
    expect(screen.getByText(/at least 8 characters long/).closest("li")).toHaveClass("text-destructive");
  });
});

describe("isStrongPassword", () => {
  it("should reject passwords missing any rule", () => {
    // GIVEN passwords that each miss a rule
    const givenPasswords = ["", "a", "password", "Password1", "Passw0rd"];
    // THEN they are rejected
    expect(isStrongPassword(givenPasswords[0])).toBe(false);
    expect(isStrongPassword(givenPasswords[1])).toBe(false); // no upper/number/special
    expect(isStrongPassword(givenPasswords[2])).toBe(false); // no upper/number/special
    expect(isStrongPassword(givenPasswords[3])).toBe(false); // no special
    expect(isStrongPassword(givenPasswords[4])).toBe(false); // no special
  });

  it("should accept a password that satisfies every rule", () => {
    // GIVEN a strong password
    const givenPassword = "Passw0rd!";
    // THEN it is accepted
    expect(isStrongPassword(givenPassword)).toBe(true);
  });
});
