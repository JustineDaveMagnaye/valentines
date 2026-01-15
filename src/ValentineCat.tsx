import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Angry, Cat, Fish, Heart, Info, RefreshCcw, Sparkles, X } from "lucide-react";

/**
 * Self-contained preview version.
 * Replaces shadcn/ui imports with lightweight equivalents so it runs in the canvas preview.
 */

function cn(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(" ");
}

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-slate-200 bg-white shadow-sm",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
}

function Button({
  className,
  variant,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";
  const styles =
    variant === "outline"
      ? "border border-slate-200 bg-white/70 hover:bg-white text-slate-900"
      : variant === "ghost"
      ? "bg-transparent hover:bg-slate-100"
      : "bg-slate-900 text-white hover:bg-slate-800";
  return (
    <button
      className={cn(base, "rounded-2xl px-4 py-3", styles, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({
  className,
  variant,
  children,
}: {
  className?: string;
  variant?: "outline";
  children: React.ReactNode;
}) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold";
  const styles =
    variant === "outline"
      ? "border border-slate-200 bg-white/60 text-slate-700"
      : "bg-slate-100 text-slate-700";
  return <span className={cn(base, styles, className)}>{children}</span>;
}

// 20 escalating emotional beats (0..19)
const beats = [
  "meow? 😺",
  "…meow? 🐾",
  "oh. 😾",
  "that hurt a little 😿",
  "EXCUSE ME?? 😾😾",
  "I WILL DELETE YOUR SYSTEM 32 😡🔥🐱",
  "(jk. please don’t panic) 😼",
  "okay I’m sad now 😿",
  "very sad 😭",
  "dramatically sad 🥀",
  "thinking about life 🧶",
  "bargaining… treats? 🐟",
  "please? 🥺",
  "I forgive you 😽",
  "acceptance achieved 🧘‍♂️🐱",
  "looping emotions…",
  "did you mean yes? 👀",
  "the button is tired 😮‍💨",
  "final warning (playful) 😼",
  "okay fine I still love you 💖",
];

const noLabels = ["No 🙀", "No 😼", "Nope 🐾", "Nah 😾", "NO 😡", "Still no? 🥲"];

type XY = { x: number; y: number };

type FX = {
  id: string;
  t: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
  s: number;
  emoji: string;
  dur: number;
};

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

const moveToward = (from: XY, to: XY, step: number): XY => {
  const d = dist(from, to);
  if (d <= step || d === 0) return to;
  const t = step / d;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
};

function useViewport() {
  // Start with safe defaults for SSR - hydration safe
  const [vp, setVp] = useState({ w: 390, h: 844 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      // Use visualViewport for better mobile support (accounts for keyboard, etc.)
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      setVp({ w, h });
    };
    update();

    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return { ...vp, mounted };
}

function usePointerCoarse() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    const update = () => setCoarse(!!mq?.matches);
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);
  return coarse;
}

function useInterval(ms: number, enabled = true) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
  return tick;
}

export default function ValentineCat() {
  const { w: vpW, h: vpH, mounted } = useViewport();
  const vp = { w: vpW, h: vpH };
  const coarse = usePointerCoarse();
  const reduceMotion = useReducedMotion();
  const tick = useInterval(90);

  // Responsive scaling factor based on viewport
  const isMobile = vpW < 640;
  const isSmall = vpW < 380;
  const scaleFactor = isSmall ? 0.85 : isMobile ? 0.92 : 1;

  const cardRef = useRef<HTMLDivElement | null>(null);

  // Background particles (stable positions)
  const bgRef = useRef(
    Array.from({ length: 14 }).map((_, i) => ({
      id: `${i}-${Math.random().toString(16).slice(2)}`,
      x: rand(0, 1),
      y: rand(0, 1),
      r: rand(-18, 18),
      s: rand(0.85, 1.25),
      emoji: i % 3 === 0 ? "💗" : i % 2 ? "🐾" : "✨",
      dur: rand(7, 12),
    }))
  );

  const [accepted, setAccepted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [noCount, setNoCount] = useState(0);
  const capped = Math.min(noCount, beats.length - 1);

  const [aside, setAside] = useState("");
  useEffect(() => {
    if (!aside) return;
    const t = window.setTimeout(() => setAside(""), 1700);
    return () => window.clearTimeout(t);
  }, [aside]);

  const [freezeUntil, setFreezeUntil] = useState(0);
  const [calmUntil, setCalmUntil] = useState(0);
  const tNow = now();
  const frozen = tNow < freezeUntil;
  const calm = tNow < calmUntil;

  // --- FX
  const [fx, setFx] = useState<FX[]>([]);
  const burst = (emoji: string, at: XY, count = 8, spread = 56, dur = 1.05) => {
    const t = now();
    setFx((arr) => {
      const next = Array.from({ length: count }).map((_, i) => ({
        id: `${t}-${i}-${Math.random().toString(16).slice(2)}`,
        t,
        x: at.x,
        y: at.y,
        dx: rand(-spread, spread),
        dy: rand(-spread, spread) - spread * 0.35,
        r: rand(-45, 45),
        s: rand(0.9, 1.25),
        emoji,
        dur: dur + rand(-0.18, 0.22),
      }));
      return [...arr, ...next].slice(-140);
    });
  };

  useEffect(() => {
    setFx((arr) => arr.filter((p) => tNow - p.t < (p.dur + 0.3) * 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // --- Mode
  const mode = useMemo(() => {
    const scale = clamp(1.04 - noCount * 0.018, 0.82, 1.18);
    const holdMs = clamp(360 + noCount * 28, 360, calm ? 620 : 920);
    const label = noLabels[noCount % noLabels.length];
    // shield chance grows slightly, but capped
    const shieldChance = clamp(0.12 + noCount * 0.007, 0.12, 0.26);
    return { scale, holdMs, label, shieldChance };
  }, [noCount, calm]);

  const btnSize = useMemo(() => ({
    w: Math.round(132 * mode.scale * scaleFactor),
    h: Math.round(56 * mode.scale * scaleFactor)
  }), [mode.scale, scaleFactor]);

  const clampBtn = (x: number, y: number, allowOff = false) => {
    const off = allowOff ? 14 : 0;
    return {
      x: clamp(x, -off, vp.w - btnSize.w + off),
      y: clamp(y, -off, vp.h - btnSize.h + off),
    };
  };

  // --- Floating "No" position
  const [pos, setPos] = useState<XY>({ x: 24, y: 24 });

  const pickNearCard = () => {
    const card = cardRef.current?.getBoundingClientRect?.();
    if (!card) return clampBtn(rand(16, vp.w - btnSize.w - 16), rand(16, vp.h - btnSize.h - 16));
    const spots = [
      { x: card.right - 40, y: card.top + 14 },
      { x: card.left - btnSize.w + 28, y: card.top + rand(10, Math.max(12, card.height - 64)) },
      { x: card.right - 28, y: card.top + rand(10, Math.max(12, card.height - 64)) },
      { x: card.left + rand(10, Math.max(12, card.width - 160)), y: card.top - btnSize.h + 24 },
      { x: card.left + rand(10, Math.max(12, card.width - 160)), y: card.bottom - 26 },
    ];
    const s = spots[Math.floor(rand(0, spots.length))];
    return clampBtn(s.x + rand(-12, 12), s.y + rand(-10, 10), true);
  };

  const moveNo = (reason?: string) => {
    const t = now();
    if (t < freezeUntil) return;
    const next = coarse
      ? pickNearCard()
      : clampBtn(rand(16, vp.w - btnSize.w - 16), rand(16, vp.h - btnSize.h - 16));
    setPos(next);
    setFreezeUntil(t + 850);
    if (reason) setAside(reason);
  };

  useEffect(() => {
    moveNo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h]);

  // loop after final beat
  useEffect(() => {
    if (noCount >= beats.length - 1) {
      const t = window.setTimeout(() => setNoCount(0), 2200);
      return () => window.clearTimeout(t);
    }
  }, [noCount]);

  // --- Shield box + fish lure (responsive)
  const BOX_W = Math.round(136 * scaleFactor);
  const BOX_H = Math.round(96 * scaleFactor);

  const [boxVisible, setBoxVisible] = useState(false);
  const [boxPos, setBoxPos] = useState<XY>({ x: 24, y: 24 });
  const [boxCooldownUntil, setBoxCooldownUntil] = useState(0);

  const clampBox = (x: number, y: number) => {
    const m = 10;
    return { x: clamp(x, m, Math.max(m, vp.w - BOX_W - m)), y: clamp(y, m, Math.max(m, vp.h - BOX_H - m)) };
  };

  const boxCenter = useMemo<XY>(() => ({ x: boxPos.x + BOX_W / 2, y: boxPos.y + BOX_H / 2 }), [boxPos.x, boxPos.y]);

  const [catInBox, setCatInBox] = useState(false);
  const [enteringBox, setEnteringBox] = useState<null | { from: XY; to: XY }>(null);
  const [approaching, setApproaching] = useState(false);
  const [eating, setEating] = useState(false);
  const [eatUntil, setEatUntil] = useState(0);
  const [catChasePos, setCatChasePos] = useState<XY>({ x: 24, y: 24 });

  const [fishVisible, setFishVisible] = useState(false);
  const [fishHeld, setFishHeld] = useState(false);
  const [fishPos, setFishPos] = useState<XY>({ x: vp.w * 0.5, y: vp.h - 110 });
  const [fishEatenP, setFishEatenP] = useState(0);

  const isShieldActive = boxVisible || catInBox || !!enteringBox || approaching || eating;
  const showNo = !catInBox && !enteringBox && !approaching && !eating;

  // Larger lure radius (requested)
  const lureR = coarse ? 210 : 180;
  const fishNearBox = fishVisible && dist(fishPos, boxCenter) <= lureR;

  const spawnFish = (hint = true) => {
    const start = { x: vp.w * 0.5, y: vp.h - 104 };
    setFishVisible(true);
    setFishHeld(false);
    setFishEatenP(0);
    setFishPos(start);
    if (hint) setAside("drag fish near the box 🐟");
    burst("🐟", start, 12, 62, 1.0);
  };

  const scareBackToBox = (msg = "DON’T TOUCH 😾📦") => {
    if (!boxVisible) return;
    setAside(msg);
    burst("💨", boxCenter, 12, 76, 1.05);
    setApproaching(false);
    setEating(false);
    setEatUntil(0);
    setFishEatenP(0);
    setCatInBox(true);
    setFreezeUntil(now() + 520);
  };

  const finishEat = () => {
    setEating(false);
    setFishVisible(false);
    setFishHeld(false);
    setFishEatenP(0);
    setAside("all gone 😼✨");
    burst("✨", fishPos, 16, 92, 1.15);

    // resolve shield
    setCatInBox(false);
    setApproaching(false);
    setEatUntil(0);
    setBoxVisible(false);
    setBoxCooldownUntil(now() + 9000);

    // cat becomes the No button again
    setPos(clampBtn(catChasePos.x, catChasePos.y, true));
    setFreezeUntil(now() + 900);
    window.setTimeout(() => moveNo(), 150);
  };

  // When fish is near the box and cat is inside, it approaches (only after you release the fish)
  useEffect(() => {
    if (!catInBox || !fishVisible || fishHeld || eating || enteringBox) return;
    if (!fishNearBox) return;

    setCatInBox(false);
    setApproaching(true);
    setAside("sniff… 🐟👀");

    // start from box mouth
    setCatChasePos(
      clampBtn(boxPos.x + BOX_W * 0.56 - btnSize.w / 2, boxPos.y + BOX_H * 0.14 - btnSize.h / 2, true)
    );
    burst("👀", { x: boxCenter.x + 18, y: boxCenter.y - 22 }, 8, 50, 0.95);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, fishNearBox, catInBox, fishVisible, fishHeld, eating, enteringBox]);

  // Move toward fish
  useEffect(() => {
    if (!approaching || !fishVisible || eating) return;

    const target = clampBtn(fishPos.x - btnSize.w / 2, fishPos.y - btnSize.h / 2 - 8, true);

    const base = coarse ? 18 : 14;
    const wiggle = reduceMotion ? 0 : Math.sin(tick / 4) * 0.8;
    const step = base + Math.max(0, wiggle);

    setCatChasePos((p) => {
      const next = moveToward(p, target, step);
      const close = dist(next, target) < 13;
      if (close) {
        setApproaching(false);
        setEating(true);
        setFishHeld(false);
        setEatUntil(now() + 1750);
        setAside("munch munch… 😼");
        burst("💗", fishPos, 10, 56, 1.0);
      }
      return next;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, approaching, fishVisible, fishPos.x, fishPos.y, eating, reduceMotion]);

  // Eating progress
  useEffect(() => {
    if (!eating) return;
    const dur = 1750;
    const p = clamp(1 - (eatUntil - tNow) / dur, 0, 1);
    setFishEatenP(p);
    if (tNow >= eatUntil) finishEat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, eating]);

  const fishScale = clamp(1 - fishEatenP, 0, 1);

  const activateShield = () => {
    const t = now();
    if (t < boxCooldownUntil) return;
    if (catInBox || enteringBox || approaching || eating) return;

    // box spawns next to the cat
    const side = Math.random() < 0.5 ? -1 : 1;
    const bp = clampBox(pos.x + side * (BOX_W * 0.86) + rand(-10, 10), pos.y + rand(-8, 24));
    setBoxPos(bp);
    setBoxVisible(true);

    const mouth = clampBtn(bp.x + BOX_W * 0.56 - btnSize.w / 2, bp.y + BOX_H * 0.14 - btnSize.h / 2, true);
    setEnteringBox({ from: pos, to: mouth });

    setAside(Math.random() < 0.5 ? "SHIELD! 📦" : "*hops into the box* 📦");
    burst("💨", { x: bp.x + BOX_W / 2, y: bp.y + BOX_H / 2 }, 14, 82, 1.1);
    setFreezeUntil(t + 600);
    setBoxCooldownUntil(t + 9000);

    // helpful: auto-spawn fish once when shield triggers
    window.setTimeout(() => {
      if (!fishVisible) spawnFish(false);
    }, 220);
  };

  // finish the hop into box
  useEffect(() => {
    if (!enteringBox) return;
    const id = window.setTimeout(() => {
      setEnteringBox(null);
      setCatInBox(true);
      setApproaching(false);
      setEating(false);
      setFishEatenP(0);
      setAside("…inside 📦 (lure me with fish) 🐟");
    }, 520);
    return () => window.clearTimeout(id);
  }, [enteringBox]);

  // --- Hold-to-confirm "No"
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const [holding, setHolding] = useState(false);
  const [holdP, setHoldP] = useState(0);

  const stopHold = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = 0;
    setHolding(false);
    setHoldP(0);
  };

  const confirmNo = () => {
    stopHold();
    burst("🐾", { x: pos.x + btnSize.w / 2, y: pos.y + btnSize.h / 2 }, 10, 70, 1.05);

    setNoCount((n) => Math.min(n + 1, beats.length - 1));

    const ready = tNow > boxCooldownUntil;
    if (noCount >= 2 && ready && Math.random() < mode.shieldChance) {
      activateShield();
      return;
    }

    setAside(Math.random() < 0.25 ? "hiss… 🐾" : "noted 😾");
    window.setTimeout(() => moveNo(), 70);
  };

  const beginHold = (e: any) => {
    if (holding || frozen || !showNo) return;
    setHolding(true);
    startRef.current = now();
    try {
      e?.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch {}

    const loop = () => {
      const p = clamp((now() - startRef.current) / mode.holdMs, 0, 1);
      setHoldP(p);
      if (p >= 1) return confirmNo();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const endHold = () => {
    if (holdP > 0 && holdP < 1) {
      if (holdP >= 0.75) setAside("SO CLOSE 😼 (just a bit longer)");
      else if (holdP >= 0.35) setAside("mmm… keep holding 😾");
      else if (!frozen && !calm && noCount >= 3) moveNo("*skitters away* 🐾");
    }
    stopHold();
  };

  // --- Reset + Treat
  const resetAll = () => {
    stopHold();
    setAccepted(false);
    setShowHelp(false);
    setNoCount(0);
    setAside("");
    setFreezeUntil(0);
    setCalmUntil(0);

    setBoxVisible(false);
    setCatInBox(false);
    setEnteringBox(null);
    setBoxCooldownUntil(0);

    setApproaching(false);
    setEating(false);
    setEatUntil(0);
    setCatChasePos({ x: 24, y: 24 });

    setFishVisible(false);
    setFishHeld(false);
    setFishEatenP(0);

    setFx([]);
    window.setTimeout(() => moveNo(), 0);
  };

  const giveTreat = () => {
    setCalmUntil(now() + 5000);
    setAside("treat accepted 😽 (calm mode)");
    stopHold();
    burst("💗", { x: vp.w * 0.5, y: vp.h * 0.35 }, 14, 92, 1.2);
    if (isShieldActive && !fishVisible) spawnFish(false);
  };

  const moodBadge = (() => {
    if (noCount < 3) return { t: "Sweet", cls: "bg-pink-100 text-pink-700" };
    if (noCount < 5) return { t: "Sassy", cls: "bg-rose-100 text-rose-700" };
    if (noCount === 5) return { t: "RAGE", cls: "bg-red-100 text-red-700" };
    if (noCount < 10) return { t: "Sad", cls: "bg-indigo-50 text-indigo-700" };
    if (noCount < 15) return { t: "Bargaining", cls: "bg-amber-50 text-amber-700" };
    return { t: "Looping", cls: "bg-slate-100 text-slate-700" };
  })();

  const hudLine = (() => {
    if (catInBox) return "Shielded: drag fish near the box";
    if (approaching) return "Approaching… don’t touch 😾";
    if (eating) return "Eating… don’t touch 😾";
    if (holding) return `Hold: ${Math.round(holdP * 100)}%`;
    return "Tip: press & hold the No button";
  })();

  // --- Accepted screen (responsive)
  if (accepted) {
    return (
      <div
        className="min-h-[100dvh] bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center p-4 sm:p-6"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 16px), 16px)",
          paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          paddingLeft: "max(env(safe-area-inset-left, 16px), 16px)",
          paddingRight: "max(env(safe-area-inset-right, 16px), 16px)",
        }}
      >
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {mounted && Array.from({ length: isMobile ? 16 : 24 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-xl sm:text-2xl opacity-40"
              initial={{ x: rand(0, vp.w), y: -20, rotate: rand(-30, 30) }}
              animate={{ y: vp.h + 30, rotate: rand(-80, 80) }}
              transition={{ duration: rand(3.6, 5.2), repeat: Infinity, ease: "linear", delay: rand(0, 1.3) }}
            >
              💖
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md mx-auto">
          <Card className="rounded-2xl sm:rounded-3xl shadow-lg bg-white/85 backdrop-blur border border-white/60">
            <CardContent className="p-6 sm:p-10 text-center">
              <Cat className="h-14 w-14 sm:h-20 sm:w-20 mx-auto text-pink-500" />
              <h1 className="text-2xl sm:text-4xl font-bold mt-3 sm:mt-4">YAYYYYY 💖</h1>
              <p className="mt-2 sm:mt-3 text-base sm:text-lg">You are now officially my Valentine 😽💘</p>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-500">The cat is pleased. The cat is loved.</p>
              <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2">
                <Button variant="outline" onClick={resetAll} className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-3 touch-manipulation">
                  <RefreshCcw className="h-3 w-3 sm:h-4 sm:w-4" /> play again
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Hold ring style
  const ringStyle = {
    background: `conic-gradient(rgba(244,63,94,0.95) ${Math.round(holdP * 360)}deg, rgba(148,163,184,0.25) 0deg)`,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-br from-pink-50 via-rose-50 to-rose-100 p-2 sm:p-4 md:p-6 overflow-x-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Background ambience */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {bgRef.current.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-xl opacity-20"
            initial={{ x: p.x * vp.w, y: p.y * vp.h, rotate: p.r, scale: p.s }}
            animate={reduceMotion ? {} : { y: [p.y * vp.h, p.y * vp.h + rand(-80, 80)] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut" }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </div>

      {/* FX */}
      <div className="pointer-events-none fixed inset-0 z-[85]">
        {fx.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-2xl"
            initial={{ x: p.x, y: p.y, opacity: 0.95, rotate: p.r, scale: 0.8 }}
            animate={{ x: p.x + p.dx, y: p.y + p.dy, opacity: 0, rotate: p.r + rand(-90, 90), scale: p.s }}
            transition={{ duration: p.dur, ease: "easeOut" }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </div>

      {/* HUD - responsive for all screen sizes */}
      <div
        className="fixed left-0 right-0 top-0 z-[90] px-2 sm:px-4 pt-2 sm:pt-4"
        style={{ paddingTop: "max(env(safe-area-inset-top, 8px), 8px)" }}
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-start justify-between gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={resetAll}
                className="rounded-full bg-white/70 backdrop-blur border-white/60 shadow-sm text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3"
                aria-label="Reset"
              >
                <RefreshCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline sm:inline">reset</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowHelp(true)}
                className="rounded-full bg-white/70 backdrop-blur border-white/60 shadow-sm text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3"
                aria-label="How to play"
              >
                <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline sm:inline">help</span>
              </Button>
            </div>

            <div className="rounded-xl sm:rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm px-2 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-1 max-w-[180px] sm:max-w-[190px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] text-slate-600">status</span>
                <motion.div
                  animate={reduceMotion ? {} : { rotate: isShieldActive ? [0, 12, -12, 0] : 0 }}
                  transition={{ duration: 1.2, repeat: isShieldActive ? Infinity : 0, ease: "easeInOut" }}
                >
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-rose-500" />
                </motion.div>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-slate-700 truncate">
                <span className="font-semibold">{moodBadge.t}</span>
                <span className="text-slate-500"> • No {noCount}/20</span>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-slate-600 truncate">{hudLine}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Help modal - responsive */}
      <AnimatePresence>
        {showHelp && (
          <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowHelp(false)} />
            <motion.div
              className="absolute left-1/2 top-1/2 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto"
              initial={{ y: 18, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              role="dialog"
              aria-modal="true"
            >
              <Card className="rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-xl">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div>
                      <div className="text-base sm:text-lg font-semibold">How to play</div>
                      <div className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-600">A tiny game of patience. The cat is dramatic.</div>
                    </div>
                    <Button variant="outline" className="rounded-full px-2 sm:px-3 py-1.5 sm:py-2 touch-manipulation flex-shrink-0" onClick={() => setShowHelp(false)} aria-label="Close help">
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 sm:mt-4 grid gap-2 sm:gap-3 text-xs sm:text-sm text-slate-700">
                    <div className="rounded-xl sm:rounded-2xl bg-rose-50/70 border border-rose-100 p-2 sm:p-3">
                      <div className="font-semibold text-sm sm:text-base">Saying "No"</div>
                      <div className="mt-0.5 sm:mt-1">
                        Find the floating <span className="font-semibold">No</span> and <span className="font-semibold">press & hold</span> until it fills.
                      </div>
                    </div>
                    <div className="rounded-xl sm:rounded-2xl bg-amber-50/70 border border-amber-100 p-2 sm:p-3">
                      <div className="font-semibold text-sm sm:text-base">Shield box 📦</div>
                      <div className="mt-0.5 sm:mt-1">After a successful No, the cat may summon a box and hide inside.</div>
                    </div>
                    <div className="rounded-xl sm:rounded-2xl bg-indigo-50/70 border border-indigo-100 p-2 sm:p-3">
                      <div className="font-semibold text-sm sm:text-base">Lure with fish 🐟</div>
                      <div className="mt-0.5 sm:mt-1">
                        Spawn a fish, then <span className="font-semibold">drag it near the box</span>. The cat will approach and eat it.
                      </div>
                      <div className="mt-0.5 sm:mt-1">If you tap the cat while it's approaching/eating, it panics and dives back.</div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-5 flex items-center justify-end gap-2">
                    <Button variant="outline" className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 touch-manipulation" onClick={() => setShowHelp(false)}>
                      got it
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card - responsive for all screen sizes */}
      <div className="min-h-[calc(100dvh-2rem)] flex items-center justify-center pt-16 sm:pt-20 pb-4">
        <Card
          ref={cardRef}
          className="relative z-30 rounded-2xl sm:rounded-3xl shadow-lg bg-white/80 backdrop-blur-xl border border-white/60 max-w-md w-full mx-2 sm:mx-4"
        >
          <CardContent className="p-4 sm:p-6 md:p-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <Badge className={cn(moodBadge.cls, "text-[10px] sm:text-[11px]")}>{moodBadge.t}</Badge>
              <Badge variant="outline" className="text-[10px] sm:text-[11px]">No: {noCount}/20</Badge>
              {calm && <Badge className="bg-emerald-50 text-emerald-700 text-[10px] sm:text-[11px]">Calm 😽</Badge>}
              {isShieldActive && <Badge className="bg-amber-50 text-amber-700 text-[10px] sm:text-[11px]">Shield 📦</Badge>}
              {fishVisible && (
                <Badge className={cn(fishNearBox ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700", "text-[10px] sm:text-[11px]")}>
                  {fishNearBox ? "Lure!" : "Fish"}
                </Badge>
              )}
            </div>

            <motion.button
              type="button"
              className="mt-3 sm:mt-4 mx-auto block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 touch-manipulation"
              onClick={() => {
                // any touch while approaching/eating scares it back into the box
                if (approaching || eating) {
                  scareBackToBox("no pets while I eat 😾📦");
                  return;
                }
                if (catInBox) {
                  setAside("…mrrp (i'm in the box) 📦");
                  burst("📦", { x: boxCenter.x, y: boxCenter.y }, 8, 56, 1.0);
                  return;
                }
                setCalmUntil((c) => Math.max(c, now() + 1800));
                setAside(Math.random() < 0.5 ? "purr… 😽" : "*headbutt* 💗");
                burst("💗", { x: vp.w * 0.5, y: vp.h * 0.35 }, 10, 64, 1.05);
              }}
              animate={reduceMotion ? {} : { rotate: noCount >= 5 ? [0, -6, 6, -6, 0] : 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              aria-label="Pet the cat"
              title="Pet the cat"
            >
              {noCount < 5 ? (
                <Cat className="h-14 w-14 sm:h-20 sm:w-20 mx-auto text-pink-400" />
              ) : (
                <Angry className="h-14 w-14 sm:h-20 sm:w-20 mx-auto text-red-500" />
              )}
            </motion.button>

            <h1 className="text-2xl sm:text-3xl font-bold mt-2 sm:mt-3">Will you be my Valentine?</h1>

            <AnimatePresence mode="wait">
              <motion.p
                key={noCount}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn("mt-2 sm:mt-3 text-base sm:text-lg", noCount === 5 && "text-red-600 font-bold")}
              >
                {beats[capped]}
              </motion.p>
            </AnimatePresence>

            {noCount === 5 && <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-red-500">(joke) the cat cannot access your computer.</p>}

            <AnimatePresence>
              {aside && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-slate-600"
                  aria-live="polite"
                >
                  {aside}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-4 sm:mt-6 grid gap-2 sm:gap-3">
              <Button
                onClick={() => {
                  burst("💖", { x: vp.w * 0.5, y: vp.h * 0.35 }, 16, 92, 1.2);
                  setAccepted(true);
                }}
                className="bg-pink-500 hover:bg-pink-600 text-white w-full sm:w-auto sm:mx-auto rounded-xl sm:rounded-2xl text-sm sm:text-base py-2.5 sm:py-3 touch-manipulation"
              >
                <Heart className="h-4 w-4" /> Yes 💖
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <Button variant="outline" onClick={giveTreat} disabled={calm} className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-3 touch-manipulation">
                  <Fish className="h-3 w-3 sm:h-4 sm:w-4" /> give treat
                </Button>
                <span className="text-[10px] sm:text-xs text-slate-500">(calms it for 5s)</span>
              </div>

              {(isShieldActive || noCount >= 2) && (
                <div className="rounded-xl sm:rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm px-2 sm:px-3 py-2 sm:py-3">
                  {!fishVisible ? (
                    <Button onClick={() => spawnFish(true)} className="bg-amber-500 hover:bg-amber-600 text-white w-full rounded-xl sm:rounded-2xl text-xs sm:text-sm py-2 sm:py-3 touch-manipulation">
                      <Fish className="h-3 w-3 sm:h-4 sm:w-4" /> spawn fish
                    </Button>
                  ) : (
                    <p className="text-[10px] sm:text-xs text-slate-600">
                      Drag the fish near the box. If the cat comes out, don't tap it—touching scares it back.
                    </p>
                  )}
                </div>
              )}

              <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500 px-2">
                To say <span className="font-semibold">No</span>, press & hold the floating button. ({Math.round(mode.holdMs / 100) / 10}s)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FLOATING NO BUTTON - responsive */}
      <AnimatePresence>
        {showNo && mounted && (
          <motion.div
            className="fixed left-0 top-0 z-[25]"
            style={{ x: pos.x, y: pos.y }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <motion.button
              type="button"
              className="relative select-none rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-lg bg-white/80 backdrop-blur border border-white/60 touch-manipulation"
              style={{ minWidth: btnSize.w, minHeight: btnSize.h }}
              onPointerDown={beginHold}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onPointerLeave={() => (coarse ? undefined : endHold())}
              disabled={frozen}
              aria-label="No button"
              title="Press & hold"
              animate={reduceMotion || holding ? {} : { y: [0, -2, 0] }}
              transition={{ duration: 1.1, repeat: reduceMotion || holding ? 0 : Infinity, ease: "easeInOut" }}
            >
              {/* ring */}
              <div className="absolute -inset-[5px] sm:-inset-[6px] rounded-[18px] sm:rounded-[22px] p-[2px]" style={ringStyle} aria-hidden="true">
                <div className="h-full w-full rounded-[16px] sm:rounded-[20px] bg-white/75" />
              </div>

              <div className="relative flex items-center gap-1.5 sm:gap-2">
                <div className="text-xs sm:text-sm font-semibold text-slate-800">{mode.label}</div>
                <span className="text-[10px] sm:text-[11px] text-slate-500">hold</span>
              </div>
              <div className="relative mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-slate-600">{holding ? `${Math.round(holdP * 100)}%` : "tap & hold"}</div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ENTERING BOX (jump animation) - responsive */}
      <AnimatePresence>
        {enteringBox && mounted && (
          <motion.div
            className="fixed left-0 top-0 z-[75]"
            initial={{ x: enteringBox.from.x, y: enteringBox.from.y, opacity: 1, scale: 1 }}
            animate={{ x: enteringBox.to.x, y: enteringBox.to.y, opacity: 1, scale: 0.86 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            <div className="rounded-xl sm:rounded-2xl bg-white/80 backdrop-blur border border-white/60 shadow-lg px-3 sm:px-4 py-2 sm:py-3">
              <div className="text-xs sm:text-sm font-semibold text-slate-800">*hop* 📦</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHASING / EATING CAT (touch scares it back) - responsive */}
      <AnimatePresence>
        {(approaching || eating) && mounted && (
          <motion.div
            className="fixed left-0 top-0 z-[75]"
            style={{ x: catChasePos.x, y: catChasePos.y }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <motion.button
              type="button"
              className="rounded-xl sm:rounded-2xl bg-white/80 backdrop-blur border border-white/60 shadow-lg px-3 sm:px-4 py-2 sm:py-3 touch-manipulation"
              onPointerDown={() => scareBackToBox(eating ? "HEY 😾📦 (let me eat!)" : "DON'T 😾📦")}
              aria-label="Cat"
              title="Don't touch while it eats"
              animate={reduceMotion ? {} : eating ? { rotate: [0, -2, 2, 0] } : { y: [0, -1.5, 0] }}
              transition={{ duration: 0.9, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-800">{eating ? "munch…" : "sniff…"}</span>
                <span className="text-[10px] sm:text-xs text-slate-500">😼</span>
              </div>
              {eating && (
                <div className="mt-1.5 sm:mt-2 h-1.5 sm:h-2 w-[100px] sm:w-[132px] rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-rose-400"
                    animate={{ width: `${Math.round(fishEatenP * 100)}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DRAG FISH - responsive */}
      <AnimatePresence>
        {fishVisible && mounted && (
          <motion.div
            className="fixed left-0 top-0 z-[80]"
            style={{ x: fishPos.x, y: fishPos.y }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <motion.button
                type="button"
                className={cn(
                  "relative select-none touch-manipulation",
                  "rounded-2xl sm:rounded-3xl border border-white/60 bg-white/80 backdrop-blur shadow-lg",
                  "px-3 sm:px-4 py-2 sm:py-3",
                  eating ? "cursor-not-allowed opacity-70" : "cursor-grab active:cursor-grabbing"
                )}
                aria-label="Drag the fish"
                onPointerDown={(e) => {
                  if (eating) return;
                  e.preventDefault();
                  setFishHeld(true);
                  try {
                    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                  } catch {}
                  setFishPos({ x: e.clientX, y: e.clientY });
                }}
                onPointerMove={(e) => {
                  if (!fishHeld || eating) return;
                  setFishPos({ x: e.clientX, y: e.clientY });
                }}
                onPointerUp={() => setFishHeld(false)}
                onPointerCancel={() => setFishHeld(false)}
                title={eating ? "Eating…" : "Drag me near the box"}
                animate={reduceMotion || eating ? {} : { y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: reduceMotion || eating ? 0 : Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  className="text-3xl sm:text-4xl"
                  animate={eating ? { scale: fishScale } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                >
                  🐟
                </motion.div>

                <div className="mt-0.5 sm:mt-1 flex items-center justify-between gap-1.5 sm:gap-2">
                  <div className="text-[10px] sm:text-[11px] text-slate-600">fish</div>
                  <div className={cn("text-[10px] sm:text-[11px]", fishNearBox ? "text-emerald-700" : "text-slate-500")}>
                    {fishNearBox ? "near box" : "drag"}
                  </div>
                </div>

                <AnimatePresence>
                  {eating && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mt-1.5 sm:mt-2 h-1.5 sm:h-2 w-full rounded-full bg-slate-200 overflow-hidden"
                    >
                      <motion.div
                        className="h-full rounded-full bg-rose-400"
                        animate={{ width: `${Math.round(fishEatenP * 100)}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              <AnimatePresence>
                {fishNearBox && !eating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-1.5 sm:mt-2 text-center"
                  >
                    <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px]">
                      <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> lure active
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHIELD BOX — responsive + keep face + wobble vibe */}
      <AnimatePresence>
        {boxVisible && mounted && (
          <motion.div
            className="fixed left-0 top-0 z-[60]"
            style={{ x: boxPos.x, y: boxPos.y, width: BOX_W, height: BOX_H }}
            initial={{ opacity: 0, scale: 0.88, rotate: rand(-2, 2) }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: boxPos.y + 10 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            <div
              className="relative w-full h-full touch-manipulation"
              onPointerDown={(e) => {
                e.preventDefault();
                if (approaching || eating) return;
                burst("📦", boxCenter, 6, 44, 0.95);
                setAside(catInBox ? "…inside 📦" : "box appears… 👀");
              }}
              role="button"
              tabIndex={0}
              aria-label="Shield box"
            >
              {/* Lure radius ring */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ width: lureR * 2, height: lureR * 2 }}
                animate={reduceMotion ? {} : { scale: fishNearBox ? [1, 1.02, 1] : [1, 1.01, 1] }}
                transition={{ duration: 1.2, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
              >
                <div
                  className={cn(
                    "absolute inset-0 rounded-full",
                    fishNearBox ? "border-2 border-emerald-300/60" : "border border-amber-300/35"
                  )}
                  style={{
                    boxShadow: fishNearBox ? "0 0 0 10px rgba(16,185,129,0.12)" : "0 0 0 10px rgba(245,158,11,0.10)",
                  }}
                />
              </motion.div>

              {/* glow */}
              <motion.div
                className="absolute -inset-1.5 sm:-inset-2 rounded-[20px] sm:rounded-[24px] blur-xl"
                animate={
                  reduceMotion
                    ? { opacity: fishNearBox ? 0.6 : catInBox ? 0.45 : 0.18 }
                    : catInBox
                    ? { opacity: [0.3, 0.6, 0.3] }
                    : fishNearBox
                    ? { opacity: [0.35, 0.7, 0.35] }
                    : { opacity: 0.18 }
                }
                transition={{ duration: 1.25, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
              >
                <div className={cn("absolute inset-0 rounded-[20px] sm:rounded-[24px]", fishNearBox ? "bg-emerald-300/30" : "bg-amber-300/20")} />
              </motion.div>

              {/* box body */}
              <motion.div
                className="absolute inset-0 rounded-2xl sm:rounded-3xl border border-white/60 bg-white/75 backdrop-blur shadow-lg"
                animate={reduceMotion ? {} : { rotate: fishNearBox ? [0, 0.6, -0.6, 0] : [0, 0.35, -0.35, 0] }}
                transition={{ duration: 1.1, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
              />

              {/* face */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full px-2 sm:px-3">
                  <div className="mx-auto w-full rounded-xl sm:rounded-2xl bg-amber-50/70 border border-amber-100 p-1.5 sm:p-2">
                    <div className="flex items-center justify-center gap-3 sm:gap-4">
                      <span className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-slate-700" />
                      <span className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-slate-700" />
                    </div>
                    <div className="mt-1 sm:mt-2 flex items-center justify-center">
                      <span className="text-[10px] sm:text-[12px] text-slate-700">{catInBox ? "mrrp…" : "peek…"}</span>
                    </div>
                    <div className="mt-0.5 sm:mt-1 text-center text-[9px] sm:text-[10px] text-slate-500">
                      {fishNearBox ? "lure active" : "drag fish nearby"}
                    </div>
                  </div>
                </div>
              </div>

              {/* tiny cat icon */}
              <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 rounded-full bg-white/80 border border-white/60 shadow px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px]">
                {catInBox ? "😼📦" : "📦"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
