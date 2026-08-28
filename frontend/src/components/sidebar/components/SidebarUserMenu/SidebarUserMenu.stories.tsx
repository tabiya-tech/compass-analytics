import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import type { User } from "firebase/auth";
import { SidebarUserMenu } from "./SidebarUserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthContext } from "@/auth/AuthContext";
import { AccessProvider } from "@/access/AccessContext";
import { Role } from "@/access/roles";

// A stub, not the real AuthProvider — Storybook runs in a real browser, with no Firebase config to resolve against.
const SIGNED_IN_USER = { displayName: "Taylor Kimathi", email: "taylor@example.com", photoURL: null } as User;

const meta = {
  title: "Sidebar/SidebarUserMenu",
  component: SidebarUserMenu,
  tags: ["autodocs"],
  args: { onSignOut: fn() },
  decorators: [
    (Story) => (
      <AuthContext.Provider value={{ user: SIGNED_IN_USER, loading: false, getIdToken: async () => "storybook-token" }}>
        <AccessProvider role={Role.Funder}>
          <SidebarProvider>
            <div className="w-64 bg-sidebar p-2">
              <Story />
            </div>
          </SidebarProvider>
        </AccessProvider>
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof SidebarUserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Open account menu" });
    await expect(trigger).toBeVisible();
    // The avatar carries its own sr-only copy of the name, so scope to the visible one.
    await expect(canvas.getByText("Taylor Kimathi", { selector: ":not(.sr-only)" })).toBeVisible();
    // The role sits beneath the name, matching the account screen's own label for it.
    await expect(canvas.getByText("Funder")).toBeVisible();
  },
};

export const NoDisplayName: Story = {
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={{
          user: { displayName: null, email: "taylor@example.com", photoURL: null } as User,
          loading: false,
          getIdToken: async () => "storybook-token",
        }}
      >
        <AccessProvider role={Role.Funder}>
          <SidebarProvider>
            <div className="w-64 bg-sidebar p-2">
              <Story />
            </div>
          </SidebarProvider>
        </AccessProvider>
      </AuthContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("My account", { selector: ":not(.sr-only)" })).toBeVisible();
  },
};
