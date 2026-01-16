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
  | "chapter2_puzzle"
  | "chapter2_rhythm"
  | "chapter3_final"
  | "boss_battle"
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
  chapter1_boss: { num: 1, title: "Mini Boss", subtitle: "The Shield Cat Awakens" },
  chapter2_puzzle: { num: 2, title: "Heart Puzzle", subtitle: "Piece together the love" },
  chapter2_rhythm: { num: 2, title: "Dance of Hearts", subtitle: "Feel the beat!" },
  chapter3_final: { num: 3, title: "Final Decision", subtitle: "The moment of truth" },
  boss_battle: { num: "💀", title: "BOSS BATTLE", subtitle: "Ultimate Dramatic Cat" },
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

  // Start game after tutorial
  const startGame = () => setPhase("playing");

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      setPhase("done");
      setTimeout(() => onComplete(score), 1500);
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, phase, score, onComplete]);

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
        onClick={() => onComplete(score)}
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

// Simple match game - find the matching pairs!
function MatchGame({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [cards, setCards] = useState<Array<{ id: number; emoji: string; flipped: boolean; matched: boolean }>>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [canFlip, setCanFlip] = useState(true);

  const emojis = ["💖", "💕", "💗", "💘"];
  const totalPairs = 4;

  // Initialize cards
  useEffect(() => {
    const pairs = emojis.flatMap((emoji, i) => [
      { id: i * 2, emoji, flipped: false, matched: false },
      { id: i * 2 + 1, emoji, flipped: false, matched: false },
    ]);
    // Simple shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    setCards(pairs);
  }, []);

  const startGame = () => setPhase("playing");

  const flipCard = (id: number) => {
    if (!canFlip || phase !== "playing") return;
    const card = cards.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;

    // Flip the card
    setCards(prev => prev.map(c => c.id === id ? { ...c, flipped: true } : c));
    const newFlipped = [...flippedIds, id];
    setFlippedIds(newFlipped);

    // Check for match when 2 cards flipped
    if (newFlipped.length === 2) {
      setCanFlip(false);
      const [first, second] = newFlipped.map(fid => cards.find(c => c.id === fid)!);

      setTimeout(() => {
        if (first.emoji === second.emoji) {
          // Match!
          setCards(prev => prev.map(c =>
            c.id === first.id || c.id === second.id ? { ...c, matched: true } : c
          ));
          setMatches(m => {
            const newMatches = m + 1;
            if (newMatches >= totalPairs) {
              setPhase("done");
              setTimeout(() => onComplete(), 1500);
            }
            return newMatches;
          });
        } else {
          // No match - flip back
          setCards(prev => prev.map(c =>
            c.id === first.id || c.id === second.id ? { ...c, flipped: false } : c
          ));
        }
        setFlippedIds([]);
        setCanFlip(true);
      }, 800);
    }
  };

  // Tutorial screen
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-400 to-indigo-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🎴</div>
          <h2 className="text-2xl font-bold text-purple-800 mb-3">Memory Match!</h2>
          <p className="text-purple-600 mb-2">
            Find the matching heart pairs!
          </p>
          <div className="flex justify-center gap-2 my-4">
            <div className="w-12 h-12 bg-purple-200 rounded-lg flex items-center justify-center text-2xl">💖</div>
            <div className="w-12 h-12 bg-purple-200 rounded-lg flex items-center justify-center text-2xl">💖</div>
            <span className="self-center text-2xl">✓</span>
          </div>
          <p className="text-purple-500 text-sm mb-6">
            Tap two cards to flip them.<br/>Match all 4 pairs to win!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Let's Play! 🎮
          </button>
        </div>
      </div>
    );
  }

  // Done screen
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-400 to-indigo-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-bold text-purple-800 mb-2">Perfect!</h2>
          <p className="text-purple-600 mb-4">You found all the pairs!</p>
          <p className="text-purple-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-400 to-indigo-500 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white/90 rounded-full px-6 py-2 shadow-lg">
          <span className="text-xl font-bold text-purple-600">Matches: {matches}/{totalPairs} 💕</span>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-purple-700 text-sm"
      >
        Skip →
      </button>

      {/* Card grid */}
      <div className="grid grid-cols-4 gap-3">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => flipCard(card.id)}
            disabled={card.flipped || card.matched || !canFlip}
            className={cn(
              "w-16 h-20 rounded-xl text-3xl flex items-center justify-center transition-all shadow-lg",
              card.matched && "bg-green-300 scale-95",
              card.flipped && !card.matched && "bg-white",
              !card.flipped && !card.matched && "bg-purple-600 hover:bg-purple-500 active:scale-95"
            )}
          >
            {(card.flipped || card.matched) ? card.emoji : "❓"}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="mt-6 text-white/80 text-center">👆 Tap cards to find matches!</p>
    </div>
  );
}

