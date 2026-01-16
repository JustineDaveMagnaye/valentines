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
  chapter1_catch_no: { num: 1, title: "Catch the NO!", subtitle: "Spell out your rejection!" },
  chapter2_smash_hearts: { num: 2, title: "Smash the Hearts!", subtitle: "Destroy the decorations!" },
  chapter2_escape: { num: 2, title: "Escape the Cat!", subtitle: "Run for the exits!" },
  chapter2_reject_letters: { num: 2, title: "Reject the Letters!", subtitle: "Tear them all up!" },
  chapter3_boss_battle: { num: "👑", title: "FINAL BOSS", subtitle: "The cat won't give up!" },
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
// MINI-GAMES - The user tries to say NO, but the cat won't let them!
// ============================================================================

// Game 1: CATCH THE NO - Falling "NO" letters, but cat blocks them with hearts!
function CatchTheNoGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [noLetters, setNoLetters] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [items, setItems] = useState<Array<{ id: number; x: number; y: number; type: "N" | "O" | "heart"; speed: number }>>([]);
  const [catMessage, setCatMessage] = useState("");
  const [basketX, setBasketX] = useState(50);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const noRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { noRef.current = noLetters; }, [noLetters]);

  const catTaunts = [
    "Nice try! 😼",
    "You can't spell NO! 😹",
    "BLOCKED! 💕",
    "Too slow! 😸",
    "Love conquers all! 😻",
  ];

  const startGame = () => {
    gameEndedRef.current = false;
    setNoLetters(0);
    noRef.current = 0;
    setTimeLeft(15);
    setItems([]);
    setCatMessage("");
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
            setTimeout(() => onCompleteRef.current(noRef.current), 1500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Spawn items
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = () => {
      if (gameEndedRef.current) return;
      const rand = Math.random();
      // 30% N, 30% O, 40% hearts (blocking)
      const type = rand < 0.3 ? "N" : rand < 0.6 ? "O" : "heart";
      setItems(prev => [...prev.slice(-8), {
        id: Date.now() + Math.random(),
        x: 10 + Math.random() * 80,
        y: -10,
        type,
        speed: 2 + Math.random() * 2,
      }]);
    };
    const interval = setInterval(spawn, 600);
    return () => clearInterval(interval);
  }, [phase]);

  // Move items down
  useEffect(() => {
    if (phase !== "playing") return;
    const move = setInterval(() => {
      setItems(prev => {
        const updated = prev.map(item => ({ ...item, y: item.y + item.speed }));
        // Check catches
        updated.forEach(item => {
          if (item.y >= 75 && item.y <= 85) {
            const dist = Math.abs(item.x - basketX);
            if (dist < 15) {
              if (item.type === "heart") {
                setCatMessage(catTaunts[Math.floor(Math.random() * catTaunts.length)]);
                setTimeout(() => setCatMessage(""), 1000);
              } else {
                setNoLetters(n => n + 1);
              }
              item.y = 200; // Remove
            }
          }
        });
        return updated.filter(item => item.y < 100);
      });
    }, 50);
    return () => clearInterval(move);
  }, [phase, basketX]);

  // Handle touch/mouse for basket
  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    setBasketX(Math.max(10, Math.min(90, x)));
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-500 to-purple-700 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-indigo-800 mb-3">Catch the NO!</h2>
          <p className="text-indigo-600 mb-4">
            Catch falling <span className="font-bold text-red-500">N</span> and <span className="font-bold text-red-500">O</span> letters!<br/>
            The cat throws 💕 to block you!
          </p>
          <div className="flex justify-center gap-4 my-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">N O</div>
              <div className="text-xs text-green-600 font-bold">Catch these!</div>
            </div>
            <div className="text-center">
              <div className="text-3xl">💕</div>
              <div className="text-xs text-red-600 font-bold">Avoid!</div>
            </div>
          </div>
          <p className="text-indigo-500 text-sm mb-6">
            Slide to move your basket! 🧺
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Try to say NO! 🚫
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = noLetters >= 5;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-500 to-purple-700 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{won ? "😾" : "😹"}</div>
          <h2 className="text-3xl font-bold text-indigo-800 mb-2">
            {won ? "You spelled NO!" : "Cat blocked you!"}
          </h2>
          <p className="text-2xl font-bold text-indigo-600 mb-2">{noLetters} letters caught</p>
          <p className="text-indigo-500 italic mb-4">
            {won ? '"Fine, but I\'m not giving up!" 😾' : '"You can\'t reject ME!" 😹'}
          </p>
          <p className="text-indigo-400">Next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-indigo-500 to-purple-700 overflow-hidden select-none"
      onMouseMove={(e) => handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
    >
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-indigo-600">Letters: {noLetters}</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-indigo-600">{timeLeft}s</span>
        </div>
      </div>

      {/* Cat taunting */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center z-20">
        <div className="text-4xl mb-2">😼</div>
        {catMessage && (
          <div className="bg-pink-500 text-white px-4 py-2 rounded-full font-bold animate-bounce">
            {catMessage}
          </div>
        )}
      </div>

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(noLetters);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-indigo-200 text-sm z-10"
      >
        Skip →
      </button>

      {/* Falling items */}
      {items.map(item => (
        <div
          key={item.id}
          className="absolute text-4xl font-bold transition-none pointer-events-none"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {item.type === "heart" ? "💕" : (
            <span className="text-red-400 drop-shadow-lg">{item.type}</span>
          )}
        </div>
      ))}

      {/* Basket */}
      <div
        className="absolute bottom-20 text-5xl transition-all duration-75"
        style={{ left: `${basketX}%`, transform: "translateX(-50%)" }}
      >
        🧺
      </div>

      {/* Progress */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <div className="inline-flex gap-1">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={cn(
              "text-2xl transition-all",
              i < noLetters ? "opacity-100 scale-110" : "opacity-30"
            )}>
              {i % 2 === 0 ? "N" : "O"}
            </span>
          ))}
        </div>
        <p className="text-white/60 text-sm mt-2">Collect 5 to spell "NO NO N..."</p>
      </div>
    </div>
  );
}

