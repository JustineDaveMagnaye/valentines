import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Angry, Cat, Fish, Heart, Sparkles } from "lucide-react";

/**
 * 🐱 WILL YOU BE MINE? 🐱
 * Cat-themed Valentine's website
 * The only correct answer is Yes.
 * "No" can be confirmed up to 20 times and gets increasingly chaotic —
 * BUT it should always feel possible on mobile + desktop.
 *
 * Added per request:
 * - A RANDOM cardboard box spawns.
 * - The No button can DIVE INSIDE the box and become unavailable.
 * - You must THROW FISH (tap/click box or press button) to lure it out.
 * - Still fair: fish required is capped (1–3), box is always tappable, and No pops out + freezes.
 */

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

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getViewport() {
  if (typeof window === "undefined") return { w: 390, h: 844 };
  return { w: window.innerWidth, h: window.innerHeight };
}

type XY = { x: number; y: number };

type Spot = {
  pos: XY;
  layer: "front" | "behind";
  peek: XY;
  tunnelTo?: XY | null;
  hideHint?: "left" | "right" | "top" | "bottom" | "bottomCenter";
};

type FishShot = { id: string; from: XY; to: XY; t: number };

export default function ValentineCat() {
  const [noCount, setNoCount] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const capped = Math.min(noCount, beats.length - 1);

  // keep time-based states updating (freeze/calm indicators)
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setClock((c) => c + 1), 120);
    return () => window.clearInterval(id);
  }, []);

  // hover capability (desktop vs mobile)
  const [canHover, setCanHover] = useState(false);
  const [isCoarse, setIsCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mqHover = window.matchMedia?.("(hover: hover)");
    const mqCoarse = window.matchMedia?.("(pointer: coarse)");
    const update = () => {
      setCanHover(Boolean(mqHover?.matches));
      setIsCoarse(Boolean(mqCoarse?.matches));
    };
    update();
    mqHover?.addEventListener?.("change", update);
    mqCoarse?.addEventListener?.("change", update);
    return () => {
      mqHover?.removeEventListener?.("change", update);
      mqCoarse?.removeEventListener?.("change", update);
    };
  }, []);

  // viewport (for free-floating No button)
  const [vp, setVp] = useState(getViewport());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setVp(getViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // loop after 20th beat
  useEffect(() => {
    if (noCount >= beats.length - 1) {
      const t = window.setTimeout(() => setNoCount(0), 2200);
      return () => window.clearTimeout(t);
    }
  }, [noCount]);

  const cardRef = useRef<HTMLDivElement | null>(null);

  // NO button position + layer (front/behind card)
  const [pos, setPos] = useState<XY>({ x: 24, y: 24 });
  const [noLayer, setNoLayer] = useState<"front" | "behind">("front");
  const [peekVec, setPeekVec] = useState<XY>({ x: 0, y: 0 });
  const [tunnelTo, setTunnelTo] = useState<XY | null>(null);
  const [hideHint, setHideHint] = useState<Spot["hideHint"]>(undefined);

  // fairness windows
  const [freezeUntil, setFreezeUntil] = useState(0);
  const [calmUntil, setCalmUntil] = useState(0);
  const [aside, setAside] = useState("");

  const now = getNow();
  const isFrozen = now < freezeUntil;
  const isCalm = now < calmUntil;

  useEffect(() => {
    if (!aside) return;
    const t = window.setTimeout(() => setAside(""), 1600);
    return () => window.clearTimeout(t);
  }, [aside]);

  // paw trails (helps track it + feels cute)
  const [trails, setTrails] = useState<Array<{ id: string; x: number; y: number; t: number }>>([]);
  useEffect(() => {
    setTrails((arr) => arr.filter((p) => now - p.t < 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  // Laser pointer (drag to lure)
  const [laser, setLaser] = useState<XY>({ x: vp.w * 0.62, y: vp.h * 0.76 });
  const [laserHeld, setLaserHeld] = useState(false);

  // cursor position for desktop fear aura
  const [mouse, setMouse] = useState<XY>({ x: vp.w / 2, y: vp.h / 2 });
  useEffect(() => {
    if (!canHover) return;
    const handler = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [canHover]);

  // --- RANDOM BOX + FISH LURE ---
  // Responsive box size based on viewport
  const BOX_W = Math.min(176, vp.w * 0.45);
  const BOX_H = Math.min(124, vp.w * 0.32);
  const [boxVisible, setBoxVisible] = useState(false);
  const [boxPos, setBoxPos] = useState<XY>({ x: 24, y: 24 });
  const [boxUntil, setBoxUntil] = useState(0);

  const [catInBox, setCatInBox] = useState(false);
  const [enteringBox, setEnteringBox] = useState(false);
  const lastBoxHideRef = useRef(0);

  const [fishFed, setFishFed] = useState(0);
  const [shots, setShots] = useState<FishShot[]>([]);

  const boxCenter = useMemo<XY>(() => ({ x: boxPos.x + BOX_W / 2, y: boxPos.y + BOX_H / 2 }), [boxPos.x, boxPos.y]);
  const fishNeeded = useMemo(() => clamp(1 + Math.floor(noCount / 7), 1, 3), [noCount]);

  // auto-expire box
  useEffect(() => {
    if (!boxVisible) return;
    if (catInBox) return;
    if (now > boxUntil) setBoxVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, boxVisible, boxUntil, catInBox]);

  const measureBtn = (scale: number) => ({ w: 132 * scale, h: 56 * scale });

  const safeClampSpot = (x: number, y: number, scale: number, opts?: { allowOff?: boolean }) => {
    const { w: btnW, h: btnH } = measureBtn(scale);
    const allowOff = opts?.allowOff ? 14 : 0;
    const minX = -allowOff;
    const minY = -allowOff;
    const maxX = vp.w - btnW + allowOff;
    const maxY = vp.h - btnH + allowOff;
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
  };

  const safeClampBox = (x: number, y: number) => {
    const margin = 10;
    return {
      x: clamp(x, margin, Math.max(margin, vp.w - BOX_W - margin)),
      y: clamp(y, margin, Math.max(margin, vp.h - BOX_H - margin)),
    };
  };

  const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const spawnBox = () => {
    const t = getNow();
    const card = cardRef.current?.getBoundingClientRect?.();
    const tries = 9;
    let chosen: XY = { x: rand(12, Math.max(12, vp.w - BOX_W - 12)), y: rand(12, Math.max(12, vp.h - BOX_H - 12)) };

    for (let i = 0; i < tries; i++) {
      const p = safeClampBox(rand(12, Math.max(12, vp.w - BOX_W - 12)), rand(12, Math.max(12, vp.h - BOX_H - 12)));
      if (!card) {
        chosen = p;
        break;
      }
      const pad = isCoarse ? 18 : 12;
      const boxR = { x: p.x - pad, y: p.y - pad, w: BOX_W + pad * 2, h: BOX_H + pad * 2 };
      const cardR = { x: card.left, y: card.top, w: card.width, h: card.height };
      // prefer not to spawn under the card so it's always tappable
      if (!intersects(boxR, cardR)) {
        chosen = p;
        break;
      }
      chosen = p;
    }

    setBoxPos(chosen);
    setBoxVisible(true);
    setBoxUntil(t + 12000);
  };

  // randomly spawn a box after a "No" is confirmed (only sometimes)
  useEffect(() => {
    if (noCount < 2) return;
    if (catInBox) return;
    // if a box already exists, sometimes move it to keep it "random"
    if (boxVisible) {
      if (Math.random() < 0.22) spawnBox();
      else setBoxUntil(getNow() + 9000);
      return;
    }
    if (Math.random() < 0.38) spawnBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noCount]);

  const mode = useMemo(() => {
    // readable & tappable
    const scale = clamp(1.04 - noCount * 0.018, 0.82, 1.18);
    const opacity = clamp(noCount > 14 ? 1 - (noCount - 14) * 0.04 : 1, 0.78, 1);

    // behavior schedule: we sprinkle card-hiding moments in the arc
    const behavior = (() => {
      if (noCount <= 1) return "near";
      if (noCount === 5) return "rage";
      if (noCount === 9 || noCount === 14 || noCount === 18) return "peek";
      if (noCount === 7 || noCount === 8 || noCount === 10) return "slip";

      // hide behind card moments
      if (noCount === 3 || noCount === 6 || noCount === 12 || noCount === 17) return "hide";
      if (noCount === 15) return "tunnel";

      // desktop-only flavors
      if (!isCoarse && (noCount === 11 || noCount === 16)) return "orbit";
      return "random";
    })();

    // Desktop: fear aura, but never while calm OR while the cat is in the box
    const fearAura = canHover && noCount >= 3 && !isCalm && !catInBox;

    // Hold-to-confirm: capped so it's never miserable
    const baseHold = clamp(340 + noCount * 28, 340, 900);
    const holdMs = isCalm ? Math.max(220, baseHold * 0.65) : baseHold;

    // Laser lure: disabled while cat is in the box (fish-only)
    const lure = (isCalm || laserHeld) && !catInBox;

    // Mobile should not wander too far
    const maxWander = isCoarse ? 0.55 : 1;

    return {
      scale,
      opacity,
      behavior,
      fearAura,
      holdMs,
      lure,
      maxWander,
      label: noLabels[noCount % noLabels.length],
    };
  }, [noCount, canHover, isCoarse, isCalm, laserHeld, catInBox]);

  const pickSpot = (kind: string): Spot => {
    const margin = 14;
    const { w: btnW, h: btnH } = measureBtn(mode.scale);
    const card = cardRef.current?.getBoundingClientRect?.();

    const randomAnywhere = () => {
      // On mobile/coarse pointer, bias toward the card so it stays findable
      const mx = mode.maxWander;
      const left = rand(margin, vp.w - btnW - margin);
      const top = rand(margin, vp.h - btnH - margin);
      if (!isCoarse) return { x: left, y: top };

      if (card && Math.random() < 0.7) {
        const cx = clamp(card.left + card.width / 2, margin, vp.w - margin);
        const cy = clamp(card.top + card.height / 2, margin, vp.h - margin);
        return {
          x: clamp(cx + rand(-160 * mx, 160 * mx) - btnW / 2, margin, vp.w - btnW - margin),
          y: clamp(cy + rand(-190 * mx, 190 * mx) - btnH / 2, margin, vp.h - btnH - margin),
        };
      }
      return { x: left, y: top };
    };

    // If we can't measure the card yet, we can still do a basic peek/hide using edges.
    if (!card) {
      if (kind === "peek") {
        const edges = [
          { x: rand(24, vp.w - btnW - 24), y: -8 },
          { x: rand(24, vp.w - btnW - 24), y: vp.h - btnH + 8 },
          { x: -8, y: rand(24, vp.h - btnH - 24) },
          { x: vp.w - btnW + 8, y: rand(24, vp.h - btnH - 24) },
        ];
        const e = edges[Math.floor(rand(0, edges.length))];
        return {
          pos: safeClampSpot(e.x, e.y, mode.scale, { allowOff: true }),
          layer: "front",
          peek: { x: 0, y: 0 },
        };
      }
      const p = randomAnywhere();
      return { pos: safeClampSpot(p.x, p.y, mode.scale), layer: "front", peek: { x: 0, y: 0 } };
    }

    // friendly positions around the card
    const around = [
      { x: card.left - btnW + 28, y: card.top + rand(10, Math.max(12, card.height - 64)) },
      { x: card.right - 28, y: card.top + rand(10, Math.max(12, card.height - 64)) },
      { x: card.left + rand(10, Math.max(12, card.width - 160)), y: card.top - btnH + 24 },
      { x: card.left + rand(10, Math.max(12, card.width - 160)), y: card.bottom - 26 },
    ];

    const hideMagnitude = clamp(22 * mode.scale, 14, 30);

    const hideBehindCard = (): Spot => {
      const scripted: Record<number, Spot["hideHint"]> = {
        3: "left",
        6: "bottomCenter",
        12: "top",
        17: "right",
      };

      const hint: Spot["hideHint"] =
        scripted[noCount] ||
        (Math.random() < 0.45
          ? "bottomCenter"
          : (['left', 'right', 'top', 'bottom'] as Spot["hideHint"][])[Math.floor(rand(0, 4))]);

      const visiblePct = 0.35;

      let x = card.left;
      let y = card.top;
      let peek: XY = { x: 0, y: 0 };

      if (hint === "left") {
        x = card.left - btnW * visiblePct;
        y = card.top + rand(10, Math.max(12, card.height - btnH - 10));
        peek = { x: -hideMagnitude, y: 0 };
      } else if (hint === "right") {
        x = card.right - btnW * (1 - visiblePct);
        y = card.top + rand(10, Math.max(12, card.height - btnH - 10));
        peek = { x: hideMagnitude, y: 0 };
      } else if (hint === "top") {
        x = card.left + rand(10, Math.max(12, card.width - btnW - 10));
        y = card.top - btnH * visiblePct;
        peek = { x: 0, y: -hideMagnitude };
      } else if (hint === "bottomCenter") {
        x = card.left + card.width / 2 - btnW / 2;
        y = card.bottom - btnH * (1 - visiblePct);
        peek = { x: 0, y: hideMagnitude };
      } else {
        x = card.left + rand(10, Math.max(12, card.width - btnW - 10));
        y = card.bottom - btnH * (1 - visiblePct);
        peek = { x: 0, y: hideMagnitude };
      }

      return {
        pos: safeClampSpot(x, y, mode.scale, { allowOff: true }),
        layer: "behind",
        peek,
        tunnelTo: null,
        hideHint: hint,
      };
    };

    const tunnelBehindCard = (): Spot => {
      const visiblePct = 0.36;
      const y = card.top + rand(12, Math.max(14, card.height - btnH - 12));
      const start = safeClampSpot(card.left - btnW * visiblePct, y, mode.scale, { allowOff: true });
      const end = safeClampSpot(card.right - btnW * (1 - visiblePct), y + rand(-10, 10), mode.scale, { allowOff: true });
      return {
        pos: start,
        layer: "behind",
        peek: { x: 0, y: 0 },
        tunnelTo: end,
        hideHint: "bottomCenter",
      };
    };

    switch (kind) {
      case "near":
        return { pos: safeClampSpot(card.right - 40, card.top + 14, mode.scale), layer: "front", peek: { x: 0, y: 0 } };
      case "hide":
        return hideBehindCard();
      case "tunnel":
        return tunnelBehindCard();
      case "orbit": {
        const a = around[Math.floor(rand(0, around.length))];
        return { pos: safeClampSpot(a.x, a.y, mode.scale), layer: "front", peek: { x: 0, y: 0 } };
      }
      case "peek": {
        if (Math.random() < 0.5) {
          const edges = [
            { x: rand(24, vp.w - btnW - 24), y: -8 },
            { x: rand(24, vp.w - btnW - 24), y: vp.h - btnH + 8 },
            { x: -8, y: rand(24, vp.h - btnH - 24) },
            { x: vp.w - btnW + 8, y: rand(24, vp.h - btnH - 24) },
          ];
          const e = edges[Math.floor(rand(0, edges.length))];
          return { pos: safeClampSpot(e.x, e.y, mode.scale, { allowOff: true }), layer: "front", peek: { x: 0, y: 0 } };
        }
        return hideBehindCard();
      }
      case "slip": {
        const base = around[Math.floor(rand(0, around.length))];
        return { pos: safeClampSpot(base.x + rand(-18, 18), base.y + rand(-12, 12), mode.scale), layer: "front", peek: { x: 0, y: 0 } };
      }
      default: {
        if (isCoarse || Math.random() < 0.65) {
          const a = around[Math.floor(rand(0, around.length))];
          return { pos: safeClampSpot(a.x + rand(-14, 14), a.y + rand(-12, 12), mode.scale), layer: "front", peek: { x: 0, y: 0 } };
        }
        const p = randomAnywhere();
        return { pos: safeClampSpot(p.x, p.y, mode.scale), layer: "front", peek: { x: 0, y: 0 } };
      }
    }
  };

  // --- Hold-to-confirm logic (mobile friendly + forgiving) ---
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const holdPRef = useRef(0);
  const [holding, setHolding] = useState(false);
  const [holdP, setHoldP] = useState(0);

  const stopHold = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = 0;
    setHolding(false);
    setHoldP(0);
    holdPRef.current = 0;
  };

  const lastFleeRef = useRef(0);

  const moveNo = (kind = mode.behavior) => {
    const t = getNow();
    if (t < freezeUntil) return;
    if (catInBox) return; // if in box, movement is controlled by fish

    // trail at current spot
    setTrails((arr) =>
      [...arr, { id: `${t}-${Math.random().toString(16).slice(2)}`, x: pos.x + 14, y: pos.y + 30, t }].slice(-22)
    );

    const s = pickSpot(kind);
    setPos(s.pos);
    setNoLayer(s.layer);
    setPeekVec(s.peek);
    setTunnelTo(s.tunnelTo ?? null);
    setHideHint(s.hideHint);

    // fairness freeze window
    setFreezeUntil(t + 850);

    // Sometimes, if a box exists, the cat dives inside (throttled so it doesn't spam)
    if (
      boxVisible &&
      !catInBox &&
      !holding &&
      !isFrozen &&
      !isCalm &&
      noCount >= 3 &&
      t - lastBoxHideRef.current > 2600 &&
      Math.random() < 0.18
    ) {
      lastBoxHideRef.current = t;
      // delay slightly so it feels like a deliberate choice
      window.setTimeout(() => enterBox(), 120);
    }
  };

  // reposition when behavior changes or screen resizes
  useEffect(() => {
    moveNo(mode.behavior);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.behavior, vp.w, vp.h]);

  const confirmNo = () => {
    stopHold();
    setNoCount((n) => Math.min(n + 1, beats.length - 1));
    setAside("noted 😾");
    window.setTimeout(() => moveNo(), 70);
  };

  const beginHold = (e: any) => {
    if (holding) return;
    if (catInBox) return;

    try {
      if (e?.currentTarget?.setPointerCapture && typeof e.pointerId === "number") {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    setHolding(true);
    startRef.current = getNow();

    const tick = () => {
      const p = (getNow() - startRef.current) / mode.holdMs;
      const clamped = clamp(p, 0, 1);
      holdPRef.current = clamped;
      setHoldP(clamped);
      if (clamped >= 1) {
        confirmNo();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const endHold = () => {
    const p = holdPRef.current;
    if (p > 0 && p < 1) {
      if (p >= 0.75) setAside("SO CLOSE 😼 (just a bit longer)");
      else if (p >= 0.35) setAside("mmm… keep holding 😾");
      else if (!isFrozen && noCount >= 3 && !isCalm) {
        // instead of random teleport, it ducks behind the card like a cat
        moveNo("hide");
        setAside("*hides behind the card* 🐾");
      }
    }
    stopHold();
  };

  // Desktop fear aura: flee when cursor approaches (throttled)
  const holdingRef = useRef(false);
  useEffect(() => {
    holdingRef.current = holding;
  }, [holding]);

  useEffect(() => {
    if (!mode.fearAura) return;
    if (isFrozen || isCalm || holdingRef.current || catInBox) return;

    const { w: btnW, h: btnH } = measureBtn(mode.scale);
    const cx = pos.x + btnW / 2;
    const cy = pos.y + btnH / 2;
    const dist = Math.hypot(mouse.x - cx, mouse.y - cy);

    const radius = clamp(155 - noCount * 2.3, 95, 155);

    const t = getNow();
    const canFlee = t - lastFleeRef.current > 520;
    if (dist < radius && canFlee) {
      lastFleeRef.current = t;
      if (mode.behavior === "hide" || noLayer === "behind") moveNo("tunnel");
      else moveNo("random");
      setAside(noCount >= 8 ? "HISS! 🐾" : "skitter… 😼");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mouse.x, mouse.y, mode.fearAura, isFrozen, isCalm, pos.x, pos.y, noCount, mode.scale, noLayer, catInBox]);

  // Laser lure: while dragging (or calm), gently pull No toward laser
  useEffect(() => {
    if (!mode.lure) return;
    if (holding) return;
    if (isFrozen) return;
    if (catInBox) return;

    const { w: btnW, h: btnH } = measureBtn(mode.scale);
    const target = safeClampSpot(laser.x - btnW / 2, laser.y - btnH / 2, mode.scale, { allowOff: true });

    const d = Math.hypot(target.x - pos.x, target.y - pos.y);
    if (d > 18) {
      setPos(target);
      setNoLayer("front");
      setPeekVec({ x: 0, y: 0 });
      setTunnelTo(null);
      setHideHint(undefined);
      setFreezeUntil(getNow() + 420);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laser.x, laser.y, mode.lure, holding, isFrozen, catInBox]);

  // Enter the box: animate to box opening, then hide
  const enterBox = () => {
    if (!boxVisible) return;
    if (catInBox) return;
    if (holding) return;
    if (enteringBox) return;

    stopHold();

    const t = getNow();
    const { w: btnW, h: btnH } = measureBtn(mode.scale);

    // aim for the top opening of the box
    const mouth = safeClampSpot(boxPos.x + BOX_W / 2 - btnW / 2, boxPos.y + BOX_H * 0.38 - btnH / 2, mode.scale);

    setEnteringBox(true);
    setNoLayer("front");
    setHideHint(undefined);
    setTunnelTo(null);
    setPeekVec({ x: 0, y: 0 });
    setPos(mouth);
    setFreezeUntil(t + 950);
    setAside("*dives into the box* 📦");
    setBoxUntil(t + 14000);

    window.setTimeout(() => {
      setCatInBox(true);
      setEnteringBox(false);
      setFishFed(0);
      setAside("…it’s inside. throw fish 😼🐟");
      // keep the box alive while inside
      setBoxVisible(true);
      setBoxUntil(getNow() + 20000);
    }, 520);
  };

  const popOutOfBox = () => {
    const t = getNow();
    const { w: btnW, h: btnH } = measureBtn(mode.scale);

    // pop out near the front lip
    const out = safeClampSpot(boxPos.x + BOX_W * 0.58 - btnW / 2, boxPos.y + BOX_H * 0.08 - btnH / 2, mode.scale);

    setCatInBox(false);
    setEnteringBox(false);
    setFishFed(0);
    setNoLayer("front");
    setPeekVec({ x: 0, y: 0 });
    setTunnelTo(null);
    setHideHint(undefined);
    setPos(out);
    setFreezeUntil(t + 1100);
    setAside("*pops out* 😼 (caught me… maybe)");

    // After popping out, the box may linger a bit then disappear
    setBoxUntil(t + 9000);
  };

  const throwFish = (from: XY) => {
    if (!catInBox) {
      setAside("the fish is ignored (cat not in box) 🐟");
      return;
    }

    const t = getNow();
    const to = { x: boxCenter.x, y: boxCenter.y - 8 };
    const id = `${t}-${Math.random().toString(16).slice(2)}`;
    setShots((s) => [...s, { id, from, to, t }].slice(-14));
    setBoxUntil(t + 20000);
  };

  const onFishArrive = (id: string) => {
    setShots((s) => s.filter((x) => x.id !== id));
    setFishFed((n) => {
      const next = n + 1;
      if (next >= fishNeeded) {
        // tiny delay for drama
        window.setTimeout(() => popOutOfBox(), 260);
        return next;
      }
      setAside("munch… 😼");
      return next;
    });
  };

  const giveTreat = () => {
    const t = getNow();
    setCalmUntil(t + 5000);
    setAside("treat accepted 😽 (calm mode on)");
    stopHold();
    // calm mode: it comes out from behind to be nice
    if (noLayer === "behind") moveNo("near");
    // calm mode: if inside the box, a treat almost always works faster
    if (catInBox) {
      // simulate a fish toss
      throwFish({ x: vp.w * 0.5, y: vp.h - 40 });
      throwFish({ x: vp.w * 0.5 + 16, y: vp.h - 40 });
    }
  };

  const holdHint = `${Math.round(mode.holdMs / 100) / 10}s hold`;

  if (accepted) {
    return (
      <div className="min-h-screen min-h-dvh bg-pink-100 flex items-center justify-center p-4 sm:p-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md">
          <Card className="rounded-3xl shadow-lg bg-white">
            <CardContent className="p-6 sm:p-10 text-center">
              <Cat className="h-16 w-16 sm:h-20 sm:w-20 mx-auto text-pink-500" />
              <h1 className="text-3xl sm:text-4xl font-bold mt-4">YAYYYYY 💖</h1>
              <p className="mt-3 text-base sm:text-lg">You are now officially my Valentine 😽💘</p>
              <p className="mt-2 text-xs sm:text-sm text-slate-500">The cat is pleased. The cat is loved.</p>
              <div className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAccepted(false);
                    setNoCount(0);
                    setAside("");
                    setBoxVisible(false);
                    setCatInBox(false);
                    setFishFed(0);
                    setShots([]);
                  }}
                >
                  do it again 😼
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const moodBadge = (() => {
    if (noCount < 3) return { t: "Sweet", cls: "bg-pink-100 text-pink-700" };
    if (noCount < 5) return { t: "Sassy", cls: "bg-rose-100 text-rose-700" };
    if (noCount === 5) return { t: "RAGE", cls: "bg-red-100 text-red-700" };
    if (noCount < 10) return { t: "Sad", cls: "bg-indigo-50 text-indigo-700" };
    if (noCount < 15) return { t: "Bargaining", cls: "bg-amber-50 text-amber-700" };
    return { t: "Looping", cls: "bg-slate-100 text-slate-700" };
  })();

  // No button motion (paused while holding/frozen/calm/lure)
  const noAnim = (() => {
    if (holding || isFrozen || isCalm || mode.lure || enteringBox || catInBox) return { x: pos.x, y: pos.y, rotate: 0, scale: 1 };

    if (mode.behavior === "hide" && noLayer === "behind") {
      return {
        x: [pos.x, pos.x + peekVec.x, pos.x],
        y: [pos.y, pos.y + peekVec.y, pos.y],
        rotate: [0, -2, 2, 0],
        scale: 1,
      };
    }

    if (mode.behavior === "tunnel" && tunnelTo && noLayer === "behind") {
      return {
        x: [pos.x, tunnelTo.x, pos.x],
        y: [pos.y, tunnelTo.y, pos.y],
        rotate: [0, 1.5, -1.5, 0],
        scale: 1,
      };
    }

    if (mode.behavior === "peek") {
      return {
        x: [pos.x, pos.x + rand(-6, 6), pos.x],
        y: [pos.y, pos.y + rand(-6, 6), pos.y],
        rotate: [0, -2, 2, 0],
        scale: 1,
      };
    }

    if (mode.behavior === "slip") {
      return {
        x: [pos.x, pos.x + rand(-18, 18), pos.x + rand(-10, 10), pos.x],
        y: [pos.y, pos.y + rand(-12, 12), pos.y + rand(-8, 8), pos.y],
        rotate: [0, -3, 3, 0],
        scale: 1,
      };
    }

    if (mode.behavior === "rage") {
      return { x: pos.x, y: pos.y, rotate: [0, -10, 10, -10, 0], scale: 1 };
    }

    return { x: pos.x, y: pos.y, rotate: 0, scale: 1 };
  })();

  const noTransition =
    mode.behavior === "hide"
      ? { duration: 1.15, repeat: holding || isFrozen || isCalm ? 0 : Infinity, ease: "easeInOut" }
      : mode.behavior === "tunnel"
      ? { duration: 2.35, repeat: holding || isFrozen || isCalm ? 0 : Infinity, ease: "easeInOut" }
      : mode.behavior === "peek" || mode.behavior === "slip"
      ? { duration: mode.behavior === "peek" ? 1.25 : 1.85, repeat: holding || isFrozen || isCalm ? 0 : Infinity, ease: "easeInOut" }
      : mode.behavior === "rage"
      ? { type: "spring", stiffness: 520, damping: 22 }
      : { type: "spring", stiffness: 360, damping: 20 };

  const noZClass = noLayer === "behind" ? "z-20" : "z-50";

  const boxZClass = catInBox ? "z-60" : "z-25";

  return (
    <div
      className="min-h-screen min-h-dvh bg-gradient-to-br from-pink-50 to-rose-100 p-4 sm:p-6 overflow-hidden relative"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
      }}
    >
      {/* ambience - fewer paws on mobile for performance */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: isCoarse ? 5 : 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-base sm:text-xl opacity-20"
            initial={{ x: rand(0, vp.w), y: rand(0, vp.h), rotate: rand(-20, 20) }}
            animate={{ y: [rand(0, vp.h), rand(0, vp.h)] }}
            transition={{ duration: rand(6, 11), repeat: Infinity, ease: "easeInOut" }}
          >
            🐾
          </motion.div>
        ))}
      </div>

      {/* paw trail */}
      <div className="pointer-events-none fixed inset-0">
        {trails.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-sm sm:text-lg"
            style={{ left: p.x, top: p.y }}
            initial={{ opacity: 0.55, y: 0, rotate: rand(-12, 12) }}
            animate={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.95, ease: "easeOut" }}
          >
            🐾
          </motion.div>
        ))}
      </div>

      {/* fish shots */}
      <div className="pointer-events-none fixed inset-0 z-[80]">
        {shots.map((s) => (
          <motion.div
            key={s.id}
            className="absolute text-xl sm:text-2xl"
            initial={{ x: s.from.x, y: s.from.y, opacity: 0.95, rotate: rand(-20, 20), scale: 0.9 }}
            animate={{ x: s.to.x, y: s.to.y, opacity: 1, rotate: rand(180, 360), scale: 1.05 }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
            onAnimationComplete={() => onFishArrive(s.id)}
          >
            🐟
          </motion.div>
        ))}
      </div>

      <div className="min-h-[calc(100vh-2rem)] min-h-[calc(100dvh-2rem)] flex items-center justify-center px-2 sm:px-0">
        {/* IMPORTANT: give the card a higher z-index so the No button can hide behind it */}
        <Card ref={cardRef} className="relative z-30 rounded-3xl shadow-lg bg-white max-w-md w-full mx-auto">
          <CardContent className="p-4 sm:p-6 md:p-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              <Badge className={`${moodBadge.cls} text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5`}>{moodBadge.t}</Badge>
              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5">No: {noCount}/20</Badge>
              {isCalm && <Badge className="bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5">Calm 😽</Badge>}
              {canHover && mode.fearAura && !isCalm && !catInBox && <Badge className="bg-slate-100 text-slate-700 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 hidden sm:inline-flex">Fear aura 🫣</Badge>}
              {noLayer === "behind" && <Badge className="bg-slate-100 text-slate-700 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5">Hiding 🛋️</Badge>}
              {catInBox && <Badge className="bg-amber-50 text-amber-700 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5">Box 📦</Badge>}
            </div>

            <motion.div className="mt-3 sm:mt-4" animate={{ rotate: noCount >= 5 ? [0, -6, 6, -6, 0] : 0 }}>
              {noCount < 5 ? (
                <Cat className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 mx-auto text-pink-400" />
              ) : (
                <Angry className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 mx-auto text-red-500" />
              )}
            </motion.div>

            <h1 className="text-2xl sm:text-3xl font-bold mt-3">Will you be my Valentine?</h1>

            <AnimatePresence mode="wait">
              <motion.p
                key={noCount}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-2 sm:mt-3 text-base sm:text-lg ${noCount === 5 ? "text-red-600 font-bold" : ""}`}
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
                  className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-slate-500"
                >
                  {aside}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-4 sm:mt-6 grid gap-2 sm:gap-3">
              <Button onClick={() => setAccepted(true)} className="bg-pink-500 hover:bg-pink-600 w-full sm:w-auto sm:mx-auto min-h-[44px] text-sm sm:text-base">
                <Heart className="mr-2 h-4 w-4 flex-shrink-0" /> Yes 💖
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={giveTreat}
                  disabled={isCalm}
                  className="rounded-full min-h-[40px] text-sm sm:text-base"
                  title="Give a treat (calms the cat)"
                >
                  <Fish className="mr-1.5 sm:mr-2 h-4 w-4 flex-shrink-0" /> give treat
                </Button>
                <span className="text-[10px] sm:text-xs text-slate-500">(calms it for 5s)</span>
              </div>

              {/* fish throwing CTA when cat is inside the box */}
              <AnimatePresence>
                {catInBox && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-1"
                  >
                    <Button
                      onClick={() => throwFish({ x: vp.w * 0.5, y: vp.h - 48 })}
                      className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto sm:mx-auto min-h-[44px] text-sm sm:text-base"
                    >
                      <Fish className="mr-1.5 sm:mr-2 h-4 w-4 flex-shrink-0" /> throw fish ({Math.min(fishFed, fishNeeded)}/{fishNeeded})
                    </Button>
                    <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500">Or tap the box to throw fish at it.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500 leading-relaxed">
                The <span className="font-semibold">No</span> button is a skittish cat — it only registers if you <span className="font-semibold">press & hold</span>. ({holdHint})
              </p>

              <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed hidden sm:block">
                Bonus: drag the <span className="font-semibold">laser dot</span> to lure it 😼 (disabled while it's in the box)
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <Button variant="outline" onClick={() => spawnBox()} className="rounded-full min-h-[40px] text-sm sm:text-base" title="Spawn a random box">
                  📦 spawn box
                </Button>
                <span className="text-[10px] sm:text-xs text-slate-500">(random location)</span>
              </div>
            </div>

            <AnimatePresence>
              {noLayer === "behind" && hideHint && (
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-3 sm:mt-4 text-[10px] sm:text-[11px] text-slate-500">
                  {hideHint === "bottomCenter" ? "it's hiding under the card (near the buttons) 😼" : `it's hiding behind the card (${hideHint}) 😼`}
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* LASER POINTER (drag me) */}
      <motion.div
        className={`fixed left-0 top-0 z-40 ${catInBox ? "opacity-40" : "opacity-100"}`}
        style={{ x: laser.x, y: laser.y }}
        animate={{ x: laser.x, y: laser.y, scale: laserHeld ? 1.05 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
      >
        <div
          className="relative touch-none"
          onPointerDown={(e) => {
            if (catInBox) return; // fish-only while in box
            e.preventDefault();
            setLaserHeld(true);
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              // ignore
            }
            setLaser({ x: e.clientX, y: e.clientY });
            setAside("laser ON 🔴");
          }}
          onPointerMove={(e) => {
            if (!laserHeld) return;
            setLaser({ x: e.clientX, y: e.clientY });
          }}
          onPointerUp={() => {
            setLaserHeld(false);
            setAside("laser OFF");
          }}
          onPointerCancel={() => setLaserHeld(false)}
          aria-label="Laser pointer"
        >
          {/* Larger touch target for mobile (min 44x44) */}
          <div className="relative flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8">
            <motion.div
              className="h-5 w-5 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.65)]"
              animate={{ scale: laserHeld ? [1, 1.18, 1] : [1, 1.08, 1], opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="absolute -top-6 left-6 sm:left-4 text-[11px] text-slate-500 select-none whitespace-nowrap">
            <Sparkles className="inline h-3 w-3 mr-1" /> drag
          </div>
        </div>
      </motion.div>

      {/* RANDOM BOX */}
      <AnimatePresence>
        {boxVisible && (
          <motion.div
            className={`fixed left-0 top-0 ${boxZClass}`}
            style={{ x: boxPos.x, y: boxPos.y, width: BOX_W, height: BOX_H }}
            initial={{ opacity: 0, scale: 0.9, rotate: rand(-2, 2) }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: boxPos.y + 10 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            <div
              className="relative w-full h-full touch-none"
              onPointerDown={(e) => {
                e.preventDefault();
                // If the cat is inside, tapping the box throws fish at it
                if (catInBox) {
                  throwFish({ x: e.clientX, y: e.clientY });
                  return;
                }
                // If the cat is NOT inside, occasionally the tap scares it into the box (cute)
                if (!catInBox && !enteringBox && !holding && Math.random() < 0.35) {
                  setAside("box… suspicious 👀");
                  enterBox();
                }
              }}
              role="button"
              aria-label="Cardboard box"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (catInBox) throwFish({ x: boxCenter.x, y: boxCenter.y });
                  else enterBox();
                }
              }}
            >
              {/* box body */}
              <motion.div
                className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-amber-100 border border-amber-300 shadow-md"
                animate={catInBox ? { rotate: [0, -0.8, 0.8, 0] } : { rotate: 0 }}
                transition={{ duration: 0.9, repeat: catInBox ? Infinity : 0, ease: "easeInOut" }}
              />

              {/* flaps - scale with box */}
              <motion.div
                className="absolute left-2 right-2 sm:left-3 sm:right-3 top-1.5 sm:top-2 h-6 sm:h-8 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200"
                animate={catInBox ? { y: [0, -2, 0], rotate: [0, -2, 2, 0] } : { y: 0, rotate: 0 }}
                transition={{ duration: 0.8, repeat: catInBox ? Infinity : 0, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute left-4 right-4 sm:left-6 sm:right-6 top-7 sm:top-10 h-4 sm:h-5 rounded-lg sm:rounded-xl bg-amber-200/60"
                animate={catInBox ? { opacity: [0.8, 1, 0.8] } : { opacity: 0.65 }}
                transition={{ duration: 1.1, repeat: catInBox ? Infinity : 0, ease: "easeInOut" }}
              />

              {/* label - hide on very small boxes */}
              <div className="absolute left-2 sm:left-4 bottom-2 sm:bottom-3 text-[9px] sm:text-xs text-amber-900/70 select-none">
                {vp.w > 360 ? "cardboard box" : "box"}
              </div>
              {/* cat inside indicator */}
              <AnimatePresence>
                {catInBox && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute left-0 right-0 top-9 sm:top-12 text-center text-xs sm:text-sm select-none"
                  >
                    <span className="inline-block">👀</span>
                    <span className="ml-1 sm:ml-2 text-amber-900/70">
                      {Math.min(fishFed, fishNeeded)}/{fishNeeded}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* when not inside, show a little hint */}
              {!catInBox && (
                <div className="absolute right-2 sm:right-3 top-2 sm:top-3 text-[9px] sm:text-[11px] text-amber-900/60 select-none">
                  tap
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FREE-FLOATING NO BUTTON (hidden if catInBox) */}
      {!catInBox && (
        <motion.div
          className={`fixed left-0 top-0 ${noZClass}`}
          style={{ scale: mode.scale, opacity: mode.opacity }}
          animate={
            enteringBox
              ? { x: pos.x, y: pos.y, scale: [1, 0.92, 0.78], opacity: [1, 0.9, 0] }
              : (noAnim as any)
          }
          transition={
            enteringBox
              ? { duration: 0.55, ease: "easeInOut" }
              : (noTransition as any)
          }
        >
          <div
            className="relative touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              beginHold(e);
            }}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            role="button"
            aria-label="No button (press and hold to confirm)"
          >
            <Button
              variant="outline"
              className={`${
                noCount >= 5 ? "border-red-500 text-red-600" : "border-slate-300"
              } shadow-sm active:scale-[0.98] rounded-2xl px-6 py-7 sm:px-5 sm:py-6 text-base min-w-[120px] min-h-[48px]`}
            >
              {mode.label}
            </Button>

            {/* hold progress */}
            <div className="absolute left-0 right-0 -bottom-2 mx-auto w-[94%]">
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <motion.div
                  className={`h-full ${
                    noCount === 5
                      ? "bg-red-500"
                      : isCalm
                      ? "bg-emerald-500"
                      : "bg-pink-500"
                  }`}
                  style={{ width: `${Math.round(holdP * 100)}%` }}
                />
              </div>
            </div>

            {/* peek eyes */}
            <AnimatePresence>
              {noLayer === "behind" && !holding && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute -top-4 left-1 text-xs select-none"
                >
                  🐱‍👀
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}

              
