import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Role } from "@/access/roles";
import { stubRoleRecord, userRoleFor } from "@/_test_utilities/role-grants";
import type { InstitutionChoicesState } from "@/pages/UserAccess/hooks/useInstitutionChoices";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import type { RoleRecord } from "@/user/user.types";
import { ConfirmAccessDialog, type ConfirmAccessDialogProps } from "./ConfirmAccessDialog";

const institutions: InstitutionChoicesState = {
  status: "success",
  items: [
    { id: "inst-1", name: "Lusaka Skills Hub" },
    { id: "inst-2", name: "Ndola Livelihoods Trust" },
    { id: "inst-3", name: "Chipata Vocational Centre" },
  ],
};

const implementerRole = stubRoleRecord({
  _id: "role-implementer",
  name: Role.Implementer,
  label: "Implementer",
  description: "Sees every page except Institutions, for one institution only. Cannot grant access to other users.",
});

const funderRole = stubRoleRecord({
  _id: "role-funder",
  name: Role.Funder,
  label: "Funder",
  description: "Sees every page except Jobseekers. Can grant access to other users.",
});

const roles: readonly RoleRecord[] = [implementerRole, funderRole];

const user = { user_id: "user-7", email: "vaani.mumba@example.com", name: "Vaani Mumba" };

const ungrantedEntry: UserAccessEntry = { user: { ...user, roles: [] }, role: null, hasAccess: false };

const grantedEntry: UserAccessEntry = {
  user: { ...user, roles: [userRoleFor(implementerRole._id)] },
  role: implementerRole,
  hasAccess: true,
};

/** The screen owns the role and institution; hold them here so the controls respond to a pick. */
function Controlled(props: Readonly<ConfirmAccessDialogProps>) {
  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(props.selectedRole);
  const [institutionId, setInstitutionId] = useState<string | null>(props.institutionId);
  return (
    <ConfirmAccessDialog
      {...props}
      selectedRole={selectedRole}
      onRoleChange={(picked) => {
        setSelectedRole(picked);
        // The institution belonged to the previous role, so it does not carry across the change.
        setInstitutionId(null);
        props.onRoleChange(picked);
      }}
      institutionId={institutionId}
      onInstitutionChange={(picked) => {
        setInstitutionId(picked);
        props.onInstitutionChange(picked);
      }}
    />
  );
}

const meta = {
  component: ConfirmAccessDialog,
  tags: ["autodocs"],
  args: {
    roles,
    selectedRole: funderRole,
    onRoleChange: fn(),
    institutions,
    institutionId: null,
    onInstitutionChange: fn(),
    onConfirm: fn(),
    onOpenChange: fn(),
  },
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

    await expect(args.onRoleChange).toHaveBeenCalledWith(implementerRole);
    // The open listbox hides the dialog from the a11y tree, so wait for it to come back.
    await expect(await within(dialog).findByRole("combobox", { name: "Role" })).toHaveTextContent("Implementer");
    await expect(dialog).toHaveTextContent(
      "Sees every page except Institutions, for one institution only. Cannot grant access to other users."
    );
    // The role belongs to one institution, so picking it offers a picker — but confirming without
    // one is still allowed, since null means deployment-wide on the backend.
    await expect(within(dialog).getByRole("combobox", { name: "Institution" })).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Grant access" })).toBeEnabled();
  },
};

/** The implementer role covers one institution — picking one scopes the grant to it. */
export const ScopingTheImplementerRoleToAnInstitution: Story = {
  args: { entry: ungrantedEntry, selectedRole: implementerRole },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant access" });

    await expect(within(dialog).getByRole("button", { name: "Grant access" })).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("combobox", { name: "Institution" }));
    await userEvent.click(await body.findByRole("option", { name: "Ndola Livelihoods Trust" }));

    // The id is what the grant is scoped to; the name is only what the funder reads.
    await expect(args.onInstitutionChange).toHaveBeenCalledWith("inst-2");
    await expect(await within(dialog).findByRole("combobox", { name: "Institution" })).toHaveTextContent(
      "Ndola Livelihoods Trust"
    );
    await expect(within(dialog).getByRole("button", { name: "Grant access" })).toBeEnabled();
  },
};

/** Without the institution list there is no scope to pick from, but the grant can still proceed unscoped. */
export const InstitutionsUnavailable: Story = {
  args: { entry: ungrantedEntry, selectedRole: implementerRole, institutions: { status: "error", retry: fn() } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant access" });

    await expect(dialog).toHaveTextContent("Institutions could not be loaded, so this role cannot be scoped yet.");
    await expect(within(dialog).getByRole("combobox", { name: "Institution" })).toBeDisabled();
    await expect(within(dialog).getByRole("button", { name: "Grant access" })).toBeEnabled();
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
