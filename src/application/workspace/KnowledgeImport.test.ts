import { afterEach, describe, expect, it, vi } from "vitest";
import { extractWebContent } from "./KnowledgeImport";

describe("extractWebContent URL guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses non-https schemes without touching the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const url of ["http://example.com/doc", "ftp://example.com/x", "javascript:alert(1)"]) {
      const result = await extractWebContent(url);
      expect(result.ok).toBe(false);
      expect(result.warning).toMatch(/https/i);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses obvious internal and metadata hosts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const url of [
      "https://localhost/admin",
      "https://127.0.0.1/status",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/internal",
      "https://192.168.1.1/router",
      "https://172.20.3.4/private",
      "https://[::1]/loopback",
    ]) {
      const result = await extractWebContent(url);
      expect(result.ok, url).toBe(false);
      expect(result.warning, url).toMatch(/internal|private|blocked/i);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects unparsable URLs gracefully", async () => {
    const result = await extractWebContent("not a url at all");
    expect(result.ok).toBe(false);
  });

  it("still imports public https pages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><title>Doc Title</title><body><p>Hello world</p></body></html>", {
        status: 200,
      })
    );
    const result = await extractWebContent("https://example.com/doc");
    expect(result.ok).toBe(true);
    expect(result.title).toBe("Doc Title");
    expect(result.content).toContain("Hello world");
    expect(result.content).not.toContain("<p>");
  });
});
