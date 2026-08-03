import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { UserAvatar, DATA_TEST_ID } from "./UserAvatar";

describe("UserAvatar", () => {
  it("should fall back to a generic person icon when there is no photo", () => {
    // GIVEN a jobseeker without a photo
    // WHEN rendered
    render(<UserAvatar name="Amara Moyo" />);

    // THEN a person icon stands in for the photo
    expect(screen.getByTestId(DATA_TEST_ID.FALLBACK).querySelector("svg")).toBeInTheDocument();
  });

  it("should keep the full name available to screen readers", () => {
    // GIVEN a jobseeker without a photo
    // WHEN rendered
    render(<UserAvatar name="Amara Moyo" />);

    // THEN the name is readable even though only the icon is drawn
    expect(screen.getByText("Amara Moyo")).toBeInTheDocument();
  });

  it("should keep showing the fallback icon until a provided photo has loaded", () => {
    // GIVEN a jobseeker whose photo hasn't loaded yet
    // WHEN rendered
    render(<UserAvatar name="Amara Moyo" src="/photo.png" />);

    // THEN the icon holds the space, and the name is still readable
    expect(screen.getByTestId(DATA_TEST_ID.FALLBACK).querySelector("svg")).toBeInTheDocument();
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
