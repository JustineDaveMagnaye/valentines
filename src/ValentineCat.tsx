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
// SOUND SYSTEM - Web Audio API based synthesizer
// ============================================================================

class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private enabled: boolean = true;
  private musicEnabled: boolean = true;
  private currentMusic: OscillatorNode[] = [];
  private musicInterval: number | null = null;

  init() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);

      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0.15;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);
    } catch {
      console.warn("Web Audio API not supported");
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = enabled ? 0.3 : 0;
    }
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (this.musicGain) {
      this.musicGain.gain.value = enabled ? 0.15 : 0;
    }
  }

  isEnabled() { return this.enabled; }
  isMusicEnabled() { return this.musicEnabled; }

  private playTone(freq: number, duration: number, type: OscillatorType = "sine", gainValue = 0.3, delay = 0) {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainValue, this.audioContext.currentTime + delay + 0.01);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(this.audioContext.currentTime + delay);
    osc.stop(this.audioContext.currentTime + delay + duration + 0.1);
  }

  private playNoise(duration: number, gainValue = 0.1) {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 2000;

    gain.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
    noise.stop(this.audioContext.currentTime + duration);
  }

  // === UI SOUNDS ===
  click() {
    this.playTone(800, 0.08, "sine", 0.2);
    this.playTone(1200, 0.05, "sine", 0.1, 0.02);
  }

  hover() {
    this.playTone(600, 0.05, "sine", 0.1);
  }

  buttonPress() {
    this.playTone(400, 0.1, "square", 0.15);
    this.playTone(600, 0.08, "square", 0.1, 0.05);
  }

  // === POSITIVE SOUNDS ===
  success() {
    this.playTone(523, 0.15, "sine", 0.25); // C5
    this.playTone(659, 0.15, "sine", 0.25, 0.1); // E5
    this.playTone(784, 0.2, "sine", 0.3, 0.2); // G5
  }

  collect() {
    this.playTone(880, 0.1, "sine", 0.2);
    this.playTone(1100, 0.1, "sine", 0.15, 0.05);
  }

  powerUp() {
    for (let i = 0; i < 5; i++) {
      this.playTone(400 + i * 100, 0.1, "sawtooth", 0.15, i * 0.05);
    }
  }

  levelUp() {
    this.playTone(523, 0.15, "square", 0.2);
    this.playTone(659, 0.15, "square", 0.2, 0.12);
    this.playTone(784, 0.15, "square", 0.2, 0.24);
    this.playTone(1047, 0.25, "square", 0.25, 0.36);
  }

  victory() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.2, "sine", 0.25, i * 0.12);
      this.playTone(freq * 1.5, 0.15, "sine", 0.1, i * 0.12);
    });
  }

  // === NEGATIVE SOUNDS ===
  hit() {
    this.playTone(200, 0.15, "sawtooth", 0.3);
    this.playNoise(0.1, 0.15);
  }

  damage() {
    this.playTone(150, 0.2, "square", 0.25);
    this.playTone(100, 0.15, "square", 0.2, 0.1);
    this.playNoise(0.15, 0.1);
  }

  fail() {
    this.playTone(300, 0.2, "sawtooth", 0.2);
    this.playTone(200, 0.3, "sawtooth", 0.25, 0.15);
  }

  gameOver() {
    this.playTone(400, 0.3, "sawtooth", 0.2);
    this.playTone(300, 0.3, "sawtooth", 0.2, 0.25);
    this.playTone(200, 0.4, "sawtooth", 0.25, 0.5);
    this.playTone(150, 0.5, "sawtooth", 0.2, 0.8);
  }

  // === ACTION SOUNDS ===
  jump() {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.15);
  }

  swoosh() {
    this.playNoise(0.15, 0.15);
    this.playTone(800, 0.1, "sine", 0.1);
  }

  pop() {
    this.playTone(600, 0.05, "sine", 0.3);
    this.playTone(900, 0.03, "sine", 0.2, 0.02);
  }

  // === DESTRUCTION SOUNDS ===
  smash() {
    this.playTone(150, 0.2, "square", 0.3);
    this.playNoise(0.2, 0.25);
    this.playTone(80, 0.15, "sawtooth", 0.2, 0.05);
  }

  burn() {
    this.playNoise(0.4, 0.2);
    this.playTone(200, 0.3, "sawtooth", 0.15);
    for (let i = 0; i < 4; i++) {
      this.playTone(100 + Math.random() * 100, 0.15, "sawtooth", 0.1, i * 0.1);
    }
  }

  shred() {
    for (let i = 0; i < 6; i++) {
      this.playNoise(0.08, 0.15);
      this.playTone(800 + i * 50, 0.05, "square", 0.1, i * 0.05);
    }
  }

  crumple() {
    this.playNoise(0.25, 0.2);
    this.playTone(300, 0.1, "sine", 0.1);
    this.playTone(250, 0.1, "sine", 0.1, 0.1);
  }

  dissolve() {
    for (let i = 0; i < 8; i++) {
      this.playTone(800 - i * 80, 0.15, "sine", 0.1, i * 0.08);
    }
    this.playNoise(0.3, 0.1);
  }

  freeze() {
    this.playTone(2000, 0.3, "sine", 0.15);
    this.playTone(1800, 0.25, "sine", 0.1, 0.1);
    this.playTone(2200, 0.2, "triangle", 0.15, 0.15);
  }

  shatter() {
    this.playNoise(0.3, 0.3);
    this.playTone(1500, 0.1, "square", 0.2);
    this.playTone(1200, 0.1, "square", 0.15, 0.05);
    this.playTone(800, 0.15, "square", 0.2, 0.1);
  }

  blackHole() {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.8);
    gain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.85);
  }

  // === BOSS BATTLE SOUNDS ===
  bossAttack() {
    this.playTone(200, 0.2, "sawtooth", 0.25);
    this.playTone(150, 0.25, "square", 0.2, 0.1);
    this.playNoise(0.15, 0.15);
  }

  bossHit() {
    this.playTone(100, 0.15, "square", 0.3);
    this.playTone(80, 0.2, "sawtooth", 0.25, 0.05);
  }

  parry() {
    this.playTone(1000, 0.1, "sine", 0.3);
    this.playTone(1500, 0.15, "sine", 0.25, 0.05);
    this.playTone(2000, 0.1, "triangle", 0.2, 0.1);
  }

  shield() {
    this.playTone(500, 0.15, "triangle", 0.2);
    this.playTone(700, 0.1, "triangle", 0.15, 0.08);
  }

  criticalHit() {
    this.playTone(800, 0.1, "sawtooth", 0.25);
    this.playTone(1200, 0.15, "sawtooth", 0.3, 0.05);
    this.playTone(1600, 0.1, "sine", 0.2, 0.12);
  }

  specialAttack() {
    for (let i = 0; i < 6; i++) {
      this.playTone(400 + i * 150, 0.15, "sawtooth", 0.2, i * 0.08);
    }
    this.playNoise(0.3, 0.15);
  }

  bossPhaseChange() {
    this.playTone(200, 0.3, "sawtooth", 0.3);
    this.playTone(250, 0.25, "sawtooth", 0.25, 0.2);
    this.playTone(300, 0.3, "sawtooth", 0.3, 0.4);
    this.playNoise(0.2, 0.2);
  }

  // === CAT SOUNDS ===
  meow() {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(900, this.audioContext.currentTime + 0.25);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.35);
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.45);
  }

  purr() {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;
    for (let i = 0; i < 4; i++) {
      this.playTone(80 + Math.random() * 20, 0.15, "sine", 0.1, i * 0.12);
    }
  }

  hiss() {
    this.playNoise(0.3, 0.2);
    this.playTone(2000, 0.2, "sawtooth", 0.1);
  }

  sadMeow() {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.4);
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.55);
  }

  // === COUNTDOWN ===
  countdown() {
    this.playTone(440, 0.15, "square", 0.2);
  }

  countdownGo() {
    this.playTone(880, 0.2, "square", 0.25);
    this.playTone(880, 0.15, "sine", 0.15, 0.1);
  }

  // === TYPING/TEXT ===
  typewriter() {
    this.playTone(800 + Math.random() * 200, 0.03, "square", 0.1);
  }

  dialogAdvance() {
    this.playTone(600, 0.08, "sine", 0.15);
    this.playTone(800, 0.06, "sine", 0.1, 0.04);
  }

  // === ACHIEVEMENT ===
  achievement() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.2, "sine", 0.2, i * 0.1);
      this.playTone(freq * 2, 0.15, "sine", 0.1, i * 0.1);
    });
  }

  // === HEART EFFECTS ===
  heartBeat() {
    this.playTone(80, 0.15, "sine", 0.2);
    this.playTone(100, 0.1, "sine", 0.15, 0.12);
  }

  heartBreak() {
    this.playTone(400, 0.1, "sawtooth", 0.2);
    this.playTone(300, 0.15, "sawtooth", 0.25, 0.08);
    this.playTone(200, 0.2, "sawtooth", 0.2, 0.18);
    this.playNoise(0.15, 0.1);
  }

  heartCollect() {
    this.playTone(800, 0.1, "sine", 0.2);
    this.playTone(1000, 0.08, "sine", 0.15, 0.05);
    this.playTone(1200, 0.1, "sine", 0.2, 0.1);
  }

  // === LETTER EFFECTS ===
  letterOpen() {
    this.playTone(600, 0.1, "sine", 0.15);
    this.playTone(800, 0.08, "sine", 0.1, 0.05);
    this.playNoise(0.05, 0.1);
  }

  letterClose() {
    this.playTone(500, 0.1, "sine", 0.15);
    this.playTone(400, 0.08, "sine", 0.1, 0.05);
  }

  // === TRANSITION SOUNDS ===
  whoosh() {
    if (!this.audioContext || !this.sfxGain || !this.enabled) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.3);
    this.playNoise(0.15, 0.1);
  }

  sceneTransition() {
    this.playTone(300, 0.2, "sine", 0.15);
    this.playTone(400, 0.15, "sine", 0.1, 0.15);
    this.playTone(500, 0.2, "sine", 0.15, 0.25);
  }

  // === MUSIC SYSTEM ===
  startTitleMusic() {
    this.stopMusic();
    if (!this.audioContext || !this.musicGain || !this.musicEnabled) return;

    const playNote = (freq: number, duration: number, delay: number) => {
      if (!this.audioContext || !this.musicGain) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + delay + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(this.audioContext.currentTime + delay);
      osc.stop(this.audioContext.currentTime + delay + duration + 0.1);
    };

    // Simple cute melody that loops
    const melody = [
      { freq: 523, dur: 0.3 }, { freq: 659, dur: 0.3 }, { freq: 784, dur: 0.4 },
      { freq: 659, dur: 0.3 }, { freq: 523, dur: 0.3 }, { freq: 392, dur: 0.4 },
      { freq: 440, dur: 0.3 }, { freq: 523, dur: 0.3 }, { freq: 659, dur: 0.5 },
      { freq: 0, dur: 0.3 },
    ];

    let time = 0;
    const playMelody = () => {
      melody.forEach(note => {
        if (note.freq > 0) playNote(note.freq, note.dur, time);
        time += note.dur + 0.05;
      });
    };

    playMelody();
    this.musicInterval = window.setInterval(() => {
      time = 0;
      playMelody();
    }, 3500);
  }

  startBattleMusic() {
    this.stopMusic();
    if (!this.audioContext || !this.musicGain || !this.musicEnabled) return;

    const playNote = (freq: number, duration: number, delay: number, type: OscillatorType = "square") => {
      if (!this.audioContext || !this.musicGain) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(this.audioContext.currentTime + delay);
      osc.stop(this.audioContext.currentTime + delay + duration + 0.1);
    };

    // Intense battle beat
    const playBeat = () => {
      let time = 0;
      for (let i = 0; i < 8; i++) {
        playNote(i % 2 === 0 ? 100 : 80, 0.15, time, "square");
        if (i % 4 === 0) playNote(200, 0.1, time, "sawtooth");
        time += 0.25;
      }
      // Add melody notes
      playNote(330, 0.2, 0, "sawtooth");
      playNote(392, 0.2, 0.5, "sawtooth");
      playNote(440, 0.2, 1.0, "sawtooth");
      playNote(392, 0.2, 1.5, "sawtooth");
    };

    playBeat();
    this.musicInterval = window.setInterval(playBeat, 2000);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.currentMusic.forEach(osc => {
      try { osc.stop(); } catch { /* ignore */ }
    });
    this.currentMusic = [];
  }
}

