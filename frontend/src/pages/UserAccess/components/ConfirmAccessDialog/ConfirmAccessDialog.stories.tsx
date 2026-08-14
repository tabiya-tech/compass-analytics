import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
import { ConfirmAccessDialog } from "./ConfirmAccessDialog";

const meta = {
  component: ConfirmAccessDialog,
  tags: ["autodocs"],
  args: { onConfirm: fn(), onOpenChange: fn() },
} satisfies Meta<typeof ConfirmAccessDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmingAGrant: Story = {
  args: { entry: ungrantedEntry },
  play: async ({ args, canvasElement }) => {
    // The dialog is portalled to the body, outside the story canvas.
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant dashboard access?" });

    await expect(dialog).toHaveTextContent(
      "Are you sure you want to grant Vaani Mumba access to the dashboard for their institution?"
    );
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await userEvent.click(within(dialog).getByRole("button", { name: "Grant access" }));

    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const ConfirmingARemoval: Story = {
  args: { entry: grantedEntry },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Remove dashboard access?" });

    await expect(dialog).toHaveTextContent("Are you sure you want to remove Vaani Mumba's access to the dashboard?");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

/** Nothing has been toggled yet, so there is nothing on screen. */
export const Closed: Story = {
  args: { entry: null },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
