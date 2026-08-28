import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { UserAvatar, initialsOf, DATA_TEST_ID } from "./UserAvatar";

describe("UserAvatar", () => {
  it("should stand in for a missing photo with the person's initials", () => {
    // GIVEN a jobseeker without a photo
    // WHEN rendered
    render(<UserAvatar name="Amara Moyo" />);

    // THEN their initials stand in for it
    expect(screen.getByTestId(DATA_TEST_ID.FALLBACK)).toHaveTextContent("AM");
  });

  it("should fall back to a generic person icon when a name yields no initials", () => {
    // GIVEN a name with no letters or digits to take an initial from
    // WHEN rendered
    render(<UserAvatar name="—" />);

    // THEN a person icon stands in instead of an empty circle
    expect(screen.getByTestId(DATA_TEST_ID.FALLBACK).querySelector("svg")).toBeInTheDocument();
  });

  it("should keep the full name available to screen readers", () => {
    // GIVEN a jobseeker without a photo
    // WHEN rendered
    render(<UserAvatar name="Amara Moyo" />);

    // THEN the name is readable even though only the icon is drawn
    expect(screen.getByText("Amara Moyo")).toBeInTheDocument();
  });

  it("should keep showing the fallback until a provided photo has loaded", () => {
    // GIVEN a jobseeker whose photo hasn't loaded yet
    // WHEN rendered
    render(<UserAvatar name="Amara Moyo" src="/photo.png" />);

    // THEN the initials hold the space, and the name is still readable
    expect(screen.getByTestId(DATA_TEST_ID.FALLBACK)).toHaveTextContent("AM");
    expect(screen.getByText("Amara Moyo")).toBeInTheDocument();
  });

  it("should render at the default size when none is given", () => {
    // GIVEN an avatar with no explicit size
    // WHEN rendered
    render(<UserAvatar name="Diego Osei" />);

    // THEN it renders at the default size
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-size", "default");
  });

  it("should render at the small size used in table rows", () => {
    // GIVEN a table row avatar
    // WHEN rendered
    render(<UserAvatar name="Diego Osei" size="sm" />);

    // THEN it renders at the small size
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-size", "sm");
  });

  it("should render at the large size used in profile cards", () => {
    // GIVEN a profile card avatar
    // WHEN rendered
    render(<UserAvatar name="Diego Osei" size="lg" />);

    // THEN it renders at the large size
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-size", "lg");
  });

  it("should let the fallback colors be overridden for placement on a dark background", () => {
    // GIVEN an avatar placed on a dark background, like the sidebar footer
    // WHEN rendered with a fallback color override
    render(<UserAvatar name="Amara Moyo" className="bg-tabiya-green text-tabiya-blue" />);

    // THEN the override wins over the default colors
    const fallback = screen.getByTestId(DATA_TEST_ID.FALLBACK);
    expect(fallback).toHaveClass("bg-tabiya-green", "text-tabiya-blue");
    expect(fallback).not.toHaveClass("bg-tabiya-blue", "text-white");
  });
});

describe("initialsOf", () => {
  it("should take the first and last name's initials", () => {
    // GIVEN a two-part name
    // WHEN initials are taken
    // THEN both parts contribute one letter
    expect(initialsOf("Jordan Avila")).toBe("JA");
  });

  it("should skip the middle names, so a long name still yields two letters", () => {
    // GIVEN a name with more than two parts
    // WHEN initials are taken
    // THEN only the first and last parts contribute
    expect(initialsOf("Amara Chipo Moyo")).toBe("AM");
  });

  it("should yield a single letter for a one-word name", () => {
    // GIVEN a mononym
    // WHEN initials are taken
    // THEN the one letter is not doubled up
    expect(initialsOf("Jordan")).toBe("J");
  });

  it("should ignore surrounding and repeated whitespace", () => {
    // GIVEN a name padded and split by stray whitespace
    // WHEN initials are taken
    // THEN the blanks contribute nothing
    expect(initialsOf("  Jordan   Avila  ")).toBe("JA");
  });

  it("should read initials past the Latin alphabet", () => {
    // GIVEN a name written in another script
    // WHEN initials are taken
    // THEN its letters are used the same way
    expect(initialsOf("Даниил Чернов")).toBe("ДЧ");
  });

  it("should yield nothing for a name with no letters or digits", () => {
    // GIVEN a placeholder standing in for an unknown name
    // WHEN initials are taken
    // THEN there is nothing to show, and the caller can fall back
    expect(initialsOf("—")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});
