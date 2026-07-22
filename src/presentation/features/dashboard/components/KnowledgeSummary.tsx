import { Link } from "react-router-dom";
import { knowledgeCounts } from "../../../../domain/workspace/seed";
import type { KnowledgeRecord, NoteRecord } from "../../../../domain/workspace/types";

type Props = {
  knowledge: readonly KnowledgeRecord[];
  notes: readonly NoteRecord[];
};

/** Documents · Notes · URLs */
export function KnowledgeSummary({ knowledge, notes }: Props) {
  const counts = knowledgeCounts(knowledge);
  // Prefer notes table count when present; knowledge also stores type=note
  const noteCount = Math.max(notes.length, counts.notes);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Knowledge
        </div>
        <Link
          to="/workspace/knowledge"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos hover:text-ink"
        >
          Library →
        </Link>
      </div>
      <Link
        to="/workspace/knowledge"
        className="mt-4 grid grid-cols-3 gap-3 border border-line p-4 transition duration-200 hover:border-chronos/40 hover:bg-chronos/5"
      >
        <Stat label="Documents" value={counts.documents} />
        <Stat label="Notes" value={noteCount} />
        <Stat label="URLs" value={counts.urls} />
      </Link>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif text-2xl text-ink">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}
