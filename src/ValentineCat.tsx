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
const randInt = (a: number, b: number) => Math.floor(rand(a, b));
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

function ProgressBar({ value, max, className, color = "pink" }: { value: number; max: number; className?: string; color?: string }) {
  const colors = {
    pink: "from-pink-400 to-rose-500",
    green: "from-emerald-400 to-green-500",
    blue: "from-blue-400 to-indigo-500",
    gold: "from-amber-400 to-yellow-500",
    red: "from-red-400 to-rose-600",
  };
  return (
    <div className={cn("h-3 rounded-full bg-slate-200 overflow-hidden", className)}>
      <motion.div
        className={cn("h-full rounded-full bg-gradient-to-r", colors[color as keyof typeof colors] || colors.pink)}
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </div>
  );
}

function Particles({ emojis, count = 20 }: { emojis: string[]; count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      emoji: pick(emojis),
      x: rand(0, 100),
      delay: rand(0, 5),
      duration: rand(3, 7),
      size: rand(0.8, 1.5),
    })), [emojis, count]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute text-2xl"
          style={{ left: `${p.x}%`, fontSize: `${p.size}rem` }}
          initial={{ y: "-10%", opacity: 0 }}
          animate={{ y: "110%", opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear" }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

function TypeWriter({ text, speed = 50, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
}

function DialogBox({ line, onNext }: { line: DialogLine; onNext: () => void }) {
  const [ready, setReady] = useState(false);

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

function CatSprite({ emotion = "happy", size = "md", className }: { emotion?: keyof typeof CAT_EMOTIONS; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-4xl", md: "text-6xl", lg: "text-8xl", xl: "text-[120px]" };
  return (
    <motion.div
      className={cn(sizes[size], className)}
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {CAT_EMOTIONS[emotion]}
    </motion.div>
  );
}

// ============================================================================
// MINI-GAMES
// ============================================================================

function RhythmGame({ onComplete, onFail }: { onComplete: (score: number) => void; onFail: () => void }) {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [notes, setNotes] = useState<Array<{ id: number; lane: number; y: number; hit: boolean }>>([]);
  const [gameTime, setGameTime] = useState(0);
  const [misses, setMisses] = useState(0);
  const noteIdRef = useRef(0);
  const lanes = [0, 1, 2, 3];
  const laneKeys = ["A", "S", "D", "F"];
  const laneEmojis = ["💖", "💕", "💗", "💘"];

  // Spawn notes
  useEffect(() => {
    if (gameTime > 15000) {
      // Game over
      if (misses >= 5) onFail();
      else onComplete(score);
      return;
    }

    const interval = setInterval(() => {
      setGameTime(t => t + 100);

      // Random chance to spawn note
      if (Math.random() < 0.15) {
        const lane = randInt(0, 4);
        setNotes(prev => [...prev, { id: noteIdRef.current++, lane, y: 0, hit: false }]);
      }

      // Move notes down
      setNotes(prev => prev
        .map(n => ({ ...n, y: n.y + 4 }))
        .filter(n => {
          if (n.y > 100 && !n.hit) {
            setMisses(m => m + 1);
            setCombo(0);
            return false;
          }
          return n.y <= 110;
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [gameTime, misses, score, onComplete, onFail]);

  // Handle key presses
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const laneIndex = laneKeys.indexOf(e.key.toUpperCase());
      if (laneIndex === -1) return;

      // Find closest note in this lane near the hit zone (80-95% down)
      const hitNote = notes.find(n => n.lane === laneIndex && n.y >= 75 && n.y <= 95 && !n.hit);

      if (hitNote) {
        setNotes(prev => prev.map(n => n.id === hitNote.id ? { ...n, hit: true } : n));
        const newCombo = combo + 1;
        setCombo(newCombo);
        setScore(s => s + 100 * Math.min(newCombo, 10));
      } else {
        setCombo(0);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [notes, combo]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-900 via-indigo-900 to-black flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-white">
        <div>
          <div className="text-2xl font-bold">Score: {score}</div>
          <div className="text-lg">Combo: {combo}x</div>
        </div>
        <div className="text-right">
          <div className="text-lg">Misses: {misses}/5</div>
          <ProgressBar value={15000 - gameTime} max={15000} color="pink" className="w-32" />
        </div>
      </div>

      {/* Play area */}
      <div className="relative w-80 h-96 bg-black/30 rounded-2xl border-2 border-white/20 overflow-hidden">
        {/* Lanes */}
        {lanes.map((lane, i) => (
          <div
            key={lane}
            className="absolute top-0 bottom-0 w-20 border-x border-white/10"
            style={{ left: `${i * 25}%` }}
          >
            {/* Hit zone */}
            <div className="absolute bottom-8 left-0 right-0 h-12 bg-white/10 border-y-2 border-pink-500/50" />
            {/* Lane label */}
            <div className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center bg-gradient-to-t from-pink-600 to-transparent">
              <span className="text-white font-bold">{laneKeys[i]}</span>
            </div>
          </div>
        ))}

        {/* Notes */}
        {notes.map(note => (
          <motion.div
            key={note.id}
            className="absolute w-16 h-12 flex items-center justify-center"
            style={{
              left: `${note.lane * 25 + 2.5}%`,
              top: `${note.y}%`,
            }}
            animate={note.hit ? { scale: [1, 1.5, 0], opacity: [1, 1, 0] } : {}}
            transition={{ duration: 0.3 }}
          >
            <span className="text-3xl">{note.hit ? "✨" : laneEmojis[note.lane]}</span>
          </motion.div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-white/60 text-center">
        Press A, S, D, F when hearts reach the zone!
      </div>
    </div>
  );
}

function PuzzleGame({ onComplete }: { onComplete: () => void }) {
  const [pieces, setPieces] = useState<Array<{ id: number; current: number; correct: number }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);

  // Initialize puzzle
  useEffect(() => {
    const correct = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = [...correct].sort(() => Math.random() - 0.5);
    setPieces(correct.map((c, i) => ({ id: i, current: shuffled[i], correct: c })));
  }, []);

  const heartPieces = ["💖", "💕", "💗", "💘", "💝", "💞", "💓", "💟", "❤️"];

  const handleClick = (index: number) => {
    if (selected === null) {
      setSelected(index);
    } else {
      // Swap pieces
      setPieces(prev => {
        const newPieces = [...prev];
        const temp = newPieces[selected].current;
        newPieces[selected].current = newPieces[index].current;
        newPieces[index].current = temp;
        return newPieces;
      });
      setSelected(null);
      setMoves(m => m + 1);
    }
  };

  // Check win condition
  useEffect(() => {
    if (pieces.length > 0 && pieces.every(p => p.current === p.correct)) {
      setTimeout(onComplete, 500);
    }
  }, [pieces, onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-pink-200 to-rose-300 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-pink-800 mb-2">Heart Puzzle 💕</h2>
        <p className="text-pink-600">Arrange the hearts in order! Moves: {moves}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4 bg-white/50 rounded-2xl shadow-xl">
        {pieces.map((piece, index) => (
          <motion.button
            key={piece.id}
            onClick={() => handleClick(index)}
            className={cn(
              "w-20 h-20 rounded-xl text-4xl flex items-center justify-center transition-all",
              selected === index
                ? "bg-pink-500 ring-4 ring-pink-300 scale-110"
                : "bg-white hover:bg-pink-100",
              piece.current === piece.correct && "bg-green-100"
            )}
            whileHover={{ scale: selected === index ? 1.1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {heartPieces[piece.current]}
          </motion.button>
        ))}
      </div>

      <p className="mt-4 text-pink-600 text-sm">Click two pieces to swap them</p>
    </div>
  );
}

function CatchGame({ onComplete, onFail }: { onComplete: (score: number) => void; onFail: () => void }) {
  const [catPos, setCatPos] = useState(50);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; caught: boolean }>>([]);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const heartIdRef = useRef(0);

  // Game timer
  useEffect(() => {
    if (timeLeft <= 0) {
      if (score >= 15) onComplete(score);
      else onFail();
      return;
    }

    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, score, onComplete, onFail]);

  // Spawn and move hearts
  useEffect(() => {
    const interval = setInterval(() => {
      // Spawn new hearts
      if (Math.random() < 0.2) {
        setHearts(prev => [...prev, {
          id: heartIdRef.current++,
          x: rand(10, 90),
          y: 0,
          caught: false,
        }]);
      }

      // Move hearts down
      setHearts(prev => prev
        .map(h => ({ ...h, y: h.y + 2 }))
        .filter(h => {
          if (h.y >= 90 && !h.caught) {
            setMissed(m => {
              if (m + 1 >= 5) onFail();
              return m + 1;
            });
            return false;
          }
          return h.y < 100;
        })
      );

      // Check collisions
      setHearts(prev => prev.map(h => {
        if (!h.caught && h.y >= 80 && h.y <= 95 && Math.abs(h.x - catPos) < 15) {
          setScore(s => s + 1);
          return { ...h, caught: true };
        }
        return h;
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [catPos, onFail]);

  // Controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCatPos(p => Math.max(10, p - 5));
      if (e.key === "ArrowRight") setCatPos(p => Math.min(90, p + 5));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-blue-400 to-indigo-600 overflow-hidden"
      onMouseMove={(e) => setCatPos((e.clientX / window.innerWidth) * 100)}
      onTouchMove={(e) => setCatPos((e.touches[0].clientX / window.innerWidth) * 100)}
    >
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex justify-between text-white">
        <div className="text-2xl font-bold">💕 {score}/15</div>
        <div className="text-2xl font-bold">⏱️ {timeLeft}s</div>
        <div className="text-xl">❌ {missed}/5</div>
      </div>

      {/* Hearts */}
      {hearts.map(h => (
        <motion.div
          key={h.id}
          className="absolute text-4xl"
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
          animate={h.caught ? { scale: [1, 1.5, 0], y: [0, -20] } : {}}
        >
          {h.caught ? "✨" : "💖"}
        </motion.div>
      ))}

      {/* Cat */}
      <motion.div
        className="absolute bottom-16 text-6xl"
        style={{ left: `${catPos}%`, transform: "translateX(-50%)" }}
      >
        😺
      </motion.div>

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-600 to-green-500" />

      {/* Instructions */}
      <div className="absolute bottom-20 left-0 right-0 text-center text-white/70 text-sm">
        Move mouse or use arrow keys to catch hearts!
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

  // Handle No button hold
  const startHold = useCallback(() => {
    if (holding) return;
    setHolding(true);
    holdStartRef.current = now();

    const loop = () => {
      const elapsed = now() - holdStartRef.current;
      const progress = Math.min(elapsed / 800, 1);
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

        // Progress to boss after enough no's
        if (newCount >= 5) {
          setTimeout(() => nextScene("chapter1_boss"), 1500);
        } else {
          moveNoButton();
        }
        return;
      }

      holdRef.current = requestAnimationFrame(loop);
    };

    holdRef.current = requestAnimationFrame(loop);
  }, [holding, stats.noCount, moveNoButton, unlockAchievement, nextScene]);

  const endHold = useCallback(() => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
    setHolding(false);
    if (holdProgress > 0.3 && holdProgress < 1) {
      setCatMessage("hehe, too slow! 😼");
      moveNoButton();
    }
    setHoldProgress(0);
  }, [holdProgress, moveNoButton]);

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
          <CatSprite emotion="love" size="xl" />
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
                <div className="text-xs text-slate-600">No count: {stats.noCount}/5</div>
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

        {/* Floating No Button */}
        <motion.div
          className="fixed z-40"
          style={{ left: noPos.x, top: noPos.y }}
          initial={{ scale: 0 }}
          animate={{ scale: 1, x: "-50%", y: "-50%" }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {/* Glow effect */}
          {!holding && (
            <motion.div
              className="absolute inset-0 rounded-2xl bg-rose-400/40 blur-xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 140, height: 60, transform: "translate(-20px, -10px)" }}
            />
          )}

          <motion.button
            className={cn(
              "relative px-6 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all",
              holding
                ? "bg-rose-500 text-white scale-95"
                : "bg-white border-2 border-rose-300 text-rose-600 hover:border-rose-400"
            )}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            whileHover={{ scale: 1.05 }}
            animate={!holding ? { y: [0, -5, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* Progress ring */}
            {holding && (
              <div
                className="absolute -inset-1 rounded-2xl"
                style={{
                  background: `conic-gradient(rgba(244,63,94,1) ${holdProgress * 360}deg, rgba(0,0,0,0.1) 0deg)`,
                  padding: 3,
                }}
              >
                <div className="w-full h-full rounded-2xl bg-rose-500" />
              </div>
            )}

            <span className="relative z-10">
              {holding ? `${Math.round(holdProgress * 100)}%` : `No ${CAT_EMOTIONS.surprised}`}
            </span>
          </motion.button>
        </motion.div>

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

  // Chapter 1 Boss: Shield Cat
  if (scene === "chapter1_boss") {
    return (
      <CatchGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_puzzle");
        }}
        onFail={() => {
          setCatMessage("hehe, try again! 😼");
          setScene("chapter1_chase");
          setStats(s => ({ ...s, noCount: Math.max(0, s.noCount - 2) }));
        }}
      />
    );
  }

  // Chapter 2: Puzzle
  if (scene === "chapter2_puzzle") {
    return (
      <PuzzleGame
        onComplete={() => {
          unlockAchievement("puzzle_solver");
          nextScene("chapter2_rhythm");
        }}
      />
    );
  }

  // Chapter 2: Rhythm
  if (scene === "chapter2_rhythm") {
    return (
      <RhythmGame
        onComplete={(score) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          if (score >= 2000) unlockAchievement("rhythm_master");
          nextScene("chapter3_final");
        }}
        onFail={() => {
          setCatMessage("let's try that again... 😿");
          setScene("chapter2_puzzle");
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
