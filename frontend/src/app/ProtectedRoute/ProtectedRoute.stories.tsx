import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AccessProvider, Action, Subject } from "@/access/AccessContext";
import { buildAbility } from "@/access/ability";
import { AuthContext, type AuthContextValue } from "@/auth/AuthContext";
import { PermissionRoute } from "./ProtectedRoute";

const STUB_USER = { uid: "storybook-user", email: "storybook@example.com" } as AuthContextValue["user"];
const STUB_AUTH: AuthContextValue = { user: STUB_USER, loading: false, getIdToken: async () => "stub-token" };

const meta = {
  title: "App/PermissionRoute",
  component: PermissionRoute,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => (
      <AuthContext.Provider value={STUB_AUTH}>
        <AccessProvider ability={context.globals.loggedIn ? buildAbility(["institutions:view"]) : buildAbility([])}>
          <Story />
        </AccessProvider>
      </AuthContext.Provider>
    ),
  ],
  args: {
    action: Action.View,
    subject: Subject.Institutions,
    children: <div data-testid="content">Protected content</div>,
  },
} satisfies Meta<typeof PermissionRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, globals }: Parameters<NonNullable<Story["play"]>>[0]) => {
    if (globals.loggedIn) {
      await expect(canvas.getByTestId("content")).toBeVisible();
    } else {
      await expect(canvas.getByRole("alert")).toBeVisible();
    }
  },
};
