import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DEFAULT_ASSIGNABLE_ROLE, Role } from "@/access/roles";
import { grantsForRole } from "@/_test_utilities/role-grants";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import { ConfirmAccessDialog, type ConfirmAccessDialogProps } from "./ConfirmAccessDialog";

const user = { user_id: "user-7", email: "vaani.mumba@example.com", name: "Vaani Mumba" };

const ungrantedEntry: UserAccessEntry = { user: { ...user, grants: [] }, role: null, hasAccess: false };

const grantedEntry: UserAccessEntry = {
  user: { ...user, grants: grantsForRole(Role.Implementer) },
  role: Role.Implementer,
  hasAccess: true,
};

/** The screen owns the chosen role; hold it here so the control responds to a pick. */
function Controlled(props: Readonly<ConfirmAccessDialogProps>) {
  const [role, setRole] = useState<Role>(props.role);
  return (
    <ConfirmAccessDialog
      {...props}
      role={role}
      onRoleChange={(picked) => {
        setRole(picked);
        props.onRoleChange(picked);
      }}
    />
  );
}

const meta = {
  component: ConfirmAccessDialog,
  tags: ["autodocs"],
  args: { role: DEFAULT_ASSIGNABLE_ROLE, onRoleChange: fn(), onConfirm: fn(), onOpenChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ConfirmAccessDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmingAGrant: Story = {
  args: { entry: ungrantedEntry },
  play: async ({ args, canvasElement }) => {
    // The dialog is portalled to the body, outside the story canvas.
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant access" });

    await expect(dialog).toHaveTextContent("Choose a role for Vaani Mumba. It determines which pages they can access.");
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    // It opens on the default role, so the common case is one confirmation.
    await expect(within(dialog).getByRole("combobox", { name: "Role" })).toHaveTextContent("Funder");

    await userEvent.click(within(dialog).getByRole("button", { name: "Grant access" }));

    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const PickingTheImplementerRole: Story = {
  args: { entry: ungrantedEntry },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant access" });

    await userEvent.click(within(dialog).getByRole("combobox", { name: "Role" }));
    // The listbox is portalled too, so look for the option on the document.
    await userEvent.click(await body.findByRole("option", { name: "Implementer" }));

    await expect(args.onRoleChange).toHaveBeenCalledWith(Role.Implementer);
    // The open listbox hides the dialog from the a11y tree, so wait for it to come back.
    await expect(await within(dialog).findByRole("combobox", { name: "Role" })).toHaveTextContent("Implementer");
    await expect(dialog).toHaveTextContent("Sees every page except Institutions. Cannot grant access to other users.");
  },
};

export const ConfirmingARemoval: Story = {
  args: { entry: grantedEntry },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Remove access" });

    await expect(dialog).toHaveTextContent("Are you sure you want to remove Vaani Mumba's dashboard access?");
    await expect(dialog).toHaveTextContent(
      "They will still be able to sign in, but they won't be able to access any pages until you assign them a role again."
    );
    // There is no role to pick: the whole role is going.
    await expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();

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
