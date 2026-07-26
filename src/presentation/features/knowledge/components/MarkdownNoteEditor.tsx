import { renderSimpleMarkdown } from "../../../../domain/workspace/knowledge";

type Props = {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  preview?: boolean;
};

/** Simple markdown editor with live preview (no heavy deps). */
export function MarkdownNoteEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  preview = true,
}: Props) {
  return (
    <div className="space-y-3">
      <input
        required
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Note title"
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
      />
      <div className={`grid grid-cols-1 gap-3 ${preview ? "lg:grid-cols-2" : ""}`}>
        <div>
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
            Write
          </div>
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            rows={12}
            placeholder={"# Heading\n\n**Bold** and `code`\n\n- list item"}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[13px] leading-relaxed text-ink focus:border-chronos focus:outline-none"
          />
        </div>
        {preview && (
          <div>
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
              Preview
            </div>
            <div
              className="prose-lite min-h-[12rem] rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink-dim"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: renderSimpleMarkdown escapes &<>"' and allows https-only links (covered by knowledge.test.ts)
              dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(content || "_Nothing yet_") }}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-ink-faint">
        Supports headings, lists, bold, italic, code, and links — enough for working notes.
      </p>
      <style>{`
        .prose-lite h1 { font-family: Instrument Serif, serif; font-size: 1.5rem; color: #e2ddda; margin: 0.5rem 0; }
        .prose-lite h2 { font-family: Instrument Serif, serif; font-size: 1.25rem; color: #e2ddda; margin: 0.5rem 0; }
        .prose-lite h3 { font-size: 1rem; color: #e2ddda; margin: 0.4rem 0; }
        .prose-lite p { margin: 0.35rem 0; }
        .prose-lite ul { margin: 0.35rem 0 0.35rem 1.1rem; list-style: disc; }
        .prose-lite code { font-family: JetBrains Mono, monospace; font-size: 0.85em; color: #60899b; }
        .prose-lite a { color: #60899b; text-decoration: underline; }
        .prose-lite strong { color: #e2ddda; }
      `}</style>
    </div>
  );
}
