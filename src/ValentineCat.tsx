import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Star, Trophy } from "lucide-react";

// ============================================================================
// UTILITY FUNCTIONS & TYPES
// ============================================================================

function cn(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(" ");
}

const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand(0, arr.length))];
const now = () => performance.now();

// ============================================================================
// GAME SCENES & TYPES
// ============================================================================

type GameScene =
  | "title"
  | "intro_cutscene"
  | "chapter1_chase"
  | "chapter1_catch_no"
  | "chapter2_smash_hearts"
  | "chapter2_escape"
  | "chapter2_reject_letters"
  | "chapter3_boss_battle"
  | "chapter3_final"
  | "ending_good"
  | "ending_perfect"
  | "ending_friend";

type Achievement = {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  unlocked: boolean;
};

type DialogLine = {
  speaker: "cat" | "narrator" | "heart";
  text: string;
  emotion?: "happy" | "sad" | "angry" | "love" | "surprised" | "thinking";
};

// ============================================================================
// GAME DATA (STATIC - defined outside component to avoid recreation)
// ============================================================================

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_no", name: "Heartbreaker", desc: "Said no for the first time", emoji: "💔", unlocked: false },
  { id: "persistent", name: "Drama Survivor", desc: "Made it through all challenges", emoji: "🏃", unlocked: false },
  { id: "speedrun", name: "Speedrunner", desc: "Said yes within 5 seconds", emoji: "⚡", unlocked: false },
  { id: "rhythm_master", name: "Rhythm Master", desc: "Perfect score in rhythm game", emoji: "🎵", unlocked: false },
  { id: "puzzle_solver", name: "Big Brain", desc: "Solved the heart puzzle", emoji: "🧠", unlocked: false },
  { id: "true_love", name: "True Love", desc: "Got the perfect ending", emoji: "💖", unlocked: false },
  { id: "cat_whisperer", name: "Cat Whisperer", desc: "Pet the cat 20 times", emoji: "🐱", unlocked: false },
  { id: "secret", name: "???", desc: "Found the secret", emoji: "🔮", unlocked: false },
];

const INTRO_DIALOG: DialogLine[] = [
  { speaker: "narrator", text: "Once upon a time, in a world of hearts and dreams..." },
  { speaker: "narrator", text: "There lived a very dramatic cat." },
  { speaker: "cat", text: "meow~ 😺", emotion: "happy" },
  { speaker: "narrator", text: "This cat had ONE very important question..." },
  { speaker: "cat", text: "Will you be my Valentine? 💕", emotion: "love" },
  { speaker: "narrator", text: "But getting your answer... won't be easy." },
  { speaker: "cat", text: "I have PREPARED. 😼", emotion: "thinking" },
  { speaker: "narrator", text: "And so begins... THE VALENTINE'S QUEST!" },
];

const CHAPTER_TITLES = {
  chapter1_catch_no: { num: 1, title: "Catch the NO!", subtitle: "Spell out your rejection!" },
  chapter2_smash_hearts: { num: 2, title: "Smash the Hearts!", subtitle: "Destroy the decorations!" },
  chapter2_escape: { num: 2, title: "Dodge the Love!", subtitle: "Avoid the cat's attacks!" },
  chapter2_reject_letters: { num: 2, title: "Reject the Letters!", subtitle: "Tear them all up!" },
  chapter3_boss_battle: { num: "👑", title: "FINAL BOSS", subtitle: "The cat won't give up!" },
  chapter3_final: { num: 3, title: "Final Decision", subtitle: "The moment of truth" },
} as const;

const CAT_EMOTIONS = {
  happy: "😺",
  sad: "😿",
  angry: "😾",
  love: "😻",
  surprised: "🙀",
  thinking: "😼",
  cry: "😹",
  sleepy: "😴",
} as const;

const NO_REACTIONS = [
  { text: "Wait... did you just... 😺", emotion: "surprised" },
  { text: "THE AUDACITY! 😾", emotion: "angry" },
  { text: "*plays tiny violin* 😿", emotion: "sad" },
  { text: "I'M LITERALLY A CAT. HOW COULD YOU?! 🙀", emotion: "surprised" },
  { text: "Fine. I didn't want your love ANYWAY. 😾", emotion: "angry" },
  { text: "*dramatically collapses* 😿", emotion: "sad" },
  { text: "My therapist will hear about this. 😼", emotion: "thinking" },
  { text: "💔 *sad meow noises* 💔", emotion: "sad" },
  { text: "Et tu, human? ET TU?! 😾", emotion: "angry" },
  { text: "I'm writing you out of my will. 😿", emotion: "sad" },
  { text: "*aggressively knocks things off table* 😾", emotion: "angry" },
  { text: "You'll regret this when I'm famous. 😼", emotion: "thinking" },
] as const;

// Static game data for mini-games
const CAT_TAUNTS_CATCH = ["Nice try! 😼", "You can't spell NO! 😹", "BLOCKED! 💕", "Too slow! 😸", "Love conquers all! 😻"];
const CAT_CRIES_SMASH = ["MY DECORATIONS! 😿", "STOP IT! 😾", "I worked so hard! 😿", "NOOOO! 🙀", "You're so MEAN! 😿", "Why are you like this?! 😾"];
const LETTER_TEXTS = ["I love you! 💕", "Be mine! 💖", "XOXO 😘", "Forever yours 💗", "My heart is yours 💝", "You're purrfect! 😻"];
const CAT_CRIES_LETTERS = ["MY LOVE LETTER! 😿", "I spent HOURS on that! 😾", "You're so COLD! 💔", "WHYYY?! 🙀", "*dramatic sobbing* 😿"];
const DRAMATIC_LINES = ["Why don't you LOVE ME?! 😾", "*knocks your stuff off table* 😼", "I'm being IGNORED! 🙀", "This is my FINAL FORM! 😾", "*judges you silently* 😿", "You'll REGRET this! 😾"];
const LOVE_COMPLIMENTS = ["You're purrfect! 💕", "So fluffy! ✨", "Best cat! 💖", "Love you! 😻", "Cutest! 🌟"];

// ============================================================================
// COMPONENTS
// ============================================================================

const Card = memo(React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-2xl border bg-white shadow-lg", className)} {...props}>
      {children}
    </div>
  )
));
Card.displayName = "Card";

