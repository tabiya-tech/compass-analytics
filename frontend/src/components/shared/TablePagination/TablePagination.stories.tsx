import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { TablePagination, type TablePaginationProps } from "./TablePagination";

// The pager is controlled, so the story owns the page to keep the numbers clickable.
function ControlledTablePagination({ page, onPageChange, ...props }: Readonly<TablePaginationProps>) {
  const [currentPage, setCurrentPage] = useState(page);

  return (
    <TablePagination
      {...props}
      page={currentPage}
      onPageChange={(next) => {
        setCurrentPage(next);
        onPageChange(next);
      }}
    />
  );
}

const meta = {
  component: TablePagination,
  tags: ["autodocs"],
  args: {
    page: 1,
    pageSize: 50,
    total: 128,
    onPageChange: fn(),
  },
  decorators: [
    (Story) => (
      // Roughly the width it gets as a table footer, so the two ends sit apart.
      <div className="w-full max-w-3xl rounded-card border bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TablePagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Showing 1–50 of 128")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  },
};

export const MiddlePage: Story = {
  args: { page: 2 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Showing 51–100 of 128")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Previous page" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Next page" })).toBeEnabled();
  },
};

export const LastPage: Story = {
  args: { page: 3 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Showing 101–128 of 128")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Next page" })).toBeDisabled();
  },
};

export const ManyPages: Story = {
  args: { page: 20, total: 2_000 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Page 1" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Page 40" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Page 20" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.queryByRole("button", { name: "Page 19" })).not.toBeInTheDocument();
  },
};

export const SinglePage: Story = {
  args: { total: 12 },
  play: async ({ canvas }) => {
    // Everything fits, so there is nothing to navigate and no pager to show.
    await expect(canvas.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  },
};

export const Interactive: Story = {
  args: { total: 2_000 },
  render: (args) => <ControlledTablePagination {...args} />,
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Page 3" }));

    await expect(args.onPageChange).toHaveBeenCalledWith(3);
    await expect(canvas.getByText("Showing 101–150 of 2000")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));

    // Past the opening run, a gap opens on the left too, leaving both ends and the current page.
    await expect(canvas.getByRole("button", { name: "Page 4" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.queryByRole("button", { name: "Page 3" })).not.toBeInTheDocument();
  },
};
