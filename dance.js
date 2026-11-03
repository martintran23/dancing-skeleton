const BPM = 100;
const BEAT = 60 / BPM;
const NAMES = {
  groove: "Boogie",
  shuffle: "Shuffle",
  robot: "Robot",
  wave: "Wave",
};
const ORDER = ["groove", "shuffle", "robot", "wave"];

const now = document.querySelector("#now");
const stage = document.querySelector("#stage");
const soundButton = document.querySelector("#sound");
const pauseButton = document.querySelector("#pause");
const headLook = document.querySelector("#headLook");

let audioCtx = null;
let master = null;
let noise = null;
let timer = null;
let nextNote = 0;
let stepIndex = 0;
let soundOn = false;
let paused = false;

document.documentElement.style.setProperty("--beat", `${BEAT}s`);

function fit() {
  const scale = Math.min((innerHeight - 148) / 720, (innerWidth - 16) / 560, 1.15);
  document.documentElement.style.setProperty("--scale", Math.max(0.34, scale).toFixed(3));
}

function restartMotion() {
  document.body.classList.add("is-reset");
  void document.body.offsetWidth;
  document.body.classList.remove("is-reset");
}

function setDance(name) {
  document.body.dataset.dance = name;
  now.textContent = `Now playing · ${NAMES[name]}`;
  document.querySelectorAll(".dances button").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.dance === name ? "true" : "false");
  });
  restartMotion();
  if (soundOn && audioCtx) nextNote = audioCtx.currentTime + 0.06;
}

function setPaused(next) {
  paused = next;
  document.body.classList.toggle("is-paused", paused);
  pauseButton.textContent = paused ? "Play" : "Pause";
  pauseButton.setAttribute("aria-pressed", paused ? "true" : "false");
  if (!audioCtx) return;
  if (paused) {
    audioCtx.suspend();
    window.clearTimeout(timer);
  } else if (soundOn) {
    audioCtx.resume();
    nextNote = audioCtx.currentTime + 0.06;
    schedule();
  }
}

function env(time, duration, peak) {
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  gain.connect(master);
  return gain;
}

function kick(time) {
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(168, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);
  osc.connect(env(time, 0.2, 0.85));
  osc.start(time);
  osc.stop(time + 0.22);
}

function snare(time) {
  const src = audioCtx.createBufferSource();
  src.buffer = noise;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1400;
  src.connect(filter);
  filter.connect(env(time, 0.12, 0.35));
  src.start(time);
  src.stop(time + 0.14);

  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(190, time);
  osc.connect(env(time, 0.08, 0.2));
  osc.start(time);
  osc.stop(time + 0.1);
}

function hat(time) {
  const src = audioCtx.createBufferSource();
  src.buffer = noise;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  src.connect(filter);
  filter.connect(env(time, 0.04, 0.16));
  src.start(time);
  src.stop(time + 0.05);
}

function bass(time, freq) {
  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(env(time, 0.22, 0.28));
  osc.start(time);
  osc.stop(time + 0.24);
}

const BASS = {
  groove: [55, 0, 55, 0, 49, 0, 41.2, 55],
  shuffle: [55, 0, 55, 73.4],
  robot: [55, 0, 55, 0, 41.2, 0, 49, 0],
  wave: [55, 0, 0, 0, 49, 0, 0, 41.2],
};

function playStep(step, time) {
  const dance = document.body.dataset.dance;
  const cycle = dance === "shuffle" ? 4 : 8;
  const beat = step % cycle;
  hat(time);

  if (dance === "robot") {
    if (beat % 2 === 0) kick(time);
    if (beat === 2 || beat === 6) snare(time);
  } else if (dance === "wave") {
    if (beat === 0 || beat === 7) kick(time);
    if (beat === 4) snare(time);
  } else if (dance === "shuffle") {
    if (beat === 0 || beat === 2) kick(time);
    if (beat === 2) snare(time);
  } else {
    if (beat === 0 || beat === 4 || beat === 7) kick(time);
    if (beat === 2 || beat === 6) snare(time);
  }

  const notes = BASS[dance];
  if (notes[beat]) bass(time, notes[beat]);
}

function schedule() {
  if (!soundOn || paused) return;
  while (nextNote < audioCtx.currentTime + 0.25) {
    playStep(stepIndex, nextNote);
    stepIndex += 1;
    nextNote += BEAT;
  }
  timer = window.setTimeout(schedule, 60);
}

function ensureAudio() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx();
  master = audioCtx.createGain();
  master.gain.value = 0.22;
  master.connect(audioCtx.destination);
  const length = Math.floor(audioCtx.sampleRate * 0.4);
  noise = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
}

async function setSound(next) {
  soundOn = next;
  soundButton.textContent = soundOn ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
  if (!soundOn) {
    window.clearTimeout(timer);
    if (audioCtx) await audioCtx.suspend();
    return;
  }
  ensureAudio();
  await audioCtx.resume();
  restartMotion();
  stepIndex = 0;
  nextNote = audioCtx.currentTime + 0.06;
  schedule();
}

document.querySelectorAll(".dances button").forEach((button) => {
  button.addEventListener("click", () => setDance(button.dataset.dance));
});

stage.addEventListener("click", () => {
  const current = ORDER.indexOf(document.body.dataset.dance);
  setDance(ORDER[(current + 1) % ORDER.length]);
});

soundButton.addEventListener("click", () => setSound(!soundOn));
pauseButton.addEventListener("click", () => setPaused(!paused));

window.addEventListener("resize", fit);

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key >= "1" && event.key <= "4") setDance(ORDER[Number(event.key) - 1]);
  if (event.key === "m" || event.key === "M") setSound(!soundOn);
  if (event.key === " " && event.target === document.body) {
    event.preventDefault();
    setPaused(!paused);
  }
});

window.addEventListener("pointermove", (event) => {
  if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = headLook.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height * 0.45);
  const turn = Math.max(-14, Math.min(14, dx / 28));
  const nod = Math.max(-8, Math.min(10, dy / 36));
  headLook.style.transform = `rotate(${turn}deg) translateY(${nod * 0.3}px)`;
});

document.addEventListener("visibilitychange", () => {
  if (!audioCtx || !soundOn) return;
  if (document.hidden) {
    window.clearTimeout(timer);
    audioCtx.suspend();
  } else if (!paused) {
    audioCtx.resume();
    nextNote = audioCtx.currentTime + 0.06;
    schedule();
  }
});
