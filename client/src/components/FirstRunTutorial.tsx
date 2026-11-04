import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Hand, Layers, MessageSquareQuote, RotateCw, Swords, Trophy, AtSign } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OPEN_TUTORIAL_EVENT } from "@/lib/tutorial";

type Step = { kicker: string; title: string; body: ReactNode; art: ReactNode };

const Kicker = ({ children }: { children: ReactNode }) => (
  <p className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">{children}</p>
);

const StanceChips = () => (
  <div className="flex flex-wrap justify-center gap-2">
    <span className="bg-stance-for px-3 py-1 font-ui text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground">For</span>
    <span className="bg-stance-against px-3 py-1 font-ui text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground">Against</span>
    <span className="bg-stance-neutral px-3 py-1 font-ui text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground">Neutral</span>
  </div>
);

/** Mini card stack: the top card slides off to the left, like "next" in the real deck. */
const DeckArt = () => (
  <div className="relative mx-auto h-28 w-44" aria-hidden>
    <div className="absolute inset-0 translate-x-2 translate-y-2 border bg-card" />
    <motion.div
      className="absolute inset-0 flex flex-col gap-1.5 border bg-card p-3 shadow-sm"
      animate={{ x: [0, 0, -70, -70, 0], rotate: [0, 0, -8, -8, 0], opacity: [1, 1, 0, 0, 1] }}
      transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.35, 0.6, 0.85, 1] }}
    >
      <div className="h-2 w-16 bg-muted-foreground/40" />
      <div className="h-1.5 w-full bg-muted" />
      <div className="h-1.5 w-5/6 bg-muted" />
      <div className="h-1.5 w-4/6 bg-muted" />
    </motion.div>
    <Hand className="absolute -bottom-3 right-2 h-6 w-6 text-primary" />
  </div>
);

const IconRow = ({ icons }: { icons: ReactNode[] }) => (
  <div className="flex justify-center gap-4">
    {icons.map((ic, i) => (
      <span key={i} className="flex h-12 w-12 items-center justify-center rounded-full border bg-card text-primary">{ic}</span>
    ))}
  </div>
);

const STEPS: Step[] = [
  {
    kicker: "Welcome",
    title: "Every opinion. One fair fight.",
    body: (
      <>
        Fuller Feuds is where people argue about real questions and actually hear each other out. Every <strong>topic</strong> is a
        question, and every <strong>opinion</strong> takes a side.
      </>
    ),
    art: <StanceChips />,
  },
  {
    kicker: "1 · Take a side",
    title: "Share your opinion",
    body: (
      <>
        Open any topic and go to <strong>Your Opinion</strong>. Write what you think and pick <strong>For</strong>, <strong>Against</strong> or{" "}
        <strong>Neutral</strong>. Can't find a topic? Search for it, or create it from the search bar.
      </>
    ),
    art: <IconRow icons={[<MessageSquareQuote key="a" className="h-5 w-5" />]} />,
  },
  {
    kicker: "2 · Read the room",
    title: "Swipe through the deck",
    body: (
      <>
        <strong>Other Opinions</strong> is a deck of cards. <strong>Swipe left</strong> or tap <strong>›</strong> for the next card, and swipe
        right or tap ‹ to go back. <strong>Tap a card to flip it</strong> and read it paragraph by paragraph.
      </>
    ),
    art: <DeckArt />,
  },
  {
    kicker: "3 · Push back",
    title: "Counterpoints and debates",
    body: (
      <>
        On a flipped card, tap a paragraph to add a <strong>counterpoint</strong> or like a good one. Want to really have it out? Start a{" "}
        <strong>one-on-one debate</strong> with the author or someone who agreed with them. Your debates live in the bar at the bottom.
      </>
    ),
    art: <IconRow icons={[<RotateCw key="a" className="h-5 w-5" />, <Swords key="b" className="h-5 w-5" />]} />,
  },
  {
    kicker: "4 · Make your name",
    title: "Badges, leaderboards and your @handle",
    body: (
      <>
        Good arguments earn likes, <strong>badges</strong> and a spot on the <strong>leaderboards</strong>. Your profile shows your opinions,
        your badges and your unique <strong>@handle</strong>, so people can find and follow you.
      </>
    ),
    art: <IconRow icons={[<Trophy key="a" className="h-5 w-5" />, <Layers key="b" className="h-5 w-5" />, <AtSign key="c" className="h-5 w-5" />]} />,
  },
];

/**
 * Short, skippable first-run tour. Opens automatically once for a signed-in user whose tutorial isn't done
 * (users.tutorial_completed_at, migration 0009). Finishing or skipping saves completion. Replay any time via openTutorial().
 */
export function FirstRunTutorial({ user, isAuthenticated, suppressed }: { user: any; isAuthenticated: boolean; suppressed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);

  const shouldAuto = isAuthenticated && user?.onboardingComplete === true && !user?.tutorialCompletedAt && !suppressed;
  useEffect(() => {
    if (shouldAuto) {
      setI(0);
      setOpen(true);
    }
  }, [shouldAuto]);

  useEffect(() => {
    const h = () => {
      setI(0);
      setDir(1);
      setOpen(true);
    };
    window.addEventListener(OPEN_TUTORIAL_EVENT, h);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, h);
  }, []);

  const close = useCallback(async () => {
    setOpen(false);
    if (isAuthenticated && !user?.tutorialCompletedAt) {
      try {
        await apiRequest("PUT", "/api/users/me/tutorial", { completed: true });
      } finally {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    }
  }, [isAuthenticated, user?.tutorialCompletedAt]);

  const last = STEPS.length - 1;
  const go = useCallback(
    (d: number) => {
      setDir(d);
      setI((x) => Math.min(last, Math.max(0, x + d)));
    },
    [last],
  );

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  const s = STEPS[i];
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent
        className="max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden border-foreground p-0 sm:max-w-lg"
        data-testid="dialog-tutorial"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b-[3px] border-double border-foreground px-5 py-3">
          <span className="font-display text-lg uppercase leading-none tracking-[0.02em]">
            Fuller<span className="text-primary"> Feuds</span>
          </span>
          <span className="mr-6 font-ui text-xs tabular-nums text-muted-foreground" data-testid="text-tutorial-progress">
            {i + 1} / {STEPS.length}
          </span>
        </div>

        <div className="relative min-h-[23rem] overflow-hidden sm:min-h-[21rem]">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={i}
              custom={dir}
              initial={{ x: dir > 0 ? 80 : -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir > 0 ? -80 : 80, opacity: 0 }}
              transition={{ duration: 0.22 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.5}
              onDragEnd={onDragEnd}
              className="absolute inset-0 flex touch-pan-y cursor-grab select-none flex-col gap-5 px-6 py-6 active:cursor-grabbing"
              data-testid={`tutorial-step-${i + 1}`}
            >
              <div className="flex h-28 items-center justify-center">{s.art}</div>
              <div className="space-y-2">
                <Kicker>{s.kicker}</Kicker>
                <DialogTitle className="font-serif text-2xl font-bold leading-tight sm:text-[1.7rem]">{s.title}</DialogTitle>
                <DialogDescription asChild>
                  <p className="text-[0.95rem] leading-relaxed text-foreground/80">{s.body}</p>
                </DialogDescription>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="font-ui text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
            data-testid="button-tutorial-skip"
          >
            {i === last ? "Close" : "Skip"}
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous" data-testid="button-tutorial-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {i < last ? (
              <Button size="icon" onClick={() => go(1)} aria-label="Next" data-testid="button-tutorial-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={close} data-testid="button-tutorial-done">
                Start exploring
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
