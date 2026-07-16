import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════
// AiKit — gemeinsame Bausteine für KI-Aktionen im Admin-Bereich.
//
// <AiButton busy={…}>KI-Analyse erstellen</AiButton>
//   Hochwertige, zurückhaltende Optik im CI: subtiler dunkler Verlauf,
//   feine Tiefe (Innenkante + weicher Schatten) statt Neon/Glow.
//   Ladezustand ist ruhig (sanft pulsierendes Icon), kein harter Spinner.
//
// <Markdown text={…} />
//   Rendert KI-Ausgabe SAUBER (Überschriften, Listen, Fettung) statt
//   Markdown-Rohtext (## …, **…**) roh auf der Seite stehen zu lassen.
//   Monochrom-slate, begrenzte Lesebreite für ruhigen Textfluss.
// ═══════════════════════════════════════════════════════════════════

export function AiButton({
  busy = false,
  busyLabel = "Analysiert …",
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; busyLabel?: ReactNode }) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      aria-busy={busy}
      className={cn(
        "fiaon-ai-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-[12.5px] font-semibold min-h-[44px] select-none",
        "transition-[transform,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-80",
        className,
      )}
      {...props}
    >
      <Sparkles size={14} className={busy ? "fiaon-ai-pulse" : "opacity-90"} />
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

// ── Inline-Markdown: **fett**, *kursiv*, `code` ──────────────────────
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-slate-900">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={`${keyPrefix}-c${i}`} className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[0.85em] text-slate-700">{tok.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i${i}`} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; }
  };
  for (let raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) { flushPara(); continue; }
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { flushPara(); blocks.push({ type: "h", level: heading[1].length, text: heading[2] }); continue; }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "ul") prev.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
      continue;
    }
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "ol") prev.items.push(numbered[1]);
      else blocks.push({ type: "ol", items: [numbered[1]] });
      continue;
    }
    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text || "");
  const headingSize = (l: number) =>
    l <= 1 ? "text-[15px] font-bold text-slate-900 mt-4 first:mt-0"
    : l === 2 ? "text-[13.5px] font-bold text-slate-900 mt-4 first:mt-0"
    : "text-[12.5px] font-semibold uppercase tracking-wide text-slate-500 mt-3 first:mt-0";
  return (
    <div className={cn("fiaon-md max-w-[68ch] text-[13px] leading-relaxed text-slate-700 space-y-2", className)}>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          const cls = headingSize(b.level);
          if (b.level <= 1) return <h3 key={i} className={cls}>{renderInline(b.text, `h${i}`)}</h3>;
          if (b.level === 2) return <h4 key={i} className={cls}>{renderInline(b.text, `h${i}`)}</h4>;
          return <p key={i} className={cls}>{renderInline(b.text, `h${i}`)}</p>;
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span className="flex-1">{renderInline(it, `ul${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[1px] tabular-nums font-semibold text-slate-400 min-w-[1.1rem]">{j + 1}.</span>
                  <span className="flex-1">{renderInline(it, `ol${i}-${j}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{renderInline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