// ============================================================================
// Game 2: SMASH THE HEARTS - Destroy the cat's love decorations!
// ============================================================================
function SmashTheHeartsGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; type: "heart" | "cat"; scale: number; hit: boolean }>>([]);
  const [catReaction, setCatReaction] = useState("");
  const [shakeScreen, setShakeScreen] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const catCries = [
    "MY DECORATIONS! 😿",
    "STOP IT! 😾",
    "I worked so hard! 😿",
    "NOOOO! 🙀",
    "You're so MEAN! 😿",
    "Why are you like this?! 😾",
  ];

  const startGame = () => {
    gameEndedRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(12);
    setHearts([]);
    setCatReaction("");
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

  // Spawn hearts
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = () => {
      if (gameEndedRef.current) return;
      const isCat = Math.random() < 0.15; // 15% chance cat appears
      setHearts(prev => [...prev.slice(-10), {
        id: Date.now() + Math.random(),
        x: 10 + Math.random() * 80,
        y: 15 + Math.random() * 60,
        type: isCat ? "cat" : "heart",
        scale: 0.8 + Math.random() * 0.4,
        hit: false,
      }]);
    };
    spawn();
    const interval = setInterval(spawn, 500);
    return () => clearInterval(interval);
  }, [phase]);

  const smashHeart = (id: number, type: "heart" | "cat") => {
    if (type === "cat") {
      // Hit the cat! Lose points
      setScore(s => Math.max(0, s - 20));
      setCatReaction("OW! That's ME! 😾");
      setTimeout(() => setCatReaction(""), 1000);
    } else {
      // Smash heart! Gain points
      const points = 10;
      setScore(s => {
        scoreRef.current = s + points;
        return s + points;
      });
      setCatReaction(catCries[Math.floor(Math.random() * catCries.length)]);
      setTimeout(() => setCatReaction(""), 800);
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 200);
    }
    setHearts(prev => prev.map(h => h.id === id ? { ...h, hit: true } : h));
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 200);
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-600 to-rose-800 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">💔</div>
          <h2 className="text-2xl font-bold text-red-800 mb-3">Smash the Hearts!</h2>
          <p className="text-red-600 mb-4">
            The cat decorated everything with 💕!<br/>
            <span className="font-bold">Destroy them to reject the love!</span>
          </p>
          <div className="flex justify-center gap-4 my-4">
            <div className="text-center">
              <div className="text-4xl">💕</div>
              <div className="text-xs text-green-600 font-bold">SMASH! +10</div>
            </div>
            <div className="text-center">
              <div className="text-4xl">😺</div>
              <div className="text-xs text-red-600 font-bold">DON'T HIT! -20</div>
            </div>
          </div>
          <p className="text-red-500 text-sm mb-6">
            The cat will cry but STAY STRONG! 💪
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Destroy the Love! 💔
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = score >= 50;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-red-600 to-rose-800 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{won ? "💔" : "😿"}</div>
          <h2 className="text-3xl font-bold text-red-800 mb-2">
            {won ? "Hearts Destroyed!" : "Cat Protected Them!"}
          </h2>
          <p className="text-4xl font-bold text-red-600 mb-2">{score} pts</p>
          <p className="text-red-500 italic mb-4">
            {won ? '"My beautiful decorations... 😿"' : '"Ha! You missed! 😹"'}
          </p>
          <p className="text-red-400">Next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 bg-gradient-to-b from-red-600 to-rose-800 overflow-hidden select-none transition-all",
      shakeScreen && "animate-pulse"
    )}>
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-red-600">{score} pts</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-red-600">{timeLeft}s</span>
        </div>
      </div>

      {/* Cat reaction */}
      {catReaction && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-white text-red-600 px-4 py-2 rounded-full font-bold shadow-lg">
            {catReaction}
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
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-red-200 text-sm z-10"
      >
        Skip →
      </button>

      {/* Hearts and cats */}
      {hearts.map(h => (
        <button
          key={h.id}
          onClick={() => !h.hit && smashHeart(h.id, h.type)}
          className={cn(
            "absolute transition-all duration-100",
            h.hit && "scale-0 rotate-45"
          )}
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            transform: "translate(-50%, -50%)",
            fontSize: `${h.scale * 4}rem`,
          }}
        >
          {h.type === "heart" ? "💕" : "😺"}
        </button>
      ))}

      {/* Instruction */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/80 text-lg font-medium">👆 Tap 💕 to smash! Don't hit 😺!</p>
      </div>
    </div>
  );
}

