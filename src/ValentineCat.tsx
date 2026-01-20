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

  // === RHYTHM GAME SOUNDS ===
  rhythmHit() {
    // Punchy hit with harmonics
    this.playTone(880, 0.08, "sine", 0.3);
    this.playTone(1100, 0.06, "sine", 0.2, 0.015);
    this.playTone(1760, 0.04, "sine", 0.1, 0.02);
    this.playNoise(0.02, 0.1);
  }

  rhythmPerfect() {
    // Sparkly perfect hit with arpeggiated chord
    this.playTone(1047, 0.12, "sine", 0.35); // C6
    this.playTone(1319, 0.1, "sine", 0.28, 0.025); // E6
    this.playTone(1568, 0.12, "sine", 0.32, 0.05); // G6
    this.playTone(2093, 0.08, "sine", 0.2, 0.08); // C7
    // Shimmer effect
    this.playTone(3000, 0.03, "sine", 0.08, 0.1);
    this.playTone(4000, 0.02, "sine", 0.05, 0.12);
  }

  rhythmMiss() {
    // Dissonant buzz with descending tone
    this.playTone(200, 0.18, "sawtooth", 0.2);
    this.playTone(150, 0.15, "sawtooth", 0.15, 0.05);
    this.playNoise(0.12, 0.15);
  }

  rhythmBeat() {
    // Deep bass pulse with subtle kick
    this.playTone(60, 0.12, "sine", 0.2);
    this.playTone(120, 0.08, "sine", 0.1, 0.02);
  }

  rhythmCombo() {
    // Triumphant ascending fanfare
    this.playTone(523, 0.08, "sine", 0.25);
    this.playTone(659, 0.08, "sine", 0.22, 0.04);
    this.playTone(784, 0.08, "sine", 0.25, 0.08);
    this.playTone(1047, 0.12, "sine", 0.3, 0.12);
    // Shimmer
    this.playTone(2000, 0.04, "sine", 0.1, 0.15);
  }

  rhythmGolden() {
    // Special golden note sparkle
    this.playTone(1200, 0.1, "sine", 0.3);
    this.playTone(1500, 0.08, "sine", 0.25, 0.02);
    this.playTone(1800, 0.1, "sine", 0.28, 0.04);
    this.playTone(2400, 0.06, "sine", 0.15, 0.07);
    this.playTone(3200, 0.04, "sine", 0.1, 0.1);
  }

  startRhythmMusic() {
    this.stopMusic();
    if (!this.audioContext || !this.musicGain || !this.musicEnabled) return;

    const playNote = (freq: number, duration: number, delay: number, type: OscillatorType = "sine") => {
      if (!this.audioContext || !this.musicGain) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(this.audioContext.currentTime + delay);
      osc.stop(this.audioContext.currentTime + delay + duration + 0.1);
    };

    // Pumping synth-pop beat
    const playBeat = () => {
      // Bass line
      [130, 130, 165, 147].forEach((f, i) => {
        playNote(f, 0.4, i * 0.5, "sine");
      });
      // Kick drums
      for (let i = 0; i < 4; i++) {
        playNote(60, 0.1, i * 0.5, "sine");
        if (i % 2 === 1) playNote(200, 0.05, i * 0.5 + 0.25, "square");
      }
      // Melody
      [392, 440, 523, 494, 440, 392, 349, 392].forEach((f, i) => {
        if (f > 0) playNote(f, 0.2, i * 0.25, "sine");
      });
    };

    playBeat();
    this.musicInterval = window.setInterval(playBeat, 2000);
  }

  // === PUZZLE GAME SOUNDS ===
  tileSlide() {
    // Smooth slide with satisfying click
    this.playTone(350, 0.04, "sine", 0.2);
    this.playTone(450, 0.05, "sine", 0.18, 0.02);
    this.playTone(550, 0.03, "sine", 0.12, 0.04);
  }

  tileClick() {
    this.playTone(600, 0.04, "sine", 0.18);
    this.playTone(750, 0.02, "sine", 0.1, 0.02);
  }

  tileCorrect() {
    // Satisfying ding when tile is in correct position
    this.playTone(880, 0.12, "sine", 0.25);
    this.playTone(1100, 0.08, "sine", 0.18, 0.03);
  }

  puzzleSolved() {
    // Epic victory fanfare with shimmer
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.25, "sine", 0.25, i * 0.08);
    });
    // Add shimmer overtones
    [2500, 3000, 3500, 4000].forEach((f, i) => {
      this.playTone(f, 0.15, "sine", 0.08, 0.3 + i * 0.05);
    });
  }

  invalidMove() {
    // Softer rejection with wobble
    this.playTone(200, 0.08, "square", 0.12);
    this.playTone(180, 0.08, "square", 0.1, 0.04);
    this.playTone(160, 0.06, "square", 0.08, 0.08);
  }

  puzzleTimeLow() {
    // Tension tick
    this.playTone(800, 0.05, "sine", 0.2);
    this.playTone(600, 0.05, "sine", 0.15, 0.1);
  }

  startPuzzleMusic() {
    this.stopMusic();
    if (!this.audioContext || !this.musicGain || !this.musicEnabled) return;

    const playNote = (freq: number, duration: number, delay: number) => {
      if (!this.audioContext || !this.musicGain) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + delay + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(this.audioContext.currentTime + delay);
      osc.stop(this.audioContext.currentTime + delay + duration + 0.1);
    };

    // Gentle ambient puzzle music
    const playAmbient = () => {
      // Soft pad chords
      [262, 330, 392].forEach(f => playNote(f, 2.5, 0));
      [294, 370, 440].forEach(f => playNote(f, 2.5, 2.5));
      // Gentle melody
      [523, 494, 440, 392, 440, 494, 523, 587].forEach((f, i) => {
        playNote(f, 0.5, i * 0.6);
      });
    };

    playAmbient();
    this.musicInterval = window.setInterval(playAmbient, 5000);
  }

  // === ARROW GALLERY SOUNDS ===
  bowDraw() {
    // Tension string pull
    this.playTone(150, 0.15, "sine", 0.12);
    this.playTone(180, 0.2, "sine", 0.1, 0.05);
    this.playTone(220, 0.15, "sine", 0.08, 0.12);
  }

  arrowFire() {
    // Whooshing arrow release
    this.playNoise(0.12, 0.25);
    this.playTone(350, 0.08, "sine", 0.18);
    this.playTone(500, 0.06, "sine", 0.12, 0.02);
    this.playTone(650, 0.04, "sine", 0.08, 0.04);
  }

  arrowHit() {
    // Satisfying thunk with sparkle
    this.playTone(700, 0.1, "sine", 0.28);
    this.playTone(900, 0.08, "sine", 0.22, 0.02);
    this.playTone(1100, 0.06, "sine", 0.15, 0.04);
    this.playNoise(0.06, 0.2);
  }

  arrowMiss() {
    // Soft miss whoosh
    this.playNoise(0.1, 0.12);
    this.playTone(250, 0.12, "sine", 0.1);
    this.playTone(200, 0.1, "sine", 0.08, 0.05);
  }

  bullseye() {
    // Epic bullseye with fanfare
    this.playTone(880, 0.15, "sine", 0.35);
    this.playTone(1100, 0.12, "sine", 0.3, 0.03);
    this.playTone(1320, 0.15, "sine", 0.32, 0.06);
    this.playTone(1760, 0.1, "sine", 0.25, 0.1);
    // Sparkle
    this.playTone(2500, 0.05, "sine", 0.12, 0.12);
    this.playTone(3000, 0.04, "sine", 0.1, 0.15);
    this.playTone(3500, 0.03, "sine", 0.08, 0.18);
  }

  targetSpawn() {
    // Pop-in sound
    this.playTone(400, 0.06, "sine", 0.15);
    this.playTone(600, 0.05, "sine", 0.12, 0.02);
    this.playTone(800, 0.04, "sine", 0.08, 0.04);
  }

  targetHitGolden() {
    // Special golden target hit
    this.playTone(1000, 0.12, "sine", 0.32);
    this.playTone(1250, 0.1, "sine", 0.28, 0.02);
    this.playTone(1500, 0.12, "sine", 0.3, 0.04);
    this.playTone(2000, 0.08, "sine", 0.2, 0.08);
    // Golden shimmer
    [2500, 3000, 3500].forEach((f, i) => {
      this.playTone(f, 0.06, "sine", 0.1, 0.1 + i * 0.03);
    });
  }

  startGalleryMusic() {
    this.stopMusic();
    if (!this.audioContext || !this.musicGain || !this.musicEnabled) return;

    const playNote = (freq: number, duration: number, delay: number, type: OscillatorType = "sine") => {
      if (!this.audioContext || !this.musicGain) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(this.audioContext.currentTime + delay);
      osc.stop(this.audioContext.currentTime + delay + duration + 0.1);
    };

    // Carnival fair theme
    const playFair = () => {
      // Organ-style bass
      [196, 220, 247, 262].forEach((f, i) => {
        playNote(f, 0.4, i * 0.5, "sine");
        playNote(f * 2, 0.3, i * 0.5, "sine");
      });
      // Festive melody
      [523, 587, 659, 698, 659, 587, 523, 494].forEach((f, i) => {
        playNote(f, 0.22, i * 0.25, "sine");
      });
      // Cymbals
      this.playNoise(0.05, 0.08);
      setTimeout(() => this.playNoise(0.05, 0.08), 500);
    };

    playFair();
    this.musicInterval = window.setInterval(playFair, 2000);
  }

  // === UI SOUNDS ===
  uiWhoosh() {
    this.playNoise(0.08, 0.15);
    this.playTone(300, 0.1, "sine", 0.1);
    this.playTone(500, 0.08, "sine", 0.08, 0.03);
  }

  uiPop() {
    this.playTone(800, 0.05, "sine", 0.2);
    this.playTone(1200, 0.03, "sine", 0.12, 0.02);
  }

  scoreUp() {
    this.playTone(600, 0.06, "sine", 0.2);
    this.playTone(800, 0.05, "sine", 0.15, 0.03);
    this.playTone(1000, 0.06, "sine", 0.18, 0.06);
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
  | "chapter3_rhythm"
  | "chapter3_puzzle"
  | "chapter3_gallery"
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
  chapter3_rhythm: { num: 3, title: "Rhythm Heart Beat", subtitle: "Feel the love rhythm!" },
  chapter3_puzzle: { num: 3, title: "Love Letter Puzzle", subtitle: "Piece together the message!" },
  chapter3_gallery: { num: 3, title: "Cupid's Arrow Gallery", subtitle: "Shoot down the hearts!" },
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
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Super premium animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 25%, #2d1b4e 50%, #1a1a3e 75%, #0f0f23 100%)",
          backgroundSize: "400% 400%"
        }}
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* Animated nebula orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)", left: "-15%", top: "-20%" }}
          animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.4, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-25"
          style={{ background: "radial-gradient(circle, rgba(147,51,234,0.6) 0%, transparent 70%)", right: "-10%", bottom: "-15%" }}
          animate={{ x: [0, -80, 0], y: [0, -60, 0], scale: [1.2, 0.9, 1.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* Particle burst effect */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2"
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{
            x: Math.cos((i / 20) * Math.PI * 2) * (150 + Math.random() * 100),
            y: Math.sin((i / 20) * Math.PI * 2) * (150 + Math.random() * 100),
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 2, delay: 0.3, ease: "easeOut" }}
        >
          <span className="text-2xl">{["✨", "💫", "⭐", "🌟"][i % 4]}</span>
        </motion.div>
      ))}

      {/* Floating sparkles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            boxShadow: "0 0 6px 2px rgba(255,255,255,0.6)"
          }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}

      <div className="relative z-10 text-center text-white">
        {/* Chapter number with premium effects */}
        <motion.div
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 150, delay: 0.2 }}
          className="relative mb-6"
        >
          {/* Glow behind number */}
          <motion.div
            className="absolute inset-0 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.span
            className="text-7xl md:text-8xl font-black relative"
            style={{
              backgroundImage: "linear-gradient(135deg, #ec4899 0%, #f43f5e 30%, #a855f7 60%, #ec4899 100%)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 0 30px rgba(236,72,153,0.5))"
            }}
            animate={{ backgroundPosition: ["0% center", "200% center"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            {typeof data.num === "number" ? `Chapter ${data.num}` : data.num}
          </motion.span>
        </motion.div>

        {/* Title with premium styling */}
        <motion.h1
          initial={{ y: 60, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
          className="text-4xl md:text-6xl font-black mb-4 relative"
          style={{ textShadow: "0 0 40px rgba(255,255,255,0.3)" }}
        >
          {data.title}
        </motion.h1>

        {/* Subtitle with glassmorphism */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="inline-block bg-white/10 backdrop-blur-md rounded-full px-6 py-2 border border-white/20"
        >
          <p className="text-xl md:text-2xl text-white/80 font-medium">
            {data.subtitle}
          </p>
        </motion.div>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="w-48 h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent mx-auto mt-8 rounded-full"
        />
      </div>
    </motion.div>
  );
});

const AchievementPopup = memo(function AchievementPopup({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ x: 350, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 350, opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="fixed top-4 right-4 z-[200]"
    >
      {/* Premium glow effect */}
      <motion.div
        className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 opacity-60 blur-xl"
        animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <div className="relative bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 rounded-2xl p-1 shadow-2xl min-w-[300px] overflow-hidden">
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
          animate={{ x: ["-200%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        />
        <div className="relative bg-gradient-to-br from-amber-500/90 to-yellow-600/90 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center gap-4">
            <motion.div
              className="text-5xl"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ filter: "drop-shadow(0 0 10px rgba(255,215,0,0.8))" }}
            >
              {achievement.emoji}
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                  <Trophy className="w-5 h-5 text-white" />
                </motion.div>
                <span className="text-xs font-black uppercase tracking-wider text-white/90">Achievement Unlocked!</span>
              </div>
              <div className="font-black text-xl text-white drop-shadow-md">{achievement.name}</div>
              <div className="text-sm text-amber-100 font-medium">{achievement.desc}</div>
            </div>
          </div>
        </div>
      </div>
      {/* Celebration particles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute text-xl pointer-events-none"
          style={{ left: "50%", top: "50%" }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{
            x: Math.cos((i / 8) * Math.PI * 2) * 80,
            y: Math.sin((i / 8) * Math.PI * 2) * 80,
            opacity: [1, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{ duration: 1.5, delay: 0.2 }}
        >
          {["⭐", "✨", "🌟", "💫"][i % 4]}
        </motion.span>
      ))}
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

  // Tutorial screen with premium styling
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Multi-layer animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Falling letters with rotation */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl font-black"
              style={{ left: `${(i * 8) % 100}%` }}
              initial={{ y: "-10%", rotate: 0, opacity: 0 }}
              animate={{
                y: "110%",
                rotate: 360,
                opacity: [0, 0.2, 0.2, 0],
              }}
              transition={{
                duration: 10 + (i % 4) * 2,
                repeat: Infinity,
                delay: i * 0.7,
                ease: "linear",
              }}
            >
              {["N", "O", "💕", "🧺", "⭐", "✨"][i % 6]}
            </motion.div>
          ))}

          {/* Animated gradient orbs */}
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-3xl"
            style={{ top: "-20%", left: "-10%" }}
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-r from-indigo-400/20 to-violet-400/20 blur-3xl"
            style={{ bottom: "-20%", right: "-10%" }}
            animate={{
              scale: [1.2, 1, 1.2],
              x: [0, -30, 0],
              y: [0, -50, 0],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Sparkle particles */}
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute w-1.5 h-1.5 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        {/* Premium card with glow */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative z-10 max-w-sm w-full"
        >
          {/* Card glow effect */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-indigo-400/30 via-purple-400/30 to-fuchsia-400/30 blur-2xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 text-center shadow-[0_25px_80px_-15px_rgba(139,92,246,0.5)] border border-white/40 relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />

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
          </div>
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

  // Main game screen with super premium visuals - optimized for performance
  return (
    <motion.div
      className="fixed inset-0 overflow-hidden select-none touch-none"
      animate={screenShake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.3 }}
      onMouseMove={(e) => handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect()); }}
    >
      {/* Super premium animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 20%, #a855f7 40%, #ec4899 60%, #db2777 80%, #9333ea 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      />

      {/* Mesh gradient overlay with animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.8) 0%, transparent 70%)",
            top: "-20%",
            left: "-15%",
            animation: "float 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(236,72,153,0.8) 0%, transparent 70%)",
            bottom: "-20%",
            right: "-15%",
            animation: "float 18s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Premium grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.07]">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* Subtle floating sparkles - CSS only for performance */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              opacity: 0.4,
              animation: `starTwinkle ${2 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Premium glassmorphism header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 sm:gap-3 z-10 px-3">
        <motion.div
          className="bg-white/20 backdrop-blur-xl rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/30 flex items-center gap-2"
          animate={noLetters > 0 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          <span className="text-xl sm:text-2xl">📝</span>
          <span className="text-lg sm:text-xl font-black text-white drop-shadow-lg">{noLetters}/5</span>
        </motion.div>
        <motion.div
          className={cn(
            "backdrop-blur-xl rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border flex items-center gap-2 relative overflow-hidden",
            timeLeft <= 5
              ? "bg-red-500/30 border-red-400/50"
              : "bg-white/20 border-white/30"
          )}
          animate={timeLeft <= 5 ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.4, repeat: timeLeft <= 5 ? Infinity : 0 }}
        >
          {/* Urgent pulse effect */}
          {timeLeft <= 5 && (
            <div
              className="absolute inset-0 bg-red-500/20"
              style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}
            />
          )}
          <span className="text-xl sm:text-2xl relative">⏱️</span>
          <span className={cn(
            "text-lg sm:text-xl font-black relative drop-shadow-lg",
            timeLeft <= 5 ? "text-red-100" : "text-white"
          )}>
            {timeLeft}s
          </span>
        </motion.div>
        <AnimatePresence>
          {combo >= 2 && (
            <motion.div
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 shadow-[0_8px_32px_rgba(251,146,60,0.4)] border border-amber-400/50 relative overflow-hidden"
              style={{ animation: combo >= 5 ? "comboFire 0.5s ease-in-out infinite" : undefined }}
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
              />
              <span className="text-lg sm:text-xl font-black text-white relative drop-shadow-lg">x{combo} 🔥</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cat with emotions - premium styling */}
      <motion.div
        className="absolute top-24 left-1/2 -translate-x-1/2 text-center z-20"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {/* Cat glow effect */}
        <div className="relative">
          <div
            className="absolute inset-0 blur-2xl rounded-full"
            style={{
              background: catEmotion === "worried"
                ? "radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)"
                : catEmotion === "angry"
                  ? "radial-gradient(circle, rgba(251,146,60,0.4) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(74,222,128,0.4) 0%, transparent 70%)",
              width: "120px",
              height: "120px",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <motion.div
            className="text-6xl sm:text-7xl mb-2 relative"
            style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))" }}
            animate={catEmotion === "worried" ? { rotate: [0, -5, 5, 0] } : {}}
            transition={{ duration: 0.5, repeat: catEmotion === "worried" ? Infinity : 0 }}
          >
            {catEmotion === "happy" ? "😼" : catEmotion === "angry" ? "😾" : "🙀"}
          </motion.div>
        </div>
        <AnimatePresence>
          {catMessage && (
            <motion.div
              initial={{ scale: 0, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, y: -10, opacity: 0 }}
              className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white px-5 py-2 rounded-full font-bold shadow-[0_8px_32px_rgba(236,72,153,0.4)] text-sm border border-pink-400/50 relative overflow-hidden"
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                style={{ animation: "shimmer 1s ease-in-out" }}
              />
              <span className="relative">{catMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Premium skip button */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(noLetters);
          }
        }}
        className="absolute top-4 right-4 bg-white/15 backdrop-blur-xl rounded-full px-4 py-2 text-white/90 text-sm z-10 hover:bg-white/25 transition-all duration-300 border border-white/20 shadow-lg"
      >
        Skip →
      </button>

      {/* Premium perfect catch indicator */}
      <AnimatePresence>
        {perfectCatch && (
          <motion.div
            initial={{ scale: 0, opacity: 1, y: 0 }}
            animate={{ scale: 1.5, opacity: 0, y: -30 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-36 z-40 pointer-events-none"
          >
            <span
              className="text-2xl sm:text-3xl font-black"
              style={{
                background: "linear-gradient(135deg, #fde047 0%, #fbbf24 50%, #f59e0b 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 20px rgba(251,191,36,0.8))",
              }}
            >
              PERFECT!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium catch particles burst */}
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
            <span className="text-2xl" style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))" }}>
              {particle.emoji}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Premium catch effect with combo display */}
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
              <div
                className="text-4xl sm:text-5xl font-black"
                style={{
                  background: lastCatch.type === "star"
                    ? "linear-gradient(135deg, #fde047 0%, #fbbf24 100%)"
                    : "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  filter: `drop-shadow(0 0 15px ${lastCatch.type === "star" ? "rgba(251,191,36,0.8)" : "rgba(74,222,128,0.8)"})`,
                }}
              >
                {lastCatch.type === "star" ? "+2!" : "+1!"}
              </div>
              {lastCatch.combo >= 3 && (
                <div
                  className="text-xl font-bold mt-1"
                  style={{
                    background: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    filter: "drop-shadow(0 0 10px rgba(251,146,60,0.6))",
                  }}
                >
                  x{lastCatch.combo}!
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium falling items with enhanced visuals */}
      {items.map(item => (
        <div
          key={item.id}
          className="absolute pointer-events-none gpu-accelerate"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
          }}
        >
          {item.type === "heart" ? (
            <span
              className="text-5xl sm:text-6xl"
              style={{ filter: "drop-shadow(0 4px 12px rgba(236,72,153,0.5))" }}
            >
              💕
            </span>
          ) : item.type === "star" ? (
            <span
              className="text-5xl sm:text-6xl"
              style={{
                filter: "drop-shadow(0 0 20px rgba(251,191,36,0.8))",
                animation: "goldShimmer 1s ease-in-out infinite",
              }}
            >
              ⭐
            </span>
          ) : (
            <span
              className="text-5xl sm:text-6xl font-black"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #fecaca 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 15px rgba(239,68,68,0.8)) drop-shadow(2px 2px 0 #b91c1c)",
              }}
            >
              {item.type}
            </span>
          )}
        </div>
      ))}

      {/* Premium basket with dynamic glow effect */}
      <motion.div
        className="absolute bottom-24"
        style={{
          left: `${basketX}%`,
          transform: "translateX(-50%)",
        }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="relative">
          {/* Multi-layer glow effect */}
          <div
            className={cn(
              "absolute blur-2xl rounded-full transition-all duration-300",
              basketGlow ? "bg-green-400/70" : "bg-amber-400/40"
            )}
            style={{
              width: "100px",
              height: "100px",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              animation: basketGlow ? "perfectBurst 0.3s ease-out" : undefined,
            }}
          />
          {/* Catch zone indicator ring - CSS animation for performance */}
          <div
            className="absolute rounded-full border-2 border-white/30"
            style={{
              width: "90px",
              height: "90px",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              animation: "crosshairPulse 2s ease-in-out infinite",
            }}
          />
          <motion.span
            className="text-6xl sm:text-7xl relative"
            style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))" }}
            animate={basketGlow ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            🧺
          </motion.span>
        </div>
      </motion.div>

      {/* Super premium progress bar with glassmorphism */}
      <div className="absolute bottom-6 sm:bottom-8 left-3 right-3 sm:left-4 sm:right-4 z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/20">
          <div className="flex gap-1.5 sm:gap-2 items-center">
            {["N", "O", " ", "N", "O"].map((letter, i) => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 h-9 sm:h-10 rounded-xl flex items-center justify-center font-black text-lg sm:text-xl transition-all duration-300 relative overflow-hidden",
                  i < noLetters
                    ? "text-white"
                    : "bg-white/10 text-white/30 border border-white/10"
                )}
                style={i < noLetters ? {
                  background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
                  boxShadow: "0 4px 20px rgba(74,222,128,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                } : {}}
                animate={i < noLetters ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {i < noLetters && (
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                    style={{ animation: "shimmer 2s ease-in-out infinite", animationDelay: `${i * 0.1}s` }}
                  />
                )}
                <span className="relative">{letter !== " " ? (i < noLetters ? letter : "?") : ""}</span>
              </motion.div>
            ))}
          </div>
          <motion.p
            className="text-white/80 text-sm mt-2 text-center font-medium"
            animate={noLetters >= 5 ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: noLetters >= 5 ? Infinity : 0 }}
          >
            {noLetters < 5 ? (
              <>Collect <span className="text-green-300 font-bold">{5 - noLetters}</span> more letters!</>
            ) : (
              <span
                style={{
                  background: "linear-gradient(90deg, #4ade80, #22c55e, #4ade80)",
                  backgroundSize: "200% auto",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  animation: "shimmer 2s linear infinite",
                }}
              >
                You spelled NO! 🎉
              </span>
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

  // Tutorial screen with premium visuals
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-600 via-red-600 to-pink-700 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Multi-layer animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating hearts with physics-like movement */}
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl"
              style={{ left: `${(i * 7) % 100}%` }}
              initial={{ y: "110%", rotate: 0, opacity: 0 }}
              animate={{
                y: "-20%",
                rotate: [0, 180, 360],
                opacity: [0, 0.2, 0.2, 0],
                x: [0, (i % 2 === 0 ? 30 : -30), 0],
              }}
              transition={{
                duration: 12 + (i % 5) * 2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "linear",
              }}
            >
              {["💕", "❤️", "💛", "💔", "💣", "💥"][i % 6]}
            </motion.div>
          ))}

          {/* Animated gradient orbs */}
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-red-400/20 to-rose-400/20 blur-3xl"
            style={{ top: "-20%", right: "-10%" }}
            animate={{
              scale: [1, 1.3, 1],
              x: [0, -50, 0],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-r from-pink-400/20 to-orange-400/20 blur-3xl"
            style={{ bottom: "-20%", left: "-10%" }}
            animate={{
              scale: [1.2, 1, 1.2],
              y: [0, -40, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Fire particles */}
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={`fire-${i}`}
              className="absolute w-2 h-2 bg-orange-400 rounded-full"
              style={{
                left: `${10 + Math.random() * 80}%`,
                bottom: "5%",
              }}
              animate={{
                y: [0, -100, -200],
                opacity: [1, 0.5, 0],
                scale: [1, 0.5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>

        {/* Premium card with glow */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative z-10 max-w-sm w-full"
        >
          {/* Card glow effect */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-red-400/30 via-rose-400/30 to-pink-400/30 blur-2xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_25px_80px_-15px_rgba(239,68,68,0.5)] relative border border-white/40 overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
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
          </div>
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

  // Super premium main game screen
  return (
    <motion.div
      className="fixed inset-0 overflow-hidden select-none"
      animate={screenShake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Super premium animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #e11d48 0%, #db2777 20%, #c026d3 40%, #9333ea 60%, #dc2626 80%, #f43f5e 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 12s ease infinite",
        }}
      />

      {/* Animated mesh gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(251,113,133,0.8) 0%, transparent 70%)",
            top: "-15%",
            left: "-10%",
            animation: "float 15s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(249,115,22,0.8) 0%, transparent 70%)",
            bottom: "-15%",
            right: "-10%",
            animation: "float 12s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Premium pattern overlay */}
      <div className="absolute inset-0 opacity-[0.08]">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, white 2px, transparent 2px)",
          backgroundSize: "40px 40px",
        }} />
      </div>

      {/* Premium glassmorphism header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 sm:gap-3 z-20 px-3">
        <motion.div
          className="bg-white/20 backdrop-blur-xl rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/30 flex items-center gap-2"
          animate={score > 0 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          <span className="text-xl sm:text-2xl">💯</span>
          <span className="text-lg sm:text-xl font-black text-white drop-shadow-lg">{score}</span>
        </motion.div>
        <motion.div
          className={cn(
            "backdrop-blur-xl rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border flex items-center gap-2 relative overflow-hidden",
            timeLeft <= 5
              ? "bg-red-500/40 border-red-400/50"
              : "bg-white/20 border-white/30"
          )}
          animate={timeLeft <= 5 ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.4, repeat: timeLeft <= 5 ? Infinity : 0 }}
        >
          {timeLeft <= 5 && (
            <div
              className="absolute inset-0 bg-red-500/30"
              style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}
            />
          )}
          <span className="text-xl sm:text-2xl relative">⏱️</span>
          <span className={cn(
            "text-lg sm:text-xl font-black relative drop-shadow-lg",
            timeLeft <= 5 ? "text-red-100" : "text-white"
          )}>
            {timeLeft}s
          </span>
        </motion.div>
        <AnimatePresence>
          {combo >= 3 && (
            <motion.div
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 shadow-[0_8px_32px_rgba(249,115,22,0.4)] border border-orange-400/50 relative overflow-hidden"
              style={{ animation: combo >= 5 ? "comboFire 0.5s ease-in-out infinite" : undefined }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
              />
              <span className="text-lg sm:text-xl font-black text-white relative drop-shadow-lg">x{combo} 🔥</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Premium cat with reactions */}
      <motion.div
        className="absolute top-20 left-1/2 -translate-x-1/2 text-center z-20"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="relative">
          <div
            className="absolute blur-2xl rounded-full"
            style={{
              background: catEmotion === "shocked"
                ? "radial-gradient(circle, rgba(239,68,68,0.5) 0%, transparent 70%)"
                : catEmotion === "sad"
                  ? "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(251,146,60,0.4) 0%, transparent 70%)",
              width: "100px",
              height: "100px",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <motion.div
            className="text-5xl sm:text-6xl mb-1 relative"
            style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))" }}
            animate={catEmotion === "shocked" ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
            transition={{ duration: 0.3, repeat: catEmotion === "shocked" ? Infinity : 0 }}
          >
            {catEmotion === "happy" ? "😼" : catEmotion === "angry" ? "😾" : catEmotion === "sad" ? "😿" : "🙀"}
          </motion.div>
        </div>
        <AnimatePresence>
          {catReaction && (
            <motion.div
              initial={{ scale: 0, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, y: -10, opacity: 0 }}
              className="bg-white/95 backdrop-blur-xl text-red-600 px-4 py-2 rounded-full font-bold shadow-[0_8px_32px_rgba(0,0,0,0.2)] text-sm whitespace-nowrap border border-white/50"
            >
              {catReaction}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Premium skip button */}
      <button
        onClick={() => {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            onComplete(score);
          }
        }}
        className="absolute top-4 right-4 bg-white/15 backdrop-blur-xl rounded-full px-4 py-2 text-white/90 text-sm z-20 hover:bg-white/25 transition-all duration-300 border border-white/20 shadow-lg"
      >
        Skip →
      </button>

      {/* Premium smash particles */}
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 0, opacity: 0, y: -50 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={cn("absolute text-2xl pointer-events-none z-30", p.color)}
            style={{
              left: p.x,
              top: p.y,
              filter: "drop-shadow(0 0 10px currentColor)",
            }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Premium hearts grid with glassmorphism */}
      <div className="absolute inset-0 flex items-center justify-center pt-32 pb-20">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/20">
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {hearts.map(heart => (
              <motion.button
                key={heart.id}
                onClick={(e) => smashHeart(heart, e)}
                disabled={heart.smashed}
                className={cn(
                  "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl transition-all relative overflow-hidden",
                  heart.smashed ? "opacity-0 scale-0" : "active:scale-90",
                )}
                style={!heart.smashed ? {
                  background: heart.type === "pink" ? "linear-gradient(135deg, rgba(251,207,232,0.9) 0%, rgba(244,114,182,0.6) 100%)"
                    : heart.type === "red" ? "linear-gradient(135deg, rgba(254,202,202,0.9) 0%, rgba(248,113,113,0.6) 100%)"
                    : heart.type === "gold" ? "linear-gradient(135deg, rgba(254,249,195,0.9) 0%, rgba(250,204,21,0.6) 100%)"
                    : heart.type === "cat" ? "linear-gradient(135deg, rgba(226,232,240,0.9) 0%, rgba(148,163,184,0.6) 100%)"
                    : "linear-gradient(135deg, rgba(254,215,170,0.9) 0%, rgba(251,146,60,0.6) 100%)",
                  boxShadow: heart.type === "gold"
                    ? "0 4px 20px rgba(250,204,21,0.4), inset 0 1px 0 rgba(255,255,255,0.5)"
                    : "0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.3)",
                } : {}}
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
                whileHover={{ scale: heart.smashed ? 0 : 1.1, y: -2 }}
                whileTap={{ scale: heart.smashed ? 0 : 0.85 }}
              >
                {/* Shimmer effect on gold */}
                {heart.type === "gold" && !heart.smashed && (
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
                    style={{ animation: "shimmer 2s ease-in-out infinite" }}
                  />
                )}
                <span className="relative" style={{ filter: heart.type === "gold" ? "drop-shadow(0 0 8px rgba(250,204,21,0.8))" : undefined }}>
                  {heart.type === "pink" && "💕"}
                  {heart.type === "red" && "❤️"}
                  {heart.type === "gold" && "💛"}
                  {heart.type === "cat" && "😺"}
                  {heart.type === "bomb" && (
                    <span style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}>💣</span>
                  )}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Super premium progress / instructions bar */}
      <div className="absolute bottom-6 left-3 right-3 sm:left-4 sm:right-4 z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 sm:p-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/20">
          <p className="text-white/90 font-medium text-sm sm:text-base">
            👆 Tap hearts to smash! Avoid the cat! 😺
          </p>
          <AnimatePresence>
            {combo >= 2 && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm mt-1 font-bold"
                style={{
                  background: "linear-gradient(90deg, #fde047, #fb923c, #fde047)",
                  backgroundSize: "200% auto",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  animation: "shimmer 2s linear infinite",
                }}
              >
                🔥 {combo} combo! +{Math.floor(combo / 3) * 5} bonus per hit!
              </motion.p>
            )}
          </AnimatePresence>
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

  // Tutorial with premium visuals
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-purple-950 to-violet-950 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Premium multi-layer animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Twinkling stars */}
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 3.3) % 100}%`,
                top: `${(i * 7 + 5) % 100}%`,
                width: i % 4 === 0 ? "3px" : i % 3 === 0 ? "2px" : "1px",
                height: i % 4 === 0 ? "3px" : i % 3 === 0 ? "2px" : "1px",
              }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + (i % 3),
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}

          {/* Floating projectiles with glow */}
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={`projectile-${i}`}
              className="absolute text-2xl"
              style={{ left: `${(i * 10) % 100}%` }}
              initial={{ y: "-10%", rotate: 0, opacity: 0 }}
              animate={{
                y: "110%",
                rotate: 360,
                opacity: [0, 0.2, 0.2, 0],
              }}
              transition={{
                duration: 10 + (i % 4) * 2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "linear",
              }}
            >
              {["💕", "💋", "✨", "💗", "⭐"][i % 5]}
            </motion.div>
          ))}

          {/* Animated nebula orbs */}
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-3xl"
            style={{ top: "-20%", left: "-15%" }}
            animate={{
              scale: [1, 1.3, 1],
              x: [0, 60, 0],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-r from-violet-600/20 to-indigo-600/20 blur-3xl"
            style={{ bottom: "-20%", right: "-15%" }}
            animate={{
              scale: [1.2, 1, 1.2],
              y: [0, -40, 0],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Premium card with glow */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative z-10 max-w-sm w-full"
        >
          {/* Card glow effect */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-violet-500/30 blur-2xl"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 text-center shadow-[0_25px_80px_-15px_rgba(139,92,246,0.5)] relative border border-purple-300/50 overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
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
          </div>
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

  // Super premium main game
  return (
    <motion.div
      className="fixed inset-0 overflow-hidden select-none touch-none"
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
      {/* Super premium animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: slowMo
            ? "linear-gradient(135deg, #1e3a5f 0%, #1e1b4b 25%, #312e81 50%, #4c1d95 75%, #2e1065 100%)"
            : "linear-gradient(135deg, #0f172a 0%, #1e1b4b 20%, #4c1d95 45%, #7e22ce 70%, #581c87 100%)",
          backgroundSize: "300% 300%",
          animation: "gradientShift 20s ease infinite",
        }}
      />

      {/* Animated nebula orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)",
            top: "-20%",
            left: "-15%",
            animation: "float 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)",
            bottom: "-15%",
            right: "-15%",
            animation: "float 20s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Optimized star field - CSS animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 17 + 3) % 100}%`,
              top: `${(i * 23 + 7) % 100}%`,
              width: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
              height: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
              animation: `starTwinkle ${2 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${(i * 0.1) % 2}s`,
            }}
          />
        ))}
      </div>

      {/* Subtle ambient particles - reduced for performance */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={`ambient-${i}`}
            className="absolute w-2 h-2 rounded-full bg-pink-400/20 blur-sm"
            style={{
              left: `${15 + i * 18}%`,
              top: `${25 + (i % 3) * 20}%`,
              animation: `float ${5 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
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

      {/* Premium glassmorphism header */}
      <div className="absolute top-3 left-0 right-0 flex justify-center gap-2 z-30 px-3">
        <motion.div
          className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20 flex items-center gap-1.5"
          animate={score > 0 ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          <span className="text-lg">⭐</span>
          <span className="text-base font-bold text-white drop-shadow-lg">{score}</span>
        </motion.div>
        <motion.div
          className={cn(
            "backdrop-blur-xl rounded-2xl px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border flex items-center gap-1.5 relative overflow-hidden",
            timeLeft <= 5 ? "bg-red-500/30 border-red-400/40" : "bg-white/10 border-white/20"
          )}
          animate={timeLeft <= 5 ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.4, repeat: timeLeft <= 5 ? Infinity : 0 }}
        >
          {timeLeft <= 5 && (
            <div
              className="absolute inset-0 bg-red-500/20"
              style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}
            />
          )}
          <span className="text-lg relative">⏱️</span>
          <span className={cn("text-base font-bold relative drop-shadow-lg", timeLeft <= 5 ? "text-red-200" : "text-white")}>
            {timeLeft}s
          </span>
        </motion.div>
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20 flex items-center gap-0.5">
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
        <AnimatePresence>
          {combo >= 5 && (
            <motion.div
              initial={{ scale: 0, x: 20, opacity: 0 }}
              animate={{ scale: 1, x: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="bg-gradient-to-r from-orange-500/60 via-yellow-500/60 to-amber-500/60 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-[0_8px_32px_rgba(251,191,36,0.3)] border border-yellow-400/40 relative overflow-hidden"
              style={{ animation: combo >= 10 ? "comboFire 0.5s ease-in-out infinite" : undefined }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
              />
              <span className="text-base font-bold text-yellow-100 relative drop-shadow-lg">x{combo} 🔥</span>
            </motion.div>
          )}
        </AnimatePresence>
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

  // Super premium main game - letter queue view
  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      animate={screenShake > 0 ? { x: [0, -screenShake, screenShake, 0] } : {}}
    >
      {/* Super premium animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fecaca 20%, #fbcfe8 40%, #fce7f3 60%, #ffe4e6 80%, #fef9c3 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      />

      {/* Animated mesh gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(251,113,133,0.6) 0%, transparent 70%)",
            top: "-15%",
            left: "-10%",
            animation: "float 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)",
            bottom: "-10%",
            right: "-10%",
            animation: "float 15s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Premium diagonal pattern overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(244,63,94,0.3) 20px, rgba(244,63,94,0.3) 40px)`,
        }} />
      </div>

      {/* Premium glassmorphism header */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-30">
        <motion.div
          className="bg-white/30 backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 flex items-center gap-2"
          animate={score > 0 ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          <span className="text-xl">💔</span>
          <span className="text-lg font-bold text-rose-600 drop-shadow">{score}</span>
        </motion.div>

        <motion.div
          className={cn(
            "backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] border flex items-center gap-2 relative overflow-hidden",
            timeLeft <= 10 ? "bg-red-500/20 border-red-400/50" : "bg-white/30 border-white/50"
          )}
          animate={timeLeft <= 10 ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.4, repeat: timeLeft <= 10 ? Infinity : 0 }}
        >
          {timeLeft <= 10 && (
            <div
              className="absolute inset-0 bg-red-500/20"
              style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}
            />
          )}
          <span className="text-xl relative">⏱️</span>
          <span className={cn("text-lg font-bold relative", timeLeft <= 10 ? "text-red-600" : "text-rose-600")}>
            {timeLeft}s
          </span>
        </motion.div>
      </div>

      {/* Premium cat with mailbag */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 text-center z-20">
        <div className="relative">
          <div
            className="absolute blur-2xl rounded-full"
            style={{
              background: catEmotion === "devastated" || catEmotion === "crying"
                ? "radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(251,146,60,0.3) 0%, transparent 70%)",
              width: "100px",
              height: "100px",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-6xl relative" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.2))" }}>
              {catEmotion === "devastated" ? "😭" : catEmotion === "crying" ? "😿" : catEmotion === "nervous" ? "🙀" : "😸"}
            </span>
          </motion.div>
        </div>
        <motion.p
          className="text-rose-600/90 font-medium text-sm mt-1"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {letterQueue.length === 0 ? "Sending more letters..." : "Please read my letters! 💕"}
        </motion.p>
        <AnimatePresence>
          {catMessage && (
            <motion.div
              initial={{ scale: 0, y: 5, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white/95 backdrop-blur-xl text-rose-600 px-4 py-2 rounded-full font-bold shadow-[0_8px_32px_rgba(0,0,0,0.15)] text-sm whitespace-nowrap border border-rose-200/50"
            >
              {catMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Premium stats bar with glassmorphism */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        <div className="bg-white/40 backdrop-blur-xl rounded-xl px-3 py-1.5 text-center shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/50">
          <div className="text-lg font-bold text-rose-600">{lettersDestroyed}</div>
          <div className="text-[9px] text-rose-400 font-medium">destroyed</div>
        </div>
        <div className="bg-orange-100/50 backdrop-blur-xl rounded-xl px-3 py-1.5 text-center shadow-[0_4px_20px_rgba(251,146,60,0.15)] border border-orange-200/50">
          <div className="text-lg font-bold text-orange-600">{burnCount} 🔥</div>
          <div className="text-[9px] text-orange-400 font-medium">burned</div>
        </div>
        <div className="bg-slate-100/50 backdrop-blur-xl rounded-xl px-3 py-1.5 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-200/50">
          <div className="text-lg font-bold text-slate-600">{ripCount} ✂️</div>
          <div className="text-[9px] text-slate-400 font-medium">ripped</div>
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

  // TUTORIAL SCREEN - Premium
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Premium animated background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Lightning bolts */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-4xl"
              style={{ left: `${(i * 12.5)}%`, top: "-10%" }}
              initial={{ y: "-10%", opacity: 0 }}
              animate={{
                y: "110%",
                opacity: [0, 0.3, 0.3, 0],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 8 + (i % 3) * 2,
                repeat: Infinity,
                delay: i * 0.8,
              }}
            >
              {["⚔️", "⚡", "💜", "👑", "🔥"][i % 5]}
            </motion.div>
          ))}

          {/* Nebula orbs */}
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-3xl"
            style={{ top: "-30%", left: "-20%" }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-red-600/20 to-purple-600/20 blur-3xl"
            style={{ bottom: "-30%", right: "-20%" }}
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>

        {/* Premium card with glow */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="relative z-10 max-w-sm w-full"
        >
          {/* Card glow */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-purple-500/40 via-pink-500/40 to-red-500/40 blur-2xl"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 text-center shadow-[0_25px_80px_-15px_rgba(168,85,247,0.5)] border-2 border-purple-500/50 relative overflow-hidden">
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent -skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />

            {/* Boss avatar with effects */}
            <div className="relative mb-4">
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  className="w-24 h-24 bg-purple-500/30 rounded-full blur-2xl"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
              <motion.div
                className="text-7xl relative"
                animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                👑😾👑
              </motion.div>
            </div>

            <motion.h2
              className="text-3xl font-black mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.span
                className="bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent bg-[length:200%_auto]"
                animate={{ backgroundPosition: ["0% center", "100% center", "0% center"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                THE DRAMA KING
              </motion.span>
            </motion.h2>

            <motion.p
              className="text-purple-300 text-sm mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              "You DARE challenge me?!<br />
              <span className="font-bold text-pink-400">PROVE YOUR LOVE!</span>"
            </motion.p>

            <motion.div
              className="bg-slate-800/80 rounded-2xl p-4 mb-4 space-y-3 border border-purple-500/30"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {[
                { icon: "👆", color: "pink", title: "TAP or HOLD!", desc: "Tap to attack, hold to charge!" },
                { icon: "👋", color: "cyan", title: "SWIPE to Dodge!", desc: "Perfect timing = counter!" },
                { icon: "🔥", color: "orange", title: "Build Combos!", desc: "10+ combo = damage boost!" },
                { icon: "⚡", color: "yellow", title: "SUPER Attack!", desc: "Fill meter for mega damage!" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <motion.div
                    className={`w-11 h-11 bg-${item.color}-500/30 rounded-xl flex items-center justify-center border border-${item.color}-500/30`}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                  >
                    <span className="text-xl">{item.icon}</span>
                  </motion.div>
                  <div className="text-left flex-1">
                    <div className="text-white text-sm font-bold">{item.title}</div>
                    <div className="text-slate-400 text-xs">{item.desc}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.button
              onClick={startCountdown}
              className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white rounded-2xl font-bold text-xl shadow-[0_10px_40px_-10px_rgba(168,85,247,0.5)] relative overflow-hidden"
              whileHover={{ scale: 1.02, boxShadow: "0 15px 50px -10px rgba(168,85,247,0.6)" }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
              />
              <span className="relative flex items-center justify-center gap-2">
                FIGHT!
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >
                  ⚔️
                </motion.span>
              </span>
            </motion.button>
          </div>
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

  // VICTORY SCREEN - Premium
  if (phase === "victory") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center p-4 overflow-hidden">
        {/* Celebration particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl"
              style={{ left: `${(i * 3.3) % 100}%`, top: "-10%" }}
              initial={{ y: "-10%", rotate: 0 }}
              animate={{
                y: "110%",
                rotate: 720,
                x: [0, (i % 2 === 0 ? 30 : -30), 0],
              }}
              transition={{
                duration: 5 + (i % 3) * 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            >
              {["🏆", "⭐", "✨", "💖", "🎉", "👑"][i % 6]}
            </motion.div>
          ))}
        </div>

        {/* Premium card */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="relative z-10 max-w-sm w-full"
        >
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-yellow-400/40 via-pink-400/40 to-purple-400/40 blur-2xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 text-center shadow-[0_25px_80px_-15px_rgba(236,72,153,0.5)] relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/30 to-transparent -skew-x-12"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />

            <div className="relative mb-4">
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  className="w-24 h-24 bg-yellow-400/40 rounded-full blur-2xl"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.div>
              <motion.div
                className="text-7xl relative"
                animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
                transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
              >
                🏆
              </motion.div>
            </div>

            <motion.h2
              className="text-4xl font-black mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.span
                className="bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500 bg-clip-text text-transparent bg-[length:200%_auto]"
                animate={{ backgroundPosition: ["0% center", "100% center", "0% center"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                VICTORY!
              </motion.span>
            </motion.h2>

            <motion.p
              className="text-slate-600 mb-4 text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              "Fine... I accept your love... 💕"
            </motion.p>

            <motion.div
              className="grid grid-cols-2 gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="bg-gradient-to-br from-pink-50 to-rose-100 rounded-2xl p-4 border border-pink-200">
                <motion.p
                  className="text-3xl font-black text-pink-600"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: 3 }}
                >
                  {score}
                </motion.p>
                <p className="text-pink-400 text-xs font-medium">Score</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-4 border border-purple-200">
                <motion.p
                  className="text-3xl font-black text-purple-600"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: 3, delay: 0.2 }}
                >
                  x{maxCombo}
                </motion.p>
                <p className="text-purple-400 text-xs font-medium">Max Combo</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  // DEFEAT SCREEN - Premium
  if (phase === "defeat") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-red-950 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Falling broken hearts */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl opacity-30"
              style={{ left: `${(i * 6.6) % 100}%`, top: "-10%" }}
              initial={{ y: "-10%", rotate: 0 }}
              animate={{ y: "110%", rotate: 360 }}
              transition={{
                duration: 8 + (i % 4) * 2,
                repeat: Infinity,
                delay: i * 0.4,
              }}
            >
              {["💔", "😿", "💀"][i % 3]}
            </motion.div>
          ))}
        </div>

        {/* Premium card */}
        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="relative z-10 max-w-sm w-full"
        >
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-red-500/30 to-slate-500/30 blur-2xl"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-8 text-center shadow-[0_25px_80px_-15px_rgba(239,68,68,0.3)] border-2 border-red-500/50 relative overflow-hidden">
            <div className="relative mb-4">
              <motion.div
                className="text-7xl"
                animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                😿💔
              </motion.div>
            </div>

            <h2 className="text-3xl font-black text-red-400 mb-4">DEFEATED...</h2>

            <p className="text-slate-400 mb-4">
              "I KNEW you couldn't handle my drama!" 👑
            </p>

            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
              <p className="text-slate-500">Score: <span className="font-bold text-red-400">{score}</span></p>
            </div>
          </div>
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
// RHYTHM HEART BEAT - ULTIMATE rhythm game with fever mode & power-ups!
// ============================================================================

type RhythmNote = {
  id: number;
  lane: 0 | 1 | 2;
  y: number;
  type: "heart" | "golden" | "broken" | "diamond" | "freeze" | "shield" | "bomb";
  speed: number;
  hit?: "perfect" | "good" | "miss";
};

type RhythmHitEffect = {
  id: number;
  lane: number;
  type: "perfect" | "good" | "miss" | "fever" | "powerup";
  y: number;
  points?: number;
  text?: string;
};

type RhythmParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
};

const RHYTHM_CAT_MESSAGES = [
  { combo: 5, text: "Nice! 💕", emotion: "happy" as const },
  { combo: 10, text: "Amazing! 🌟", emotion: "happy" as const },
  { combo: 15, text: "You're on fire! 🔥", emotion: "impressed" as const },
  { combo: 20, text: "INCREDIBLE! ✨", emotion: "impressed" as const },
  { combo: 25, text: "FEVER TIME! 💜", emotion: "impressed" as const },
  { combo: 30, text: "UNSTOPPABLE!! 🚀", emotion: "impressed" as const },
  { combo: 40, text: "LEGENDARY!!! 👑", emotion: "impressed" as const },
];

const RhythmHeartBeatGame = memo(function RhythmHeartBeatGame({
  onComplete
}: {
  onComplete: (score: number) => void;
}) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "done">("tutorial");
  const [countdownNum, setCountdownNum] = useState(3);
  const [notes, setNotes] = useState<RhythmNote[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(35);
  const [hitEffects, setHitEffects] = useState<RhythmHitEffect[]>([]);
  const [laneFlash, setLaneFlash] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [beatPulse, setBeatPulse] = useState(false);
  const [catEmotion, setCatEmotion] = useState<"happy" | "impressed" | "worried">("happy");
  const [particles, setParticles] = useState<RhythmParticle[]>([]);
  // NEW: Fever mode and power-ups!
  const [feverMode, setFeverMode] = useState(false);
  const [feverTimer, setFeverTimer] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [catMessage, setCatMessage] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const noteIdRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const particleIdRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // Animated score display
  useEffect(() => {
    if (displayedScore < score) {
      const diff = score - displayedScore;
      const step = Math.max(1, Math.floor(diff / 10));
      const timer = setTimeout(() => {
        setDisplayedScore(prev => Math.min(prev + step, score));
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [displayedScore, score]);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, type: "perfect" | "good" | "miss" | "golden") => {
    const colors = type === "perfect" ? ["#fbbf24", "#fcd34d", "#fef08a"] :
                   type === "golden" ? ["#ffd700", "#ffec8b", "#fff8dc"] :
                   type === "good" ? ["#4ade80", "#86efac", "#bbf7d0"] :
                   ["#f87171", "#fca5a5", "#fecaca"];
    const count = type === "perfect" || type === "golden" ? 15 : 8;
    const newParticles: RhythmParticle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: type === "perfect" || type === "golden" ? 4 + Math.random() * 4 : 3 + Math.random() * 3,
        life: 1
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum > 0) {
      soundManager.countdown();
      const timer = setTimeout(() => setCountdownNum(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      soundManager.countdownGo();
      soundManager.startRhythmMusic();
      setPhase("playing");
    }
  }, [phase, countdownNum]);

  // Timer
  useEffect(() => {
    if (phase !== "playing" || gameEndedRef.current) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          gameEndedRef.current = true;
          setPhase("done");
          soundManager.stopMusic();
          soundManager.victory();
          setTimeout(() => onCompleteRef.current(scoreRef.current), 2500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Beat pulse
  useEffect(() => {
    if (phase !== "playing") return;
    const beatInterval = setInterval(() => {
      setBeatPulse(true);
      soundManager.rhythmBeat();
      setTimeout(() => setBeatPulse(false), 150);
    }, 500);
    return () => clearInterval(beatInterval);
  }, [phase]);

  // Fever mode timer
  useEffect(() => {
    if (!feverMode || phase !== "playing") return;
    const timer = setInterval(() => {
      setFeverTimer(t => {
        if (t <= 1) {
          setFeverMode(false);
          setEventMessage("Fever ended!");
          setTimeout(() => setEventMessage(null), 1500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [feverMode, phase]);

  // Slow motion timer
  useEffect(() => {
    if (!slowMo) return;
    const timer = setTimeout(() => setSlowMo(false), 3000);
    return () => clearTimeout(timer);
  }, [slowMo]);

  // Cat message based on combo
  useEffect(() => {
    const message = RHYTHM_CAT_MESSAGES.slice().reverse().find(m => combo >= m.combo);
    if (message) {
      setCatMessage(message.text);
      setCatEmotion(message.emotion);
    } else if (combo === 0) {
      setCatMessage(null);
      setCatEmotion("worried");
    }
  }, [combo]);

  // Trigger fever mode at 25 combo
  useEffect(() => {
    if (combo >= 25 && !feverMode && phase === "playing") {
      setFeverMode(true);
      setFeverTimer(8);
      setEventMessage("🔥 FEVER MODE! 🔥");
      soundManager.rhythmCombo();
      setTimeout(() => setEventMessage(null), 2000);
    }
  }, [combo, feverMode, phase]);

  // Spawn notes with power-ups and events!
  useEffect(() => {
    if (phase !== "playing" || gameEndedRef.current) return;

    const baseInterval = slowMo ? 1000 : 650;
    const difficultyMod = Math.min(350, (35 - timeLeft) * 10);
    const interval = feverMode ? baseInterval - difficultyMod - 100 : baseInterval - difficultyMod;

    const spawnInterval = setInterval(() => {
      const lane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const rand = Math.random();

      // Power-up and note type distribution
      let type: RhythmNote["type"];
      if (feverMode) {
        // Fever mode: more golden, no broken, chance for diamond
        type = rand < 0.15 ? "diamond" : rand < 0.35 ? "golden" : "heart";
      } else {
        // Normal: include power-ups occasionally
        if (rand < 0.03) type = "diamond";
        else if (rand < 0.05) type = "freeze";
        else if (rand < 0.07) type = "shield";
        else if (rand < 0.09) type = "bomb";
        else if (rand < 0.14) type = "broken";
        else if (rand < 0.24) type = "golden";
        else type = "heart";
      }

      const baseSpeed = slowMo ? 0.6 : 1.1;
      const speedIncrease = (35 - timeLeft) * (slowMo ? 0.01 : 0.025);

      const newNote: RhythmNote = {
        id: noteIdRef.current++,
        lane,
        y: -8,
        type,
        speed: baseSpeed + speedIncrease,
      };
      setNotes(prev => [...prev, newNote]);
    }, Math.max(250, interval));

    return () => clearInterval(spawnInterval);
  }, [phase, timeLeft, feverMode, slowMo]);

  // Game loop - update note positions and particles
  useEffect(() => {
    if (phase !== "playing") return;

    const gameLoop = () => {
      if (gameEndedRef.current) return;

      setNotes(prev => {
        const updated = prev.map(note => ({
          ...note,
          y: note.y + note.speed
        }));

        // Check for missed notes
        const missed = updated.filter(n => n.y > 92 && !n.hit);
        missed.forEach(n => {
          // Power-ups don't cause misses, only regular notes
          if (n.type === "heart" || n.type === "golden" || n.type === "diamond") {
            // Shield protection!
            if (hasShield) {
              setHasShield(false);
              setEventMessage("🛡️ Shield used!");
              setTimeout(() => setEventMessage(null), 1000);
              soundManager.buttonPress();
              return;
            }
            setCombo(0);
            comboRef.current = 0;
            setPerfectStreak(0);
            setFeverMode(false);
            soundManager.rhythmMiss();
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 200);
            setHitEffects(prev => [...prev, { id: n.id, lane: n.lane, type: "miss", y: 82 }]);
            setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== n.id)), 600);
          }
        });

        return updated.filter(n => n.y <= 100 && !n.hit);
      });

      // Update particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.3,
        life: p.life - 0.03
      })).filter(p => p.life > 0));

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // Handle lane tap - now with power-ups!
  const handleLaneTap = useCallback((lane: 0 | 1 | 2) => {
    if (phase !== "playing" || gameEndedRef.current) return;

    // Flash lane
    setLaneFlash(prev => {
      const newFlash = [...prev] as [boolean, boolean, boolean];
      newFlash[lane] = true;
      return newFlash;
    });
    setTimeout(() => setLaneFlash(prev => {
      const newFlash = [...prev] as [boolean, boolean, boolean];
      newFlash[lane] = false;
      return newFlash;
    }), 120);

    const hitZone = 82;
    const activeNotes = notes.filter(n => n.lane === lane && !n.hit);

    for (const note of activeNotes) {
      const distance = Math.abs(note.y - hitZone);

      if (distance <= 14) {
        const hitX = (lane * 33.33) + 16.66 + 6;
        const hitY = hitZone;

        // Handle different note types
        if (note.type === "broken") {
          // Shield protects from broken hearts too!
          if (hasShield) {
            setHasShield(false);
            setEventMessage("🛡️ Shield blocked damage!");
            setTimeout(() => setEventMessage(null), 1000);
            soundManager.buttonPress();
          } else {
            setScore(s => Math.max(0, s - 50));
            setCombo(0);
            comboRef.current = 0;
            setPerfectStreak(0);
            setFeverMode(false);
            soundManager.rhythmMiss();
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 200);
            spawnParticles(hitX, hitY, "miss");
            setHitEffects(prev => [...prev, { id: note.id, lane, type: "miss", y: hitZone, points: -50 }]);
          }
        } else if (note.type === "freeze") {
          // FREEZE POWER-UP: Slow motion for 3 seconds!
                    setSlowMo(true);
          soundManager.rhythmGolden();
          setEventMessage("⏰ SLOW MOTION!");
          setTimeout(() => setEventMessage(null), 1500);
          spawnParticles(hitX, hitY, "golden");
          setHitEffects(prev => [...prev, { id: note.id, lane, type: "powerup", y: hitZone, text: "FREEZE!" }]);
        } else if (note.type === "shield") {
          // SHIELD POWER-UP: Protect from one miss!
                    setHasShield(true);
          soundManager.rhythmGolden();
          setEventMessage("🛡️ SHIELD ACTIVE!");
          setTimeout(() => setEventMessage(null), 1500);
          spawnParticles(hitX, hitY, "golden");
          setHitEffects(prev => [...prev, { id: note.id, lane, type: "powerup", y: hitZone, text: "SHIELD!" }]);
        } else if (note.type === "bomb") {
          // BOMB POWER-UP: Clear all broken hearts!
                    setNotes(prev => prev.filter(n => n.type !== "broken"));
          soundManager.rhythmGolden();
          setEventMessage("💥 BROKEN HEARTS CLEARED!");
          setTimeout(() => setEventMessage(null), 1500);
          spawnParticles(hitX, hitY, "golden");
          setHitEffects(prev => [...prev, { id: note.id, lane, type: "powerup", y: hitZone, text: "BOOM!" }]);
        } else {
          // Regular notes (heart, golden, diamond)
          const isPerfect = distance <= 5;
          const isDiamond = note.type === "diamond";
          const isGolden = note.type === "golden";

          // Calculate points with fever mode bonus!
          const basePoints = isDiamond ? 500 : isGolden ? 250 : 100;
          const comboMultiplier = comboRef.current >= 15 ? 4 : comboRef.current >= 10 ? 3 : comboRef.current >= 5 ? 2 : 1;
          const perfectBonus = isPerfect ? 1.5 : 1;
          const feverBonus = feverMode ? 2 : 1;
          const points = Math.round(basePoints * perfectBonus * comboMultiplier * feverBonus);

          setScore(s => s + points);
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(m => Math.max(m, newCombo));
            if (newCombo % 10 === 0) soundManager.rhythmCombo();
            return newCombo;
          });

          if (isPerfect) {
                        setPerfectStreak(p => p + 1);
            if (isDiamond) {
              soundManager.rhythmGolden();
              soundManager.rhythmGolden(); // Double sound for diamond!
              spawnParticles(hitX, hitY, "golden");
              spawnParticles(hitX, hitY, "perfect");
            } else if (isGolden) {
              soundManager.rhythmGolden();
              spawnParticles(hitX, hitY, "golden");
            } else {
              soundManager.rhythmPerfect();
              spawnParticles(hitX, hitY, "perfect");
            }
          } else {
            setPerfectStreak(0);
            soundManager.rhythmHit();
            spawnParticles(hitX, hitY, "good");
          }

          const effectType = feverMode ? "fever" : isPerfect ? "perfect" : "good";
          setHitEffects(prev => [...prev, {
            id: note.id, lane,
            type: effectType,
            y: hitZone,
            points
          }]);
        }

        setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== note.id)), 700);

        setNotes(prev => prev.map(n =>
          n.id === note.id ? { ...n, hit: distance <= 5 ? "perfect" : "good" } : n
        ));

        break;
      }
    }
  }, [phase, notes, spawnParticles, hasShield, feverMode]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => soundManager.stopMusic();
  }, []);

  // Tutorial - Now shows power-ups!
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950 via-fuchsia-900 to-pink-800 flex items-center justify-center p-4 overflow-hidden">
        {/* Animated background stars */}
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-[starTwinkle_2s_ease-in-out_infinite]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-3xl p-5 max-w-sm w-full shadow-[0_20px_60px_rgba(168,85,247,0.4)] border border-white/50 max-h-[90vh] overflow-y-auto"
        >
          <div className="text-center">
            <motion.div
              className="text-6xl mb-3 relative"
              animate={{
                scale: [1, 1.15, 1],
                rotate: [0, 5, -5, 0],
                filter: ["drop-shadow(0 0 20px rgba(236,72,153,0.5))", "drop-shadow(0 0 40px rgba(236,72,153,0.8))", "drop-shadow(0 0 20px rgba(236,72,153,0.5))"]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              🎵
            </motion.div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-purple-600 via-pink-500 to-fuchsia-600 bg-clip-text text-transparent mb-1">
              Rhythm Heart Beat
            </h2>
            <p className="text-slate-600 mb-3 text-xs">
              Tap lanes when hearts reach the glowing zone!
            </p>

            {/* Notes */}
            <div className="flex justify-center gap-3 mb-3">
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-3xl mb-1 drop-shadow-lg">💕</div>
                <div className="text-[10px] font-bold text-pink-600 bg-pink-100 rounded-full px-2 py-0.5">+100</div>
              </motion.div>
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-3xl mb-1 animate-[goldShimmer_1.5s_ease-in-out_infinite]">💛</div>
                <div className="text-[10px] font-bold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5">+250</div>
              </motion.div>
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-3xl mb-1 animate-[goldShimmer_1s_ease-in-out_infinite]">💎</div>
                <div className="text-[10px] font-bold text-cyan-700 bg-cyan-100 rounded-full px-2 py-0.5">+500!</div>
              </motion.div>
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-3xl mb-1">💔</div>
                <div className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5">AVOID</div>
              </motion.div>
            </div>

            {/* Power-ups section */}
            <div className="bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 rounded-xl p-3 mb-3">
              <div className="text-xs font-bold text-purple-700 mb-2">⚡ POWER-UPS ⚡</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl">⏰</div>
                  <div className="text-[9px] text-slate-600">Slow Mo</div>
                </div>
                <div>
                  <div className="text-2xl">🛡️</div>
                  <div className="text-[9px] text-slate-600">Shield</div>
                </div>
                <div>
                  <div className="text-2xl">💥</div>
                  <div className="text-[9px] text-slate-600">Clear Bad</div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-r from-purple-100 via-pink-100 to-fuchsia-100 rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-yellow-500">⭐</span>
                <span><strong>Perfect</strong> hits = 1.5x points!</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-orange-500">🔥</span>
                <span><strong>25 Combo</strong> = FEVER MODE (2x!)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-purple-500">✨</span>
                <span><strong>Combos</strong> multiply up to 4x!</span>
              </div>
            </div>

            <motion.button
              onClick={() => { soundManager.buttonPress(); soundManager.uiWhoosh(); setPhase("countdown"); }}
              className="w-full py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-fuchsia-500 text-white font-black text-lg rounded-2xl shadow-[0_8px_30px_rgba(168,85,247,0.4)] relative overflow-hidden"
              whileHover={{ scale: 1.03, boxShadow: "0 12px 40px rgba(168,85,247,0.5)" }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="relative z-10">Let's Go! 🎶</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Countdown
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950 via-fuchsia-900 to-pink-800 flex items-center justify-center overflow-hidden">
        {/* Radial pulse rings */}
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="absolute border-4 border-pink-400/30 rounded-full"
            initial={{ width: 100, height: 100, opacity: 0.8 }}
            animate={{ width: 600, height: 600, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}

        <motion.div
          key={countdownNum}
          initial={{ scale: 3, opacity: 0, rotateY: 90 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className={cn(
            "text-9xl font-black text-white relative",
            countdownNum === 0 && "text-yellow-300"
          )}
          style={{
            textShadow: "0 0 60px rgba(255,255,255,0.8), 0 0 120px rgba(236,72,153,0.6)"
          }}
        >
          {countdownNum || "GO!"}
        </motion.div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950 via-fuchsia-900 to-pink-800 flex items-center justify-center p-4 overflow-hidden">
        {/* Celebration confetti */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-sm"
            style={{
              backgroundColor: ["#fbbf24", "#f472b6", "#a78bfa", "#34d399", "#60a5fa"][i % 5],
              left: `${Math.random() * 100}%`,
            }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{
              y: "100vh",
              rotate: Math.random() * 720,
              opacity: [1, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: Math.random() * 0.5,
              ease: "easeIn"
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className="bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-3xl p-8 text-center shadow-[0_30px_80px_rgba(168,85,247,0.5)] border border-white/50"
        >
          <motion.div
            className="text-7xl mb-4"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            🎵✨
          </motion.div>
          <h2 className="text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-500 to-fuchsia-600 bg-clip-text text-transparent mb-3">
            Amazing Rhythm!
          </h2>
          <motion.div
            className="text-6xl font-black text-pink-500 mb-3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {score.toLocaleString()}
          </motion.div>
          <div className="flex justify-center gap-6 text-slate-600">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{maxCombo}x</div>
              <div className="text-xs">Best Combo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{perfectStreak}</div>
              <div className="text-xs">Perfect Streak</div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Playing - NOW WITH FEVER MODE!
  return (
    <div className={cn(
      "fixed inset-0 overflow-hidden select-none transition-all",
      screenShake && "animate-[screenShake_0.2s_ease-out]",
      feverMode
        ? "bg-gradient-to-b from-orange-900 via-red-800 to-pink-900"
        : slowMo
        ? "bg-gradient-to-b from-cyan-900 via-blue-900 to-purple-900"
        : "bg-gradient-to-b from-purple-950 via-fuchsia-900 to-pink-800"
    )}>
      {/* Fever mode rainbow border */}
      {feverMode && (
        <div className="absolute inset-0 pointer-events-none z-40 border-8 animate-[rainbowGlow_2s_linear_infinite]" />
      )}

      {/* Slow-mo visual indicator */}
      {slowMo && (
        <div className="absolute inset-0 pointer-events-none z-30 border-4 border-cyan-400/50" />
      )}

      {/* Animated background visualizer bars */}
      <div className="absolute inset-0 flex items-end justify-center gap-1 opacity-30 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "w-4 rounded-t-sm",
              feverMode
                ? "bg-gradient-to-t from-yellow-500 to-red-500"
                : "bg-gradient-to-t from-pink-500 to-purple-500"
            )}
            animate={{
              height: beatPulse ? [20, 50 + Math.random() * 80, 20] : [20, 30, 20]
            }}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`
          }}
        />
      ))}

      {/* Event message overlay */}
      {eventMessage && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
        >
          <div className="text-4xl font-black text-white text-center"
            style={{ textShadow: "0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(236,72,153,0.6)" }}>
            {eventMessage}
          </div>
        </motion.div>
      )}

      {/* Premium HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          {/* Score */}
          <motion.div
            className={cn(
              "backdrop-blur-sm rounded-xl px-4 py-2 border",
              feverMode ? "bg-orange-500/50 border-yellow-400/50" : "bg-black/50 border-white/10"
            )}
            animate={score !== displayedScore ? { scale: [1, 1.05, 1] } : {}}
          >
            <div className="text-white text-xl font-black tabular-nums">
              {displayedScore.toLocaleString()}
            </div>
          </motion.div>

          {/* Combo - enhanced in fever mode */}
          <motion.div
            className={cn(
              "rounded-xl px-4 py-2 font-black text-lg transition-all backdrop-blur-sm border",
              feverMode ? "bg-gradient-to-r from-yellow-500/90 to-orange-500/90 text-white border-yellow-300 animate-[comboFire_0.3s_ease-in-out_infinite]" :
              combo >= 15 ? "bg-gradient-to-r from-orange-500/80 to-red-500/80 text-white border-orange-400/50 animate-[comboFire_0.5s_ease-in-out_infinite]" :
              combo >= 10 ? "bg-gradient-to-r from-yellow-500/80 to-orange-500/80 text-white border-yellow-400/50" :
              combo >= 5 ? "bg-gradient-to-r from-pink-500/80 to-rose-500/80 text-white border-pink-400/50" :
              "bg-black/50 text-white/80 border-white/10"
            )}
            animate={combo > 0 ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.15 }}
          >
            {combo}x {feverMode ? "🔥🔥" : combo >= 10 && "🔥"}
          </motion.div>

          {/* Timer */}
          <div className={cn(
            "bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2 border flex items-center gap-2",
            timeLeft <= 5 ? "border-red-500/50 text-red-400" : "border-white/10 text-white"
          )}>
            <span className="text-xl font-black tabular-nums">{timeLeft}s</span>
            {hasShield && <span className="text-lg">🛡️</span>}
          </div>
        </div>

        {/* Fever mode indicator */}
        {feverMode && (
          <motion.div
            className="max-w-lg mx-auto mt-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-center gap-2 text-yellow-300 font-black text-sm">
              <span>🔥 FEVER MODE 🔥</span>
              <div className="w-24 h-2 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                  initial={{ width: "100%" }}
                  animate={{ width: `${(feverTimer / 8) * 100}%` }}
                />
              </div>
              <span>{feverTimer}s</span>
            </div>
          </motion.div>
        )}

        {/* Progress bar */}
        <div className="max-w-lg mx-auto mt-2">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full",
                feverMode
                  ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                  : "bg-gradient-to-r from-pink-500 to-purple-500"
              )}
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / 35) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Lanes with glow effect */}
      <div className="absolute inset-x-4 top-24 bottom-28 flex gap-3">
        {[0, 1, 2].map(lane => (
          <motion.button
            key={lane}
            onClick={() => handleLaneTap(lane as 0 | 1 | 2)}
            className={cn(
              "flex-1 rounded-3xl transition-all relative overflow-hidden border-2",
              feverMode
                ? "bg-gradient-to-b from-orange-500/10 to-yellow-500/10"
                : "bg-gradient-to-b from-white/5 to-white/10",
              laneFlash[lane]
                ? feverMode ? "border-yellow-400 bg-yellow-500/30" : "border-pink-400 bg-pink-500/30"
                : feverMode ? "border-orange-500/30" : "border-white/20"
            )}
            whileTap={{ scale: 0.98 }}
            style={{
              boxShadow: laneFlash[lane]
                ? feverMode ? "inset 0 0 30px rgba(253,224,71,0.5)" : "inset 0 0 30px rgba(236,72,153,0.5)"
                : undefined
            }}
          >
            {/* Lane ambient glow */}
            <div className={cn(
              "absolute inset-0 opacity-30",
              beatPulse && "animate-[laneGlow_0.5s_ease-out]"
            )} />

            {/* Lane label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 font-bold text-sm">
              {["◀", "▼", "▶"][lane]}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Hit Zone - Premium glow effect */}
      <motion.div
        className="absolute left-4 right-4 h-5 rounded-full"
        style={{
          top: "82%",
          background: "linear-gradient(90deg, rgba(236,72,153,0.8), rgba(168,85,247,0.8), rgba(236,72,153,0.8))",
          backgroundSize: "200% 100%",
        }}
        animate={{
          backgroundPosition: ["0% 0%", "200% 0%"],
          boxShadow: beatPulse
            ? ["0 0 30px rgba(236,72,153,0.8), 0 0 60px rgba(168,85,247,0.5)",
               "0 0 50px rgba(236,72,153,1), 0 0 80px rgba(168,85,247,0.7)"]
            : "0 0 30px rgba(236,72,153,0.6), 0 0 50px rgba(168,85,247,0.3)"
        }}
        transition={{
          backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
          boxShadow: { duration: 0.2 }
        }}
      />

      {/* Notes with trails - Now with power-ups! */}
      {notes.filter(n => !n.hit).map(note => {
        // Get emoji for note type
        const getNoteEmoji = () => {
          switch (note.type) {
            case "heart": return "💕";
            case "golden": return "💛";
            case "diamond": return "💎";
            case "broken": return "💔";
            case "freeze": return "⏰";
            case "shield": return "🛡️";
            case "bomb": return "💥";
            default: return "💕";
          }
        };

        const isPowerUp = ["freeze", "shield", "bomb"].includes(note.type);

        return (
          <motion.div
            key={note.id}
            className="absolute pointer-events-none"
            style={{
              left: `calc(${(note.lane * 33.33) + 16.66}% - 20px + 1rem)`,
              top: `${note.y}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: slowMo ? [1, 1.1, 1] : 1,
              opacity: 1,
              rotate: isPowerUp ? [0, 10, -10, 0] : 0
            }}
            transition={slowMo ? { duration: 1, repeat: Infinity } : undefined}
          >
            {/* Trail effect */}
            <div
              className="absolute inset-0 -translate-y-4 opacity-50 blur-sm text-4xl"
              style={{
                filter: note.type === "golden" || note.type === "diamond"
                  ? "brightness(1.5)"
                  : isPowerUp ? "brightness(1.3)" : undefined
              }}
            >
              {getNoteEmoji()}
            </div>
            {/* Main note */}
            <div
              className={cn(
                "text-5xl relative",
                (note.type === "golden" || note.type === "diamond") && "animate-[goldShimmer_1s_ease-in-out_infinite]",
                isPowerUp && "animate-pulse"
              )}
              style={{
                filter: note.type === "diamond"
                  ? "drop-shadow(0 0 20px cyan) drop-shadow(0 0 40px cyan)"
                  : note.type === "golden"
                  ? "drop-shadow(0 0 20px gold) drop-shadow(0 0 40px gold)"
                  : note.type === "broken"
                  ? "drop-shadow(0 0 10px rgba(220,38,38,0.8))"
                  : isPowerUp
                  ? "drop-shadow(0 0 15px rgba(99,102,241,0.8)) drop-shadow(0 0 30px rgba(99,102,241,0.5))"
                  : "drop-shadow(0 0 15px rgba(236,72,153,0.8))"
              }}
            >
              {getNoteEmoji()}
            </div>
            {/* Power-up label */}
            {isPowerUp && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-indigo-500/80 rounded-full px-2">
                {note.type === "freeze" ? "SLOW" : note.type === "shield" ? "SHIELD" : "CLEAR"}
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Hit Effects with score popup - Enhanced for fever mode! */}
      {hitEffects.map(effect => (
        <motion.div
          key={effect.id}
          initial={{ scale: 0.3, opacity: 1, y: 0 }}
          animate={{ scale: feverMode ? 2 : 1.5, opacity: 0, y: -35 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute pointer-events-none text-center"
          style={{
            left: `calc(${(effect.lane * 33.33) + 16.66}% + 1rem)`,
            top: `${effect.y}%`,
            transform: "translate(-50%, -50%)"
          }}
        >
          <div className={cn(
            "font-black text-2xl",
            effect.type === "fever" ? "text-orange-300" :
            effect.type === "powerup" ? "text-cyan-300" :
            effect.type === "perfect" ? "text-yellow-300" :
            effect.type === "good" ? "text-green-400" : "text-red-400"
          )}
          style={{
            textShadow: effect.type === "fever"
              ? "0 0 25px rgba(251,146,60,0.9), 0 0 50px rgba(251,146,60,0.5)"
              : effect.type === "powerup"
              ? "0 0 20px rgba(34,211,238,0.8)"
              : effect.type === "perfect"
              ? "0 0 20px rgba(253,224,71,0.8)"
              : effect.type === "good"
              ? "0 0 15px rgba(74,222,128,0.8)"
              : "0 0 15px rgba(248,113,113,0.8)"
          }}>
            {effect.text ? effect.text :
             effect.type === "fever" ? "🔥 FEVER! 🔥" :
             effect.type === "perfect" ? "PERFECT!" :
             effect.type === "good" ? "GOOD!" : "MISS!"}
          </div>
          {effect.points && (
            <motion.div
              className={cn(
                "text-lg font-bold",
                effect.points > 0 ? feverMode ? "text-yellow-200" : "text-white" : "text-red-300"
              )}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {effect.points > 0 ? `+${effect.points}` : effect.points}
            </motion.div>
          )}
        </motion.div>
      ))}

      {/* Cat with reactions and messages */}
      <motion.div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center"
        animate={{
          y: beatPulse ? -5 : 0,
          scale: feverMode ? [1, 1.15, 1] : combo >= 15 ? [1, 1.1, 1] : 1
        }}
        transition={{ duration: 0.15 }}
      >
        <div className={cn(
          "text-5xl drop-shadow-lg",
          feverMode && "animate-bounce"
        )}>
          {feverMode ? "🤩" : catEmotion === "impressed" ? "😻" : catEmotion === "happy" ? "😸" : "😿"}
        </div>
        {catMessage && (
          <motion.div
            className={cn(
              "text-xs font-bold rounded-full px-3 py-1 mt-1",
              feverMode
                ? "text-yellow-200 bg-orange-500/80"
                : "text-white/90 bg-black/40"
            )}
            initial={{ opacity: 0, scale: 0, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            key={catMessage}
          >
            {catMessage}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
});

// ============================================================================
// LOVE LETTER PUZZLE - Premium sliding tile puzzle
// ============================================================================

const PUZZLE_TILES = ["💕", "💗", "💖", "💝", "❤️", "💘", "💓", "💞"];

type PuzzleSparkle = {
  id: number;
  x: number;
  y: number;
  scale: number;
  delay: number;
};

type PuzzleHistoryEntry = {
  tiles: number[];
  emptyIndex: number;
};

const PUZZLE_CAT_MESSAGES = [
  { progress: 2, text: "Good start! 🐱", emotion: "happy" as const },
  { progress: 4, text: "You're getting it! 😸", emotion: "happy" as const },
  { progress: 6, text: "Almost there! 😻", emotion: "excited" as const },
  { progress: 7, text: "So close!! 🤩", emotion: "excited" as const },
];

const LoveLetterPuzzleGame = memo(function LoveLetterPuzzleGame({
  onComplete
}: {
  onComplete: (score: number) => void;
}) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "done">("tutorial");
  const [countdownNum, setCountdownNum] = useState(3);
  const [tiles, setTiles] = useState<number[]>([]);
  const [emptyIndex, setEmptyIndex] = useState(8);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(75); // More time!
  const [isSolved, setIsSolved] = useState(false);
  const [shakingTile, setShakingTile] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctTiles, setCorrectTiles] = useState<Set<number>>(new Set());
  const [lastMovedTile, setLastMovedTile] = useState<number | null>(null);
  const [sparkles, setSparkles] = useState<PuzzleSparkle[]>([]);
  const [hintPulse, setHintPulse] = useState(false);
  // NEW FUN FEATURES!
  const [undoStack, setUndoStack] = useState<PuzzleHistoryEntry[]>([]);
  const [undosRemaining, setUndosRemaining] = useState(3);
  const [hintsRemaining, setHintsRemaining] = useState(2);
  const [hintedTile, setHintedTile] = useState<number | null>(null);
  const [catMessage, setCatMessage] = useState<string | null>(null);
  const [catEmotion, setCatEmotion] = useState<"happy" | "excited" | "worried">("happy");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [bonusTime, setBonusTime] = useState(0);
  const [showBonusTime, setShowBonusTime] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const sparkleIdRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Cat messages based on progress
  useEffect(() => {
    const progress = correctTiles.size;
    const message = PUZZLE_CAT_MESSAGES.slice().reverse().find(m => progress >= m.progress);
    if (message) {
      setCatMessage(message.text);
      setCatEmotion(message.emotion);
    } else {
      setCatMessage(null);
      setCatEmotion(moves > 40 ? "worried" : "happy");
    }
  }, [correctTiles.size, moves]);

  // Check if puzzle configuration is solvable
  const isSolvable = useCallback((arr: number[]) => {
    let inversions = 0;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i] !== 0 && arr[j] !== 0 && arr[i] > arr[j]) {
          inversions++;
        }
      }
    }
    return inversions % 2 === 0;
  }, []);

  // Shuffle puzzle
  const shufflePuzzle = useCallback(() => {
    let shuffled: number[];
    do {
      shuffled = [1, 2, 3, 4, 5, 6, 7, 8, 0];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    } while (!isSolvable(shuffled) || checkSolution(shuffled));
    return shuffled;
  }, [isSolvable]);

  // Check if solved
  const checkSolution = useCallback((arr: number[]) => {
    return arr.every((tile, index) => {
      if (index === 8) return tile === 0;
      return tile === index + 1;
    });
  }, []);

  // Check which tiles are in correct position
  const updateCorrectTiles = useCallback((arr: number[]) => {
    const correct = new Set<number>();
    arr.forEach((tile, index) => {
      if (tile !== 0 && tile === index + 1) {
        correct.add(tile);
      }
    });
    return correct;
  }, []);

  // Initialize puzzle
  useEffect(() => {
    const shuffled = shufflePuzzle();
    setTiles(shuffled);
    setEmptyIndex(shuffled.indexOf(0));
    setCorrectTiles(updateCorrectTiles(shuffled));
  }, [shufflePuzzle, updateCorrectTiles]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum > 0) {
      soundManager.countdown();
      const timer = setTimeout(() => setCountdownNum(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      soundManager.countdownGo();
      soundManager.startPuzzleMusic();
      setPhase("playing");
    }
  }, [phase, countdownNum]);

  // Timer with low time warning
  useEffect(() => {
    if (phase !== "playing" || gameEndedRef.current || isSolved) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          gameEndedRef.current = true;
          setPhase("done");
          soundManager.stopMusic();
          soundManager.fail();
          setTimeout(() => onCompleteRef.current(0), 2500);
          return 0;
        }
        if (t <= 10) {
          soundManager.puzzleTimeLow();
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, isSolved]);

  // Hint pulse every 15 seconds
  useEffect(() => {
    if (phase !== "playing" || isSolved) return;
    const hintInterval = setInterval(() => {
      setHintPulse(true);
      setTimeout(() => setHintPulse(false), 1000);
    }, 15000);
    return () => clearInterval(hintInterval);
  }, [phase, isSolved]);

  // Add sparkles for correct tile placement
  const addSparkles = useCallback((tileIndex: number) => {
    const col = tileIndex % 3;
    const row = Math.floor(tileIndex / 3);
    const baseX = col * 33.33 + 16.66;
    const baseY = row * 33.33 + 16.66;

    const newSparkles: PuzzleSparkle[] = [];
    for (let i = 0; i < 8; i++) {
      newSparkles.push({
        id: sparkleIdRef.current++,
        x: baseX + (Math.random() - 0.5) * 20,
        y: baseY + (Math.random() - 0.5) * 20,
        scale: 0.5 + Math.random() * 0.5,
        delay: Math.random() * 0.2
      });
    }
    setSparkles(prev => [...prev, ...newSparkles]);
    setTimeout(() => {
      setSparkles(prev => prev.filter(s => !newSparkles.includes(s)));
    }, 1000);
  }, []);

  // Undo function
  const handleUndo = useCallback(() => {
    if (undosRemaining <= 0 || undoStack.length === 0 || phase !== "playing" || isSolved) return;
    const lastState = undoStack[undoStack.length - 1];
    setTiles(lastState.tiles);
    setEmptyIndex(lastState.emptyIndex);
    setUndoStack(prev => prev.slice(0, -1));
    setUndosRemaining(u => u - 1);
    setMoves(m => m - 1);
    setCorrectTiles(updateCorrectTiles(lastState.tiles));
    soundManager.buttonPress();
  }, [undosRemaining, undoStack, phase, isSolved, updateCorrectTiles]);

  // Hint function - find a tile that can move to correct position
  const handleHint = useCallback(() => {
    if (hintsRemaining <= 0 || phase !== "playing" || isSolved) return;
    setHintsRemaining(h => h - 1);

    // Find a tile adjacent to empty that would be correct if moved
    const gridSize = 3;
    const emptyRow = Math.floor(emptyIndex / gridSize);
    const emptyCol = emptyIndex % gridSize;

    const adjacentIndices = [
      emptyRow > 0 ? emptyIndex - 3 : -1,
      emptyRow < 2 ? emptyIndex + 3 : -1,
      emptyCol > 0 ? emptyIndex - 1 : -1,
      emptyCol < 2 ? emptyIndex + 1 : -1,
    ].filter(i => i >= 0 && i < 9);

    // Check which adjacent tiles would be correct if moved to empty
    for (const idx of adjacentIndices) {
      const tile = tiles[idx];
      if (tile !== 0 && tile === emptyIndex + 1) {
        setHintedTile(idx);
        soundManager.buttonPress();
        setTimeout(() => setHintedTile(null), 2000);
        return;
      }
    }

    // If no perfect hint, just highlight any adjacent tile
    const anyAdjacent = adjacentIndices.find(i => tiles[i] !== 0);
    if (anyAdjacent !== undefined) {
      setHintedTile(anyAdjacent);
      soundManager.buttonPress();
      setTimeout(() => setHintedTile(null), 2000);
    }
  }, [hintsRemaining, phase, isSolved, emptyIndex, tiles]);

  // Handle tile tap - Now with undo and streaks!
  const handleTileTap = useCallback((tileIndex: number) => {
    if (phase !== "playing" || gameEndedRef.current || isSolved) return;
    if (tiles[tileIndex] === 0) return;

    const gridSize = 3;
    const emptyRow = Math.floor(emptyIndex / gridSize);
    const emptyCol = emptyIndex % gridSize;
    const tileRow = Math.floor(tileIndex / gridSize);
    const tileCol = tileIndex % gridSize;

    const isAdjacent =
      (Math.abs(emptyRow - tileRow) === 1 && emptyCol === tileCol) ||
      (Math.abs(emptyCol - tileCol) === 1 && emptyRow === tileRow);

    if (!isAdjacent) {
      soundManager.invalidMove();
      setShakingTile(tileIndex);
      setTimeout(() => setShakingTile(null), 300);
      setStreak(0); // Reset streak on invalid move
      return;
    }

    // Save state for undo (keep last 10)
    setUndoStack(prev => [...prev.slice(-9), { tiles: [...tiles], emptyIndex }]);

    soundManager.tileSlide();
    setMoves(m => m + 1);
    setLastMovedTile(tiles[tileIndex]);
    setHintedTile(null); // Clear any hint

    setTiles(prev => {
      const newTiles = [...prev];
      [newTiles[tileIndex], newTiles[emptyIndex]] = [newTiles[emptyIndex], newTiles[tileIndex]];

      // Check for newly correct tiles
      const newCorrect = updateCorrectTiles(newTiles);
      const wasCorrect = correctTiles.has(newTiles[emptyIndex]);
      const isNowCorrect = newCorrect.has(newTiles[emptyIndex]);

      if (!wasCorrect && isNowCorrect) {
        soundManager.tileCorrect();
        addSparkles(emptyIndex);

        // Streak bonus! Every 3 correct placements = +5 seconds
        const newStreak = streak + 1;
        setStreak(newStreak);
        setBestStreak(best => Math.max(best, newStreak));

        if (newStreak % 3 === 0) {
          setTimeLeft(t => t + 5);
          setBonusTime(5);
          setShowBonusTime(true);
          soundManager.rhythmCombo();
          setTimeout(() => setShowBonusTime(false), 1500);
        }
      } else if (wasCorrect && !isNowCorrect) {
        // Moved a tile OUT of correct position
        setStreak(0);
      }

      setCorrectTiles(newCorrect);

      if (checkSolution(newTiles)) {
        gameEndedRef.current = true;
        setIsSolved(true);
        soundManager.stopMusic();
        soundManager.puzzleSolved();

        // Calculate score with streak bonus!
        const baseScore = 1500;
        const timeBonus = timeLeft * 50;
        const movePenalty = Math.max(0, (moves - 20) * 5);
        const streakBonus = bestStreak * 50;
        const finalScore = Math.max(100, baseScore + timeBonus - movePenalty + streakBonus);
        setScore(finalScore);

        setTimeout(() => {
          setPhase("done");
          setTimeout(() => onCompleteRef.current(finalScore), 2500);
        }, 1500);
      }

      return newTiles;
    });
    setEmptyIndex(tileIndex);
  }, [phase, tiles, emptyIndex, isSolved, checkSolution, moves, timeLeft, correctTiles, updateCorrectTiles, addSparkles]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => soundManager.stopMusic();
  }, []);

  // Tutorial - Now with power-ups explanation!
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-700 via-pink-700 to-fuchsia-800 flex items-center justify-center p-4 overflow-hidden">
        {/* Floating hearts background */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-30"
            initial={{ y: "100vh", x: Math.random() * 100 + "%" }}
            animate={{ y: "-10vh" }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear"
            }}
          >
            {["💕", "💗", "💖", "💝"][i % 4]}
          </motion.div>
        ))}

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-3xl p-5 max-w-sm w-full shadow-[0_20px_60px_rgba(244,63,94,0.4)] border border-white/50 max-h-[90vh] overflow-y-auto"
        >
          <div className="text-center">
            <motion.div
              className="text-6xl mb-3"
              animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🧩
            </motion.div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-rose-600 via-pink-500 to-fuchsia-600 bg-clip-text text-transparent mb-1">
              Love Letter Puzzle
            </h2>
            <p className="text-slate-600 mb-3 text-xs">
              Slide the tiles to complete the heart pattern!
            </p>

            {/* Preview grid */}
            <div className="relative mx-auto mb-3 w-fit">
              <div className="grid grid-cols-3 gap-1 p-2 bg-gradient-to-br from-rose-100 to-pink-100 rounded-xl">
                {PUZZLE_TILES.map((emoji, i) => (
                  <motion.div
                    key={i}
                    className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-base shadow-md"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    {emoji}
                  </motion.div>
                ))}
                <div className="w-8 h-8 bg-rose-200/50 rounded-lg border-2 border-dashed border-rose-300" />
              </div>
            </div>

            {/* Power-ups section */}
            <div className="bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 rounded-xl p-3 mb-3">
              <div className="text-xs font-bold text-purple-700 mb-2">⚡ HELPERS ⚡</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white/60 rounded-lg p-2">
                  <div className="text-xl">↩️</div>
                  <div className="text-[9px] text-slate-600 font-semibold">Undo (x3)</div>
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                  <div className="text-xl">💡</div>
                  <div className="text-[9px] text-slate-600 font-semibold">Hint (x2)</div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-r from-rose-100 via-pink-100 to-fuchsia-100 rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-blue-500">⏱️</span>
                <span><strong>75 seconds</strong> to solve!</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-green-500">🔥</span>
                <span><strong>3 correct</strong> in a row = +5s!</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-yellow-500">⭐</span>
                <span><strong>Streaks</strong> boost your score!</span>
              </div>
            </div>

            <motion.button
              onClick={() => { soundManager.buttonPress(); soundManager.uiWhoosh(); setPhase("countdown"); }}
              className="w-full py-3 bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white font-black text-lg rounded-2xl shadow-[0_8px_30px_rgba(244,63,94,0.4)] relative overflow-hidden"
              whileHover={{ scale: 1.03, boxShadow: "0 12px 40px rgba(244,63,94,0.5)" }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="relative z-10">Solve It! 🧩</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Countdown
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-700 via-pink-700 to-fuchsia-800 flex items-center justify-center overflow-hidden">
        {/* Puzzle pieces flying in */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl"
            initial={{
              x: (Math.random() - 0.5) * 600,
              y: (Math.random() - 0.5) * 600,
              rotate: Math.random() * 360,
              opacity: 0.5
            }}
            animate={{
              x: 0,
              y: 0,
              rotate: 0,
              opacity: 0
            }}
            transition={{ duration: 2, delay: i * 0.1 }}
          >
            {PUZZLE_TILES[i]}
          </motion.div>
        ))}

        <motion.div
          key={countdownNum}
          initial={{ scale: 3, opacity: 0, rotateX: 90 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className={cn(
            "text-9xl font-black text-white relative",
            countdownNum === 0 && "text-yellow-300"
          )}
          style={{
            textShadow: "0 0 60px rgba(255,255,255,0.8), 0 0 120px rgba(244,63,94,0.6)"
          }}
        >
          {countdownNum || "GO!"}
        </motion.div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-rose-700 via-pink-700 to-fuchsia-800 flex items-center justify-center p-4 overflow-hidden">
        {/* Celebration effects */}
        {isSolved && [...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            style={{ left: `${Math.random() * 100}%` }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{
              y: "100vh",
              rotate: Math.random() * 720,
              opacity: [1, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: Math.random() * 0.5,
              ease: "easeIn"
            }}
          >
            {["💕", "💗", "💖", "✨", "🎉"][i % 5]}
          </motion.div>
        ))}

        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className="bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-3xl p-8 text-center shadow-[0_30px_80px_rgba(244,63,94,0.5)] border border-white/50"
        >
          <motion.div
            className="text-7xl mb-4"
            animate={isSolved ? {
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {isSolved ? "🧩✨" : "😿"}
          </motion.div>
          <h2 className={cn(
            "text-4xl font-black mb-3",
            isSolved
              ? "bg-gradient-to-r from-rose-600 via-pink-500 to-fuchsia-600 bg-clip-text text-transparent"
              : "text-slate-600"
          )}>
            {isSolved ? "Puzzle Complete!" : "Time's Up!"}
          </h2>
          {isSolved ? (
            <>
              <motion.div
                className="text-6xl font-black text-pink-500 mb-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                {score.toLocaleString()}
              </motion.div>
              <div className="flex justify-center gap-6 text-slate-600">
                <div className="text-center">
                  <div className="text-2xl font-bold text-rose-500">{moves}</div>
                  <div className="text-xs">Moves</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-fuchsia-500">{60 - timeLeft}s</div>
                  <div className="text-xs">Time</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Keep practicing! You'll get it next time.</p>
          )}
        </motion.div>
      </div>
    );
  }

  // Super premium playing screen
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Super premium animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #be123c 0%, #db2777 20%, #c026d3 40%, #9333ea 60%, #ec4899 80%, #f43f5e 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      />

      {/* Animated mesh gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(251,113,133,0.6) 0%, transparent 70%)",
            top: "-15%",
            left: "-10%",
            animation: "float 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)",
            bottom: "-15%",
            right: "-10%",
            animation: "float 15s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Ambient floating particles - optimized CSS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-xl opacity-20"
            style={{
              left: `${i * 18}%`,
              animation: `floatUp ${12 + i * 2}s linear infinite`,
              animationDelay: `${i * 1.5}s`,
            }}
          >
            {["💕", "💗", "💖"][i % 3]}
          </div>
        ))}
      </div>

      {/* Sparkle effects */}
      {sparkles.map(sparkle => (
        <motion.div
          key={sparkle.id}
          className="absolute text-xl pointer-events-none z-50"
          style={{
            left: `calc(50% - 128px + ${sparkle.x}%)`,
            top: `calc(50% - 128px + ${sparkle.y}%)`
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: sparkle.scale, opacity: 0, y: -20 }}
          transition={{ duration: 0.6, delay: sparkle.delay }}
        >
          ✨
        </motion.div>
      ))}

      {/* Bonus time popup */}
      {showBonusTime && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
        >
          <div className="text-4xl font-black text-green-400"
            style={{ textShadow: "0 0 30px rgba(74,222,128,0.8)" }}>
            +{bonusTime}s! 🔥
          </div>
        </motion.div>
      )}

      {/* Super premium glassmorphism HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-black/40 to-transparent">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {/* Moves counter */}
          <motion.div
            className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
            animate={lastMovedTile ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            <div className="text-white/70 text-[10px] font-medium">Moves</div>
            <div className="text-white text-lg font-black tabular-nums drop-shadow">{moves}</div>
          </motion.div>

          {/* Progress + Streak */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex gap-4">
            <div className="text-center">
              <div className="text-white/70 text-[10px] font-medium">Correct</div>
              <div className="text-green-400 text-lg font-black drop-shadow">{correctTiles.size}/8</div>
            </div>
            {streak > 0 && (
              <div className="text-center">
                <div className="text-orange-200/80 text-[10px] font-medium">Streak</div>
                <div className="text-orange-400 text-lg font-black drop-shadow">🔥{streak}</div>
              </div>
            )}
          </div>

          {/* Timer */}
          <motion.div
            className={cn(
              "backdrop-blur-xl rounded-2xl px-4 py-2 border shadow-[0_8px_32px_rgba(0,0,0,0.2)] relative overflow-hidden",
              timeLeft <= 10 ? "bg-red-500/30 border-red-400/50" : "bg-white/10 border-white/20"
            )}
            animate={timeLeft <= 10 ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 0.4, repeat: timeLeft <= 10 ? Infinity : 0 }}
          >
            {timeLeft <= 10 && (
              <div
                className="absolute inset-0 bg-red-500/20"
                style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}
              />
            )}
            <div className={cn(
              "text-[10px] font-medium relative",
              timeLeft <= 10 ? "text-red-200" : "text-white/70"
            )}>Time</div>
            <div className={cn(
              "text-lg font-black tabular-nums relative drop-shadow",
              timeLeft <= 10 ? "text-red-200" : "text-white"
            )}>{timeLeft}s</div>
          </motion.div>
        </div>

        {/* Helper buttons */}
        <div className="flex justify-center gap-3 mt-2 max-w-md mx-auto">
          <motion.button
            onClick={handleUndo}
            disabled={undosRemaining <= 0 || undoStack.length === 0}
            className={cn(
              "px-4 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all",
              undosRemaining > 0 && undoStack.length > 0
                ? "bg-indigo-500/80 text-white border border-indigo-400/50"
                : "bg-black/30 text-white/40 border border-white/10"
            )}
            whileHover={undosRemaining > 0 ? { scale: 1.05 } : {}}
            whileTap={undosRemaining > 0 ? { scale: 0.95 } : {}}
          >
            <span>↩️</span>
            <span>Undo ({undosRemaining})</span>
          </motion.button>
          <motion.button
            onClick={handleHint}
            disabled={hintsRemaining <= 0}
            className={cn(
              "px-4 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all",
              hintsRemaining > 0
                ? "bg-yellow-500/80 text-white border border-yellow-400/50"
                : "bg-black/30 text-white/40 border border-white/10"
            )}
            whileHover={hintsRemaining > 0 ? { scale: 1.05 } : {}}
            whileTap={hintsRemaining > 0 ? { scale: 0.95 } : {}}
          >
            <span>💡</span>
            <span>Hint ({hintsRemaining})</span>
          </motion.button>
        </div>
      </div>

      {/* Puzzle Grid Container */}
      <motion.div
        className={cn(
          "relative bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl rounded-3xl p-5",
          "shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2",
          isSolved ? "border-yellow-400 animate-[rainbowGlow_2s_linear_infinite]" :
          timeLeft <= 10 ? "border-red-500/50" : "border-white/30"
        )}
        animate={isSolved ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        {/* Reference preview (small) */}
        <div className={cn(
          "absolute -top-14 left-1/2 -translate-x-1/2 flex gap-0.5 p-1.5 rounded-lg transition-all",
          hintPulse ? "bg-yellow-400/30 scale-110" : "bg-black/30"
        )}>
          {PUZZLE_TILES.map((emoji, i) => (
            <div key={i} className="w-4 h-4 bg-white/80 rounded-sm flex items-center justify-center text-[8px]">
              {emoji}
            </div>
          ))}
          <div className="w-4 h-4 bg-white/30 rounded-sm" />
        </div>

        {/* Main puzzle grid */}
        <div className="grid grid-cols-3 gap-3 w-72 h-72">
          {tiles.map((tile, index) => (
            tile === 0 ? (
              <motion.div
                key="empty"
                className="aspect-square rounded-2xl border-2 border-dashed border-white/30 bg-black/20"
                layoutId="empty"
              />
            ) : (
              <motion.button
                key={tile}
                layout
                layoutId={`tile-${tile}`}
                onClick={() => handleTileTap(index)}
                className={cn(
                  "aspect-square rounded-2xl shadow-lg border-2 relative overflow-hidden",
                  "flex items-center justify-center text-4xl",
                  "cursor-pointer transition-colors",
                  hintedTile === index
                    ? "bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-100 border-yellow-400 animate-pulse"
                    : correctTiles.has(tile)
                    ? "bg-gradient-to-br from-green-100 via-emerald-50 to-green-100 border-green-400/60"
                    : "bg-gradient-to-br from-white via-rose-50 to-pink-100 border-white/60",
                  shakingTile === index && "animate-[tileShake_0.3s_ease-in-out]",
                  lastMovedTile === tile && "ring-2 ring-pink-400 ring-offset-2 ring-offset-transparent"
                )}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 15px 40px rgba(0,0,0,0.25)",
                  rotateX: -5,
                  rotateY: 5
                }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                style={{
                  transformStyle: "preserve-3d",
                  perspective: "500px",
                  boxShadow: hintedTile === index ? "0 0 30px rgba(251, 191, 36, 0.6)" : undefined
                }}
              >
                {/* Tile number indicator */}
                <div className="absolute top-1 left-1.5 text-[10px] font-bold text-slate-400/60">
                  {tile}
                </div>

                {/* Hint arrow */}
                {hintedTile === index && (
                  <motion.div
                    className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl"
                    animate={{ y: [0, 5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    👇
                  </motion.div>
                )}

                {/* Emoji */}
                <span className="drop-shadow-md">{PUZZLE_TILES[tile - 1]}</span>

                {/* Correct indicator */}
                {correctTiles.has(tile) && (
                  <motion.div
                    className="absolute top-1 right-1 text-green-500"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    ✓
                  </motion.div>
                )}

                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded-2xl pointer-events-none" />
              </motion.button>
            )
          ))}
        </div>
      </motion.div>

      {/* Cat reaction with messages */}
      <motion.div
        className="mt-4 flex flex-col items-center"
        animate={isSolved ? { y: [0, -10, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="text-5xl drop-shadow-lg">
          {isSolved ? "😻" : catEmotion === "excited" ? "🤩" : catEmotion === "happy" ? "😸" : "😿"}
        </div>
        {catMessage && !isSolved && (
          <motion.div
            className="text-xs font-bold text-white/90 bg-black/40 rounded-full px-3 py-1 mt-2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            key={catMessage}
          >
            {catMessage}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
});

// ============================================================================
// CUPID'S ARROW GALLERY - ULTIMATE target shooting with power-ups!
// ============================================================================

type GalleryTarget = {
  id: number;
  x: number;
  y: number;
  size: "small" | "medium" | "large" | "boss";
  type: "heart" | "golden" | "cat" | "rainbow" | "multishot" | "slowmo" | "magnet";
  vx: number;
  vy: number;
  hit?: boolean;
  spawnTime: number;
  health?: number; // For boss targets
};

type FlyingArrow = {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
};

type ImpactEffect = {
  id: number;
  x: number;
  y: number;
  type: "hit" | "miss" | "bullseye" | "cat" | "golden" | "powerup" | "boss" | "rainbow";
  points?: number;
  text?: string;
};

type GalleryParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
};

const GALLERY_CAT_MESSAGES = [
  { combo: 3, text: "Nice shot! 🎯", emotion: "happy" as const },
  { combo: 5, text: "Sharp shooter! 💕", emotion: "happy" as const },
  { combo: 8, text: "ON FIRE! 🔥", emotion: "excited" as const },
  { combo: 12, text: "INCREDIBLE! ✨", emotion: "excited" as const },
  { combo: 15, text: "LEGENDARY!! 👑", emotion: "excited" as const },
];

const CupidsArrowGame = memo(function CupidsArrowGame({
  onComplete
}: {
  onComplete: (score: number) => void;
}) {
  const [phase, setPhase] = useState<"tutorial" | "countdown" | "playing" | "done">("tutorial");
  const [countdownNum, setCountdownNum] = useState(3);
  const [targets, setTargets] = useState<GalleryTarget[]>([]);
  const [crosshair, setCrosshair] = useState({ x: 50, y: 50 });
  const [flyingArrows, setFlyingArrows] = useState<FlyingArrow[]>([]);
  const [canShoot, setCanShoot] = useState(true);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(50); // More time!
  const [impactEffects, setImpactEffects] = useState<ImpactEffect[]>([]);
  const [particles, setParticles] = useState<GalleryParticle[]>([]);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [bullseyes, setBullseyes] = useState(0);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  // NEW POWER-UP STATES!
  const [multiShotActive, setMultiShotActive] = useState(false);
  const [multiShotCount, setMultiShotCount] = useState(0);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [magnetActive, setMagnetActive] = useState(false);
  const [bossSpawned, setBossSpawned] = useState(false);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [catMessage, setCatMessage] = useState<string | null>(null);
  const [catEmotion, setCatEmotion] = useState<"happy" | "excited" | "worried">("happy");
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [frenzyMode, setFrenzyMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const gameEndedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const targetIdRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const particleIdRef = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // Cat messages based on combo
  useEffect(() => {
    const message = GALLERY_CAT_MESSAGES.slice().reverse().find(m => combo >= m.combo);
    if (message) {
      setCatMessage(message.text);
      setCatEmotion(message.emotion);
    } else if (combo === 0) {
      setCatMessage(null);
      setCatEmotion("worried");
    } else {
      setCatEmotion("happy");
    }
  }, [combo]);

  // Trigger frenzy mode at 10 combo
  useEffect(() => {
    if (combo >= 10 && !frenzyMode && phase === "playing") {
      setFrenzyMode(true);
      setEventMessage("🎯 FRENZY MODE! 🎯");
      soundManager.rhythmCombo();
      setTimeout(() => setEventMessage(null), 2000);
      // Frenzy lasts 8 seconds
      setTimeout(() => setFrenzyMode(false), 8000);
    }
  }, [combo, frenzyMode, phase]);

  // Power-up timers
  useEffect(() => {
    if (!multiShotActive) return;
    if (multiShotCount <= 0) {
      setMultiShotActive(false);
    }
  }, [multiShotActive, multiShotCount]);

  useEffect(() => {
    if (!slowMoActive) return;
    const timer = setTimeout(() => setSlowMoActive(false), 5000);
    return () => clearTimeout(timer);
  }, [slowMoActive]);

  useEffect(() => {
    if (!magnetActive) return;
    const timer = setTimeout(() => setMagnetActive(false), 4000);
    return () => clearTimeout(timer);
  }, [magnetActive]);

  // Animated score display
  useEffect(() => {
    if (displayedScore < score) {
      const diff = score - displayedScore;
      const step = Math.max(1, Math.floor(diff / 8));
      const timer = setTimeout(() => {
        setDisplayedScore(prev => Math.min(prev + step, score));
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [displayedScore, score]);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, type: "hit" | "bullseye" | "miss" | "golden") => {
    const colors = type === "bullseye" ? ["#fbbf24", "#fcd34d", "#fef08a", "#f97316"] :
                   type === "golden" ? ["#ffd700", "#ffec8b", "#fff8dc", "#ffed4a"] :
                   type === "hit" ? ["#f472b6", "#ec4899", "#f9a8d4", "#fb7185"] :
                   ["#64748b", "#94a3b8", "#cbd5e1"];
    const count = type === "bullseye" ? 20 : type === "golden" ? 25 : 12;
    const newParticles: GalleryParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        id: particleIdRef.current++,
        x, y,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
        vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: type === "bullseye" || type === "golden" ? 4 + Math.random() * 4 : 3 + Math.random() * 3,
        life: 1
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownNum > 0) {
      soundManager.countdown();
      const timer = setTimeout(() => setCountdownNum(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      soundManager.countdownGo();
      soundManager.startGalleryMusic();
      setPhase("playing");
    }
  }, [phase, countdownNum]);

  // Timer
  useEffect(() => {
    if (phase !== "playing" || gameEndedRef.current) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          gameEndedRef.current = true;
          setPhase("done");
          soundManager.stopMusic();
          soundManager.victory();
          setTimeout(() => onCompleteRef.current(scoreRef.current), 2500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Spawn boss target mid-game
  useEffect(() => {
    if (phase !== "playing" || bossSpawned || timeLeft > 30) return;
    if (timeLeft === 30 && !bossSpawned) {
      setBossSpawned(true);
      setEventMessage("⚠️ BOSS TARGET! ⚠️");
      soundManager.rhythmCombo();
      setTimeout(() => setEventMessage(null), 2000);

      const bossTarget: GalleryTarget = {
        id: targetIdRef.current++,
        x: 50,
        y: 40,
        size: "boss",
        type: "heart",
        vx: 0.3,
        vy: 0.2,
        spawnTime: Date.now(),
        health: 5 // Requires 5 hits!
      };
      setTargets(prev => [...prev, bossTarget]);
    }
  }, [phase, timeLeft, bossSpawned]);

  // Spawn targets - now with power-ups!
  useEffect(() => {
    if (phase !== "playing" || gameEndedRef.current) return;

    const baseInterval = frenzyMode ? 600 : slowMoActive ? 1500 : 1000;
    const speedUp = Math.min(400, (50 - timeLeft) * 8);
    const interval = baseInterval - speedUp;

    const spawnInterval = setInterval(() => {
      const rand = Math.random();

      // Determine target type with power-ups!
      let type: GalleryTarget["type"];
      if (frenzyMode) {
        // Frenzy: more hearts, more golden
        type = rand < 0.05 ? "cat" : rand < 0.25 ? "golden" : rand < 0.3 ? "rainbow" : "heart";
      } else {
        // Normal with power-ups
        if (rand < 0.03) type = "multishot";
        else if (rand < 0.05) type = "slowmo";
        else if (rand < 0.07) type = "magnet";
        else if (rand < 0.12) type = "cat";
        else if (rand < 0.17) type = "rainbow";
        else if (rand < 0.25) type = "golden";
        else type = "heart";
      }

      const sizeRand = Math.random();
      const size: GalleryTarget["size"] = sizeRand < 0.3 ? "small" : sizeRand < 0.7 ? "medium" : "large";

      // Speed - slower when slowMoActive
      const baseSpeed = slowMoActive ? 0.3 : 0.5;
      const speedMultiplier = 1 + (50 - timeLeft) * 0.015;

      const newTarget: GalleryTarget = {
        id: targetIdRef.current++,
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 50,
        size,
        type,
        vx: (Math.random() - 0.5) * baseSpeed * speedMultiplier,
        vy: (Math.random() - 0.5) * baseSpeed * 0.7 * speedMultiplier,
        spawnTime: Date.now()
      };

      soundManager.targetSpawn();
      setTargets(prev => [...prev.slice(-15), newTarget]);
    }, Math.max(300, interval));

    return () => clearInterval(spawnInterval);
  }, [phase, timeLeft, frenzyMode, slowMoActive]);

  // Update target positions and particles
  useEffect(() => {
    if (phase !== "playing") return;

    const gameLoop = () => {
      if (gameEndedRef.current) return;

      setTargets(prev => prev.map(target => {
        if (target.hit) return target;

        let newX = target.x + target.vx;
        let newY = target.y + target.vy;
        let newVx = target.vx;
        let newVy = target.vy;

        // Bounce off walls
        if (newX < 8 || newX > 92) newVx *= -1;
        if (newY < 18 || newY > 72) newVy *= -1;

        newX = Math.max(8, Math.min(92, newX));
        newY = Math.max(18, Math.min(72, newY));

        return { ...target, x: newX, y: newY, vx: newVx, vy: newVy };
      }).filter(t => !t.hit || Date.now() - (t as unknown as { hitTime?: number }).hitTime! < 300));

      // Update arrows
      setFlyingArrows(prev => prev.map(arrow => ({
        ...arrow,
        progress: arrow.progress + 0.12
      })).filter(a => a.progress < 1));

      // Update particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx * 0.3,
        y: p.y + p.vy * 0.3,
        vy: p.vy + 0.15,
        life: p.life - 0.025
      })).filter(p => p.life > 0));

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // Track pointer
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current || phase !== "playing") return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCrosshair({ x: Math.max(8, Math.min(92, x)), y: Math.max(12, Math.min(88, y)) });
  }, [phase]);

  // Shoot - Now with power-ups!
  const handleShoot = useCallback(() => {
    if (!canShoot || phase !== "playing" || gameEndedRef.current) return;

    soundManager.arrowFire();
    setCanShoot(false);

    // Multi-shot: Fire 3 arrows
    const arrowTargets: { x: number; y: number }[] = [];

    if (multiShotActive) {
      setMultiShotCount(c => c - 1);
      // Spread pattern
      arrowTargets.push(
        { x: crosshair.x - 8, y: crosshair.y },
        { x: crosshair.x, y: crosshair.y },
        { x: crosshair.x + 8, y: crosshair.y }
      );
    } else {
      // Magnet: Auto-aim to nearest target
      if (magnetActive) {
        const nearestTarget = targets.filter(t => !t.hit && t.type !== "cat")
          .map(t => ({ t, d: Math.sqrt(Math.pow(crosshair.x - t.x, 2) + Math.pow(crosshair.y - t.y, 2)) }))
          .sort((a, b) => a.d - b.d)[0];
        if (nearestTarget && nearestTarget.d < 30) {
          arrowTargets.push({ x: nearestTarget.t.x, y: nearestTarget.t.y });
        } else {
          arrowTargets.push({ x: crosshair.x, y: crosshair.y });
        }
      } else {
        arrowTargets.push({ x: crosshair.x, y: crosshair.y });
      }
    }

    const baseArrowId = Date.now();
    arrowTargets.forEach((target, i) => {
      setFlyingArrows(prev => [...prev, {
        id: baseArrowId + i,
        x: 50 + (multiShotActive ? (i - 1) * 10 : 0),
        y: 92,
        targetX: target.x,
        targetY: target.y,
        progress: 0
      }]);
    });

    // Check hits after delay for each arrow
    arrowTargets.forEach((arrowTarget, arrowIndex) => {
      const arrowId = baseArrowId + arrowIndex;

      setTimeout(() => {
        let hit = false;

        setTargets(prev => {
          const updated = prev.map(target => {
            if (target.hit && target.size !== "boss") return target;
            if (target.size === "boss" && target.health && target.health <= 0) return target;

            const hitRadius = target.size === "boss" ? 12 :
              target.size === "small" ? 5 :
              target.size === "medium" ? 7 : 9;
            const distance = Math.sqrt(
              Math.pow(arrowTarget.x - target.x, 2) + Math.pow(arrowTarget.y - target.y, 2)
            );

            if (distance <= hitRadius) {
              hit = true;
              const isBullseye = distance <= 2.5;

              // Handle power-up targets
              if (target.type === "multishot") {
                setMultiShotActive(true);
                setMultiShotCount(c => c + 5);
                setEventMessage("🎯 MULTI-SHOT x5!");
                setTimeout(() => setEventMessage(null), 1500);
                soundManager.rhythmGolden();
                spawnParticles(target.x, target.y, "golden");
                setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "powerup", text: "MULTI-SHOT!" }]);
                return { ...target, hit: true };
              }

              if (target.type === "slowmo") {
                setSlowMoActive(true);
                setEventMessage("⏰ SLOW MOTION!");
                setTimeout(() => setEventMessage(null), 1500);
                soundManager.rhythmGolden();
                spawnParticles(target.x, target.y, "golden");
                setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "powerup", text: "SLOW-MO!" }]);
                return { ...target, hit: true };
              }

              if (target.type === "magnet") {
                setMagnetActive(true);
                setEventMessage("🧲 MAGNET AIM!");
                setTimeout(() => setEventMessage(null), 1500);
                soundManager.rhythmGolden();
                spawnParticles(target.x, target.y, "golden");
                setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "powerup", text: "MAGNET!" }]);
                return { ...target, hit: true };
              }

              if (target.type === "cat") {
                soundManager.hiss();
                setScore(s => Math.max(0, s - 100));
                setCombo(0);
                comboRef.current = 0;
                setScreenFlash("red");
                setTimeout(() => setScreenFlash(null), 150);
                spawnParticles(target.x, target.y, "miss");
                setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "cat", points: -100 }]);
                return { ...target, hit: true };
              }

              // Boss target - multiple hits required!
              if (target.size === "boss" && target.health) {
                const newHealth = target.health - 1;
                soundManager.arrowHit();
                spawnParticles(target.x, target.y, "hit");

                if (newHealth <= 0) {
                  // Boss defeated!
                  setBossDefeated(true);
                  setEventMessage("💥 BOSS DEFEATED! +1000 💥");
                  setScore(s => s + 1000);
                  setTimeLeft(t => t + 10); // Bonus time!
                  soundManager.victory();
                  setTimeout(() => setEventMessage(null), 2000);
                  spawnParticles(target.x, target.y, "golden");
                  spawnParticles(target.x, target.y, "bullseye");
                  setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "boss", points: 1000 }]);
                  setScreenFlash("gold");
                  setTimeout(() => setScreenFlash(null), 200);
                  return { ...target, hit: true, health: 0 };
                } else {
                  setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "hit", text: `${newHealth} HP!` }]);
                  return { ...target, health: newHealth };
                }
              }

              // Regular targets
              const frenzyBonus = frenzyMode ? 1.5 : 1;
              const basePoints = target.type === "rainbow" ? 500 :
                target.type === "golden" ? 350 :
                target.size === "large" ? 150 :
                target.size === "medium" ? 100 : 75;
              const bullseyeMultiplier = isBullseye ? 2 : 1;
              const comboBonus = 1 + (comboRef.current * 0.12);
              const points = Math.round(basePoints * bullseyeMultiplier * comboBonus * frenzyBonus);

              setScore(s => s + points);
              setTotalHits(h => h + 1);
              setCombo(c => {
                const newCombo = c + 1;
                setMaxCombo(m => Math.max(m, newCombo));
                return newCombo;
              });

              if (isBullseye) {
                setBullseyes(b => b + 1);
                if (target.type === "golden" || target.type === "rainbow") {
                  soundManager.targetHitGolden();
                  setScreenFlash(target.type === "rainbow" ? "purple" : "gold");
                  spawnParticles(target.x, target.y, "golden");
                  setImpactEffects(prev => [...prev, {
                    id: arrowId, x: target.x, y: target.y,
                    type: target.type === "rainbow" ? "rainbow" : "golden",
                    points
                  }]);
                } else {
                  soundManager.bullseye();
                  setScreenFlash("yellow");
                  spawnParticles(target.x, target.y, "bullseye");
                  setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "bullseye", points }]);
                }
              } else {
                soundManager.arrowHit();
                spawnParticles(target.x, target.y, "hit");
                setImpactEffects(prev => [...prev, { id: arrowId, x: target.x, y: target.y, type: "hit", points }]);
              }
              setTimeout(() => setScreenFlash(null), 100);

              return { ...target, hit: true };
            }
            return target;
          });

          return updated;
        });

        if (!hit && arrowIndex === 0) {
          soundManager.arrowMiss();
          setCombo(0);
          comboRef.current = 0;
          setFrenzyMode(false);
          setImpactEffects(prev => [...prev, { id: arrowId, x: crosshair.x, y: crosshair.y, type: "miss" }]);
        }

        setTimeout(() => setImpactEffects(prev => prev.filter(e => e.id !== arrowId)), 700);
      }, 180);
    });

    // Reload - faster during frenzy
    const reloadTime = frenzyMode ? 300 : 400;
    setTimeout(() => setCanShoot(true), reloadTime);
  }, [canShoot, phase, crosshair, spawnParticles, multiShotActive, magnetActive, targets, frenzyMode]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => soundManager.stopMusic();
  }, []);

  // Tutorial
  if (phase === "tutorial") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Twinkling stars */}
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-[starTwinkle_2s_ease-in-out_infinite]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              opacity: 0.3 + Math.random() * 0.4
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-3xl p-5 max-w-sm w-full shadow-[0_20px_60px_rgba(99,102,241,0.4)] border border-white/50 max-h-[90vh] overflow-y-auto"
        >
          <div className="text-center">
            <motion.div
              className="text-6xl mb-3 relative"
              animate={{
                rotate: [0, 15, -15, 0],
                y: [0, -5, 0]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🏹
            </motion.div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-600 bg-clip-text text-transparent mb-1">
              Cupid's Arrow Gallery
            </h2>
            <p className="text-slate-600 mb-3 text-xs">
              Aim with your finger and tap to shoot!
            </p>

            {/* Targets */}
            <div className="flex justify-center gap-3 mb-3">
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-2xl mb-1 drop-shadow-lg">💕</div>
                <div className="text-[10px] font-bold text-pink-600 bg-pink-100 rounded-full px-2 py-0.5">75-150</div>
              </motion.div>
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-2xl mb-1 animate-[goldShimmer_1.5s_ease-in-out_infinite]">💛</div>
                <div className="text-[10px] font-bold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5">350</div>
              </motion.div>
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-2xl mb-1 animate-[rainbowGlow_2s_linear_infinite]">🌈</div>
                <div className="text-[10px] font-bold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">500!</div>
              </motion.div>
              <motion.div className="text-center" whileHover={{ scale: 1.1 }}>
                <div className="text-2xl mb-1">😼</div>
                <div className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5">AVOID</div>
              </motion.div>
            </div>

            {/* Power-ups section */}
            <div className="bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 rounded-xl p-3 mb-3">
              <div className="text-xs font-bold text-purple-700 mb-2">⚡ POWER-UPS ⚡</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/60 rounded-lg p-1.5">
                  <div className="text-xl">🎯</div>
                  <div className="text-[9px] text-slate-600">Multi-Shot</div>
                </div>
                <div className="bg-white/60 rounded-lg p-1.5">
                  <div className="text-xl">⏰</div>
                  <div className="text-[9px] text-slate-600">Slow-Mo</div>
                </div>
                <div className="bg-white/60 rounded-lg p-1.5">
                  <div className="text-xl">🧲</div>
                  <div className="text-[9px] text-slate-600">Auto-Aim</div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-r from-cyan-100 via-blue-100 to-indigo-100 rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-yellow-500">🎯</span>
                <span><strong>Bullseye</strong> = 2x points!</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-orange-500">🔥</span>
                <span><strong>10 Combo</strong> = FRENZY MODE!</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="text-red-500">👹</span>
                <span><strong>Boss Target</strong> appears mid-game!</span>
              </div>
            </div>

            <motion.button
              onClick={() => { soundManager.buttonPress(); soundManager.uiWhoosh(); setPhase("countdown"); }}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-lg rounded-2xl shadow-[0_8px_30px_rgba(99,102,241,0.4)] relative overflow-hidden"
              whileHover={{ scale: 1.03, boxShadow: "0 12px 40px rgba(99,102,241,0.5)" }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="relative z-10">Take Aim! 🎯</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Countdown
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center overflow-hidden">
        {/* Target practice animation */}
        {[1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="absolute border-4 border-pink-400/30 rounded-full"
            initial={{ width: 50, height: 50, opacity: 0.8 }}
            animate={{ width: 400, height: 400, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}

        <motion.div
          key={countdownNum}
          initial={{ scale: 3, opacity: 0, rotateZ: -15 }}
          animate={{ scale: 1, opacity: 1, rotateZ: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className={cn(
            "text-9xl font-black text-white relative",
            countdownNum === 0 && "text-yellow-300"
          )}
          style={{
            textShadow: "0 0 60px rgba(255,255,255,0.8), 0 0 120px rgba(99,102,241,0.6)"
          }}
        >
          {countdownNum || "FIRE!"}
        </motion.div>
      </div>
    );
  }

  // Done
  if (phase === "done") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Celebration arrows */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            style={{ left: `${Math.random() * 100}%` }}
            initial={{ y: -20, rotate: Math.random() * 45 - 22.5, opacity: 1 }}
            animate={{
              y: "100vh",
              rotate: Math.random() * 360,
              opacity: [1, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: Math.random() * 0.5,
              ease: "easeIn"
            }}
          >
            {["🏹", "💕", "🎯", "✨", "💛"][i % 5]}
          </motion.div>
        ))}

        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className="bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-xl rounded-3xl p-8 text-center shadow-[0_30px_80px_rgba(99,102,241,0.5)] border border-white/50"
        >
          <motion.div
            className="text-7xl mb-4"
            animate={{ rotate: [0, 10, -10, 0], y: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            🏹✨
          </motion.div>
          <h2 className="text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-600 bg-clip-text text-transparent mb-3">
            Sharp Shooting!
          </h2>
          <motion.div
            className="text-6xl font-black text-purple-500 mb-3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {score.toLocaleString()}
          </motion.div>
          <div className="flex justify-center gap-5 text-slate-600">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{maxCombo}x</div>
              <div className="text-xs">Best Combo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-500">{totalHits}</div>
              <div className="text-xs">Hits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{bullseyes}</div>
              <div className="text-xs">Bullseyes</div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Super premium playing screen
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden cursor-none select-none"
      onPointerMove={handlePointerMove}
      onClick={handleShoot}
    >
      {/* Super premium animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: frenzyMode
            ? "linear-gradient(135deg, #7c2d12 0%, #dc2626 20%, #f97316 40%, #fbbf24 60%, #ef4444 80%, #9a3412 100%)"
            : "linear-gradient(135deg, #1e1b4b 0%, #312e81 20%, #4c1d95 40%, #6d28d9 60%, #5b21b6 80%, #1e1b4b 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 20s ease infinite",
        }}
      />

      {/* Animated nebula orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background: frenzyMode
              ? "radial-gradient(circle, rgba(251,146,60,0.6) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)",
            top: "-15%",
            left: "-10%",
            animation: "float 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-3xl"
          style={{
            background: frenzyMode
              ? "radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)",
            bottom: "-15%",
            right: "-10%",
            animation: "float 20s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Screen flash effect */}
      {screenFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-50 transition-opacity"
          style={{
            backgroundColor: screenFlash === "gold" ? "rgba(255, 215, 0, 0.3)" :
                            screenFlash === "yellow" ? "rgba(253, 224, 71, 0.25)" :
                            screenFlash === "red" ? "rgba(239, 68, 68, 0.3)" : "transparent"
          }}
        />
      )}

      {/* Premium starfield - optimized CSS animations */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 17 + 5) % 100}%`,
              top: `${(i * 23 + 7) % 100}%`,
              width: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
              height: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
              animation: `starTwinkle ${2 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${(i * 0.15) % 3}s`,
            }}
          />
        ))}
      </div>

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`
          }}
        />
      ))}

      {/* Premium carnival booth frame */}
      <div className="absolute inset-3 pointer-events-none">
        {/* Outer decorative border */}
        <div className="absolute inset-0 border-[12px] border-amber-500/50 rounded-3xl" />
        {/* Inner glow border */}
        <div className="absolute inset-2 border-4 border-amber-400/30 rounded-2xl" />
        {/* Corner decorations */}
        {["-top-2 -left-2", "-top-2 -right-2", "-bottom-2 -left-2", "-bottom-2 -right-2"].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-8 h-8 bg-amber-500/60 rounded-full border-4 border-amber-400/40`} />
        ))}
        {/* Top sign */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-6 py-2 rounded-xl shadow-lg">
          <span className="text-white font-black text-sm tracking-wider">CUPID'S GALLERY</span>
        </div>
      </div>

      {/* Super premium glassmorphism HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="flex justify-between items-center max-w-lg mx-auto gap-2">
          {/* Score */}
          <motion.div
            className="bg-white/10 backdrop-blur-xl rounded-2xl px-3 sm:px-4 py-2 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            animate={score !== displayedScore ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            <div className="text-purple-200/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Score</div>
            <div className="text-white text-lg sm:text-xl font-black tabular-nums drop-shadow-lg">
              {displayedScore.toLocaleString()}
            </div>
          </motion.div>

          {/* Combo */}
          <motion.div
            className={cn(
              "rounded-2xl px-3 sm:px-4 py-2 font-black text-base sm:text-lg transition-all backdrop-blur-xl border shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden",
              combo >= 8 ? "bg-gradient-to-r from-orange-500/70 to-red-500/70 text-white border-orange-400/50" :
              combo >= 5 ? "bg-gradient-to-r from-yellow-500/70 to-orange-500/70 text-white border-yellow-400/50" :
              combo >= 3 ? "bg-gradient-to-r from-pink-500/70 to-rose-500/70 text-white border-pink-400/50" :
              "bg-white/10 text-white/80 border-white/20"
            )}
            animate={combo > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.15 }}
            style={{ animation: combo >= 8 ? "comboFire 0.5s ease-in-out infinite" : undefined }}
          >
            {combo >= 5 && (
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
              />
            )}
            <span className="relative drop-shadow-lg">{combo}x {combo >= 5 && "🔥"}</span>
          </motion.div>

          {/* Timer */}
          <motion.div
            className={cn(
              "backdrop-blur-xl rounded-2xl px-3 sm:px-4 py-2 border shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden",
              timeLeft <= 10 ? "bg-red-500/30 border-red-400/50" : "bg-white/10 border-white/20"
            )}
            animate={timeLeft <= 10 ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 0.4, repeat: timeLeft <= 10 ? Infinity : 0 }}
          >
            {timeLeft <= 10 && (
              <div
                className="absolute inset-0 bg-red-500/20"
                style={{ animation: "pulseGlow 0.5s ease-in-out infinite" }}
              />
            )}
            <div className={cn(
              "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider relative",
              timeLeft <= 10 ? "text-red-200" : "text-purple-200/80"
            )}>Time</div>
            <div className={cn(
              "text-lg sm:text-xl font-black tabular-nums relative drop-shadow-lg",
              timeLeft <= 10 ? "text-red-200" : "text-white"
            )}>{timeLeft}s</div>
          </motion.div>
        </div>
      </div>

      {/* Reload indicator - premium design */}
      {!canShoot && (
        <motion.div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 border border-amber-500/50 flex items-center gap-2">
            <span className="text-amber-400 text-xs font-bold">RELOADING</span>
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 animate-[reloadBar_0.45s_linear]" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Targets - Premium with spawn animation */}
      {targets.filter(t => !t.hit).map(target => {
        return (
          <motion.div
            key={target.id}
            className={cn(
              "absolute pointer-events-none",
              target.size === "small" ? "text-4xl" :
              target.size === "medium" ? "text-5xl" : "text-6xl"
            )}
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: [0, -5, 0],
              rotate: [0, 3, -3, 0]
            }}
            transition={{
              scale: { duration: 0.3 },
              y: { duration: 2, repeat: Infinity },
              rotate: { duration: 3, repeat: Infinity }
            }}
          >
            <span
              style={{
                filter: target.type === "golden"
                  ? "drop-shadow(0 0 20px gold) drop-shadow(0 0 40px gold)"
                  : target.type === "heart"
                  ? "drop-shadow(0 0 10px rgba(244,114,182,0.6))"
                  : "drop-shadow(0 0 5px rgba(0,0,0,0.5))",
                display: "block",
                transform: "translate(-50%, -50%)"
              }}
              className={cn(
                target.type === "golden" && "animate-[goldShimmer_1s_ease-in-out_infinite]"
              )}
            >
              {target.type === "heart" ? (
                target.size === "small" ? "💕" : target.size === "medium" ? "💗" : "❤️"
              ) : target.type === "golden" ? "💛" : "😼"}
            </span>
          </motion.div>
        );
      })}

      {/* Flying arrows - Premium with trail */}
      {flyingArrows.map(arrow => {
        const currentX = arrow.x + (arrow.targetX - arrow.x) * arrow.progress;
        const currentY = arrow.y + (arrow.targetY - arrow.y) * arrow.progress - Math.sin(arrow.progress * Math.PI) * 25;
        const angle = Math.atan2(arrow.targetY - currentY, arrow.targetX - currentX) * 180 / Math.PI;
        return (
          <React.Fragment key={arrow.id}>
            {/* Arrow trail */}
            {[0.1, 0.2, 0.3].map((offset, i) => {
              const trailProgress = Math.max(0, arrow.progress - offset);
              const trailX = arrow.x + (arrow.targetX - arrow.x) * trailProgress;
              const trailY = arrow.y + (arrow.targetY - arrow.y) * trailProgress - Math.sin(trailProgress * Math.PI) * 25;
              return (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-amber-400 rounded-full pointer-events-none"
                  style={{
                    left: `${trailX}%`,
                    top: `${trailY}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: (0.5 - i * 0.15) * (1 - arrow.progress),
                    boxShadow: "0 0 10px rgba(251, 191, 36, 0.6)"
                  }}
                />
              );
            })}
            {/* Main arrow */}
            <div
              className="absolute text-3xl pointer-events-none"
              style={{
                left: `${currentX}%`,
                top: `${currentY}%`,
                transform: `translate(-50%, -50%) rotate(${angle - 45}deg)`,
                opacity: 1 - arrow.progress * 0.2,
                filter: "drop-shadow(0 0 10px rgba(251, 191, 36, 0.5))"
              }}
            >
              🏹
            </div>
          </React.Fragment>
        );
      })}

      {/* Impact effects - Premium with score popup */}
      {impactEffects.map(effect => (
        <motion.div
          key={effect.id}
          initial={{ scale: 0.3, opacity: 1, y: 0 }}
          animate={{ scale: 2, opacity: 0, y: -25 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute pointer-events-none text-center z-40"
          style={{
            left: `${effect.x}%`,
            top: `${effect.y}%`,
            transform: "translate(-50%, -50%)"
          }}
        >
          <div className={cn(
            "font-black text-2xl",
            effect.type === "bullseye" || effect.type === "golden" ? "text-yellow-300" :
            effect.type === "hit" ? "text-green-400" :
            effect.type === "cat" ? "text-red-400" : "text-slate-400"
          )}
          style={{
            textShadow: effect.type === "bullseye" || effect.type === "golden"
              ? "0 0 20px rgba(253,224,71,0.8), 0 0 40px rgba(253,224,71,0.4)"
              : effect.type === "hit"
              ? "0 0 15px rgba(74,222,128,0.8)"
              : "0 0 10px rgba(148,163,184,0.5)"
          }}>
            {effect.type === "golden" ? "💎 GOLDEN!" :
             effect.type === "bullseye" ? "🎯 BULLSEYE!" :
             effect.type === "hit" ? "💥 HIT!" :
             effect.type === "cat" ? "😾 OOPS!" : "MISS"}
          </div>
          {effect.points && (
            <motion.div
              className={cn(
                "text-lg font-bold",
                effect.points > 0 ? "text-white" : "text-red-300"
              )}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {effect.points > 0 ? `+${effect.points}` : effect.points}
            </motion.div>
          )}
        </motion.div>
      ))}

      {/* Premium Crosshair */}
      <div
        className="absolute pointer-events-none z-30"
        style={{
          left: `${crosshair.x}%`,
          top: `${crosshair.y}%`,
          transform: "translate(-50%, -50%)"
        }}
      >
        {/* Outer rotating ring */}
        <motion.div
          className="absolute w-16 h-16 border-2 border-red-400/50 rounded-full"
          style={{ transform: "translate(-50%, -50%)", left: "50%", top: "50%" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {/* Main crosshair */}
        <div
          className={cn(
            "w-12 h-12 transition-all",
            canShoot ? "opacity-100" : "opacity-40"
          )}
        >
          {/* Outer circle */}
          <div className="absolute inset-0 border-3 border-red-500 rounded-full"
            style={{
              boxShadow: canShoot ? "0 0 15px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.2)" : undefined
            }}
          />
          {/* Cross lines */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 -translate-y-1/2" style={{ boxShadow: "0 0 5px rgba(239, 68, 68, 0.8)" }} />
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-red-500 -translate-x-1/2" style={{ boxShadow: "0 0 5px rgba(239, 68, 68, 0.8)" }} />
          {/* Center dot */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-2.5 h-2.5 bg-red-500 rounded-full"
            style={{
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)"
            }}
            animate={canShoot ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </div>

        {/* Target lock corners when near a target */}
        {canShoot && targets.some(t => {
          const d = Math.sqrt(Math.pow(crosshair.x - t.x, 2) + Math.pow(crosshair.y - t.y, 2));
          return d < 12 && !t.hit;
        }) && (
          <>
            {["-top-3 -left-3", "-top-3 -right-3", "-bottom-3 -left-3", "-bottom-3 -right-3"].map((pos, i) => (
              <motion.div
                key={i}
                className={`absolute ${pos} w-3 h-3 border-2 border-green-400`}
                style={{
                  borderRadius: i === 0 ? "3px 0 0 0" : i === 1 ? "0 3px 0 0" : i === 2 ? "0 0 0 3px" : "0 0 3px 0",
                  borderWidth: i === 0 ? "2px 0 0 2px" : i === 1 ? "2px 2px 0 0" : i === 2 ? "0 0 2px 2px" : "0 2px 2px 0"
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            ))}
          </>
        )}
      </div>

      {/* Event Message Overlay */}
      <AnimatePresence>
        {eventMessage && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="text-5xl font-black text-white drop-shadow-[0_0_30px_rgba(255,215,0,0.8)] animate-pulse">
              {eventMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frenzy Mode Border Effect */}
      {frenzyMode && (
        <div className="absolute inset-0 pointer-events-none z-40 animate-[pulseGlow_0.5s_ease-in-out_infinite]"
          style={{
            boxShadow: "inset 0 0 60px rgba(255, 165, 0, 0.5), inset 0 0 100px rgba(255, 100, 0, 0.3)"
          }}
        />
      )}

      {/* Boss Defeated Celebration */}
      {bossDefeated && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
        >
          <div className="text-4xl font-black text-yellow-300 text-center drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]">
            👑 BOSS DEFEATED! 👑
          </div>
        </motion.div>
      )}

      {/* Cat Message Display */}
      <AnimatePresence>
        {catMessage && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-20 left-4 z-40 pointer-events-none"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-3 border border-purple-500/30 flex items-center gap-3">
              <span className="text-3xl">
                {catEmotion === "excited" ? "😻" : catEmotion === "worried" ? "😿" : "😺"}
              </span>
              <span className="text-white font-medium text-sm">{catMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Power-up Status Indicators */}
      <div className="absolute bottom-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
        {multiShotActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-orange-500/80 to-red-500/80 backdrop-blur-sm rounded-lg px-3 py-1 border border-orange-400/50"
          >
            <span className="text-white font-bold text-xs">🏹 MULTI-SHOT x{multiShotCount}</span>
          </motion.div>
        )}
        {slowMoActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-cyan-500/80 to-blue-500/80 backdrop-blur-sm rounded-lg px-3 py-1 border border-cyan-400/50"
          >
            <span className="text-white font-bold text-xs">⏳ SLOW-MO</span>
          </motion.div>
        )}
        {magnetActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-purple-500/80 to-pink-500/80 backdrop-blur-sm rounded-lg px-3 py-1 border border-purple-400/50"
          >
            <span className="text-white font-bold text-xs">🧲 MAGNET</span>
          </motion.div>
        )}
        {frenzyMode && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-yellow-500/80 to-orange-500/80 backdrop-blur-sm rounded-lg px-3 py-1 border border-yellow-400/50 animate-pulse"
          >
            <span className="text-white font-bold text-xs">🔥 FRENZY!</span>
          </motion.div>
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
      {/* Premium animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-40"
          style={{ background: "radial-gradient(circle, rgba(255,182,193,0.8) 0%, rgba(255,105,180,0.3) 50%, transparent 70%)", left: "10%", top: "20%" }}
          animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-30"
          style={{ background: "radial-gradient(circle, rgba(255,20,147,0.6) 0%, rgba(219,112,147,0.3) 50%, transparent 70%)", right: "5%", bottom: "10%" }}
          animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1.1, 0.9, 1.1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-35"
          style={{ background: "radial-gradient(circle, rgba(255,192,203,0.7) 0%, transparent 70%)", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.35, 0.5, 0.35] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Floating hearts background - premium enhanced */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${(i * 11) % 100}%`,
              fontSize: `${1.5 + (i % 3) * 0.8}rem`,
              filter: i % 3 === 0 ? "drop-shadow(0 0 8px rgba(255,182,193,0.8))" : "none"
            }}
            initial={{ y: "100vh", opacity: 0, rotate: 0 }}
            animate={{
              y: "-100vh",
              opacity: [0, 0.4, 0.4, 0],
              rotate: [0, (i % 2 === 0 ? 360 : -360)],
              x: [0, (i % 2 === 0 ? 20 : -20), 0]
            }}
            transition={{
              duration: 10 + (i % 4) * 3,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "linear"
            }}
          >
            {["💖", "💕", "💗", "✨", "🌸", "💝", "🎀"][i % 7]}
          </motion.div>
        ))}
      </div>

      {/* Sparkle particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 25 }).map((_, i) => (
          <motion.div
            key={`sparkle-${i}`}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: "0 0 6px 2px rgba(255,255,255,0.8)"
            }}
            animate={{
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut"
            }}
          />
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
              className="text-center relative"
            >
              {/* Radial glow behind crown */}
              <motion.div
                className="absolute left-1/2 top-0 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-60"
                style={{ background: "radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,182,193,0.4) 50%, transparent 70%)" }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="text-8xl mb-6 relative"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, -10, 10, 0],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ filter: "drop-shadow(0 0 20px rgba(255,215,0,0.8))" }}
              >
                👑
              </motion.div>
              <motion.h1
                className="text-4xl md:text-6xl font-black text-transparent bg-clip-text relative"
                style={{
                  backgroundImage: "linear-gradient(135deg, #fff 0%, #ffd700 30%, #fff 50%, #ffd700 70%, #fff 100%)",
                  backgroundSize: "200% auto",
                  textShadow: "0 0 40px rgba(255,255,255,0.5)"
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1, backgroundPosition: ["0% center", "200% center"] }}
                transition={{ delay: 0.3, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
              >
                Victory!
              </motion.h1>
              <motion.p
                className="text-xl md:text-2xl text-white/90 mt-4 font-medium"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
              >
                The Drama King has been defeated...
              </motion.p>
              {/* Victory sparkles */}
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  style={{
                    left: `${30 + (i % 4) * 15}%`,
                    top: `${20 + Math.floor(i / 4) * 60}%`
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], rotate: [0, 180] }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                >
                  ✨
                </motion.span>
              ))}
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

              {/* Question card with premium glow */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="relative"
              >
                {/* Premium card glow */}
                <motion.div
                  className="absolute -inset-3 rounded-[2rem] bg-gradient-to-r from-pink-400 via-rose-500 to-red-400 opacity-60 blur-2xl"
                  animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.98, 1.02, 0.98] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-2 border-pink-200 overflow-hidden">
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-100/50 to-transparent -skew-x-12"
                    animate={{ x: ["-200%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                  />
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
                </div>
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
      <div className="fixed inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}

        {/* Super premium animated gradient background */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 15%, #fbcfe8 30%, #f9a8d4 50%, #f472b6 70%, #ec4899 85%, #db2777 100%)",
            backgroundSize: "400% 400%"
          }}
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />

        {/* Animated mesh gradient overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-60"
            style={{ background: "radial-gradient(circle, rgba(255,182,193,0.9) 0%, rgba(255,105,180,0.4) 40%, transparent 70%)", left: "-20%", top: "-30%" }}
            animate={{ x: [0, 150, 0], y: [0, 100, 0], scale: [1, 1.4, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[700px] h-[700px] rounded-full blur-[120px] opacity-50"
            style={{ background: "radial-gradient(circle, rgba(236,72,153,0.7) 0%, rgba(219,39,119,0.3) 50%, transparent 70%)", right: "-15%", bottom: "-20%" }}
            animate={{ x: [0, -100, 0], y: [0, -80, 0], scale: [1.2, 0.9, 1.2] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-45"
            style={{ background: "radial-gradient(circle, rgba(251,113,133,0.8) 0%, transparent 70%)", left: "40%", top: "20%" }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(244,114,182,0.7) 0%, transparent 70%)", right: "30%", top: "60%" }}
            animate={{ scale: [1.2, 1, 1.2], x: [0, 50, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Floating hearts - multi-layer parallax effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Far layer - small, slow, faint */}
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={`far-${i}`}
              className="absolute"
              style={{
                left: `${(i * 7) % 100}%`,
                fontSize: `${0.8 + (i % 2) * 0.4}rem`,
                opacity: 0.2,
                filter: "blur(1px)"
              }}
              initial={{ y: "110vh", rotate: 0 }}
              animate={{ y: "-20vh", rotate: 180, x: [0, (i % 2 === 0 ? 10 : -10), 0] }}
              transition={{ duration: 25 + (i % 5) * 5, repeat: Infinity, ease: "linear", delay: i * 0.8 }}
            >
              {["💕", "💗", "🩷"][i % 3]}
            </motion.div>
          ))}

          {/* Mid layer - medium, moderate speed */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`mid-${i}`}
              className="absolute"
              style={{
                left: `${(i * 5) % 100}%`,
                fontSize: `${1.2 + (i % 3) * 0.5}rem`,
                filter: i % 4 === 0 ? "drop-shadow(0 0 8px rgba(236,72,153,0.6))" : "none"
              }}
              initial={{ y: "100vh", rotate: 0, opacity: 0 }}
              animate={{
                y: "-15vh",
                rotate: (i % 2 === 0 ? 360 : -360),
                opacity: [0, 0.35, 0.35, 0],
                x: [0, (i % 2 === 0 ? 20 : -20), 0],
              }}
              transition={{
                duration: 18 + (i % 6) * 3,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.4,
              }}
            >
              {["💖", "💕", "💗", "🩷", "✨", "💘", "💝"][i % 7]}
            </motion.div>
          ))}

          {/* Near layer - large, fast, bright */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`near-${i}`}
              className="absolute"
              style={{
                left: `${(i * 12 + 5) % 100}%`,
                fontSize: `${2.5 + (i % 2) * 1}rem`,
                filter: "drop-shadow(0 0 15px rgba(255,105,180,0.8))"
              }}
              initial={{ y: "105vh", rotate: 0, opacity: 0 }}
              animate={{
                y: "-10vh",
                rotate: (i % 2 === 0 ? 180 : -180),
                opacity: [0, 0.5, 0.5, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 12 + (i % 3) * 2, repeat: Infinity, ease: "linear", delay: i * 1.5 }}
            >
              {["💖", "💗", "💘", "❤️"][i % 4]}
            </motion.div>
          ))}
        </div>

        {/* Sparkle particles - enhanced */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                background: i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#fce7f3" : "#f9a8d4",
                boxShadow: `0 0 ${6 + Math.random() * 8}px ${2 + Math.random() * 3}px rgba(255,255,255,0.9)`
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 1.5 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>

        {/* Shooting stars */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={`shooting-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                boxShadow: "0 0 6px 2px white, -20px 0 15px 1px rgba(255,255,255,0.5), -40px 0 10px rgba(255,255,255,0.3)",
                top: `${10 + i * 25}%`,
                left: "-5%"
              }}
              animate={{
                x: ["0vw", "110vw"],
                y: ["0vh", `${20 + i * 10}vh`],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 8 + i * 4,
                delay: i * 3,
                ease: "easeOut"
              }}
            />
          ))}
        </div>

        {/* Premium radial glow behind cat - enhanced */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none z-0"
          style={{ background: "radial-gradient(circle, rgba(255,105,180,0.7) 0%, rgba(255,182,193,0.4) 30%, rgba(236,72,153,0.2) 50%, transparent 70%)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full pointer-events-none z-0"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 60%)" }}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Super Premium Cat with crown and enhanced effects */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 150, delay: 0.2 }}
            className="relative mb-6"
          >
            {/* Multiple glow layers behind cat */}
            <motion.div
              className="absolute inset-0 rounded-full blur-3xl"
              style={{ margin: "-40px", background: "radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />

            {/* Crown with premium glow */}
            <motion.div
              className="absolute -top-12 left-1/2 -translate-x-1/2 text-6xl z-20"
              initial={{ y: -50, opacity: 0, scale: 0 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            >
              <motion.span
                animate={{ y: [0, -10, 0], rotate: [-10, 10, -10], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ filter: "drop-shadow(0 0 20px rgba(255,215,0,0.9)) drop-shadow(0 0 40px rgba(255,215,0,0.5))" }}
              >
                👑
              </motion.span>
            </motion.div>

            {/* Animated pulse rings */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute inset-0 rounded-full border-2 border-pink-400/30"
                style={{ margin: `-${20 + i * 15}px` }}
                animate={{
                  scale: [1, 1.5],
                  opacity: [0.6, 0],
                }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
              />
            ))}

            {/* Cat with premium bounce and glow */}
            <motion.div
              animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <span
                className="text-[120px] md:text-[150px] block"
                style={{ filter: "drop-shadow(0 0 30px rgba(236,72,153,0.5)) drop-shadow(0 8px 15px rgba(0,0,0,0.2))" }}
              >
                😻
              </span>
            </motion.div>

            {/* Orbiting heart decorations - enhanced */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  filter: "drop-shadow(0 0 8px rgba(236,72,153,0.6))"
                }}
                animate={{
                  x: [Math.cos((i * Math.PI) / 3) * 80, Math.cos((i * Math.PI) / 3 + Math.PI) * 80, Math.cos((i * Math.PI) / 3) * 80],
                  y: [Math.sin((i * Math.PI) / 3) * 80, Math.sin((i * Math.PI) / 3 + Math.PI) * 80, Math.sin((i * Math.PI) / 3) * 80],
                  scale: [1, 1.4, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeInOut",
                }}
              >
                <span className="text-2xl">{["💕", "💗", "💖", "💘", "✨", "💝"][i]}</span>
              </motion.div>
            ))}

            {/* Sparkle burst around cat */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.span
                key={`cat-sparkle-${i}`}
                className="absolute text-lg"
                style={{
                  top: "50%",
                  left: "50%",
                }}
                animate={{
                  x: [0, Math.cos((i * Math.PI) / 4) * 100],
                  y: [0, Math.sin((i * Math.PI) / 4) * 100],
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  repeatDelay: 1,
                }}
              >
                ✨
              </motion.span>
            ))}
          </motion.div>

          {/* Super Premium Title with animated gradient and glow */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="text-center mb-3 relative"
          >
            {/* Title glow backdrop */}
            <motion.div
              className="absolute inset-0 blur-2xl opacity-60"
              style={{ background: "linear-gradient(90deg, rgba(236,72,153,0.5), rgba(244,63,94,0.5), rgba(239,68,68,0.5))" }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.h1
              className="text-5xl md:text-8xl font-black relative"
              style={{
                backgroundImage: "linear-gradient(135deg, #ec4899 0%, #f43f5e 20%, #ef4444 40%, #f43f5e 60%, #ec4899 80%, #db2777 100%)",
                backgroundSize: "300% auto",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                textShadow: "0 0 80px rgba(236,72,153,0.5)"
              }}
              animate={{ backgroundPosition: ["0% center", "300% center"] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              Valentine's Quest
            </motion.h1>
            {/* Sparkles on title - enhanced */}
            {[
              { pos: "-top-3 -right-6", size: "text-3xl", delay: 0 },
              { pos: "-top-1 right-16", size: "text-xl", delay: 0.3 },
              { pos: "-bottom-2 -left-6", size: "text-2xl", delay: 0.5 },
              { pos: "top-2 -left-4", size: "text-lg", delay: 0.8 },
            ].map((spark, i) => (
              <motion.span
                key={i}
                className={`absolute ${spark.pos} ${spark.size}`}
                animate={{ rotate: [0, 360], scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity, delay: spark.delay }}
                style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.8))" }}
              >
                {i % 2 === 0 ? "✨" : "💫"}
              </motion.span>
            ))}
          </motion.div>

          {/* Premium Subtitle with glassmorphism */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-3 mb-8 bg-white/20 backdrop-blur-md rounded-full px-6 py-2 border border-white/30 shadow-lg"
          >
            <motion.span
              animate={{ scale: [1, 1.4, 1], rotate: [0, 15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ filter: "drop-shadow(0 0 6px rgba(236,72,153,0.6))" }}
            >
              💖
            </motion.span>
            <p className="text-lg md:text-xl text-white font-semibold drop-shadow-md">
              A dramatic cat's journey to find love
            </p>
            <motion.span
              animate={{ scale: [1, 1.4, 1], rotate: [0, -15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              style={{ filter: "drop-shadow(0 0 6px rgba(236,72,153,0.6))" }}
            >
              💖
            </motion.span>
          </motion.div>

          {/* Super Premium Buttons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col gap-4 w-full max-w-sm"
          >
            {/* Start Game button - super premium */}
            <motion.div className="relative">
              {/* Button glow */}
              <motion.div
                className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 opacity-60 blur-xl"
                animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.button
                onClick={startGame}
                className="relative w-full py-6 px-10 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white font-bold text-2xl rounded-2xl shadow-2xl overflow-hidden border-2 border-white/20"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Animated gradient overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-pink-400 via-rose-400 to-red-400"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
                  style={{ opacity: 0.5 }}
                />
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12"
                  animate={{ x: ["-200%", "200%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
                {/* Multiple pulse rings */}
                {[0, 1].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-2xl"
                    animate={{
                      boxShadow: [
                        "0 0 0 0 rgba(255,255,255,0.4)",
                        "0 0 0 15px rgba(255,255,255,0)",
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.7 }}
                  />
                ))}
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <motion.span
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 10, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Heart className="w-7 h-7" fill="currentColor" />
                  </motion.span>
                  Start Game
                  <motion.span
                    animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                  >
                    <Heart className="w-7 h-7" fill="currentColor" />
                  </motion.span>
                </span>
              </motion.button>
            </motion.div>

            {/* Skip Intro button - super premium glassmorphism */}
            <motion.button
              onClick={() => {
                soundManager.init();
                soundManager.click();
                soundManager.whoosh();
                gameStartRef.current = now();
                setScene("chapter1_chase");
              }}
              className="w-full py-4 px-6 bg-white/30 backdrop-blur-md border-2 border-white/50 text-white font-bold rounded-xl shadow-lg relative overflow-hidden"
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.4)" }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
              <span className="relative z-10 flex items-center justify-center gap-2">
                Skip Intro
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  →
                </motion.span>
              </span>
            </motion.button>
          </motion.div>

          {/* Super Premium Features preview with glassmorphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="flex gap-4 mt-10"
          >
            {[
              { emoji: "🎮", label: "7 Mini-games", gradient: "from-indigo-500/20 to-purple-500/20", glow: "rgba(99,102,241,0.4)" },
              { emoji: "👑", label: "Boss Battle", gradient: "from-amber-500/20 to-orange-500/20", glow: "rgba(245,158,11,0.4)" },
              { emoji: "💕", label: "Romance", gradient: "from-pink-500/20 to-rose-500/20", glow: "rgba(236,72,153,0.4)" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="relative group"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.4 + i * 0.15, type: "spring" }}
              >
                {/* Card glow on hover */}
                <motion.div
                  className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-300"
                  style={{ background: item.glow }}
                />
                <motion.div
                  className={`relative flex flex-col items-center bg-gradient-to-br ${item.gradient} backdrop-blur-md rounded-2xl px-5 py-4 border border-white/30 shadow-lg`}
                  whileHover={{ y: -5, scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-4xl mb-2"
                    animate={{ y: [0, -5, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))" }}
                  >
                    {item.emoji}
                  </motion.span>
                  <span className="text-xs text-white font-bold drop-shadow-md">{item.label}</span>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Super Premium Footer with glassmorphism */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-6 flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-5 py-2 border border-white/30"
        >
          <span className="text-white text-sm font-medium drop-shadow-sm">Made with</span>
          <motion.span
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ filter: "drop-shadow(0 0 8px rgba(236,72,153,0.8))" }}
          >
            💖
          </motion.span>
          <span className="text-white text-sm font-medium drop-shadow-sm">and dramatic cat energy</span>
          <motion.span
            animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ✨
          </motion.span>
        </motion.div>
      </div>
    );
  }

  if (scene === "intro_cutscene") {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}

        {/* Super premium animated cosmic background */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 30%, #7e22ce 60%, #be185d 85%, #9d174d 100%)",
            backgroundSize: "100% 400%"
          }}
          animate={{ backgroundPosition: ["0% 0%", "0% 100%", "0% 0%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />

        {/* Animated nebula orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-[700px] h-[700px] rounded-full blur-[150px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(147,51,234,0.8) 0%, rgba(126,34,206,0.4) 50%, transparent 70%)", left: "-20%", top: "-20%" }}
            animate={{ x: [0, 100, 0], y: [0, 80, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(219,39,119,0.7) 0%, rgba(190,24,93,0.3) 50%, transparent 70%)", right: "-15%", bottom: "-10%" }}
            animate={{ x: [0, -80, 0], y: [0, -60, 0], scale: [1.2, 0.9, 1.2] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-30"
            style={{ background: "radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)", left: "50%", top: "40%", transform: "translate(-50%, -50%)" }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Premium starfield - multi-layer */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Far stars - small, dim */}
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={`star-far-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 2.5) % 100}%`,
                top: `${(i * 7.3 + 3) % 100}%`,
                width: `${1 + (i % 2)}px`,
                height: `${1 + (i % 2)}px`,
              }}
              animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.2, 1] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
          {/* Medium stars */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`star-mid-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${(i * 5 + 2) % 100}%`,
                top: `${(i * 9.7 + 5) % 100}%`,
                width: `${2 + (i % 2)}px`,
                height: `${2 + (i % 2)}px`,
                background: i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#f9a8d4" : "#c4b5fd",
                boxShadow: `0 0 ${4 + (i % 3) * 2}px ${1 + (i % 2)}px currentColor`
              }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.5, 1] }}
              transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
          {/* Bright stars with glow */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`star-bright-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 12 + 5) % 100}%`,
                top: `${(i * 15 + 10) % 100}%`,
                width: "4px",
                height: "4px",
                boxShadow: "0 0 10px 3px rgba(255,255,255,0.8), 0 0 20px 6px rgba(255,255,255,0.4)"
              }}
              animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.8, 1] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        {/* Shooting stars */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`shooting-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                boxShadow: "0 0 4px 2px white, -30px 0 20px 2px rgba(255,255,255,0.5), -60px 0 15px rgba(255,255,255,0.3), -90px 0 10px rgba(255,255,255,0.1)",
                top: `${5 + i * 20}%`,
                left: "-5%"
              }}
              animate={{
                x: ["0vw", "120vw"],
                y: ["0vh", `${15 + i * 8}vh`],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 6 + i * 3,
                delay: i * 2,
                ease: "easeOut"
              }}
            />
          ))}
        </div>

        {/* Floating sparkles and cosmic dust */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute"
              style={{
                left: `${(i * 7) % 100}%`,
                fontSize: `${1 + (i % 3) * 0.5}rem`,
                filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))"
              }}
              initial={{ y: "110vh", opacity: 0 }}
              animate={{ y: "-10vh", opacity: [0, 0.5, 0.5, 0], rotate: [0, 360] }}
              transition={{ duration: 20 + (i % 5) * 3, repeat: Infinity, ease: "linear", delay: i * 1.2 }}
            >
              {["✨", "⭐", "💫", "🌟", "💜"][i % 5]}
            </motion.div>
          ))}
        </div>

        {/* Premium progress indicator with glow */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-3 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
          {INTRO_DIALOG.map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                i === dialogIndex ? "bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.8)]" : i < dialogIndex ? "bg-pink-500" : "bg-white/30"
              )}
              animate={i === dialogIndex ? { scale: [1, 1.4, 1], boxShadow: ["0 0 5px rgba(244,114,182,0.5)", "0 0 15px rgba(244,114,182,1)", "0 0 5px rgba(244,114,182,0.5)"] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ))}
        </div>

        {/* Dialog content */}
        <AnimatePresence mode="wait">
          <DialogBox key={dialogIndex} line={INTRO_DIALOG[dialogIndex]} onNext={advanceDialog} />
        </AnimatePresence>

        {/* Super premium skip button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          onClick={() => {
            soundManager.whoosh();
            nextScene("chapter1_chase");
          }}
          className="absolute bottom-6 right-6 bg-white/10 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 text-white/70 hover:text-white hover:bg-white/20 text-sm font-medium transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="flex items-center gap-2">
            Skip
            <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}>→</motion.span>
          </span>
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

        {/* Premium animated background with multiple layers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Floating hearts layer */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              style={{
                left: `${(i * 8) % 100}%`,
                opacity: 0.15 + (i % 3) * 0.05,
              }}
              initial={{ y: "100vh", rotate: 0 }}
              animate={{
                y: "-20vh",
                rotate: 360,
                x: [0, (i % 2 === 0 ? 20 : -20), 0],
              }}
              transition={{
                y: { duration: 15 + (i % 5) * 3, repeat: Infinity, ease: "linear" },
                rotate: { duration: 10 + (i % 3) * 2, repeat: Infinity, ease: "linear" },
                x: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                delay: i * 0.8,
              }}
            >
              {["💕", "🌸", "✨", "💗", "🩷", "💖"][i % 6]}
            </motion.div>
          ))}

          {/* Soft gradient orbs */}
          <motion.div
            className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-pink-300/30 to-rose-300/30 blur-3xl"
            style={{ top: "10%", left: "-10%" }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-rose-300/30 to-pink-300/30 blur-3xl"
            style={{ bottom: "10%", right: "-10%" }}
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          />

          {/* Sparkle particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        {/* Skip button - premium style */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={() => {
            soundManager.whoosh();
            setCatMessage("Fine! Prove your love through CHALLENGES! 😼");
            setTimeout(() => nextScene("chapter1_catch_no"), 500);
          }}
          className="absolute top-4 right-4 z-20 bg-white/40 hover:bg-white/60 backdrop-blur-md rounded-full px-4 py-2 text-pink-600 text-sm font-medium transition-all hover:scale-105 border border-white/50 shadow-lg"
        >
          Skip to Games →
        </motion.button>

        {/* Main card with premium glass effect */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="max-w-md w-full relative z-10"
        >
          {/* Card glow effect */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-pink-400/30 via-rose-400/30 to-red-400/30 blur-2xl"
            animate={{
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.02, 1],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-[0_25px_80px_-15px_rgba(236,72,153,0.4)] border border-pink-200/50 relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
            <div className="text-center relative">
              {/* Cat with premium interaction */}
              <motion.div
                className="mb-6 relative inline-block cursor-pointer"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={petCat}
              >
                {/* Multi-layered glow effect based on mood */}
                <motion.div
                  className="absolute inset-0 rounded-full blur-3xl -z-10"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: catMood === "love" ? [0.5, 0.8, 0.5] : [0.2, 0.4, 0.2],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    background: catMood === "angry" || catMood === "sad"
                      ? "radial-gradient(circle, rgba(239,68,68,0.5) 0%, transparent 70%)"
                      : catMood === "love"
                      ? "radial-gradient(circle, rgba(255,105,180,0.7) 0%, rgba(255,182,193,0.3) 50%, transparent 70%)"
                      : "radial-gradient(circle, rgba(255,182,193,0.6) 0%, transparent 70%)"
                  }}
                />
                {/* Inner glow ring */}
                <motion.div
                  className="absolute inset-2 rounded-full border-2 border-pink-300/30"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  animate={
                    catMood === "love"
                      ? { y: [0, -8, 0], rotate: [-5, 5, -5], scale: [1, 1.05, 1] }
                      : catMood === "angry" || catMood === "sad"
                      ? { y: [0, -2, 0], rotate: [0, -3, 3, 0] }
                      : { y: [0, -5, 0] }
                  }
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="text-[80px] md:text-[100px] block drop-shadow-lg">{CAT_EMOTIONS[catMood]}</span>
                </motion.div>
                {/* Love hearts floating around when in love mood */}
                {catMood === "love" && (
                  <>
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="absolute text-lg pointer-events-none"
                        style={{ top: "20%", left: `${30 + i * 20}%` }}
                        initial={{ opacity: 0, y: 0, scale: 0 }}
                        animate={{
                          opacity: [0, 1, 0],
                          y: -40,
                          scale: [0, 1.2, 0],
                          x: (i - 1) * 15,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.3,
                        }}
                      >
                        💖
                      </motion.span>
                    ))}
                  </>
                )}
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs text-pink-500 mt-2 font-medium"
                >
                  ✨ tap to pet! ✨
                </motion.p>
              </motion.div>

              {/* Title with premium gradient animation */}
              <motion.h1
                className="text-3xl md:text-4xl font-black mb-4 relative"
                animate={stats.noCount >= 2 ? { x: [0, -3, 3, 0] } : {}}
                transition={{ duration: 0.4, repeat: stats.noCount >= 2 ? Infinity : 0 }}
              >
                <motion.span
                  className="bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 bg-clip-text text-transparent bg-[length:200%_auto]"
                  animate={{ backgroundPosition: ["0% center", "100% center", "0% center"] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                >
                  Will you be my Valentine?
                </motion.span>
                {/* Subtle sparkle on title */}
                <motion.span
                  className="absolute -top-1 -right-1 text-sm"
                  animate={{ rotate: [0, 15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ✨
                </motion.span>
              </motion.h1>

              {/* Cat message with premium speech bubble */}
              <div className="h-[44px] mb-6">
                <AnimatePresence mode="wait">
                  {catMessage && (
                    <motion.div
                      key={catMessage}
                      initial={{ opacity: 0, y: 15, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -15, scale: 0.8 }}
                      className="relative"
                    >
                      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl px-4 py-2 border border-pink-200/50 shadow-sm">
                        <p className="text-base text-slate-700 font-medium">
                          {catMessage}
                        </p>
                      </div>
                      {/* Speech bubble tail */}
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-pink-50 to-rose-50 border-l border-t border-pink-200/50 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Premium Buttons */}
              <div className="flex flex-col gap-4">
                {/* Yes button - premium with pulse glow */}
                <motion.button
                  onClick={handleYes}
                  className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white font-bold text-lg rounded-2xl shadow-[0_10px_40px_-10px_rgba(236,72,153,0.5)] relative overflow-hidden group"
                  whileHover={{ scale: 1.03, boxShadow: "0 15px 50px -10px rgba(236,72,153,0.6)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  {/* Animated shimmer */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                  />
                  {/* Pulse ring effect */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    animate={{
                      boxShadow: [
                        "0 0 0 0 rgba(236,72,153,0.4)",
                        "0 0 0 10px rgba(236,72,153,0)",
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Heart className="w-5 h-5" />
                    </motion.span>
                    Yes! 💖
                  </span>
                </motion.button>

                {/* No button with dramatic animations based on count */}
                <motion.div
                  animate={
                    stats.noCount === 0 ? {} :
                    stats.noCount === 1 ? { x: [0, -20, 20, -10, 10, 0] } :
                    stats.noCount === 2 ? { scale: [1, 0.8, 1.1, 0.9, 1], rotate: [0, 10, -10, 5, -5, 0] } :
                    { opacity: 0.2, scale: 0.9, filter: "grayscale(1)" }
                  }
                  transition={{ duration: 0.5 }}
                >
                  <button
                    className={cn(
                      "w-full py-3 px-6 border-2 font-semibold rounded-xl transition-all relative overflow-hidden",
                      stats.noCount >= 3
                        ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
                        : stats.noCount >= 2
                        ? "border-red-400 text-red-600 hover:bg-red-50 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                        : "border-pink-200 text-slate-600 hover:bg-pink-50 hover:border-pink-300"
                    )}
                    onClick={() => {
                      if (stats.noCount >= 3) return;
                      soundManager.click();
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
                    {stats.noCount >= 3 && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-slate-100/50 via-slate-200/50 to-slate-100/50"
                        style={{ backgroundSize: "200% 100%" }}
                        animate={{ backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    )}
                    <span className="relative">
                      {stats.noCount === 0 && "No 😅"}
                      {stats.noCount === 1 && "Still no... 😬"}
                      {stats.noCount === 2 && "I said NO! 😤"}
                      {stats.noCount >= 3 && "💔 Button broken 💔"}
                    </span>
                  </button>
                </motion.div>
              </div>

              {/* Premium Progress indicator */}
              {stats.noCount > 0 && stats.noCount < 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5"
                >
                  <div className="bg-gradient-to-r from-pink-50/80 to-rose-50/80 rounded-2xl p-3 border border-pink-200/30">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className={cn(
                            "w-3 h-3 rounded-full transition-all duration-300",
                            i <= stats.noCount
                              ? "bg-gradient-to-r from-red-400 to-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                              : "bg-slate-200"
                          )}
                          animate={i <= stats.noCount ? { scale: [1, 1.4, 1] } : {}}
                          transition={{ duration: 0.5, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                    <motion.p
                      className="text-sm text-slate-600 font-medium text-center"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {stats.noCount === 1 && "⚠️ The cat's getting upset..."}
                      {stats.noCount === 2 && "🚨 One more and there'll be consequences!"}
                    </motion.p>
                  </div>
                </motion.div>
              )}

              {/* Premium Pet counter */}
              {stats.petCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4"
                >
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-100 to-rose-100 rounded-full px-4 py-2 border border-pink-200/50">
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                    >
                      💕
                    </motion.span>
                    <span className="text-sm font-medium text-pink-600">
                      {stats.petCount} pet{stats.petCount !== 1 && "s"} given
                    </span>
                    {stats.petCount >= 5 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs"
                      >
                        ✨
                      </motion.span>
                    )}
                  </div>
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
    return <RejectLettersGame onComplete={(score) => { setStats(s => ({ ...s, totalScore: s.totalScore + score })); nextScene("chapter3_rhythm"); }} />;
  }

  if (scene === "chapter3_rhythm") {
    return <RhythmHeartBeatGame onComplete={(score) => {
      setStats(s => ({ ...s, totalScore: s.totalScore + score }));
      if (score >= 2000) unlockAchievement("rhythm_master");
      nextScene("chapter3_puzzle");
    }} />;
  }

  if (scene === "chapter3_puzzle") {
    return <LoveLetterPuzzleGame onComplete={(score) => {
      setStats(s => ({ ...s, totalScore: s.totalScore + score }));
      if (score >= 1500) unlockAchievement("puzzle_solver");
      nextScene("chapter3_gallery");
    }} />;
  }

  if (scene === "chapter3_gallery") {
    return <CupidsArrowGame onComplete={(score) => {
      setStats(s => ({ ...s, totalScore: s.totalScore + score }));
      nextScene("chapter3_boss_battle");
    }} />;
  }

  if (scene === "chapter3_boss_battle") {
    return <DramaKingBattle onComplete={(won) => { if (won) { nextScene("chapter3_final"); } else { setCatMessage("You can't defeat my LOVE! 😼 Try again!"); setScene("chapter3_gallery"); } }} />;
  }

  if (scene === "chapter3_final") {
    return <FinalProposalScene onYes={handleYes} stats={stats} />;
  }

  if (scene === "ending_good") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-pink-300 via-rose-400 to-pink-500 flex items-center justify-center p-4 overflow-hidden">
        {SoundToggleButton}

        {/* Premium animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-50"
            style={{ background: "radial-gradient(circle, rgba(255,182,193,0.9) 0%, rgba(255,105,180,0.4) 50%, transparent 70%)", left: "-10%", top: "10%" }}
            animate={{ x: [0, 80, 0], y: [0, -40, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(255,20,147,0.7) 0%, rgba(219,112,147,0.3) 50%, transparent 70%)", right: "-5%", bottom: "5%" }}
            animate={{ x: [0, -60, 0], y: [0, 40, 0], scale: [1.2, 0.9, 1.2] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Floating hearts - enhanced */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 25 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${(i * 9) % 100}%`,
                fontSize: `${1.5 + (i % 3) * 0.7}rem`,
                filter: i % 4 === 0 ? "drop-shadow(0 0 10px rgba(255,105,180,0.8))" : "none"
              }}
              initial={{ y: "100vh", opacity: 0, rotate: 0 }}
              animate={{
                y: "-100vh",
                opacity: [0, 0.5, 0.5, 0],
                rotate: [0, (i % 2 === 0 ? 180 : -180)],
                x: [0, (i % 2 === 0 ? 15 : -15), 0]
              }}
              transition={{ duration: 8 + (i % 4) * 2, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
            >
              {["💖", "💕", "💗", "✨", "🎉", "💝", "🌸"][i % 7]}
            </motion.div>
          ))}
        </div>

        {/* Sparkle particles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute w-1.5 h-1.5 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                boxShadow: "0 0 8px 3px rgba(255,255,255,0.9)"
              }}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="max-w-md w-full relative z-10"
        >
          {/* Premium card glow */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-pink-400 via-rose-500 to-red-400 opacity-60 blur-2xl"
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.98, 1.02, 0.98] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Main card */}
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-2 border-pink-200 text-center overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-100/60 to-transparent -skew-x-12"
              animate={{ x: ["-200%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />

            {/* Cat celebration */}
            <motion.div
              className="relative inline-block mb-4"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.div
                className="absolute inset-0 blur-3xl rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,182,193,0.9) 0%, transparent 70%)" }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.span
                className="text-[100px] relative z-10 block"
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ filter: "drop-shadow(0 0 20px rgba(255,105,180,0.6))" }}
              >
                😻
              </motion.span>
              {/* Orbiting hearts */}
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  style={{ left: "50%", top: "50%" }}
                  animate={{
                    x: [Math.cos(i * 2.1) * 60, Math.cos(i * 2.1 + Math.PI) * 60, Math.cos(i * 2.1) * 60],
                    y: [Math.sin(i * 2.1) * 60, Math.sin(i * 2.1 + Math.PI) * 60, Math.sin(i * 2.1) * 60],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                >
                  💕
                </motion.span>
              ))}
            </motion.div>

            <motion.h1
              className="text-4xl font-black mb-2 relative z-10"
              style={{
                backgroundImage: "linear-gradient(135deg, #ec4899 0%, #f43f5e 30%, #ef4444 50%, #f43f5e 70%, #ec4899 100%)",
                backgroundSize: "200% auto",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent"
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, backgroundPosition: ["0% center", "200% center"] }}
              transition={{ delay: 0.4, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
            >
              YAYYY! 💖
            </motion.h1>

            <motion.p
              className="text-xl text-slate-600 mb-6 relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              You are now officially my Valentine!
            </motion.p>

            {/* Stats - premium styled */}
            <motion.div
              className="grid grid-cols-2 gap-3 mb-6 relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              {[
                { icon: "🎮", label: "Score", value: stats.totalScore, bg: "from-pink-100 to-pink-50", color: "text-pink-600" },
                { icon: "🐱", label: "Cat Pets", value: stats.petCount, bg: "from-rose-100 to-rose-50", color: "text-rose-600" },
                { icon: "⏱️", label: "Time", value: `${Math.round(stats.yesTime / 1000)}s`, bg: "from-red-100 to-red-50", color: "text-red-500" },
                { icon: "💬", label: "Said No", value: `${stats.noCount}x`, bg: "from-purple-100 to-purple-50", color: "text-purple-600" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  className={`bg-gradient-to-br ${stat.bg} rounded-xl p-3 border border-white/50 shadow-sm`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -2 }}
                >
                  <div className="text-2xl">{stat.icon}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Message */}
            <motion.div
              className="relative mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-3 border border-pink-100">
                <p className="text-sm text-pink-600 italic relative z-10">
                  "Thank you for going on this adventure with me! 💕" — The Cat
                </p>
              </div>
            </motion.div>

            {/* Buttons - premium styled */}
            <motion.div
              className="flex gap-3 justify-center relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <motion.button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-white border-2 border-pink-200 text-pink-600 font-semibold rounded-xl shadow-sm hover:bg-pink-50 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Play Again 🔄
              </motion.button>
              <motion.button
                onClick={() => setScene("title")}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold rounded-xl shadow-lg relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
                <span className="relative z-10">Title Screen 🏠</span>
              </motion.button>
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

        {/* Premium animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-50"
            style={{ background: "radial-gradient(circle, rgba(255,215,0,0.9) 0%, rgba(255,165,0,0.5) 50%, transparent 70%)", left: "-15%", top: "5%" }}
            animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-45"
            style={{ background: "radial-gradient(circle, rgba(255,193,7,0.8) 0%, rgba(255,152,0,0.4) 50%, transparent 70%)", right: "-10%", bottom: "0%" }}
            animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1.2, 0.9, 1.2] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[350px] h-[350px] rounded-full blur-[80px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(255,235,59,0.8) 0%, transparent 70%)", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Floating stars and crowns - enhanced */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${(i * 8) % 100}%`,
                fontSize: `${1.5 + (i % 3) * 0.8}rem`,
                filter: i % 3 === 0 ? "drop-shadow(0 0 12px rgba(255,215,0,0.9))" : "none"
              }}
              initial={{ y: "100vh", opacity: 0, rotate: 0 }}
              animate={{
                y: "-100vh",
                opacity: [0, 0.6, 0.6, 0],
                rotate: [0, 360],
                x: [0, (i % 2 === 0 ? 20 : -20), 0]
              }}
              transition={{ duration: 7 + (i % 4) * 2, repeat: Infinity, delay: i * 0.25, ease: "linear" }}
            >
              {["⭐", "✨", "👑", "🏆", "💫", "🌟", "💛"][i % 7]}
            </motion.div>
          ))}
        </div>

        {/* Confetti particles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={`confetti-${i}`}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                background: ["#FFD700", "#FFA500", "#FF6347", "#FFB6C1", "#87CEEB", "#98FB98"][i % 6],
                borderRadius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0"
              }}
              initial={{ y: "-10vh", opacity: 1, rotate: 0 }}
              animate={{
                y: "110vh",
                opacity: [1, 1, 0],
                rotate: [0, 720],
                x: [0, (i % 2 === 0 ? 50 : -50), 0]
              }}
              transition={{
                duration: 5 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 5,
                ease: "linear"
              }}
            />
          ))}
        </div>

        {/* Golden sparkles - enhanced */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 25 }).map((_, i) => (
            <motion.div
              key={`spark-${i}`}
              className="absolute w-2 h-2 bg-yellow-300 rounded-full"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                boxShadow: "0 0 10px 4px rgba(255,215,0,0.8)"
              }}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="max-w-md w-full relative z-10"
        >
          {/* Premium golden card glow */}
          <motion.div
            className="absolute -inset-4 rounded-[2rem] opacity-70 blur-2xl"
            style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24, #f59e0b)" }}
            animate={{ opacity: [0.5, 0.8, 0.5], scale: [0.98, 1.02, 0.98] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Main card */}
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-4 border-amber-400 text-center overflow-hidden">
            {/* Golden shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/60 to-transparent -skew-x-12"
              animate={{ x: ["-200%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            />

            {/* Crown and cat - premium */}
            <motion.div
              className="relative inline-block mb-4"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Animated glow behind cat */}
              <motion.div
                className="absolute inset-0 blur-3xl rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,165,0,0.4) 50%, transparent 70%)" }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Crown with glow */}
              <motion.div
                className="absolute -top-10 left-1/2 -translate-x-1/2 text-6xl z-20"
                animate={{ rotate: [-5, 5, -5], y: [0, -8, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ filter: "drop-shadow(0 0 15px rgba(255,215,0,1))" }}
              >
                👑
              </motion.div>

              <motion.span
                className="text-[110px] relative z-10 block"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ filter: "drop-shadow(0 0 25px rgba(255,215,0,0.7))" }}
              >
                😻
              </motion.span>

              {/* Orbiting stars */}
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="absolute text-xl"
                  style={{ left: "50%", top: "50%" }}
                  animate={{
                    x: [Math.cos(i * 1.57) * 70, Math.cos(i * 1.57 + Math.PI) * 70, Math.cos(i * 1.57) * 70],
                    y: [Math.sin(i * 1.57) * 70, Math.sin(i * 1.57 + Math.PI) * 70, Math.sin(i * 1.57) * 70],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                >
                  ⭐
                </motion.span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative z-10"
            >
              <motion.h1
                className="text-4xl md:text-5xl font-black mb-2"
                style={{
                  backgroundImage: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #fcd34d 50%, #f59e0b 75%, #fbbf24 100%)",
                  backgroundSize: "200% auto",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent"
                }}
                animate={{ backgroundPosition: ["0% center", "200% center"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                PERFECT ENDING! 🏆
              </motion.h1>

              <motion.div
                className="flex justify-center gap-2 mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                {["⭐", "⭐", "⭐", "⭐", "⭐"].map((s, i) => (
                  <motion.span
                    key={i}
                    className="text-3xl"
                    animate={{ scale: [1, 1.4, 1], rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity, repeatDelay: 1.5 }}
                    style={{ filter: "drop-shadow(0 0 8px rgba(255,215,0,0.8))" }}
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

            <motion.div
              className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-3 mb-6 border border-amber-200 relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <p className="text-lg text-amber-700 font-medium">
                Never said no, always gave pets... <br />
                You're the ULTIMATE Valentine! 👑
              </p>
            </motion.div>

            {/* Stats in gold theme - premium */}
            <motion.div
              className="grid grid-cols-3 gap-2 mb-6 relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              {[
                { icon: "🎮", value: stats.totalScore, label: "Score" },
                { icon: "🐱", value: stats.petCount, label: "Pets" },
                { icon: "⏱️", value: `${Math.round(stats.yesTime / 1000)}s`, label: "Time" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl p-3 border-2 border-amber-300 shadow-sm"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.2 + i * 0.15, type: "spring" }}
                  whileHover={{ scale: 1.08, y: -3 }}
                >
                  <div className="text-2xl">{stat.icon}</div>
                  <div className="text-xl font-bold text-amber-600">{stat.value}</div>
                  <div className="text-xs text-amber-500 font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Buttons - premium */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="relative z-10 space-y-3"
            >
              <motion.button
                onClick={() => window.location.reload()}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-white font-bold text-lg rounded-2xl shadow-lg relative overflow-hidden"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ boxShadow: "0 4px 20px rgba(251, 191, 36, 0.5)" }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.6 }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Play Again
                  <Trophy className="w-5 h-5" />
                </span>
              </motion.button>
              <motion.button
                onClick={() => setScene("title")}
                className="w-full py-2.5 px-6 bg-white border-2 border-amber-300 text-amber-600 font-semibold rounded-xl hover:bg-amber-50 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Title Screen 🏠
              </motion.button>
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
