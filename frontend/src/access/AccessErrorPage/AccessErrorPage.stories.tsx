import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, spyOn } from "storybook/test";
import { AuthenticationServiceFactory } from "@/auth/services/Authentication.service.factory";
import { AccessErrorPage, DATA_TEST_ID } from "./AccessErrorPage";

const meta = {
  title: "Access/AccessErrorPage",
  component: AccessErrorPage,
  tags: ["autodocs"],
} satisfies Meta<typeof AccessErrorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockLogout = fn();

export const Error: Story = {
  args: { variant: "error" },
  play: async ({ canvas }) => {
    spyOn(AuthenticationServiceFactory, "getCurrentAuthenticationService").mockReturnValue({
      logout: mockLogout,
    } as never);
    await expect(canvas.getByTestId(DATA_TEST_ID.message)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /retry/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /sign out/i })).toBeVisible();
  },
};

export const Unprovisioned: Story = {
  args: { variant: "unprovisioned" },
  play: async ({ canvas }) => {
    spyOn(AuthenticationServiceFactory, "getCurrentAuthenticationService").mockReturnValue({
      logout: mockLogout,
    } as never);
    await expect(canvas.getByTestId(DATA_TEST_ID.message)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /sign out/i })).toBeVisible();
  },
};
