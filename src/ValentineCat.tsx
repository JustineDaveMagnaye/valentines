import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  | "chapter1_boss"
  | "chapter2_love_potion"
  | "chapter2_fortune"
  | "chapter2_maze"
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
  chapter1_boss: { num: 1, title: "Bubble Pop Blitz", subtitle: "Pop the love bubbles!" },
  chapter2_love_potion: { num: 2, title: "Love Potion Lab", subtitle: "Mix the perfect potion!" },
  chapter2_fortune: { num: 2, title: "Wheel of Love", subtitle: "Spin for your destiny!" },
  chapter2_maze: { num: 2, title: "Heart's Journey", subtitle: "Find your way to love!" },
  chapter3_boss_battle: { num: "👑", title: "DRAMA KING", subtitle: "The Ultimate Showdown!" },
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
// MINI-GAMES - Creative and fun with unique mechanics!
// ============================================================================

// Game 1: Bubble Pop Blitz - Pop love bubbles, avoid broken hearts!
function BubblePopGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [bubbles, setBubbles] = useState<Array<{ id: number; x: number; y: number; type: "love" | "broken"; size: number }>>([]);
  const [timeLeft, setTimeLeft] = useState(12);
  const [combo, setCombo] = useState(0);
  const [lastPop, setLastPop] = useState<{ x: number; y: number; points: number } | null>(null);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const startGame = () => {
    gameEndedRef.current = false;
    setBubbles([]);
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    setTimeLeft(12);
    setCombo(0);
    setPhase("playing");
  };

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

  // Spawn bubbles
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = () => {
      if (gameEndedRef.current) return;
      setBubbles(prev => {
        const recent = prev.slice(-6);
        const isLove = Math.random() > 0.25; // 75% love, 25% broken
        return [...recent, {
          id: Date.now(),
          x: 10 + Math.random() * 80,
          y: 20 + Math.random() * 50,
          type: isLove ? "love" : "broken",
          size: 0.8 + Math.random() * 0.4,
        }];
      });
    };
    spawn();
    const interval = setInterval(spawn, 800);
    return () => clearInterval(interval);
  }, [phase]);

  const popBubble = (id: number, type: "love" | "broken", x: number, y: number) => {
    setBubbles(prev => prev.filter(b => b.id !== id));

    if (type === "love") {
      const points = 10 + combo * 5;
      setScore(s => {
        scoreRef.current = s + points;
        return s + points;
      });
      setCombo(c => c + 1);
      setLastPop({ x, y, points });
      setTimeout(() => setLastPop(null), 500);
    } else {
      setLives(l => {
        const newLives = l - 1;
        if (newLives <= 0 && !gameEndedRef.current) {
          gameEndedRef.current = true;
          setPhase("done");
          setTimeout(() => onCompleteRef.current(scoreRef.current), 1500);
        }
        return newLives;
      });
      setCombo(0);
    }
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-400 to-blue-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🫧</div>
          <h2 className="text-2xl font-bold text-cyan-800 mb-3">Bubble Pop Blitz!</h2>
          <p className="text-cyan-600 mb-4">
            Pop the <span className="text-pink-500 font-bold">💖 love bubbles</span>!<br/>
            Avoid the <span className="text-gray-500 font-bold">💔 broken hearts</span>!
          </p>
          <div className="flex justify-center gap-4 my-4">
            <div className="text-center">
              <div className="text-4xl">💖</div>
              <div className="text-xs text-green-600 font-bold">+Points!</div>
            </div>
            <div className="text-center">
              <div className="text-4xl">💔</div>
              <div className="text-xs text-red-600 font-bold">-1 Life!</div>
            </div>
          </div>
          <p className="text-cyan-500 text-sm mb-6">
            Build combos for bonus points!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Pop Pop Pop! 🫧
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-400 to-blue-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{score >= 100 ? "🎉" : "🫧"}</div>
          <h2 className="text-3xl font-bold text-cyan-800 mb-2">
            {score >= 100 ? "Amazing!" : "Nice!"}
          </h2>
          <p className="text-5xl font-bold text-cyan-600 mb-4">{score} pts</p>
          <p className="text-cyan-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-cyan-400 to-blue-500 overflow-hidden select-none">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-cyan-600">{score} pts</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-cyan-600">{timeLeft}s</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg flex gap-1">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="text-lg">{i < lives ? "❤️" : "🖤"}</span>
          ))}
        </div>
      </div>

      {/* Combo indicator */}
      {combo > 1 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full font-bold">
            {combo}x COMBO! 🔥
          </div>
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
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-cyan-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Bubbles */}
      {bubbles.map(b => (
        <button
          key={b.id}
          onClick={() => popBubble(b.id, b.type, b.x, b.y)}
          className="absolute flex items-center justify-center active:scale-75 transition-transform"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            transform: "translate(-50%, -50%)",
            width: `${b.size * 5}rem`,
            height: `${b.size * 5}rem`,
          }}
        >
          <div className={cn(
            "w-full h-full rounded-full flex items-center justify-center",
            b.type === "love"
              ? "bg-gradient-to-br from-pink-300/80 to-rose-400/80 shadow-lg shadow-pink-300/50"
              : "bg-gradient-to-br from-gray-400/80 to-gray-600/80 shadow-lg shadow-gray-400/50"
          )}>
            <span className="text-4xl">{b.type === "love" ? "💖" : "💔"}</span>
          </div>
        </button>
      ))}

      {/* Pop feedback */}
      {lastPop && (
        <div
          className="absolute pointer-events-none z-30 text-2xl font-bold text-yellow-300 animate-bounce"
          style={{ left: `${lastPop.x}%`, top: `${lastPop.y}%`, transform: "translate(-50%, -50%)" }}
        >
          +{lastPop.points}!
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/80 text-lg font-medium">👆 Pop 💖, avoid 💔!</p>
      </div>
    </div>
  );
}

