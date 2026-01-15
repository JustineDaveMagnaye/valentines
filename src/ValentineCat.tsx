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

// Cat behavior states - makes the game more dynamic and unpredictable
type CatBehavior = "normal" | "zoomies" | "napping" | "grooming" | "hunting" | "knocking" | "gifting" | "loaf" | "catnip" | "stretching" | "yawning" | "scratching" | "judging";

const catBehaviorMessages: Record<CatBehavior, string[]> = {
  normal: ["meow", "mrrp", "*stares*", "*blinks slowly*", "prrt?", "*ear twitch*", "*tail swish*"],
  zoomies: ["ZOOM!! 💨", "*NYOOM*", "GOTTA GO FAST", "*chaos mode*", "WHEEEEE", "CAN'T STOP WON'T STOP", "*parkour*", "3AM ENERGY"],
  napping: ["zzz… 💤", "*snore*", "5 more minutes…", "*dreaming of fish*", "so sleepy…", "*twitches whiskers*", "don't wake me…"],
  grooming: ["*lick lick*", "*cleaning paws*", "must stay pretty", "*wash wash*", "gotta look good 💅", "*fixes fur*"],
  hunting: ["*wiggles butt*", "TARGET ACQUIRED", "*stalking*", "*pounce mode*", "👀", "*intense focus*", "don't move…"],
  knocking: ["*pushes thing*", "oops 😼", "*CRASH*", "gravity test!", "it had to go", "science experiment!", "*innocent look*"],
  gifting: ["I brought you something! 🎁", "*proud*", "look what I found!", "for you! 💝", "accept my offering!", "you're welcome 😼"],
  loaf: ["*becomes loaf* 🍞", "loaf mode activated", "*tucks paws*", "am bread now", "maximum cozy", "no thoughts only loaf"],
  catnip: ["WHEEEE 🌿", "*rolls around*", "*pure bliss*", "THIS IS AMAZING", "*zooms AND purrs*", "EVERYTHING IS BEAUTIFUL", "*vibrating*"],
  stretching: ["*biiiiig stretch* 🐱", "*yoga pose*", "ah, that's better", "*extends beans*", "streeeetch~", "*elongates*"],
  yawning: ["*yaaaawn* 😴", "*shows teefies*", "sleepy boi hours", "*big yawn*", "am tired", "*dramatic yawn*"],
  scratching: ["*scratch scratch* 💅", "*sharpens claws*", "must maintain weapons", "*kneads aggressively*", "scrtch scrtch"],
  judging: ["*judges silently* 😐", "*disappointed look*", "really?", "*stares judgmentally*", "I expected better", "*visible disapproval*"],
};

// More varied reactions for different situations
const petReactions = ["purr… 😽", "*headbutt* 💗", "*kneads happily*", "mrrrrow~ 💕", "*happy chirp*", "*slow blink* 💗"];
const annoyedReactions = ["hiss… 😾", "*swats paw*", "excuse me?!", "*flattens ears*", "*tail puff*", "how DARE"];
const curiousReactions = ["*head tilt*", "mrrp? 👀", "*sniff sniff*", "what's this?", "*perks ears*", "interesting…"];
const playfulReactions = ["*pounce!* 🐾", "*wiggles*", "play with me!", "*chatters*", "*bunny kicks*", "gotcha!"];

// Cat gifts the cat can bring you
const catGifts = ["🐭", "🪶", "🧦", "🎀", "🍂", "🦗", "🪲", "💝", "🌸", "⭐"];

