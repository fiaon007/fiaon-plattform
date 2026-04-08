import { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ArrowRight, Clock, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { de } from "date-fns/locale";
import { getNextGlobalEvent, GLOBAL_EVENT_LABELS } from "@/lib/global-events-2026";

interface CalendarEventRaw {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  status: "scheduled" | "completed" | "cancelled";
}

interface DisplayEvent {
  title: string;
  date: string;
  time?: string;
  isGlobal: boolean;
  category?: string;
}

export function SpaceCalendarBanner() {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 30 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenTriggered, setSheenTriggered] = useState(false);
  const { user } = useAuth();

  // Fetch upcoming events (next 30 days, lightweight)
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const endDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const {
    data: nextEvent,
    isLoading,
    isError,
  } = useQuery<DisplayEvent | null>({
    queryKey: ["/api/calendar/events", "space-next", today],
    queryFn: async () => {
      try {
        const res = await fetch(
          `/api/calendar/events?start=${today}&end=${endDate}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const events: CalendarEventRaw[] = await res.json();
          if (Array.isArray(events) && events.length > 0) {
            const upcoming = events
              .filter((e) => e.status === "scheduled")
              .sort((a, b) => {
                const da = `${a.date}T${a.time || "00:00"}`;
                const db = `${b.date}T${b.time || "00:00"}`;
                return da.localeCompare(db);
              });
            if (upcoming[0]) {
              return {
                title: upcoming[0].title,
                date: upcoming[0].date,
                time: upcoming[0].time,
                isGlobal: false,
              };
            }
          }
        }
      } catch {
        // Personal events fetch failed — fall through to global
      }

      // Fallback: next global event (holiday, marker, ARAS update)
      const globalEvent = getNextGlobalEvent(today);
      if (globalEvent) {
        return {
          title: globalEvent.title,
          date: globalEvent.date,
          time: undefined,
          isGlobal: true,
          category: globalEvent.category,
        };
      }

      return null;
    },
    enabled: !!user,
    staleTime: 60000,
    retry: 1,
  });

  // Format the next event date nicely
  const formattedDate = useMemo(() => {
    if (!nextEvent) return "";
    try {
      const d = parseISO(nextEvent.date);
      const time = nextEvent.time || "";
      let dayLabel: string;
      if (isToday(d)) {
        dayLabel = "Heute";
      } else if (isTomorrow(d)) {
        dayLabel = "Morgen";
      } else {
        dayLabel = format(d, "EEE, d. MMM", { locale: de });
      }
      return time ? `${dayLabel} · ${time}` : dayLabel;
    } catch {
      return nextEvent.date;
    }
  }, [nextEvent]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePosition({ x, y });
    },
    [prefersReducedMotion]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      setSheenTriggered(true);
      setTimeout(() => setSheenTriggered(false), 650);
    }
  }, [prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!prefersReducedMotion) {
      setMousePosition({ x: 50, y: 30 });
    }
  }, [prefersReducedMotion]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.15, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full"
      style={{
        maxWidth: "1120px",
        marginTop: "14px",
        paddingLeft: "12px",
        paddingRight: "12px",
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative rounded-[18px] overflow-hidden"
        style={{
          padding: "18px 18px 16px 18px",
          background: `
            linear-gradient(135deg, rgba(254,145,0,0.08), rgba(233,215,196,0.04) 45%, rgba(0,0,0,0) 100%),
            rgba(15,15,15,0.62)
          `,
          border:
            isHovered && !prefersReducedMotion
              ? "1px solid rgba(254,145,0,0.26)"
              : "1px solid rgba(255,255,255,0.10)",
          boxShadow:
            isHovered && !prefersReducedMotion
              ? "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06), 0 0 28px rgba(254,145,0,0.10)"
              : "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
          transition: prefersReducedMotion
            ? "border-color 120ms, background 120ms"
            : "border-color 160ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 160ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        {/* Pointer-follow Glow */}
        {!prefersReducedMotion && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-220"
            style={{
              opacity: isHovered ? 1 : 0,
              background: `radial-gradient(240px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(254,145,0,0.14), transparent 55%)`,
            }}
          />
        )}

        {/* Sheen sweep */}
        {!prefersReducedMotion && (
          <div
            className="absolute inset-[-2px] pointer-events-none overflow-hidden rounded-[18px]"
            style={{ zIndex: 10 }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.10) 35%, transparent 70%)",
                transform: sheenTriggered
                  ? "translateX(120%)"
                  : "translateX(-120%)",
                transition: sheenTriggered
                  ? "transform 650ms cubic-bezier(0.2,0.8,0.2,1)"
                  : "none",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative z-20 flex flex-col gap-3">
          {/* Top: Icon + Text + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Icon + Text */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Icon */}
              <div
                className="flex items-center justify-center shrink-0 rounded-[14px]"
                style={{
                  width: "44px",
                  height: "44px",
                  border: "1px solid rgba(233,215,196,0.14)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <CalendarDays
                  className="w-[20px] h-[20px]"
                  style={{
                    color: "#FE9100",
                    filter: "drop-shadow(0 0 14px rgba(254,145,0,0.20))",
                  }}
                />
              </div>

              {/* Text */}
              <div className="min-w-0">
                <h3
                  className="font-semibold leading-[1.15] mb-1"
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "rgba(233,215,196,0.95)",
                  }}
                >
                  Kalender &amp; Terminverwaltung
                </h3>
                <p
                  className="leading-[1.45]"
                  style={{
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.62)",
                    maxWidth: "58ch",
                  }}
                >
                  Alle Termine, die ARAS AI im Gespräch für Sie vereinbart,
                  werden automatisch im Kalender gespeichert. Sie können auch
                  eigene Termine hinzufügen — damit sie im Dashboard angezeigt
                  werden und ARAS immer den aktuellen Stand kennt.
                </p>
              </div>
            </div>

            {/* Right: CTA Pill */}
            <Link href="/app/calendar" asChild>
              <a
                aria-label="Kalender öffnen"
                className="shrink-0 flex items-center gap-2 rounded-full self-start sm:self-center outline-none"
                style={{
                  height: "32px",
                  padding: "0 14px",
                  background: isHovered
                    ? "rgba(254,145,0,0.18)"
                    : "rgba(254,145,0,0.12)",
                  border: isHovered
                    ? "1px solid rgba(254,145,0,0.35)"
                    : "1px solid rgba(254,145,0,0.25)",
                  transition: "background 160ms, border-color 160ms",
                  cursor: "pointer",
                }}
              >
                <span
                  className="font-semibold whitespace-nowrap"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  Kalender öffnen
                </span>
                <ArrowRight
                  className="w-3.5 h-3.5"
                  style={{
                    color: "rgba(255,255,255,0.88)",
                    transition:
                      "transform 160ms cubic-bezier(0.2,0.8,0.2,1)",
                    transform: isHovered
                      ? "translateX(2px)"
                      : "translateX(0)",
                  }}
                />
              </a>
            </Link>
          </div>

          {/* Live Row: Nächster Termin */}
          <div
            className="flex items-center justify-between gap-3 rounded-[14px]"
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.018)",
              border: "1px solid rgba(233,215,196,0.10)",
              minHeight: "42px",
            }}
            aria-live="polite"
          >
            <span
              className="flex items-center gap-2"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(233,215,196,0.65)",
                letterSpacing: "0.02em",
              }}
            >
              <Clock
                className="w-3.5 h-3.5"
                style={{ color: "rgba(254,145,0,0.60)" }}
              />
              Nächster Termin
            </span>

            {/* States */}
            <div
              className="flex items-center gap-2 min-w-0"
              style={{ fontSize: "13px" }}
            >
              {isLoading && (
                <div
                  className="rounded-md"
                  style={{
                    width: "140px",
                    height: "14px",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
                    backgroundSize: "200% 100%",
                    animation: prefersReducedMotion
                      ? "none"
                      : "skeletonPulse 1.5s ease-in-out infinite",
                  }}
                />
              )}

              {!isLoading && isError && (
                <span style={{ color: "rgba(255,255,255,0.40)" }}>
                  Nicht verfügbar
                </span>
              )}

              {!isLoading && !isError && !nextEvent && (
                <Link href="/app/calendar">
                  <span
                    style={{
                      color: "rgba(254,145,0,0.75)",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Keine Termine geplant
                  </span>
                </Link>
              )}

              {!isLoading && !isError && nextEvent && (
                <span
                  className="flex items-center gap-2 truncate"
                  style={{ color: "rgba(255,255,255,0.82)", fontWeight: 500 }}
                >
                  {nextEvent.isGlobal && (
                    <Globe
                      className="w-3 h-3 shrink-0"
                      style={{ color: "rgba(255,255,255,0.40)" }}
                    />
                  )}
                  <span className="truncate" style={{ maxWidth: "180px" }}>
                    {nextEvent.title}
                  </span>
                  <span
                    style={{
                      color: "rgba(254,145,0,0.80)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formattedDate}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Focus Ring */}
        <style>{`
          .group:focus-within {
            outline: none;
            box-shadow: 0 0 0 2px rgba(254,145,0,0.55), 0 0 0 5px rgba(0,0,0,0.65) !important;
          }
          @keyframes skeletonPulse {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    </motion.div>
  );
}
