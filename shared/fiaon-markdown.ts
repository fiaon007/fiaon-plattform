// ═══════════════════════════════════════════════════════════════════════════
// Markdown für den Ratgeber — klein, vorhersehbar, ohne Bibliothek (23.08.2026)
//
// Der Generator liefert Markdown, die Redaktion schreibt Markdown, die Seite
// zeigt HTML. Unterstützt: ##/### Überschriften, Absätze, Listen (- und 1.),
// **fett**, *kursiv*, [Links](…), > Zitate, Tabellen mit |, --- Linien.
// Alles andere bleibt Text. HTML im Markdown wird entschärft.
// ═══════════════════════════════════════════════════════════════════════════

export interface TocEintrag { id: string; text: string; ebene: 2 | 3 }

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function ankerId(text: string): string {
  return text.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}
function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_m, text, href) => {
    const extern = /^https?:\/\//.test(href) && !href.includes("fiaon.com");
    return `<a href="${href}"${extern ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  });
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

export function inhaltsverzeichnis(md: string): TocEintrag[] {
  const out: TocEintrag[] = [];
  for (const zeile of md.split("\n")) {
    const m = /^(##|###) (.+)$/.exec(zeile.trim());
    if (m) out.push({ id: ankerId(m[2]), text: m[2].replace(/\*\*/g, ""), ebene: m[1] === "##" ? 2 : 3 });
  }
  return out;
}

export function markdownZuHtml(md: string): string {
  const zeilen = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const absatz: string[] = [];
  const flush = () => { if (absatz.length) { out.push(`<p>${inline(absatz.join(" "))}</p>`); absatz.length = 0; } };
  while (i < zeilen.length) {
    const z = zeilen[i];
    const t = z.trim();
    if (!t) { flush(); i++; continue; }
    let m: RegExpExecArray | null;
    if ((m = /^(##|###|####) (.+)$/.exec(t))) { flush(); const eb = m[1].length; out.push(`<h${eb} id="${ankerId(m[2])}">${inline(m[2])}</h${eb}>`); i++; continue; }
    if (/^(---|\*\*\*)$/.test(t)) { flush(); out.push("<hr />"); i++; continue; }
    if (t.startsWith("> ")) { flush(); const q: string[] = []; while (i < zeilen.length && zeilen[i].trim().startsWith("> ")) { q.push(zeilen[i].trim().slice(2)); i++; } out.push(`<blockquote><p>${inline(q.join(" "))}</p></blockquote>`); continue; }
    if (/^[-*] /.test(t)) { flush(); const li: string[] = []; while (i < zeilen.length && /^[-*] /.test(zeilen[i].trim())) { li.push(`<li>${inline(zeilen[i].trim().slice(2))}</li>`); i++; } out.push(`<ul>${li.join("")}</ul>`); continue; }
    if (/^\d+\. /.test(t)) { flush(); const li: string[] = []; while (i < zeilen.length && /^\d+\. /.test(zeilen[i].trim())) { li.push(`<li>${inline(zeilen[i].trim().replace(/^\d+\. /, ""))}</li>`); i++; } out.push(`<ol>${li.join("")}</ol>`); continue; }
    if (t.startsWith("|")) {
      flush(); const rows: string[][] = [];
      while (i < zeilen.length && zeilen[i].trim().startsWith("|")) { const r = zeilen[i].trim(); i++; if (/^\|[\s:-]+\|?$/.test(r.replace(/\|/g, "|"))) continue; rows.push(r.split("|").slice(1, -1).map((c) => c.trim())); }
      if (rows.length) {
        const [kopf, ...rest] = rows;
        out.push(`<div class="rg-tabelle"><table><thead><tr>${kopf.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rest.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      }
      continue;
    }
    absatz.push(t); i++;
  }
  flush();
  return out.join("\n");
}

/** Reiner Text (für Meta-Angaben, Suche, Lesezeit). */
export function textAusMarkdown(md: string): string {
  return md.replace(/^#+ /gm, "").replace(/[*_`>|]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}