// Simple slider - drag the heart to the goal!
function SliderGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [heartX, setHeartX] = useState(50);
  const [goalX, setGoalX] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const totalRounds = 5;

  const startGame = () => {
    setPhase("playing");
    newRound();
  };

  const newRound = () => {
    setHeartX(10 + Math.random() * 30); // Start on left side
    setGoalX(60 + Math.random() * 30); // Goal on right side
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || phase !== "playing") return;
    const pct = (clientX / window.innerWidth) * 100;
    setHeartX(Math.max(5, Math.min(95, pct)));
  };

  const checkGoal = () => {
    if (Math.abs(heartX - goalX) < 10) {
      // Success!
      setScore(s => s + 1);
    }
    const nextRound = round + 1;
    if (nextRound >= totalRounds) {
      setPhase("done");
      setTimeout(() => onComplete(score + (Math.abs(heartX - goalX) < 10 ? 1 : 0)), 1500);
    } else {
      setRound(nextRound);
      newRound();
    }
  };

  // Tutorial
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">👆</div>
          <h2 className="text-2xl font-bold text-amber-800 mb-3">Slide to Love!</h2>
          <p className="text-amber-600 mb-4">
            Drag the heart 💖 to the goal 🎯
          </p>
          <div className="bg-amber-100 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-3xl">💖</span>
              <span className="text-amber-400">→ → →</span>
              <span className="text-3xl">🎯</span>
            </div>
          </div>
          <p className="text-amber-500 text-sm mb-6">
            Release when you're close!<br/>5 rounds total.
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Start! 🎮
          </button>
        </div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">⭐</div>
          <h2 className="text-3xl font-bold text-amber-800 mb-2">Nice!</h2>
          <p className="text-5xl font-bold text-amber-600 mb-4">{score}/{totalRounds}</p>
          <p className="text-amber-500">Moving on...</p>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col items-center justify-center select-none"
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={checkGoal}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={checkGoal}
      style={{ touchAction: "none" }}
    >
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-6 z-10">
        <div className="bg-white/90 rounded-full px-5 py-2 shadow-lg">
          <span className="text-lg font-bold text-amber-600">Round {round + 1}/{totalRounds}</span>
        </div>
        <div className="bg-white/90 rounded-full px-5 py-2 shadow-lg">
          <span className="text-lg font-bold text-amber-600">Score: {score}</span>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={() => onComplete(score)}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-amber-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Game area */}
      <div className="w-full px-8">
        {/* Track */}
        <div className="relative h-24 bg-white/30 rounded-full">
          {/* Goal */}
          <div
            className="absolute top-1/2 -translate-y-1/2 text-5xl"
            style={{ left: `${goalX}%`, transform: `translate(-50%, -50%)` }}
          >
            🎯
          </div>

          {/* Heart (draggable) */}
          <button
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-5xl transition-transform",
              isDragging && "scale-125"
            )}
            style={{ left: `${heartX}%`, transform: `translate(-50%, -50%)` }}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
          >
            💖
          </button>
        </div>
      </div>

      {/* Instructions */}
      <p className="mt-8 text-white text-lg font-medium text-center">
        {isDragging ? "Release near the goal! 🎯" : "👆 Drag the heart!"}
      </p>

      {/* Distance indicator */}
      <div className="mt-4 bg-white/80 rounded-full px-4 py-2">
        <span className={cn(
          "font-bold",
          Math.abs(heartX - goalX) < 10 ? "text-green-600" : "text-amber-600"
        )}>
          {Math.abs(heartX - goalX) < 10 ? "Perfect! ✓" : `Distance: ${Math.abs(Math.round(heartX - goalX))}`}
        </span>
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

  // Chapter 1 Boss: Tap Game (user-friendly!)
  if (scene === "chapter1_boss") {
    return (
      <TapGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_puzzle");
        }}
      />
    );
  }

  // Chapter 2: Memory Match Game (user-friendly!)
  if (scene === "chapter2_puzzle") {
    return (
      <MatchGame
        onComplete={() => {
          unlockAchievement("puzzle_solver");
          nextScene("chapter2_rhythm");
        }}
      />
    );
  }

  // Chapter 2: Slider Game (user-friendly!)
  if (scene === "chapter2_rhythm") {
    return (
      <SliderGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          if (score >= 4) unlockAchievement("rhythm_master");
          nextScene("chapter3_final");
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
