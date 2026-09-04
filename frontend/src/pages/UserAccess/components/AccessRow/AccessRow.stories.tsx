import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { stubRoleRecord, userRoleFor } from "@/_test_utilities/role-grants";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import { AccessRow } from "./AccessRow";

const user = { user_id: "user-7", email: "vaani.mumba@example.com", name: "Vaani Mumba" };

const ungrantedEntry: UserAccessEntry = {
  user: { ...user, roles: [] },
  role: null,
  hasAccess: false,
};

const implementerRole = stubRoleRecord({ name: "implementer", label: "Implementer" });
const implementerEntry: UserAccessEntry = {
  user: { ...user, roles: [userRoleFor(implementerRole._id)] },
  role: implementerRole,
  hasAccess: true,
};

const funderRole = stubRoleRecord({ name: "funder", label: "Funder" });
const funderEntry: UserAccessEntry = {
  user: { ...user, roles: [userRoleFor(funderRole._id)] },
  role: funderRole,
  hasAccess: true,
};

const meta = {
  component: AccessRow,
  tags: ["autodocs"],
  args: { onToggle: fn() },
  decorators: [
    (Story) => (
      <ul className="max-w-3xl rounded-card border bg-card p-4">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof AccessRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAccessYet: Story = {
  args: { entry: ungrantedEntry },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText(/No access yet$/)).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: /^Grant access to Vaani Mumba/ }));

    // The row reports the intent; the screen owns the API call and the resulting state.
    await expect(args.onToggle).toHaveBeenCalledWith(ungrantedEntry);
  },
};

export const Implementer: Story = {
  args: { entry: implementerEntry },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Implementer$/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Access granted to Vaani Mumba/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  },
};

export const Funder: Story = {
  args: { entry: funderEntry },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Funder$/)).toBeVisible();
  },
};

/** Provisioned by hand, holding a role assignment that doesn't resolve to a known role. */
export const CustomPermissions: Story = {
  args: {
    entry: {
      user: { ...user, roles: [userRoleFor("custom-role")] },
      role: null,
      hasAccess: true,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Custom permissions$/)).toBeVisible();
  },
};

export const Pending: Story = {
  args: { entry: ungrantedEntry, pending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^Grant access to Vaani Mumba/ })).toBeDisabled();
  },
};
