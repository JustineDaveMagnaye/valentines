import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Star, Trophy } from "lucide-react";

// ============================================================================
// UTILITY FUNCTIONS & TYPES
// ============================================================================

function cn(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(" ");
}

type XY = { x: number; y: number };
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
  | "chapter1_boss"
  | "chapter2_love_letter"
  | "chapter2_cupid"
  | "chapter2_simon"
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
// GAME DATA
// ============================================================================

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_no", name: "Heartbreaker", desc: "Said no for the first time", emoji: "💔", unlocked: false },
  { id: "persistent", name: "Persistent", desc: "Said no 10 times", emoji: "🏃", unlocked: false },
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
  chapter1_chase: { num: 1, title: "The Chase Begins", subtitle: "Catch that No button!" },
  chapter1_boss: { num: 1, title: "Heart Collector", subtitle: "Prove your love!" },
  chapter2_love_letter: { num: 2, title: "Love Letter", subtitle: "Catch the letters!" },
  chapter2_cupid: { num: 2, title: "Cupid's Arrow", subtitle: "Aim for the heart!" },
  chapter2_simon: { num: 2, title: "Love Melody", subtitle: "Follow the rhythm of love!" },
  chapter3_boss_battle: { num: "💀", title: "BOSS BATTLE", subtitle: "The Ultimate Test!" },
  chapter3_final: { num: 3, title: "Final Decision", subtitle: "The moment of truth" },
};

const CAT_EMOTIONS = {
  happy: "😺",
  sad: "😿",
  angry: "😾",
  love: "😻",
  surprised: "🙀",
  thinking: "😼",
  cry: "😹",
  sleepy: "😴",
};

const NO_REACTIONS = [
  { text: "meow? 😺", emotion: "surprised" },
  { text: "...oh. 😾", emotion: "angry" },
  { text: "that hurt 😿", emotion: "sad" },
  { text: "EXCUSE ME?! 🙀", emotion: "surprised" },
  { text: "I will remember this... 😾", emotion: "angry" },
  { text: "fine. FINE. 😤", emotion: "angry" },
  { text: "*dramatic sigh* 😿", emotion: "sad" },
  { text: "my heart... 💔", emotion: "sad" },
  { text: "why must you hurt me 😭", emotion: "cry" },
  { text: "I'm not crying, you're crying 😿", emotion: "sad" },
];

// ============================================================================
// COMPONENTS
// ============================================================================

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-2xl border bg-white shadow-lg", className)} {...props}>
      {children}
    </div>
  )
);
Card.displayName = "Card";