// ============================================================================
// Game 3: ESCAPE THE CAT - Run away but cat keeps blocking exits!
// ============================================================================
function EscapeTheCatGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "playing" | "done">("tutorial");
  const [playerPos, setPlayerPos] = useState(50);
  const [catPos, setCatPos] = useState(50);
  const [exits, setExits] = useState<Array<{ id: number; x: number; blocked: boolean }>>([]);
  const [escaped, setEscaped] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [catMessage, setCatMessage] = useState("");

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const escapedRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { escapedRef.current = escaped; }, [escaped]);

  const catTaunts = [
    "Where do you think YOU'RE going?! 😾",
    "BLOCKED! 😹",
    "Can't escape LOVE! 💕",
    "Nice try! 😼",
    "I'm FASTER! 😸",
  ];

  const startGame = () => {
    gameEndedRef.current = false;
    setPlayerPos(50);
    setCatPos(50);
    setEscaped(0);
    escapedRef.current = 0;
    setTimeLeft(15);
    setExits([]);
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
            setTimeout(() => onCompleteRef.current(escapedRef.current), 1500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Spawn exits
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = () => {
      if (gameEndedRef.current) return;
      setExits(prev => {
        if (prev.length >= 3) return prev;
        const x = Math.random() < 0.5 ? 10 + Math.random() * 30 : 60 + Math.random() * 30;
        return [...prev, { id: Date.now(), x, blocked: false }];
      });
    };
    spawn();
    const interval = setInterval(spawn, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  // Cat chases player and blocks exits
  useEffect(() => {
    if (phase !== "playing") return;
    const chase = setInterval(() => {
      setCatPos(prev => {
        const diff = playerPos - prev;
        return prev + diff * 0.15;
      });
      // Cat blocks nearby exits
      setExits(prev => prev.map(exit => ({
        ...exit,
        blocked: Math.abs(exit.x - catPos) < 20,
      })));
    }, 100);
    return () => clearInterval(chase);
  }, [phase, playerPos, catPos]);

  const tryExit = (exit: { id: number; x: number; blocked: boolean }) => {
    if (exit.blocked) {
      setCatMessage(catTaunts[Math.floor(Math.random() * catTaunts.length)]);
      setTimeout(() => setCatMessage(""), 1000);
    } else {
      setEscaped(e => e + 1);
      setExits(prev => prev.filter(e => e.id !== exit.id));
    }
  };

  // Handle touch/mouse for player
  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPlayerPos(Math.max(5, Math.min(95, x)));
  };

  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-700 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">🚪</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Escape the Cat!</h2>
          <p className="text-slate-600 mb-4">
            Exit doors appear! Run to them!<br/>
            <span className="font-bold text-red-500">But the cat will block you!</span>
          </p>
          <div className="flex justify-center gap-4 my-4">
            <div className="text-center">
              <div className="text-4xl">🚪</div>
              <div className="text-xs text-green-600 font-bold">Run here!</div>
            </div>
            <div className="text-center">
              <div className="text-4xl">😼</div>
              <div className="text-xs text-red-600 font-bold">Blocks you!</div>
            </div>
          </div>
          <p className="text-slate-500 text-sm mb-6">
            Slide to move! Escape through unblocked doors!
          </p>
          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
          >
            Try to Escape! 🏃
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = escaped >= 3;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-700 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white/95 rounded-3xl p-8 max-w-sm text-center shadow-2xl">
          <div className="text-6xl mb-4">{won ? "🏃" : "😹"}</div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            {won ? "You Escaped!" : "Cat Caught You!"}
          </h2>
          <p className="text-4xl font-bold text-slate-600 mb-2">{escaped} escapes</p>
          <p className="text-slate-500 italic mb-4">
            {won ? '"FINE! But you can\'t escape FOREVER!" 😾' : '"You\'re MINE now!" 😹'}
          </p>
          <p className="text-slate-400">Next challenge...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-slate-700 to-slate-900 overflow-hidden select-none"
      onMouseMove={(e) => handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
    >
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-10">
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-slate-600">Escapes: {escaped}</span>
        </div>
        <div className="bg-white/90 rounded-full px-4 py-2 shadow-lg">
          <span className="text-lg font-bold text-slate-600">{timeLeft}s</span>
        </div>
      </div>

      {/* Cat message */}
      {catMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-pink-500 text-white px-4 py-2 rounded-full font-bold">
            {catMessage}
          </div>
        </div>
      )}

      {/* Skip */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(escaped);
          }
        }}
        className="absolute top-4 right-4 bg-white/50 rounded-full px-3 py-1 text-slate-300 text-sm z-10"
      >
        Skip →
      </button>

      {/* Exits */}
      {exits.map(exit => (
        <button
          key={exit.id}
          onClick={() => tryExit(exit)}
          className={cn(
            "absolute top-1/3 text-6xl transition-all",
            exit.blocked ? "opacity-50 grayscale" : "animate-pulse"
          )}
          style={{ left: `${exit.x}%`, transform: "translateX(-50%)" }}
        >
          🚪
          {exit.blocked && (
            <span className="absolute -top-2 -right-2 text-2xl">🚫</span>
          )}
        </button>
      ))}

      {/* Cat */}
      <div
        className="absolute bottom-32 text-6xl transition-all duration-100"
        style={{ left: `${catPos}%`, transform: "translateX(-50%)" }}
      >
        😼
      </div>

      {/* Player */}
      <div
        className="absolute bottom-20 text-5xl transition-all duration-75"
        style={{ left: `${playerPos}%`, transform: "translateX(-50%)" }}
      >
        🏃
      </div>

      {/* Instruction */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/60 text-sm">👆 Slide to move! Tap 🚪 to escape!</p>
      </div>
    </div>
  );
}

