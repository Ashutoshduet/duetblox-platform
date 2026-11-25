// A quiet, locally synthesized chime. It never requests a microphone or network.
export function createCelebrationAudio(getConstructor = () => globalThis.AudioContext || globalThis.webkitAudioContext) {
  let context = null, enabled = false, nodes = [], generation = 0;
  const stop = () => {
    generation++;
    for (const node of nodes) {try {node.stop();} catch {} try {node.disconnect();} catch {}}
    nodes = [];
  };
  return {
    async enable() {
      enabled = true;
      try {
        const Constructor = getConstructor();
        if (!Constructor) return false;
        if (!context || context.state === 'closed') context = new Constructor();
        await context.resume();
        return context.state === 'running';
      } catch {return false;}
    },
    disable() {enabled = false; stop();},
    stop,
    play() {
      if (!enabled || !context || context.state !== 'running') return false;
      stop(); const current = generation;
      try {
        for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
          const oscillator = context.createOscillator(), gain = context.createGain();
          const start = context.currentTime + index * .10;
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.035, start + .012);
          gain.gain.exponentialRampToValueAtTime(.0001, start + .20);
          oscillator.connect(gain); gain.connect(context.destination); nodes.push(oscillator);
          oscillator.onended = () => {oscillator.disconnect(); gain.disconnect(); if (generation === current) nodes = nodes.filter(node => node !== oscillator);};
          oscillator.start(start); oscillator.stop(start + .22);
        }
        return true;
      } catch {stop(); return false;}
    },
    dispose() {enabled = false; stop(); if (context) {context.close().catch(() => {}); context = null;}}
  };
}
