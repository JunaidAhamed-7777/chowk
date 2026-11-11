interface Engine {
  context: AudioContext;
  master: GainNode;
  siren: OscillatorNode;
  sirenLevel: GainNode;
  sirenLfo: OscillatorNode;
  ambient: AudioBufferSourceNode;
  previousTone: number;
  ambulance: boolean;
}

let engine: Engine | undefined;
let enabled = false;
let visible = false;

function createAudio(): Engine {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const samples = noise.getChannelData(0);
  let random = 0x47b3cc05;
  let filtered = 0;
  for (let index = 0; index < samples.length; index++) {
    random = (Math.imul(1664525, random) + 1013904223) >>> 0;
    const sample = random / 0x1_0000_0000 - 0.5;
    filtered = filtered * 0.987 + sample * 0.06;
    samples[index] = filtered;
  }
  const ambient = context.createBufferSource();
  ambient.buffer = noise;
  ambient.loop = true;
  const ambientLevel = context.createGain();
  ambientLevel.gain.value = 0.2;
  ambient.connect(ambientLevel).connect(master);
  ambient.start();

  const siren = context.createOscillator();
  siren.type = "sine";
  siren.frequency.value = 600;
  const sirenLevel = context.createGain();
  sirenLevel.gain.value = 0;
  siren.connect(sirenLevel).connect(master);
  const sirenLfo = context.createOscillator();
  sirenLfo.frequency.value = 0.8;
  const pitch = context.createGain();
  pitch.gain.value = 160;
  sirenLfo.connect(pitch).connect(siren.frequency);
  siren.start();
  sirenLfo.start();
  return {
    context,
    master,
    siren,
    sirenLevel,
    sirenLfo,
    ambient,
    previousTone: -Infinity,
    ambulance: false,
  };
}

function updateVolume() {
  if (!engine) return;
  const time = engine.context.currentTime;
  engine.master.gain.setTargetAtTime(enabled && visible ? 0.42 : 0, time, 0.065);
}

export async function setTrafficSoundEnabled(next: boolean) {
  try {
    if (next) {
      engine ??= createAudio();
      await engine.context.resume();
    }
    enabled = next;
    updateVolume();
    return enabled;
  } catch {
    enabled = false;
    updateVolume();
    return false;
  }
}

export function setTrafficSoundVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  updateVolume();
}

export function setTrafficSiren(active: boolean) {
  if (!engine || engine.ambulance === active) return;
  engine.ambulance = active;
  engine.sirenLevel.gain.setTargetAtTime(active ? 0.024 : 0, engine.context.currentTime, 0.14);
}

export function soundSignal() {
  if (!engine || !enabled || !visible) return;
  const { context, master } = engine;
  const time = context.currentTime;
  if (time - engine.previousTone < 0.7) return;
  engine.previousTone = time;
  const tone = context.createOscillator();
  const volume = context.createGain();
  tone.frequency.value = 520;
  volume.gain.setValueAtTime(0, time);
  volume.gain.linearRampToValueAtTime(0.022, time + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  tone.connect(volume).connect(master);
  tone.start(time);
  tone.stop(time + 0.14);
}