// ============================================================================
// Game 4: REJECT THE LOVE LETTERS - Tear up the cat's love letters!
// ============================================================================
function RejectLettersGame({ onComplete }: { onComplete: (score: number) => void }) {
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

  const letterTexts = [
    "I love you! 💕",
    "Be mine! 💖",
    "XOXO 😘",
    "Forever yours 💗",
    "My heart is yours 💝",
    "You're purrfect! 😻",
  ];

  const catCries = [
    "MY LOVE LETTER! 😿",
    "I spent HOURS on that! 😾",
    "You're so COLD! 💔",
    "WHYYY?! 🙀",
    "*dramatic sobbing* 😿",
  ];

  const startGame = () => {
    gameEndedRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(12);
    setLetters([]);
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
        text: letterTexts[Math.floor(Math.random() * letterTexts.length)],
      }]);
    };
    spawn();
    const interval = setInterval(spawn, 800);
    return () => clearInterval(interval);
  }, [phase]);

  const tearLetter = (id: number) => {
    setLetters(prev => prev.map(l => l.id === id ? { ...l, torn: true } : l));
    setScore(s => {
      scoreRef.current = s + 10;
      return s + 10;
    });
    setCatReaction(catCries[Math.floor(Math.random() * catCries.length)]);
    setTimeout(() => setCatReaction(""), 800);
    setTimeout(() => {
      setLetters(prev => prev.filter(l => l.id !== id));
    }, 300);
  };

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
          <p className="text-rose-500 text-sm mb-6">
            Break the cat's heart! 💔
          </p>
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
          <div className="bg-white text-rose-600 px-4 py-2 rounded-full font-bold shadow-lg">
            {catReaction}
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
            "absolute transition-all duration-200 p-3 bg-white rounded-xl shadow-lg",
            l.torn && "scale-0 rotate-45 opacity-0"
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
  const [pendingScene, setPendingScene] = useState<GameScene | null>(null);
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

  // Chapter Title - use pendingScene to show the NEXT scene's title, not current
  if (showChapterTitle && pendingScene && pendingScene in CHAPTER_TITLES) {
    return <ChapterTitle chapter={pendingScene as keyof typeof CHAPTER_TITLES} onComplete={() => setShowChapterTitle(false)} />;
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

  // Game 1: Catch the NO - Collect N and O letters!
  if (scene === "chapter1_catch_no") {
    return (
      <CatchTheNoGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_smash_hearts");
        }}
      />
    );
  }

  // Game 2: Smash the Hearts - Destroy the decorations!
  if (scene === "chapter2_smash_hearts") {
    return (
      <SmashTheHeartsGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_escape");
        }}
      />
    );
  }

  // Game 3: Escape the Cat - Run for the exits!
  if (scene === "chapter2_escape") {
    return (
      <EscapeTheCatGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          nextScene("chapter2_reject_letters");
        }}
      />
    );
  }

  // Game 4: Reject the Letters - Tear them all up!
  if (scene === "chapter2_reject_letters") {
    return (
      <RejectLettersGame
        onComplete={(score: number) => {
          setStats(s => ({ ...s, totalScore: s.totalScore + score }));
          if (score >= 50) unlockAchievement("puzzle_solver");
          nextScene("chapter3_boss_battle");
        }}
      />
    );
  }

  // Final Boss Battle - The cat won't give up!
  if (scene === "chapter3_boss_battle") {
    return (
      <DramaKingBattle
        onComplete={(won: boolean) => {
          if (won) {
            unlockAchievement("rhythm_master");
            nextScene("chapter3_final");
          } else {
            // Lost - try again from letters game
            setCatMessage("You can't defeat my LOVE! 😼 Try again!");
            setScene("chapter2_reject_letters");
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
