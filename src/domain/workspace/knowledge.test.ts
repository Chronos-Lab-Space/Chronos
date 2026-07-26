import { describe, expect, it } from "vitest";
import {
  githubReadmeCandidates,
  inferUploadType,
  isGithubRepoUrl,
  renderSimpleMarkdown,
  searchLibrary,
} from "./knowledge";
import type { KnowledgeRecord, NoteRecord } from "./types";

describe("knowledge library (RAG-lite)", () => {
  it("infers upload types for pdf, markdown, txt", () => {
    expect(inferUploadType("deck.PDF")).toBe("pdf");
    expect(inferUploadType("notes.md")).toBe("markdown");
    expect(inferUploadType("readme.markdown")).toBe("markdown");
    expect(inferUploadType("log.txt")).toBe("txt");
    expect(inferUploadType("image.png")).toBeNull();
  });

  it("searches keyword across title and content", () => {
    const knowledge: KnowledgeRecord[] = [
      {
        id: "k1",
        workspace_id: "w",
        type: "markdown",
        title: "Kickstart brief",
        content: "Launch CLAB with early backers",
        metadata: {},
        created_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "k2",
        workspace_id: "w",
        type: "url",
        title: "Competitor site",
        content: "pricing page",
        metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const notes: NoteRecord[] = [
      {
        id: "n1",
        workspace_id: "w",
        title: "Meeting notes",
        content: "Discuss Kickstart timing",
        created_at: "2026-01-03T00:00:00.000Z",
      },
    ];

    const hits = searchLibrary(knowledge, notes, "kickstart");
    expect(hits.map((h) => h.id)).toEqual(["k1", "n1"]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);

    expect(searchLibrary(knowledge, notes, "pricing").map((h) => h.id)).toEqual(["k2"]);
    expect(searchLibrary(knowledge, notes, "")).toHaveLength(3);
  });

  it("builds GitHub raw README candidates", () => {
    expect(isGithubRepoUrl("https://github.com/Chronos-Lab-Space/Chronos")).toBe(true);
    const urls = githubReadmeCandidates("https://github.com/Chronos-Lab-Space/Chronos");
    expect(urls.some((u) => u.includes("/main/README.md"))).toBe(true);
    expect(urls.some((u) => u.includes("/master/README.md"))).toBe(true);
  });

  it("escapes HTML and blocks attribute injection through link URLs", () => {
    expect(renderSimpleMarkdown("<script>alert(1)</script>")).not.toContain("<script");

    // A quote in the URL must not break out of href="…"
    const html = renderSimpleMarkdown('[x](https://evil.test/" onmouseover="steal)');
    expect(html).not.toContain('onmouseover="');
    expect(html).not.toMatch(/href="[^"]*"\s+on/i);

    // Plain links still render
    expect(renderSimpleMarkdown("[docs](https://chronoslab.space)")).toContain(
      '<a href="https://chronoslab.space"'
    );
  });
});
