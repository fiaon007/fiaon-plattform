import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SpaceOperatorDeck.module.css';

interface Step {
  id: string;
  label: string;
  statement: string;
  dossier: {
    title: string;
    wasPassiert: string;
    warumWichtig: string;
    output: string;
  };
}

const STEPS: Step[] = [
  {
    id: 'input',
    label: 'INPUT',
    statement: 'Du gibst ein Ziel vor. Mehr nicht.',
    dossier: {
      title: 'INPUT MODULE',
      wasPassiert: 'Ziel wird in eine Gesprächsabsicht übersetzt.',
      warumWichtig: 'Klarer Auftrag = stabiler Gesprächsverlauf.',
      output: 'Intent-Profil für die nächste Stufe.',
    },
  },
  {
    id: 'context',
    label: 'CONTEXT',
    statement: 'ARAS baut Kontext aus Regeln, Wissen und Ton.',
    dossier: {
      title: 'CONTEXT MODULE',
      wasPassiert: 'Regeln + Tonalität werden priorisiert.',
      warumWichtig: 'Konsistenz verhindert "Script-Vibes".',
      output: 'Context Stack.',
    },
  },
  {
    id: 'decision',
    label: 'DECISION',
    statement: 'Jeder Anruf wird individuell entschieden.',
    dossier: {
      title: 'DECISION MODULE',
      wasPassiert: 'Einstieg, Tempo, Einwände werden dynamisch gewählt.',
      warumWichtig: 'Menschen reagieren nicht linear.',
      output: 'Decision Tree pro Gespräch.',
    },
  },
  {
    id: 'execution',
    label: 'EXECUTION',
    statement: 'Ausführung läuft parallel — ohne Qualitätsverlust.',
    dossier: {
      title: 'EXECUTION MODULE',
      wasPassiert: 'Anrufe werden als isolierte Sessions gefahren.',
      warumWichtig: 'Skalierung ohne Vermischung.',
      output: 'Parallel Sessions.',
    },
  },
  {
    id: 'feedback',
    label: 'FEEDBACK',
    statement: 'Ergebnisse fließen zurück ins System.',
    dossier: {
      title: 'FEEDBACK MODULE',
      wasPassiert: 'Outcome wird strukturiert gespeichert.',
      warumWichtig: 'Kontinuität über Zeit.',
      output: 'Feedback Signals.',
    },
  },
];

export default function SpaceOperatorDeck() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [showScanSweep, setShowScanSweep] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  // Check for reduced motion preference
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // IntersectionObserver for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasEntered) {
          setHasEntered(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasEntered]);

  // Escape key to unpin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pinned) {
        setPinned(false);
        setActiveIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinned]);

  // Determine which dossier to show
  const displayIndex = pinned ? activeIndex : (hoverIndex ?? activeIndex);

  const handleStepClick = useCallback((index: number) => {
    if (activeIndex === index && pinned) {
      // Clicking same pinned step unpins
      setPinned(false);
      setActiveIndex(null);
    } else {
      setActiveIndex(index);
      setPinned(true);
      // Trigger scan sweep animation
      setShowScanSweep(index);
      setTimeout(() => setShowScanSweep(null), 900);
    }
  }, [activeIndex, pinned]);

  const handleStepHover = useCallback((index: number | null) => {
    if (!pinned) {
      setHoverIndex(index);
    }
  }, [pinned]);

  return (
    <section
      ref={containerRef}
      className={styles.container}
      aria-label="How ARAS thinks"
      role="region"
    >
      {/* Aura Layer */}
      <div className={styles.auraLayer} aria-hidden="true" />

      {/* Matrix Drift Layer */}
      <div className={styles.matrixDrift} aria-hidden="true" />

      {/* Header */}
      <h2
        className={styles.header}
        style={{
          opacity: hasEntered ? 1 : 0,
          transform: hasEntered ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        HOW ARAS THINKS
      </h2>

      {/* Signal Bus (vertical line) */}
      <div className={styles.signalBus} aria-hidden="true" />

      {/* Grid */}
      <div className={styles.grid} role="list">
        {STEPS.map((step, index) => {
          const isActive = displayIndex === index;
          const delay = prefersReducedMotion.current ? 0 : index * 0.11;

          return (
            <div
              key={step.id}
              className={`${styles.stepRow} ${isActive ? styles.stepActive : ''}`}
              role="listitem"
              style={{
                opacity: hasEntered ? 1 : 0,
                transform: hasEntered ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 0.26s ease ${delay}s, transform 0.26s ease ${delay}s`,
              }}
              onMouseEnter={() => handleStepHover(index)}
              onMouseLeave={() => handleStepHover(null)}
            >
              {/* Label */}
              <div className={styles.label}>{step.label}</div>

              {/* Node */}
              <div className={styles.nodeContainer}>
                <button
                  className={styles.node}
                  onClick={() => handleStepClick(index)}
                  aria-label={`${step.label} module details`}
                  aria-expanded={isActive}
                >
                  {showScanSweep === index && (
                    <span className={styles.scanSweep} aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Statement */}
              <div
                className={styles.statement}
                onClick={() => handleStepClick(index)}
              >
                {step.statement}
              </div>

              {/* Dossier (only on desktop, or inline on tablet/mobile) */}
              <div className={styles.dossier}>
                <div
                  className={`${styles.dossierPanel} ${isActive ? styles.dossierVisible : ''}`}
                >
                  <div className={styles.dossierTitle}>{step.dossier.title}</div>
                  <div className={styles.dossierContent}>
                    <div className={styles.dossierLine}>
                      <span className={styles.dossierKey}>Was passiert:</span>
                      <span className={styles.dossierValue}>{step.dossier.wasPassiert}</span>
                    </div>
                    <div className={styles.dossierLine}>
                      <span className={styles.dossierKey}>Warum wichtig:</span>
                      <span className={styles.dossierValue}>{step.dossier.warumWichtig}</span>
                    </div>
                    <div className={styles.dossierLine}>
                      <span className={styles.dossierKey}>Output:</span>
                      <span className={styles.dossierValue}>{step.dossier.output}</span>
                    </div>
                  </div>
                  <div className={styles.signalMeter} aria-hidden="true">
                    <div className={styles.signalBar} style={{ '--base-height': '40%' } as React.CSSProperties} />
                    <div className={styles.signalBar} style={{ '--base-height': '70%' } as React.CSSProperties} />
                    <div className={styles.signalBar} style={{ '--base-height': '55%' } as React.CSSProperties} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