// ============================================================================
// Game 2: Love Potion Lab - Mix the perfect love potion!
// ============================================================================
function LovePotionGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [recipe, setRecipe] = useState<string[]>([]);
  const [playerInput, setPlayerInput] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [showingRecipe, setShowingRecipe] = useState(false);
  const [potionColor, setPotionColor] = useState("from-purple-400 to-pink-400");
  const [bubbling, setBubbling] = useState(false);
  const maxRounds = 3;

  const ingredients = [
    { emoji: "🌹", name: "Rose", color: "bg-red-400" },
    { emoji: "✨", name: "Sparkle", color: "bg-yellow-400" },
    { emoji: "🍫", name: "Chocolate", color: "bg-amber-700" },
    { emoji: "💎", name: "Crystal", color: "bg-cyan-400" },
  ];

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startGame = () => {
    gameEndedRef.current = false;
    setScore(0);
    setRound(0);
    setPhase("playing");
    // Start first round after a brief delay
    setTimeout(() => startRound(), 100);
  };

  const startRound = () => {
    // Generate recipe (2-4 ingredients based on round)
    const length = 2 + Math.min(round, 2);
    const newRecipe: string[] = [];
    for (let i = 0; i < length; i++) {
      newRecipe.push(ingredients[Math.floor(Math.random() * ingredients.length)].emoji);
    }
    setRecipe(newRecipe);
    setPlayerInput([]);
    setShowingRecipe(true);
    setBubbling(true);

    // Show recipe for a moment
    setTimeout(() => {
      setShowingRecipe(false);
      setBubbling(false);
    }, 2000 + length * 500);
  };

  const addIngredient = (emoji: string) => {
    if (showingRecipe || gameEndedRef.current) return;

    const newInput = [...playerInput, emoji];
    setPlayerInput(newInput);
    setBubbling(true);
    setTimeout(() => setBubbling(false), 300);

    // Check if correct so far
    if (recipe[newInput.length - 1] !== emoji) {
      // Wrong! Potion explodes
      setPotionColor("from-gray-600 to-gray-800");
      if (!gameEndedRef.current) {
        gameEndedRef.current = true;
        setPhase("done");
        setTimeout(() => onCompleteRef.current(score), 1500);
      }
      return;
    }

    // Completed recipe?
    if (newInput.length === recipe.length) {
      setScore(s => s + 1);
      setPotionColor("from-pink-400 to-rose-500");
      setBubbling(true);

      const nextRound = round + 1;
      if (nextRound >= maxRounds) {
        // Won!
        if (!gameEndedRef.current) {
          gameEndedRef.current = true;
          setPhase("done");
          setTimeout(() => onCompleteRef.current(score + 1), 1500);
        }
      } else {
        setRound(nextRound);
        setTimeout(() => {
          setPotionColor("from-purple-400 to-pink-400");
          startRound();
        }, 1000);
      }
    }
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-600 to-indigo-800 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🧪</div>
          <h2 className="text-2xl font-bold text-purple-800 mb-3">Love Potion Lab!</h2>
          <p className="text-purple-600 mb-4">
            Watch the recipe, then tap ingredients<br/>in the <span className="font-bold">same order</span>!
          </p>
          <div className="flex justify-center gap-2 my-4">
            {ingredients.map((ing, i) => (
              <div key={i} className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl", ing.color)}>
                {ing.emoji}
              </div>
            ))}
          </div>
          <p className="text-purple-500 text-sm mb-6">
            Mix {maxRounds} potions to prove your love!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Start Brewing! 🧪
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-600 to-indigo-800 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{score >= maxRounds ? "💖" : "💨"}</div>
          <h2 className="text-3xl font-bold text-purple-800 mb-2">
            {score >= maxRounds ? "Perfect Potion!" : "Potion Exploded!"}
          </h2>
          <p className="text-5xl font-bold text-purple-600 mb-4">{score}/{maxRounds} 🧪</p>
          <p className="text-purple-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-600 to-indigo-800 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-purple-600">Potion {round + 1}/{maxRounds}</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-purple-600">Score: {score}</span>
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
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-purple-200 text-sm z-10"
      >
        Skip →
      </button>

      {/* Cauldron */}
      <div className="relative mb-8">
        <div className="text-8xl">🫕</div>
        <div className={cn(
          "absolute inset-x-4 top-2 h-12 rounded-full bg-gradient-to-r opacity-80 transition-all",
          potionColor,
          bubbling && "animate-pulse"
        )} />
        {bubbling && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
            ✨
          </div>
        )}
      </div>

      {/* Recipe display */}
      <div className="bg-white/20 rounded-2xl p-4 mb-8 min-h-[80px] flex items-center justify-center gap-2">
        {showingRecipe ? (
          <>
            <span className="text-white/80 text-sm mr-2">Recipe:</span>
            {recipe.map((emoji, i) => (
              <span key={i} className="text-3xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                {emoji}
              </span>
            ))}
          </>
        ) : (
          <>
            <span className="text-white/80 text-sm mr-2">Your mix:</span>
            {playerInput.map((emoji, i) => (
              <span key={i} className="text-3xl">{emoji}</span>
            ))}
            {playerInput.length < recipe.length && (
              <span className="text-white/40 text-2xl">?</span>
            )}
          </>
        )}
      </div>

      {/* Status */}
      <div className="mb-4">
        <div className="bg-white/90 rounded-full px-6 py-2 shadow-lg">
          <span className="text-lg font-bold text-purple-600">
            {showingRecipe ? "Memorize! 👀" : "Mix it! 👆"}
          </span>
        </div>
      </div>

      {/* Ingredients */}
      <div className="grid grid-cols-4 gap-3">
        {ingredients.map((ing, i) => (
          <button
            key={i}
            onClick={() => addIngredient(ing.emoji)}
            disabled={showingRecipe}
            className={cn(
              "w-16 h-16 rounded-2xl text-3xl flex items-center justify-center transition-all shadow-lg active:scale-90",
              ing.color,
              showingRecipe && "opacity-50 cursor-not-allowed"
            )}
          >
            {ing.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Game 3: Wheel of Love - Spin for your destiny!
// ============================================================================
function FortuneWheelGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [spinsLeft, setSpinsLeft] = useState(3);

  const segments = [
    { label: "💖 LOVE", points: 30, color: "bg-pink-500" },
    { label: "😺 Cat", points: 20, color: "bg-amber-400" },
    { label: "✨ Magic", points: 25, color: "bg-purple-500" },
    { label: "🌹 Rose", points: 15, color: "bg-red-500" },
    { label: "💎 Rare", points: 50, color: "bg-cyan-400" },
    { label: "🍀 Lucky", points: 35, color: "bg-green-500" },
    { label: "💫 Star", points: 20, color: "bg-yellow-400" },
    { label: "💔 Oops", points: 0, color: "bg-gray-500" },
  ];

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const startGame = () => {
    gameEndedRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setSpinsLeft(3);
    setResult(null);
    setPhase("playing");
  };

  const spin = () => {
    if (spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setResult(null);
    setSpinsLeft(s => s - 1);

    // Random rotation (3-5 full spins + random segment)
    const spins = 3 + Math.random() * 2;
    const segmentAngle = 360 / segments.length;
    const landingSegment = Math.floor(Math.random() * segments.length);
    const finalRotation = rotation + (spins * 360) + (landingSegment * segmentAngle) + (segmentAngle / 2);

    setRotation(finalRotation);

    // Show result after spin
    setTimeout(() => {
      const segment = segments[landingSegment];
      setResult(segment.label);
      const newScore = scoreRef.current + segment.points;
      setScore(newScore);
      scoreRef.current = newScore;
      setSpinning(false);

      // Check if game over
      if (spinsLeft <= 1 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        setTimeout(() => {
          setPhase("done");
          setTimeout(() => onCompleteRef.current(scoreRef.current), 1500);
        }, 1500);
      }
    }, 3500);
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🎡</div>
          <h2 className="text-2xl font-bold text-amber-800 mb-3">Wheel of Love!</h2>
          <p className="text-amber-600 mb-4">
            Spin the wheel 3 times!<br/>
            <span className="font-bold">Collect as many points as you can!</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2 my-4">
            <span className="bg-pink-200 text-pink-700 px-2 py-1 rounded-full text-sm">💖 30pts</span>
            <span className="bg-cyan-200 text-cyan-700 px-2 py-1 rounded-full text-sm">💎 50pts!</span>
            <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm">💔 0pts</span>
          </div>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Spin the Wheel! 🎡
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{score >= 80 ? "🏆" : "🎡"}</div>
          <h2 className="text-3xl font-bold text-amber-800 mb-2">
            {score >= 80 ? "Jackpot!" : "Nice Spins!"}
          </h2>
          <p className="text-5xl font-bold text-amber-600 mb-4">{score} pts</p>
          <p className="text-amber-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-amber-600">{score} pts</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-amber-600">{spinsLeft} spins left</span>
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
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-amber-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Wheel */}
      <div className="relative mb-8">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-4xl">
          ▼
        </div>

        {/* Wheel container */}
        <div
          className="w-64 h-64 rounded-full border-8 border-white shadow-2xl overflow-hidden relative"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          }}
        >
          {segments.map((seg, i) => {
            const angle = (360 / segments.length) * i;
            return (
              <div
                key={i}
                className={cn("absolute w-1/2 h-1/2 origin-bottom-right", seg.color)}
                style={{
                  transform: `rotate(${angle}deg) skewY(${90 - 360 / segments.length}deg)`,
                  top: 0,
                  left: 0,
                }}
              >
                <span
                  className="absolute text-white text-xs font-bold"
                  style={{
                    transform: `skewY(-${90 - 360 / segments.length}deg) rotate(${180 / segments.length}deg)`,
                    left: "60%",
                    top: "20%",
                  }}
                >
                  {seg.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="mb-4 bg-white/90 rounded-full px-6 py-3 shadow-lg">
          <span className="text-2xl font-bold text-amber-700">{result}!</span>
        </div>
      )}

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={spinning || spinsLeft <= 0}
        className={cn(
          "px-12 py-4 rounded-2xl font-bold text-xl shadow-lg transition-all",
          spinning
            ? "bg-gray-400 text-white cursor-not-allowed"
            : "bg-white text-amber-600 active:scale-95"
        )}
      >
        {spinning ? "Spinning... 🎡" : "SPIN! 🎲"}
      </button>
    </div>
  );
}

// ============================================================================
// Game 4: Heart Maze - Guide the heart to the cat!
// ============================================================================
function HeartMazeGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 2 });
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const catPos = { x: 4, y: 2 };

  // Simple 5x5 maze (0 = path, 1 = wall)
  const maze = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 1, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
  ];

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startGame = () => {
    gameEndedRef.current = false;
    setPlayerPos({ x: 0, y: 2 });
    setMoves(0);
    setTimeLeft(20);
    setPhase("playing");
  };

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
            setTimeout(() => onCompleteRef.current(0), 1500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const move = (dx: number, dy: number) => {
    if (phase !== "playing" || gameEndedRef.current) return;

    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;

    // Check bounds and walls
    if (newX < 0 || newX >= 5 || newY < 0 || newY >= 5) return;
    if (maze[newY][newX] === 1) return;

    setPlayerPos({ x: newX, y: newY });
    setMoves(m => m + 1);

    // Check win
    if (newX === catPos.x && newY === catPos.y && !gameEndedRef.current) {
      gameEndedRef.current = true;
      const bonus = Math.max(0, 20 - moves);
      setPhase("done");
      setTimeout(() => onCompleteRef.current(10 + bonus), 1500);
    }
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-green-400 to-teal-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-green-800 mb-3">Heart's Journey!</h2>
          <p className="text-green-600 mb-4">
            Guide the 💖 through the maze<br/>to reach the 😺 cat!
          </p>
          <div className="flex justify-center gap-4 my-4">
            <div className="text-center">
              <div className="text-4xl">💖</div>
              <div className="text-xs text-green-600">You</div>
            </div>
            <div className="text-2xl">→</div>
            <div className="text-center">
              <div className="text-4xl">😺</div>
              <div className="text-xs text-green-600">Goal</div>
            </div>
          </div>
          <p className="text-green-500 text-sm mb-6">
            Use the arrows to move!<br/>Fewer moves = more points!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Find the Way! 🗺️
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = playerPos.x === catPos.x && playerPos.y === catPos.y;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-green-400 to-teal-500 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{won ? "😻" : "😿"}</div>
          <h2 className="text-3xl font-bold text-green-800 mb-2">
            {won ? "Found the Cat!" : "Time's Up!"}
          </h2>
          <p className="text-xl text-green-600 mb-4">
            {won ? `${moves} moves used!` : "Try again next time!"}
          </p>
          <p className="text-green-500">Moving to next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-green-400 to-teal-500 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-green-600">{moves} moves</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-green-600">{timeLeft}s ⏱️</span>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(0);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-green-700 text-sm z-10"
      >
        Skip →
      </button>

      {/* Maze */}
      <div className="bg-white/20 rounded-2xl p-3 mb-8">
        <div className="grid grid-cols-5 gap-1">
          {maze.map((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center text-3xl",
                  cell === 1 ? "bg-green-800" : "bg-green-200"
                )}
              >
                {playerPos.x === x && playerPos.y === y && "💖"}
                {catPos.x === x && catPos.y === y && playerPos.x !== x && "😺"}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button
          onClick={() => move(0, -1)}
          className="w-16 h-16 bg-white rounded-xl text-3xl shadow-lg active:scale-90 transition-transform"
        >
          ⬆️
        </button>
        <div />
        <button
          onClick={() => move(-1, 0)}
          className="w-16 h-16 bg-white rounded-xl text-3xl shadow-lg active:scale-90 transition-transform"
        >
          ⬅️
        </button>
        <div className="w-16 h-16 flex items-center justify-center text-2xl">
          💖
        </div>
        <button
          onClick={() => move(1, 0)}
          className="w-16 h-16 bg-white rounded-xl text-3xl shadow-lg active:scale-90 transition-transform"
        >
          ➡️
        </button>
        <div />
        <button
          onClick={() => move(0, 1)}
          className="w-16 h-16 bg-white rounded-xl text-3xl shadow-lg active:scale-90 transition-transform"
        >
          ⬇️
        </button>
        <div />
      </div>
    </div>
  );
}

// ============================================================================
// BOSS BATTLE - The Drama King Cat!
// ============================================================================
function DramaKingBattle({ onComplete }: { onComplete: (won: boolean) => void }) {
  const [phase, setPhase] = useState<"intro" | "battle" | "victory" | "defeat">("intro");
  const [bossHP, setBossHP] = useState(100);
  const [playerLove, setPlayerLove] = useState(100);
  const [bossAction, setBossAction] = useState<"idle" | "charging" | "attacking" | "dramatic">("idle");
  const [currentAttack, setCurrentAttack] = useState("");
  const [compliments, setCompliments] = useState<Array<{ id: number; x: number; y: number; text: string }>>([]);
  const [shieldCooldown, setShieldCooldown] = useState(0);

  const dramaticLines = [
    "Why don't you LOVE ME?! 😾",
    "*knocks your stuff off table* 😼",
    "I'm being IGNORED! 🙀",
    "This is my FINAL FORM! 😾",
    "*judges you silently* 😿",
    "You'll REGRET this! 😾",
  ];

  const loveCompliments = ["You're purrfect! 💕", "So fluffy! ✨", "Best cat! 💖", "Love you! 😻", "Cutest! 🌟"];

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const startBattle = () => {
    setPhase("battle");
    startBossPattern();
  };

  const startBossPattern = () => {
    const attack = () => {
      if (gameEndedRef.current) return;

      // Boss charges up
      setBossAction("charging");
      setCurrentAttack(dramaticLines[Math.floor(Math.random() * dramaticLines.length)]);

      setTimeout(() => {
        if (gameEndedRef.current) return;
        setBossAction("attacking");

        setTimeout(() => {
          if (gameEndedRef.current) return;
          setBossAction("idle");
          setCurrentAttack("");

          // Schedule next attack
          setTimeout(attack, 2000 + Math.random() * 1500);
        }, 1500);
      }, 1500);
    };

    setTimeout(attack, 2000);
  };

  // Shield cooldown timer
  useEffect(() => {
    if (shieldCooldown <= 0) return;
    const timer = setInterval(() => {
      setShieldCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [shieldCooldown]);

  // Take damage when boss attacks (if not shielded)
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

  const sendCompliment = () => {
    if (gameEndedRef.current) return;

    const text = loveCompliments[Math.floor(Math.random() * loveCompliments.length)];
    const newCompliment = {
      id: Date.now(),
      x: 30 + Math.random() * 40,
      y: 60,
      text,
    };

    setCompliments(prev => [...prev.slice(-4), newCompliment]);

    // Damage boss
    setBossHP(hp => {
      const newHP = Math.max(0, hp - 12);
      if (newHP <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        setPhase("victory");
        setTimeout(() => onCompleteRef.current(true), 2000);
      }
      return newHP;
    });

    // Remove compliment after animation
    setTimeout(() => {
      setCompliments(prev => prev.filter(c => c.id !== newCompliment.id));
    }, 1000);
  };

  const activateShield = () => {
    if (shieldCooldown > 0) return;
    setShieldCooldown(5);
  };

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
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          className="text-center"
        >
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
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
              style={{ width: `${bossHP}%` }}
            />
          </div>
          <span className="text-white text-sm w-12">{bossHP}%</span>
        </div>
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
          animate={
            bossAction === "attacking"
              ? { scale: [1, 1.4, 1], x: [0, -20, 20, 0] }
              : bossAction === "charging"
              ? { scale: [1, 1.1, 1] }
              : {}
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
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-6xl">
          🛡️
        </div>
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
            shieldCooldown > 0
              ? "bg-gray-500 text-gray-300"
              : "bg-blue-500 text-white active:scale-95"
          )}
        >
          🛡️ {shieldCooldown > 0 ? shieldCooldown : "SHIELD"}
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-28 left-0 right-0 text-center">
        <p className="text-white/60 text-sm">
          Tap 💖 to compliment! Use 🛡️ when cat attacks!
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

  // Handle Yes button
  const handleYes = useCallback(() => {
    const elapsed = now() - gameStartRef.current;
    setStats(s => ({ ...s, yesTime: elapsed }));

    if (elapsed < 5000) {
      unlockAchievement("speedrun");
    }

    // Unlock "persistent" achievement for making it through challenges
    if (stats.noCount >= 3) {
      unlockAchievement("persistent");
    }

    // Determine ending based on stats
    if (stats.noCount === 0 && stats.petCount >= 10) {
      nextScene("ending_perfect");
      unlockAchievement("true_love");
    } else if (stats.noCount >= 3 && stats.petCount === 0) {
      // Said no 3 times and never pet the cat = friend ending
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

  // Chapter 1: The Big Question - Simple Yes/No with funny No button behavior
  if (scene === "chapter1_chase") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-100 to-pink-200 overflow-hidden flex items-center justify-center p-4">
        <Particles emojis={["💕", "🌸", "✨"]} count={15} />

        <Card className="max-w-md w-full p-8 bg-white/95 backdrop-blur shadow-2xl relative z-10">
          <div className="text-center">
            <motion.div
              className="mb-6"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={petCat}
            >
              <CatSprite emotion={catMood} size="xl" />
            </motion.div>

            <h1 className="text-3xl font-bold text-pink-800 mb-4">
              Will you be my Valentine?
            </h1>

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

              {/* No button that runs away / shrinks / does funny things */}
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
                  className={cn(
                    "w-full transition-all",
                    stats.noCount >= 3 && "cursor-not-allowed opacity-30"
                  )}
                  onClick={() => {
                    if (stats.noCount >= 3) return;

                    const newCount = stats.noCount + 1;
                    setStats(s => ({ ...s, noCount: newCount }));

                    // Reactions
                    if (newCount === 1) unlockAchievement("first_no");

                    const reaction = NO_REACTIONS[Math.min(newCount - 1, NO_REACTIONS.length - 1)];
                    setCatMood(reaction.emotion as keyof typeof CAT_EMOTIONS);
                    setCatMessage(reaction.text);

                    // After 3 no's, go to mini-games
                    if (newCount >= 3) {
                      setTimeout(() => {
                        setCatMessage("Fine! Prove your love through CHALLENGES! 😼");
                        setTimeout(() => nextScene("chapter1_boss"), 1500);
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
              <p className="mt-4 text-sm text-slate-500">
                The cat seems upset... ({stats.noCount}/3 no's)
              </p>
            )}
          </div>
        </Card>

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

  // Chapter 1 Boss: Bubble Pop Blitz - Pop love bubbles!
  if (scene === "chapter1_boss") {
    return (
      <BubblePopGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_love_potion");
        }}
      />
    );
  }

  // Chapter 2: Love Potion Lab - Mix the perfect potion!
  if (scene === "chapter2_love_potion") {
    return (
      <LovePotionGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_fortune");
        }}
      />
    );
  }

  // Chapter 2: Fortune Wheel - Spin for your destiny!
  if (scene === "chapter2_fortune") {
    return (
      <FortuneWheelGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_maze");
        }}
      />
    );
  }

  // Chapter 2: Heart Maze - Guide the heart to the cat!
  if (scene === "chapter2_maze") {
    return (
      <HeartMazeGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          if (score >= 20) unlockAchievement("puzzle_solver");
          nextScene("chapter3_boss_battle");
        }}
      />
    );
  }

  // Chapter 3: Boss Battle - The Drama King!
  if (scene === "chapter3_boss_battle") {
    return (
      <DramaKingBattle
        onComplete={(won: boolean) => {
          if (won) {
            unlockAchievement("rhythm_master");
            nextScene("chapter3_final");
          } else {
            // Lost - go back to maze
            setCatMessage("My DRAMA is too powerful! 👑 Try again!");
            setScene("chapter2_maze");
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