const Button = memo(function Button({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "pink" | "gold";
  size?: "default" | "sm" | "lg" | "xl";
}) {
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border-2 border-slate-200 bg-white/80 hover:bg-white text-slate-900",
    ghost: "bg-transparent hover:bg-slate-100",
    pink: "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/30",
    gold: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white hover:from-amber-500 hover:to-yellow-600 shadow-lg shadow-amber-500/30",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    default: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
    xl: "px-8 py-4 text-lg rounded-2xl font-bold",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all active:scale-95 disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

// Optimized Particles - Pure CSS animations, minimal JS
const Particles = memo(function Particles({ emojis, count = 20 }: { emojis: string[]; count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: Math.min(count, 15) }).map((_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: (i * 100 / Math.min(count, 15)) + rand(-5, 5),
      delay: i * 0.4,
      duration: rand(8, 14),
    })), [emojis, count]);

  return (
    <>
      <style>{`
        @keyframes particle-fall {
          0% { transform: translateY(-5vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
        }
        .particle {
          will-change: transform, opacity;
          contain: strict;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle absolute text-xl"
            style={{
              left: `${p.x}%`,
              animation: `particle-fall ${p.duration}s linear ${p.delay}s infinite`,
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>
    </>
  );
});

const TypeWriter = memo(function TypeWriter({ text, speed = 50, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
        setTimeout(tick, speed);
      } else {
        setDone(true);
        onCompleteRef.current?.();
      }
    };

    setTimeout(tick, speed);

    return () => { cancelled = true; };
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
});

const DialogBox = memo(function DialogBox({ line, onNext }: { line: DialogLine; onNext: () => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [line.text]);

  const bgColors = {
    cat: "from-pink-100 to-rose-100 border-pink-300",
    narrator: "from-slate-100 to-slate-200 border-slate-300",
    heart: "from-red-100 to-pink-100 border-red-300",
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className={cn("rounded-2xl border-2 p-6 bg-gradient-to-br shadow-xl", bgColors[line.speaker])}>
        {line.speaker === "cat" && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{CAT_EMOTIONS[line.emotion || "happy"]}</span>
            <span className="font-bold text-pink-700">Cat</span>
          </div>
        )}
        {line.speaker === "narrator" && (
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-6 h-6 text-amber-500" />
            <span className="font-bold text-slate-700 italic">Narrator</span>
          </div>
        )}
        <p className="text-lg leading-relaxed">
          <TypeWriter text={line.text} speed={40} onComplete={() => setReady(true)} />
        </p>
        {ready && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-right"
          >
            <Button variant="outline" size="sm" onClick={onNext}>
              Continue →
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

const ChapterTitle = memo(function ChapterTitle({ chapter, onComplete }: { chapter: keyof typeof CHAPTER_TITLES; onComplete: () => void }) {
  const data = CHAPTER_TITLES[chapter];

  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-center text-white">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="text-6xl mb-4"
        >
          {typeof data.num === "number" ? `Chapter ${data.num}` : data.num}
        </motion.div>
        <motion.h1
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-bold mb-2"
        >
          {data.title}
        </motion.h1>
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xl text-slate-400"
        >
          {data.subtitle}
        </motion.p>
      </div>
    </motion.div>
  );
});

const AchievementPopup = memo(function AchievementPopup({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed top-4 right-4 z-[200]"
    >
      <div className="bg-gradient-to-r from-amber-400 to-yellow-500 rounded-2xl p-4 shadow-2xl text-white min-w-[280px]">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{achievement.emoji}</div>
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Achievement Unlocked!</span>
            </div>
            <div className="font-bold text-lg">{achievement.name}</div>
            <div className="text-sm text-amber-100">{achievement.desc}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const CatSprite = memo(function CatSprite({ emotion = "happy", size = "md", className, animate = false }: { emotion?: keyof typeof CAT_EMOTIONS; size?: "sm" | "md" | "lg" | "xl"; className?: string; animate?: boolean }) {
  const sizes = { sm: "text-4xl", md: "text-6xl", lg: "text-8xl", xl: "text-[120px]" };
  if (animate) {
    return (
      <motion.div
        className={cn(sizes[size], className)}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {CAT_EMOTIONS[emotion]}
      </motion.div>
    );
  }
  return <div className={cn(sizes[size], className)}>{CAT_EMOTIONS[emotion]}</div>;
});

// ============================================================================
// MINI-GAMES - Optimized with requestAnimationFrame
// ============================================================================

// Game 1: CATCH THE NO - Enhanced with better UX, animations, and game dynamics
const CatchTheNoGame = memo(function CatchTheNoGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "done">("tutorial");
  const [noLetters, setNoLetters] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [items, setItems] = useState<Array<{
    id: number;
    x: number;
    y: number;
    type: "N" | "O" | "heart" | "star";
    speed: number;
    rotation: number;
    scale: number;
    caught?: boolean;
  }>>([]);
  const [catMessage, setCatMessage] = useState("");
  const [basketX, setBasketX] = useState(50);
  const [combo, setCombo] = useState(0);
  const [lastCatch, setLastCatch] = useState<{ x: number; y: number; type: string } | null>(null);
  const [countdownNum, setCountdownNum] = useState(3);
  const [screenShake, setScreenShake] = useState(false);
  const [catEmotion, setCatEmotion] = useState<"happy" | "angry" | "worried">("happy");

  // Refs for RAF loop
  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const noRef = useRef(0);
  const basketXRef = useRef(50);
  const comboRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const rafRef = useRef<number>(0);
  const difficultyRef = useRef(1);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { noRef.current = noLetters; }, [noLetters]);
  useEffect(() => { basketXRef.current = basketX; }, [basketX]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // Update cat emotion based on player progress
  useEffect(() => {
    if (noLetters >= 4) setCatEmotion("worried");
    else if (noLetters >= 2) setCatEmotion("angry");
    else setCatEmotion("happy");
  }, [noLetters]);

  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      gameEndedRef.current = false;
      setNoLetters(0);
      noRef.current = 0;
      setTimeLeft(20);
      setItems([]);
      setCatMessage("");
      setCombo(0);
      comboRef.current = 0;
      lastSpawnRef.current = performance.now();
      difficultyRef.current = 1;
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdownNum(c => c - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, countdownNum]);

  // Timer with difficulty scaling
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        // Increase difficulty over time
        difficultyRef.current = 1 + (20 - t) * 0.03;

        if (t <= 1) {
          clearInterval(timer);
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setPhase("done");
            setTimeout(() => onCompleteRef.current(noRef.current), 2000);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Main game loop with RAF - SLOWER falling speed
  useEffect(() => {
    if (phase !== "playing") return;

    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      if (gameEndedRef.current) return;

      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Spawn new items - slower spawn rate (900ms base)
      const spawnInterval = Math.max(600, 900 - difficultyRef.current * 50);
      if (currentTime - lastSpawnRef.current > spawnInterval) {
        lastSpawnRef.current = currentTime;
        const randVal = Math.random();
        // Better distribution: 35% N, 35% O, 25% heart, 5% star (bonus)
        let type: "N" | "O" | "heart" | "star";
        if (randVal < 0.35) type = "N";
        else if (randVal < 0.70) type = "O";
        else if (randVal < 0.95) type = "heart";
        else type = "star"; // Bonus item!

        const newItem = {
          id: currentTime + Math.random(),
          x: 8 + Math.random() * 84,
          y: -8,
          type,
          // MUCH SLOWER base speed: 0.6-1.2 instead of 2-4
          speed: (0.6 + Math.random() * 0.6) * difficultyRef.current,
          rotation: Math.random() * 360,
          scale: type === "star" ? 1.2 : (0.9 + Math.random() * 0.3),
        };
        setItems(prev => [...prev.slice(-10), newItem]);
      }

      // Move items - SLOWER movement (30fps feel instead of 60fps)
      setItems(prev => {
        const updated = prev.map(item => ({
          ...item,
          y: item.y + item.speed * deltaTime * 30, // Changed from 60 to 30 for slower fall
          rotation: item.rotation + (item.type === "heart" ? 2 : 1) * deltaTime * 60,
        }));

        // Check catches with better hitbox
        updated.forEach(item => {
          if (item.caught) return;
          if (item.y >= 72 && item.y <= 88) {
            const dist = Math.abs(item.x - basketXRef.current);
            if (dist < 12) {
              if (item.type === "heart") {
                // Heart caught - bad!
                setCombo(0);
                comboRef.current = 0;
                setScreenShake(true);
                setTimeout(() => setScreenShake(false), 300);
                setCatMessage(CAT_TAUNTS_CATCH[Math.floor(Math.random() * CAT_TAUNTS_CATCH.length)]);
                setTimeout(() => setCatMessage(""), 1200);
              } else if (item.type === "star") {
                // Star bonus - adds 2 letters!
                setNoLetters(n => Math.min(n + 2, 10));
                setCombo(c => c + 1);
                comboRef.current += 1;
                setLastCatch({ x: item.x, y: item.y, type: "star" });
                setTimeout(() => setLastCatch(null), 600);
              } else {
                // N or O caught - good!
                setNoLetters(n => n + 1);
                setCombo(c => c + 1);
                comboRef.current += 1;
                setLastCatch({ x: item.x, y: item.y, type: item.type });
                setTimeout(() => setLastCatch(null), 600);
              }
              item.caught = true;
            }
          }
        });

        return updated.filter(item => item.y < 105 && !item.caught);
      });

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // Smooth basket movement with lerp interpolation
  const targetBasketXRef = useRef(50);
  const smoothRafRef = useRef<number>(0);

  useEffect(() => {
    if (phase !== "playing") return;

    let animating = true;
    const smoothMove = () => {
      if (!animating) return;
      setBasketX(prev => {
        const diff = targetBasketXRef.current - prev;
        // Smooth interpolation - move 30% of the distance each frame for responsive feel
        if (Math.abs(diff) < 0.3) return targetBasketXRef.current;
        return prev + diff * 0.3;
      });
      smoothRafRef.current = requestAnimationFrame(smoothMove);
    };
    smoothRafRef.current = requestAnimationFrame(smoothMove);
    return () => {
      animating = false;
      cancelAnimationFrame(smoothRafRef.current);
    };
  }, [phase]);

  const handleMove = useCallback((clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    targetBasketXRef.current = Math.max(8, Math.min(92, x));
  }, []);

  // Tutorial screen with better styling
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl opacity-20"
              initial={{ y: "110vh", x: `${Math.random() * 100}%` }}
              animate={{ y: "-10vh" }}
              transition={{ duration: 8 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5 }}
            >
              {["N", "O", "💕", "✨"][i % 4]}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm text-center shadow-2xl border border-white/20 relative z-10"
        >
          <motion.div
            className="text-7xl mb-4"
            animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🚫
          </motion.div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Catch the NO!
          </h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Catch the falling <span className="font-bold text-red-500 text-lg">N</span> and <span className="font-bold text-red-500 text-lg">O</span> letters to spell your rejection!
          </p>

          <div className="flex justify-center gap-6 my-6">
            <motion.div
              className="text-center bg-green-50 rounded-2xl p-4 border-2 border-green-200"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-4xl font-black text-red-500 drop-shadow-lg">N O</div>
              <div className="text-xs text-green-600 font-bold mt-2">✓ CATCH!</div>
            </motion.div>
            <motion.div
              className="text-center bg-red-50 rounded-2xl p-4 border-2 border-red-200"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-4xl">💕</div>
              <div className="text-xs text-red-600 font-bold mt-2">✗ AVOID!</div>
            </motion.div>
            <motion.div
              className="text-center bg-yellow-50 rounded-2xl p-4 border-2 border-yellow-200"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-4xl">⭐</div>
              <div className="text-xs text-amber-600 font-bold mt-2">★ BONUS!</div>
            </motion.div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-3 mb-6">
            <p className="text-indigo-600 text-sm">
              👆 <span className="font-semibold">Slide your finger</span> to move the basket!
            </p>
          </div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white rounded-2xl font-bold text-xl shadow-xl relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-white/20"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            />
            <span className="relative">Start Game! 🎮</span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown screen
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex items-center justify-center">
        <motion.div
          key={countdownNum}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 2, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="text-[150px] font-black text-white drop-shadow-2xl"
        >
          {countdownNum || "GO!"}
        </motion.div>
      </div>
    );
  }

  // Done screen with better styling
  if (phase === "done") {
    const won = noLetters >= 5;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm text-center shadow-2xl"
        >
          <motion.div
            className="text-8xl mb-4"
            animate={won ? { rotate: [0, -10, 10, 0] } : { y: [0, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {won ? "😾" : "😹"}
          </motion.div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            {won ? "You spelled NO!" : "Cat blocked you!"}
          </h2>
          <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
            <p className="text-4xl font-black text-indigo-600">{noLetters}</p>
            <p className="text-indigo-400 text-sm">letters caught</p>
          </div>
          <motion.p
            className="text-slate-600 italic text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {won ? '"Fine, but I\'m not giving up!" 😾' : '"You can\'t reject ME!" 😹'}
          </motion.p>
          <motion.p
            className="text-indigo-400 mt-4 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Loading next challenge...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Main game screen with enhanced visuals
  return (
    <motion.div
      className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 overflow-hidden select-none touch-none"
      animate={screenShake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.3 }}
      onMouseMove={(e) => handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect()); }}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      </div>

      {/* Header with improved styling */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-3 z-10 px-4">
        <motion.div
          className="bg-white/95 backdrop-blur rounded-2xl px-5 py-3 shadow-xl flex items-center gap-2"
          animate={noLetters > 0 ? { scale: [1, 1.05, 1] } : {}}
        >
          <span className="text-2xl">📝</span>
          <span className="text-xl font-black text-indigo-600">{noLetters}/5</span>
        </motion.div>
        <motion.div
          className={cn(
            "backdrop-blur rounded-2xl px-5 py-3 shadow-xl flex items-center gap-2",
            timeLeft <= 5 ? "bg-red-100/95" : "bg-white/95"
          )}
          animate={timeLeft <= 5 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: timeLeft <= 5 ? Infinity : 0 }}
        >
          <span className="text-2xl">⏱️</span>
          <span className={cn("text-xl font-black", timeLeft <= 5 ? "text-red-600" : "text-indigo-600")}>
            {timeLeft}s
          </span>
        </motion.div>
        {combo >= 2 && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl px-4 py-3 shadow-xl"
          >
            <span className="text-xl font-black text-white">x{combo} 🔥</span>
          </motion.div>
        )}
      </div>

      {/* Cat with emotions */}
      <motion.div
        className="absolute top-24 left-1/2 -translate-x-1/2 text-center z-20"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <motion.div
          className="text-6xl mb-2 drop-shadow-lg"
          animate={catEmotion === "worried" ? { rotate: [0, -5, 5, 0] } : {}}
          transition={{ duration: 0.5, repeat: catEmotion === "worried" ? Infinity : 0 }}
        >
          {catEmotion === "happy" ? "😼" : catEmotion === "angry" ? "😾" : "🙀"}
        </motion.div>
        <AnimatePresence>
          {catMessage && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: -10 }}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2 rounded-full font-bold shadow-xl text-sm"
            >
              {catMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Skip button */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(noLetters);
          }
        }}
        className="absolute top-4 right-4 bg-white/30 backdrop-blur rounded-full px-4 py-2 text-white/80 text-sm z-10 hover:bg-white/40 transition-colors"
      >
        Skip →
      </button>

      {/* Catch effect */}
      <AnimatePresence>
        {lastCatch && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            className="absolute pointer-events-none z-30"
            style={{ left: `${lastCatch.x}%`, top: `${lastCatch.y}%` }}
          >
            <div className={cn(
              "text-4xl font-black",
              lastCatch.type === "star" ? "text-yellow-300" : "text-green-400"
            )}>
              {lastCatch.type === "star" ? "+2! ⭐" : "+1!"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Falling items with enhanced visuals */}
      {items.map(item => (
        <motion.div
          key={item.id}
          className="absolute pointer-events-none"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
            willChange: "top, transform",
          }}
          initial={{ scale: 0 }}
          animate={{ scale: item.scale }}
          transition={{ duration: 0.2 }}
        >
          {item.type === "heart" ? (
            <span className="text-5xl drop-shadow-lg filter">💕</span>
          ) : item.type === "star" ? (
            <motion.span
              className="text-5xl drop-shadow-lg"
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ⭐
            </motion.span>
          ) : (
            <span className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] [text-shadow:_2px_2px_0_rgb(185_28_28)]">
              {item.type}
            </span>
          )}
        </motion.div>
      ))}

      {/* Basket with glow effect */}
      <motion.div
        className="absolute bottom-24"
        style={{
          left: `${basketX}%`,
          transform: "translateX(-50%)",
          willChange: "left",
        }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-amber-400/30 blur-xl rounded-full scale-150" />
          <span className="text-6xl drop-shadow-lg relative">🧺</span>
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="absolute bottom-8 left-4 right-4 z-10">
        <div className="bg-white/20 backdrop-blur rounded-full p-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 h-3 rounded-full transition-all duration-300",
                  i < noLetters
                    ? "bg-gradient-to-r from-green-400 to-emerald-500"
                    : "bg-white/20"
                )}
                animate={i < noLetters ? { scale: [1, 1.1, 1] } : {}}
              />
            ))}
          </div>
        </div>
        <p className="text-white/60 text-sm mt-2 text-center">
          {noLetters < 5 ? `Collect ${5 - noLetters} more to spell "NO"!` : "You spelled NO! 🎉"}
        </p>
      </div>
    </motion.div>
  );
});

// Game 2: SMASH THE HEARTS - Complete redesign with grid, animations, and better mechanics
const SmashTheHeartsGame = memo(function SmashTheHeartsGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "done">("tutorial");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [countdownNum, setCountdownNum] = useState(3);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  // Grid of hearts - 4x5 grid with different types
  const [hearts, setHearts] = useState<Array<{
    id: number;
    row: number;
    col: number;
    type: "pink" | "red" | "gold" | "cat" | "bomb";
    smashed: boolean;
    shaking: boolean;
  }>>([]);

  // Smash particles for effects
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    emoji: string;
    color: string;
  }>>([]);

  // Cat state
  const [catReaction, setCatReaction] = useState("");
  const [catEmotion, setCatEmotion] = useState<"happy" | "sad" | "angry" | "shocked">("happy");
  const [screenShake, setScreenShake] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Generate initial heart grid
  const generateHearts = useCallback(() => {
    const newHearts: typeof hearts = [];
    let id = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const rand = Math.random();
        let type: "pink" | "red" | "gold" | "cat" | "bomb";
        if (rand < 0.50) type = "pink";      // 50% pink hearts (+10)
        else if (rand < 0.75) type = "red";  // 25% red hearts (+15)
        else if (rand < 0.85) type = "gold"; // 10% gold hearts (+25)
        else if (rand < 0.92) type = "cat";  // 7% cat (don't hit!)
        else type = "bomb";                   // 8% bomb (clears row!)

        newHearts.push({
          id: id++,
          row,
          col,
          type,
          smashed: false,
          shaking: false,
        });
      }
    }
    return newHearts;
  }, []);

  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      gameEndedRef.current = false;
      setScore(0);
      scoreRef.current = 0;
      setTimeLeft(15);
      setCombo(0);
      setMaxCombo(0);
      setHearts(generateHearts());
      setParticles([]);
      setCatReaction("");
      setCatEmotion("happy");
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdownNum(c => c - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, countdownNum, generateHearts]);

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setPhase("done");
            setTimeout(() => onCompleteRef.current(scoreRef.current), 2000);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Respawn hearts periodically
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setHearts(prev => {
        const smashed = prev.filter(h => h.smashed);
        if (smashed.length < 3) return prev;

        // Respawn some smashed hearts
        return prev.map(h => {
          if (h.smashed && Math.random() < 0.3) {
            const rand = Math.random();
            let type: "pink" | "red" | "gold" | "cat" | "bomb";
            if (rand < 0.50) type = "pink";
            else if (rand < 0.75) type = "red";
            else if (rand < 0.85) type = "gold";
            else if (rand < 0.92) type = "cat";
            else type = "bomb";
            return { ...h, type, smashed: false, shaking: false };
          }
          return h;
        });
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  // Update cat emotion based on score
  useEffect(() => {
    if (score >= 150) setCatEmotion("shocked");
    else if (score >= 100) setCatEmotion("sad");
    else if (score >= 50) setCatEmotion("angry");
    else setCatEmotion("happy");
  }, [score]);

  // Create smash particles
  const createParticles = useCallback((x: number, y: number, type: string) => {
    const emojis = type === "gold" ? ["⭐", "✨", "💫", "🌟"] :
                   type === "bomb" ? ["💥", "🔥", "💨", "⚡"] :
                   ["💔", "💢", "✨", "❌"];
    const colors = type === "gold" ? "text-yellow-400" :
                   type === "bomb" ? "text-orange-500" : "text-pink-400";

    const newParticles = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 60,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      color: colors,
    }));

    setParticles(prev => [...prev.slice(-20), ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 600);
  }, []);

  const smashHeart = useCallback((heart: typeof hearts[0], event: React.MouseEvent | React.TouchEvent) => {
    if (heart.smashed || gameEndedRef.current) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    if (heart.type === "cat") {
      // Hit the cat - bad!
      setScore(s => Math.max(0, s - 30));
      setCombo(0);
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 300);
      setCatReaction("OW! That's ME! 😾💢");
      setTimeout(() => setCatReaction(""), 1200);
      // Make cat shake instead of disappear
      setHearts(prev => prev.map(h => h.id === heart.id ? { ...h, shaking: true } : h));
      setTimeout(() => {
        setHearts(prev => prev.map(h => h.id === heart.id ? { ...h, shaking: false } : h));
      }, 500);
    } else if (heart.type === "bomb") {
      // Bomb - clears entire row!
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 200);
      createParticles(x, y, "bomb");

      const rowHearts = hearts.filter(h => h.row === heart.row && !h.smashed && h.type !== "cat");
      let bonusScore = 0;
      rowHearts.forEach(h => {
        if (h.type === "pink") bonusScore += 10;
        else if (h.type === "red") bonusScore += 15;
        else if (h.type === "gold") bonusScore += 25;
        else if (h.type === "bomb") bonusScore += 5;
      });

      setScore(s => s + bonusScore + 20);
      setCombo(c => {
        const newCombo = c + rowHearts.length;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setCatReaction(`BOOM! ${rowHearts.length} hearts! 💥🙀`);
      setTimeout(() => setCatReaction(""), 1000);

      setHearts(prev => prev.map(h =>
        h.row === heart.row && h.type !== "cat" ? { ...h, smashed: true } : h
      ));
    } else {
      // Regular heart smash
      const points = heart.type === "gold" ? 25 : heart.type === "red" ? 15 : 10;
      const comboBonus = Math.floor(combo / 3) * 5;

      setScore(s => s + points + comboBonus);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });

      createParticles(x, y, heart.type);

      if (heart.type === "gold") {
        setCatReaction("NOT MY GOLDEN HEART! 😭✨");
      } else {
        setCatReaction(CAT_CRIES_SMASH[Math.floor(Math.random() * CAT_CRIES_SMASH.length)]);
      }
      setTimeout(() => setCatReaction(""), 800);

      setHearts(prev => prev.map(h => h.id === heart.id ? { ...h, smashed: true } : h));
    }
  }, [combo, hearts, createParticles]);

  // Tutorial screen
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Background hearts */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-4xl"
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: [0, 1, 0], rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
              style={{ left: `${10 + (i % 5) * 20}%`, top: `${10 + Math.floor(i / 5) * 30}%` }}
            >
              💕
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm text-center shadow-2xl relative z-10"
        >
          <motion.div
            className="text-7xl mb-4"
            animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            💔
          </motion.div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-3">
            Smash the Hearts!
          </h2>
          <p className="text-slate-600 mb-4">
            The cat covered everything with hearts!<br/>
            <span className="font-bold text-red-500">TAP to SMASH them!</span>
          </p>

          <div className="grid grid-cols-5 gap-2 my-4 text-center">
            <div className="bg-pink-50 rounded-xl p-2">
              <div className="text-2xl">💕</div>
              <div className="text-[10px] text-pink-600 font-bold">+10</div>
            </div>
            <div className="bg-red-50 rounded-xl p-2">
              <div className="text-2xl">❤️</div>
              <div className="text-[10px] text-red-600 font-bold">+15</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-2">
              <div className="text-2xl">💛</div>
              <div className="text-[10px] text-amber-600 font-bold">+25</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-2">
              <div className="text-2xl">💣</div>
              <div className="text-[10px] text-orange-600 font-bold">ROW!</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2">
              <div className="text-2xl">😺</div>
              <div className="text-[10px] text-slate-600 font-bold">-30!</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 mb-4">
            <p className="text-amber-700 text-sm font-medium">
              🔥 Build combos for bonus points!
            </p>
          </div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              Start Smashing! 👊
            </motion.span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex items-center justify-center">
        <motion.div
          key={countdownNum}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="text-[150px] font-black text-white drop-shadow-2xl"
        >
          {countdownNum || "SMASH!"}
        </motion.div>
      </div>
    );
  }

  // Done screen
  if (phase === "done") {
    const won = score >= 80;
    const smashedCount = hearts.filter(h => h.smashed).length;

    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm text-center shadow-2xl"
        >
          <motion.div
            className="text-8xl mb-4"
            animate={won ? { rotate: [0, -15, 15, 0] } : { y: [0, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {won ? "💔" : "😿"}
          </motion.div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-3">
            {won ? "Hearts Destroyed!" : "Cat Protected Them!"}
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-50 rounded-2xl p-3">
              <p className="text-3xl font-black text-red-600">{score}</p>
              <p className="text-red-400 text-xs">points</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-3">
              <p className="text-3xl font-black text-orange-600">x{maxCombo}</p>
              <p className="text-orange-400 text-xs">max combo</p>
            </div>
          </div>

          <div className="bg-pink-50 rounded-xl p-3 mb-4">
            <p className="text-pink-600 text-sm">
              💔 {smashedCount} hearts smashed
            </p>
          </div>

          <motion.p
            className="text-slate-600 italic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {won ? '"My beautiful decorations... 😿"' : '"Ha! You missed! 😹"'}
          </motion.p>
          <motion.p
            className="text-red-400 mt-4 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Loading next challenge...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Main game screen
  return (
    <motion.div
      className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 overflow-hidden select-none"
      animate={screenShake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }} />
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-3 z-20 px-4">
        <motion.div
          className="bg-white/95 backdrop-blur rounded-2xl px-5 py-3 shadow-xl flex items-center gap-2"
          animate={score > 0 ? { scale: [1, 1.05, 1] } : {}}
        >
          <span className="text-2xl">💯</span>
          <span className="text-xl font-black text-red-600">{score}</span>
        </motion.div>
        <motion.div
          className={cn(
            "backdrop-blur rounded-2xl px-5 py-3 shadow-xl flex items-center gap-2",
            timeLeft <= 5 ? "bg-red-100/95" : "bg-white/95"
          )}
          animate={timeLeft <= 5 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: timeLeft <= 5 ? Infinity : 0 }}
        >
          <span className="text-2xl">⏱️</span>
          <span className={cn("text-xl font-black", timeLeft <= 5 ? "text-red-600" : "text-pink-600")}>
            {timeLeft}s
          </span>
        </motion.div>
        {combo >= 3 && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl px-4 py-3 shadow-xl"
          >
            <span className="text-xl font-black text-white">x{combo} 🔥</span>
          </motion.div>
        )}
      </div>

      {/* Cat with reactions */}
      <motion.div
        className="absolute top-20 left-1/2 -translate-x-1/2 text-center z-20"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <motion.div
          className="text-5xl mb-1"
          animate={catEmotion === "shocked" ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
          transition={{ duration: 0.3, repeat: catEmotion === "shocked" ? Infinity : 0 }}
        >
          {catEmotion === "happy" ? "😼" : catEmotion === "angry" ? "😾" : catEmotion === "sad" ? "😿" : "🙀"}
        </motion.div>
        <AnimatePresence>
          {catReaction && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: -10 }}
              className="bg-white/95 text-red-600 px-4 py-2 rounded-full font-bold shadow-xl text-sm whitespace-nowrap"
            >
              {catReaction}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Skip button */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/30 backdrop-blur rounded-full px-4 py-2 text-white/80 text-sm z-20"
      >
        Skip →
      </button>

      {/* Smash particles */}
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 0, opacity: 0, y: -50 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={cn("absolute text-2xl pointer-events-none z-30", p.color)}
            style={{ left: p.x, top: p.y }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Hearts grid */}
      <div className="absolute inset-0 flex items-center justify-center pt-32 pb-20">
        <div className="grid grid-cols-5 gap-3 p-4">
          {hearts.map(heart => (
            <motion.button
              key={heart.id}
              onClick={(e) => smashHeart(heart, e)}
              disabled={heart.smashed}
              className={cn(
                "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl transition-all",
                heart.smashed ? "opacity-0 scale-0" : "shadow-lg active:scale-90",
                heart.type === "pink" && !heart.smashed && "bg-pink-100/80 hover:bg-pink-200/80",
                heart.type === "red" && !heart.smashed && "bg-red-100/80 hover:bg-red-200/80",
                heart.type === "gold" && !heart.smashed && "bg-yellow-100/80 hover:bg-yellow-200/80",
                heart.type === "cat" && !heart.smashed && "bg-slate-100/80 hover:bg-slate-200/80",
                heart.type === "bomb" && !heart.smashed && "bg-orange-100/80 hover:bg-orange-200/80",
              )}
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: heart.smashed ? 0 : 1,
                rotate: heart.shaking ? [0, -15, 15, -15, 15, 0] : 0,
                y: heart.smashed ? -20 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                rotate: { duration: 0.4 },
              }}
              whileHover={{ scale: heart.smashed ? 0 : 1.1 }}
              whileTap={{ scale: heart.smashed ? 0 : 0.8 }}
            >
              {heart.type === "pink" && "💕"}
              {heart.type === "red" && "❤️"}
              {heart.type === "gold" && (
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  💛
                </motion.span>
              )}
              {heart.type === "cat" && "😺"}
              {heart.type === "bomb" && (
                <motion.span
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  💣
                </motion.span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Progress / Instructions */}
      <div className="absolute bottom-6 left-4 right-4 z-10">
        <div className="bg-white/20 backdrop-blur rounded-2xl p-3 text-center">
          <p className="text-white font-medium">
            👆 Tap hearts to smash! Avoid the cat! 😺
          </p>
          {combo >= 2 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-yellow-200 text-sm mt-1"
            >
              🔥 {combo} combo! +{Math.floor(combo / 3) * 5} bonus per hit!
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// Attack pattern types for Dodge the Love
type AttackPattern = "rain" | "spiral" | "wave" | "aimed" | "burst" | "walls" | "rest";

// Game 3: DODGE THE LOVE - Complete redesign with attack patterns and better UX
const DodgeTheLoveGame = memo(function DodgeTheLoveGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "done">("tutorial");
  const [playerX, setPlayerX] = useState(50);
  const [playerY, setPlayerY] = useState(70);
  const [health, setHealth] = useState(5);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [countdownNum, setCountdownNum] = useState(3);

  // Projectiles
  const [projectiles, setProjectiles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    type: "heart" | "kiss" | "sparkle" | "big_heart";
    speed: number;
    angle: number;
    size: number;
    rotation: number;
    glow?: boolean;
  }>>([]);

  // Warning indicators for attacks
  const [warnings, setWarnings] = useState<Array<{
    id: number;
    x: number;
    y: number;
    type: "line" | "area" | "target";
    angle?: number;
    duration: number;
  }>>([]);

  // Power-ups
  const [powerUps, setPowerUps] = useState<Array<{
    id: number;
    x: number;
    y: number;
    type: "shield" | "heal" | "slow";
  }>>([]);

  // Current attack pattern
  const [currentPattern, setCurrentPattern] = useState<AttackPattern>("rest");
  const [patternName, setPatternName] = useState("");

  // Effects
  const [shield, setShield] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [invincible, setInvincible] = useState(false);
  const [catMessage, setCatMessage] = useState("");
  const [catEmotion, setCatEmotion] = useState<"love" | "charging" | "attacking" | "frustrated">("love");
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [playerFacing, setPlayerFacing] = useState<"left" | "right">("right");

  // Dodge trail effect
  const [trail, setTrail] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Refs
  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);
  const playerXRef = useRef(50);
  const playerYRef = useRef(70);
  const targetXRef = useRef(50);
  const targetYRef = useRef(70);
  const healthRef = useRef(5);
  const shieldRef = useRef(false);
  const slowMoRef = useRef(false);
  const invincibleRef = useRef(false);
  const patternIndexRef = useRef(0);
  const patternTimeRef = useRef(0);
  const lastTrailRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { playerYRef.current = playerY; }, [playerY]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { shieldRef.current = shield; }, [shield]);
  useEffect(() => { slowMoRef.current = slowMo; }, [slowMo]);
  useEffect(() => { invincibleRef.current = invincible; }, [invincible]);

  // Attack pattern sequences
  const patterns: AttackPattern[] = useMemo(() => [
    "rest", "rain", "rest", "aimed", "rest", "wave", "rest", "spiral",
    "rest", "burst", "rest", "walls", "rest", "aimed", "rain"
  ], []);

  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      gameEndedRef.current = false;
      setPlayerX(50);
      setPlayerY(70);
      playerXRef.current = 50;
      playerYRef.current = 70;
      targetXRef.current = 50;
      targetYRef.current = 70;
      setHealth(5);
      healthRef.current = 5;
      setScore(0);
      scoreRef.current = 0;
      setTimeLeft(25);
      setProjectiles([]);
      setPowerUps([]);
      setWarnings([]);
      setTrail([]);
      setShield(false);
      setSlowMo(false);
      setInvincible(false);
      setCombo(0);
      setMaxCombo(0);
      setCurrentPattern("rest");
      patternIndexRef.current = 0;
      patternTimeRef.current = performance.now();
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdownNum(c => c - 1), 700);
    return () => clearTimeout(timer);
  }, [phase, countdownNum]);

  // Timer and pattern switching
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setPhase("done");
            setTimeout(() => onCompleteRef.current(scoreRef.current), 2000);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Execute attack pattern
  const executePattern = useCallback((pattern: AttackPattern, time: number) => {
    const baseId = time + Math.random() * 1000;

    switch (pattern) {
      case "rain": {
        // Gentle rain of hearts from top
        if (Math.random() < 0.15) {
          const x = 5 + Math.random() * 90;
          setProjectiles(prev => [...prev.slice(-25), {
            id: baseId,
            x, y: -5,
            type: "heart",
            speed: 0.8 + Math.random() * 0.4,
            angle: Math.PI / 2 + (Math.random() - 0.5) * 0.3,
            size: 0.9 + Math.random() * 0.2,
            rotation: Math.random() * 360,
          }]);
        }
        break;
      }
      case "spiral": {
        // Spiral pattern from center
        const spiralAngle = (time / 100) % (Math.PI * 2);
        if (Math.random() < 0.08) {
          setProjectiles(prev => [...prev.slice(-25), {
            id: baseId,
            x: 50, y: 15,
            type: "sparkle",
            speed: 1.2,
            angle: spiralAngle,
            size: 1,
            rotation: 0,
            glow: true,
          }]);
        }
        break;
      }
      case "wave": {
        // Wave pattern - sine wave of projectiles
        if (Math.random() < 0.12) {
          const waveX = 50 + Math.sin(time / 200) * 40;
          setProjectiles(prev => [...prev.slice(-25), {
            id: baseId,
            x: waveX, y: -5,
            type: "kiss",
            speed: 1,
            angle: Math.PI / 2,
            size: 1,
            rotation: 0,
          }]);
        }
        break;
      }
      case "aimed": {
        // Aimed shots at player with warning
        if (Math.random() < 0.04) {
          const startX = 10 + Math.random() * 80;
          // Show warning first
          setWarnings(prev => [...prev, {
            id: baseId,
            x: startX, y: 10,
            type: "target",
            duration: 800,
          }]);
          // Then fire after delay
          setTimeout(() => {
            if (gameEndedRef.current) return;
            const dx = playerXRef.current - startX;
            const dy = playerYRef.current - 10;
            const angle = Math.atan2(dy, dx);
            setProjectiles(prev => [...prev.slice(-25), {
              id: baseId + 0.1,
              x: startX, y: 10,
              type: "big_heart",
              speed: 1.8,
              angle,
              size: 1.3,
              rotation: 0,
              glow: true,
            }]);
          }, 800);
        }
        break;
      }
      case "burst": {
        // Burst of projectiles in all directions
        if (Math.random() < 0.02) {
          const burstCount = 8;
          for (let i = 0; i < burstCount; i++) {
            const angle = (i / burstCount) * Math.PI * 2;
            setProjectiles(prev => [...prev.slice(-30), {
              id: baseId + i,
              x: 50, y: 20,
              type: "sparkle",
              speed: 1.1,
              angle,
              size: 0.9,
              rotation: 0,
              glow: true,
            }]);
          }
        }
        break;
      }
      case "walls": {
        // Vertical walls with gaps
        if (Math.random() < 0.025) {
          const gapY = 35 + Math.random() * 35;
          const gapSize = 18;
          const fromLeft = Math.random() < 0.5;
          for (let y = 25; y < 95; y += 8) {
            if (Math.abs(y - gapY) > gapSize / 2) {
              setProjectiles(prev => [...prev.slice(-30), {
                id: baseId + y,
                x: fromLeft ? -5 : 105,
                y,
                type: "heart",
                speed: 0.9,
                angle: fromLeft ? 0 : Math.PI,
                size: 0.85,
                rotation: 0,
              }]);
            }
          }
        }
        break;
      }
      case "rest":
      default:
        // Brief rest period - maybe spawn a power-up
        if (Math.random() < 0.008) {
          const types: Array<"shield" | "heal" | "slow"> = ["shield", "heal", "slow"];
          setPowerUps(prev => [...prev.slice(-2), {
            id: baseId,
            x: 15 + Math.random() * 70,
            y: 30 + Math.random() * 35,
            type: types[Math.floor(Math.random() * types.length)],
          }]);
        }
        break;
    }
  }, []);

  // Main game loop
  useEffect(() => {
    if (phase !== "playing") return;

    let lastTime = performance.now();
    const patternDuration = 2500; // Each pattern lasts 2.5 seconds

    const gameLoop = (currentTime: number) => {
      if (gameEndedRef.current) return;

      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05); // Cap delta
      lastTime = currentTime;
      const speedMult = slowMoRef.current ? 0.35 : 1;

      // Switch patterns
      if (currentTime - patternTimeRef.current > patternDuration) {
        patternTimeRef.current = currentTime;
        patternIndexRef.current = (patternIndexRef.current + 1) % patterns.length;
        const newPattern = patterns[patternIndexRef.current];
        setCurrentPattern(newPattern);

        // Update cat emotion and show pattern name
        if (newPattern === "rest") {
          setCatEmotion("love");
          setPatternName("");
        } else {
          setCatEmotion("charging");
          const names: Record<AttackPattern, string> = {
            rain: "💕 Love Rain!",
            spiral: "🌀 Spiral of Love!",
            wave: "🌊 Love Wave!",
            aimed: "🎯 Targeted Love!",
            burst: "💥 Love Burst!",
            walls: "🧱 Wall of Hearts!",
            rest: "",
          };
          setPatternName(names[newPattern]);
          setTimeout(() => setPatternName(""), 1500);
          setTimeout(() => setCatEmotion("attacking"), 500);
        }
      }

      // Execute current pattern
      executePattern(currentPattern, currentTime);

      // Update warnings
      setWarnings(prev => prev.filter(w => currentTime - w.id < w.duration));

      // Smooth player movement with easing
      const movePlayer = (prev: number, target: number) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.3) return target;
        return prev + diff * 0.18;
      };

      setPlayerX(prev => {
        const newX = movePlayer(prev, targetXRef.current);
        if (newX > prev + 0.5) setPlayerFacing("right");
        else if (newX < prev - 0.5) setPlayerFacing("left");
        return newX;
      });
      setPlayerY(prev => movePlayer(prev, targetYRef.current));

      // Update trail
      if (currentTime - lastTrailRef.current > 50) {
        lastTrailRef.current = currentTime;
        setTrail(prev => [...prev.slice(-8), { id: currentTime, x: playerXRef.current, y: playerYRef.current }]);
      }

      // Move projectiles
      setProjectiles(prev => {
        const updated = prev.map(p => ({
          ...p,
          x: p.x + Math.cos(p.angle) * p.speed * deltaTime * 55 * speedMult,
          y: p.y + Math.sin(p.angle) * p.speed * deltaTime * 55 * speedMult,
          rotation: p.rotation + deltaTime * 180,
        }));

        // Collision detection
        if (!invincibleRef.current) {
          const playerSize = 5;
          updated.forEach(p => {
            if (p.y > 100 || p.x < -10 || p.x > 110) return;

            const dx = p.x - playerXRef.current;
            const dy = p.y - playerYRef.current;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const projectileSize = p.size * 4;

            if (dist < playerSize + projectileSize - 5) {
              if (shieldRef.current) {
                setShield(false);
                shieldRef.current = false;
                p.y = 200;
                setCatMessage("Shield blocked! 😾");
                setTimeout(() => setCatMessage(""), 800);
                setScore(s => s + 15);
              } else {
                setHealth(h => {
                  const newHealth = h - 1;
                  healthRef.current = newHealth;
                  if (newHealth <= 0 && !gameEndedRef.current) {
                    gameEndedRef.current = true;
                    setPhase("done");
                    setTimeout(() => onCompleteRef.current(scoreRef.current), 2000);
                  }
                  return newHealth;
                });
                setHitFlash(true);
                setInvincible(true);
                invincibleRef.current = true;
                setTimeout(() => setHitFlash(false), 150);
                setTimeout(() => { setInvincible(false); invincibleRef.current = false; }, 1500);
                setCombo(0);
                p.y = 200;
                setCatMessage(["Got you! 😻", "Feel the love! 💕", "Can't dodge forever! 😼"][Math.floor(Math.random() * 3)]);
                setTimeout(() => setCatMessage(""), 1000);
              }
            }
          });
        }

        // Score for dodged projectiles
        const dodged = updated.filter(p => p.y > 98 && p.y < 102);
        if (dodged.length > 0) {
          setScore(s => s + dodged.length * 3);
          setCombo(c => {
            const newCombo = c + dodged.length;
            setMaxCombo(m => Math.max(m, newCombo));
            return newCombo;
          });
        }

        return updated.filter(p => p.y < 105 && p.y > -15 && p.x > -15 && p.x < 115);
      });

      // Check power-up collection
      setPowerUps(prev => {
        return prev.filter(pu => {
          const dx = pu.x - playerXRef.current;
          const dy = pu.y - playerYRef.current;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 10) {
            if (pu.type === "shield") {
              setShield(true);
              shieldRef.current = true;
              setCatMessage("A shield?! No fair! 😾");
            } else if (pu.type === "heal") {
              setHealth(h => Math.min(h + 1, 5));
              healthRef.current = Math.min(healthRef.current + 1, 5);
              setCatMessage("Healing?! 🙀");
            } else if (pu.type === "slow") {
              setSlowMo(true);
              slowMoRef.current = true;
              setTimeout(() => { setSlowMo(false); slowMoRef.current = false; }, 4000);
              setCatMessage("Time slow?! 😾");
            }
            setTimeout(() => setCatMessage(""), 1000);
            setScore(s => s + 25);
            return false;
          }
          return true;
        });
      });

      // Clean old trail
      setTrail(prev => prev.filter(t => currentTime - t.id < 400));

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, currentPattern, executePattern, patterns]);

  const handleMove = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    targetXRef.current = Math.max(5, Math.min(95, x));
    targetYRef.current = Math.max(28, Math.min(92, y));
  }, []);

  // Tutorial
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Animated stars background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.5, 1, 0.5] }}
              transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm text-center shadow-2xl relative z-10 border border-purple-200"
        >
          <motion.div
            className="text-7xl mb-2"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            😻
          </motion.div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 bg-clip-text text-transparent mb-2">
            Dodge the Love!
          </h2>
          <p className="text-slate-600 mb-4 text-sm">
            The cat won't stop throwing love at you!<br/>
            <span className="font-bold text-purple-600">Survive the attack patterns!</span>
          </p>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-3 mb-4">
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="text-center">
                <div className="text-xl">💕</div>
              </div>
              <div className="text-center">
                <div className="text-xl">💋</div>
              </div>
              <div className="text-center">
                <div className="text-xl">✨</div>
              </div>
              <div className="text-center">
                <div className="text-xl">💗</div>
              </div>
            </div>
            <p className="text-purple-600 text-xs">Dodge all the love projectiles!</p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-blue-50 rounded-xl p-2 text-center border border-blue-100">
              <div className="text-xl">🛡️</div>
              <div className="text-[9px] text-blue-600 font-medium">Block 1 hit</div>
            </div>
            <div className="bg-green-50 rounded-xl p-2 text-center border border-green-100">
              <div className="text-xl">💚</div>
              <div className="text-[9px] text-green-600 font-medium">+1 Health</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-2 text-center border border-amber-100">
              <div className="text-xl">⏰</div>
              <div className="text-[9px] text-amber-600 font-medium">Slow time</div>
            </div>
          </div>

          <div className="bg-slate-100 rounded-xl p-3 mb-4">
            <p className="text-slate-700 text-sm font-medium">
              👆 Drag to move your character!
            </p>
          </div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white rounded-2xl font-bold text-lg shadow-xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.span
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Ready to Dodge! ⚡
            </motion.span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <motion.div
          key={countdownNum}
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-[140px] font-black text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]"
        >
          {countdownNum || "GO!"}
        </motion.div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    const survived = health > 0;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm text-center shadow-2xl border border-purple-200"
        >
          <motion.div
            className="text-8xl mb-4"
            animate={survived ? { y: [0, -15, 0], rotate: [0, 5, -5, 0] } : { scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {survived ? "🎉" : "😻"}
          </motion.div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent mb-3">
            {survived ? "You Survived!" : "Caught by Love!"}
          </h2>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-purple-50 rounded-2xl p-3 border border-purple-100">
              <p className="text-2xl font-black text-purple-600">{score}</p>
              <p className="text-purple-400 text-[10px]">POINTS</p>
            </div>
            <div className="bg-pink-50 rounded-2xl p-3 border border-pink-100">
              <p className="text-2xl font-black text-pink-600">x{maxCombo}</p>
              <p className="text-pink-400 text-[10px]">COMBO</p>
            </div>
            <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100">
              <p className="text-2xl font-black text-rose-600">{health}</p>
              <p className="text-rose-400 text-[10px]">HP LEFT</p>
            </div>
          </div>

          <motion.p
            className="text-slate-500 italic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {survived ? '"You got lucky this time!" 😾' : '"You can\'t resist my love!" 😻'}
          </motion.p>
          <motion.div
            className="mt-4 flex justify-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <span className="text-purple-300 text-sm">Next challenge</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-purple-300"
            >
              →
            </motion.span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Main game
  return (
    <motion.div
      className={cn(
        "fixed inset-0 overflow-hidden select-none touch-none",
        slowMo
          ? "bg-gradient-to-b from-blue-950 via-indigo-950 to-purple-950"
          : "bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900"
      )}
      animate={hitFlash ? { backgroundColor: ["#dc2626", "transparent"] } : {}}
      transition={{ duration: 0.15 }}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect());
      }}
    >
      {/* Star field background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-white/40 rounded-full"
            style={{ left: `${(i * 17) % 100}%`, top: `${(i * 23) % 100}%` }}
          />
        ))}
      </div>

      {/* Slow-mo effect */}
      {slowMo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute inset-0 bg-blue-500/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] border border-blue-400/10 rounded-full" />
        </motion.div>
      )}

      {/* Header */}
      <div className="absolute top-3 left-0 right-0 flex justify-center gap-2 z-30 px-3">
        <motion.div
          className="bg-black/40 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-lg border border-white/10 flex items-center gap-1.5"
          animate={score > 0 ? { scale: [1, 1.02, 1] } : {}}
        >
          <span className="text-lg">⭐</span>
          <span className="text-base font-bold text-white">{score}</span>
        </motion.div>
        <motion.div
          className={cn(
            "backdrop-blur-md rounded-xl px-3 py-1.5 shadow-lg border flex items-center gap-1.5",
            timeLeft <= 5 ? "bg-red-500/30 border-red-400/30" : "bg-black/40 border-white/10"
          )}
          animate={timeLeft <= 5 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: timeLeft <= 5 ? Infinity : 0 }}
        >
          <span className="text-lg">⏱️</span>
          <span className={cn("text-base font-bold", timeLeft <= 5 ? "text-red-300" : "text-white")}>
            {timeLeft}s
          </span>
        </motion.div>
        <div className="bg-black/40 backdrop-blur-md rounded-xl px-2 py-1.5 shadow-lg border border-white/10 flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={i >= health ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500 }}
            >
              <span className={cn("text-base", i < health ? "" : "grayscale opacity-30")}>
                {i < health ? "❤️" : "🖤"}
              </span>
            </motion.div>
          ))}
        </div>
        {combo >= 5 && (
          <motion.div
            initial={{ scale: 0, x: 20 }}
            animate={{ scale: 1, x: 0 }}
            className="bg-gradient-to-r from-orange-500/50 to-yellow-500/50 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-lg border border-yellow-400/30"
          >
            <span className="text-base font-bold text-yellow-200">x{combo} 🔥</span>
          </motion.div>
        )}
      </div>

      {/* Pattern announcement */}
      <AnimatePresence>
        {patternName && (
          <motion.div
            initial={{ y: -50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="bg-gradient-to-r from-pink-500/80 to-purple-500/80 backdrop-blur text-white px-6 py-2 rounded-full font-bold shadow-xl border border-white/20">
              {patternName}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cat */}
      <motion.div
        className="absolute top-12 left-1/2 -translate-x-1/2 text-center z-20"
        animate={{
          y: catEmotion === "attacking" ? [0, -3, 0] : [0, -5, 0],
          scale: catEmotion === "charging" ? [1, 1.1, 1] : 1,
        }}
        transition={{ duration: catEmotion === "attacking" ? 0.3 : 1.5, repeat: Infinity }}
      >
        <div className="relative">
          {catEmotion === "charging" && (
            <motion.div
              className="absolute inset-0 -m-4 rounded-full bg-pink-500/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
          <span className="text-5xl drop-shadow-lg">
            {catEmotion === "love" ? "😻" : catEmotion === "charging" ? "😼" : catEmotion === "attacking" ? "😾" : "🙀"}
          </span>
        </div>
        <AnimatePresence>
          {catMessage && (
            <motion.div
              initial={{ scale: 0, y: 5 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: -5 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white/95 text-purple-600 px-3 py-1 rounded-full font-bold shadow-xl text-xs whitespace-nowrap"
            >
              {catMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-3 right-3 bg-white/10 backdrop-blur rounded-full px-3 py-1.5 text-white/60 text-xs z-30 hover:bg-white/20 transition-colors"
      >
        Skip →
      </button>

      {/* Warning indicators */}
      {warnings.map(w => (
        <motion.div
          key={w.id}
          className="absolute pointer-events-none z-10"
          style={{ left: `${w.x}%`, top: `${w.y}%`, transform: "translate(-50%, -50%)" }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          <div className="w-12 h-12 rounded-full border-2 border-red-400 bg-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-xl">⚠️</span>
          </div>
        </motion.div>
      ))}

      {/* Power-ups */}
      {powerUps.map(pu => (
        <motion.div
          key={pu.id}
          className="absolute z-15"
          style={{ left: `${pu.x}%`, top: `${pu.y}%`, transform: "translate(-50%, -50%)" }}
          animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="relative">
            <motion.div
              className={cn(
                "absolute inset-0 -m-3 rounded-full blur-md",
                pu.type === "shield" ? "bg-blue-400/50" :
                pu.type === "heal" ? "bg-green-400/50" : "bg-amber-400/50"
              )}
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.3, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="relative text-3xl drop-shadow-lg">
              {pu.type === "shield" ? "🛡️" : pu.type === "heal" ? "💚" : "⏰"}
            </span>
          </div>
        </motion.div>
      ))}

      {/* Projectiles */}
      {projectiles.map(p => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(-50%, -50%) scale(${p.size}) rotate(${p.rotation}deg)`,
            willChange: "transform, left, top",
          }}
        >
          {p.glow && (
            <div className="absolute inset-0 -m-2 bg-pink-400/30 rounded-full blur-md" />
          )}
          <span className={cn("text-2xl", p.glow && "drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]")}>
            {p.type === "heart" && "💕"}
            {p.type === "kiss" && "💋"}
            {p.type === "sparkle" && "✨"}
            {p.type === "big_heart" && "💗"}
          </span>
        </div>
      ))}

      {/* Player trail */}
      {trail.map((t) => (
        <motion.div
          key={t.id}
          className="absolute pointer-events-none z-5"
          style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%, -50%)" }}
          initial={{ opacity: 0.4, scale: 0.8 }}
          animate={{ opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-6 h-6 rounded-full bg-purple-400/30" />
        </motion.div>
      ))}

      {/* Player character */}
      <motion.div
        className="absolute z-20"
        style={{
          left: `${playerX}%`,
          top: `${playerY}%`,
          transform: "translate(-50%, -50%)",
          willChange: "left, top",
        }}
      >
        <div className="relative">
          {/* Shield effect */}
          {shield && (
            <motion.div
              className="absolute inset-0 -m-5 rounded-full border-3 border-blue-400 bg-blue-400/15"
              animate={{ scale: [1, 1.08, 1], opacity: [0.9, 0.5, 0.9] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ width: "60px", height: "60px" }}
            />
          )}

          {/* Invincibility flash */}
          {invincible && (
            <motion.div
              className="absolute inset-0 -m-3 rounded-full bg-white/50"
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.2, repeat: Infinity }}
            />
          )}

          {/* Player glow */}
          <div className="absolute inset-0 -m-4 bg-purple-500/20 rounded-full blur-lg" />

          {/* Character - cute blob with face */}
          <motion.div
            className="relative"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full bg-gradient-to-b from-purple-300 to-purple-500 border-2 border-purple-200 shadow-lg relative",
                invincible && "animate-pulse"
              )}
              style={{ transform: playerFacing === "left" ? "scaleX(-1)" : "scaleX(1)" }}
            >
              {/* Eyes */}
              <div className="absolute top-3 left-2 w-2 h-2.5 bg-white rounded-full">
                <div className="absolute bottom-0.5 left-0.5 w-1 h-1 bg-slate-800 rounded-full" />
              </div>
              <div className="absolute top-3 right-2 w-2 h-2.5 bg-white rounded-full">
                <div className="absolute bottom-0.5 left-0.5 w-1 h-1 bg-slate-800 rounded-full" />
              </div>
              {/* Blush */}
              <div className="absolute top-5 left-0.5 w-2 h-1 bg-pink-300/60 rounded-full" />
              <div className="absolute top-5 right-0.5 w-2 h-1 bg-pink-300/60 rounded-full" />
              {/* Mouth */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-1 border-b-2 border-slate-600 rounded-b-full" />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom info bar */}
      <div className="absolute bottom-4 left-3 right-3 z-20">
        <div className="bg-black/30 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
          <div className="flex justify-center items-center gap-2 flex-wrap">
            {shield && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-blue-500/60 text-white px-2.5 py-1 rounded-full text-xs font-bold border border-blue-400/30"
              >
                🛡️ Shield
              </motion.span>
            )}
            {slowMo && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-amber-500/60 text-white px-2.5 py-1 rounded-full text-xs font-bold border border-amber-400/30"
              >
                ⏰ Slow-Mo
              </motion.span>
            )}
            {invincible && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.3, repeat: Infinity }}
                className="bg-white/60 text-purple-700 px-2.5 py-1 rounded-full text-xs font-bold"
              >
                ✨ Invincible
              </motion.span>
            )}
            {!shield && !slowMo && !invincible && (
              <span className="text-white/50 text-xs">Drag to move!</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// Game 4: REJECT THE LOVE LETTERS - Optimized
const RejectLettersGame = memo(function RejectLettersGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [letters, setLetters] = useState<Array<{ id: number; x: number; y: number; torn: boolean; text: string }>>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [catReaction, setCatReaction] = useState("");

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const startGame = useCallback(() => {
    gameEndedRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(12);
    setLetters([]);
    setPhase("playing");
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setPhase("done");
            setTimeout(() => onCompleteRef.current(scoreRef.current), 1500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Spawn letters
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = () => {
      if (gameEndedRef.current) return;
      setLetters(prev => [...prev.slice(-6), {
        id: Date.now() + Math.random(),
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 50,
        torn: false,
        text: LETTER_TEXTS[Math.floor(Math.random() * LETTER_TEXTS.length)],
      }]);
    };
    spawn();
    const interval = setInterval(spawn, 800);
    return () => clearInterval(interval);
  }, [phase]);

  const tearLetter = useCallback((id: number) => {
    setLetters(prev => prev.map(l => l.id === id ? { ...l, torn: true } : l));
    setScore(s => {
      scoreRef.current = s + 10;
      return s + 10;
    });
    setCatReaction(CAT_CRIES_LETTERS[Math.floor(Math.random() * CAT_CRIES_LETTERS.length)]);
    setTimeout(() => setCatReaction(""), 800);
    setTimeout(() => setLetters(prev => prev.filter(l => l.id !== id)), 300);
  }, []);

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-400 to-pink-600 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">💌</div>
          <h2 className="text-2xl font-bold text-rose-800 mb-3">Reject the Love Letters!</h2>
          <p className="text-rose-600 mb-4">
            The cat keeps sending love letters!<br/>
            <span className="font-bold">Tap to TEAR them up!</span>
          </p>
          <div className="flex justify-center gap-4 my-4">
            <div className="text-center">
              <div className="text-4xl">💌</div>
              <div className="text-xs text-rose-600">Love Letter</div>
            </div>
            <div className="text-2xl">→</div>
            <div className="text-center">
              <div className="text-4xl">📄💔</div>
              <div className="text-xs text-green-600">TORN!</div>
            </div>
          </div>
          <p className="text-rose-500 text-sm mb-6">Break the cat's heart! 💔</p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Reject Everything! 💔
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = score >= 50;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-400 to-pink-600 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{won ? "💔" : "💌"}</div>
          <h2 className="text-3xl font-bold text-rose-800 mb-2">
            {won ? "Letters Destroyed!" : "Too Many Letters!"}
          </h2>
          <p className="text-4xl font-bold text-rose-600 mb-2">{score} pts</p>
          <p className="text-rose-500 italic mb-4">
            {won ? '"All my beautiful words... 😿"' : '"You read them! Ha!" 😹'}
          </p>
          <p className="text-rose-400">Next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-rose-400 to-pink-600 overflow-hidden select-none">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-rose-600">{score} pts</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-rose-600">{timeLeft}s</span>
        </div>
      </div>

      {/* Cat reaction */}
      {catReaction && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-white text-rose-600 px-4 py-2 rounded-full font-bold shadow-lg">{catReaction}</div>
        </div>
      )}

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-rose-200 text-sm z-10"
      >
        Skip →
      </button>

      {/* Letters */}
      {letters.map(l => (
        <button
          key={l.id}
          onClick={() => !l.torn && tearLetter(l.id)}
          className={cn(
            "absolute p-3 bg-white rounded-xl shadow-lg",
            l.torn && "scale-0 rotate-45 opacity-0 transition-all duration-200"
          )}
          style={{
            left: `${l.x}%`,
            top: `${l.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="text-3xl mb-1">💌</div>
          <div className="text-xs text-pink-500 max-w-[80px] truncate">{l.text}</div>
        </button>
      ))}

      {/* Instruction */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/80 text-lg font-medium">👆 Tap love letters to TEAR them up!</p>
      </div>
    </div>
  );
});

// BOSS BATTLE - Optimized
const DramaKingBattle = memo(function DramaKingBattle({ onComplete }: { onComplete: (won: boolean) => void }) {
  const [phase, setPhase] = useState<"intro" | "battle" | "victory" | "defeat">("intro");
  const [bossHP, setBossHP] = useState(100);
  const [playerLove, setPlayerLove] = useState(100);
  const [bossAction, setBossAction] = useState<"idle" | "charging" | "attacking">("idle");
  const [currentAttack, setCurrentAttack] = useState("");
  const [compliments, setCompliments] = useState<Array<{ id: number; x: number; y: number; text: string }>>([]);
  const [shieldCooldown, setShieldCooldown] = useState(0);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startBattle = useCallback(() => {
    setPhase("battle");

    // Start boss attack pattern
    const attack = () => {
      if (gameEndedRef.current) return;

      setBossAction("charging");
      setCurrentAttack(DRAMATIC_LINES[Math.floor(Math.random() * DRAMATIC_LINES.length)]);

      setTimeout(() => {
        if (gameEndedRef.current) return;
        setBossAction("attacking");

        setTimeout(() => {
          if (gameEndedRef.current) return;
          setBossAction("idle");
          setCurrentAttack("");
          setTimeout(attack, 2000 + Math.random() * 1500);
        }, 1500);
      }, 1500);
    };

    setTimeout(attack, 2000);
  }, []);

  // Shield cooldown
  useEffect(() => {
    if (shieldCooldown <= 0) return;
    const timer = setInterval(() => {
      setShieldCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [shieldCooldown]);

  // Take damage when boss attacks
  useEffect(() => {
    if (bossAction !== "attacking" || shieldCooldown > 0) return;

    setPlayerLove(hp => {
      const newHP = Math.max(0, hp - 20);
      if (newHP <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        setPhase("defeat");
        setTimeout(() => onCompleteRef.current(false), 2000);
      }
      return newHP;
    });
  }, [bossAction, shieldCooldown]);

  const sendCompliment = useCallback(() => {
    if (gameEndedRef.current) return;

    const text = LOVE_COMPLIMENTS[Math.floor(Math.random() * LOVE_COMPLIMENTS.length)];
    const newCompliment = {
      id: Date.now(),
      x: 30 + Math.random() * 40,
      y: 60,
      text,
    };

    setCompliments(prev => [...prev.slice(-4), newCompliment]);

    setBossHP(hp => {
      const newHP = Math.max(0, hp - 12);
      if (newHP <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        setPhase("victory");
        setTimeout(() => onCompleteRef.current(true), 2000);
      }
      return newHP;
    });

    setTimeout(() => {
      setCompliments(prev => prev.filter(c => c.id !== newCompliment.id));
    }, 1000);
  }, []);

  const activateShield = useCallback(() => {
    if (shieldCooldown > 0) return;
    setShieldCooldown(5);
  }, [shieldCooldown]);

  if (phase === "intro") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-purple-900 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-8xl mb-6"
          >
            😾
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-4">THE DRAMA KING</h1>
          <p className="text-purple-300 mb-2 text-lg">The most dramatic cat appears!</p>
          <p className="text-purple-400 mb-8 text-sm">
            "You DARE try to say YES to me?!<br/>PROVE YOUR DEVOTION!" 👑
          </p>
          <button
            onClick={startBattle}
            className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            SHOWER WITH LOVE! 💖
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === "victory") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-rose-500 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} className="text-center">
          <div className="text-8xl mb-6">😻</div>
          <h1 className="text-3xl font-bold text-white mb-4">DRAMA DEFEATED!</h1>
          <p className="text-pink-100 mb-2 text-lg">Your love overwhelmed the drama!</p>
          <p className="text-pink-200 text-sm">"Fine... I'll accept your love... 💕"</p>
        </motion.div>
      </div>
    );
  }

  if (phase === "defeat") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-8xl mb-6">😾</div>
          <h1 className="text-3xl font-bold text-white mb-4">OVERWHELMED!</h1>
          <p className="text-slate-300 mb-2 text-lg">The drama was too powerful!</p>
          <p className="text-slate-400 text-sm">"I KNEW you couldn't handle me!" 👑</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-purple-900 overflow-hidden select-none">
      {/* HP Bars */}
      <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 z-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👑</span>
          <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all" style={{ width: `${bossHP}%` }} />
          </div>
          <span className="text-white text-sm w-12">{bossHP}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">💖</span>
          <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all" style={{ width: `${playerLove}%` }} />
          </div>
          <span className="text-white text-sm w-12">{playerLove}%</span>
        </div>
      </div>

      {/* Boss */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2">
        <motion.div
          animate={
            bossAction === "attacking" ? { scale: [1, 1.4, 1], x: [0, -20, 20, 0] } :
            bossAction === "charging" ? { scale: [1, 1.1, 1] } : {}
          }
          transition={{ duration: 0.5, repeat: bossAction === "charging" ? Infinity : 0 }}
          className="text-8xl"
        >
          {bossAction === "attacking" ? "😾" : bossAction === "charging" ? "🙀" : "😼"}
        </motion.div>
        <div className="text-4xl absolute -top-2 left-1/2 -translate-x-1/2">👑</div>

        {currentAttack && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold"
          >
            {currentAttack}
          </motion.div>
        )}
      </div>

      {/* Shield indicator */}
      {shieldCooldown > 0 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-6xl">🛡️</div>
      )}

      {/* Flying compliments */}
      {compliments.map(c => (
        <motion.div
          key={c.id}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -100 }}
          transition={{ duration: 1 }}
          className="absolute text-xl font-bold text-pink-300 pointer-events-none"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
        >
          {c.text}
        </motion.div>
      ))}

      {/* Action buttons */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-4">
        <button
          onClick={sendCompliment}
          className="flex-1 max-w-[150px] py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
          💖 LOVE!
        </button>
        <button
          onClick={activateShield}
          disabled={shieldCooldown > 0}
          className={cn(
            "flex-1 max-w-[150px] py-4 rounded-2xl font-bold text-lg shadow-lg transition-all",
            shieldCooldown > 0 ? "bg-gray-500 text-gray-300" : "bg-blue-500 text-white active:scale-95"
          )}
        >
          🛡️ {shieldCooldown > 0 ? shieldCooldown : "SHIELD"}
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-28 left-0 right-0 text-center">
        <p className="text-white/60 text-sm">Tap 💖 to compliment! Use 🛡️ when cat attacks!</p>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN GAME COMPONENT
// ============================================================================

export default function ValentineCat() {
  const [scene, setScene] = useState<GameScene>("title");
  const [dialogIndex, setDialogIndex] = useState(0);
  const [showChapterTitle, setShowChapterTitle] = useState(false);
  const [pendingScene, setPendingScene] = useState<GameScene | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const [stats, setStats] = useState({ noCount: 0, yesTime: 0, petCount: 0, totalScore: 0 });
  const [catMood, setCatMood] = useState<keyof typeof CAT_EMOTIONS>("happy");
  const [catMessage, setCatMessage] = useState("");
  const gameStartRef = useRef(0);

  const unlockAchievement = useCallback((id: string) => {
    if (unlockedAchievements.has(id)) return;
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      setUnlockedAchievements(prev => new Set([...prev, id]));
      setShowAchievement({ ...achievement, unlocked: true });
    }
  }, [unlockedAchievements]);

  const startGame = useCallback(() => {
    gameStartRef.current = now();
    setScene("intro_cutscene");
    setDialogIndex(0);
  }, []);

  const nextScene = useCallback((next: GameScene) => {
    if (next in CHAPTER_TITLES) {
      setPendingScene(next);
      setShowChapterTitle(true);
      setTimeout(() => {
        setShowChapterTitle(false);
        setPendingScene(null);
        setScene(next);
      }, 3000);
    } else {
      setScene(next);
    }
  }, []);

  const advanceDialog = useCallback(() => {
    if (dialogIndex < INTRO_DIALOG.length - 1) {
      setDialogIndex(i => i + 1);
    } else {
      nextScene("chapter1_chase");
    }
  }, [dialogIndex, nextScene]);

  const handleYes = useCallback(() => {
    const elapsed = now() - gameStartRef.current;
    setStats(s => ({ ...s, yesTime: elapsed }));

    if (elapsed < 5000) unlockAchievement("speedrun");
    if (stats.noCount >= 3) unlockAchievement("persistent");

    if (stats.noCount === 0 && stats.petCount >= 10) {
      nextScene("ending_perfect");
      unlockAchievement("true_love");
    } else if (stats.noCount >= 3 && stats.petCount === 0) {
      nextScene("ending_friend");
    } else {
      nextScene("ending_good");
    }
  }, [stats.noCount, stats.petCount, unlockAchievement, nextScene]);

  const petCat = useCallback(() => {
    setStats(s => {
      const newCount = s.petCount + 1;
      if (newCount >= 20) unlockAchievement("cat_whisperer");
      return { ...s, petCount: newCount };
    });
    setCatMood("love");
    setCatMessage(pick(["purrrr~ 😻", "*nuzzles* 💕", "more pets! 💗", "*happy chirp* 💖"]));
    setTimeout(() => setCatMood("happy"), 2000);
  }, [unlockAchievement]);

  // ============================================================================
  // RENDER SCENES
  // ============================================================================

  if (scene === "title") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-200 via-rose-200 to-pink-300 flex flex-col items-center justify-center p-4">
        <Particles emojis={["💖", "💕", "✨", "💗", "🌸"]} count={30} />
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="mb-8"
        >
          <CatSprite emotion="love" size="xl" animate />
        </motion.div>
        <motion.h1
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-5xl font-bold text-pink-800 mb-4 text-center"
        >
          Valentine's Quest
        </motion.h1>
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xl text-pink-600 mb-8 text-center"
        >
          A dramatic cat's journey to find love 💕
        </motion.p>
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col gap-4"
        >
          <Button variant="pink" size="xl" onClick={startGame}>
            <Heart className="w-6 h-6" /> Start Game
          </Button>
          <Button variant="outline" size="lg" onClick={() => {
            gameStartRef.current = now();
            setScene("chapter1_chase");
          }}>
            Skip Intro
          </Button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 text-pink-500 text-sm"
        >
          Made with 💖 and dramatic cat energy
        </motion.div>
      </div>
    );
  }

  if (scene === "intro_cutscene") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <Particles emojis={["✨", "⭐", "💫"]} count={20} />
        <AnimatePresence mode="wait">
          <DialogBox key={dialogIndex} line={INTRO_DIALOG[dialogIndex]} onNext={advanceDialog} />
        </AnimatePresence>
      </div>
    );
  }

  if (showChapterTitle && pendingScene && pendingScene in CHAPTER_TITLES) {
    return <ChapterTitle chapter={pendingScene as keyof typeof CHAPTER_TITLES} onComplete={() => setShowChapterTitle(false)} />;
  }

  if (scene === "chapter1_chase") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-100 to-pink-200 overflow-hidden flex items-center justify-center p-4">
        <Particles emojis={["💕", "🌸", "✨"]} count={15} />
        <Card className="max-w-md w-full p-8 bg-white/95 backdrop-blur shadow-2xl relative z-10">
          <div className="text-center">
            <motion.div className="mb-6" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={petCat}>
              <CatSprite emotion={catMood} size="xl" />
            </motion.div>
            <h1 className="text-3xl font-bold text-pink-800 mb-4">Will you be my Valentine?</h1>
            <AnimatePresence mode="wait">
              {catMessage && (
                <motion.p
                  key={catMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-lg text-slate-600 mb-6 min-h-[28px]"
                >
                  {catMessage}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="flex flex-col gap-4">
              <Button variant="pink" size="xl" className="w-full" onClick={handleYes}>
                <Heart className="w-5 h-5" /> Yes! 💖
              </Button>
              <motion.div
                animate={
                  stats.noCount === 0 ? {} :
                  stats.noCount === 1 ? { x: [0, -20, 20, 0] } :
                  stats.noCount === 2 ? { scale: [1, 0.8, 1], rotate: [0, 10, -10, 0] } :
                  { opacity: 0.3 }
                }
                transition={{ duration: 0.3 }}
              >
                <Button
                  variant="outline"
                  size="xl"
                  className={cn("w-full transition-all", stats.noCount >= 3 && "cursor-not-allowed opacity-30")}
                  onClick={() => {
                    if (stats.noCount >= 3) return;
                    const newCount = stats.noCount + 1;
                    setStats(s => ({ ...s, noCount: newCount }));
                    if (newCount === 1) unlockAchievement("first_no");
                    const reaction = NO_REACTIONS[Math.min(newCount - 1, NO_REACTIONS.length - 1)];
                    setCatMood(reaction.emotion as keyof typeof CAT_EMOTIONS);
                    setCatMessage(reaction.text);
                    if (newCount >= 3) {
                      setTimeout(() => {
                        setCatMessage("Fine! Prove your love through CHALLENGES! 😼");
                        setTimeout(() => nextScene("chapter1_catch_no"), 1500);
                      }, 1000);
                    }
                  }}
                  disabled={stats.noCount >= 3}
                >
                  {stats.noCount === 0 && "No 😅"}
                  {stats.noCount === 1 && "Still no... 😬"}
                  {stats.noCount === 2 && "I said NO! 😤"}
                  {stats.noCount >= 3 && "Button broken 💔"}
                </Button>
              </motion.div>
            </div>
            {stats.noCount > 0 && stats.noCount < 3 && (
              <p className="mt-4 text-sm text-slate-500">The cat seems upset... ({stats.noCount}/3 no's)</p>
            )}
          </div>
        </Card>
        <AnimatePresence>
          {showAchievement && <AchievementPopup achievement={showAchievement} onClose={() => setShowAchievement(null)} />}
        </AnimatePresence>
      </div>
    );
  }

  if (scene === "chapter1_catch_no") {
    return <CatchTheNoGame onComplete={(score) => { setStats(s => ({ ...s, totalScore: s.totalScore + score })); nextScene("chapter2_smash_hearts"); }} />;
  }

  if (scene === "chapter2_smash_hearts") {
    return <SmashTheHeartsGame onComplete={(score) => { setStats(s => ({ ...s, totalScore: s.totalScore + score })); nextScene("chapter2_escape"); }} />;
  }

  if (scene === "chapter2_escape") {
    return <DodgeTheLoveGame onComplete={(score) => { setStats(s => ({ ...s, totalScore: s.totalScore + score })); nextScene("chapter2_reject_letters"); }} />;
  }

  if (scene === "chapter2_reject_letters") {
    return <RejectLettersGame onComplete={(score) => { setStats(s => ({ ...s, totalScore: s.totalScore + score })); if (score >= 50) unlockAchievement("puzzle_solver"); nextScene("chapter3_boss_battle"); }} />;
  }

  if (scene === "chapter3_boss_battle") {
    return <DramaKingBattle onComplete={(won) => { if (won) { unlockAchievement("rhythm_master"); nextScene("chapter3_final"); } else { setCatMessage("You can't defeat my LOVE! 😼 Try again!"); setScene("chapter2_reject_letters"); } }} />;
  }

  if (scene === "chapter3_final") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-300 via-rose-400 to-red-500 flex items-center justify-center p-4">
        <Particles emojis={["💖", "💕", "💗", "💘", "💝", "✨"]} count={40} />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-lg w-full">
          <Card className="p-8 bg-white/95 backdrop-blur shadow-2xl text-center">
            <motion.div animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <CatSprite emotion="love" size="xl" />
            </motion.div>
            <h1 className="text-4xl font-bold text-pink-800 mt-6 mb-4">The Final Question</h1>
            <p className="text-xl text-slate-600 mb-2">After all we've been through...</p>
            <motion.p className="text-2xl font-bold text-pink-600 mb-8" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              Will you be my Valentine? 💖
            </motion.p>
            <div className="space-y-4">
              <Button variant="pink" size="xl" className="w-full" onClick={handleYes}>
                <Heart className="w-6 h-6" /> Yes, forever! 💕
              </Button>
              <Button variant="outline" size="lg" className="w-full opacity-50 cursor-not-allowed" disabled>
                No (button broken 😼)
              </Button>
            </div>
            <p className="mt-6 text-sm text-slate-500 italic">"The No button mysteriously stopped working..." — The Cat</p>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (scene === "ending_good") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 via-rose-300 to-pink-400 flex items-center justify-center p-4">
        <Particles emojis={["💖", "💕", "🎉", "✨", "🌸", "💗"]} count={50} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="max-w-lg w-full text-center">
          <Card className="p-8 bg-white/95 shadow-2xl">
            <motion.div animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <span className="text-[100px]">😻</span>
            </motion.div>
            <h1 className="text-4xl font-bold text-pink-800 mt-4 mb-4">YAYYY! 💖</h1>
            <p className="text-xl text-slate-600 mb-4">You are now officially my Valentine!</p>
            <div className="bg-pink-50 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-pink-700 mb-2">Your Stats:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Times said no: {stats.noCount}</div>
                <div>Cat pets: {stats.petCount}</div>
                <div>Total score: {stats.totalScore}</div>
                <div>Time: {Math.round(stats.yesTime / 1000)}s</div>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => window.location.reload()}>Play Again</Button>
              <Button variant="pink" onClick={() => setScene("title")}>Title Screen</Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (scene === "ending_perfect") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-400 flex items-center justify-center p-4">
        <Particles emojis={["⭐", "✨", "💖", "🏆", "👑", "💫"]} count={60} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="max-w-lg w-full text-center">
          <Card className="p-8 bg-white/95 shadow-2xl border-4 border-amber-400">
            <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity }}>
              <span className="text-[120px]">👑</span>
            </motion.div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent mt-4 mb-4">
              PERFECT ENDING! 🏆
            </h1>
            <p className="text-xl text-slate-600 mb-4">You showed TRUE LOVE from the start! 💕</p>
            <p className="text-lg text-amber-700 mb-6">The cat is eternally grateful and will love you forever! 😻</p>
            <div className="flex gap-4 justify-center">
              <Button variant="gold" size="lg" onClick={() => window.location.reload()}>
                <Trophy className="w-5 h-5" /> Play Again
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (scene === "ending_friend") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-200 via-indigo-300 to-purple-400 flex items-center justify-center p-4">
        <Particles emojis={["💙", "🤝", "✨", "⭐"]} count={30} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="max-w-lg w-full text-center">
          <Card className="p-8 bg-white/95 shadow-2xl">
            <span className="text-[100px]">🤝</span>
            <h1 className="text-4xl font-bold text-indigo-800 mt-4 mb-4">Friend Ending 💙</h1>
            <p className="text-xl text-slate-600 mb-4">After all those "no's", the cat respects your boundaries!</p>
            <p className="text-lg text-indigo-600 mb-6">"We can still be friends, right? 😺" — The Cat</p>
            <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
              Try for a different ending?
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Button onClick={() => setScene("title")}>Back to Title</Button>
    </div>
  );
}
