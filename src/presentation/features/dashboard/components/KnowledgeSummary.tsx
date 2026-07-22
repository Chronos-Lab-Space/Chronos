import { Link } from "react-router-dom";
import { knowledgeCounts } from "../../../../domain/workspace/seed";
import type { KnowledgeRecord, NoteRecord } from "../../../../domain/workspace/types";

export function KnowledgeSummary({
  knowledge,
  notes,
}: {
  knowledge: readonly KnowledgeRecord[];
  notes: readonly NoteRecord[];
}) {
  const counts = knowledgeCounts(knowledge);
  const noteCount = Math.max(notes.length, counts.notes);
  return (
    <Link
      to="/workspace/knowledge"
      className="group block rounded-2xl border border-line p-5 hover:border-chronos/40 sm:p-6"
    >
      <div className="flex justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Knowledge card
        </div>
        <span className="font-mono text-[10px] uppercase text-chronos">Knowledge Library →</span>
      </div>
      <p className="mt-3 text-sm text-ink">
        <span className="font-mono text-chronos">{counts.documents}</span> Docs ·{" "}
        <span className="font-mono text-chronos">{noteCount}</span> Notes ·{" "}
        <span className="font-mono text-chronos">{counts.urls}</span> URLs
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          ["Docs", counts.documents],
          ["Notes", noteCount],
          ["URLs", counts.urls],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border border-line px-3 py-3 text-center">
            <div className="font-serif text-2xl text-ink">{v}</div>
            <div className="font-mono text-[9px] uppercase text-ink-faint">{l}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}