// Yarn colors for the yarn ball
const yarnColors = ["#f472b6", "#fb923c", "#a78bfa", "#34d399", "#60a5fa", "#f87171"];

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
      // Fallback chain for maximum browser compatibility
      const w = window.visualViewport?.width ?? window.innerWidth ?? document.documentElement.clientWidth ?? 390;
      const h = window.visualViewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight ?? 844;
      setVp({ w, h });
    };
    update();

    // Multiple event listeners for cross-browser compatibility
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    // Delayed update for Safari orientation change quirks
    const handleOrientation = () => {
      setTimeout(update, 100);
      setTimeout(update, 300);
    };
    window.addEventListener("orientationchange", handleOrientation);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("orientationchange", handleOrientation);
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

  // Responsive scaling factor based on viewport - supports all device sizes
  // Small phones: < 360px (iPhone SE, Galaxy S series mini)
  // Medium phones: 360-414px (most Android phones, iPhone 6-8)
  // Large phones: 414-640px (iPhone Plus/Max, large Android)
  // Tablets: 640-1024px (iPad Mini, small tablets)
  // Large tablets: 1024-1280px (iPad Pro, Android tablets)
  // Desktop: > 1280px
  const isVerySmall = vpW < 320; // Very small phones
  const isSmall = vpW < 380;     // Small phones
  const isMobile = vpW < 640;    // Mobile phones
  const isTablet = vpW >= 640 && vpW < 1024; // Tablets
  const isLargeTablet = vpW >= 1024 && vpW < 1280; // Large tablets/iPad Pro
  const isDesktop = vpW >= 1280; // Desktop

  // Also consider height for landscape orientation
  const isLandscape = vpW > vpH;
  const isShortScreen = vpH < 600;

  // Scale factor for different device sizes
  const scaleFactor = isVerySmall ? 0.75 : isSmall ? 0.85 : isMobile ? 0.92 : isTablet ? 1 : 1;

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

  // --- Mode (BALANCED for playability) - moved before yarn chase effect
  const mode = useMemo(() => {
    const scale = clamp(1.08 - noCount * 0.012, 0.92, 1.15);
    const holdMs = clamp(300 + noCount * 20, 300, calm ? 500 : 700);
    const label = noLabels[noCount % noLabels.length];
    const shieldChance = clamp(0.08 + noCount * 0.005, 0.08, 0.18);
    return { scale, holdMs, label, shieldChance };
  }, [noCount, calm]);

  // Button size - made bigger for easier tapping
  const btnSize = useMemo(() => ({
    w: Math.round(150 * mode.scale * scaleFactor),
    h: Math.round(64 * mode.scale * scaleFactor)
  }), [mode.scale, scaleFactor]);

  // --- CAT BEHAVIOR SYSTEM ---
  const [catBehavior, setCatBehavior] = useState<CatBehavior>("normal");
  const [behaviorUntil, setBehaviorUntil] = useState(0);
  const [lastInteraction, setLastInteraction] = useState(now());

  // Laser pointer state
  const [laserActive, setLaserActive] = useState(false);
  const [laserPos, setLaserPos] = useState<XY>({ x: 0, y: 0 });
  const [catChasingLaser, setCatChasingLaser] = useState(false);

  // Yarn ball state
  const [yarnActive, setYarnActive] = useState(false);
  const [yarnPos, setYarnPos] = useState<XY>({ x: 100, y: 100 });
  const [yarnColor, setYarnColor] = useState(yarnColors[0]);
  const [catChasingYarn, setCatChasingYarn] = useState(false);

  // Catnip state
  const [catnipUntil, setCatnipUntil] = useState(0);

  // Cat gifts
  const [currentGift, setCurrentGift] = useState<string | null>(null);
  const [giftPos, setGiftPos] = useState<XY>({ x: 0, y: 0 });

  // Paw prints trail
  const [pawPrints, setPawPrints] = useState<Array<{ id: string; x: number; y: number; r: number; t: number }>>([]);

  // Knocked items
  const [knockedItems, setKnockedItems] = useState<Array<{ id: string; emoji: string; x: number; y: number; t: number }>>([]);

  // Check if behavior is active
  const isBehaviorActive = tNow < behaviorUntil;
  const isCatnipActive = tNow < catnipUntil;

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

  // --- BEHAVIOR HELPERS ---
  const triggerBehavior = (behavior: CatBehavior, durationMs: number) => {
    setCatBehavior(behavior);
    setBehaviorUntil(now() + durationMs);
    const msg = catBehaviorMessages[behavior][Math.floor(rand(0, catBehaviorMessages[behavior].length))];
    setAside(msg);
  };

  const addPawPrint = (x: number, y: number) => {
    setPawPrints((prev) => [
      ...prev.slice(-20),
      { id: `paw-${now()}-${Math.random()}`, x, y, r: rand(-30, 30), t: now() }
    ]);
  };

  const knockSomethingOff = () => {
    const items = ["📱", "🖊️", "☕", "🥛", "📚", "🎮", "💄", "🔑", "🪴", "🧸"];
    const emoji = items[Math.floor(rand(0, items.length))];
    setKnockedItems((prev) => [
      ...prev.slice(-5),
      { id: `knock-${now()}`, emoji, x: rand(50, vp.w - 50), y: rand(100, vp.h * 0.4), t: now() }
    ]);
    burst(emoji, { x: vp.w * 0.5, y: vp.h * 0.3 }, 6, 80, 1.5);
  };

  const bringGift = () => {
    const gift = catGifts[Math.floor(rand(0, catGifts.length))];
    setCurrentGift(gift);
    setGiftPos({ x: pos.x + btnSize.w / 2, y: pos.y + btnSize.h / 2 });
    triggerBehavior("gifting", 3000);
    burst(gift, { x: pos.x + btnSize.w / 2, y: pos.y }, 8, 60, 1.2);
  };

  // Random behavior trigger (when idle)
  useEffect(() => {
    if (accepted || catInBox || approaching || eating || catChasingLaser || catChasingYarn) return;
    if (isBehaviorActive) return;

    const timeSinceInteraction = tNow - lastInteraction;

    // After 8 seconds of no interaction, cat might do something
    if (timeSinceInteraction > 8000 && Math.random() < 0.02) {
      const behaviors: CatBehavior[] = ["zoomies", "napping", "grooming", "knocking", "loaf", "stretching", "yawning", "scratching", "judging"];
      const randomBehavior = behaviors[Math.floor(rand(0, behaviors.length))];

      if (randomBehavior === "knocking") {
        knockSomethingOff();
      }

      triggerBehavior(randomBehavior, rand(3000, 6000));

      // Zoomies makes the cat move erratically
      if (randomBehavior === "zoomies") {
        const zoomInterval = setInterval(() => {
          if (now() > behaviorUntil) {
            clearInterval(zoomInterval);
            return;
          }
          const newPos = clampBtn(rand(20, vp.w - 60), rand(80, vp.h - 100));
          setPos(newPos);
          addPawPrint(newPos.x + btnSize.w / 2, newPos.y + btnSize.h / 2);
          burst("💨", newPos, 4, 30, 0.6);
        }, 400);
      }

      // Stretching shows stretch emoji
      if (randomBehavior === "stretching") {
        burst("🙆", { x: pos.x + btnSize.w / 2, y: pos.y }, 3, 40, 1);
      }

      // Yawning shows sleepy effects
      if (randomBehavior === "yawning") {
        burst("💤", { x: pos.x + btnSize.w / 2, y: pos.y - 20 }, 4, 30, 1.5);
      }

      // Scratching leaves marks
      if (randomBehavior === "scratching") {
        burst("✨", { x: pos.x + btnSize.w / 2, y: pos.y + btnSize.h / 2 }, 5, 25, 0.8);
      }

      // Judging stares at you intensely
      if (randomBehavior === "judging") {
        burst("👁️", { x: pos.x + btnSize.w / 2, y: pos.y }, 2, 20, 1.2);
      }
    }

    // Small chance to bring a gift
    if (timeSinceInteraction > 12000 && Math.random() < 0.008 && !currentGift) {
      bringGift();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Clean up paw prints and knocked items
  useEffect(() => {
    setPawPrints((prev) => prev.filter((p) => tNow - p.t < 4000));
    setKnockedItems((prev) => prev.filter((p) => tNow - p.t < 3000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Clear gift after some time
  useEffect(() => {
    if (currentGift) {
      const t = setTimeout(() => setCurrentGift(null), 5000);
      return () => clearTimeout(t);
    }
  }, [currentGift]);

  // --- LASER POINTER LOGIC ---
  const activateLaser = () => {
    setLaserActive(true);
    setLaserPos({ x: vp.w * 0.5, y: vp.h * 0.5 });
    setAside("🔴 Move the laser! Cat can't resist!");
    setCatChasingLaser(true);
    setLastInteraction(now());
  };

  // Cat chases laser
  useEffect(() => {
    if (!laserActive || !catChasingLaser) return;

    const target = clampBtn(laserPos.x - btnSize.w / 2, laserPos.y - btnSize.h / 2);
    const speed = isCatnipActive ? 28 : 18;

    setPos((p) => {
      const next = moveToward(p, target, speed);
      if (dist(next, target) < 20) {
        burst("✨", laserPos, 6, 40, 0.8);
        const laserReactions = ["*pounce!* 🐾", "almost got it! 😼", "WHERE'D IT GO?!", "*confused chirp*", "MUST. CATCH. DOT.", "*intense stare*"];
        setAside(laserReactions[Math.floor(rand(0, laserReactions.length))]);
      }
      // Add paw prints occasionally
      if (Math.random() < 0.12) {
        addPawPrint(next.x + btnSize.w / 2, next.y + btnSize.h / 2);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, laserActive, catChasingLaser, laserPos.x, laserPos.y]);

  // --- YARN BALL LOGIC (simplified to prevent crashes) ---
  const yarnRef = useRef({ vel: { x: 0, y: 0 }, dragging: false });

  const spawnYarn = () => {
    setYarnActive(true);
    setYarnColor(yarnColors[Math.floor(rand(0, yarnColors.length))]);
    setYarnPos({ x: vp.w * 0.5, y: vp.h * 0.6 });
    yarnRef.current.vel = { x: 0, y: 0 };
    yarnRef.current.dragging = false;
    setCatChasingYarn(true);
    setAside("🧶 Drag the yarn ball!");
    setLastInteraction(now());
  };

  const flickYarn = (vx: number, vy: number) => {
    yarnRef.current.vel = {
      x: clamp(vx / 60, -12, 12),
      y: clamp(vy / 60, -12, 12)
    };
  };

  // Yarn physics - using ref to avoid state update loops
  useEffect(() => {
    if (!yarnActive || yarnRef.current.dragging) return;

    const vel = yarnRef.current.vel;
    if (Math.abs(vel.x) < 0.1 && Math.abs(vel.y) < 0.1) return;

    setYarnPos((p) => {
      let newX = p.x + vel.x;
      let newY = p.y + vel.y;

      // Bounce off walls
      if (newX < 30 || newX > vp.w - 30) {
        vel.x *= -0.6;
        newX = clamp(newX, 30, vp.w - 30);
      }
      if (newY < 100 || newY > vp.h - 60) {
        vel.y *= -0.6;
        newY = clamp(newY, 100, vp.h - 60);
      }

      // Apply friction
      vel.x *= 0.95;
      vel.y *= 0.95;

      return { x: newX, y: newY };
    });
  }, [tick, yarnActive, vp.w, vp.h]);

  // Cat chases yarn
  useEffect(() => {
    if (!yarnActive || !catChasingYarn) return;

    const target = clampBtn(yarnPos.x - btnSize.w / 2, yarnPos.y - btnSize.h / 2);
    const speed = isCatnipActive ? 18 : 12;

    setPos((p) => {
      const next = moveToward(p, target, speed);
      const d = dist(next, target);

      if (d < 40 && !yarnRef.current.dragging) {
        // Cat caught the yarn!
        burst("🧶", yarnPos, 6, 40, 0.8);
        setAside(playfulReactions[Math.floor(rand(0, playfulReactions.length))]);

        // Knock the yarn away
        yarnRef.current.vel = { x: rand(-8, 8), y: rand(-8, 8) };
      }

      if (Math.random() < 0.08) {
        addPawPrint(next.x + btnSize.w / 2, next.y + btnSize.h / 2);
      }
      return next;
    });
  }, [tick, yarnActive, catChasingYarn, yarnPos.x, yarnPos.y, isCatnipActive, btnSize.w, btnSize.h]);

  // --- CATNIP LOGIC ---
  const giveCatnip = () => {
    setCatnipUntil(now() + 8000);
    triggerBehavior("catnip", 8000);
    burst("🌿", { x: vp.w * 0.5, y: vp.h * 0.4 }, 20, 100, 1.5);
    setLastInteraction(now());
  };

  const clampBtn = (x: number, y: number, allowOff = false) => {
    const off = allowOff ? 14 : 0;
    return {
      x: clamp(x, -off, vp.w - btnSize.w + off),
      y: clamp(y, -off, vp.h - btnSize.h + off),
    };
  };

  // --- Floating "No" position
  const [pos, setPos] = useState<XY>({ x: 24, y: 24 });

  // Pick a position OUTSIDE the card but nearby - never overlapping
  const pickNearCard = () => {
    const card = cardRef.current?.getBoundingClientRect?.();
    if (!card) return clampBtn(rand(16, vp.w - btnSize.w - 16), rand(80, vp.h - btnSize.h - 80));

    // Safe margin to ensure button is fully outside card
    const margin = 20;

    // Spots that are OUTSIDE the card with safe margins
    const spots: XY[] = [];

    // LEFT of card (if there's room)
    if (card.left > btnSize.w + margin) {
      spots.push({ x: card.left - btnSize.w - margin, y: card.top + rand(0, Math.max(0, card.height - btnSize.h)) });
    }

    // RIGHT of card (if there's room)
    if (vp.w - card.right > btnSize.w + margin) {
      spots.push({ x: card.right + margin, y: card.top + rand(0, Math.max(0, card.height - btnSize.h)) });
    }

    // ABOVE card (if there's room - accounting for HUD)
    if (card.top > btnSize.h + 80) {
      spots.push({ x: card.left + rand(0, Math.max(0, card.width - btnSize.w)), y: card.top - btnSize.h - margin });
    }

    // BELOW card (if there's room)
    if (vp.h - card.bottom > btnSize.h + margin) {
      spots.push({ x: card.left + rand(0, Math.max(0, card.width - btnSize.w)), y: card.bottom + margin });
    }

    // If no safe spots found, place in corners away from card center
    if (spots.length === 0) {
      const cardCenterX = card.left + card.width / 2;
      const cardCenterY = card.top + card.height / 2;

      // Pick corner furthest from card center
      if (cardCenterX > vp.w / 2) {
        // Card is on right, put button on left
        spots.push({ x: 20, y: cardCenterY > vp.h / 2 ? 80 : vp.h - btnSize.h - 20 });
      } else {
        // Card is on left, put button on right
        spots.push({ x: vp.w - btnSize.w - 20, y: cardCenterY > vp.h / 2 ? 80 : vp.h - btnSize.h - 20 });
      }
    }

    const s = spots[Math.floor(rand(0, spots.length))];
    return clampBtn(s.x, s.y);
  };

  const moveNo = (reason?: string) => {
    const t = now();
    if (t < freezeUntil) return;

    // Always use pickNearCard to ensure button is outside the card
    // This works for both mobile and desktop
    let next = pickNearCard();

    // On desktop, occasionally allow more varied positions but still avoid card
    if (!coarse && Math.random() < 0.3) {
      const card = cardRef.current?.getBoundingClientRect?.();
      if (card) {
        // Generate random position
        let candidate = clampBtn(rand(40, vp.w - btnSize.w - 40), rand(100, vp.h - btnSize.h - 100));

        // Check if it overlaps with card (with margin)
        const margin = 30;
        const overlapsCard =
          candidate.x < card.right + margin &&
          candidate.x + btnSize.w > card.left - margin &&
          candidate.y < card.bottom + margin &&
          candidate.y + btnSize.h > card.top - margin;

        // Only use candidate if it doesn't overlap
        if (!overlapsCard) {
          next = candidate;
        }
      }
    }

    setPos(next);
    // Stay in place longer (1.2s) so user can find and click it
    setFreezeUntil(t + 1200);
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
  // Show the floating No button when cat isn't in special states
  const showNo = !catInBox && !enteringBox && !approaching && !eating && catBehavior !== "napping";

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

    // Different reactions based on how many times they've said no
    const emojis = noCount < 3 ? "😿" : noCount < 6 ? "😾" : noCount < 10 ? "💔" : "🐾";
    burst(emojis, { x: pos.x + btnSize.w / 2, y: pos.y + btnSize.h / 2 }, 10, 70, 1.05);

    setNoCount((n) => Math.min(n + 1, beats.length - 1));

    const ready = tNow > boxCooldownUntil;
    if (noCount >= 2 && ready && Math.random() < mode.shieldChance) {
      activateShield();
      return;
    }

    // More varied reactions
    const reaction = noCount < 3
      ? curiousReactions[Math.floor(rand(0, curiousReactions.length))]
      : noCount < 7
      ? annoyedReactions[Math.floor(rand(0, annoyedReactions.length))]
      : ["fine. 😿", "I see how it is 💔", "*dramatic sigh*", "okay then… 😢"][Math.floor(rand(0, 4))];

    setAside(reaction);
    window.setTimeout(() => moveNo(), 70);
  };

  const beginHold = (e: React.PointerEvent | React.TouchEvent) => {
    if (holding || frozen || !showNo) return;

    // Prevent default to stop text selection and other browser behaviors
    e.preventDefault?.();
    e.stopPropagation?.();

    setHolding(true);
    startRef.current = now();

    // Cross-browser pointer capture
    try {
      if ('pointerId' in e && e.currentTarget) {
        (e.currentTarget as HTMLElement).setPointerCapture?.((e as React.PointerEvent).pointerId);
      }
    } catch {
      // Fallback for browsers that don't support pointer capture
    }

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
      // Give encouraging feedback instead of running away
      if (holdP >= 0.75) {
        setAside("SO CLOSE! 😼 Try again!");
        // Don't move - let them try again easily
      } else if (holdP >= 0.5) {
        setAside("Almost! Keep holding 😾");
        // Don't move - they were doing well
      } else if (holdP >= 0.25) {
        setAside("Hold longer! 🐾");
      } else if (!frozen && !calm && noCount >= 5) {
        // Only run away if very low progress AND high no count
        moveNo("*skitters away* 🐾");
      }
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

    // Reset new behavior states
    setCatBehavior("normal");
    setBehaviorUntil(0);
    setLastInteraction(now());
    setLaserActive(false);
    setCatChasingLaser(false);
    setYarnActive(false);
    setCatChasingYarn(false);
    setCatnipUntil(0);
    setCurrentGift(null);
    setPawPrints([]);
    setKnockedItems([]);

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

  // --- Accepted screen (responsive for all browsers and devices)
  if (accepted) {
    return (
      <div
        className={cn(
          "bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center",
          "p-4 sm:p-6 md:p-8 lg:p-10",
          // Height fallback: min-h-screen for old browsers, then dvh for modern
          "min-h-screen min-h-[100dvh]"
        )}
        style={{
          paddingTop: "max(env(safe-area-inset-top, 16px), 16px)",
          paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          paddingLeft: "max(env(safe-area-inset-left, 16px), 16px)",
          paddingRight: "max(env(safe-area-inset-right, 16px), 16px)",
          touchAction: "manipulation",
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

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-pink-50 via-rose-50 to-rose-100",
        "p-2 sm:p-4 md:p-6 lg:p-8",
        // Height: min-h-screen as fallback, then dvh for modern browsers
        "min-h-screen min-h-[100dvh]",
        "overflow-x-hidden overflow-y-auto",
        // Prevent text selection on interactive elements (cross-browser)
        "select-none sm:select-auto",
        // Smooth scrolling for iOS Safari
        "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      )}
      style={{
        // Safe area insets with fallbacks
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        // Prevent iOS Safari bounce/rubber-band effect
        WebkitOverflowScrolling: "touch",
        // Prevent accidental zooming on double-tap (Safari)
        touchAction: "manipulation",
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

      {/* PAW PRINTS TRAIL */}
      <div className="pointer-events-none fixed inset-0 z-[15]">
        {pawPrints.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-lg sm:text-xl"
            style={{ left: p.x, top: p.y }}
            initial={{ opacity: 0.6, scale: 1, rotate: p.r }}
            animate={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 4, ease: "easeOut" }}
          >
            🐾
          </motion.div>
        ))}
      </div>

      {/* KNOCKED ITEMS (falling) */}
      <div className="pointer-events-none fixed inset-0 z-[83]">
        {knockedItems.map((item) => (
          <motion.div
            key={item.id}
            className="absolute text-2xl sm:text-3xl"
            initial={{ x: item.x, y: item.y, rotate: 0, opacity: 1 }}
            animate={{ y: vp.h + 50, rotate: rand(-180, 180), opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeIn" }}
          >
            {item.emoji}
          </motion.div>
        ))}
      </div>

      {/* LASER POINTER */}
      <AnimatePresence>
        {laserActive && mounted && (
          <motion.div
            className="fixed z-[82]"
            style={{ left: laserPos.x - 12, top: laserPos.y - 12 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: [1, 1.2, 1] }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ scale: { duration: 0.3, repeat: Infinity } }}
          >
            <div
              className="w-6 h-6 rounded-full bg-red-500 shadow-lg cursor-pointer touch-manipulation"
              style={{ boxShadow: "0 0 20px 8px rgba(239, 68, 68, 0.6)" }}
              onPointerDown={(e) => {
                e.preventDefault();
                setLastInteraction(now());
              }}
              onPointerMove={(e) => {
                if (laserActive) {
                  setLaserPos({ x: e.clientX, y: e.clientY });
                  setLastInteraction(now());
                }
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch && laserActive) {
                  setLaserPos({ x: touch.clientX, y: touch.clientY });
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full screen laser move area */}
      {laserActive && (
        <div
          className="fixed inset-0 z-[81] cursor-crosshair"
          onPointerMove={(e) => {
            setLaserPos({ x: e.clientX, y: e.clientY });
            setLastInteraction(now());
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            if (touch) {
              setLaserPos({ x: touch.clientX, y: touch.clientY });
            }
          }}
          onClick={() => {
            setLaserActive(false);
            setCatChasingLaser(false);
            setAside("laser off 😿");
          }}
        />
      )}

      {/* YARN BALL - simplified drag */}
      <AnimatePresence>
        {yarnActive && mounted && (
          <motion.div
            className="fixed z-[82]"
            style={{ left: yarnPos.x - 28, top: yarnPos.y - 28 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
          >
            <motion.div
              className="w-14 h-14 rounded-full flex items-center justify-center text-3xl cursor-grab active:cursor-grabbing touch-manipulation select-none"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${yarnColor}, ${yarnColor}99)`,
                boxShadow: `0 4px 16px ${yarnColor}66`
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" } }}
              onPointerDown={(e) => {
                e.preventDefault();
                yarnRef.current.dragging = true;
                yarnRef.current.vel = { x: 0, y: 0 };
                try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
              }}
              onPointerMove={(e) => {
                if (!yarnRef.current.dragging) return;
                setYarnPos(p => ({
                  x: clamp(p.x + e.movementX, 30, vp.w - 30),
                  y: clamp(p.y + e.movementY, 100, vp.h - 60)
                }));
                setLastInteraction(now());
              }}
              onPointerUp={(e) => {
                if (!yarnRef.current.dragging) return;
                yarnRef.current.dragging = false;
                // Simple flick based on last movement
                flickYarn(e.movementX * 8, e.movementY * 8);
                try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
              }}
              onPointerCancel={() => {
                yarnRef.current.dragging = false;
              }}
            >
              🧶
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CAT GIFT */}
      <AnimatePresence>
        {currentGift && mounted && (
          <motion.div
            className="fixed z-[84] pointer-events-none"
            style={{ left: giftPos.x - 20, top: giftPos.y - 40 }}
            initial={{ opacity: 0, y: 20, scale: 0 }}
            animate={{ opacity: 1, y: 0, scale: [1, 1.2, 1] }}
            exit={{ opacity: 0, y: -20, scale: 0 }}
            transition={{ scale: { duration: 0.5, repeat: 3 } }}
          >
            <div className="text-4xl">{currentGift}</div>
            <motion.div
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 whitespace-nowrap bg-white/80 px-2 py-1 rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              for you! 💝
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CAT BEHAVIOR INDICATOR */}
      <AnimatePresence>
        {isBehaviorActive && catBehavior !== "normal" && mounted && (
          <motion.div
            className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[86]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className={cn(
              "px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur",
              catBehavior === "zoomies" && "bg-amber-100/90 text-amber-800",
              catBehavior === "napping" && "bg-indigo-100/90 text-indigo-800",
              catBehavior === "grooming" && "bg-pink-100/90 text-pink-800",
              catBehavior === "hunting" && "bg-red-100/90 text-red-800",
              catBehavior === "knocking" && "bg-orange-100/90 text-orange-800",
              catBehavior === "gifting" && "bg-rose-100/90 text-rose-800",
              catBehavior === "loaf" && "bg-amber-50/90 text-amber-700",
              catBehavior === "catnip" && "bg-emerald-100/90 text-emerald-800",
            )}>
              {catBehavior === "zoomies" && "⚡ ZOOMIES MODE"}
              {catBehavior === "napping" && "💤 Napping..."}
              {catBehavior === "grooming" && "✨ Grooming"}
              {catBehavior === "hunting" && "🎯 Hunting Mode"}
              {catBehavior === "knocking" && "😼 Being Mischievous"}
              {catBehavior === "gifting" && "🎁 Brought You Something!"}
              {catBehavior === "loaf" && "🍞 Loaf Mode"}
              {catBehavior === "catnip" && "🌿 CATNIP ACTIVATED"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Main card - responsive for all screen sizes including tablets */}
      <div
        className={cn(
          "flex items-center justify-center pb-4",
          // Use vh as fallback, dvh for modern browsers
          isShortScreen && isLandscape
            ? "min-h-screen min-h-[100dvh] pt-12"
            : "min-h-[calc(100vh-2rem)] min-h-[calc(100dvh-2rem)] pt-16 sm:pt-20"
        )}
      >
        <Card
          ref={cardRef}
          className={cn(
            "relative z-30 shadow-lg bg-white/80 border border-white/60",
            "rounded-2xl sm:rounded-3xl",
            // Width adjustments for different devices
            "w-full mx-2 sm:mx-4 md:mx-6",
            // Max width for different screen sizes
            isTablet || isLargeTablet || isDesktop ? "max-w-lg" : "max-w-md",
            // Safari backdrop-blur fallback
            "backdrop-blur-xl supports-[backdrop-filter]:bg-white/80"
          )}
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
                setAside(petReactions[Math.floor(rand(0, petReactions.length))]);
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

              {/* TOY BOX - Compact and clean */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={activateLaser}
                  disabled={laserActive || yarnActive}
                  className={cn(
                    "rounded-full text-xs px-3 py-2 touch-manipulation",
                    laserActive && "bg-red-100 border-red-300"
                  )}
                >
                  🔴 Laser
                </Button>
                <Button
                  variant="outline"
                  onClick={spawnYarn}
                  disabled={yarnActive || laserActive}
                  className={cn(
                    "rounded-full text-xs px-3 py-2 touch-manipulation",
                    yarnActive && "bg-pink-100 border-pink-300"
                  )}
                >
                  🧶 Yarn
                </Button>
                <Button
                  variant="outline"
                  onClick={giveCatnip}
                  disabled={isCatnipActive}
                  className={cn(
                    "rounded-full text-xs px-3 py-2 touch-manipulation",
                    isCatnipActive && "bg-emerald-100 border-emerald-300"
                  )}
                >
                  🌿 Catnip
                </Button>
                {(laserActive || yarnActive) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLaserActive(false);
                      setCatChasingLaser(false);
                      setYarnActive(false);
                      setCatChasingYarn(false);
                      setAside("toys away 📦");
                    }}
                    className="rounded-full text-xs px-3 py-2 touch-manipulation bg-slate-100"
                  >
                    ✖️
                  </Button>
                )}
              </div>

              {/* Simple instruction */}
              <p className="mt-2 text-xs text-slate-500 text-center">
                Find the floating <span className="font-semibold text-rose-500">No</span> button and hold it for {Math.round(mode.holdMs / 100) / 10}s
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FLOATING NO BUTTON - improved visibility and easier to click */}
      <AnimatePresence>
        {showNo && mounted && (
          <motion.div
            className="fixed left-0 top-0 z-[25]"
            style={{ x: pos.x, y: pos.y }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{
              opacity: 1,
              scale: isCatnipActive ? [1, 1.05, 1] : 1,
              rotate: catBehavior === "zoomies" ? [0, -2, 2, 0] : 0
            }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 26,
              scale: { duration: 0.5, repeat: isCatnipActive ? Infinity : 0 },
              rotate: { duration: 0.4, repeat: catBehavior === "zoomies" ? Infinity : 0 }
            }}
          >
            {/* Attention-grabbing glow behind button */}
            {!holding && !catChasingLaser && !catChasingYarn && (
              <motion.div
                className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-rose-400/30 blur-xl"
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <motion.button
              type="button"
              className={cn(
                "relative select-none rounded-2xl sm:rounded-3xl px-4 sm:px-5 py-3 sm:py-4",
                "shadow-xl backdrop-blur-md border-2 touch-manipulation",
                // Better contrast - white/solid backgrounds
                catBehavior === "grooming" && "bg-pink-100 border-pink-300",
                catBehavior === "loaf" && "bg-amber-100 border-amber-300",
                catBehavior === "hunting" && "bg-red-100 border-red-300",
                isCatnipActive && "bg-emerald-100 border-emerald-400",
                catChasingLaser && "bg-red-100 border-red-300",
                catChasingYarn && "bg-purple-100 border-purple-300",
                !isCatnipActive && !catChasingLaser && !catChasingYarn && catBehavior === "normal" && "bg-white border-rose-200",
                // Holding state - darker to show it's being pressed
                holding && "bg-rose-50 border-rose-400"
              )}
              style={{ minWidth: btnSize.w, minHeight: btnSize.h }}
              onPointerDown={beginHold}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onPointerLeave={() => (coarse ? undefined : endHold())}
              onPointerEnter={() => {
                // Occasional pet reaction when hovering
                if (!holding && Math.random() < 0.3 && !catChasingLaser && !catChasingYarn) {
                  setAside(petReactions[Math.floor(rand(0, petReactions.length))]);
                  setLastInteraction(now());
                }
              }}
              // Touch event fallbacks for older Safari/browsers
              onTouchStart={beginHold}
              onTouchEnd={endHold}
              onTouchCancel={endHold}
              disabled={frozen || catChasingLaser || catChasingYarn}
              aria-label="No button"
              title="Press & hold"
              animate={
                reduceMotion
                  ? {}
                  : holding
                  ? { scale: 0.98 } // Pressed effect
                  : catBehavior === "zoomies" || isCatnipActive
                  ? { y: [0, -3, 0] }
                  : { y: [0, -4, 0], scale: [1, 1.02, 1] } // Gentle bounce to attract attention
              }
              transition={{
                duration: holding ? 0.1 : catBehavior === "zoomies" || isCatnipActive ? 0.4 : 1.5,
                repeat: reduceMotion || holding ? 0 : Infinity,
                ease: "easeInOut"
              }}
            >
              {/* Progress ring - more visible */}
              <div
                className="absolute -inset-[4px] sm:-inset-[5px] rounded-[20px] sm:rounded-[26px] p-[3px]"
                style={{
                  background: holding
                    ? `conic-gradient(rgba(244,63,94,1) ${Math.round(holdP * 360)}deg, rgba(226,232,240,0.5) 0deg)`
                    : isCatnipActive
                    ? `conic-gradient(rgba(16,185,129,0.95) ${Math.round(holdP * 360)}deg, rgba(148,163,184,0.25) 0deg)`
                    : `conic-gradient(rgba(244,63,94,0.3) 360deg, rgba(226,232,240,0.3) 0deg)`
                }}
                aria-hidden="true"
              >
                <div className="h-full w-full rounded-[17px] sm:rounded-[23px] bg-white/90" />
              </div>

              {/* Button content */}
              <div className="relative flex flex-col items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="text-sm sm:text-base font-bold text-slate-800">
                    {catChasingLaser ? "🔴 Chasing!" : catChasingYarn ? "🧶 Playing!" : mode.label}
                  </div>
                </div>

                {/* Clear instruction or progress */}
                <div className="mt-1 text-[11px] sm:text-xs font-medium">
                  {holding ? (
                    <span className="text-rose-600">
                      {holdP < 0.5 ? "Keep holding..." : holdP < 0.8 ? "Almost there!" : "Almost done!"}
                    </span>
                  ) : catChasingLaser ? (
                    <span className="text-red-600">Move the laser!</span>
                  ) : catChasingYarn ? (
                    <span className="text-purple-600">Flick the yarn!</span>
                  ) : (
                    <span className="text-slate-500">👆 Tap & hold</span>
                  )}
                </div>

                {/* Visual progress bar when holding */}
                {holding && (
                  <div className="mt-2 w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${holdP * 100}%` }}
                      transition={{ duration: 0.05 }}
                    />
                  </div>
                )}
              </div>

              {/* Behavior emoji indicator */}
              {isBehaviorActive && catBehavior !== "normal" && !holding && (
                <motion.div
                  className="absolute -top-2 -right-2 text-base bg-white rounded-full p-1 shadow-md"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  {catBehavior === "zoomies" && "⚡"}
                  {catBehavior === "grooming" && "✨"}
                  {catBehavior === "loaf" && "🍞"}
                  {catBehavior === "hunting" && "🎯"}
                </motion.div>
              )}
              {isCatnipActive && !holding && (
                <motion.div
                  className="absolute -top-2 -left-2 text-base bg-white rounded-full p-1 shadow-md"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  🌿
                </motion.div>
              )}
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
                  e.stopPropagation();
                  setFishHeld(true);
                  // Cross-browser pointer capture
                  try {
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  } catch {
                    // Safari fallback - some versions don't support pointer capture
                  }
                  // Use clientX/Y with fallbacks for older browsers
                  const x = e.clientX ?? (e as any).pageX ?? vp.w * 0.5;
                  const y = e.clientY ?? (e as any).pageY ?? vp.h - 110;
                  setFishPos({ x, y });
                }}
                onPointerMove={(e) => {
                  if (!fishHeld || eating) return;
                  e.preventDefault();
                  const x = e.clientX ?? (e as any).pageX ?? fishPos.x;
                  const y = e.clientY ?? (e as any).pageY ?? fishPos.y;
                  setFishPos({ x, y });
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  setFishHeld(false);
                  // Release pointer capture
                  try {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                  } catch {}
                }}
                onPointerCancel={() => setFishHeld(false)}
                // Touch event fallbacks for older Safari
                onTouchStart={(e) => {
                  if (eating) return;
                  const touch = e.touches[0];
                  if (touch) {
                    setFishHeld(true);
                    setFishPos({ x: touch.clientX, y: touch.clientY });
                  }
                }}
                onTouchMove={(e) => {
                  if (!fishHeld || eating) return;
                  const touch = e.touches[0];
                  if (touch) {
                    setFishPos({ x: touch.clientX, y: touch.clientY });
                  }
                }}
                onTouchEnd={() => setFishHeld(false)}
                onTouchCancel={() => setFishHeld(false)}
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
