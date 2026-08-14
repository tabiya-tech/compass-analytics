import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Action, Subject } from "@/access/AccessContext";
import type { GrantView } from "@/user/user.types";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";

const dashboardGrant: GrantView = {
  grant_id: "grant-7",
  subject: Subject.Dashboard,
  action: Action.View,
  institution_id: "inst-7",
};

const ungrantedEntry: UserAccessEntry = {
  user: {
    user_id: "user-7",
    email: "vaani.mumba@example.com",
    name: "Vaani Mumba",
    grants: [{ grant_id: "grant-6", subject: Subject.Jobseekers, action: Action.View, institution_id: "inst-7" }],
  },
  institutionId: "inst-7",
  dashboardGrant: null,
};

const grantedEntry: UserAccessEntry = {
  ...ungrantedEntry,
  user: { ...ungrantedEntry.user, grants: [dashboardGrant] },
  dashboardGrant,
};
import { AccessRow } from "./AccessRow";

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

export const NotGranted: Story = {
  args: { entry: ungrantedEntry },
  play: async ({ args, canvas }) => {
    const toggle = canvas.getByRole("button", { name: /^Grant access to Vaani Mumba/ });

    await userEvent.click(toggle);

    // The row reports the intent; the screen owns the API call and the resulting state.
    await expect(args.onToggle).toHaveBeenCalledWith(ungrantedEntry);
  },
};

export const Granted: Story = {
  args: { entry: grantedEntry },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^Access granted to Vaani Mumba/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  },
};

export const Pending: Story = {
  args: { entry: ungrantedEntry, pending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^Grant access to Vaani Mumba/ })).toBeDisabled();
  },
};

export const NoInstitutionAssigned: Story = {
  args: {
    entry: {
      user: { user_id: "user-9", email: "new.joiner@example.com", name: "New Joiner", grants: [] },
      institutionId: null,
      dashboardGrant: null,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^Grant access to New Joiner/ })).toBeDisabled();
  },
};
