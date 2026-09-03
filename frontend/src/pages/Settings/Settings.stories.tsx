import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { AuthContext } from "@/auth/AuthContext";
import { AccessProvider } from "@/access/AccessContext";
import { Role } from "@/access/roles";
import type { User } from "firebase/auth";
import { Settings, DATA_TEST_ID } from "./Settings";

function signedInAs(displayName: string | null, email: string) {
  return { user: { displayName, email } as User, loading: false, getIdToken: async () => "" };
}

const meta = {
  title: "Pages/Settings",
  component: Settings,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <AuthContext.Provider value={signedInAs("Jordan Avila", "jordan@gofund.org")}>
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof Settings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A funder overseeing the whole deployment. */
export const FunderAcrossTheDeployment: Story = {
  decorators: [
    (Story) => (
      <AccessProvider role={Role.Funder} scope={{ institutionIds: null }}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Profile & settings" })).toBeVisible();
    await expect(canvas.getByTestId(DATA_TEST_ID.PROFILE_ROLE_SUBTITLE)).toHaveTextContent("Funder");
    await expect(canvas.getByText("All institutions")).toBeVisible();
  },
};

/** An implementer running Compass at a single institution. */
export const ImplementerAtOneInstitution: Story = {
  decorators: [
    (Story) => (
      <AccessProvider role={Role.Implementer} scope={{ institutionIds: ["inst-1"] }}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.PROFILE_ROLE_SUBTITLE)).toHaveTextContent("Implementer");
    await expect(canvas.getByText("1 institution")).toBeVisible();
  },
};

/** Permissions that add up to no role we know — every row still renders. */
export const UnknownRole: Story = {
  decorators: [
    (Story) => (
      <AccessProvider role={null} scope={{ institutionIds: ["a", "b", "c"] }}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("3 institutions")).toBeVisible();
  },
};

/**
 * Runs in a real browser, so it can catch what jsdom can't: an address with no spaces to break on
 * must wrap inside the card rather than running out past its edge.
 */
export const LongEmailAddress: Story = {
  decorators: [
    (Story) => (
      <AuthContext.Provider value={signedInAs("Jordan Avila", "fniragena+02.a.very.long.address@students.example.org")}>
        <AccessProvider role={Role.Funder} scope={{ institutionIds: null }}>
          {/* max-w-md, same as the card's own cap — this is the narrowest it ever actually gets. */}
          <div style={{ width: 448 }}>
            <Story />
          </div>
        </AccessProvider>
      </AuthContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    const card = canvas.getByTestId(DATA_TEST_ID.PROFILE_CARD);
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);

    for (const detail of canvas.getAllByTestId(DATA_TEST_ID.PROFILE_DETAIL)) {
      await expect(Math.round(detail.getBoundingClientRect().right)).toBeLessThanOrEqual(
        Math.round(card.getBoundingClientRect().right)
      );
    }
  },
};

/**
 * The Firebase client has no displayName cached — say, the account was provisioned by an operator
 * rather than through the registration form. The backend's own record covers the gap.
 */
export const NameFromTheBackendRecord: Story = {
  decorators: [
    (Story) => (
      <AuthContext.Provider value={signedInAs(null, "kunda.tembo@partner.org")}>
        <AccessProvider role={Role.Implementer} name="Kunda Tembo" scope={{ institutionIds: ["inst-1"] }}>
          <Story />
        </AccessProvider>
      </AuthContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.PROFILE_NAME)).toHaveTextContent("Kunda Tembo");
  },
};

export const EditingTheProfile: Story = {
  decorators: [
    (Story) => (
      <AccessProvider role={Role.Funder} organization="Acme Corp" scope={{ institutionIds: null }}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));

    const nameInput = canvas.getByTestId(DATA_TEST_ID.NAME_INPUT);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Kunda Tembo");

    const organizationInput = canvas.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT);
    await userEvent.clear(organizationInput);
    await userEvent.type(organizationInput, "Ndola Livelihoods Trust");

    await userEvent.click(canvas.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON));

    await waitFor(() => expect(canvas.getByTestId(DATA_TEST_ID.PROFILE_NAME)).toHaveTextContent("Kunda Tembo"));
    await expect(canvas.getByText("Ndola Livelihoods Trust")).toBeVisible();
    await expect(canvas.queryByTestId(DATA_TEST_ID.NAME_INPUT)).not.toBeInTheDocument();
  },
};

/** Clearing the name blocks Save — organization alone can't identify the person. */
export const CannotSaveWithoutAName: Story = {
  decorators: [
    (Story) => (
      <AccessProvider role={Role.Funder} scope={{ institutionIds: null }}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));
    await userEvent.clear(canvas.getByTestId(DATA_TEST_ID.NAME_INPUT));

    await expect(canvas.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON)).toBeDisabled();
  },
};
