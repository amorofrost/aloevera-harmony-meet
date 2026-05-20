import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminBroadcastsPage from "../AdminBroadcastsPage";

// Sonner is the toast lib used by the admin page directly (via `import { toast } from "sonner"`).
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// `showApiError` reads from the in-app sonner wrapper.
vi.mock("@/components/ui/sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import { toast as sonnerToast } from "sonner";

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminBroadcastsPage />
    </MemoryRouter>,
  );
}

describe("AdminBroadcastsPage", () => {
  beforeEach(() => {
    (sonnerToast.error as ReturnType<typeof vi.fn>).mockClear();
    (sonnerToast.success as ReturnType<typeof vi.fn>).mockClear();
    // The `adminApi.broadcasts` mock store is module-scoped — entries persist across tests
    // within this file. Tests assert on additions (new title shows up) rather than absolute
    // history size, so no reset is required.
  });

  it("renders compose form with title, body, and send button", async () => {
    renderPage();
    expect(await screen.findByLabelText(/^Title$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Body$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send broadcast/i })).toBeInTheDocument();
  });

  it("disables Send when title or body is empty", async () => {
    const user = userEvent.setup();
    renderPage();
    const send = await screen.findByRole("button", { name: /Send broadcast/i });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/^Title$/i), "Hello");
    expect(send).toBeDisabled(); // body still empty

    await user.type(screen.getByLabelText(/^Body$/i), "World");
    expect(send).toBeEnabled();
  });

  it("submits a broadcast and shows it in the history table", async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for initial history load to settle.
    await screen.findByLabelText(/^Title$/i);

    await user.type(screen.getByLabelText(/^Title$/i), "Show this Saturday");
    await user.type(screen.getByLabelText(/^Body$/i), "Come early — doors open at 19:00.");

    const send = screen.getByRole("button", { name: /Send broadcast/i });
    expect(send).toBeEnabled();
    await user.click(send);

    // Success toast called via the `sonner` package
    await waitFor(() => {
      expect(sonnerToast.success).toHaveBeenCalled();
    });

    // New row visible in history table
    const titleCell = await screen.findByText("Show this Saturday");
    expect(titleCell).toBeInTheDocument();

    // Form fields were reset after submit
    expect((screen.getByLabelText(/^Title$/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Body$/i) as HTMLTextAreaElement).value).toBe("");
  });

  it("renders the history Recipients column as dispatched/estimated", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText(/^Title$/i), "Stats test");
    await user.type(screen.getByLabelText(/^Body$/i), "body");
    await user.click(screen.getByRole("button", { name: /Send broadcast/i }));

    const titleCell = await screen.findByText("Stats test");
    const row = titleCell.closest("tr");
    expect(row).not.toBeNull();
    // Mock broadcast starts at 0 dispatched / 0 estimated
    expect(within(row as HTMLElement).getByText("0 / 0")).toBeInTheDocument();
  });
});