function Button({
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
}


function Particles({ emojis, count = 20 }: { emojis: string[]; count?: number }) {
  // Use CSS animations instead of framer-motion for better performance
  const particles = useMemo(() =>
    Array.from({ length: Math.min(count, 12) }).map((_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: (i * 100 / Math.min(count, 12)) + rand(-5, 5),
      delay: i * 0.3,
      duration: rand(6, 10),
    })), [emojis, count]);

  return (
    <>
      <style>{`
        @keyframes particle-fall {
          0% { transform: translateY(-5vh); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(105vh); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute text-xl opacity-60"
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
}

function TypeWriter({ text, speed = 50, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);

  // Keep ref updated without triggering effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    let cancelled = false;

    const interval = setInterval(() => {
      if (cancelled) return;
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        if (!cancelled) {
          setDone(true);
          onCompleteRef.current?.();
        }
      }
    }, speed);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
}

function DialogBox({ line, onNext }: { line: DialogLine; onNext: () => void }) {
  const [ready, setReady] = useState(false);

  // Reset ready state when line changes
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
}

function ChapterTitle({ chapter, onComplete }: { chapter: keyof typeof CHAPTER_TITLES; onComplete: () => void }) {
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
}

function AchievementPopup({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
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
}

function CatSprite({ emotion = "happy", size = "md", className, animate = false }: { emotion?: keyof typeof CAT_EMOTIONS; size?: "sm" | "md" | "lg" | "xl"; className?: string; animate?: boolean }) {
  const sizes = { sm: "text-4xl", md: "text-6xl", lg: "text-8xl", xl: "text-[120px]" };
  // Only animate on title screen to save performance
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
}

// ============================================================================
// MINI-GAMES - Super user-friendly with tutorials!
// ============================================================================

// Simple tap game - just tap the hearts as they appear!
function TapGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; tapped: boolean }>>([]);
  const [timeLeft, setTimeLeft] = useState(10);

  // Use refs to avoid stale closures and dependency issues
  const scoreRef = useRef(score);
  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  // Keep refs updated
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Start game after tutorial
  const startGame = () => {
    gameEndedRef.current = false;
    setPhase("playing");
  };

  // Timer - runs independently once game starts
  useEffect(() => {
    if (phase !== "playing") return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          // Time's up!
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
  }, [phase]); // Only depends on phase, not timeLeft

  // Spawn hearts in easy-to-reach positions
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = () => {
      setHearts(prev => {
        // Remove old hearts and add new one
        const filtered = prev.filter(h => !h.tapped && Date.now() - h.id < 2000);
        return [...filtered, {
          id: Date.now(),
          x: 15 + Math.random() * 70, // Keep away from edges
          y: 20 + Math.random() * 50, // Keep in middle area
          tapped: false,
        }];
      });
    };
    spawn();
    const interval = setInterval(spawn, 800);
    return () => clearInterval(interval);
  }, [phase]);

  const tapHeart = (id: number) => {
    setHearts(prev => prev.map(h => h.id === id ? { ...h, tapped: true } : h));
    setScore(s => s + 1);
  };

  // Tutorial screen
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-rose-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">💖</div>
          <h2 className="text-2xl font-bold text-pink-800 mb-3">Tap the Hearts!</h2>
          <p className="text-pink-600 mb-6">
            Hearts will appear on screen.<br/>
            <span className="font-bold">Just tap them!</span><br/>
            Get as many as you can in 10 seconds!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Got it! Let's go! 🎮
          </button>
        </div>
      </div>
    );
  }

  // Done screen
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-rose-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-pink-800 mb-2">Great job!</h2>
          <p className="text-5xl font-bold text-pink-600 mb-4">{score} 💖</p>
          <p className="text-pink-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-rose-500 overflow-hidden select-none">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-8 z-10">
        <div className="bg-white/90 rounded-full px-6 py-2 shadow-lg">
          <span className="text-2xl font-bold text-pink-600">{score} 💖</span>
        </div>
        <div className="bg-white/90 rounded-full px-6 py-2 shadow-lg">
          <span className="text-2xl font-bold text-pink-600">{timeLeft}s ⏱️</span>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-pink-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Hearts to tap */}
      {hearts.filter(h => !h.tapped).map(h => (
        <button
          key={h.id}
          onClick={() => tapHeart(h.id)}
          className="absolute text-5xl transform -translate-x-1/2 -translate-y-1/2 active:scale-75 transition-transform animate-pulse"
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
        >
          💖
        </button>
      ))}

      {/* Tap feedback */}
      {hearts.filter(h => h.tapped).map(h => (
        <div
          key={h.id}
          className="absolute text-4xl transform -translate-x-1/2 -translate-y-1/2 animate-ping pointer-events-none"
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
        >
          ✨
        </div>
      ))}

      {/* Hint */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/80 text-lg font-medium">👆 Tap the hearts!</p>
      </div>
    </div>
  );
}

// ============================================================================
// LOVE LETTER GAME - Catch falling letters to spell "LOVE"!
// ============================================================================
function LoveLetterGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [collected, setCollected] = useState<string[]>([]);
  const [letters, setLetters] = useState<Array<{ id: number; letter: string; x: number; y: number; caught: boolean }>>([]);
  const [basketX, setBasketX] = useState(50);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const targetWord = "LOVE";
  const totalRounds = 3;

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const animFrameRef = useRef<number>(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startGame = () => {
    gameEndedRef.current = false;
    setPhase("playing");
    spawnLetters();
  };

  const spawnLetters = () => {
    // Spawn L, O, V, E plus some decoys
    const needed = targetWord.split("");
    const decoys = ["X", "Z", "Q", "W", "K"];
    const all = [...needed, ...decoys.slice(0, 3)];
    // Shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    setLetters(all.map((letter, i) => ({
      id: Date.now() + i,
      letter,
      x: 10 + (i * 12) + Math.random() * 5,
      y: -10 - (i * 15),
      caught: false,
    })));
    setCollected([]);
  };

  // Animate letters falling
  useEffect(() => {
    if (phase !== "playing") return;

    const animate = () => {
      setLetters(prev => {
        const updated = prev.map(l => {
          if (l.caught) return l;
          const newY = l.y + 0.5;
          // Check if caught by basket
          if (newY >= 75 && newY <= 85 && Math.abs(l.x - basketX) < 12) {
            // Caught!
            const isTarget = targetWord.includes(l.letter);
            if (isTarget) {
              setCollected(c => {
                const newCollected = [...c, l.letter];
                // Check if spelled LOVE
                if (newCollected.join("") === targetWord) {
                  setScore(s => s + 1);
                  const nextRound = round + 1;
                  if (nextRound >= totalRounds && !gameEndedRef.current) {
                    gameEndedRef.current = true;
                    setTimeout(() => {
                      setPhase("done");
                      setTimeout(() => onCompleteRef.current(score + 1), 1500);
                    }, 500);
                  } else {
                    setRound(nextRound);
                    setTimeout(spawnLetters, 800);
                  }
                }
                return newCollected;
              });
            }
            return { ...l, caught: true };
          }
          // Miss if too low
          if (newY > 100) return { ...l, caught: true };
          return { ...l, y: newY };
        });
        return updated;
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [phase, basketX, round, score]);

  const handleMove = (clientX: number) => {
    const pct = (clientX / window.innerWidth) * 100;
    setBasketX(Math.max(10, Math.min(90, pct)));
  };

  // Tutorial
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-purple-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">💌</div>
          <h2 className="text-2xl font-bold text-pink-800 mb-3">Love Letter!</h2>
          <p className="text-pink-600 mb-4">
            Catch the letters to spell <span className="font-bold text-red-500">LOVE</span>!
          </p>
          <div className="flex justify-center gap-2 my-4 text-3xl">
            <span className="bg-pink-200 rounded-lg px-3 py-1">L</span>
            <span className="bg-pink-200 rounded-lg px-3 py-1">O</span>
            <span className="bg-pink-200 rounded-lg px-3 py-1">V</span>
            <span className="bg-pink-200 rounded-lg px-3 py-1">E</span>
          </div>
          <p className="text-pink-500 text-sm mb-6">
            Move the basket to catch letters!<br/>Avoid wrong letters!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Start Catching! 💕
          </button>
        </div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-purple-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">💌</div>
          <h2 className="text-3xl font-bold text-pink-800 mb-2">Love Letter Complete!</h2>
          <p className="text-5xl font-bold text-pink-600 mb-4">{score}/{totalRounds} 💕</p>
          <p className="text-pink-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-pink-400 to-purple-500 overflow-hidden select-none"
      onMouseMove={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      style={{ touchAction: "none" }}
    >
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-pink-600">Round {round + 1}/{totalRounds}</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg flex gap-1">
          {targetWord.split("").map((l, i) => (
            <span key={i} className={cn(
              "w-8 h-8 rounded flex items-center justify-center font-bold text-lg",
              collected.includes(l) && collected.indexOf(l) <= i ? "bg-green-400 text-white" : "bg-pink-200 text-pink-400"
            )}>
              {collected[i] || "?"}
            </span>
          ))}
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-pink-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Falling letters */}
      {letters.filter(l => !l.caught).map(l => (
        <div
          key={l.id}
          className={cn(
            "absolute text-4xl font-bold w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform",
            targetWord.includes(l.letter) ? "bg-white text-pink-600" : "bg-gray-300 text-gray-500"
          )}
          style={{ left: `${l.x}%`, top: `${l.y}%`, transform: "translate(-50%, -50%)" }}
        >
          {l.letter}
        </div>
      ))}

      {/* Basket */}
      <div
        className="absolute bottom-20 text-6xl transition-all"
        style={{ left: `${basketX}%`, transform: "translateX(-50%)" }}
      >
        🧺
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/80 text-lg font-medium">👆 Move to catch L-O-V-E!</p>
      </div>
    </div>
  );
}

// ============================================================================
// CUPID'S ARROW GAME - Aim and shoot hearts at targets!
// ============================================================================
function CupidArrowGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [score, setScore] = useState(0);
  const [arrows, setArrows] = useState(5);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);
  const [isAiming, setIsAiming] = useState(true);
  const [arrowPos, setArrowPos] = useState<{ x: number; y: number } | null>(null);
  const [targets, setTargets] = useState<Array<{ id: number; x: number; y: number; hit: boolean; emoji: string }>>([]);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const animRef = useRef<number>(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const spawnTargets = () => {
    const emojis = ["💖", "💕", "💗", "😻", "💘"];
    setTargets([
      { id: 1, x: 60 + Math.random() * 20, y: 20 + Math.random() * 20, hit: false, emoji: emojis[0] },
      { id: 2, x: 50 + Math.random() * 30, y: 40 + Math.random() * 15, hit: false, emoji: emojis[1] },
      { id: 3, x: 70 + Math.random() * 20, y: 55 + Math.random() * 15, hit: false, emoji: emojis[2] },
    ]);
  };

  const startGame = () => {
    gameEndedRef.current = false;
    setPhase("playing");
    spawnTargets();
  };

  const shoot = () => {
    if (!isAiming || arrows <= 0) return;
    setIsAiming(false);
    setArrows(a => a - 1);

    // Animate arrow
    const radians = (angle * Math.PI) / 180;
    const velocity = power * 0.15;
    let x = 10;
    let y = 80;
    let vx = Math.cos(radians) * velocity;
    let vy = -Math.sin(radians) * velocity;

    const animate = () => {
      x += vx;
      vy += 0.3; // gravity
      y += vy;

      setArrowPos({ x, y });

      // Check hits
      setTargets(prev => {
        const updated = prev.map(t => {
          if (!t.hit && Math.abs(x - t.x) < 8 && Math.abs(y - t.y) < 8) {
            setScore(s => s + 1);
            return { ...t, hit: true };
          }
          return t;
        });
        return updated;
      });

      // Continue or stop
      if (x < 100 && y < 100 && y > 0) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Arrow done
        setArrowPos(null);
        setIsAiming(true);

        // Check end conditions
        setTimeout(() => {
          setTargets(current => {
            const allHit = current.every(t => t.hit);
            const arrowsLeft = arrows - 1;

            if ((allHit || arrowsLeft <= 0) && !gameEndedRef.current) {
              gameEndedRef.current = true;
              setPhase("done");
              const finalScore = current.filter(t => t.hit).length;
              setTimeout(() => onCompleteRef.current(finalScore), 1500);
            }
            return current;
          });
        }, 100);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Tutorial
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-400 to-pink-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🏹</div>
          <h2 className="text-2xl font-bold text-red-800 mb-3">Cupid's Arrow!</h2>
          <p className="text-red-600 mb-4">
            Shoot arrows at the hearts!
          </p>
          <div className="bg-red-100 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-700">
              1. Adjust <strong>angle</strong> (up/down)<br/>
              2. Set <strong>power</strong> (strength)<br/>
              3. Tap <strong>SHOOT!</strong> 🏹
            </p>
          </div>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Let's Go! 💘
          </button>
        </div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-400 to-pink-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-3xl font-bold text-red-800 mb-2">Nice Shooting!</h2>
          <p className="text-5xl font-bold text-red-600 mb-4">{score}/3 💘</p>
          <p className="text-red-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-sky-300 to-sky-500 overflow-hidden select-none">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-red-600">🏹 {arrows}</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-red-600">💘 {score}/3</span>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-red-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Targets */}
      {targets.map(t => (
        <div
          key={t.id}
          className={cn(
            "absolute text-5xl transition-all",
            t.hit && "opacity-30 scale-75"
          )}
          style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%, -50%)" }}
        >
          {t.hit ? "✨" : t.emoji}
        </div>
      ))}

      {/* Arrow in flight */}
      {arrowPos && (
        <div
          className="absolute text-3xl"
          style={{ left: `${arrowPos.x}%`, top: `${arrowPos.y}%`, transform: "translate(-50%, -50%) rotate(45deg)" }}
        >
          ➳
        </div>
      )}

      {/* Bow & controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-green-600 to-transparent pt-20">
        {/* Bow */}
        <div
          className="absolute left-8 bottom-32 text-6xl origin-center"
          style={{ transform: `rotate(-${angle}deg)` }}
        >
          🏹
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-white text-sm w-16">Angle:</span>
            <input
              type="range"
              min="10"
              max="80"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-white/50"
              disabled={!isAiming}
            />
            <span className="text-white text-sm w-10">{angle}°</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm w-16">Power:</span>
            <input
              type="range"
              min="20"
              max="100"
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-white/50"
              disabled={!isAiming}
            />
            <span className="text-white text-sm w-10">{power}%</span>
          </div>
          <button
            onClick={shoot}
            disabled={!isAiming || arrows <= 0}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            SHOOT! 🏹
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SIMON SAYS LOVE - Repeat the heart pattern!
// ============================================================================
function SimonLoveGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "showing" | "input" | "done">("tutorial");
  const [pattern, setPattern] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const maxRounds = 4;

  const hearts = ["💖", "💕", "💗", "💘"];
  const colors = ["bg-pink-500", "bg-red-500", "bg-rose-500", "bg-fuchsia-500"];

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startGame = () => {
    gameEndedRef.current = false;
    nextRound([]);
  };

  const nextRound = (currentPattern: number[]) => {
    const newPattern = [...currentPattern, Math.floor(Math.random() * 4)];
    setPattern(newPattern);
    setPlayerInput([]);
    setRound(r => r + 1);
    showPattern(newPattern);
  };

  const showPattern = async (pat: number[]) => {
    setPhase("showing");
    for (let i = 0; i < pat.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      setActiveButton(pat[i]);
      await new Promise(r => setTimeout(r, 500));
      setActiveButton(null);
    }
    await new Promise(r => setTimeout(r, 300));
    setPhase("input");
  };

  const handleInput = (index: number) => {
    if (phase !== "input") return;

    setActiveButton(index);
    setTimeout(() => setActiveButton(null), 200);

    const newInput = [...playerInput, index];
    setPlayerInput(newInput);

    // Check if correct so far
    if (pattern[newInput.length - 1] !== index) {
      // Wrong! Game over
      if (!gameEndedRef.current) {
        gameEndedRef.current = true;
        setPhase("done");
        setTimeout(() => onCompleteRef.current(score), 1500);
      }
      return;
    }

    // Completed this round?
    if (newInput.length === pattern.length) {
      setScore(s => s + 1);

      if (round >= maxRounds) {
        // Won!
        if (!gameEndedRef.current) {
          gameEndedRef.current = true;
          setPhase("done");
          setTimeout(() => onCompleteRef.current(score + 1), 1500);
        }
      } else {
        // Next round
        setTimeout(() => nextRound(pattern), 800);
      }
    }
  };

  // Tutorial
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-500 to-indigo-600 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🎵</div>
          <h2 className="text-2xl font-bold text-purple-800 mb-3">Love Melody!</h2>
          <p className="text-purple-600 mb-4">
            Watch the hearts light up, then<br/>repeat the pattern!
          </p>
          <div className="grid grid-cols-2 gap-2 my-4">
            {hearts.map((h, i) => (
              <div key={i} className={cn("p-4 rounded-xl text-3xl", colors[i], "opacity-70")}>
                {h}
              </div>
            ))}
          </div>
          <p className="text-purple-500 text-sm mb-6">
            The pattern gets longer each round!<br/>How far can you go?
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            I'm Ready! 🎵
          </button>
        </div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-500 to-indigo-600 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{score >= maxRounds ? "🏆" : "💫"}</div>
          <h2 className="text-3xl font-bold text-purple-800 mb-2">
            {score >= maxRounds ? "Perfect Memory!" : "Nice Try!"}
          </h2>
          <p className="text-5xl font-bold text-purple-600 mb-4">{score}/{maxRounds} 🎵</p>
          <p className="text-purple-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  // Showing / Input
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-500 to-indigo-600 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-purple-600">Round {round}/{maxRounds}</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-purple-600">Score: {score} 🎵</span>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-purple-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Status */}
      <div className="mb-8">
        <div className="bg-white/90 rounded-full px-6 py-2 shadow-lg">
          <span className="text-lg font-bold text-purple-600">
            {phase === "showing" ? "Watch... 👀" : "Your turn! 👆"}
          </span>
        </div>
      </div>

      {/* Heart buttons */}
      <div className="grid grid-cols-2 gap-4">
        {hearts.map((heart, i) => (
          <button
            key={i}
            onClick={() => handleInput(i)}
            disabled={phase !== "input"}
            className={cn(
              "w-24 h-24 rounded-2xl text-5xl flex items-center justify-center transition-all shadow-xl",
              colors[i],
              activeButton === i && "scale-110 brightness-125 ring-4 ring-white",
              phase !== "input" && "cursor-not-allowed"
            )}
          >
            {heart}
          </button>
        ))}
      </div>

      {/* Progress dots */}
      <div className="mt-8 flex gap-2">
        {pattern.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              i < playerInput.length ? "bg-green-400" : "bg-white/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// BOSS BATTLE - Defeat the dramatic cat with love!
// ============================================================================
function BossBattleGame({ onComplete }: { onComplete: (won: boolean) => void }) {
  const [phase, setPhase] = useState<"intro" | "battle" | "victory" | "defeat">("intro");
  const [bossHP, setBossHP] = useState(100);
  const [playerLove, setPlayerLove] = useState(100);
  const [bossAttacking, setBossAttacking] = useState(false);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [shieldActive, setShieldActive] = useState(false);
  const [comboCount, setComboCount] = useState(0);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startBattle = () => {
    setPhase("battle");
    // Start boss attack pattern
    startBossAttacks();
  };

  const startBossAttacks = () => {
    const attack = () => {
      if (gameEndedRef.current) return;

      setBossAttacking(true);
      setTimeout(() => {
        setBossAttacking(false);
        // Damage player if not shielded
        setShieldActive(current => {
          if (!current) {
            setPlayerLove(hp => {
              const newHP = Math.max(0, hp - 15);
              if (newHP <= 0 && !gameEndedRef.current) {
                gameEndedRef.current = true;
                setPhase("defeat");
                setTimeout(() => onCompleteRef.current(false), 2000);
              }
              return newHP;
            });
          }
          return false;
        });
      }, 1000);

      // Schedule next attack
      if (!gameEndedRef.current) {
        setTimeout(attack, 2500 + Math.random() * 1500);
      }
    };
    setTimeout(attack, 2000);
  };

  // Spawn clickable hearts
  useEffect(() => {
    if (phase !== "battle") return;

    const spawn = setInterval(() => {
      if (gameEndedRef.current) return;
      setHearts(prev => [...prev.slice(-5), {
        id: Date.now(),
        x: 20 + Math.random() * 60,
        y: 30 + Math.random() * 40,
      }]);
    }, 800);

    return () => clearInterval(spawn);
  }, [phase]);

  const collectHeart = (id: number) => {
    setHearts(prev => prev.filter(h => h.id !== id));
    setComboCount(c => c + 1);

    // Damage boss
    const damage = 8 + Math.min(comboCount, 5) * 2; // Combo bonus
    setBossHP(hp => {
      const newHP = Math.max(0, hp - damage);
      if (newHP <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        setPhase("victory");
        setTimeout(() => onCompleteRef.current(true), 2000);
      }
      return newHP;
    });

    // Reset combo after delay
    setTimeout(() => setComboCount(0), 1500);
  };

  const activateShield = () => {
    if (shieldActive) return;
    setShieldActive(true);
    setTimeout(() => setShieldActive(false), 1500);
  };

  // Intro
  if (phase === "intro") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-purple-900 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="text-8xl mb-6">😼</div>
          <h1 className="text-3xl font-bold text-white mb-4">BOSS BATTLE</h1>
          <p className="text-purple-300 mb-2 text-lg">The Dramatic Cat appears!</p>
          <p className="text-purple-400 mb-8 text-sm">
            "You think you can just say YES?<br/>PROVE YOUR LOVE FIRST!" 😾
          </p>
          <button
            onClick={startBattle}
            className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            FIGHT WITH LOVE! 💖
          </button>
        </motion.div>
      </div>
    );
  }

  // Victory
  if (phase === "victory") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-400 to-rose-500 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          className="text-center"
        >
          <div className="text-8xl mb-6">😻</div>
          <h1 className="text-3xl font-bold text-white mb-4">VICTORY!</h1>
          <p className="text-pink-100 mb-2 text-lg">The cat is overwhelmed by your love!</p>
          <p className="text-pink-200 text-sm">"Fine... you win... 💕"</p>
        </motion.div>
      </div>
    );
  }

  // Defeat
  if (phase === "defeat") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-8xl mb-6">😾</div>
          <h1 className="text-3xl font-bold text-white mb-4">DEFEATED!</h1>
          <p className="text-slate-300 mb-2 text-lg">The cat's drama was too strong!</p>
          <p className="text-slate-400 text-sm">"Hehe, try again!" 😼</p>
        </div>
      </div>
    );
  }

  // Battle
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-purple-900 overflow-hidden select-none">
      {/* HP Bars */}
      <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 z-20">
        {/* Boss HP */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">😼</span>
          <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
              style={{ width: `${bossHP}%` }}
            />
          </div>
          <span className="text-white text-sm w-12">{bossHP}%</span>
        </div>
        {/* Player Love */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">💖</span>
          <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all"
              style={{ width: `${playerLove}%` }}
            />
          </div>
          <span className="text-white text-sm w-12">{playerLove}%</span>
        </div>
      </div>

      {/* Boss */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2">
        <motion.div
          animate={bossAttacking ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
          className="text-8xl"
        >
          {bossAttacking ? "😾" : "😼"}
        </motion.div>
        {bossAttacking && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold"
          >
            DRAMATIC ATTACK!
          </motion.div>
        )}
      </div>

      {/* Collectible hearts */}
      {hearts.map(h => (
        <button
          key={h.id}
          onClick={() => collectHeart(h.id)}
          className="absolute text-4xl animate-pulse active:scale-75 transition-transform"
          style={{ left: `${h.x}%`, top: `${h.y}%`, transform: "translate(-50%, -50%)" }}
        >
          💖
        </button>
      ))}

      {/* Combo indicator */}
      {comboCount > 1 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <motion.div
            key={comboCount}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.5, opacity: [1, 0] }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold text-yellow-400"
          >
            {comboCount}x COMBO!
          </motion.div>
        </div>
      )}

      {/* Shield button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <button
          onClick={activateShield}
          disabled={shieldActive}
          className={cn(
            "px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transition-all",
            shieldActive
              ? "bg-blue-400 text-white scale-110"
              : "bg-white/20 text-white active:scale-95"
          )}
        >
          {shieldActive ? "🛡️ PROTECTED!" : "🛡️ SHIELD"}
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-24 left-0 right-0 text-center">
        <p className="text-white/60 text-sm">
          Tap 💖 to attack! Use 🛡️ when cat attacks!
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN GAME COMPONENT
// ============================================================================

export default function ValentineCat() {
  // Game state
  const [scene, setScene] = useState<GameScene>("title");
  const [dialogIndex, setDialogIndex] = useState(0);
  const [showChapterTitle, setShowChapterTitle] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const [stats, setStats] = useState({ noCount: 0, yesTime: 0, petCount: 0, totalScore: 0 });
  const [catMood, setCatMood] = useState<keyof typeof CAT_EMOTIONS>("happy");
  const [catMessage, setCatMessage] = useState("");
  const gameStartRef = useRef(0);

  // Chase game state
  const [noPos, setNoPos] = useState<XY>({ x: 50, y: 50 });
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);

  // Viewport
  const [vp, setVp] = useState({ w: 400, h: 800 });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Unlock achievement
  const unlockAchievement = useCallback((id: string) => {
    if (unlockedAchievements.has(id)) return;

    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      setUnlockedAchievements(prev => new Set([...prev, id]));
      setShowAchievement({ ...achievement, unlocked: true });
    }
  }, [unlockedAchievements]);

  // Start game
  const startGame = useCallback(() => {
    gameStartRef.current = now();
    setScene("intro_cutscene");
    setDialogIndex(0);
  }, []);

  // Move to next scene
  const nextScene = useCallback((next: GameScene) => {
    if (next in CHAPTER_TITLES) {
      setShowChapterTitle(true);
      setTimeout(() => {
        setShowChapterTitle(false);
        setScene(next);
      }, 3000);
    } else {
      setScene(next);
    }
  }, []);

  // Handle dialog progression
  const advanceDialog = useCallback(() => {
    if (dialogIndex < INTRO_DIALOG.length - 1) {
      setDialogIndex(i => i + 1);
    } else {
      nextScene("chapter1_chase");
    }
  }, [dialogIndex, nextScene]);

  // Chase game: move the No button
  const moveNoButton = useCallback(() => {
    const margin = 80;
    setNoPos({
      x: rand(margin, vp.w - margin),
      y: rand(margin + 60, vp.h - margin),
    });
  }, [vp.w, vp.h]);

  // Initialize No button position
  useEffect(() => {
    if (scene === "chapter1_chase") {
      moveNoButton();
    }
  }, [scene, moveNoButton]);

  // Handle No button hold - EASIER: shorter hold time, no escape on partial hold
  const startHold = useCallback(() => {
    if (holding) return;
    setHolding(true);
    holdStartRef.current = now();

    // Hold time scales with difficulty: 500ms base, increases slightly each time
    const holdTime = 500 + stats.noCount * 50; // 500ms -> 750ms at max

    const loop = () => {
      const elapsed = now() - holdStartRef.current;
      const progress = Math.min(elapsed / holdTime, 1);
      setHoldProgress(progress);

      if (progress >= 1) {
        // Successfully said no!
        setHolding(false);
        setHoldProgress(0);
        const newCount = stats.noCount + 1;
        setStats(s => ({ ...s, noCount: newCount }));

        // Reactions and achievements
        if (newCount === 1) unlockAchievement("first_no");
        if (newCount === 10) unlockAchievement("persistent");

        const reaction = NO_REACTIONS[Math.min(newCount - 1, NO_REACTIONS.length - 1)];
        setCatMood(reaction.emotion as keyof typeof CAT_EMOTIONS);
        setCatMessage(reaction.text);

        // Progress to boss after enough no's (reduced from 5 to 3)
        if (newCount >= 3) {
          setTimeout(() => nextScene("chapter1_boss"), 1500);
        } else {
          // Small delay before moving so player sees the success
          setTimeout(() => moveNoButton(), 800);
        }
        return;
      }

      holdRef.current = requestAnimationFrame(loop);
    };

    holdRef.current = requestAnimationFrame(loop);
  }, [holding, stats.noCount, moveNoButton, unlockAchievement, nextScene]);

  const endHold = useCallback(() => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
    const wasHolding = holding;
    const progress = holdProgress;
    setHolding(false);
    setHoldProgress(0);

    // Only show message if they were actually trying (>50% progress)
    // Don't move the button - let them try again in same spot!
    if (wasHolding && progress > 0.5 && progress < 1) {
      setCatMessage("So close! Try again! 😼");
    } else if (wasHolding && progress > 0.2) {
      setCatMessage("Keep holding! 💪");
    }
    // Button stays in place - much more fair!
  }, [holding, holdProgress]);

  // Handle Yes button
  const handleYes = useCallback(() => {
    const elapsed = now() - gameStartRef.current;
    setStats(s => ({ ...s, yesTime: elapsed }));

    if (elapsed < 5000) {
      unlockAchievement("speedrun");
    }

    // Determine ending based on stats
    if (stats.noCount === 0 && stats.petCount >= 10) {
      nextScene("ending_perfect");
      unlockAchievement("true_love");
    } else if (stats.noCount >= 10) {
      nextScene("ending_friend");
    } else {
      nextScene("ending_good");
    }
  }, [stats.noCount, stats.petCount, unlockAchievement, nextScene]);

  // Pet the cat
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

  // Title Screen
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
          <Button variant="outline" size="lg" onClick={() => setScene("chapter1_chase")}>
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

  // Intro Cutscene
  if (scene === "intro_cutscene") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <Particles emojis={["✨", "⭐", "💫"]} count={20} />
        <AnimatePresence mode="wait">
          <DialogBox
            key={dialogIndex}
            line={INTRO_DIALOG[dialogIndex]}
            onNext={advanceDialog}
          />
        </AnimatePresence>
      </div>
    );
  }

  // Chapter Title
  if (showChapterTitle && scene in CHAPTER_TITLES) {
    return <ChapterTitle chapter={scene as keyof typeof CHAPTER_TITLES} onComplete={() => setShowChapterTitle(false)} />;
  }

  // Chapter 1: The Chase
  if (scene === "chapter1_chase") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-100 to-pink-200 overflow-hidden">
        <Particles emojis={["💕", "🌸", "✨"]} count={15} />

        {/* HUD */}
        <div className="fixed top-4 left-4 right-4 flex justify-between items-start z-50">
          <Card className="p-3 bg-white/90">
            <div className="flex items-center gap-2">
              <CatSprite emotion={catMood} size="sm" className="text-2xl" />
              <div>
                <div className="font-bold text-pink-700">Cat Mood</div>
                <div className="text-xs text-slate-600">No count: {stats.noCount}/3</div>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-white/90">
            <div className="text-sm font-medium text-pink-700">Chapter 1</div>
            <div className="text-xs text-slate-600">Catch the button!</div>
          </Card>
        </div>

        {/* Main Card */}
        <div className="min-h-screen flex items-center justify-center p-4 pt-24">
          <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur shadow-2xl">
            <div className="text-center">
              <motion.div
                className="mb-4"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={petCat}
              >
                <CatSprite emotion={catMood} size="lg" />
              </motion.div>

              <h1 className="text-3xl font-bold text-pink-800 mb-2">
                Will you be my Valentine?
              </h1>

              <AnimatePresence mode="wait">
                {catMessage && (
                  <motion.p
                    key={catMessage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg text-slate-600 mb-6"
                  >
                    {catMessage}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button variant="pink" size="xl" className="w-full" onClick={handleYes}>
                <Heart className="w-5 h-5" /> Yes! 💖
              </Button>

              <p className="mt-4 text-sm text-slate-500">
                Find and hold the floating "No" button... if you dare 😼
              </p>
            </div>
          </Card>
        </div>

        {/* Floating No Button - Simplified for performance */}
        <div
          className="fixed z-40 -translate-x-1/2 -translate-y-1/2"
          style={{ left: noPos.x, top: noPos.y }}
        >
          {/* Simple CSS glow */}
          {!holding && (
            <div className="absolute inset-0 rounded-2xl bg-rose-400/40 blur-xl animate-pulse" />
          )}

          <button
            className={cn(
              "relative px-8 py-5 rounded-2xl font-bold text-xl shadow-xl transition-all select-none",
              holding
                ? "bg-rose-500 text-white scale-95"
                : "bg-white border-2 border-rose-300 text-rose-600 hover:border-rose-400 hover:scale-105"
            )}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            style={{ touchAction: "none" }}
          >
            {/* Progress ring using CSS */}
            <div
              className="absolute -inset-1 rounded-2xl transition-opacity"
              style={{
                background: `conic-gradient(rgba(244,63,94,1) ${holdProgress * 360}deg, rgba(200,200,200,0.3) 0deg)`,
                opacity: holding ? 1 : 0,
              }}
            >
              <div className="absolute inset-[3px] rounded-[14px] bg-rose-500" />
            </div>

            <span className="relative z-10 flex flex-col items-center gap-1">
              <span>{holding ? `${Math.round(holdProgress * 100)}%` : `No ${CAT_EMOTIONS.surprised}`}</span>
              {!holding && <span className="text-xs font-normal opacity-70">tap & hold</span>}
              {holding && <span className="text-xs font-normal">keep holding!</span>}
            </span>
          </button>
        </div>

        {/* Achievement popup */}
        <AnimatePresence>
          {showAchievement && (
            <AchievementPopup
              achievement={showAchievement}
              onClose={() => setShowAchievement(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Chapter 1 Boss: Tap Game (warm-up!)
  if (scene === "chapter1_boss") {
    return (
      <TapGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_love_letter");
        }}
      />
    );
  }

  // Chapter 2: Love Letter - Catch falling letters to spell LOVE!
  if (scene === "chapter2_love_letter") {
    return (
      <LoveLetterGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_cupid");
        }}
      />
    );
  }

  // Chapter 2: Cupid's Arrow - Aim and shoot!
  if (scene === "chapter2_cupid") {
    return (
      <CupidArrowGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_simon");
        }}
      />
    );
  }

  // Chapter 2: Simon Says Love - Memory pattern game!
  if (scene === "chapter2_simon") {
    return (
      <SimonLoveGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          if (score >= 4) unlockAchievement("rhythm_master");
          nextScene("chapter3_boss_battle");
        }}
      />
    );
  }

  // Chapter 3: Boss Battle!
  if (scene === "chapter3_boss_battle") {
    return (
      <BossBattleGame
        onComplete={(won) => {
          if (won) {
            unlockAchievement("puzzle_solver");
            nextScene("chapter3_final");
          } else {
            // Lost - go back to simon game
            setCatMessage("Hehe, not strong enough! Try again! 😼");
            setScene("chapter2_simon");
          }
        }}
      />
    );
  }

  // Chapter 3: Final Decision
  if (scene === "chapter3_final") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-300 via-rose-400 to-red-500 flex items-center justify-center p-4">
        <Particles emojis={["💖", "💕", "💗", "💘", "💝", "✨"]} count={40} />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-lg w-full"
        >
          <Card className="p-8 bg-white/95 backdrop-blur shadow-2xl text-center">
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CatSprite emotion="love" size="xl" />
            </motion.div>

            <h1 className="text-4xl font-bold text-pink-800 mt-6 mb-4">
              The Final Question
            </h1>

            <p className="text-xl text-slate-600 mb-2">
              After all we've been through...
            </p>

            <motion.p
              className="text-2xl font-bold text-pink-600 mb-8"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Will you be my Valentine? 💖
            </motion.p>

            <div className="space-y-4">
              <Button variant="pink" size="xl" className="w-full" onClick={handleYes}>
                <Heart className="w-6 h-6" /> Yes, forever! 💕
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full opacity-50 cursor-not-allowed"
                disabled
              >
                No (button broken 😼)
              </Button>
            </div>

            <p className="mt-6 text-sm text-slate-500 italic">
              "The No button mysteriously stopped working..." — The Cat
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Good Ending
  if (scene === "ending_good") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 via-rose-300 to-pink-400 flex items-center justify-center p-4">
        <Particles emojis={["💖", "💕", "🎉", "✨", "🌸", "💗"]} count={50} />

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="max-w-lg w-full text-center"
        >
          <Card className="p-8 bg-white/95 shadow-2xl">
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-[100px]">😻</span>
            </motion.div>

            <h1 className="text-4xl font-bold text-pink-800 mt-4 mb-4">
              YAYYY! 💖
            </h1>

            <p className="text-xl text-slate-600 mb-4">
              You are now officially my Valentine!
            </p>

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
              <Button variant="outline" onClick={() => window.location.reload()}>
                Play Again
              </Button>
              <Button variant="pink" onClick={() => setScene("title")}>
                Title Screen
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Perfect Ending
  if (scene === "ending_perfect") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-400 flex items-center justify-center p-4">
        <Particles emojis={["⭐", "✨", "💖", "🏆", "👑", "💫"]} count={60} />

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="max-w-lg w-full text-center"
        >
          <Card className="p-8 bg-white/95 shadow-2xl border-4 border-amber-400">
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="text-[120px]">👑</span>
            </motion.div>

            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent mt-4 mb-4">
              PERFECT ENDING! 🏆
            </h1>

            <p className="text-xl text-slate-600 mb-4">
              You showed TRUE LOVE from the start! 💕
            </p>

            <p className="text-lg text-amber-700 mb-6">
              The cat is eternally grateful and will love you forever! 😻
            </p>

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

  // Friend Ending
  if (scene === "ending_friend") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-200 via-indigo-300 to-purple-400 flex items-center justify-center p-4">
        <Particles emojis={["💙", "🤝", "✨", "⭐"]} count={30} />

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="max-w-lg w-full text-center"
        >
          <Card className="p-8 bg-white/95 shadow-2xl">
            <span className="text-[100px]">🤝</span>

            <h1 className="text-4xl font-bold text-indigo-800 mt-4 mb-4">
              Friend Ending 💙
            </h1>

            <p className="text-xl text-slate-600 mb-4">
              After all those "no's", the cat respects your boundaries!
            </p>

            <p className="text-lg text-indigo-600 mb-6">
              "We can still be friends, right? 😺" — The Cat
            </p>

            <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
              Try for a different ending?
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Button onClick={() => setScene("title")}>Back to Title</Button>
    </div>
  );
}
