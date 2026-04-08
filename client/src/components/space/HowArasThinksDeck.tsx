import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./HowArasThinksDeck.module.css";

type Step = {
  key: "INPUT" | "CONTEXT" | "DECISION" | "EXECUTION" | "FEEDBACK";
  label: string;
  statement: string;
  moduleTitle: string;
  what: string;
  why: string;
  output: string;
};

const STEPS: Step[] = [
  {
    key: "INPUT",
    label: "INPUT",
    statement: "Du gibst ein Ziel vor. Mehr nicht.",
    moduleTitle: "INPUT MODULE",
    what: "Ziel wird zu einer klaren Gesprächsabsicht verdichtet.",
    why: "Ohne sauberen Auftrag wirkt jeder Call künstlich.",
    output: "Intent-Profil als Startsignal.",
  },
  {
    key: "CONTEXT",
    label: "CONTEXT",
    statement: "ARAS priorisiert Regeln, Wissen und Tonalität.",
    moduleTitle: "CONTEXT MODULE",
    what: "Regeln & Sprache werden als Context Stack sortiert.",
    why: "Konsistenz = Vertrauen im Gespräch.",
    output: "Context Stack.",
  },
  {
    key: "DECISION",
    label: "DECISION",
    statement: "Jeder Call entscheidet live — nicht nach Skript.",
    moduleTitle: "DECISION MODULE",
    what: "Einstieg, Tempo, Einwände werden situativ gewählt.",
    why: "Menschen reagieren nicht linear.",
    output: "Decision Path pro Session.",
  },
  {
    key: "EXECUTION",
    label: "EXECUTION",
    statement: "Ausführung läuft parallel — sauber getrennt.",
    moduleTitle: "EXECUTION MODULE",
    what: "Jeder Kontakt ist eine isolierte Session mit eigenem Zustand.",
    why: "Skalierung ohne Vermischung.",
    output: "Parallel Sessions.",
  },
  {
    key: "FEEDBACK",
    label: "FEEDBACK",
    statement: "Ergebnisse fließen zurück — als Signal, nicht als Chaos.",
    moduleTitle: "FEEDBACK MODULE",
    what: "Outcome wird strukturiert und verwertbar gespeichert.",
    why: "Das System wird mit jedem Lauf stabiler.",
    output: "Feedback Signals.",
  },
];

function useIsMobile(breakpointPx = 860) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [breakpointPx]);

  return isMobile;
}

export default function HowArasThinksDeck() {
  const isMobile = useIsMobile(860);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const rootRef = useRef<HTMLElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setOpenIndex(activeIndex);
  }, [activeIndex, isMobile]);

  const active = useMemo(() => STEPS[Math.max(0, Math.min(STEPS.length - 1, activeIndex))], [activeIndex]);

  const onHover = (i: number) => {
    if (isMobile) return;
    if (pinned) return;
    setActiveIndex(i);
  };

  const onClick = (i: number) => {
    if (isMobile) {
      setActiveIndex(i);
      setOpenIndex((prev) => (prev === i ? null : i));
      return;
    }

    if (pinned && activeIndex === i) {
      setPinned(false);
      return;
    }
    setActiveIndex(i);
    setPinned(true);
  };

  return (
    <section
      ref={(n) => (rootRef.current = n)}
      className={`${styles.wrap} ${entered ? styles.entered : ""}`}
      aria-label="How ARAS Thinks"
      data-pinned={pinned ? "1" : "0"}
    >
      <div className={styles.drift} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.kicker}>
          <span className={styles.kDot} />
          <span>HOW ARAS THINKS</span>
        </div>

        <div className={styles.subline}>
          <span className={styles.subGlow} aria-hidden="true" />
          <span>Operator Deck — vom Ziel bis zum Feedback, als saubere Signal-Kette.</span>
        </div>
      </header>

      <div className={styles.deck}>
        <div className={styles.rail} aria-hidden="true">
          <div className={styles.railLine} />
          <div className={styles.railPulse} />
        </div>

        <div className={styles.steps} role="list">
          {STEPS.map((s, i) => {
            const isActive = i === activeIndex;
            const isOpen = isMobile && openIndex === i;

            return (
              <div
                key={s.key}
                className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
                style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
                role="listitem"
                onMouseEnter={() => onHover(i)}
              >
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => onClick(i)}
                  aria-expanded={isMobile ? (isOpen ? "true" : "false") : undefined}
                  aria-controls={isMobile ? `aras-think-dossier-${i}` : undefined}
                >
                  <div className={styles.leftLabel}>
                    <span className={styles.label}>{s.label}</span>
                  </div>

                  <div className={styles.nodeCol} aria-hidden="true">
                    <span className={styles.nodeDot} data-active={isActive ? "1" : "0"} />
                    <span className={styles.nodeRing} data-active={isActive ? "1" : "0"} />
                    <span className={styles.nodeSweep} data-active={isActive ? "1" : "0"} />
                  </div>

                  <div className={styles.textCol}>
                    <div className={styles.statement}>{s.statement}</div>
                    <div className={styles.hint}>{s.output}</div>
                  </div>

                  <div className={styles.glyph} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </button>

                {isMobile && (
                  <div
                    id={`aras-think-dossier-${i}`}
                    className={`${styles.inlineDossier} ${isOpen ? styles.inlineOpen : ""}`}
                  >
                    <div className={styles.dossierInner}>
                      <div className={styles.dTitle}>{s.moduleTitle}</div>
                      <div className={styles.dLine}><b>Was passiert:</b> {s.what}</div>
                      <div className={styles.dLine}><b>Warum wichtig:</b> {s.why}</div>
                      <div className={styles.dLine}><b>Output:</b> {s.output}</div>
                      <div className={styles.meter} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isMobile && (
          <aside className={styles.dossier} aria-label="Selected module details">
            <div className={styles.dossierGlass}>
              <div key={active.key} className={styles.dossierSwap}>
                <div className={styles.dTitle}>{active.moduleTitle}</div>
                <div className={styles.dLine}><b>Was passiert:</b> {active.what}</div>
                <div className={styles.dLine}><b>Warum wichtig:</b> {active.why}</div>
                <div className={styles.dLine}><b>Output:</b> {active.output}</div>
              </div>

              <div className={styles.meter} aria-hidden="true">
                <i />
                <i />
                <i />
              </div>

              <div className={styles.pinHint}>
                {pinned ? "Pinned — ESC zum Lösen" : "Hover zum Preview · Click zum Pinnen"}
              </div>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
