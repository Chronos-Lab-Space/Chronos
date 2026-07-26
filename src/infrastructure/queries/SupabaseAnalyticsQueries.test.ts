import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAnalyticsQueries } from "./SupabaseAnalyticsQueries";

function mockClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

describe("SupabaseAnalyticsQueries", () => {
  it("skips the network entirely when Supabase is not configured", async () => {
    const { client, from } = mockClient();
    const queries = new SupabaseAnalyticsQueries(client, false);

    await queries.track({ event: "product.session_start" });

    expect(from).not.toHaveBeenCalled();
  });

  it("writes events when configured", async () => {
    const { client, from, insert } = mockClient();
    const queries = new SupabaseAnalyticsQueries(client, true);

    await queries.track({ event: "product.workspace_created", properties: { name: "Lab" } });

    expect(from).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "product.workspace_created",
        properties: expect.objectContaining({ name: "Lab" }),
      })
    );
  });

  it("never throws when the insert fails", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("network down"));
    const from = vi.fn().mockReturnValue({ insert });
    const queries = new SupabaseAnalyticsQueries({ from } as unknown as SupabaseClient, true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(queries.track({ event: "product.path_chosen" })).resolves.toBeUndefined();

    warn.mockRestore();
  });
});
