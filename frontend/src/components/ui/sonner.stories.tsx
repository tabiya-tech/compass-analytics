import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "./sonner";

type Variant = "default" | "success" | "info" | "warning" | "error";

const MESSAGES: Record<Variant, string> = {
  default: "The change was saved.",
  success: "Access granted to Isaac Chirwa.",
  info: "Two institutions joined this programme last week.",
  warning: "This institution has no jobseekers yet.",
  error: "Could not grant access to Isaac Chirwa. Please try again.",
};

/** One toast per variant, held open so the story shows the snackbar rather than an empty frame. */
function show(variant: Variant) {
  const options = { id: variant, duration: Infinity };
  const message = MESSAGES[variant];
  if (variant === "default") toast(message, options);
  else toast[variant](message, options);
}

/**
 * The app mounts one `<Toaster />` at the root, and so does Storybook's preview — a story only fires
 * into it. The toast is dismissed on unmount, so switching stories does not stack them up.
 */
function ToastPreview({ variant }: Readonly<{ variant: Variant }>) {
  useEffect(() => {
    show(variant);
    return () => {
      toast.dismiss(variant);
    };
  }, [variant]);

  return (
    <div className="p-6">
      <Button variant="outline" onClick={() => show(variant)}>
        Show again
      </Button>
    </div>
  );
}

const meta = {
  component: Toaster,
  tags: ["ai-generated"],
  parameters: { layout: "fullscreen" },
  render: () => <ToastPreview variant="default" />,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No status: the neutral surface, as `toast("…")` renders it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    // The toaster is fixed to the viewport, outside the story canvas.
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(await body.findByText(MESSAGES.default)).toBeVisible());

    // Anchored top-right, matching the snackbars in compass-connect.
    const toaster = canvasElement.ownerDocument.querySelector("[data-sonner-toaster]") as HTMLElement;
    await expect(toaster).toHaveAttribute("data-y-position", "top");
    await expect(toaster).toHaveAttribute("data-x-position", "right");

    // The close button carries a translated label, so it is reachable by name.
    await expect(within(toaster).getByRole("button", { name: "Close" })).toBeVisible();
  },
};

export const Success: Story = { render: () => <ToastPreview variant="success" /> };

export const Info: Story = { render: () => <ToastPreview variant="info" /> };

export const Warning: Story = { render: () => <ToastPreview variant="warning" /> };

export const Error: Story = {
  render: () => <ToastPreview variant="error" />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(await body.findByText(MESSAGES.error)).toBeVisible());
  },
};