// Global sound manager instance
const soundManager = new SoundManager();

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
  | "ending_perfect";

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
// Romantic letter messages - longer, more dramatic
const ROMANTIC_LETTERS = [
  { opening: "My Dearest Love,", body: "Every moment without you feels like an eternity. Your smile lights up my world like a thousand suns. Please be mine forever.", closing: "Eternally yours, 🐱" },
  { opening: "To My One True Love,", body: "I've written this letter a hundred times, but words can never capture how much you mean to me. You are my everything.", closing: "With all my heart, 😻" },
  { opening: "My Beloved,", body: "When I look into your eyes, I see the stars themselves. You make my heart purr with joy. Say you'll be my Valentine!", closing: "Forever devoted, 💕" },
  { opening: "Sweetest Valentine,", body: "I dreamed of you last night. We were chasing butterflies in a field of flowers. Wake up and make my dreams come true!", closing: "Dreaming of you, 🌙" },
  { opening: "My Precious One,", body: "They say love is blind, but with you, I see everything more clearly. You are the melody to my heart's song.", closing: "Meowing for you, 🎵" },
  { opening: "Dearest Human,", body: "I knocked everything off your desk just to get your attention. Was it worth it? Absolutely. Because I love you THAT much.", closing: "Chaotically yours, 😼" },
  { opening: "To The One I Adore,", body: "I would climb the highest cat tree and cross the scariest vacuum cleaner just to be with you. That's true love.", closing: "Bravely yours, 🦁" },
  { opening: "My Sweetest Love,", body: "You had me at 'pspspsps'. Since that day, my heart has belonged to you and only you. Please never stop calling.", closing: "Always listening, 👂" },
  { opening: "Light of My Life,", body: "I've composed a sonnet about your beauty, but I ate the paper. Just know it was REALLY good. Trust me.", closing: "Poetically yours, 📝" },
  { opening: "My Heart's Desire,", body: "Some cats chase mice. Some chase birds. But I? I chase only your love. And maybe the occasional laser pointer.", closing: "Focused on you, 🔴" },
  { opening: "Beloved Valentine,", body: "I've calculated that I spend 87% of my day thinking about you. The other 13% is naps. You're basically my whole life.", closing: "Mathematically yours, 🧮" },
  { opening: "To My Soulmate,", body: "In a world of ordinary cats, you make me feel like a lion. Rawr. That means I love you in lion language.", closing: "Majestically yours, 👑" },
];

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
    glowing?: boolean;
  }>>([]);
  const [catMessage, setCatMessage] = useState("");
  const [basketX, setBasketX] = useState(50);
  const [combo, setCombo] = useState(0);
  const [lastCatch, setLastCatch] = useState<{ x: number; y: number; type: string; combo: number } | null>(null);
  const [countdownNum, setCountdownNum] = useState(3);
  const [screenShake, setScreenShake] = useState(false);
  const [catEmotion, setCatEmotion] = useState<"happy" | "angry" | "worried">("happy");
  const [catchParticles, setCatchParticles] = useState<Array<{ id: number; x: number; y: number; emoji: string; angle: number }>>([]);
  const [basketGlow, setBasketGlow] = useState(false);
  const [perfectCatch, setPerfectCatch] = useState(false);

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
    soundManager.buttonPress();
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown effect with sounds
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      soundManager.countdownGo();
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
    soundManager.countdown();
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
            if (noRef.current >= 5) {
              soundManager.levelUp();
            } else {
              soundManager.fail();
            }
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
              const isPerfect = dist < 4; // Perfect catch zone
              if (item.type === "heart") {
                // Heart caught - bad!
                soundManager.heartBreak();
                soundManager.meow();
                setCombo(0);
                comboRef.current = 0;
                setScreenShake(true);
                setTimeout(() => setScreenShake(false), 300);
                setCatMessage(CAT_TAUNTS_CATCH[Math.floor(Math.random() * CAT_TAUNTS_CATCH.length)]);
                setTimeout(() => setCatMessage(""), 1200);
                // Add broken heart particles
                const heartParticles = Array.from({ length: 6 }).map((_, i) => ({
                  id: performance.now() + i,
                  x: item.x,
                  y: item.y,
                  emoji: "💔",
                  angle: (i * 60) + Math.random() * 30,
                }));
                setCatchParticles(prev => [...prev, ...heartParticles]);
                setTimeout(() => setCatchParticles(prev => prev.filter(p => !heartParticles.includes(p))), 600);
              } else if (item.type === "star") {
                // Star bonus - adds 2 letters!
                soundManager.powerUp();
                setNoLetters(n => Math.min(n + 2, 10));
                setCombo(c => c + 1);
                comboRef.current += 1;
                setLastCatch({ x: item.x, y: item.y, type: "star", combo: comboRef.current });
                setTimeout(() => setLastCatch(null), 800);
                setBasketGlow(true);
                setTimeout(() => setBasketGlow(false), 500);
                // Add star burst particles
                const starParticles = Array.from({ length: 8 }).map((_, i) => ({
                  id: performance.now() + i,
                  x: item.x,
                  y: item.y,
                  emoji: ["⭐", "✨", "🌟"][i % 3],
                  angle: i * 45,
                }));
                setCatchParticles(prev => [...prev, ...starParticles]);
                setTimeout(() => setCatchParticles(prev => prev.filter(p => !starParticles.includes(p))), 700);
              } else {
                // N or O caught - good!
                soundManager.collect();
                if (isPerfect) soundManager.success();
                setNoLetters(n => n + 1);
                setCombo(c => c + 1);
                comboRef.current += 1;
                setLastCatch({ x: item.x, y: item.y, type: item.type, combo: comboRef.current });
                setTimeout(() => setLastCatch(null), 600);
                if (isPerfect) {
                  setPerfectCatch(true);
                  setTimeout(() => setPerfectCatch(false), 400);
                }
                setBasketGlow(true);
                setTimeout(() => setBasketGlow(false), 300);
                // Add letter catch particles
                const letterParticles = Array.from({ length: 5 }).map((_, i) => ({
                  id: performance.now() + i,
                  x: item.x,
                  y: item.y,
                  emoji: "✓",
                  angle: -90 + (i - 2) * 30,
                }));
                setCatchParticles(prev => [...prev, ...letterParticles]);
                setTimeout(() => setCatchParticles(prev => prev.filter(p => !letterParticles.includes(p))), 500);
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

  // Tutorial screen with enhanced styling
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Animated background with falling letters - optimized with CSS */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl"
              style={{
                left: `${(i * 12) % 100}%`,
                opacity: 0.15,
                animation: `floatDown ${8 + (i % 3)}s linear infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            >
              {["N", "O", "💕", "🧺"][i % 4]}
            </div>
          ))}
        </div>

        {/* Radial glow effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-white/30 relative z-10"
        >
          {/* Animated icon with glow */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-20 h-20 bg-indigo-400/30 rounded-full blur-xl"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <motion.div
              className="text-7xl relative"
              animate={{
                rotate: [0, -10, 10, -5, 5, 0],
                scale: [1, 1.1, 1, 1.05, 1]
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              🚫
            </motion.div>
          </div>

          <motion.h2
            className="text-3xl font-black mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
              Catch the NO!
            </span>
          </motion.h2>

          <motion.p
            className="text-slate-600 mb-5 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Collect the falling <span className="font-black text-red-500 text-lg mx-1">N</span> and <span className="font-black text-red-500 text-lg mx-1">O</span> letters to spell your rejection!
          </motion.p>

          {/* Enhanced item guide */}
          <motion.div
            className="flex justify-center gap-3 sm:gap-4 my-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="text-center bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-3 border-2 border-green-300 shadow-lg flex-1"
              whileHover={{ scale: 1.05, y: -2 }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            >
              <div className="text-3xl font-black text-red-500 drop-shadow-lg tracking-wider">N O</div>
              <div className="text-xs text-green-700 font-bold mt-1 flex items-center justify-center gap-1">
                <span className="text-green-500">✓</span> CATCH
              </div>
            </motion.div>
            <motion.div
              className="text-center bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl p-3 border-2 border-red-300 shadow-lg flex-1"
              whileHover={{ scale: 1.05, y: -2 }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            >
              <div className="text-3xl">💕</div>
              <div className="text-xs text-red-700 font-bold mt-1 flex items-center justify-center gap-1">
                <span className="text-red-500">✗</span> AVOID
              </div>
            </motion.div>
            <motion.div
              className="text-center bg-gradient-to-br from-yellow-50 to-amber-100 rounded-2xl p-3 border-2 border-amber-300 shadow-lg flex-1"
              whileHover={{ scale: 1.05, y: -2 }}
              animate={{ y: [0, -3, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            >
              <div className="text-3xl">⭐</div>
              <div className="text-xs text-amber-700 font-bold mt-1 flex items-center justify-center gap-1">
                <span className="text-amber-500">★</span> +2!
              </div>
            </motion.div>
          </motion.div>

          {/* Control hint with animated basket */}
          <motion.div
            className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-3 mb-5 border border-indigo-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3">
              <motion.span
                className="text-2xl"
                animate={{ x: [-10, 10, -10] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🧺
              </motion.span>
              <p className="text-indigo-700 text-sm">
                <span className="font-bold">Slide</span> to move the basket!
              </p>
            </div>
          </motion.div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white rounded-2xl font-bold text-xl shadow-xl shadow-purple-500/30 relative overflow-hidden"
            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(168, 85, 247, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <span>Start Game!</span>
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                🎮
              </motion.span>
            </span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown screen with enhanced visuals
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex items-center justify-center overflow-hidden">
        {/* Radial pulse background */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-96 h-96 rounded-full bg-white/10"
            animate={{ scale: [0, 3], opacity: [0.3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={countdownNum}
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 2, opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="relative"
          >
            {/* Glow effect behind number */}
            <div className="absolute inset-0 flex items-center justify-center blur-2xl">
              <div className="text-[200px] font-black text-white/50">
                {countdownNum || "GO!"}
              </div>
            </div>
            <div className="text-[150px] font-black text-white drop-shadow-2xl relative">
              {countdownNum || "GO!"}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Floating particles during countdown - reduced */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl opacity-30"
              style={{
                left: `${15 + (i * 14)}%`,
                bottom: "-10%",
                animation: `floatUp ${3 + (i % 2)}s linear infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            >
              {["N", "O", "⭐"][i % 3]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Done screen with enhanced styling
  if (phase === "done") {
    const won = noLetters >= 5;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Celebration particles for winning */}
        {won && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-3xl"
                style={{ left: `${5 + (i * 5)}%`, top: "-5%" }}
                initial={{ y: 0, opacity: 1 }}
                animate={{ y: "120vh", opacity: 0.5, rotate: 360 }}
                transition={{
                  duration: 3 + (i % 4) * 0.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              >
                {["🎉", "✨", "⭐", "🌟", "💫"][i % 5]}
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
        >
          {/* Background shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -skew-x-12"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />

          <div className="relative">
            <motion.div
              className="text-8xl mb-4"
              animate={won
                ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.1, 1] }
                : { y: [0, -10, 0], scale: [1, 1.05, 1] }
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {won ? "😾" : "😹"}
            </motion.div>

            <motion.h2
              className="text-3xl font-black mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className={cn(
                "bg-clip-text text-transparent",
                won
                  ? "bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600"
              )}>
                {won ? "You spelled NO!" : "Cat blocked you!"}
              </span>
            </motion.h2>

            <motion.div
              className={cn(
                "rounded-2xl p-4 mb-4",
                won ? "bg-gradient-to-br from-green-50 to-emerald-100" : "bg-indigo-50"
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-3">
                <motion.p
                  className={cn("text-5xl font-black", won ? "text-green-600" : "text-indigo-600")}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3, delay: 0.5 }}
                >
                  {noLetters}
                </motion.p>
                <div className="text-left">
                  <p className={cn("text-sm font-bold", won ? "text-green-600" : "text-indigo-500")}>
                    letters
                  </p>
                  <p className={cn("text-xs", won ? "text-green-400" : "text-indigo-400")}>
                    collected
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="bg-slate-50 rounded-xl p-3 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-slate-600 italic">
                {won ? '"Fine, but I\'m not giving up!" 😾' : '"You can\'t reject ME!" 😹'}
              </p>
            </motion.div>

            <motion.div
              className="flex items-center justify-center gap-2 text-indigo-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="w-2 h-2 bg-indigo-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 bg-indigo-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 bg-indigo-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
              />
              <span className="ml-2">Next challenge loading</span>
            </motion.div>
          </div>
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

      {/* Perfect catch indicator */}
      <AnimatePresence>
        {perfectCatch && (
          <motion.div
            initial={{ scale: 0, opacity: 1, y: 0 }}
            animate={{ scale: 1.5, opacity: 0, y: -30 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-36 z-40 pointer-events-none"
          >
            <span className="text-2xl font-black text-yellow-300 drop-shadow-lg">PERFECT!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Catch particles burst */}
      <AnimatePresence>
        {catchParticles.map(particle => (
          <motion.div
            key={particle.id}
            className="absolute pointer-events-none z-30"
            style={{ left: `${particle.x}%`, top: `${particle.y}%` }}
            initial={{ scale: 1, opacity: 1, x: 0, y: 0 }}
            animate={{
              x: Math.cos(particle.angle * Math.PI / 180) * 60,
              y: Math.sin(particle.angle * Math.PI / 180) * 60,
              scale: 0,
              opacity: 0
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="text-2xl">{particle.emoji}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Catch effect with combo display */}
      <AnimatePresence>
        {lastCatch && (
          <motion.div
            initial={{ scale: 0, opacity: 1, y: 0 }}
            animate={{ scale: 1.5, opacity: 0, y: -40 }}
            exit={{ opacity: 0 }}
            className="absolute pointer-events-none z-30"
            style={{ left: `${lastCatch.x}%`, top: `${lastCatch.y}%` }}
          >
            <div className="text-center">
              <div className={cn(
                "text-4xl font-black drop-shadow-lg",
                lastCatch.type === "star" ? "text-yellow-300" : "text-green-400"
              )}>
                {lastCatch.type === "star" ? "+2!" : "+1!"}
              </div>
              {lastCatch.combo >= 3 && (
                <div className="text-xl font-bold text-orange-300 mt-1">
                  x{lastCatch.combo}!
                </div>
              )}
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

      {/* Basket with dynamic glow effect */}
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
          {/* Dynamic glow based on basket state */}
          <motion.div
            className={cn(
              "absolute inset-0 blur-xl rounded-full",
              basketGlow ? "bg-green-400/60" : "bg-amber-400/30"
            )}
            animate={basketGlow
              ? { scale: [1.5, 2, 1.5], opacity: [0.6, 1, 0.6] }
              : { scale: 1.5 }
            }
            transition={{ duration: 0.3 }}
            style={{ width: "100%", height: "100%" }}
          />
          {/* Catch zone indicator ring */}
          <motion.div
            className="absolute -inset-3 border-2 border-white/20 rounded-full"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.span
            className="text-6xl drop-shadow-lg relative"
            animate={basketGlow ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            🧺
          </motion.span>
        </div>
      </motion.div>

      {/* Enhanced progress bar */}
      <div className="absolute bottom-8 left-4 right-4 z-10">
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-2 shadow-lg">
          <div className="flex gap-1.5 items-center">
            {["N", "O", " ", "N", "O"].map((letter, i) => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 h-8 rounded-xl flex items-center justify-center font-black text-lg transition-all duration-300",
                  i < noLetters
                    ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg shadow-green-500/30"
                    : "bg-white/20 text-white/40"
                )}
                animate={i < noLetters ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {letter !== " " ? (i < noLetters ? letter : "?") : ""}
              </motion.div>
            ))}
          </div>
          <motion.p
            className="text-white/70 text-sm mt-2 text-center font-medium"
            animate={noLetters >= 5 ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: noLetters >= 5 ? Infinity : 0 }}
          >
            {noLetters < 5 ? (
              <>Collect <span className="text-green-300 font-bold">{5 - noLetters}</span> more letters!</>
            ) : (
              <span className="text-green-300">You spelled NO! 🎉</span>
            )}
          </motion.p>
        </div>
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
    soundManager.buttonPress();
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown effect with sounds
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      soundManager.countdownGo();
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
    soundManager.countdown();
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
            soundManager.levelUp();
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
      soundManager.hiss();
      soundManager.damage();
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
      soundManager.smash();
      soundManager.specialAttack();
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
      soundManager.smash();
      if (heart.type === "gold") soundManager.powerUp();
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

  // Tutorial screen with enhanced visuals
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Animated background hearts - optimized with CSS */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl opacity-15"
              style={{
                left: `${(i * 12) % 100}%`,
                bottom: "-10%",
                animation: `floatUp ${8 + (i % 3)}s linear infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            >
              {["💕", "❤️", "💛"][i % 3]}
            </div>
          ))}
        </div>

        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative z-10 border border-white/30"
        >
          {/* Animated breaking heart icon */}
          <div className="relative mb-4">
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                className="w-20 h-20 bg-red-400/30 rounded-full blur-xl"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
            <motion.div
              className="text-7xl relative"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -10, 10, 0]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              💔
            </motion.div>
          </div>

          <motion.h2
            className="text-3xl font-black mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 bg-clip-text text-transparent">
              Smash the Hearts!
            </span>
          </motion.h2>

          <motion.p
            className="text-slate-600 mb-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            The cat covered everything with hearts!<br/>
            <span className="font-bold text-red-500 text-lg">TAP to SMASH them!</span>
          </motion.p>

          {/* Enhanced item guide with animations */}
          <motion.div
            className="grid grid-cols-5 gap-2 my-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {[
              { emoji: "💕", points: "+10", bg: "from-pink-50 to-pink-100", border: "border-pink-300", text: "text-pink-600" },
              { emoji: "❤️", points: "+15", bg: "from-red-50 to-red-100", border: "border-red-300", text: "text-red-600" },
              { emoji: "💛", points: "+25", bg: "from-yellow-50 to-amber-100", border: "border-amber-300", text: "text-amber-600" },
              { emoji: "💣", points: "ROW!", bg: "from-orange-50 to-orange-100", border: "border-orange-300", text: "text-orange-600" },
              { emoji: "😺", points: "-30!", bg: "from-slate-50 to-slate-100", border: "border-slate-300", text: "text-slate-600" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className={cn("rounded-xl p-2 border-2 shadow-sm bg-gradient-to-br", item.bg, item.border)}
                whileHover={{ scale: 1.1, y: -2 }}
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
              >
                <div className="text-2xl">{item.emoji}</div>
                <div className={cn("text-[10px] font-bold mt-1", item.text)}>{item.points}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Combo hint */}
          <motion.div
            className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 mb-5 border border-amber-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-2">
              <motion.span
                className="text-xl"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                🔥
              </motion.span>
              <p className="text-amber-700 text-sm font-medium">
                Build <span className="font-bold">combos</span> for bonus points!
              </p>
            </div>
          </motion.div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white rounded-2xl font-bold text-xl shadow-xl shadow-red-500/30 relative overflow-hidden"
            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(239, 68, 68, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <span>Start Smashing!</span>
              <motion.span
                animate={{ rotate: [0, -20, 20, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
              >
                👊
              </motion.span>
            </span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown with enhanced visuals
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex items-center justify-center overflow-hidden">
        {/* Pulse effect */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            className="w-96 h-96 rounded-full bg-white/10"
            animate={{ scale: [0, 3], opacity: [0.3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </motion.div>

        {/* Floating hearts during countdown */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-4xl opacity-30"
              style={{ left: `${10 + (i * 7)}%`, bottom: "-10%" }}
              animate={{ y: "-120vh", rotate: 360 }}
              transition={{
                duration: 2 + (i % 3) * 0.5,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "linear"
              }}
            >
              {["💕", "❤️", "💛", "💣"][i % 4]}
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={countdownNum}
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 2, opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center justify-center blur-2xl">
              <div className="text-[200px] font-black text-white/50">
                {countdownNum || "SMASH!"}
              </div>
            </div>
            <div className="text-[150px] font-black text-white drop-shadow-2xl relative">
              {countdownNum || "SMASH!"}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Done screen with enhanced visuals
  if (phase === "done") {
    const won = score >= 80;
    const smashedCount = hearts.filter(h => h.smashed).length;

    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Celebration/destruction particles */}
        {won && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-3xl"
                style={{ left: `${5 + (i * 5)}%`, top: "-5%" }}
                initial={{ y: 0, opacity: 1 }}
                animate={{ y: "120vh", opacity: 0.5, rotate: 360 }}
                transition={{
                  duration: 3 + (i % 4) * 0.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              >
                {["💔", "✨", "💥", "💫", "🔥"][i % 5]}
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
        >
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-red-100/50 to-transparent -skew-x-12"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />

          <div className="relative">
            <motion.div
              className="text-8xl mb-4"
              animate={won
                ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.15, 1] }
                : { y: [0, -10, 0], scale: [1, 1.05, 1] }
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {won ? "💔" : "😿"}
            </motion.div>

            <motion.h2
              className="text-3xl font-black mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className={cn(
                "bg-clip-text text-transparent",
                won
                  ? "bg-gradient-to-r from-red-500 via-rose-500 to-pink-500"
                  : "bg-gradient-to-r from-slate-500 to-slate-600"
              )}>
                {won ? "Hearts Destroyed!" : "Cat Protected Them!"}
              </span>
            </motion.h2>

            <motion.div
              className="grid grid-cols-2 gap-3 mb-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl p-4 border border-red-200">
                <motion.p
                  className="text-4xl font-black text-red-600"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3, delay: 0.5 }}
                >
                  {score}
                </motion.p>
                <p className="text-red-400 text-xs font-medium">points</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl p-4 border border-orange-200">
                <p className="text-4xl font-black text-orange-600">x{maxCombo}</p>
                <p className="text-orange-400 text-xs font-medium">max combo</p>
              </div>
            </motion.div>

            <motion.div
              className="bg-pink-50 rounded-xl p-3 mb-4 flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <span className="text-lg">💔</span>
              <p className="text-pink-600 text-sm font-medium">
                {smashedCount} hearts smashed
              </p>
            </motion.div>

            <motion.div
              className="bg-slate-50 rounded-xl p-3 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-slate-600 italic">
                {won ? '"My beautiful decorations... 😿"' : '"Ha! You missed! 😹"'}
              </p>
            </motion.div>

            <motion.div
              className="flex items-center justify-center gap-2 text-red-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="w-2 h-2 bg-red-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 bg-red-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 bg-red-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
              />
              <span className="ml-2">Next challenge loading</span>
            </motion.div>
          </div>
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

  // Particles for effects
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "sparkle" | "heart" | "star" | "heal" | "shield" | "dodge";
    life: number;
    maxLife: number;
    size: number;
    color: string;
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
  const [playerEmotion, setPlayerEmotion] = useState<"normal" | "scared" | "happy" | "hurt">("normal");
  const [screenShake, setScreenShake] = useState(0);
  const [scorePopups, setScorePopups] = useState<Array<{ id: number; x: number; y: number; value: number; type: "dodge" | "powerup" | "combo" }>>([]);

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

  // Spawn particles helper
  const spawnParticles = useCallback((x: number, y: number, type: "sparkle" | "heart" | "star" | "heal" | "shield" | "dodge", count: number) => {
    const colors: Record<string, string[]> = {
      sparkle: ["#fcd34d", "#fbbf24", "#f59e0b"],
      heart: ["#f472b6", "#ec4899", "#db2777"],
      star: ["#c084fc", "#a855f7", "#9333ea"],
      heal: ["#4ade80", "#22c55e", "#16a34a"],
      shield: ["#60a5fa", "#3b82f6", "#2563eb"],
      dodge: ["#818cf8", "#6366f1", "#4f46e5"],
    };
    const newParticles = Array.from({ length: Math.min(count, 6) }, (_, i) => ({
      id: performance.now() + i + Math.random() * 1000,
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 2,
      type,
      life: 1,
      maxLife: 0.5 + Math.random() * 0.3,
      size: 0.4 + Math.random() * 0.4,
      color: colors[type][Math.floor(Math.random() * colors[type].length)],
    }));
    setParticles(prev => [...prev.slice(-25), ...newParticles]);
  }, []);

  // Spawn score popup helper
  const spawnScorePopup = useCallback((x: number, y: number, value: number, type: "dodge" | "powerup" | "combo") => {
    setScorePopups(prev => [...prev.slice(-5), { id: performance.now(), x, y, value, type }]);
    setTimeout(() => setScorePopups(prev => prev.slice(1)), 1000);
  }, []);

  const startCountdown = useCallback(() => {
    soundManager.buttonPress();
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown with sounds
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      soundManager.countdownGo();
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
      setParticles([]);
      setScorePopups([]);
      setPlayerEmotion("normal");
      setScreenShake(0);
      patternIndexRef.current = 0;
      patternTimeRef.current = performance.now();
      setPhase("playing");
      return;
    }
    soundManager.countdown();
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
            if (healthRef.current > 0) {
              soundManager.levelUp();
            } else {
              soundManager.gameOver();
            }
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
          setProjectiles(prev => [...prev.slice(-18), {
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
          setProjectiles(prev => [...prev.slice(-18), {
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
          setProjectiles(prev => [...prev.slice(-18), {
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
            setProjectiles(prev => [...prev.slice(-18), {
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
                soundManager.shield();
                soundManager.parry();
                setShield(false);
                shieldRef.current = false;
                p.y = 200;
                setCatMessage("Shield blocked! 😾");
                setTimeout(() => setCatMessage(""), 800);
                setScore(s => s + 15);
                spawnParticles(playerXRef.current, playerYRef.current, "shield", 12);
                spawnScorePopup(playerXRef.current, playerYRef.current - 5, 15, "powerup");
              } else {
                soundManager.hit();
                soundManager.damage();
                setHealth(h => {
                  const newHealth = h - 1;
                  healthRef.current = newHealth;
                  if (newHealth <= 0 && !gameEndedRef.current) {
                    soundManager.gameOver();
                    gameEndedRef.current = true;
                    setPhase("done");
                    setTimeout(() => onCompleteRef.current(scoreRef.current), 2000);
                  }
                  return newHealth;
                });
                setHitFlash(true);
                setInvincible(true);
                invincibleRef.current = true;
                setScreenShake(8);
                setPlayerEmotion("hurt");
                setTimeout(() => setHitFlash(false), 150);
                setTimeout(() => setScreenShake(0), 200);
                setTimeout(() => { setInvincible(false); invincibleRef.current = false; setPlayerEmotion("normal"); }, 1500);
                setCombo(0);
                p.y = 200;
                spawnParticles(playerXRef.current, playerYRef.current, "heart", 8);
                setCatMessage(["Got you! 😻", "Feel the love! 💕", "Can't dodge forever! 😼"][Math.floor(Math.random() * 3)]);
                setTimeout(() => setCatMessage(""), 1000);
              }
            }
          });
        }

        // Score for dodged projectiles
        const dodged = updated.filter(p => p.y > 98 && p.y < 102);
        if (dodged.length > 0) {
          const points = dodged.length * 3;
          setScore(s => s + points);
          setCombo(c => {
            const newCombo = c + dodged.length;
            setMaxCombo(m => Math.max(m, newCombo));
            if (newCombo % 10 === 0 && newCombo > 0) {
              spawnScorePopup(playerXRef.current, playerYRef.current - 8, newCombo * 2, "combo");
              setScore(s => s + newCombo * 2);
              setPlayerEmotion("happy");
              setTimeout(() => setPlayerEmotion("normal"), 500);
            }
            return newCombo;
          });
          spawnParticles(50, 95, "dodge", Math.min(dodged.length * 2, 6));
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
            soundManager.powerUp();
            if (pu.type === "shield") {
              soundManager.shield();
              setShield(true);
              shieldRef.current = true;
              setCatMessage("A shield?! No fair! 😾");
              spawnParticles(pu.x, pu.y, "shield", 10);
            } else if (pu.type === "heal") {
              soundManager.heartCollect();
              setHealth(h => Math.min(h + 1, 5));
              healthRef.current = Math.min(healthRef.current + 1, 5);
              setCatMessage("Healing?! 🙀");
              spawnParticles(pu.x, pu.y, "heal", 10);
              setPlayerEmotion("happy");
              setTimeout(() => setPlayerEmotion("normal"), 800);
            } else if (pu.type === "slow") {
              setSlowMo(true);
              slowMoRef.current = true;
              setTimeout(() => { setSlowMo(false); slowMoRef.current = false; }, 4000);
              setCatMessage("Time slow?! 😾");
              spawnParticles(pu.x, pu.y, "star", 10);
            }
            setTimeout(() => setCatMessage(""), 1000);
            setScore(s => s + 25);
            spawnScorePopup(pu.x, pu.y - 5, 25, "powerup");
            return false;
          }
          return true;
        });
      });

      // Update particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx * deltaTime * 60,
        y: p.y + p.vy * deltaTime * 60,
        vy: p.vy + deltaTime * 15,
        life: p.life - deltaTime / p.maxLife,
      })).filter(p => p.life > 0));

      // Clean old trail
      setTrail(prev => prev.filter(t => currentTime - t.id < 400));

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, currentPattern, executePattern, patterns, spawnParticles, spawnScorePopup]);

  const handleMove = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    targetXRef.current = Math.max(5, Math.min(95, x));
    targetYRef.current = Math.max(28, Math.min(92, y));
  }, []);

  // Tutorial with enhanced visuals
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Animated stars background - optimized with CSS */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 7) % 100}%`,
                top: `${(i * 13 + 5) % 100}%`,
                width: i % 3 === 0 ? "2px" : "1px",
                height: i % 3 === 0 ? "2px" : "1px",
                opacity: 0.5,
                animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i % 4) * 0.4}s`,
              }}
            />
          ))}
        </div>

        {/* Floating projectile preview - reduced */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`projectile-${i}`}
              className="absolute text-xl opacity-15"
              style={{
                left: `${15 + (i * 18)}%`,
                animation: `floatDown ${7 + (i % 3)}s linear infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            >
              {["💕", "💋", "✨"][i % 3]}
            </div>
          ))}
        </div>

        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative z-10 border border-purple-300/50"
        >
          {/* Animated cat icon with glow */}
          <div className="relative mb-3">
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                className="w-20 h-20 bg-purple-500/30 rounded-full blur-xl"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
            <motion.div
              className="text-7xl relative"
              animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              😻
            </motion.div>
          </div>

          <motion.h2
            className="text-3xl font-black mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 bg-clip-text text-transparent">
              Dodge the Love!
            </span>
          </motion.h2>

          <motion.p
            className="text-slate-600 mb-4 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            The cat won't stop throwing love at you!<br/>
            <span className="font-bold text-purple-600">Survive the attack patterns!</span>
          </motion.p>

          {/* Projectile types with animation */}
          <motion.div
            className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-3 mb-4 border border-purple-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { emoji: "💕", label: "Hearts" },
                { emoji: "💋", label: "Kisses" },
                { emoji: "✨", label: "Sparkles" },
                { emoji: "💗", label: "Big!" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="text-center"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                >
                  <div className="text-2xl">{item.emoji}</div>
                  <div className="text-[8px] text-purple-500 font-medium">{item.label}</div>
                </motion.div>
              ))}
            </div>
            <p className="text-purple-600 text-xs font-medium">Dodge all the love projectiles!</p>
          </motion.div>

          {/* Power-ups with animation */}
          <motion.div
            className="grid grid-cols-3 gap-2 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {[
              { emoji: "🛡️", label: "Block 1 hit", bg: "from-blue-50 to-blue-100", border: "border-blue-200", text: "text-blue-600" },
              { emoji: "💚", label: "+1 Health", bg: "from-green-50 to-green-100", border: "border-green-200", text: "text-green-600" },
              { emoji: "⏰", label: "Slow time", bg: "from-amber-50 to-amber-100", border: "border-amber-200", text: "text-amber-600" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className={cn("rounded-xl p-2 text-center border-2 bg-gradient-to-br shadow-sm", item.bg, item.border)}
                whileHover={{ scale: 1.05, y: -2 }}
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              >
                <div className="text-xl">{item.emoji}</div>
                <div className={cn("text-[9px] font-bold", item.text)}>{item.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Control hint */}
          <motion.div
            className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-3 mb-4 border border-slate-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3">
              <motion.span
                className="text-2xl"
                animate={{ x: [-8, 8, -8], y: [-3, 3, -3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                👆
              </motion.span>
              <p className="text-slate-700 text-sm font-medium">
                <span className="font-bold">Drag</span> to move your character!
              </p>
            </div>
          </motion.div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-purple-500/30 relative overflow-hidden"
            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(168, 85, 247, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <span>Ready to Dodge!</span>
              <motion.span
                animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                ⚡
              </motion.span>
            </span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown with enhanced visuals
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900 flex items-center justify-center overflow-hidden">
        {/* Pulsing rings */}
        <motion.div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-96 h-96 rounded-full border-2 border-purple-400/30"
            animate={{ scale: [0, 2], opacity: [0.5, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </motion.div>

        {/* Stars during countdown */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 5 + 2) % 100}%`,
                top: `${(i * 7 + 5) % 100}%`,
                width: i % 3 === 0 ? "3px" : "2px",
                height: i % 3 === 0 ? "3px" : "2px",
              }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={countdownNum}
            initial={{ scale: 3, opacity: 0, rotate: 180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center justify-center blur-2xl">
              <div className="text-[180px] font-black text-purple-400/50">
                {countdownNum || "GO!"}
              </div>
            </div>
            <div className="text-[140px] font-black text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.8)] relative">
              {countdownNum || "GO!"}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Done screen with enhanced visuals
  if (phase === "done") {
    const survived = health > 0;
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900 to-violet-900 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Celebration/defeat particles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              style={{ left: `${5 + (i * 5)}%`, top: survived ? "-5%" : "50%" }}
              initial={{ y: 0, opacity: 1 }}
              animate={{
                y: survived ? "120vh" : [-20, 20],
                opacity: survived ? [1, 0.5] : [0.3, 0.6, 0.3],
                rotate: survived ? 360 : [0, 10, -10, 0],
              }}
              transition={{
                duration: survived ? (3 + (i % 4) * 0.5) : 3,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            >
              {survived ? ["🎉", "✨", "⭐", "🌟", "💫"][i % 5] : ["💕", "💗", "💋", "✨"][i % 4]}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-purple-300/50 relative overflow-hidden"
        >
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-100/50 to-transparent -skew-x-12"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />

          <div className="relative">
            <motion.div
              className="text-8xl mb-4"
              animate={survived
                ? { y: [0, -15, 0], rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }
                : { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {survived ? "🎉" : "😻"}
            </motion.div>

            <motion.h2
              className="text-3xl font-black mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className={cn(
                "bg-clip-text text-transparent",
                survived
                  ? "bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"
                  : "bg-gradient-to-r from-purple-600 to-pink-500"
              )}>
                {survived ? "You Survived!" : "Caught by Love!"}
              </span>
            </motion.h2>

            <motion.div
              className="grid grid-cols-3 gap-2 mb-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-3 border border-purple-200">
                <motion.p
                  className="text-3xl font-black text-purple-600"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3, delay: 0.5 }}
                >
                  {score}
                </motion.p>
                <p className="text-purple-400 text-[10px] font-medium">POINTS</p>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-3 border border-pink-200">
                <p className="text-3xl font-black text-pink-600">x{maxCombo}</p>
                <p className="text-pink-400 text-[10px] font-medium">COMBO</p>
              </div>
              <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl p-3 border border-rose-200">
                <div className="flex items-center justify-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={cn("text-sm", i < health ? "" : "opacity-30")}>
                      {i < health ? "❤️" : "🖤"}
                    </span>
                  ))}
                </div>
                <p className="text-rose-400 text-[10px] font-medium">HP LEFT</p>
              </div>
            </motion.div>

            <motion.div
              className="bg-slate-50 rounded-xl p-3 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-slate-600 italic">
                {survived ? '"You got lucky this time!" 😾' : '"You can\'t resist my love!" 😻'}
              </p>
            </motion.div>

            <motion.div
              className="flex items-center justify-center gap-2 text-purple-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="w-2 h-2 bg-purple-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 bg-purple-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 bg-purple-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
              />
              <span className="ml-2">Next challenge loading</span>
            </motion.div>
          </div>
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
      animate={hitFlash
        ? { backgroundColor: ["#dc2626", "transparent"] }
        : screenShake > 0
          ? { x: [0, -screenShake, screenShake, -screenShake/2, 0], y: [0, screenShake/2, -screenShake/2, screenShake/3, 0] }
          : {}
      }
      transition={{ duration: screenShake > 0 ? 0.2 : 0.15 }}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect());
      }}
    >
      {/* Animated star field background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 17 + 3) % 100}%`,
              top: `${(i * 23 + 7) % 100}%`,
              width: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
              height: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: i % 5 === 0 ? [1, 1.5, 1] : [1, 1.2, 1],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: (i * 0.1) % 2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Ambient floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={`ambient-${i}`}
            className="absolute w-2 h-2 rounded-full bg-pink-400/20 blur-sm"
            style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{
              y: [0, -30, 0],
              x: [0, 10 * (i % 2 === 0 ? 1 : -1), 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
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
          <div className="absolute inset-0 bg-blue-500/10" />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border-2 border-blue-400/20 rounded-full"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] border border-cyan-400/15 rounded-full"
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
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
      {trail.map((t, index) => (
        <motion.div
          key={t.id}
          className="absolute pointer-events-none z-5"
          style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%, -50%)" }}
          initial={{ opacity: 0.5, scale: 0.9 }}
          animate={{ opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="rounded-full"
            style={{
              width: `${24 - index * 2}px`,
              height: `${24 - index * 2}px`,
              background: `linear-gradient(135deg, rgba(168, 85, 247, ${0.4 - index * 0.04}), rgba(236, 72, 153, ${0.3 - index * 0.03}))`,
            }}
          />
        </motion.div>
      ))}

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute pointer-events-none z-25"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
            opacity: p.life,
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: `${p.size * 8}px`,
              height: `${p.size * 8}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            }}
          />
        </div>
      ))}

      {/* Score popups */}
      <AnimatePresence>
        {scorePopups.map(popup => (
          <motion.div
            key={popup.id}
            className="absolute pointer-events-none z-30"
            style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -30, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className={cn(
              "font-black text-lg drop-shadow-lg",
              popup.type === "dodge" && "text-indigo-300",
              popup.type === "powerup" && "text-emerald-300",
              popup.type === "combo" && "text-yellow-300"
            )}>
              +{popup.value}
              {popup.type === "combo" && " COMBO!"}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

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
          {/* Outer glow ring */}
          <motion.div
            className={cn(
              "absolute rounded-full blur-md",
              playerEmotion === "hurt" ? "bg-red-400/40" :
              playerEmotion === "happy" ? "bg-yellow-400/40" :
              "bg-purple-400/30"
            )}
            style={{ width: "56px", height: "56px", left: "-8px", top: "-8px" }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: playerEmotion === "hurt" ? [0.6, 0.3, 0.6] : [0.4, 0.6, 0.4],
            }}
            transition={{ duration: playerEmotion === "hurt" ? 0.3 : 1.5, repeat: Infinity }}
          />

          {/* Shield effect */}
          {shield && (
            <>
              <motion.div
                className="absolute rounded-full border-2 border-blue-400/80"
                style={{ width: "64px", height: "64px", left: "-12px", top: "-12px" }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 0.4, 0.8] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <motion.div
                className="absolute rounded-full bg-blue-400/20"
                style={{ width: "60px", height: "60px", left: "-10px", top: "-10px" }}
                animate={{ scale: [1.05, 1, 1.05] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              {/* Shield sparkles */}
              {[0, 1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 bg-blue-300 rounded-full"
                  style={{
                    left: `${20 + Math.cos(i * Math.PI / 2) * 28}px`,
                    top: `${20 + Math.sin(i * Math.PI / 2) * 28}px`,
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.5],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </>
          )}

          {/* Invincibility effect */}
          {invincible && (
            <>
              <motion.div
                className="absolute rounded-full bg-white/40"
                style={{ width: "52px", height: "52px", left: "-6px", top: "-6px" }}
                animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3, repeat: Infinity }}
              />
              {[0, 1, 2, 3, 4, 5].map(i => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  style={{
                    left: `${20 + Math.cos(i * Math.PI / 3) * 24}px`,
                    top: `${20 + Math.sin(i * Math.PI / 3) * 24}px`,
                  }}
                  animate={{
                    opacity: [1, 0],
                    y: [-5, -15],
                  }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </>
          )}

          {/* Character body */}
          <motion.div
            className="relative"
            animate={
              playerEmotion === "hurt"
                ? { rotate: [-5, 5, -5, 5, 0], y: [0, -3, 0] }
                : playerEmotion === "happy"
                  ? { y: [0, -4, 0], scale: [1, 1.05, 1] }
                  : { y: [0, -3, 0] }
            }
            transition={{
              duration: playerEmotion === "hurt" ? 0.3 : playerEmotion === "happy" ? 0.4 : 0.8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {/* Main body */}
            <div
              className={cn(
                "w-10 h-10 rounded-full border-2 shadow-xl relative overflow-hidden",
                playerEmotion === "hurt"
                  ? "bg-gradient-to-b from-red-300 to-red-400 border-red-200"
                  : playerEmotion === "happy"
                    ? "bg-gradient-to-b from-yellow-200 to-amber-300 border-yellow-100"
                    : "bg-gradient-to-b from-violet-300 to-purple-400 border-violet-200"
              )}
              style={{ transform: playerFacing === "left" ? "scaleX(-1)" : "scaleX(1)" }}
            >
              {/* Body shine */}
              <div className="absolute top-1 left-1 w-3 h-3 bg-white/40 rounded-full blur-sm" />
              <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-white/60 rounded-full" />

              {/* Eyes */}
              <motion.div
                className="absolute top-2.5 left-1.5 w-2.5 h-3 bg-white rounded-full shadow-inner"
                animate={playerEmotion === "scared" ? { scaleY: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3, repeat: playerEmotion === "scared" ? Infinity : 0 }}
              >
                <motion.div
                  className="absolute bg-slate-800 rounded-full"
                  style={{
                    width: playerEmotion === "hurt" ? "4px" : "5px",
                    height: playerEmotion === "hurt" ? "4px" : "5px",
                    bottom: playerEmotion === "hurt" ? "3px" : "2px",
                    left: "3px",
                  }}
                  animate={playerEmotion === "happy" ? { y: [0, -1, 0] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                {/* Eye shine */}
                <div className="absolute top-1 right-0.5 w-1 h-1 bg-white rounded-full" />
              </motion.div>
              <motion.div
                className="absolute top-2.5 right-1.5 w-2.5 h-3 bg-white rounded-full shadow-inner"
                animate={playerEmotion === "scared" ? { scaleY: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3, repeat: playerEmotion === "scared" ? Infinity : 0 }}
              >
                <motion.div
                  className="absolute bg-slate-800 rounded-full"
                  style={{
                    width: playerEmotion === "hurt" ? "4px" : "5px",
                    height: playerEmotion === "hurt" ? "4px" : "5px",
                    bottom: playerEmotion === "hurt" ? "3px" : "2px",
                    left: "3px",
                  }}
                  animate={playerEmotion === "happy" ? { y: [0, -1, 0] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                {/* Eye shine */}
                <div className="absolute top-1 right-0.5 w-1 h-1 bg-white rounded-full" />
              </motion.div>

              {/* Eyebrows for hurt */}
              {playerEmotion === "hurt" && (
                <>
                  <div className="absolute top-1.5 left-1.5 w-2.5 h-0.5 bg-slate-700 rounded-full rotate-12" />
                  <div className="absolute top-1.5 right-1.5 w-2.5 h-0.5 bg-slate-700 rounded-full -rotate-12" />
                </>
              )}

              {/* Blush marks */}
              <motion.div
                className={cn(
                  "absolute top-5 left-0 w-2 h-1.5 rounded-full",
                  playerEmotion === "happy" ? "bg-orange-300/80" : "bg-pink-300/50"
                )}
                animate={playerEmotion === "happy" ? { opacity: [0.6, 0.9, 0.6] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.div
                className={cn(
                  "absolute top-5 right-0 w-2 h-1.5 rounded-full",
                  playerEmotion === "happy" ? "bg-orange-300/80" : "bg-pink-300/50"
                )}
                animate={playerEmotion === "happy" ? { opacity: [0.6, 0.9, 0.6] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />

              {/* Mouth - changes with emotion */}
              {playerEmotion === "happy" ? (
                <motion.div
                  className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-2 border-b-2 border-l-2 border-r-2 border-slate-700 rounded-b-full bg-pink-200/50"
                  animate={{ scaleY: [1, 1.1, 1] }}
                  transition={{ duration: 0.4, repeat: Infinity }}
                />
              ) : playerEmotion === "hurt" ? (
                <motion.div
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2.5 h-1.5 border-t-2 border-slate-700 rounded-t-full"
                  animate={{ scaleX: [1, 0.9, 1] }}
                  transition={{ duration: 0.2, repeat: Infinity }}
                />
              ) : (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-1.5 border-b-2 border-slate-600 rounded-b-full" />
              )}
            </div>

            {/* Little feet */}
            <motion.div
              className="absolute -bottom-1 left-1 w-2 h-1.5 bg-purple-400 rounded-full"
              animate={{ rotate: [-5, 5, -5] }}
              transition={{ duration: 0.4, repeat: Infinity }}
            />
            <motion.div
              className="absolute -bottom-1 right-1 w-2 h-1.5 bg-purple-400 rounded-full"
              animate={{ rotate: [5, -5, 5] }}
              transition={{ duration: 0.4, repeat: Infinity, delay: 0.2 }}
            />
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

// Game 4: REJECT THE LOVE LETTERS - Interactive letter opening with burn/rip mechanics
const RejectLettersGame = memo(function RejectLettersGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "reading" | "done">("tutorial");
  const [countdownNum, setCountdownNum] = useState(3);

  // Letter queue - letters waiting to be opened
  const [letterQueue, setLetterQueue] = useState<Array<{
    id: number;
    message: typeof ROMANTIC_LETTERS[0];
    isGold: boolean;
    envelope: "pink" | "red" | "gold" | "purple";
  }>>([]);

  // Currently open letter
  const [openLetter, setOpenLetter] = useState<{
    id: number;
    message: typeof ROMANTIC_LETTERS[0];
    isGold: boolean;
  } | null>(null);

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [lettersDestroyed, setLettersDestroyed] = useState(0);
  const [burnCount, setBurnCount] = useState(0);
  const [ripCount, setRipCount] = useState(0);
  const [catEmotion, setCatEmotion] = useState<"hopeful" | "nervous" | "crying" | "devastated">("hopeful");
  const [catMessage, setCatMessage] = useState("");
  const [screenShake, setScreenShake] = useState(0);

  // Destruction animation state
  const [destruction, setDestruction] = useState<{
    type: "burn" | "rip" | "shred" | "crumple" | "dissolve" | "freeze" | "blackhole" | null;
    progress: number;
    shredLines?: number[];
    crumpleAngle?: number;
    freezeCracks?: Array<{ x: number; y: number; angle: number }>;
  }>({ type: null, progress: 0 });

  // Particles
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "fire" | "ash" | "paper" | "ember" | "sparkle" | "shred" | "ice" | "bubble" | "void" | "confetti";
    life: number;
    size: number;
    color: string;
    rotation: number;
    width?: number;
    height?: number;
    text?: string;
  }>>([]);

  // Score popups
  const [scorePopups, setScorePopups] = useState<Array<{
    id: number;
    x: number;
    y: number;
    value: number;
    text: string;
  }>>([]);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Spawn particles helper
  const spawnParticles = useCallback((
    x: number,
    y: number,
    type: "fire" | "ash" | "paper" | "ember" | "sparkle" | "shred" | "ice" | "bubble" | "void" | "confetti",
    count: number,
    spread: number = 1,
    extras?: { width?: number; height?: number; text?: string }
  ) => {
    const colors: Record<string, string[]> = {
      fire: ["#ff4500", "#ff6b35", "#ffa500", "#ffcc00", "#ff0000"],
      ash: ["#4a4a4a", "#6b6b6b", "#8b8b8b", "#2d2d2d"],
      paper: ["#fff5f5", "#ffe4e6", "#fecdd3", "#fda4af", "#ffffff"],
      ember: ["#ff4500", "#ff6b00", "#ffcc00"],
      sparkle: ["#ffd700", "#ffec8b", "#fff8dc"],
      shred: ["#fff5f5", "#ffe4e6", "#fecdd3", "#fff0f3", "#ffffff", "#fdf2f8"],
      ice: ["#a5f3fc", "#67e8f9", "#22d3ee", "#e0f2fe", "#bae6fd", "#7dd3fc"],
      bubble: ["#a855f7", "#c084fc", "#d8b4fe", "#9333ea", "#7c3aed"],
      void: ["#1e1b4b", "#312e81", "#3730a3", "#000000", "#0f0f23"],
      confetti: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3", "#f38181", "#aa96da", "#fcbad3"],
    };
    const newParticles = Array.from({ length: count }, (_, i) => {
      const isShred = type === "shred";
      const isIce = type === "ice";
      const isVoid = type === "void";
      return {
        id: performance.now() + i + Math.random() * 1000,
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: isVoid ? (50 - x) * 0.1 + (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 10 * spread,
        vy: type === "fire" || type === "ember"
          ? -Math.random() * 8 - 2
          : isShred
            ? Math.random() * 3 + 2
            : isIce
              ? (Math.random() - 0.5) * 15
              : isVoid
                ? (50 - y) * 0.1 + (Math.random() - 0.5) * 2
                : (Math.random() - 0.5) * 10 * spread,
        type,
        life: 1,
        size: type === "fire" ? 8 + Math.random() * 8
          : type === "paper" ? 6 + Math.random() * 10
          : isShred ? 3 + Math.random() * 2
          : isIce ? 6 + Math.random() * 10
          : isVoid ? 4 + Math.random() * 6
          : 4 + Math.random() * 4,
        color: colors[type][Math.floor(Math.random() * colors[type].length)],
        rotation: Math.random() * 360,
        width: isShred ? (extras?.width || 4 + Math.random() * 8) : undefined,
        height: isShred ? (extras?.height || 20 + Math.random() * 30) : undefined,
        text: extras?.text,
      };
    });
    setParticles(prev => [...prev.slice(-50), ...newParticles.slice(0, Math.min(count, 15))]);
  }, []);

  // Spawn score popup
  const spawnScorePopup = useCallback((x: number, y: number, value: number, text: string) => {
    setScorePopups(prev => [...prev.slice(-5), { id: performance.now(), x, y, value, text }]);
    setTimeout(() => setScorePopups(prev => prev.slice(1)), 1200);
  }, []);

  const startCountdown = useCallback(() => {
    soundManager.buttonPress();
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown with sounds
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      soundManager.countdownGo();
      gameEndedRef.current = false;
      setScore(0);
      scoreRef.current = 0;
      setTimeLeft(45);
      setLetterQueue([]);
      setOpenLetter(null);
      setLettersDestroyed(0);
      setBurnCount(0);
      setRipCount(0);
      setParticles([]);
      setScorePopups([]);
      setCatEmotion("hopeful");
      setDestruction({ type: null, progress: 0 });
      setPhase("playing");
      return;
    }
    soundManager.countdown();
    const timer = setTimeout(() => setCountdownNum(c => c - 1), 600);
    return () => clearTimeout(timer);
  }, [phase, countdownNum]);

  // Timer
  useEffect(() => {
    if (phase !== "playing" && phase !== "reading") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            soundManager.levelUp();
            setPhase("done");
            setTimeout(() => onCompleteRef.current(scoreRef.current), 2500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Spawn new letters
  useEffect(() => {
    if (phase !== "playing") return;

    const spawnLetter = () => {
      if (gameEndedRef.current) return;

      const envelopes: Array<"pink" | "red" | "gold" | "purple"> = ["pink", "red", "gold", "purple"];
      const isGold = Math.random() < 0.15;

      setLetterQueue(prev => {
        if (prev.length >= 5) return prev; // Max 5 in queue
        return [...prev, {
          id: Date.now() + Math.random(),
          message: ROMANTIC_LETTERS[Math.floor(Math.random() * ROMANTIC_LETTERS.length)],
          isGold,
          envelope: isGold ? "gold" : envelopes[Math.floor(Math.random() * envelopes.length)],
        }];
      });
    };

    spawnLetter();
    const interval = setInterval(spawnLetter, 2500);
    return () => clearInterval(interval);
  }, [phase]);

  // Update particles
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx * 0.3,
        y: p.y + p.vy * 0.3,
        vy: p.type === "fire" || p.type === "ember" ? p.vy - 0.1 : p.vy + 0.2,
        life: p.life - (p.type === "fire" ? 0.04 : 0.025),
        rotation: p.rotation + p.vx,
        size: p.type === "fire" ? p.size * 0.97 : p.size,
      })).filter(p => p.life > 0));
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  // Update cat emotion
  useEffect(() => {
    if (lettersDestroyed >= 10) setCatEmotion("devastated");
    else if (lettersDestroyed >= 6) setCatEmotion("crying");
    else if (lettersDestroyed >= 3) setCatEmotion("nervous");
    else setCatEmotion("hopeful");
  }, [lettersDestroyed]);

  // Open a letter
  const handleOpenLetter = useCallback((letter: typeof letterQueue[0]) => {
    soundManager.letterOpen();
    setLetterQueue(prev => prev.filter(l => l.id !== letter.id));
    setOpenLetter({
      id: letter.id,
      message: letter.message,
      isGold: letter.isGold,
    });
    setPhase("reading");
    setCatMessage("They're reading it! 😻");
    setTimeout(() => setCatMessage(""), 1500);
  }, []);

  // Destroy letter with burn
  const handleBurn = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.burn();
    setDestruction({ type: "burn", progress: 0 });

    // Animate burn progress
    let progress = 0;
    const burnInterval = setInterval(() => {
      progress += 0.05;
      setDestruction({ type: "burn", progress });

      // Spawn fire particles during burn
      if (progress < 1) {
        spawnParticles(50, 50 + progress * 20, "fire", 3);
        spawnParticles(50 + (Math.random() - 0.5) * 30, 40 + progress * 30, "ember", 2);
        if (progress > 0.5) {
          spawnParticles(50 + (Math.random() - 0.5) * 40, 50, "ash", 1);
        }
      }

      if (progress >= 1) {
        clearInterval(burnInterval);
        soundManager.success();

        // Calculate score
        const basePoints = openLetter.isGold ? 30 : 15;
        const bonus = 10; // Burn bonus
        const total = basePoints + bonus;

        setScore(s => s + total);
        setLettersDestroyed(d => d + 1);
        setBurnCount(b => b + 1);

        // Big fire explosion
        spawnParticles(50, 50, "fire", 20, 1.5);
        spawnParticles(50, 50, "ember", 15, 2);
        spawnParticles(50, 50, "ash", 10, 1.5);

        spawnScorePopup(50, 40, total, "🔥 BURNED!");

        setScreenShake(8);
        setTimeout(() => setScreenShake(0), 300);

        setCatMessage(pick(["MY WORDS ARE ASHES! 😭", "IT BURNS! 🔥😿", "All that poetry... gone! 😿", "You're so cruel! 😾"]));
        setTimeout(() => setCatMessage(""), 1500);

        // Reset
        setTimeout(() => {
          setOpenLetter(null);
          setDestruction({ type: null, progress: 0 });
          setPhase("playing");
        }, 400);
      }
    }, 30);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Destroy letter with rip - enhanced with tiny pieces flying
  const handleRip = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.shred();
    setDestruction({ type: "rip", progress: 0 });

    // Animate rip progress with more dramatic tearing
    let progress = 0;
    let ripPhase = 0;
    const ripInterval = setInterval(() => {
      progress += 0.04;
      ripPhase++;
      setDestruction({ type: "rip", progress });

      // Spawn tiny paper pieces continuously as it rips
      if (progress < 1) {
        // Create tearing effect - pieces fly from the rip line
        const ripX = 50 + (progress - 0.5) * 30;
        for (let i = 0; i < 3; i++) {
          spawnParticles(ripX + (Math.random() - 0.5) * 20, 40 + Math.random() * 20, "paper", 1, 1.2);
        }
        // Additional tiny confetti pieces
        if (ripPhase % 2 === 0) {
          spawnParticles(50 + (Math.random() - 0.5) * 40, 50, "confetti", 2, 0.8);
        }
      }

      if (progress >= 1) {
        clearInterval(ripInterval);
        soundManager.pop();

        // Calculate score
        const basePoints = openLetter.isGold ? 25 : 12;
        const total = basePoints;

        setScore(s => s + total);
        setLettersDestroyed(d => d + 1);
        setRipCount(r => r + 1);

        // Massive paper explosion - LOTS of tiny pieces
        for (let wave = 0; wave < 4; wave++) {
          setTimeout(() => {
            spawnParticles(40 + wave * 8, 45, "paper", 10, 2.5);
            spawnParticles(50, 50, "confetti", 5, 2);
          }, wave * 50);
        }
        if (openLetter.isGold) {
          spawnParticles(50, 50, "sparkle", 15, 2);
        }

        spawnScorePopup(50, 40, total, "✂️ TORN APART!");

        setScreenShake(8);
        setTimeout(() => setScreenShake(0), 300);

        setCatMessage(pick(["MY LETTER! 😿", "In PIECES! 💔", "TORN TO SHREDS! 😭", "How could you?! 🙀"]));
        setTimeout(() => setCatMessage(""), 1500);

        // Reset
        setTimeout(() => {
          setOpenLetter(null);
          setDestruction({ type: null, progress: 0 });
          setPhase("playing");
        }, 400);
      }
    }, 20);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Destroy letter with SHRED - realistic paper shredder effect
  const handleShred = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.shred();
    // Generate shred line positions
    const shredLines = Array.from({ length: 12 }, (_, i) => 8 + i * 7 + (i % 2) * 2);
    setDestruction({ type: "shred", progress: 0, shredLines });

    let progress = 0;
    const shredInterval = setInterval(() => {
      progress += 0.02;
      setDestruction(prev => ({ ...prev, progress }));

      // Spawn thin paper strips falling continuously
      if (progress < 1 && progress > 0.1) {
        const stripX = 30 + Math.random() * 40;
        for (let i = 0; i < 3; i++) {
          spawnParticles(stripX + i * 5, 55 + progress * 20, "shred", 1, 0.3, {
            width: 3 + Math.random() * 4,
            height: 15 + Math.random() * 25
          });
        }
      }

      if (progress >= 1) {
        clearInterval(shredInterval);
        soundManager.success();

        const basePoints = openLetter.isGold ? 35 : 20;
        const bonus = 15;
        const total = basePoints + bonus;

        setScore(s => s + total);
        setLettersDestroyed(d => d + 1);

        // Massive shred explosion - tons of tiny strips
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            spawnParticles(35 + i * 4, 50, "shred", 8, 1.5, {
              width: 2 + Math.random() * 3,
              height: 12 + Math.random() * 20
            });
          }, i * 30);
        }
        spawnParticles(50, 50, "confetti", 15, 2);

        spawnScorePopup(50, 40, total, "📄 SHREDDED!");

        setScreenShake(10);
        setTimeout(() => setScreenShake(0), 400);

        setCatMessage(pick(["INTO CONFETTI! 😭", "MY POETRY! 🙀", "So many pieces! 😿", "You monster! 😾"]));
        setTimeout(() => setCatMessage(""), 1500);

        setTimeout(() => {
          setOpenLetter(null);
          setDestruction({ type: null, progress: 0 });
          setPhase("playing");
        }, 500);
      }
    }, 25);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Destroy letter with CRUMPLE - ball it up and toss
  const handleCrumple = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.crumple();
    const crumpleAngle = (Math.random() - 0.5) * 60;
    setDestruction({ type: "crumple", progress: 0, crumpleAngle });

    let progress = 0;
    const crumpleInterval = setInterval(() => {
      progress += 0.025;
      setDestruction(prev => ({ ...prev, progress }));

      // Paper crinkle particles during crumple
      if (progress < 0.6 && progress > 0.1) {
        spawnParticles(50 + (Math.random() - 0.5) * 20, 50, "paper", 2, 0.5);
      }

      if (progress >= 1) {
        clearInterval(crumpleInterval);

        soundManager.pop();
        const basePoints = openLetter.isGold ? 30 : 18;
        const total = basePoints;

        setScore(s => s + total);
        setLettersDestroyed(d => d + 1);

        // Paper ball bounces away with trail
        spawnParticles(50, 70, "paper", 20, 2.5);
        spawnParticles(50, 50, "confetti", 8, 1);

        spawnScorePopup(50, 40, total, "🗑️ CRUMPLED!");

        setScreenShake(6);
        setTimeout(() => setScreenShake(0), 250);

        setCatMessage(pick(["In the TRASH?! 😭", "Balled up! 🙀", "So disrespectful! 😿", "That was ART! 😾"]));
        setTimeout(() => setCatMessage(""), 1500);

        setTimeout(() => {
          setOpenLetter(null);
          setDestruction({ type: null, progress: 0 });
          setPhase("playing");
        }, 400);
      }
    }, 20);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Destroy letter with DISSOLVE - acid/melting effect
  const handleDissolve = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.dissolve();
    setDestruction({ type: "dissolve", progress: 0 });

    let progress = 0;
    const dissolveInterval = setInterval(() => {
      progress += 0.015;
      setDestruction(prev => ({ ...prev, progress }));

      // Bubbling particles rising
      if (progress < 1) {
        const bubbleX = 30 + Math.random() * 40;
        spawnParticles(bubbleX, 60 - progress * 20, "bubble", 2, 0.8);
        if (progress > 0.3) {
          spawnParticles(bubbleX, 50, "sparkle", 1, 0.5);
        }
      }

      if (progress >= 1) {
        clearInterval(dissolveInterval);
        soundManager.powerUp();

        const basePoints = openLetter.isGold ? 40 : 25;
        const bonus = 20;
        const total = basePoints + bonus;

        setScore(s => s + total);
        setLettersDestroyed(d => d + 1);

        // Final dissolve burst
        spawnParticles(50, 50, "bubble", 30, 2);
        spawnParticles(50, 50, "sparkle", 15, 1.5);

        spawnScorePopup(50, 40, total, "🧪 DISSOLVED!");

        setScreenShake(4);
        setTimeout(() => setScreenShake(0), 200);

        setCatMessage(pick(["MELTED AWAY! 😭", "Chemistry is cruel! 🙀", "Bubbles of sadness! 😿", "Science hurts! 😾"]));
        setTimeout(() => setCatMessage(""), 1500);

        setTimeout(() => {
          setOpenLetter(null);
          setDestruction({ type: null, progress: 0 });
          setPhase("playing");
        }, 400);
      }
    }, 30);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Destroy letter with FREEZE & SHATTER
  const handleFreeze = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.freeze();
    // Generate crack positions
    const freezeCracks = Array.from({ length: 8 }, () => ({
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      angle: Math.random() * 360
    }));
    setDestruction({ type: "freeze", progress: 0, freezeCracks });

    let progress = 0;
    let phase: "freezing" | "shattering" = "freezing";

    const freezeInterval = setInterval(() => {
      if (phase === "freezing") {
        progress += 0.03;
        setDestruction(prev => ({ ...prev, progress: Math.min(progress, 0.5) }));

        // Ice crystals forming
        if (progress < 0.5) {
          spawnParticles(30 + Math.random() * 40, 30 + Math.random() * 40, "ice", 2, 0.3);
        }

        if (progress >= 0.5) {
          phase = "shattering";
          soundManager.shatter();
          setScreenShake(15);
          setTimeout(() => setScreenShake(0), 100);
        }
      } else {
        progress += 0.05;
        setDestruction(prev => ({ ...prev, progress }));

        // Shattering ice shards
        if (progress < 1) {
          spawnParticles(50, 50, "ice", 5, 3);
        }

        if (progress >= 1) {
          clearInterval(freezeInterval);
          soundManager.levelUp();

          const basePoints = openLetter.isGold ? 45 : 28;
          const bonus = 25;
          const total = basePoints + bonus;

          setScore(s => s + total);
          setLettersDestroyed(d => d + 1);

          // Epic shatter explosion
          spawnParticles(50, 50, "ice", 40, 4);
          spawnParticles(50, 50, "sparkle", 20, 2);

          spawnScorePopup(50, 40, total, "❄️ SHATTERED!");

          setScreenShake(12);
          setTimeout(() => setScreenShake(0), 300);

          setCatMessage(pick(["FROZEN SOLID! 😭", "Cold as your heart! 🙀", "Ice cold rejection! 😿", "Brrr-utal! 😾"]));
          setTimeout(() => setCatMessage(""), 1500);

          setTimeout(() => {
            setOpenLetter(null);
            setDestruction({ type: null, progress: 0 });
            setPhase("playing");
          }, 400);
        }
      }
    }, 25);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Destroy letter with BLACK HOLE - sucked into void
  const handleBlackHole = useCallback(() => {
    if (!openLetter || destruction.type) return;

    soundManager.blackHole();
    setDestruction({ type: "blackhole", progress: 0 });

    let progress = 0;
    const voidInterval = setInterval(() => {
      progress += 0.012;
      setDestruction(prev => ({ ...prev, progress }));

      // Particles being sucked toward center
      if (progress < 0.9) {
        const angle = progress * Math.PI * 8;
        const radius = 30 - progress * 25;
        const px = 50 + Math.cos(angle) * radius;
        const py = 50 + Math.sin(angle) * radius;
        spawnParticles(px, py, "void", 3, 0.5);
        spawnParticles(px, py, "sparkle", 1, 0.3);
      }

      if (progress >= 1) {
        clearInterval(voidInterval);
        soundManager.specialAttack();

        const basePoints = openLetter.isGold ? 50 : 30;
        const bonus = 30;
        const total = basePoints + bonus;

        setScore(s => s + total);
        setLettersDestroyed(d => d + 1);

        // Void collapse with reverse burst
        setTimeout(() => {
          spawnParticles(50, 50, "sparkle", 30, 3);
          spawnParticles(50, 50, "confetti", 20, 2.5);
        }, 200);

        spawnScorePopup(50, 40, total, "🕳️ VOIDED!");

        setScreenShake(8);
        setTimeout(() => setScreenShake(0), 400);

        setCatMessage(pick(["INTO THE VOID! 😭", "Gone forever! 🙀", "Erased from existence! 😿", "Dimension-ally rejected! 😾"]));
        setTimeout(() => setCatMessage(""), 1500);

        setTimeout(() => {
          setOpenLetter(null);
          setDestruction({ type: null, progress: 0 });
          setPhase("playing");
        }, 600);
      }
    }, 25);
  }, [openLetter, destruction.type, spawnParticles, spawnScorePopup]);

  // Tutorial screen with enhanced visuals
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-100 via-rose-100 to-pink-200 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Floating letters background - optimized with CSS */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl opacity-20"
              style={{
                left: `${(i * 16) % 100}%`,
                animation: `floatDown ${10 + (i % 3) * 2}s linear infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            >
              {["💌", "💕", "✉️"][i % 3]}
            </div>
          ))}
        </div>

        {/* Radial glow - static for better performance */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-80 h-80 bg-rose-400/15 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative z-10 border border-rose-300/50"
        >
          {/* Wax seal decoration */}
          <motion.div
            className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow-xl flex items-center justify-center border-2 border-red-400"
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-2xl drop-shadow">💕</span>
          </motion.div>

          {/* Animated letter icon with glow */}
          <div className="relative mt-6 mb-3">
            <motion.div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-20 h-20 bg-rose-400/30 rounded-full blur-xl"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
            <motion.div
              className="text-7xl relative"
              animate={{ rotate: [-5, 5, -5], y: [0, -8, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              💌
            </motion.div>
          </div>

          <motion.h2
            className="text-2xl font-black mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-red-500 bg-clip-text text-transparent">
              Reject Love Letters!
            </span>
          </motion.h2>

          <motion.p
            className="text-slate-600 mb-4 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            The cat sent you love letters!<br/>
            <span className="font-bold text-rose-600">Open them, read them, then DESTROY them!</span>
          </motion.p>

          {/* All Destruction Methods - Scrollable */}
          <motion.div
            className="bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl p-3 mb-3 border border-rose-200"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-slate-700 text-xs font-medium mb-2">7 ways to destroy love letters:</p>

            {/* Scrollable destruction methods */}
            <div className="overflow-x-auto -mx-2 px-2 pb-1 scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {/* BURN */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-orange-300"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="text-lg">🔥</span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-orange-600">BURN</div>
                  <div className="text-[8px] text-orange-500 font-semibold">+25</div>
                </motion.div>

                {/* TEAR */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-slate-400 to-slate-600 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-slate-300"
                    animate={{ rotate: [-4, 4, -4] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <span className="text-lg">✂️</span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-slate-600">TEAR</div>
                  <div className="text-[8px] text-slate-500 font-semibold">+12</div>
                </motion.div>

                {/* SHRED */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-emerald-300"
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    <span className="text-lg">📄</span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-emerald-600">SHRED</div>
                  <div className="text-[8px] text-emerald-500 font-semibold">+35</div>
                </motion.div>

                {/* CRUMPLE */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-amber-300"
                    animate={{ scale: [1, 0.9, 1], rotate: [0, 5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    <span className="text-lg">🗑️</span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-amber-600">CRUMPLE</div>
                  <div className="text-[8px] text-amber-500 font-semibold">+18</div>
                </motion.div>

                {/* DISSOLVE */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-purple-400 to-violet-500 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-purple-300"
                    animate={{ opacity: [1, 0.7, 1], scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <span className="text-lg">🧪</span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-purple-600">DISSOLVE</div>
                  <div className="text-[8px] text-purple-500 font-semibold">+45</div>
                </motion.div>

                {/* FREEZE */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-cyan-300 to-blue-400 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-cyan-200"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <span className="text-lg">❄️</span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-cyan-600">FREEZE</div>
                  <div className="text-[8px] text-cyan-500 font-semibold">+53</div>
                </motion.div>

                {/* VOID */}
                <motion.div
                  className="text-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                >
                  <motion.div
                    className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-800 rounded-lg flex items-center justify-center shadow-md mb-0.5 border border-indigo-400 relative overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
                    />
                    <motion.span
                      className="text-lg relative"
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      🕳️
                    </motion.span>
                  </motion.div>
                  <div className="text-[9px] font-bold text-indigo-600">VOID</div>
                  <div className="text-[8px] text-indigo-500 font-semibold">+60</div>
                </motion.div>
              </div>
            </div>

            {/* Scroll hint */}
            <motion.p
              className="text-center text-rose-400/60 text-[8px] mt-1"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ← swipe to see all →
            </motion.p>
          </motion.div>

          {/* Bonus info */}
          <motion.div
            className="flex gap-2 mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="flex-1 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-2 border-2 border-amber-300 shadow-sm"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                className="text-lg"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✨💌
              </motion.div>
              <div className="text-[8px] text-amber-700 font-bold">Gold letters = bonus pts!</div>
            </motion.div>
            <motion.div
              className="flex-1 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-2 border-2 border-indigo-300 shadow-sm"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                className="text-lg"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                🕳️❄️
              </motion.div>
              <div className="text-[8px] text-indigo-700 font-bold">Premium = max points!</div>
            </motion.div>
          </motion.div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-rose-500/30 relative overflow-hidden"
            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(244, 63, 94, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <span>Open the Letters!</span>
              <motion.span
                animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                💔
              </motion.span>
            </span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Countdown with enhanced visuals
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-100 via-rose-100 to-pink-200 flex items-center justify-center overflow-hidden">
        {/* Floating letters during countdown */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl opacity-30"
              style={{ left: `${10 + (i * 7)}%`, bottom: "-10%" }}
              animate={{ y: "-120vh", rotate: 360 }}
              transition={{
                duration: 3 + (i % 4) * 0.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "linear"
              }}
            >
              {["💌", "💕", "✉️", "💝"][i % 4]}
            </motion.div>
          ))}
        </div>

        {/* Pulse effect */}
        <motion.div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-96 h-96 rounded-full bg-rose-400/20"
            animate={{ scale: [0, 2], opacity: [0.4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={countdownNum}
            initial={{ scale: 3, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center justify-center blur-2xl">
              <div className="text-[150px] font-black text-rose-400/50">
                {countdownNum || "💌"}
              </div>
            </div>
            <div className="text-[120px] font-black text-rose-600 drop-shadow-[0_0_30px_rgba(244,63,94,0.5)] relative">
              {countdownNum || "💌"}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Done screen
  if (phase === "done") {
    const rating = score >= 250 ? "S" : score >= 180 ? "A" : score >= 120 ? "B" : score >= 60 ? "C" : "D";
    const ratingColors: Record<string, string> = {
      S: "from-yellow-400 to-amber-500",
      A: "from-green-400 to-emerald-500",
      B: "from-blue-400 to-cyan-500",
      C: "from-purple-400 to-violet-500",
      D: "from-slate-400 to-gray-500",
    };

    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-black flex flex-col items-center justify-center p-4">
        {/* Floating ash particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-gray-400/30 rounded-full"
              style={{ left: `${(i * 5) % 100}%`, top: `${(i * 7 + 10) % 100}%` }}
              animate={{ y: [0, -30, 0], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 4 + (i % 4) * 0.5, repeat: Infinity, delay: (i % 5) * 0.4 }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm text-center shadow-2xl border border-rose-200"
        >
          <motion.div
            className="text-7xl mb-3"
            animate={{
              y: [0, -10, 0],
              filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {burnCount > ripCount ? "🔥" : "💔"}
          </motion.div>

          <h2 className="text-2xl font-black bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent mb-2">
            Letters Destroyed!
          </h2>

          {/* Rating badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className={cn(
              "inline-block px-5 py-2 rounded-full bg-gradient-to-r text-white font-black text-2xl mb-3 shadow-lg",
              ratingColors[rating]
            )}
          >
            {rating} Rank
          </motion.div>

          <div className="grid grid-cols-4 gap-1.5 mb-4">
            <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
              <p className="text-xl font-black text-rose-600">{score}</p>
              <p className="text-rose-400 text-[8px]">POINTS</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2 border border-amber-100">
              <p className="text-xl font-black text-amber-600">{lettersDestroyed}</p>
              <p className="text-amber-400 text-[8px]">DESTROYED</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-2 border border-orange-100">
              <p className="text-xl font-black text-orange-600">{burnCount}</p>
              <p className="text-orange-400 text-[8px]">BURNED 🔥</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
              <p className="text-xl font-black text-slate-600">{ripCount}</p>
              <p className="text-slate-400 text-[8px]">RIPPED ✂️</p>
            </div>
          </div>

          <motion.div
            className="flex items-center justify-center gap-2 mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-4xl">😿</span>
            <p className="text-slate-500 italic text-sm">
              {burnCount > ripCount
                ? '"You burned my heart along with those letters..."'
                : '"All my beautiful words... in pieces..."'}
            </p>
          </motion.div>

          <motion.div
            className="mt-3 flex justify-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <span className="text-rose-400 text-sm">Final challenge</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-rose-400"
            >
              →
            </motion.span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Reading letter screen
  if (phase === "reading" && openLetter) {
    return (
      <motion.div
        className="fixed inset-0 bg-gradient-to-b from-amber-100 via-rose-50 to-pink-100 flex flex-col items-center justify-center p-4 overflow-hidden"
        animate={screenShake > 0 ? { x: [0, -screenShake, screenShake, 0] } : {}}
      >
        {/* Timer bar at top */}
        <div className="absolute top-4 left-4 right-4 z-30">
          <div className="bg-white/80 backdrop-blur rounded-full px-4 py-2 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-lg">💔</span>
              <span className="font-bold text-rose-600">{score}</span>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full",
              timeLeft <= 10 ? "bg-red-100" : "bg-rose-50"
            )}>
              <span className="text-lg">⏱️</span>
              <span className={cn("font-bold", timeLeft <= 10 ? "text-red-600" : "text-rose-600")}>
                {timeLeft}s
              </span>
            </div>
          </div>
        </div>

        {/* Cat reaction */}
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 text-center z-20"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <span className="text-5xl">
            {catEmotion === "devastated" ? "😭" : catEmotion === "crying" ? "😿" : catEmotion === "nervous" ? "🙀" : "😻"}
          </span>
          <AnimatePresence>
            {catMessage && (
              <motion.div
                initial={{ scale: 0, y: 5 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white text-rose-600 px-4 py-2 rounded-full font-bold shadow-xl text-sm whitespace-nowrap"
              >
                {catMessage}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* The letter */}
        <motion.div
          initial={{ scale: 0, rotateY: 180 }}
          animate={{
            scale: destruction.type ? 1 - destruction.progress * 0.3 : 1,
            rotateY: 0,
            opacity: destruction.type === "burn" ? 1 - destruction.progress : 1,
          }}
          className={cn(
            "relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-2",
            openLetter.isGold ? "border-yellow-400" : "border-rose-200",
            destruction.type === "burn" && "bg-gradient-to-t from-orange-200 to-white"
          )}
          style={{
            transform: destruction.type === "rip"
              ? `translateX(${(destruction.progress * 20) - 10}px) rotate(${destruction.progress * 5}deg)`
              : undefined,
          }}
        >
          {/* Gold letter glow */}
          {openLetter.isGold && !destruction.type && (
            <motion.div
              className="absolute inset-0 -m-2 rounded-3xl bg-yellow-400/20 -z-10"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}

          {/* Burn effect overlay */}
          {destruction.type === "burn" && (
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
              style={{
                background: `linear-gradient(to top,
                  rgba(0,0,0,${destruction.progress * 0.8}) ${destruction.progress * 100}%,
                  rgba(255,100,0,${destruction.progress * 0.5}) ${destruction.progress * 100 + 10}%,
                  transparent ${destruction.progress * 100 + 30}%
                )`,
              }}
            />
          )}

          {/* Rip effect - jagged tear lines */}
          {destruction.type === "rip" && destruction.progress > 0.1 && (
            <>
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Left piece */}
                <motion.div
                  className="absolute inset-0 bg-white"
                  style={{
                    clipPath: `polygon(0 0, ${45 - destruction.progress * 25}% 0, ${40 - destruction.progress * 20}% 30%, ${48 - destruction.progress * 28}% 50%, ${35 - destruction.progress * 18}% 70%, ${42 - destruction.progress * 22}% 100%, 0 100%)`,
                    transform: `translateX(${-destruction.progress * 40}px) rotate(${-destruction.progress * 15}deg)`,
                  }}
                />
                {/* Right piece */}
                <motion.div
                  className="absolute inset-0 bg-white"
                  style={{
                    clipPath: `polygon(${55 + destruction.progress * 25}% 0, 100% 0, 100% 100%, ${58 + destruction.progress * 22}% 100%, ${52 + destruction.progress * 18}% 70%, ${60 + destruction.progress * 28}% 50%, ${55 + destruction.progress * 20}% 30%)`,
                    transform: `translateX(${destruction.progress * 40}px) rotate(${destruction.progress * 15}deg)`,
                  }}
                />
              </div>
              {/* Tear line effect */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 pointer-events-none"
                style={{
                  background: `linear-gradient(to bottom, transparent, rgba(0,0,0,${destruction.progress * 0.3}), transparent)`,
                  filter: 'blur(2px)',
                }}
              />
            </>
          )}

          {/* Shred effect - vertical lines cutting through */}
          {destruction.type === "shred" && destruction.shredLines && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              {destruction.shredLines.map((linePos, i) => (
                <motion.div
                  key={i}
                  className="absolute top-0 w-0.5 bg-gradient-to-b from-transparent via-slate-400 to-transparent"
                  style={{
                    left: `${linePos}%`,
                    height: `${destruction.progress * 120}%`,
                    opacity: destruction.progress > 0.2 ? 0.6 : 0,
                  }}
                />
              ))}
              {/* Paper being pulled down effect */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, transparent ${100 - destruction.progress * 100}%, rgba(200,200,200,0.5) ${100 - destruction.progress * 80}%, transparent)`,
                }}
              />
            </div>
          )}

          {/* Crumple effect - paper crinkling */}
          {destruction.type === "crumple" && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `scale(${1 - destruction.progress * 0.7}) rotate(${(destruction.crumpleAngle || 0) * destruction.progress}deg)`,
                borderRadius: `${destruction.progress * 50}%`,
                filter: `brightness(${1 - destruction.progress * 0.3})`,
              }}
            >
              {/* Crinkle shadows */}
              {destruction.progress > 0.2 && Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-slate-400/30"
                  style={{
                    left: `${20 + (i % 4) * 20}%`,
                    top: `${15 + Math.floor(i / 4) * 40}%`,
                    width: `${10 + destruction.progress * 15}%`,
                    height: '2px',
                    transform: `rotate(${-30 + i * 25 + destruction.progress * 20}deg)`,
                    opacity: destruction.progress * 0.8,
                  }}
                />
              ))}
            </motion.div>
          )}

          {/* Dissolve effect - melting/bubbling */}
          {destruction.type === "dissolve" && (
            <motion.div
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
              style={{
                background: `linear-gradient(to top,
                  rgba(168,85,247,${destruction.progress * 0.6}) ${destruction.progress * 60}%,
                  rgba(192,132,252,${destruction.progress * 0.3}) ${destruction.progress * 80}%,
                  transparent)`,
              }}
            >
              {/* Bubbles */}
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-purple-400/50"
                  style={{
                    left: `${10 + (i % 6) * 15}%`,
                    bottom: `${destruction.progress * 100 - 20 - (i % 3) * 10}%`,
                    width: `${6 + (i % 4) * 4}px`,
                    height: `${6 + (i % 4) * 4}px`,
                    opacity: destruction.progress > 0.1 ? Math.min(1, (destruction.progress - 0.1) * 2) : 0,
                  }}
                  animate={{ y: [-5, -15, -5], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5 + (i % 3) * 0.2, repeat: Infinity }}
                />
              ))}
            </motion.div>
          )}

          {/* Freeze effect - ice crystals and cracks */}
          {destruction.type === "freeze" && (
            <motion.div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              {/* Ice overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg,
                    rgba(165,243,252,${destruction.progress * 0.8}),
                    rgba(103,232,249,${destruction.progress * 0.6}),
                    rgba(34,211,238,${destruction.progress * 0.4}))`,
                  opacity: destruction.progress < 0.5 ? destruction.progress * 2 : 1 - (destruction.progress - 0.5) * 2,
                }}
              />
              {/* Frost crystals */}
              {destruction.progress < 0.6 && Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-cyan-200"
                  style={{
                    left: `${15 + (i % 3) * 30}%`,
                    top: `${20 + Math.floor(i / 3) * 40}%`,
                    fontSize: `${12 + destruction.progress * 20}px`,
                    opacity: destruction.progress * 1.5,
                  }}
                >
                  ❄
                </motion.div>
              ))}
              {/* Crack lines during shatter */}
              {destruction.progress > 0.5 && destruction.freezeCracks?.map((crack, i) => (
                <motion.div
                  key={i}
                  className="absolute bg-white/80"
                  style={{
                    left: `${crack.x}%`,
                    top: `${crack.y}%`,
                    width: `${30 + (destruction.progress - 0.5) * 100}px`,
                    height: '2px',
                    transform: `rotate(${crack.angle}deg)`,
                    transformOrigin: 'left center',
                    opacity: (destruction.progress - 0.5) * 2,
                  }}
                />
              ))}
            </motion.div>
          )}

          {/* Black hole effect - swirling into void */}
          {destruction.type === "blackhole" && (
            <motion.div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              {/* Void center */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
                style={{
                  width: `${destruction.progress * 150}%`,
                  height: `${destruction.progress * 150}%`,
                  boxShadow: `0 0 ${destruction.progress * 60}px ${destruction.progress * 30}px rgba(99,102,241,0.5), inset 0 0 ${destruction.progress * 40}px rgba(0,0,0,1)`,
                }}
              />
              {/* Spiral effect */}
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 w-1 bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{
                    height: `${20 - destruction.progress * 18}%`,
                    transform: `translate(-50%, -50%) rotate(${i * 45 + destruction.progress * 720}deg) translateY(-${30 - destruction.progress * 28}%)`,
                    opacity: Math.max(0, 1 - destruction.progress * 1.2),
                  }}
                />
              ))}
            </motion.div>
          )}

          {/* Letter content */}
          <div className={cn(
            "transition-opacity duration-300",
            destruction.progress > 0.5 && "opacity-30",
            destruction.type === "blackhole" && destruction.progress > 0.3 && "opacity-0",
            destruction.type === "crumple" && destruction.progress > 0.4 && "opacity-20"
          )}>
            {/* Decorative header */}
            <div className="flex justify-center mb-3">
              <motion.div
                className="text-3xl"
                animate={!destruction.type ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {openLetter.isGold ? "💝" : "💌"}
              </motion.div>
            </div>

            {/* Opening */}
            <p className="text-rose-700 font-bold text-lg mb-3 font-serif italic">
              {openLetter.message.opening}
            </p>

            {/* Body */}
            <p className="text-slate-700 text-sm leading-relaxed mb-4">
              {openLetter.message.body}
            </p>

            {/* Closing */}
            <p className="text-rose-600 font-medium text-right italic">
              {openLetter.message.closing}
            </p>

            {/* Paw print signature */}
            <div className="flex justify-end mt-2">
              <span className="text-2xl opacity-50">🐾</span>
            </div>
          </div>
        </motion.div>

        {/* Premium Destruction Buttons - Scrollable Grid */}
        {!destruction.type && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md mt-4 px-2"
          >
            {/* Section label */}
            <motion.p
              className="text-center text-rose-600/80 text-xs font-medium mb-2"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨ Choose your destruction method ✨
            </motion.p>

            {/* Scrollable button container */}
            <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide" style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}>
              <div className="flex gap-2 min-w-max" style={{ touchAction: "pan-x" }}>
                {/* BURN */}
                <motion.button
                  onClick={handleBurn}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-orange-500 to-red-600 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-orange-400/30"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    🔥
                  </motion.span>
                  <span className="font-bold text-xs">BURN</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded">+{openLetter.isGold ? 40 : 25}</span>
                </motion.button>

                {/* RIP/TEAR */}
                <motion.button
                  onClick={handleRip}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-slate-500 to-slate-700 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-slate-400/30"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{ rotate: [-8, 8, -8] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                  >
                    ✂️
                  </motion.span>
                  <span className="font-bold text-xs">TEAR</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded">+{openLetter.isGold ? 25 : 12}</span>
                </motion.button>

                {/* SHRED */}
                <motion.button
                  onClick={handleShred}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-emerald-400/30"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    📄
                  </motion.span>
                  <span className="font-bold text-xs">SHRED</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded">+{openLetter.isGold ? 50 : 35}</span>
                </motion.button>

                {/* CRUMPLE */}
                <motion.button
                  onClick={handleCrumple}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-amber-500 to-yellow-600 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-amber-400/30"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{ scale: [1, 0.85, 1], rotate: [0, 10, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    🗑️
                  </motion.span>
                  <span className="font-bold text-xs">CRUMPLE</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded">+{openLetter.isGold ? 30 : 18}</span>
                </motion.button>

                {/* DISSOLVE */}
                <motion.button
                  onClick={handleDissolve}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-purple-500 to-violet-600 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-purple-400/30"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{ opacity: [1, 0.7, 1], scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    🧪
                  </motion.span>
                  <span className="font-bold text-xs">DISSOLVE</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded">+{openLetter.isGold ? 60 : 45}</span>
                </motion.button>

                {/* FREEZE */}
                <motion.button
                  onClick={handleFreeze}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-cyan-400 to-blue-500 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-cyan-300/30"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-2xl"
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    ❄️
                  </motion.span>
                  <span className="font-bold text-xs">FREEZE</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded">+{openLetter.isGold ? 70 : 53}</span>
                </motion.button>

                {/* BLACK HOLE */}
                <motion.button
                  onClick={handleBlackHole}
                  className="flex flex-col items-center gap-1 bg-gradient-to-br from-indigo-600 to-purple-900 text-white px-4 py-3 rounded-xl shadow-lg min-w-[72px] border border-indigo-400/30 relative overflow-hidden"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Sparkle effect for premium feel */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                  <motion.span
                    className="text-2xl relative"
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    🕳️
                  </motion.span>
                  <span className="font-bold text-xs relative">VOID</span>
                  <span className="text-[10px] opacity-80 bg-black/20 px-1.5 rounded relative">+{openLetter.isGold ? 80 : 60}</span>
                </motion.button>
              </div>
            </div>

            {/* Scroll hint */}
            <motion.p
              className="text-center text-rose-400/60 text-[10px] mt-1"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ← swipe for more →
            </motion.p>
          </motion.div>
        )}

        {/* Enhanced Particles with unique styles per type */}
        {particles.map(p => {
          // Shred particles are thin rectangles (paper strips)
          if (p.type === "shred") {
            return (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none z-40"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.width || 4,
                  height: p.height || 20,
                  backgroundColor: p.color,
                  borderRadius: "1px",
                  opacity: p.life,
                  transform: `rotate(${p.rotation}deg)`,
                  boxShadow: `0 1px 2px rgba(0,0,0,0.1)`,
                }}
              />
            );
          }

          // Ice particles have crystalline shape
          if (p.type === "ice") {
            return (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none z-40"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  opacity: p.life,
                  transform: `rotate(${p.rotation}deg)`,
                  boxShadow: `0 0 ${p.size * 0.5}px ${p.color}, inset 0 0 ${p.size * 0.3}px rgba(255,255,255,0.5)`,
                }}
              />
            );
          }

          // Bubble particles are circular with gradient
          if (p.type === "bubble") {
            return (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none z-40 rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size,
                  background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), ${p.color})`,
                  opacity: p.life * 0.8,
                  transform: `rotate(${p.rotation}deg) scale(${0.8 + p.life * 0.4})`,
                  boxShadow: `0 0 ${p.size * 0.3}px ${p.color}`,
                }}
              />
            );
          }

          // Void particles have dark glow
          if (p.type === "void") {
            return (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none z-40 rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  opacity: p.life,
                  transform: `rotate(${p.rotation}deg)`,
                  boxShadow: `0 0 ${p.size}px ${p.color}, 0 0 ${p.size * 2}px rgba(99,102,241,0.5)`,
                }}
              />
            );
          }

          // Confetti particles are colorful rectangles
          if (p.type === "confetti") {
            return (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none z-40"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size * 0.6,
                  height: p.size * 1.2,
                  backgroundColor: p.color,
                  borderRadius: "1px",
                  opacity: p.life,
                  transform: `rotate(${p.rotation}deg)`,
                }}
              />
            );
          }

          // Default particle rendering for fire, ember, paper, ash, sparkle
          return (
            <motion.div
              key={p.id}
              className="absolute pointer-events-none z-40"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.type === "fire" || p.type === "ember" || p.type === "sparkle" ? "50%" : "2px",
                opacity: p.life,
                transform: `rotate(${p.rotation}deg)`,
                boxShadow: p.type === "fire" || p.type === "ember"
                  ? `0 0 ${p.size}px ${p.color}`
                  : p.type === "sparkle"
                    ? `0 0 ${p.size * 0.5}px ${p.color}`
                    : undefined,
              }}
            />
          );
        })}

        {/* Score popups */}
        <AnimatePresence>
          {scorePopups.map(popup => (
            <motion.div
              key={popup.id}
              className="absolute pointer-events-none z-50 left-1/2 top-1/3"
              initial={{ opacity: 1, y: 0, scale: 0.5, x: "-50%" }}
              animate={{ opacity: 0, y: -60, scale: 1.5, x: "-50%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <div className="text-center">
                <span className="font-black text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  +{popup.value}
                </span>
                <div className="font-bold text-orange-300 text-sm">{popup.text}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Main game - letter queue view
  return (
    <motion.div
      className="fixed inset-0 bg-gradient-to-b from-amber-100 via-rose-100 to-pink-200 overflow-hidden"
      animate={screenShake > 0 ? { x: [0, -screenShake, screenShake, 0] } : {}}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(244,63,94,0.1) 20px, rgba(244,63,94,0.1) 40px)`,
        }} />
      </div>

      {/* Header */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-30">
        <motion.div
          className="bg-white/90 backdrop-blur-md rounded-xl px-4 py-2 shadow-lg border border-rose-200 flex items-center gap-2"
          animate={score > 0 ? { scale: [1, 1.02, 1] } : {}}
        >
          <span className="text-xl">💔</span>
          <span className="text-lg font-bold text-rose-600">{score}</span>
        </motion.div>

        <motion.div
          className={cn(
            "backdrop-blur-md rounded-xl px-4 py-2 shadow-lg border flex items-center gap-2",
            timeLeft <= 10 ? "bg-red-100/90 border-red-300" : "bg-white/90 border-rose-200"
          )}
          animate={timeLeft <= 10 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: timeLeft <= 10 ? Infinity : 0 }}
        >
          <span className="text-xl">⏱️</span>
          <span className={cn("text-lg font-bold", timeLeft <= 10 ? "text-red-600" : "text-rose-600")}>
            {timeLeft}s
          </span>
        </motion.div>
      </div>

      {/* Cat with mailbag */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 text-center z-20">
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-6xl">
            {catEmotion === "devastated" ? "😭" : catEmotion === "crying" ? "😿" : catEmotion === "nervous" ? "🙀" : "😸"}
          </span>
        </motion.div>
        <motion.p
          className="text-rose-600 font-medium text-sm mt-1"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {letterQueue.length === 0 ? "Sending more letters..." : "Please read my letters! 💕"}
        </motion.p>
        <AnimatePresence>
          {catMessage && (
            <motion.div
              initial={{ scale: 0, y: 5 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white text-rose-600 px-4 py-2 rounded-full font-bold shadow-xl text-sm whitespace-nowrap"
            >
              {catMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats bar */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-1 text-center shadow">
          <div className="text-lg font-bold text-rose-600">{lettersDestroyed}</div>
          <div className="text-[9px] text-rose-400">destroyed</div>
        </div>
        <div className="bg-orange-100/80 backdrop-blur rounded-lg px-3 py-1 text-center shadow">
          <div className="text-lg font-bold text-orange-600">{burnCount} 🔥</div>
          <div className="text-[9px] text-orange-400">burned</div>
        </div>
        <div className="bg-slate-100/80 backdrop-blur rounded-lg px-3 py-1 text-center shadow">
          <div className="text-lg font-bold text-slate-600">{ripCount} ✂️</div>
          <div className="text-[9px] text-slate-400">ripped</div>
        </div>
      </div>

      {/* Letter queue */}
      <div className="absolute top-48 left-0 right-0 bottom-24 flex items-center justify-center">
        <div className="flex flex-wrap justify-center gap-4 p-4 max-w-md">
          <AnimatePresence mode="popLayout">
            {letterQueue.map((letter, index) => (
              <motion.button
                key={letter.id}
                initial={{ scale: 0, rotate: -20, y: 50 }}
                animate={{
                  scale: 1,
                  rotate: (index - 2) * 5,
                  y: 0,
                }}
                exit={{ scale: 0, rotate: 20, y: -50 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                onClick={() => handleOpenLetter(letter)}
                className={cn(
                  "relative p-4 rounded-xl shadow-xl border-2 touch-manipulation",
                  letter.envelope === "pink" && "bg-gradient-to-br from-pink-100 to-rose-200 border-pink-300",
                  letter.envelope === "red" && "bg-gradient-to-br from-red-100 to-rose-200 border-red-300",
                  letter.envelope === "gold" && "bg-gradient-to-br from-yellow-100 to-amber-200 border-yellow-400",
                  letter.envelope === "purple" && "bg-gradient-to-br from-purple-100 to-violet-200 border-purple-300",
                )}
                whileHover={{ scale: 1.1, rotate: 0 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Envelope */}
                <motion.div
                  className="text-5xl"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.2 }}
                >
                  {letter.isGold ? "💛" : "💌"}
                </motion.div>

                {/* Wax seal */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow flex items-center justify-center">
                  <span className="text-xs">💕</span>
                </div>

                {/* Gold glow */}
                {letter.isGold && (
                  <motion.div
                    className="absolute inset-0 -m-1 rounded-xl bg-yellow-400/30 -z-10"
                    animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}

                {/* "New" badge */}
                {index === letterQueue.length - 1 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full"
                  >
                    NEW!
                  </motion.div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>

          {letterQueue.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-rose-400"
            >
              <motion.div
                className="text-6xl mb-2"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                📮
              </motion.div>
              <p className="font-medium">Waiting for letters...</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom instruction */}
      <div className="absolute bottom-4 left-4 right-4 z-20">
        <motion.div
          className="bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-rose-200 shadow-lg"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <p className="text-rose-600 text-center text-sm font-medium">
            👆 Tap a letter to open and read it!
          </p>
        </motion.div>
      </div>

      {/* Skip button */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-3 right-20 bg-white/50 backdrop-blur rounded-full px-3 py-1.5 text-rose-400 text-xs z-30"
      >
        Skip →
      </button>

      {/* Particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute pointer-events-none z-40"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.type === "fire" || p.type === "ember" ? "50%" : "2px",
            opacity: p.life,
            transform: `rotate(${p.rotation}deg)`,
            boxShadow: p.type === "fire" || p.type === "ember"
              ? `0 0 ${p.size}px ${p.color}`
              : undefined,
          }}
        />
      ))}
    </motion.div>
  );
});

// ============================================================================
// BOSS BATTLE - TAP & SWIPE (Mobile Portrait Optimized)
// ============================================================================
// TAP to attack! SWIPE to dodge! Simple and satisfying!

type BossPhase = "phase1" | "phase2" | "phase3";
type SwipeDirection = "left" | "right" | "up" | "down";
type AttackType = "swipe" | "rapidfire" | "fakeout" | "lovebomb" | "ragemode";
type PowerUpType = "heart" | "star" | "shield" | "rage";

// Incoming attack that requires different mechanics to dodge
interface IncomingAttack {
  id: number;
  type: AttackType;
  direction: SwipeDirection;
  directions?: SwipeDirection[]; // for rapidfire (sequence) or ragemode (two at once)
  currentIndex?: number; // for rapidfire progress
  timeLeft: number;
  duration: number;
  emoji: string;
  damage: number;
  isFake?: boolean; // for fakeout - the shown direction is a trick
  realDirection?: SwipeDirection; // for fakeout - the actual direction
  deflectCount?: number; // for lovebomb - taps needed to deflect
  deflected?: number; // for lovebomb - taps done
}

// Power-up that spawns during battle
interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  timeLeft: number;
  emoji: string;
}

// Charge attack levels (for reference)
// Level 0: <1s = 2 damage (tap)
// Level 1: 1s = 5 damage (light charge)
// Level 2: 2s = 10 damage (heavy charge)
// Level 3: 3s = 15 damage (mega charge)


const DramaKingBattle = memo(function DramaKingBattle({ onComplete }: { onComplete: (won: boolean) => void }) {
  // Game phase
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "battle" | "qte" | "victory" | "defeat">("tutorial");
  const [countdownNum, setCountdownNum] = useState(3);

  // Boss state
  const [bossHP, setBossHP] = useState(100);
  const [bossPhase, setBossPhase] = useState<BossPhase>("phase1");
  const [bossEmotion, setBossEmotion] = useState<"smug" | "angry" | "hurt" | "charging" | "defeated">("smug");
  const [bossMessage, setBossMessage] = useState("");
  const [bossShaking, setBossShaking] = useState(false);

  // Player state
  const [playerHP, setPlayerHP] = useState(100);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [superMeter, setSuperMeter] = useState(0);

  // Attack state - boss attack that player must dodge
  const [currentAttack, setCurrentAttack] = useState<IncomingAttack | null>(null);
  const [canTap, setCanTap] = useState(true);
  const [lastDodgeResult, setLastDodgeResult] = useState<"none" | "perfect" | "good" | "miss">("none");

  // QTE state
  const [qteSequence, setQteSequence] = useState<string[]>([]);
  const [qteIndex, setQteIndex] = useState(0);
  const [qteTimeLeft, setQteTimeLeft] = useState(0);

  // Charge attack state
  const [isCharging, setIsCharging] = useState(false);
  const [chargeTime, setChargeTime] = useState(0);
  const [chargeLevel, setChargeLevel] = useState(0);

  // Counter window state (after perfect dodge)
  const [counterWindowActive, setCounterWindowActive] = useState(false);
  const [counterWindowTimer, setCounterWindowTimer] = useState(0);

  // Power-ups
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [hasShield, setHasShield] = useState(false);
  const [rageMode, setRageMode] = useState(false);
  const [rageModeTimer, setRageModeTimer] = useState(0);


  // Phase transformation state
  const [showingPhaseTransition, setShowingPhaseTransition] = useState(false);
  const [phaseTransitionText, setPhaseTransitionText] = useState("");

  // Visual effects
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; emoji: string; vx: number; vy: number; life: number }>>([]);
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: number; x: number; y: number; text: string; color: string }>>([]);
  const [screenShake, setScreenShake] = useState(0);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [bossScale, setBossScale] = useState(1);

  // Refs
  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const bossHPRef = useRef(100);
  const playerHPRef = useRef(100);
  const comboRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastAttackTimeRef = useRef(0);
  const chargeStartRef = useRef<number | null>(null);
  const lastPowerUpSpawnRef = useRef(0);
  const phase2TriggeredRef = useRef(false);
  const phase3TriggeredRef = useRef(false);

  // Sync refs
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { bossHPRef.current = bossHP; }, [bossHP]);
  useEffect(() => { playerHPRef.current = playerHP; }, [playerHP]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // Direction arrows
  const DIRECTION_ARROWS: Record<SwipeDirection, string> = {
    left: "⬅️",
    right: "➡️",
    up: "⬆️",
    down: "⬇️",
  };

  // Spawn particles helper
  const spawnParticles = useCallback((x: number, y: number, emoji: string, count: number) => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i + Math.random() * 1000,
      x, y, emoji,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10 - 5,
      life: 1,
    }));
    setParticles(prev => [...prev.slice(-20), ...newParticles]);
  }, []);

  // Spawn floating text
  const spawnText = useCallback((x: number, y: number, text: string, color: string) => {
    setFloatingTexts(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), x, y, text, color }]);
    setTimeout(() => setFloatingTexts(prev => prev.slice(1)), 1000);
  }, []);

  // Trigger screen shake
  const triggerShake = useCallback((intensity: number) => {
    setScreenShake(intensity);
    setTimeout(() => setScreenShake(0), 200);
  }, []);

  // Get combo damage multiplier
  const getComboMultiplier = useCallback((comboCount: number) => {
    if (comboCount >= 30) return 2.5;
    if (comboCount >= 20) return 2.0;
    if (comboCount >= 10) return 1.5;
    return 1.0;
  }, []);

  // Spawn a power-up
  const spawnPowerUp = useCallback(() => {
    const types: PowerUpType[] = ["heart", "star", "shield", "rage"];
    const emojis: Record<PowerUpType, string> = { heart: "💗", star: "⭐", shield: "🛡️", rage: "🔥" };
    const type = types[Math.floor(Math.random() * types.length)];
    const newPowerUp: PowerUp = {
      id: Date.now(),
      type,
      x: 10 + Math.random() * 80,
      y: 40 + Math.random() * 30,
      timeLeft: 5,
      emoji: emojis[type],
    };
    setPowerUps(prev => [...prev.slice(-3), newPowerUp]);
  }, []);

  // Collect a power-up
  const collectPowerUp = useCallback((powerUp: PowerUp) => {
    soundManager.collect();
    setPowerUps(prev => prev.filter(p => p.id !== powerUp.id));
    spawnParticles(powerUp.x, powerUp.y, powerUp.emoji, 5);

    switch (powerUp.type) {
      case "heart":
        setPlayerHP(hp => Math.min(100, hp + 15));
        playerHPRef.current = Math.min(100, playerHPRef.current + 15);
        spawnText(powerUp.x, powerUp.y, "+15 HP!", "#ff69b4");
        break;
      case "star":
        setSuperMeter(m => Math.min(100, m + 50));
        spawnText(powerUp.x, powerUp.y, "+50% SUPER!", "#FFD700");
        break;
      case "shield":
        setHasShield(true);
        spawnText(powerUp.x, powerUp.y, "SHIELD!", "#00bfff");
        break;
      case "rage":
        setRageMode(true);
        setRageModeTimer(5);
        spawnText(powerUp.x, powerUp.y, "2x DAMAGE!", "#ff4500");
        break;
    }
  }, [spawnParticles, spawnText]);

  // Start countdown
  const startCountdown = useCallback(() => {
    soundManager.buttonPress();
    setPhase("countdown");
    setCountdownNum(3);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum === 0) {
      soundManager.countdownGo();
      soundManager.startBattleMusic();
      gameEndedRef.current = false;
      setBossHP(100);
      bossHPRef.current = 100;
      setPlayerHP(100);
      playerHPRef.current = 100;
      setCombo(0);
      comboRef.current = 0;
      setMaxCombo(0);
      setScore(0);
      setSuperMeter(0);
      setBossPhase("phase1");
      setBossEmotion("smug");
      setBossMessage("You DARE challenge ME?! 😾");
      setTimeout(() => setBossMessage(""), 2000);
      // Reset new states
      setIsCharging(false);
      setChargeTime(0);
      setChargeLevel(0);
      setCounterWindowActive(false);
      setCounterWindowTimer(0);
      setPowerUps([]);
      setHasShield(false);
      setRageMode(false);
      setRageModeTimer(0);
      setBossScale(1);
      setShowingPhaseTransition(false);
      setPhaseTransitionText("");
      phase2TriggeredRef.current = false;
      phase3TriggeredRef.current = false;
      lastPowerUpSpawnRef.current = Date.now();
      lastAttackTimeRef.current = Date.now(); // Reset attack timer
      setPhase("battle");
      return;
    }
    soundManager.countdown();
    const timer = setTimeout(() => setCountdownNum(c => c - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, countdownNum]);

  // Deal damage to boss helper
  const dealDamageToBoss = useCallback((baseDamage: number, isCharged = false) => {
    // Calculate multipliers
    const comboMult = getComboMultiplier(comboRef.current);
    const rageMult = rageMode ? 2 : 1;
    const counterMult = counterWindowActive ? 3 : 1;
    const totalDamage = Math.round(baseDamage * comboMult * rageMult * counterMult);

    // Visual effects based on damage
    const particleEmoji = totalDamage >= 20 ? "💥" : totalDamage >= 10 ? "⭐" : "💖";
    const particleCount = Math.min(15, Math.max(3, Math.floor(totalDamage / 2)));

    soundManager.bossHit();
    if (totalDamage >= 15) soundManager.criticalHit();

    spawnParticles(50, 30, particleEmoji, particleCount);
    if (isCharged) spawnParticles(50, 30, "✨", 5);

    // Damage text with multiplier info
    const dmgText = counterWindowActive ? `${totalDamage} COUNTER!` :
                    rageMult > 1 ? `${totalDamage} RAGE!` :
                    comboMult > 1 ? `${totalDamage} x${comboMult}` : `${totalDamage}`;
    const dmgColor = counterWindowActive ? "#00ffff" : rageMult > 1 ? "#ff4500" : comboMult >= 2 ? "#FFD700" : "#ff69b4";
    spawnText(50 + (Math.random() - 0.5) * 20, 35, dmgText, dmgColor);

    if (totalDamage >= 10) {
      triggerShake(totalDamage >= 20 ? 15 : 8);
      setBossShaking(true);
      setTimeout(() => setBossShaking(false), 300);
    }

    setBossHP(hp => {
      const newHP = Math.max(0, hp - totalDamage);
      bossHPRef.current = newHP;

      // Check for victory
      if (newHP <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        soundManager.victory();
        soundManager.stopMusic();
        setBossEmotion("defeated");
        setBossMessage("IMPOSSIBLE! 😿💔");
        spawnParticles(50, 30, "⭐", 15);
        spawnParticles(50, 30, "✨", 10);
        setPhase("victory");
        setTimeout(() => onCompleteRef.current(true), 2500);
      }

      // Phase transitions with effects
      if (newHP <= 30 && newHP > 0 && !phase3TriggeredRef.current) {
        phase3TriggeredRef.current = true;
        setBossPhase("phase3");
        setShowingPhaseTransition(true);
        setPhaseTransitionText("FINAL PHASE!");
        setBossScale(1.3);
        soundManager.specialAttack();
        triggerShake(20);
        setFlashColor("rgba(255,0,0,0.5)");
        setTimeout(() => setFlashColor(null), 300);
        setBossMessage("NOW I'M SERIOUS! 😈🔥");
        setTimeout(() => {
          setShowingPhaseTransition(false);
          setBossMessage("");
        }, 2000);
      } else if (newHP <= 60 && newHP > 30 && !phase2TriggeredRef.current) {
        phase2TriggeredRef.current = true;
        setBossPhase("phase2");
        setShowingPhaseTransition(true);
        setPhaseTransitionText("PHASE 2!");
        setBossScale(1.15);
        soundManager.bossAttack();
        triggerShake(12);
        setFlashColor("rgba(128,0,128,0.4)");
        setTimeout(() => setFlashColor(null), 200);
        setBossMessage("You'll regret that! 😾");
        setTimeout(() => {
          setShowingPhaseTransition(false);
          setBossMessage("");
        }, 1500);
      }

      return newHP;
    });

    // Update combo and score
    setCombo(c => {
      const newCombo = c + 1;
      if (newCombo > maxCombo) setMaxCombo(newCombo);

      // Combo milestone celebrations
      if (newCombo === 10 || newCombo === 20 || newCombo === 30) {
        soundManager.victory();
        spawnParticles(50, 50, "🔥", 10);
        spawnText(50, 55, newCombo === 30 ? "ON FIRE! 🔥🔥🔥" : newCombo === 20 ? "AMAZING! 🔥🔥" : "NICE! 🔥", "#FFD700");
        triggerShake(10);
      }

      return newCombo;
    });
    setScore(s => s + totalDamage * 10);
    setSuperMeter(m => Math.min(100, m + 2));

    // Boss reaction for bigger hits
    if (totalDamage >= 5 || Math.random() < 0.15) {
      setBossEmotion("hurt");
      setTimeout(() => setBossEmotion(bossHPRef.current > 30 ? "smug" : "angry"), 300);
    }
  }, [getComboMultiplier, rageMode, counterWindowActive, maxCombo, spawnParticles, spawnText, triggerShake]);

  // Handle player tap attack (quick tap)
  const handleTapAttack = useCallback(() => {
    if (phase !== "battle" || gameEndedRef.current || !canTap) return;

    // Can't attack during certain attack types - handle love bomb deflection
    if (currentAttack) {
      if (currentAttack.type === "lovebomb") {
        // Tapping deflects the love bomb!
        setCurrentAttack(prev => {
          if (!prev || prev.type !== "lovebomb") return prev;
          const newDeflected = (prev.deflected || 0) + 1;
          soundManager.parry();
          spawnParticles(50, 50, "💥", 2);
          if (newDeflected >= (prev.deflectCount || 5)) {
            // Fully deflected!
            soundManager.criticalHit();
            spawnText(50, 50, "DEFLECTED!", "#00ff00");
            setCombo(c => c + 3);
            setSuperMeter(m => Math.min(100, m + 10));
            return null;
          }
          return { ...prev, deflected: newDeflected };
        });
      }
      // Any attack blocks normal attacking (need to dodge or deflect)
      return;
    }

    // Cooldown between taps
    setCanTap(false);
    setTimeout(() => setCanTap(true), 120);

    dealDamageToBoss(2, false);
  }, [phase, canTap, currentAttack, dealDamageToBoss, spawnParticles, spawnText]);

  // Start charging attack
  const startCharging = useCallback(() => {
    if (phase !== "battle" || gameEndedRef.current || currentAttack) return;
    chargeStartRef.current = Date.now();
    setIsCharging(true);
    setChargeTime(0);
    setChargeLevel(0);
  }, [phase, currentAttack]);

  // Release charged attack
  const releaseCharge = useCallback(() => {
    if (!isCharging || !chargeStartRef.current) {
      setIsCharging(false);
      return;
    }

    const holdDuration = (Date.now() - chargeStartRef.current) / 1000;
    chargeStartRef.current = null;
    setIsCharging(false);
    setChargeTime(0);
    setChargeLevel(0);

    if (phase !== "battle" || gameEndedRef.current) return;

    // Can't attack while dodging needed
    if (currentAttack && currentAttack.type !== "lovebomb") return;

    // Determine charge level and damage
    let damage = 2;
    let isCharged = false;
    if (holdDuration >= 3) {
      damage = 15;
      isCharged = true;
      soundManager.specialAttack();
      triggerShake(15);
      spawnParticles(50, 30, "💥", 10);
      spawnParticles(50, 30, "⭐", 8);
    } else if (holdDuration >= 2) {
      damage = 10;
      isCharged = true;
      soundManager.criticalHit();
      triggerShake(10);
      spawnParticles(50, 30, "⭐", 6);
    } else if (holdDuration >= 1) {
      damage = 5;
      isCharged = true;
      soundManager.bossHit();
      triggerShake(5);
    }

    dealDamageToBoss(damage, isCharged);
  }, [isCharging, phase, currentAttack, dealDamageToBoss, triggerShake, spawnParticles]);

  // Update charge time while holding
  useEffect(() => {
    if (!isCharging) return;
    const timer = setInterval(() => {
      if (chargeStartRef.current) {
        const elapsed = (Date.now() - chargeStartRef.current) / 1000;
        setChargeTime(Math.min(3, elapsed));
        setChargeLevel(elapsed >= 3 ? 3 : elapsed >= 2 ? 2 : elapsed >= 1 ? 1 : 0);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [isCharging]);

  // Launch boss attack (player must swipe to dodge)
  const launchBossAttack = useCallback(() => {
    if (phase !== "battle" || gameEndedRef.current || currentAttack || showingPhaseTransition) return;

    const directions: SwipeDirection[] = ["left", "right", "up", "down"];
    const direction = directions[Math.floor(Math.random() * directions.length)];

    const phaseSpeed = bossPhase === "phase3" ? 1.2 : bossPhase === "phase2" ? 1.5 : 2.0;
    const baseDamage = bossPhase === "phase3" ? 20 : bossPhase === "phase2" ? 15 : 10;

    // Determine attack type based on phase
    let attackType: AttackType = "swipe";
    const roll = Math.random();

    if (bossPhase === "phase3") {
      // Phase 3: All attacks possible
      if (roll < 0.2) attackType = "rapidfire";
      else if (roll < 0.35) attackType = "fakeout";
      else if (roll < 0.5) attackType = "lovebomb";
      else if (roll < 0.65) attackType = "ragemode";
      // else normal swipe
    } else if (bossPhase === "phase2") {
      // Phase 2: Rapidfire and fakeout
      if (roll < 0.25) attackType = "rapidfire";
      else if (roll < 0.4) attackType = "fakeout";
      // else normal swipe
    }
    // Phase 1: Only normal swipes

    soundManager.bossAttack();
    setBossEmotion("charging");

    // Create attack based on type
    if (attackType === "rapidfire") {
      // 3 quick arrows in sequence
      const seq = Array.from({ length: 3 }, () => directions[Math.floor(Math.random() * 4)]);
      setBossMessage("RAPID FIRE! 💨💨💨");
      setCurrentAttack({
        id: Date.now(),
        type: "rapidfire",
        direction: seq[0],
        directions: seq,
        currentIndex: 0,
        timeLeft: phaseSpeed * 1.5,
        duration: phaseSpeed * 1.5,
        emoji: "⚡",
        damage: Math.floor(baseDamage / 2),
      });
    } else if (attackType === "fakeout") {
      // Shows one direction, then switches
      const fakeDir = direction;
      const realDir = directions.filter(d => d !== fakeDir)[Math.floor(Math.random() * 3)];
      setBossMessage("Can't fool me? 😏");
      setCurrentAttack({
        id: Date.now(),
        type: "fakeout",
        direction: fakeDir,
        realDirection: realDir,
        isFake: true,
        timeLeft: phaseSpeed * 1.2,
        duration: phaseSpeed * 1.2,
        emoji: DIRECTION_ARROWS[fakeDir],
        damage: Math.floor(baseDamage * 1.2),
      });
    } else if (attackType === "lovebomb") {
      // Circle that shrinks - tap rapidly to deflect
      setBossMessage("LOVE BOMB! 💣💕");
      setCurrentAttack({
        id: Date.now(),
        type: "lovebomb",
        direction: "up", // Not used for lovebomb
        timeLeft: phaseSpeed * 1.5,
        duration: phaseSpeed * 1.5,
        emoji: "💣",
        damage: Math.floor(baseDamage * 1.5),
        deflectCount: 5 + Math.floor(Math.random() * 3),
        deflected: 0,
      });
    } else if (attackType === "ragemode") {
      // Two directions at once - swipe diagonally
      const dir1 = directions[Math.floor(Math.random() * 2)]; // left or right
      const dir2 = directions[2 + Math.floor(Math.random() * 2)]; // up or down
      setBossMessage("DOUBLE TROUBLE! 😈😈");
      setCurrentAttack({
        id: Date.now(),
        type: "ragemode",
        direction: dir1,
        directions: [dir1, dir2],
        timeLeft: phaseSpeed,
        duration: phaseSpeed,
        emoji: "💢",
        damage: Math.floor(baseDamage * 1.3),
      });
    } else {
      // Normal swipe
      setBossMessage(["Feel my DRAMA! 😾", "TAKE THIS! 💢", "Can't dodge THIS! 😈"][Math.floor(Math.random() * 3)]);
      setCurrentAttack({
        id: Date.now(),
        type: "swipe",
        direction,
        timeLeft: phaseSpeed,
        duration: phaseSpeed,
        emoji: DIRECTION_ARROWS[direction],
        damage: baseDamage,
      });
    }
  }, [phase, currentAttack, bossPhase, showingPhaseTransition, DIRECTION_ARROWS]);

  // Boss attack timer
  useEffect(() => {
    if (phase !== "battle" || gameEndedRef.current) return;

    const attackInterval = bossPhase === "phase3" ? 2000 : bossPhase === "phase2" ? 2500 : 3500;

    const timer = setInterval(() => {
      // Only launch if no attack active and not in phase transition
      if (!currentAttack && !showingPhaseTransition && Date.now() - lastAttackTimeRef.current > attackInterval) {
        lastAttackTimeRef.current = Date.now();
        launchBossAttack();
      }
    }, 500);

    return () => clearInterval(timer);
  }, [phase, bossPhase, currentAttack, showingPhaseTransition, launchBossAttack]);

  // Current attack countdown
  useEffect(() => {
    if (!currentAttack) return;

    const timer = setInterval(() => {
      setCurrentAttack(prev => {
        if (!prev) return null;
        const newTimeLeft = prev.timeLeft - 0.05;

        // Fakeout switch - at 40% time remaining, switch to real direction
        if (prev.type === "fakeout" && prev.isFake && newTimeLeft < prev.duration * 0.4) {
          soundManager.buttonPress();
          return {
            ...prev,
            timeLeft: newTimeLeft,
            isFake: false,
            direction: prev.realDirection!,
            emoji: DIRECTION_ARROWS[prev.realDirection!],
          };
        }

        if (newTimeLeft <= 0) {
          // Player failed to dodge - take damage!
          // Check for shield
          if (hasShield) {
            setHasShield(false);
            soundManager.parry();
            spawnParticles(50, 50, "🛡️", 5);
            spawnText(50, 50, "SHIELD BLOCKED!", "#00bfff");
            setBossMessage("What?! 😲");
            setTimeout(() => setBossMessage(""), 1000);
            return null;
          }

          soundManager.damage();
          setPlayerHP(hp => {
            const newHP = Math.max(0, hp - prev.damage);
            playerHPRef.current = newHP;
            if (newHP <= 0 && !gameEndedRef.current) {
              gameEndedRef.current = true;
              soundManager.gameOver();
              soundManager.stopMusic();
              setPhase("defeat");
              setTimeout(() => onCompleteRef.current(false), 2500);
            }
            return newHP;
          });
          setFlashColor("rgba(255,0,0,0.4)");
          setTimeout(() => setFlashColor(null), 200);
          triggerShake(15);
          setCombo(0);
          comboRef.current = 0;
          setLastDodgeResult("miss");
          spawnText(50, 60, "OUCH! -" + prev.damage, "#ff4444");
          setBossMessage("Got you! 😼");
          setBossEmotion("smug");
          setTimeout(() => setBossMessage(""), 1000);
          // Cancel charging if hit
          setIsCharging(false);
          chargeStartRef.current = null;
          return null;
        }

        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 50);

    return () => clearInterval(timer);
  }, [currentAttack, hasShield, triggerShake, spawnText, spawnParticles, DIRECTION_ARROWS]);

  // Update particles
  useEffect(() => {
    if (particles.length === 0) return;
    const timer = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx * 0.1,
        y: p.y + p.vy * 0.1,
        vy: p.vy + 0.5,
        life: p.life - 0.03,
      })).filter(p => p.life > 0));
    }, 30);
    return () => clearInterval(timer);
  }, [particles.length]);

  // Handle successful dodge
  const handleDodgeSuccess = useCallback((isPerfect: boolean, isSpecialAttack: boolean) => {
    soundManager.parry();
    setBossEmotion("hurt");
    setTimeout(() => setBossEmotion(bossHPRef.current > 30 ? "smug" : "angry"), 500);

    if (isPerfect) {
      // Perfect dodge - activate counter window!
      soundManager.criticalHit();
      spawnParticles(50, 30, "⭐", 10);
      spawnText(50, 40, "PERFECT! COUNTER!", "#FFD700");
      setFlashColor("rgba(255,215,0,0.3)");
      setTimeout(() => setFlashColor(null), 150);
      setLastDodgeResult("perfect");
      setCombo(c => c + 5);
      setSuperMeter(m => Math.min(100, m + 15));
      setScore(s => s + (isSpecialAttack ? 750 : 500));
      setBossMessage("WHAT?! 😱");

      // Activate counter window for 1.5 seconds
      setCounterWindowActive(true);
      setCounterWindowTimer(1.5);
    } else {
      // Good dodge
      spawnParticles(50, 50, "✨", 5);
      spawnText(50, 50, isSpecialAttack ? "NICE DODGE!" : "DODGED!", "#00ff00");
      setLastDodgeResult("good");
      setCombo(c => c + (isSpecialAttack ? 3 : 1));
      setSuperMeter(m => Math.min(100, m + (isSpecialAttack ? 10 : 5)));
      setScore(s => s + (isSpecialAttack ? 200 : 100));
      setBossMessage("Tch! 😾");
    }
    setTimeout(() => {
      setBossMessage("");
      setLastDodgeResult("none");
    }, 1000);
  }, [spawnParticles, spawnText]);

  // Handle swipe to dodge
  const handleSwipe = useCallback((direction: SwipeDirection) => {
    if (!currentAttack || phase !== "battle") return;

    // Love bomb can't be swiped - must be tapped
    if (currentAttack.type === "lovebomb") {
      spawnText(50, 50, "TAP TO DEFLECT!", "#ffaa00");
      return;
    }

    // Ragemode needs diagonal swipe (both directions)
    if (currentAttack.type === "ragemode" && currentAttack.directions) {
      const [dir1, dir2] = currentAttack.directions;
      if (direction === dir1 || direction === dir2) {
        // Partial success - need both
        soundManager.parry();
        spawnParticles(50, 50, "✨", 3);

        // Mark this direction as done
        const newDirections = currentAttack.directions.filter(d => d !== direction);
        if (newDirections.length === 0) {
          // Both directions swiped!
          const timeRatio = currentAttack.timeLeft / currentAttack.duration;
          const isPerfect = timeRatio < 0.3;
          setCurrentAttack(null);
          handleDodgeSuccess(isPerfect, true);
        } else {
          setCurrentAttack({ ...currentAttack, directions: newDirections });
          spawnText(50, 50, "KEEP GOING!", "#00ff00");
        }
        return;
      } else {
        soundManager.hit();
        spawnText(50, 50, "WRONG WAY!", "#ff6666");
        return;
      }
    }

    // Rapidfire - need to match current direction in sequence
    if (currentAttack.type === "rapidfire" && currentAttack.directions) {
      const currentDir = currentAttack.directions[currentAttack.currentIndex || 0];
      if (direction === currentDir) {
        soundManager.parry();
        spawnParticles(50, 50, "⚡", 2);
        const nextIndex = (currentAttack.currentIndex || 0) + 1;

        if (nextIndex >= currentAttack.directions.length) {
          // All done!
          const timeRatio = currentAttack.timeLeft / currentAttack.duration;
          const isPerfect = timeRatio < 0.3;
          setCurrentAttack(null);
          handleDodgeSuccess(isPerfect, true);
        } else {
          // Next in sequence
          setCurrentAttack({
            ...currentAttack,
            currentIndex: nextIndex,
            direction: currentAttack.directions[nextIndex],
          });
          spawnText(50, 50, `${nextIndex}/${currentAttack.directions.length}`, "#00ffff");
        }
        return;
      } else {
        soundManager.hit();
        spawnText(50, 50, "WRONG WAY!", "#ff6666");
        return;
      }
    }

    // Normal swipe or fakeout (after switch)
    if (direction === currentAttack.direction) {
      const timeRatio = currentAttack.timeLeft / currentAttack.duration;
      const isPerfect = timeRatio < 0.3;
      setCurrentAttack(null);
      handleDodgeSuccess(isPerfect, false);
    } else {
      soundManager.hit();
      spawnText(50, 50, "WRONG WAY!", "#ff6666");
    }
  }, [currentAttack, phase, spawnParticles, spawnText, handleDodgeSuccess]);

  // Counter window timer
  useEffect(() => {
    if (!counterWindowActive) return;
    const timer = setInterval(() => {
      setCounterWindowTimer(t => {
        if (t <= 0.05) {
          setCounterWindowActive(false);
          return 0;
        }
        return t - 0.05;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [counterWindowActive]);

  // Power-up spawning
  useEffect(() => {
    if (phase !== "battle" || gameEndedRef.current) return;

    const timer = setInterval(() => {
      if (Date.now() - lastPowerUpSpawnRef.current > 15000 + Math.random() * 10000) {
        lastPowerUpSpawnRef.current = Date.now();
        spawnPowerUp();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, spawnPowerUp]);

  // Power-up timer countdown
  useEffect(() => {
    if (powerUps.length === 0) return;
    const timer = setInterval(() => {
      setPowerUps(prev => prev.map(p => ({ ...p, timeLeft: p.timeLeft - 0.1 })).filter(p => p.timeLeft > 0));
    }, 100);
    return () => clearInterval(timer);
  }, [powerUps.length]);

  // Rage mode timer
  useEffect(() => {
    if (!rageMode) return;
    const timer = setInterval(() => {
      setRageModeTimer(t => {
        if (t <= 0.1) {
          setRageMode(false);
          return 0;
        }
        return t - 0.1;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [rageMode]);

  // Touch handlers (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    // Start charging if no attack incoming
    if (!currentAttack || currentAttack.type === "lovebomb") {
      startCharging();
    }
  }, [currentAttack, startCharging]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const minSwipeDistance = 50;
    const maxTapDistance = 20;

    // Check if it's a swipe
    if (Math.abs(dx) > minSwipeDistance || Math.abs(dy) > minSwipeDistance) {
      setIsCharging(false);
      chargeStartRef.current = null;
      let direction: SwipeDirection;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "down" : "up";
      }
      handleSwipe(direction);
    }
    // Check if it's a tap/charge release
    else if (Math.abs(dx) < maxTapDistance && Math.abs(dy) < maxTapDistance) {
      if (dt >= 500 && isCharging) {
        // It was a hold - release charge attack
        releaseCharge();
      } else {
        // Quick tap
        setIsCharging(false);
        chargeStartRef.current = null;
        handleTapAttack();
      }
    } else {
      setIsCharging(false);
      chargeStartRef.current = null;
    }
  }, [handleSwipe, handleTapAttack, isCharging, releaseCharge]);

  // Mouse handlers (desktop/laptop)
  const mouseStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    // Start charging if no attack incoming
    if (!currentAttack || currentAttack.type === "lovebomb") {
      startCharging();
    }
  }, [currentAttack, startCharging]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!mouseStartRef.current) return;

    const dx = e.clientX - mouseStartRef.current.x;
    const dy = e.clientY - mouseStartRef.current.y;
    const dt = Date.now() - mouseStartRef.current.time;
    mouseStartRef.current = null;

    const minSwipeDistance = 50;
    const maxTapDistance = 20;

    // Check if it's a drag (swipe)
    if (Math.abs(dx) > minSwipeDistance || Math.abs(dy) > minSwipeDistance) {
      setIsCharging(false);
      chargeStartRef.current = null;
      let direction: SwipeDirection;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "down" : "up";
      }
      handleSwipe(direction);
    }
    // Check if it's a click/charge release
    else if (Math.abs(dx) < maxTapDistance && Math.abs(dy) < maxTapDistance) {
      if (dt >= 500 && isCharging) {
        // It was a hold - release charge attack
        releaseCharge();
      } else {
        // Quick click
        setIsCharging(false);
        chargeStartRef.current = null;
        handleTapAttack();
      }
    } else {
      setIsCharging(false);
      chargeStartRef.current = null;
    }
  }, [handleSwipe, handleTapAttack, isCharging, releaseCharge, currentAttack, startCharging]);

  // Handle QTE button press
  const handleQTEPress = useCallback((button: string) => {
    if (phase !== "qte") return;

    if (qteSequence[qteIndex] === button) {
      soundManager.collect();
      if (qteIndex === qteSequence.length - 1) {
        // QTE Success!
        soundManager.specialAttack();
        soundManager.criticalHit();
        const damage = 30;
        setBossHP(hp => {
          const newHP = Math.max(0, hp - damage);
          bossHPRef.current = newHP;
          if (newHP <= 0 && !gameEndedRef.current) {
            gameEndedRef.current = true;
            soundManager.victory();
            soundManager.stopMusic();
            setBossEmotion("defeated");
            setPhase("victory");
            setTimeout(() => onCompleteRef.current(true), 2500);
          }
          return newHP;
        });
        spawnParticles(50, 30, "💥", 15);
        spawnParticles(50, 30, "⭐", 10);
        spawnText(50, 35, "SUPER! -" + damage, "#FFD700");
        triggerShake(20);
        setBossShaking(true);
        setTimeout(() => setBossShaking(false), 500);
        setBossMessage("NOOOOO! 😭");
        setTimeout(() => setBossMessage(""), 1500);
        setScore(s => s + 2000);
        setPhase("battle");
      } else {
        setQteIndex(i => i + 1);
      }
    } else {
      soundManager.damage();
      setPhase("battle");
      setBossMessage("WRONG! 😼");
      setTimeout(() => setBossMessage(""), 1000);
    }
  }, [phase, qteSequence, qteIndex, spawnParticles, spawnText, triggerShake]);

  // Keyboard handlers (desktop/laptop)
  useEffect(() => {
    if (phase !== "battle" && phase !== "qte") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys or WASD for dodging
      if (phase === "battle") {
        switch (e.key) {
          case "ArrowLeft":
          case "a":
          case "A":
            handleSwipe("left");
            break;
          case "ArrowRight":
          case "d":
          case "D":
            handleSwipe("right");
            break;
          case "ArrowUp":
          case "w":
          case "W":
            handleSwipe("up");
            break;
          case "ArrowDown":
          case "s":
          case "S":
            handleSwipe("down");
            break;
          case " ": // Spacebar for attack
            e.preventDefault();
            handleTapAttack();
            break;
        }
      }
      // QTE button shortcuts
      if (phase === "qte") {
        switch (e.key) {
          case "1":
            handleQTEPress("💖");
            break;
          case "2":
            handleQTEPress("⭐");
            break;
          case "3":
            handleQTEPress("✨");
            break;
          case "4":
            handleQTEPress("💕");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleSwipe, handleTapAttack, handleQTEPress]);

  // Activate super attack (QTE)
  const activateSuper = useCallback(() => {
    if (superMeter < 100 || phase !== "battle") return;

    soundManager.specialAttack();
    setSuperMeter(0);
    const buttons = ["💖", "⭐", "✨", "💕"];
    const sequence = Array.from({ length: 4 }, () => buttons[Math.floor(Math.random() * 4)]);
    setQteSequence(sequence);
    setQteIndex(0);
    setQteTimeLeft(4);
    setPhase("qte");
  }, [superMeter, phase]);

  // QTE countdown
  useEffect(() => {
    if (phase !== "qte") return;

    const timer = setInterval(() => {
      setQteTimeLeft(t => {
        if (t <= 0.1) {
          soundManager.damage();
          setPhase("battle");
          setBossMessage("Too slow! 😼");
          setTimeout(() => setBossMessage(""), 1000);
          return 0;
        }
        return t - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [phase]);

  // TUTORIAL SCREEN
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border-2 border-purple-500/50"
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            👑😾👑
          </motion.div>

          <h2 className="text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent mb-3">
            THE DRAMA KING
          </h2>
          <p className="text-purple-300 text-sm mb-4">
            "You DARE challenge me?!<br />
            <span className="font-bold text-pink-400">PROVE YOUR LOVE!</span>"
          </p>

          <div className="bg-slate-700/60 rounded-2xl p-4 mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-500/30 rounded-xl flex items-center justify-center">
                <span className="text-xl">👆</span>
              </div>
              <div className="text-left flex-1">
                <div className="text-white text-sm font-bold">TAP or HOLD!</div>
                <div className="text-slate-400 text-xs">Tap to attack, hold to charge!</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/30 rounded-xl flex items-center justify-center">
                <span className="text-xl">👋</span>
              </div>
              <div className="text-left flex-1">
                <div className="text-white text-sm font-bold">SWIPE to Dodge!</div>
                <div className="text-slate-400 text-xs">Perfect timing = counter!</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/30 rounded-xl flex items-center justify-center">
                <span className="text-xl">🔥</span>
              </div>
              <div className="text-left flex-1">
                <div className="text-white text-sm font-bold">Build Combos!</div>
                <div className="text-slate-400 text-xs">10+ combo = damage boost!</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/30 rounded-xl flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-bold">SUPER Attack!</div>
                <div className="text-slate-400 text-xs">Fill meter for mega damage!</div>
              </div>
            </div>
          </div>

          <motion.button
            onClick={startCountdown}
            className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white rounded-2xl font-bold text-xl shadow-xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            FIGHT! ⚔️
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // COUNTDOWN SCREEN
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <motion.div
          key={countdownNum}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 2, opacity: 0 }}
          className="text-[120px] font-black text-white drop-shadow-2xl"
        >
          {countdownNum || "FIGHT!"}
        </motion.div>
      </div>
    );
  }

  // VICTORY SCREEN
  if (phase === "victory") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-yellow-500 via-pink-500 to-purple-600 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            🏆
          </motion.div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-yellow-500 to-pink-500 bg-clip-text text-transparent mb-4">
            VICTORY!
          </h2>
          <p className="text-slate-600 mb-2">"Fine... I accept your love... 💕"</p>
          <div className="space-y-1 text-slate-500">
            <p>Score: <span className="font-bold text-pink-500">{score}</span></p>
            <p>Max Combo: <span className="font-bold text-purple-500">{maxCombo}</span></p>
          </div>
        </motion.div>
      </div>
    );
  }

  // DEFEAT SCREEN
  if (phase === "defeat") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-red-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-2 border-red-500/50"
        >
          <div className="text-6xl mb-4">😿💔</div>
          <h2 className="text-3xl font-black text-red-400 mb-4">DEFEATED...</h2>
          <p className="text-slate-400 mb-2">"I KNEW you couldn't handle my drama!" 👑</p>
          <p className="text-slate-500">Score: {score}</p>
        </motion.div>
      </div>
    );
  }

  // QTE SCREEN
  if (phase === "qte") {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl p-6 text-center w-full max-w-sm"
        >
          <h3 className="text-2xl font-bold text-white mb-4">SUPER ATTACK!</h3>

          {/* Timer bar */}
          <div className="w-full h-3 bg-slate-700 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 to-red-500"
              style={{ width: `${(qteTimeLeft / 4) * 100}%` }}
            />
          </div>

          {/* Sequence display */}
          <div className="flex justify-center gap-2 mb-6">
            {qteSequence.map((btn, i) => (
              <motion.div
                key={i}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                  i < qteIndex ? "bg-green-500" : i === qteIndex ? "bg-yellow-400 animate-pulse" : "bg-slate-600"
                )}
              >
                {btn}
              </motion.div>
            ))}
          </div>

          {/* Input buttons */}
          <div className="grid grid-cols-4 gap-2">
            {["💖", "⭐", "✨", "💕"].map(btn => (
              <motion.button
                key={btn}
                onClick={() => handleQTEPress(btn)}
                className="h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl text-2xl shadow-lg active:scale-95"
                whileTap={{ scale: 0.9 }}
              >
                {btn}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // MAIN BATTLE SCREEN
  return (
    <div
      className={cn(
        "fixed inset-0 overflow-hidden select-none transition-colors duration-500",
        bossPhase === "phase3" ? "bg-gradient-to-b from-slate-900 via-red-950/80 to-slate-900" :
        bossPhase === "phase2" ? "bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900" :
        "bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900"
      )}
      style={{
        transform: screenShake ? `translate(${(Math.random() - 0.5) * screenShake}px, ${(Math.random() - 0.5) * screenShake}px)` : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
      />

      {/* Flash effect */}
      {flashColor && (
        <div className="absolute inset-0 z-50 pointer-events-none transition-opacity" style={{ backgroundColor: flashColor }} />
      )}

      {/* Top HUD Container */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-black/40 to-transparent">
        {/* Boss HP */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-purple-900/80 flex items-center justify-center border border-purple-500/30">
            <span className="text-sm">👑</span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Drama King</span>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                bossPhase === "phase3" ? "bg-red-500/40 text-red-200" :
                bossPhase === "phase2" ? "bg-purple-500/40 text-purple-200" :
                "bg-slate-500/40 text-slate-300"
              )}>
                {bossPhase === "phase3" ? "FINAL" : bossPhase === "phase2" ? "P2" : "P1"}
              </span>
            </div>
            <div className="h-3 bg-slate-900/80 rounded-full overflow-hidden shadow-inner">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  bossPhase === "phase3" ? "bg-gradient-to-r from-red-600 via-orange-500 to-red-600" :
                  bossPhase === "phase2" ? "bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600" :
                  "bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500"
                )}
                style={{ width: `${bossHP}%`, boxShadow: "0 0 10px currentColor" }}
              />
            </div>
          </div>
          <span className="text-white text-xs font-bold w-10 text-right tabular-nums">{Math.ceil(bossHP)}</span>
        </div>

        {/* Player HP */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-pink-900/80 flex items-center justify-center border border-pink-500/30">
            <span className="text-sm">💖</span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[10px] font-bold text-pink-300 uppercase tracking-wider">You</span>
              {hasShield && <span className="text-[10px] text-cyan-300">🛡️ Protected</span>}
            </div>
            <div className="h-3 bg-slate-900/80 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-rose-400 to-pink-500 transition-all duration-300 rounded-full"
                style={{ width: `${playerHP}%`, boxShadow: "0 0 8px rgba(236,72,153,0.6)" }}
              />
            </div>
          </div>
          <span className="text-white text-xs font-bold w-10 text-right tabular-nums">{Math.ceil(playerHP)}</span>
        </div>

        {/* Score and Combo Row */}
        <div className="flex justify-between items-center">
          <div className="bg-slate-800/60 rounded-lg px-3 py-1 border border-slate-700/50">
            <span className="text-[10px] text-slate-400 uppercase">Score</span>
            <span className="text-white text-sm font-bold ml-2 tabular-nums">{score.toLocaleString()}</span>
          </div>

          {combo > 0 ? (
            <div className={cn(
              "rounded-lg px-3 py-1 border transition-all",
              combo >= 30 ? "bg-yellow-500/20 border-yellow-500/50" :
              combo >= 20 ? "bg-orange-500/20 border-orange-500/50" :
              combo >= 10 ? "bg-pink-500/20 border-pink-500/50" :
              "bg-purple-500/20 border-purple-500/50"
            )}>
              <span className={cn(
                "font-black text-sm",
                combo >= 30 ? "text-yellow-300" :
                combo >= 20 ? "text-orange-300" :
                combo >= 10 ? "text-pink-300" : "text-purple-300"
              )}>
                {combo}x {combo >= 30 ? "🔥🔥🔥" : combo >= 20 ? "🔥🔥" : combo >= 10 ? "🔥" : ""}
              </span>
              {combo >= 10 && (
                <span className="text-[10px] ml-1 opacity-80">
                  ({combo >= 30 ? "2.5x" : combo >= 20 ? "2x" : "1.5x"})
                </span>
              )}
            </div>
          ) : (
            <div className="bg-slate-800/40 rounded-lg px-3 py-1 border border-slate-700/30">
              <span className="text-slate-500 text-xs">No Combo</span>
            </div>
          )}
        </div>
      </div>

      {/* Boss Area - Center */}
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
        {/* Boss glow effect for phases */}
        {bossPhase !== "phase1" && (
          <div className={cn(
            "absolute inset-0 rounded-full blur-3xl -z-10 transition-opacity duration-500",
            bossPhase === "phase3" ? "bg-red-500/30 scale-150" : "bg-purple-500/20 scale-125"
          )} />
        )}

        <div
          className="text-center transition-transform duration-300"
          style={{ transform: `scale(${bossScale})${bossShaking ? " translateX(3px)" : ""}` }}
        >
          <div className={cn(
            "text-5xl mb-1 transition-all",
            bossPhase === "phase3" && "animate-pulse"
          )}>👑</div>
          <div className={cn(
            "text-7xl transition-all",
            bossPhase === "phase3" && "drop-shadow-[0_0_20px_rgba(255,50,50,0.8)]",
            bossPhase === "phase2" && "drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]"
          )}>
            {bossEmotion === "defeated" ? "😵" :
             bossEmotion === "hurt" ? "😿" :
             bossEmotion === "charging" ? "😈" :
             bossEmotion === "angry" ? "😾" : "😼"}
          </div>
        </div>

        {/* Boss message - cleaner speech bubble */}
        {bossMessage && (
          <div className="mt-4 max-w-[200px] animate-[fadeIn_0.2s_ease-out]">
            <div className="relative bg-slate-800/95 backdrop-blur rounded-2xl px-4 py-2 border border-slate-600/50 shadow-xl">
              <p className="text-white text-sm font-medium text-center">{bossMessage}</p>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800/95 border-l border-t border-slate-600/50 rotate-45" />
            </div>
          </div>
        )}
      </div>

      {/* Attack Warning - Center Card */}
      {currentAttack && (
        <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-[fadeIn_0.15s_ease-out]">
          <div className={cn(
            "relative rounded-3xl p-4 shadow-2xl border-2 backdrop-blur-sm min-w-[180px]",
            currentAttack.type === "lovebomb" ? "bg-pink-950/90 border-pink-500/60" :
            currentAttack.type === "rapidfire" ? "bg-cyan-950/90 border-cyan-500/60" :
            currentAttack.type === "ragemode" ? "bg-red-950/90 border-red-500/60" :
            currentAttack.type === "fakeout" && currentAttack.isFake ? "bg-orange-950/90 border-orange-500/60" :
            "bg-slate-900/90 border-white/30"
          )}>
            {/* Attack type label */}
            <div className={cn(
              "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              currentAttack.type === "lovebomb" ? "bg-pink-500 text-white" :
              currentAttack.type === "rapidfire" ? "bg-cyan-500 text-white" :
              currentAttack.type === "ragemode" ? "bg-red-500 text-white" :
              currentAttack.type === "fakeout" && currentAttack.isFake ? "bg-orange-500 text-white" :
              "bg-white text-slate-900"
            )}>
              {currentAttack.type === "lovebomb" ? "DEFLECT!" :
               currentAttack.type === "rapidfire" ? "RAPID" :
               currentAttack.type === "ragemode" ? "RAGE" :
               currentAttack.type === "fakeout" && currentAttack.isFake ? "FAKEOUT" : "DODGE"}
            </div>

            <div className="text-center pt-1">
              {/* Love Bomb */}
              {currentAttack.type === "lovebomb" ? (
                <>
                  <div className="text-6xl mb-2" style={{ transform: `scale(${1 - (1 - currentAttack.timeLeft / currentAttack.duration) * 0.4})` }}>
                    💣💕
                  </div>
                  <div className="text-pink-300 font-bold text-base">TAP FAST!</div>
                  <div className="flex justify-center gap-1 mt-2">
                    {Array.from({ length: currentAttack.deflectCount || 5 }).map((_, i) => (
                      <div key={i} className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        i < (currentAttack.deflected || 0) ? "bg-green-400 scale-110" : "bg-slate-600"
                      )} />
                    ))}
                  </div>
                </>
              ) : currentAttack.type === "rapidfire" && currentAttack.directions ? (
                <>
                  <div className="flex gap-1.5 justify-center mb-2">
                    {currentAttack.directions.map((dir, i) => (
                      <div key={i} className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-3xl transition-all",
                        i < (currentAttack.currentIndex || 0) ? "bg-green-500/30 opacity-50 scale-90" :
                        i === (currentAttack.currentIndex || 0) ? "bg-yellow-500/40 ring-2 ring-yellow-400 scale-105" :
                        "bg-slate-700/50"
                      )}>
                        {DIRECTION_ARROWS[dir]}
                      </div>
                    ))}
                  </div>
                  <div className="text-cyan-300 font-bold text-base">SWIPE SEQUENCE!</div>
                </>
              ) : currentAttack.type === "ragemode" && currentAttack.directions ? (
                <>
                  <div className="flex gap-2 justify-center mb-2">
                    {currentAttack.directions.map((dir, i) => (
                      <div key={i} className="w-14 h-14 rounded-xl bg-red-500/30 flex items-center justify-center text-4xl animate-pulse">
                        {DIRECTION_ARROWS[dir]}
                      </div>
                    ))}
                  </div>
                  <div className="text-red-300 font-bold text-base">SWIPE BOTH!</div>
                </>
              ) : currentAttack.type === "fakeout" && currentAttack.isFake ? (
                <>
                  <div className="text-6xl mb-2 opacity-60 animate-pulse">{currentAttack.emoji}</div>
                  <div className="text-orange-300 font-bold text-base">WAIT FOR IT...</div>
                  <div className="text-orange-400/80 text-xs mt-1">Direction will change!</div>
                </>
              ) : (
                <>
                  <div className="text-7xl mb-1">{currentAttack.emoji}</div>
                  <div className="text-white font-bold text-lg">SWIPE {currentAttack.direction.toUpperCase()}</div>
                </>
              )}
            </div>

            {/* Timer bar at bottom of card */}
            <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-75 rounded-full",
                  currentAttack.type === "lovebomb" ? "bg-gradient-to-r from-pink-400 to-yellow-400" :
                  currentAttack.type === "rapidfire" ? "bg-gradient-to-r from-cyan-400 to-blue-400" :
                  currentAttack.type === "ragemode" ? "bg-gradient-to-r from-red-500 to-orange-400" :
                  currentAttack.timeLeft / currentAttack.duration < 0.3 ? "bg-red-500" : "bg-gradient-to-r from-green-400 to-yellow-400"
                )}
                style={{ width: `${(currentAttack.timeLeft / currentAttack.duration) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dodge result feedback */}
      {lastDodgeResult !== "none" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        >
          <span className={cn(
            "text-4xl font-black",
            lastDodgeResult === "perfect" ? "text-yellow-400" :
            lastDodgeResult === "good" ? "text-green-400" : "text-red-400"
          )}>
            {lastDodgeResult === "perfect" ? "PERFECT! ⭐" :
             lastDodgeResult === "good" ? "DODGED! ✨" : "OUCH! 💔"}
          </span>
        </motion.div>
      )}

      {/* Floating texts */}
      <AnimatePresence>
        {floatingTexts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -50 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute font-black text-xl pointer-events-none z-40"
            style={{ left: `${t.x}%`, top: `${t.y}%`, color: t.color, transform: "translateX(-50%)" }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute text-2xl pointer-events-none z-30"
          style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: p.life, transform: "translate(-50%, -50%)" }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Power-ups - Floating collectibles */}
      {powerUps.map(powerUp => (
        <button
          key={powerUp.id}
          onClick={() => collectPowerUp(powerUp)}
          className={cn(
            "absolute z-35 cursor-pointer transition-all duration-200 hover:scale-125",
            "animate-[bounceFloat_1s_ease-in-out_infinite]"
          )}
          style={{
            left: `${powerUp.x}%`,
            top: `${powerUp.y}%`,
            transform: "translate(-50%, -50%)",
            opacity: powerUp.timeLeft > 1 ? 1 : powerUp.timeLeft,
          }}
        >
          <div className={cn(
            "relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
            "border-2 backdrop-blur-sm",
            powerUp.type === "heart" && "bg-pink-500/30 border-pink-400/60 shadow-pink-500/30",
            powerUp.type === "star" && "bg-yellow-500/30 border-yellow-400/60 shadow-yellow-500/30",
            powerUp.type === "shield" && "bg-cyan-500/30 border-cyan-400/60 shadow-cyan-500/30",
            powerUp.type === "rage" && "bg-red-500/30 border-red-400/60 shadow-red-500/30"
          )}>
            <span className="text-2xl">{powerUp.emoji}</span>
            {/* Timer ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28" cy="28" r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(powerUp.timeLeft / 5) * 163} 163`}
                className={cn(
                  powerUp.type === "heart" && "text-pink-400",
                  powerUp.type === "star" && "text-yellow-400",
                  powerUp.type === "shield" && "text-cyan-400",
                  powerUp.type === "rage" && "text-red-400"
                )}
              />
            </svg>
          </div>
        </button>
      ))}

      {/* Counter Window Indicator - Dramatic golden overlay */}
      {counterWindowActive && (
        <div className="absolute inset-0 pointer-events-none z-25 animate-[fadeIn_0.15s_ease-out]">
          {/* Golden vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20" />
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/20 via-transparent to-yellow-500/20" />

          {/* Animated border */}
          <div className="absolute inset-3 rounded-3xl border-4 border-yellow-400/80 animate-pulse shadow-[0_0_30px_rgba(250,204,21,0.4),inset_0_0_30px_rgba(250,204,21,0.1)]" />

          {/* Counter indicator */}
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2">
            <div className="bg-yellow-500/90 rounded-2xl px-6 py-3 shadow-2xl border border-yellow-300/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-yellow-950 font-black text-lg">
                <span className="animate-pulse">⚡</span>
                <span>COUNTER!</span>
                <span className="animate-pulse">⚡</span>
              </div>
              <div className="text-yellow-800 text-xs text-center font-semibold mt-1">3x DAMAGE</div>
            </div>
            {/* Timer bar */}
            <div className="mt-3 w-40 h-2 bg-slate-900/80 rounded-full overflow-hidden mx-auto border border-yellow-500/30">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-amber-400 transition-all shadow-[0_0_10px_rgba(250,204,21,0.6)]"
                style={{ width: `${(counterWindowTimer / 1.5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Charge Indicator - Centered power circle */}
      {isCharging && chargeTime > 0.3 && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-[scaleIn_0.2s_ease-out]">
          <div className={cn(
            "relative w-24 h-24 rounded-full",
            chargeLevel >= 3 && "animate-pulse"
          )}>
            {/* Outer glow */}
            <div className={cn(
              "absolute inset-0 rounded-full blur-xl transition-colors duration-300",
              chargeLevel >= 3 ? "bg-fuchsia-500/50" :
              chargeLevel >= 2 ? "bg-yellow-500/40" :
              chargeLevel >= 1 ? "bg-pink-500/30" : "bg-white/20"
            )} />

            {/* Background circle */}
            <div className="absolute inset-2 rounded-full bg-slate-900/90 border border-white/10" />

            {/* Progress ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48" cy="48" r="42"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="6"
              />
              <circle
                cx="48" cy="48" r="42"
                fill="none"
                stroke={chargeLevel >= 3 ? "#e879f9" : chargeLevel >= 2 ? "#facc15" : chargeLevel >= 1 ? "#f472b6" : "#fff"}
                strokeWidth="6"
                strokeDasharray={`${(chargeTime / 3) * 264} 264`}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 8px currentColor)" }}
              />
            </svg>

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(
                "text-3xl transition-transform",
                chargeLevel >= 3 && "scale-125"
              )}>
                {chargeLevel >= 3 ? "💥" : chargeLevel >= 2 ? "⭐" : chargeLevel >= 1 ? "✨" : "💖"}
              </span>
            </div>
          </div>

          {/* Charge level label */}
          {chargeLevel >= 1 && (
            <div className={cn(
              "text-center mt-2 font-black text-sm tracking-wider px-4 py-1 rounded-full",
              chargeLevel >= 3 ? "bg-fuchsia-500/30 text-fuchsia-300" :
              chargeLevel >= 2 ? "bg-yellow-500/30 text-yellow-300" :
              "bg-pink-500/30 text-pink-300"
            )}>
              {chargeLevel >= 3 ? "💥 MEGA!" : chargeLevel >= 2 ? "⭐ HEAVY!" : "✨ CHARGED!"}
            </div>
          )}

          {/* Damage preview */}
          <div className="text-center text-white/60 text-xs mt-1">
            {chargeLevel >= 3 ? "15 DMG" : chargeLevel >= 2 ? "10 DMG" : chargeLevel >= 1 ? "5 DMG" : ""}
          </div>
        </div>
      )}

      {/* Status Indicators - Floating badges */}
      <div className="absolute top-[140px] right-3 z-30 flex flex-col gap-2">
        {hasShield && (
          <div className="animate-[scaleIn_0.2s_ease-out] bg-cyan-500/20 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-cyan-400/40 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛡️</span>
              <div>
                <div className="text-cyan-300 text-xs font-bold">SHIELD</div>
                <div className="text-cyan-400/60 text-[10px]">Block 1 hit</div>
              </div>
            </div>
          </div>
        )}
        {rageMode && (
          <div className="animate-[pulse_0.3s_ease-in-out_infinite] bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-red-400/40 shadow-lg shadow-red-500/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <div>
                <div className="text-red-300 text-xs font-bold">RAGE MODE</div>
                <div className="text-red-400/80 text-[10px] font-mono tabular-nums">{Math.ceil(rageModeTimer)}s • 2x DMG</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase Transition Overlay - Dramatic announcement */}
      {showingPhaseTransition && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-[fadeIn_0.2s_ease-out]">
          {/* Dark overlay with radial gradient */}
          <div className={cn(
            "absolute inset-0",
            bossPhase === "phase3"
              ? "bg-gradient-radial from-red-900/60 via-black/70 to-black/80"
              : "bg-gradient-radial from-purple-900/60 via-black/70 to-black/80"
          )} />

          {/* Lightning effect lines */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={cn(
              "absolute top-0 left-1/4 w-1 h-full opacity-30",
              bossPhase === "phase3" ? "bg-red-500" : "bg-purple-500"
            )} style={{ transform: "skewX(-15deg)" }} />
            <div className={cn(
              "absolute top-0 right-1/4 w-1 h-full opacity-30",
              bossPhase === "phase3" ? "bg-red-500" : "bg-purple-500"
            )} style={{ transform: "skewX(15deg)" }} />
          </div>

          {/* Main announcement */}
          <div className="relative animate-[bounceIn_0.5s_ease-out]">
            <div className={cn(
              "text-5xl sm:text-6xl font-black px-10 py-5 rounded-2xl shadow-2xl",
              "border-4 backdrop-blur-sm",
              bossPhase === "phase3"
                ? "bg-gradient-to-br from-red-600 via-orange-600 to-red-700 border-red-400 text-white shadow-red-500/50"
                : "bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 border-purple-400 text-white shadow-purple-500/50"
            )}>
              {phaseTransitionText}
            </div>

            {/* Sub-text */}
            <div className={cn(
              "text-center mt-4 text-lg font-bold tracking-wider uppercase",
              bossPhase === "phase3" ? "text-red-300" : "text-purple-300"
            )}>
              {bossPhase === "phase3" ? "⚠️ FINAL PHASE ⚠️" : "💀 PHASE 2 💀"}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Area - Controls HUD */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/50 to-transparent pt-8 pb-4 px-4">
        {/* Super meter - Redesigned */}
        <div className="max-w-md mx-auto mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-800/80 rounded-lg px-2 py-1 border border-yellow-500/30">
              <span className="text-yellow-400">⚡</span>
              <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Super</span>
            </div>

            <div className="flex-1 relative">
              {/* Background track */}
              <div className="h-5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
                {/* Progress fill */}
                <div
                  className={cn(
                    "h-full transition-all duration-300 rounded-full relative overflow-hidden",
                    superMeter >= 100
                      ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400"
                      : "bg-gradient-to-r from-yellow-600 to-orange-500"
                  )}
                  style={{ width: `${superMeter}%` }}
                >
                  {/* Shine effect */}
                  {superMeter >= 100 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]" />
                  )}
                </div>

                {/* Percentage text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-[10px] font-bold",
                    superMeter >= 50 ? "text-white" : "text-slate-400"
                  )}>
                    {Math.floor(superMeter)}%
                  </span>
                </div>
              </div>
            </div>

            {superMeter >= 100 && (
              <button
                onClick={activateSuper}
                className="animate-pulse px-5 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl font-black text-white text-sm shadow-lg shadow-yellow-500/30 border border-yellow-300/50 hover:scale-105 transition-transform"
              >
                ⚡ GO!
              </button>
            )}
          </div>
        </div>

        {/* Tap hint - Cleaner design */}
        {!currentAttack && !isCharging && (
          <div className="text-center animate-[pulse_2s_ease-in-out_infinite]">
            <div className="inline-flex items-center gap-3 bg-slate-800/60 rounded-full px-4 py-2 border border-slate-600/40">
              <span className="text-slate-400 text-sm">👆</span>
              <span className="text-slate-300 text-xs font-medium">
                <span className="text-pink-400">TAP</span> to attack •
                <span className="text-purple-400"> HOLD</span> to charge
              </span>
              <span className="text-slate-400 text-sm">👆</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// FINAL PROPOSAL SCENE - After defeating the boss
// ============================================================================

const FinalProposalScene = memo(function FinalProposalScene({
  onYes,
  stats
}: {
  onYes: () => void;
  stats: { noCount: number; yesTime: number; petCount: number; totalScore: number };
}) {
  const [phase, setPhase] = useState<"intro" | "story" | "question" | "waiting">("intro");
  const [storyIndex, setStoryIndex] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [noButtonPos, setNoButtonPos] = useState({ x: 0, y: 0 });
  const [noAttempts, setNoAttempts] = useState(0);
  const [catEmotion, setCatEmotion] = useState<"hopeful" | "nervous" | "pleading" | "overjoyed">("hopeful");
  const [bgHue, setBgHue] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const STORY_LINES = [
    { text: "You've come so far...", emoji: "✨", delay: 2000 },
    { text: "Through chases and games...", emoji: "🎮", delay: 2000 },
    { text: "Through puzzles and battles...", emoji: "⚔️", delay: 2000 },
    { text: "You proved your love is real.", emoji: "💖", delay: 2500 },
    { text: "And now...", emoji: "🌟", delay: 1500 },
  ];

  // Animate background hue - slower for better performance
  useEffect(() => {
    const interval = setInterval(() => {
      setBgHue(h => (h + 0.3) % 360);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Intro animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setPhase("story"), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Story progression
  useEffect(() => {
    if (phase !== "story") return;
    if (storyIndex >= STORY_LINES.length) {
      setTimeout(() => {
        setPhase("question");
        setCatEmotion("nervous");
      }, 500);
      return;
    }
    const timer = setTimeout(() => {
      setStoryIndex(i => i + 1);
    }, STORY_LINES[storyIndex].delay);
    return () => clearTimeout(timer);
  }, [phase, storyIndex]);

  // Show button after question appears
  useEffect(() => {
    if (phase === "question") {
      const timer = setTimeout(() => setShowButton(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Move No button on hover
  const handleNoHover = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const maxX = rect.width - 150;
    const maxY = rect.height - 60;
    setNoButtonPos({
      x: Math.random() * maxX - maxX / 2,
      y: Math.random() * maxY - maxY / 2,
    });
    setNoAttempts(n => n + 1);
    setCatEmotion("pleading");
    setTimeout(() => setCatEmotion("nervous"), 500);
  };

  const handleYesClick = () => {
    setPhase("waiting");
    setCatEmotion("overjoyed");
    setHeartBurst(true);
    setTimeout(() => onYes(), 2500);
  };

  const getCatEmoji = () => {
    switch (catEmotion) {
      case "hopeful": return "🥺";
      case "nervous": return "😿";
      case "pleading": return "🙀";
      case "overjoyed": return "😻";
      default: return "😺";
    }
  };

  const getNoButtonText = () => {
    if (noAttempts === 0) return "No...";
    if (noAttempts === 1) return "Please?";
    if (noAttempts === 2) return "Pretty please?";
    if (noAttempts === 3) return "I'll be good!";
    if (noAttempts === 4) return "Don't go! 😿";
    return "💔";
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg,
          hsl(${340 + bgHue * 0.1}, 80%, 85%) 0%,
          hsl(${350 + bgHue * 0.1}, 75%, 75%) 50%,
          hsl(${320 + bgHue * 0.1}, 70%, 70%) 100%)`
      }}
    >
      {/* Floating hearts background - optimized */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-30"
            style={{ left: `${(i * 13) % 100}%` }}
            initial={{ y: "100vh" }}
            animate={{ y: "-100vh" }}
            transition={{
              duration: 10 + (i % 4) * 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "linear"
            }}
          >
            {["💖", "💕", "💗", "✨", "🌸"][i % 5]}
          </motion.div>
        ))}
      </div>

      {/* Heart burst effect - optimized */}
      <AnimatePresence>
        {heartBurst && (
          <>
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i / 24) * Math.PI * 2;
              const distance = 120 + (i % 3) * 60;
              return (
                <motion.div
                  key={`burst-${i}`}
                  className="absolute left-1/2 top-1/2 text-2xl pointer-events-none"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    scale: 1.2,
                    opacity: 0,
                  }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                >
                  {["💖", "💕", "💗", "❤️"][i % 4]}
                </motion.div>
              );
            })}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vmax] h-[150vmax] rounded-full pointer-events-none"
              initial={{ scale: 0, opacity: 0.4 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1 }}
              style={{ background: "radial-gradient(circle, rgba(255,182,193,0.6) 0%, transparent 60%)" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Intro phase */}
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <motion.div
                className="text-8xl mb-6"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, -10, 10, 0],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                👑
              </motion.div>
              <motion.h1
                className="text-4xl md:text-5xl font-black text-white drop-shadow-lg"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Victory!
              </motion.h1>
              <motion.p
                className="text-xl text-white/80 mt-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                The Drama King has been defeated...
              </motion.p>
            </motion.div>
          )}

          {/* Story phase */}
          {phase === "story" && storyIndex < STORY_LINES.length && (
            <motion.div
              key={`story-${storyIndex}`}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <motion.div
                className="text-6xl mb-6"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5 }}
              >
                {STORY_LINES[storyIndex].emoji}
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                {STORY_LINES[storyIndex].text}
              </h2>
            </motion.div>
          )}

          {/* Question phase */}
          {(phase === "question" || phase === "waiting") && (
            <motion.div
              key="question"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              {/* Cat character */}
              <motion.div
                className="text-center mb-8"
                animate={phase === "waiting" ? {
                  y: [0, -30, 0],
                  rotate: [0, -15, 15, 0],
                } : {
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: phase === "waiting" ? 0.5 : 2,
                  repeat: Infinity
                }}
              >
                <div className="relative inline-block">
                  {/* Glow effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full blur-2xl"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ background: "radial-gradient(circle, rgba(255,182,193,0.8) 0%, transparent 70%)" }}
                  />
                  <motion.span
                    className="text-[120px] relative z-10 block"
                    animate={catEmotion === "overjoyed" ? {
                      rotate: [0, -20, 20, 0],
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={{ duration: 0.3, repeat: catEmotion === "overjoyed" ? Infinity : 0 }}
                  >
                    {getCatEmoji()}
                  </motion.span>
                </div>
              </motion.div>

              {/* Question card */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-2 border-pink-200"
              >
                {phase === "waiting" ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                  >
                    <motion.div
                      className="text-6xl mb-4"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      💖
                    </motion.div>
                    <h2 className="text-3xl font-black bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 bg-clip-text text-transparent">
                      YAAAY!!!
                    </h2>
                    <p className="text-lg text-pink-600 mt-2">You made me the happiest cat!</p>
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      className="text-center mb-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <motion.p
                        className="text-lg text-slate-500 mb-2"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6 }}
                      >
                        After everything we've been through...
                      </motion.p>
                      <motion.h2
                        className="text-2xl md:text-3xl font-black bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 bg-clip-text text-transparent"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 }}
                      >
                        Will you be my Valentine?
                      </motion.h2>
                      <motion.div
                        className="flex justify-center gap-2 mt-3"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1, type: "spring" }}
                      >
                        {["💕", "💖", "💕"].map((h, i) => (
                          <motion.span
                            key={i}
                            className="text-2xl"
                            animate={{ y: [0, -5, 0], scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                          >
                            {h}
                          </motion.span>
                        ))}
                      </motion.div>
                    </motion.div>

                    {/* Buttons */}
                    <AnimatePresence>
                      {showButton && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          {/* Yes button */}
                          <motion.button
                            onClick={handleYesClick}
                            className="w-full py-5 px-8 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white font-bold text-xl rounded-2xl shadow-lg relative overflow-hidden group"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-pink-400 via-rose-400 to-red-400"
                              initial={{ x: "-100%" }}
                              whileHover={{ x: "100%" }}
                              transition={{ duration: 0.5 }}
                            />
                            <span className="relative z-10 flex items-center justify-center gap-3">
                              <motion.span
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                              >
                                💖
                              </motion.span>
                              Yes, forever!
                              <motion.span
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}
                              >
                                💖
                              </motion.span>
                            </span>
                          </motion.button>

                          {/* No button - runs away */}
                          <motion.button
                            onMouseEnter={handleNoHover}
                            onTouchStart={handleNoHover}
                            animate={{
                              x: noButtonPos.x,
                              y: noButtonPos.y,
                              opacity: noAttempts > 4 ? 0.3 : 1,
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={cn(
                              "w-full py-3 px-6 border-2 border-slate-300 text-slate-500 font-medium rounded-xl transition-colors",
                              noAttempts > 0 && "border-dashed"
                            )}
                          >
                            {getNoButtonText()}
                          </motion.button>

                          {noAttempts > 2 && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center text-sm text-slate-400 italic"
                            >
                              "The button seems to have a mind of its own..." 😼
                            </motion.p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>

              {/* Stats preview */}
              {phase === "question" && showButton && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 flex justify-center gap-4"
                >
                  <div className="bg-white/60 backdrop-blur rounded-xl px-4 py-2 text-center">
                    <div className="text-2xl">🎮</div>
                    <div className="text-xs text-slate-600 font-medium">Score</div>
                    <div className="text-lg font-bold text-pink-600">{stats.totalScore}</div>
                  </div>
                  <div className="bg-white/60 backdrop-blur rounded-xl px-4 py-2 text-center">
                    <div className="text-2xl">🐱</div>
                    <div className="text-xs text-slate-600 font-medium">Pets</div>
                    <div className="text-lg font-bold text-pink-600">{stats.petCount}</div>
                  </div>
                  <div className="bg-white/60 backdrop-blur rounded-xl px-4 py-2 text-center">
                    <div className="text-2xl">⏱️</div>
                    <div className="text-xs text-slate-600 font-medium">Time</div>
                    <div className="text-lg font-bold text-pink-600">{Math.round(stats.yesTime / 1000 || 0)}s</div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z"
            fill="rgba(255,255,255,0.3)"
          />
        </svg>
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const gameStartRef = useRef(0);

  // Toggle sound handler
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newState = !prev;
      soundManager.setEnabled(newState);
      if (newState) {
        soundManager.click();
      }
      return newState;
    });
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    if (unlockedAchievements.has(id)) return;
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      soundManager.achievement();
      setUnlockedAchievements(prev => new Set([...prev, id]));
      setShowAchievement({ ...achievement, unlocked: true });
    }
  }, [unlockedAchievements]);

  const startGame = useCallback(() => {
    soundManager.init();
    soundManager.buttonPress();
    soundManager.startTitleMusic();
    gameStartRef.current = now();
    setScene("intro_cutscene");
    setDialogIndex(0);
  }, []);

  const nextScene = useCallback((next: GameScene) => {
    soundManager.sceneTransition();
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
    soundManager.dialogAdvance();
    if (dialogIndex < INTRO_DIALOG.length - 1) {
      setDialogIndex(i => i + 1);
    } else {
      nextScene("chapter1_chase");
    }
  }, [dialogIndex, nextScene]);

  const handleYes = useCallback(() => {
    soundManager.victory();
    soundManager.stopMusic();
    const elapsed = now() - gameStartRef.current;
    setStats(s => ({ ...s, yesTime: elapsed }));

    if (elapsed < 5000) unlockAchievement("speedrun");
    if (stats.noCount >= 3) unlockAchievement("persistent");

    // Perfect ending: never said no and petted cat lots during the adventure
    if (stats.noCount === 0 && stats.petCount >= 5) {
      nextScene("ending_perfect");
      unlockAchievement("true_love");
    } else {
      // Good ending: completed all the games and said yes!
      nextScene("ending_good");
    }
  }, [stats.noCount, stats.petCount, unlockAchievement, nextScene]);

  const petCat = useCallback(() => {
    soundManager.purr();
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

  // Sound toggle button component - appears on every scene
  const SoundToggleButton = (
    <motion.button
      onClick={toggleSound}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
    >
      <span className="text-xl">{soundEnabled ? "🔊" : "🔇"}</span>
    </motion.button>
  );

  if (scene === "title") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-200 via-rose-300 to-pink-400 flex flex-col items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}
        {/* Animated background hearts - optimized with CSS */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl opacity-15"
              style={{
                left: `${(i * 10) % 100}%`,
                animation: `floatUp ${15 + (i % 3) * 3}s linear infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            >
              {["💖", "💕", "💗"][i % 3]}
            </div>
          ))}
        </div>

        {/* Radial glow behind cat */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,182,193,0.6) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Cat with crown */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 150, delay: 0.2 }}
            className="relative mb-6"
          >
            {/* Crown */}
            <motion.div
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl z-10"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
            >
              <motion.span
                animate={{ y: [0, -5, 0], rotate: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                👑
              </motion.span>
            </motion.div>
            {/* Cat */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-[100px] md:text-[120px] block">😻</span>
            </motion.div>
            {/* Heart decorations */}
            <motion.div
              className="absolute -left-6 top-1/2 text-2xl"
              animate={{ scale: [1, 1.3, 1], rotate: [-10, 10, -10] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              💕
            </motion.div>
            <motion.div
              className="absolute -right-6 top-1/2 text-2xl"
              animate={{ scale: [1, 1.3, 1], rotate: [10, -10, 10] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            >
              💗
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="text-center mb-2"
          >
            <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
              Valentine's Quest
            </h1>
          </motion.div>

          {/* Subtitle with hearts */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-2 mb-8"
          >
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>💖</motion.span>
            <p className="text-lg md:text-xl text-pink-700 font-medium">
              A dramatic cat's journey to find love
            </p>
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}>💖</motion.span>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            <motion.button
              onClick={startGame}
              className="w-full py-4 px-8 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white font-bold text-xl rounded-2xl shadow-lg relative overflow-hidden"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Heart className="w-6 h-6" /> Start Game
              </span>
            </motion.button>
            <motion.button
              onClick={() => {
                soundManager.init();
                soundManager.click();
                soundManager.whoosh();
                gameStartRef.current = now();
                setScene("chapter1_chase");
              }}
              className="w-full py-3 px-6 border-2 border-pink-400 text-pink-600 font-medium rounded-xl hover:bg-pink-50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Skip Intro →
            </motion.button>
          </motion.div>

          {/* Features preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="flex gap-4 mt-8"
          >
            {[
              { emoji: "🎮", label: "Mini-games" },
              { emoji: "👑", label: "Boss Battle" },
              { emoji: "💕", label: "Romance" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.4 + i * 0.1 }}
              >
                <span className="text-2xl mb-1">{item.emoji}</span>
                <span className="text-xs text-pink-600 font-medium">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-6 text-pink-500 text-sm font-medium"
        >
          Made with 💖 and dramatic cat energy
        </motion.div>
      </div>
    );
  }

  if (scene === "intro_cutscene") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-pink-900 flex items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}
        {/* Starfield background - optimized with CSS */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${(i * 7) % 100}%`,
                top: `${(i * 13 + 5) % 100}%`,
                opacity: 0.4 + (i % 3) * 0.2,
                animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i % 4) * 0.5}s`,
              }}
            />
          ))}
        </div>

        {/* Floating sparkles - reduced */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute text-lg opacity-30"
              style={{
                left: `${(i * 16) % 100}%`,
                animation: `floatUp ${18 + (i % 3) * 4}s linear infinite`,
                animationDelay: `${i * 1.5}s`,
              }}
            >
              {["✨", "⭐", "💫"][i % 3]}
            </div>
          ))}
        </div>

        {/* Progress indicator */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
          {INTRO_DIALOG.map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors duration-300",
                i === dialogIndex ? "bg-pink-400" : i < dialogIndex ? "bg-pink-600" : "bg-white/30"
              )}
              animate={i === dialogIndex ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ))}
        </div>

        {/* Dialog content */}
        <AnimatePresence mode="wait">
          <DialogBox key={dialogIndex} line={INTRO_DIALOG[dialogIndex]} onNext={advanceDialog} />
        </AnimatePresence>

        {/* Skip button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={() => {
            soundManager.whoosh();
            nextScene("chapter1_chase");
          }}
          className="absolute bottom-6 right-6 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          Skip →
        </motion.button>
      </div>
    );
  }

  if (showChapterTitle && pendingScene && pendingScene in CHAPTER_TITLES) {
    return <ChapterTitle chapter={pendingScene as keyof typeof CHAPTER_TITLES} onComplete={() => setShowChapterTitle(false)} />;
  }

  if (scene === "chapter1_chase") {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-pink-100 via-rose-200 to-pink-300 overflow-hidden flex items-center justify-center p-4">
        {SoundToggleButton}
        {/* Animated background - optimized with CSS */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-xl opacity-20"
              style={{
                left: `${(i * 12) % 100}%`,
                animation: `floatUp ${12 + (i % 3) * 3}s linear infinite`,
                animationDelay: `${i * 0.7}s`,
              }}
            >
              {["💕", "🌸", "✨"][i % 3]}
            </div>
          ))}
        </div>

        {/* Main card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-pink-200">
            <div className="text-center">
              {/* Cat with interaction */}
              <motion.div
                className="mb-6 relative inline-block cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={petCat}
              >
                {/* Glow effect based on mood */}
                <motion.div
                  className="absolute inset-0 rounded-full blur-2xl -z-10"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: catMood === "love" ? [0.6, 0.8, 0.6] : [0.3, 0.5, 0.3],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    background: catMood === "angry" || catMood === "sad"
                      ? "radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)"
                      : "radial-gradient(circle, rgba(255,182,193,0.6) 0%, transparent 70%)"
                  }}
                />
                <motion.div
                  animate={catMood === "love" ? { y: [0, -5, 0], rotate: [-3, 3, -3] } : { y: [0, -3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="text-[80px] md:text-[100px] block">{CAT_EMOTIONS[catMood]}</span>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  className="text-xs text-pink-400 mt-1"
                >
                  tap to pet!
                </motion.p>
              </motion.div>

              {/* Title */}
              <motion.h1
                className="text-3xl md:text-4xl font-black bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 bg-clip-text text-transparent mb-4"
                animate={stats.noCount >= 2 ? { x: [0, -2, 2, 0] } : {}}
                transition={{ duration: 0.5, repeat: stats.noCount >= 2 ? Infinity : 0 }}
              >
                Will you be my Valentine?
              </motion.h1>

              {/* Cat message */}
              <div className="h-[32px] mb-6">
                <AnimatePresence mode="wait">
                  {catMessage && (
                    <motion.p
                      key={catMessage}
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-lg text-slate-600"
                    >
                      {catMessage}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <motion.button
                  onClick={handleYes}
                  className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white font-bold text-lg rounded-2xl shadow-lg relative overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Heart className="w-5 h-5" /> Yes! 💖
                  </span>
                </motion.button>

                <motion.div
                  animate={
                    stats.noCount === 0 ? {} :
                    stats.noCount === 1 ? { x: [0, -15, 15, 0] } :
                    stats.noCount === 2 ? { scale: [1, 0.85, 1], rotate: [0, 8, -8, 0] } :
                    { opacity: 0.3, scale: 0.95 }
                  }
                  transition={{ duration: 0.4 }}
                >
                  <button
                    className={cn(
                      "w-full py-3 px-6 border-2 font-medium rounded-xl transition-all",
                      stats.noCount >= 3
                        ? "border-slate-300 text-slate-400 cursor-not-allowed"
                        : stats.noCount >= 2
                        ? "border-red-300 text-red-500 hover:bg-red-50"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    )}
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
                  </button>
                </motion.div>
              </div>

              {/* Progress indicator */}
              {stats.noCount > 0 && stats.noCount < 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-center gap-2"
                >
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className={cn(
                          "w-2 h-2 rounded-full",
                          i <= stats.noCount ? "bg-red-400" : "bg-slate-200"
                        )}
                        animate={i <= stats.noCount ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.5 }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    {stats.noCount === 1 && "The cat's getting upset..."}
                    {stats.noCount === 2 && "One more and there'll be consequences!"}
                  </p>
                </motion.div>
              )}

              {/* Pet counter */}
              {stats.petCount > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-sm text-pink-500"
                >
                  💕 {stats.petCount} pet{stats.petCount !== 1 && "s"} given
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
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
    return <FinalProposalScene onYes={handleYes} stats={stats} />;
  }

  if (scene === "ending_good") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-300 via-rose-400 to-pink-500 flex items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}
        {/* Floating hearts */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl"
              style={{ left: `${(i * 11) % 100}%` }}
              initial={{ y: "100vh", opacity: 0.6 }}
              animate={{ y: "-100vh" }}
              transition={{ duration: 8 + (i % 4) * 2, repeat: Infinity, delay: i * 0.4, ease: "linear" }}
            >
              {["💖", "💕", "💗", "✨", "🎉"][i % 5]}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="max-w-md w-full relative z-10"
        >
          {/* Main card */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-2 border-pink-200 text-center">
            {/* Cat celebration */}
            <motion.div
              className="relative inline-block mb-4"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.div
                className="absolute inset-0 blur-2xl rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,182,193,0.8) 0%, transparent 70%)" }}
              />
              <motion.span
                className="text-[100px] relative z-10 block"
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                😻
              </motion.span>
            </motion.div>

            <motion.h1
              className="text-4xl font-black bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 bg-clip-text text-transparent mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              YAYYY! 💖
            </motion.h1>

            <motion.p
              className="text-xl text-slate-600 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              You are now officially my Valentine!
            </motion.p>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 gap-3 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="bg-pink-50 rounded-xl p-3">
                <div className="text-2xl">🎮</div>
                <div className="text-xs text-slate-500">Score</div>
                <div className="text-xl font-bold text-pink-600">{stats.totalScore}</div>
              </div>
              <div className="bg-rose-50 rounded-xl p-3">
                <div className="text-2xl">🐱</div>
                <div className="text-xs text-slate-500">Cat Pets</div>
                <div className="text-xl font-bold text-rose-600">{stats.petCount}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="text-2xl">⏱️</div>
                <div className="text-xs text-slate-500">Time</div>
                <div className="text-xl font-bold text-red-500">{Math.round(stats.yesTime / 1000)}s</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3">
                <div className="text-2xl">💬</div>
                <div className="text-xs text-slate-500">Said No</div>
                <div className="text-xl font-bold text-purple-600">{stats.noCount}x</div>
              </div>
            </motion.div>

            {/* Message */}
            <motion.p
              className="text-sm text-pink-500 italic mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              "Thank you for going on this adventure with me! 💕" — The Cat
            </motion.p>

            {/* Buttons */}
            <motion.div
              className="flex gap-3 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <Button variant="outline" onClick={() => window.location.reload()}>
                Play Again 🔄
              </Button>
              <Button variant="pink" onClick={() => setScene("title")}>
                Title Screen 🏠
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (scene === "ending_perfect") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-300 via-yellow-400 to-orange-400 flex items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}
        {/* Floating stars and crowns */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 25 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl"
              style={{ left: `${(i * 9) % 100}%` }}
              initial={{ y: "100vh", opacity: 0.7 }}
              animate={{ y: "-100vh", rotate: [0, 360] }}
              transition={{ duration: 7 + (i % 4) * 2, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
            >
              {["⭐", "✨", "👑", "🏆", "💫", "🌟"][i % 6]}
            </motion.div>
          ))}
        </div>

        {/* Golden sparkles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={`spark-${i}`}
              className="absolute w-2 h-2 bg-yellow-300 rounded-full"
              style={{ left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 60}%` }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="max-w-md w-full relative z-10"
        >
          {/* Main card */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-4 border-amber-400 text-center relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/50 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />

            {/* Crown and cat */}
            <motion.div
              className="relative inline-block mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.div
                className="absolute -top-8 left-1/2 -translate-x-1/2 text-5xl z-20"
                animate={{ rotate: [-5, 5, -5], y: [0, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                👑
              </motion.div>
              <motion.div
                className="absolute inset-0 blur-3xl rounded-full"
                style={{ background: "radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)" }}
              />
              <motion.span
                className="text-[100px] relative z-10 block"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                😻
              </motion.span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative z-10"
            >
              <h1 className="text-4xl font-black bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
                PERFECT ENDING! 🏆
              </h1>

              <motion.div
                className="flex justify-center gap-1 mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                {["⭐", "⭐", "⭐", "⭐", "⭐"].map((s, i) => (
                  <motion.span
                    key={i}
                    className="text-2xl"
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity, repeatDelay: 2 }}
                  >
                    {s}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>

            <motion.p
              className="text-xl text-slate-600 mb-2 relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              You showed TRUE LOVE! 💕
            </motion.p>

            <motion.p
              className="text-lg text-amber-700 mb-6 relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Never said no, always gave pets... <br />
              You're the ULTIMATE Valentine! 👑
            </motion.p>

            {/* Stats in gold theme */}
            <motion.div
              className="grid grid-cols-3 gap-2 mb-6 relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-xl">🎮</div>
                <div className="text-lg font-bold text-amber-600">{stats.totalScore}</div>
                <div className="text-xs text-amber-500">Score</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-xl">🐱</div>
                <div className="text-lg font-bold text-amber-600">{stats.petCount}</div>
                <div className="text-xs text-amber-500">Pets</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-xl">⏱️</div>
                <div className="text-lg font-bold text-amber-600">{Math.round(stats.yesTime / 1000)}s</div>
                <div className="text-xs text-amber-500">Time</div>
              </div>
            </motion.div>

            {/* Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="relative z-10"
            >
              <Button
                variant="gold"
                size="lg"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                <Trophy className="w-5 h-5" /> Play Again
              </Button>
            </motion.div>
          </div>
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
