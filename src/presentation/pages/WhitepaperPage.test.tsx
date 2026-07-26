import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "../components/Footer";
import { WhitepaperPage } from "./WhitepaperPage";

describe("WhitepaperPage", () => {
  it("renders the document masthead, all eight sections, and the colophon", () => {
    render(
      <MemoryRouter>
        <WhitepaperPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Chronos: A Temporal Compute Layer for Decisions/,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Whitepaper · v1.0")).toBeInTheDocument();

    for (const section of [
      /The Continuity Problem/,
      /Decision Infrastructure/,
      /The Temporal Engine/,
      /System Architecture/,
      /^05Product$/,
      /Business Model/,
      /Status & Traction/,
      /^08Vision$/,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: section })).toBeInTheDocument();
    }

    // Table 1 lists all seven target services (the other table is the
    // running-footer frame, which carries one body row and one footer row).
    const services = document.querySelector(".wp-table");
    expect(services?.querySelectorAll(":scope > tbody > tr")).toHaveLength(7);
    expect(screen.getByText("Ranking Engine")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "github.com/Chronos-Lab-Space/Chronos" })
    ).toHaveAttribute("href", "https://github.com/Chronos-Lab-Space/Chronos");
  });

  it("prints the document from the toolbar", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);

    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <MemoryRouter>
        <WhitepaperPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: /Print \/ Save PDF/i }));
    expect(print).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});

describe("Footer", () => {
  it("links to the whitepaper from Resources", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Whitepaper" })).toHaveAttribute("href", "/whitepaper");
  });
});
