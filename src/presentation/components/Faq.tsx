import { PageHeader } from "./PageHeader";
import { useAccessModal } from "../features/access/AccessModal";

type FaqItem = {
  question: string;
  answer: React.ReactNode;
};

const faqs: FaqItem[] = [
  {
    question: "What is Chronos?",
    answer:
      "Chronos is a decision intelligence platform that helps people and AI explore multiple possible futures before making important decisions.",
  },
  {
    question: "How is Chronos different from LLM models?",
    answer: (
      <>
        <p>Most LLM models generate a single response.</p>
        <p className="mt-3">
          Chronos evaluates multiple possible strategies, compares trade-offs, and
          recommends the strongest path based on your goals and context.
        </p>
      </>
    ),
  },
  {
    question: "Who is Chronos for?",
    answer:
      "Chronos is designed for founders, developers, product managers, researchers, and teams making complex decisions.",
  },
  {
    question: "How does a simulation work?",
    answer:
      "You define a goal, provide context, and set any constraints. Chronos generates multiple possible futures, evaluates them, and presents recommendations with supporting reasoning and trade-offs.",
  },
  {
    question: "What is a workspace?",
    answer:
      "A workspace is where your goals, knowledge, simulations, and decision history are stored.",
  },
  {
    question: "What is the Knowledge Library?",
    answer:
      "The Knowledge Library stores documents, notes, and web resources that provide context for simulations.",
  },
  {
    question: "Can I revisit previous simulations?",
    answer:
      "Yes. Every simulation is saved, allowing you to compare results over time and rerun them as your context changes.",
  },
  {
    question: "Is Chronos available today?",
    answer:
      "Chronos is currently in active development. You can join the private beta to get early access.",
  },
  {
    question: "What is CLAB?",
    answer:
      "CLAB is the planned native asset of the Chronos ecosystem. It is intended to support platform access, incentives, and coordination as the ecosystem grows.",
  },
  {
    question: "Do I need CLAB to use Chronos?",
    answer:
      "No. The core Chronos platform is designed to be usable without requiring CLAB. The asset is planned for ecosystem-level capabilities rather than basic product access.",
  },
];

export function FaqPage() {
  const { openAccessModal } = useAccessModal();

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "FAQ" }]}
        eyebrow="/ faq"
        title={
          <>
            Questions<span className="text-ink-faint">.</span>
            <br />
            <span className="italic text-ink-dim">Answered.</span>
          </>
        }
        subtitle="Short answers about Chronos, simulations, workspaces, and the ecosystem."
      />

      <section className="relative pb-24 lg:pb-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <div className="divide-y divide-line rounded-2xl border border-line bg-bg-soft">
            {faqs.map((item, i) => (
              <details key={item.question} className="group faq-item">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-5 transition hover:bg-bg/40 sm:px-6 sm:py-6 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <span className="mt-0.5 shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-chronos">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-serif text-[17px] leading-snug text-ink sm:text-[19px]">
                      {item.question}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint transition group-open:border-chronos/40 group-open:text-chronos"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="transition duration-200 group-open:rotate-45"
                    >
                      <path
                        d="M6 2v8M2 6h8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="px-5 pb-5 text-[14px] leading-[1.7] text-ink-dim sm:px-6 sm:pb-6 sm:pl-[4.25rem] sm:text-[15px]">
                  {typeof item.answer === "string" ? <p>{item.answer}</p> : item.answer}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-line bg-bg-soft p-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-chronos">
              Still curious?
            </div>
            <p className="text-[15px] leading-[1.65] text-ink-dim">
              Chronos is in private beta. Request access to explore simulations in your own
              workspace.
            </p>
            <button
              type="button"
              onClick={openAccessModal}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition hover:bg-chronos"
            >
              Request access
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6h8M6 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
