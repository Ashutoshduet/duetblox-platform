// Original DUETBlox Zuni geometry, adapted from celebrations/Mascot.jsx.
// Static, self-contained SVG costumes work in both Scratch's asset storage and
// Junior's importer. No React, CSS variables, animation, or external assets.
const palette = Object.freeze({
  shell: '#B99BDA', accent: '#A4DBCE', face: '#FFF5E4', ear: '#F4B995',
  ink: '#54345F', blush: '#F2B9AE', mouth: '#D7799C'
});
const p = palette;
const group = (content, transform = '') => `<g${transform ? ` transform="${transform}"` : ''}>${content}</g>`;

const tail = `
  <path d="M99 183c-24 15-48 9-56-14-8-20-1-46-19-56 29-5 47 9 51 30 2 11 12 11 24 18Z" fill="${p.shell}"/>
  <path d="M43 169c-5-12-5-24-7-35 12-1 25 3 38 12 4 11 14 8 25 15v13c-21 10-40 9-56-5Z" fill="${p.accent}"/>
  <path d="M36 134c-2-9-5-15-12-21 22-4 38 4 46 18-11 0-23 0-34 3Z" fill="${p.face}"/>`;
const leftLeg = `
  <path d="m99 179-4 24 22 2 3-26Z" fill="${p.accent}"/>
  <path d="M97 200c-10 1-15 8-15 15 9 5 25 6 36 1v-14Z" fill="${p.shell}"/>
  <path d="M90 214c6-8 18-8 27-4v6c-9 4-19 4-27-2Z" fill="${p.face}" stroke="none"/>`;
const rightLeg = `
  <path d="m136 178 3 26 21-3-3-24Z" fill="${p.accent}"/>
  <path d="M141 200v17c12 3 25 2 34-3-1-9-8-14-17-15Z" fill="${p.shell}"/>
  <path d="M143 210c9-5 20-4 25 4-8 3-17 4-25 2Z" fill="${p.face}" stroke="none"/>`;
const torso = `
  <path d="M104 125c-17 11-21 39-13 59 19 12 48 12 68-2 6-24-4-47-19-57Z" fill="${p.shell}"/>
  <path d="M111 136c-11 10-14 27-10 42 14 8 33 7 46-1 3-17-2-31-13-41Z" fill="${p.face}"/>
  <rect x="112" y="147" width="18" height="18" rx="5" fill="#8BD5C3" stroke-width="2.3"/>
  <rect x="126" y="158" width="15" height="15" rx="4" fill="#F3B67C" stroke-width="2.3"/>`;
const leftArm = `
  <path d="M96 138c-5 9-13 13-20 20l10 14c13-6 21-15 23-24Z" fill="${p.shell}"/>
  <circle cx="99" cy="139" r="10" fill="${p.accent}"/>
  <path d="M78 156c-6-3-12 0-13 6-7-3-11 4-6 9-1 8 5 13 11 9 5 5 11 1 12-5 8-2 8-9 1-11Z" fill="${p.face}"/>`;
const rightArm = `
  <path d="m155 139 16-19 12 10c-6 14-13 24-25 25Z" fill="${p.shell}"/>
  <circle cx="154" cy="139" r="10" fill="${p.accent}"/>
  <path d="M173 123c-5-7-4-13 0-15 4-2 7 2 9 6-3-7-5-16 0-18 5-2 8 6 9 12 0-8 1-14 6-13 5 1 5 9 3 15 4-6 9-9 12-5 3 4-2 10-6 14 6-3 12-3 13 1 1 4-8 10-15 14-9 6-20 1-25-5Z" fill="${p.face}"/>`;
const thinkingArm = `
  <path d="M154 140c19 2 29-10 20-25l-14 6c2 5-1 7-9 8Z" fill="${p.shell}"/>
  <circle cx="154" cy="139" r="10" fill="${p.accent}"/>
  <path d="M158 121c-7-3-11-8-8-12 3-4 8 0 11 2-2-5 0-10 4-9 4 1 4 7 4 10 5-4 10-1 8 4-1 8-11 13-19 5Z" fill="${p.face}"/>
  <path d="m161 112 4 4" stroke-width="2"/>`;

function openEyes(dx = 0, dy = 0) {
  return `<ellipse cx="${103 + dx}" cy="${90 + dy}" rx="7" ry="10" fill="${p.ink}" stroke="none"/>
    <ellipse cx="${149 + dx}" cy="${89 + dy}" rx="7" ry="10" fill="${p.ink}" stroke="none"/>
    <ellipse cx="${105 + dx}" cy="${86 + dy}" rx="2.3" ry="3" fill="#FFFFFF" stroke="none"/>
    <ellipse cx="${151 + dx}" cy="${85 + dy}" rx="2.3" ry="3" fill="#FFFFFF" stroke="none"/>`;
}
const faces = {
  hello: `${openEyes()}<path d="M115 109c5 13 18 13 24-1-8 3-15 3-24 1Z" fill="${p.mouth}" stroke-width="2"/><path d="m94 73 8-3m43-1 9 3" stroke-width="2.5"/>`,
  'walk-a': `${openEyes(2)}<path d="M116 110q10 8 21-2" stroke-width="2.5"/><path d="m96 73 8-2m43-1 9 2" stroke-width="2.5"/>`,
  'walk-b': `<path d="M97 90q6-8 13 0" stroke-width="3.6"/><ellipse cx="150" cy="89" rx="7" ry="9" fill="${p.ink}" stroke="none"/><ellipse cx="152" cy="85" rx="2.3" ry="3" fill="#FFFFFF" stroke="none"/><path d="M116 109q10 10 22-1" stroke-width="2.5"/><path d="m95 74 9-2m42-2 9 2" stroke-width="2.5"/>`,
  jump: `${openEyes(0, -3)}<ellipse cx="125" cy="113" rx="7" ry="8" fill="${p.mouth}" stroke-width="2"/><path d="m94 70 9-3m43-1 9 3" stroke-width="2.5"/>`,
  cheer: `<path d="M96 90q7-12 14 0m32-1q7-12 14 0" stroke-width="3.6"/><path d="M113 108c4 17 22 17 27-1-10 3-18 3-27 1Z" fill="${p.mouth}" stroke-width="2"/><path d="m94 73 9-3m43-1 9 3" stroke-width="2.5"/>`,
  think: `${openEyes(3, -4)}<path d="M120 115q6-4 12-1" stroke-width="2.5"/><path d="m94 72 11 1m42-7 11 3" stroke-width="2.5"/>`
};
function head(expression) {
  return `<path d="M77 82 66 34c-1-7 4-11 10-7l35 29Z" fill="${p.shell}"/>
    <path d="m78 62-5-25 24 21Z" fill="${p.ear}" stroke-width="2"/>
    <path d="m143 55 31-30c6-5 12-2 11 6l-5 51Z" fill="${p.shell}"/>
    <path d="m157 58 21-23-3 29Z" fill="${p.ear}" stroke-width="2"/>
    <path d="M66 86c1-28 26-43 61-43 34 0 58 18 59 45 1 32-26 47-61 47-36 0-61-18-59-49Z" fill="${p.accent}"/>
    <path d="M75 91c-1-19 18-32 32-28 10 4 20 4 30 0 16-5 39 7 39 29 0 22-22 35-50 35S76 115 75 91Z" fill="${p.face}"/>
    <path d="M107 46c13 0 27 3 37 12-10 8-23 10-34 2l-13-9Z" fill="${p.shell}" stroke-width="2.5"/>
    ${faces[expression]}
    <path d="m121 100 7 1-4 4Z" fill="${p.ink}" stroke-width="2"/>
    <ellipse cx="88" cy="105" rx="6" ry="3" fill="${p.blush}" stroke="none"/>
    <ellipse cx="163" cy="104" rx="6" ry="3" fill="${p.blush}" stroke="none"/>
    <circle cx="68" cy="94" r="12" fill="${p.shell}"/>
    <circle cx="68" cy="94" r="6" fill="${p.accent}" stroke-width="2"/>`;
}

const poses = [
  {id: 'hello', name: 'Hello'},
  {id: 'walk-a', name: 'Walk A', body: 'translate(0 -2)', tail: 'rotate(6 96 172)', leftLeg: 'rotate(24 110 179)', rightLeg: 'rotate(20 146 179)', leftArm: 'rotate(-22 99 139)', rightArm: 'rotate(63 154 139)', head: 'rotate(3 126 127)'},
  {id: 'walk-b', name: 'Walk B', body: 'translate(0 1)', tail: 'rotate(-5 96 172)', leftLeg: 'rotate(-22 110 179)', rightLeg: 'rotate(-24 146 179)', leftArm: 'rotate(27 99 139)', rightArm: 'rotate(32 154 139)', head: 'rotate(-3 126 127)'},
  {id: 'jump', name: 'Jump', body: 'translate(0 -17)', tail: 'rotate(-8 96 172)', leftLeg: 'rotate(32 110 179)', rightLeg: 'rotate(-30 146 179)', leftArm: 'rotate(90 99 139)', rightArm: 'rotate(-22 154 139)', head: 'rotate(2 126 127)', shadow: 35},
  {id: 'cheer', name: 'Cheer', body: 'translate(0 -5)', tail: 'rotate(9 96 172)', leftLeg: 'rotate(8 110 179)', rightLeg: 'rotate(-8 146 179)', leftArm: 'rotate(102 99 139)', rightArm: 'rotate(-20 154 139)', head: 'rotate(-4 126 127)', sparkles: true},
  {id: 'think', name: 'Think', body: 'rotate(3 124 204)', tail: 'rotate(-6 96 172)', leftLeg: 'rotate(-5 110 179)', rightLeg: 'rotate(5 146 179)', leftArm: 'rotate(-30 99 139)', head: 'rotate(8 126 127)', thinking: true}
];

function costumeSVG(pose) {
  const body = group(tail, pose.tail) + group(leftLeg, pose.leftLeg) + group(rightLeg, pose.rightLeg) + torso +
    group(leftArm, pose.leftArm) + (pose.thinking ? '' : group(rightArm, pose.rightArm)) +
    group(head(pose.id), pose.head) + (pose.thinking ? thinkingArm : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 240 240" fill="none">
    <ellipse cx="124" cy="222" rx="${pose.shadow || 48}" ry="6" fill="#E5DDEE"/>
    ${pose.sparkles ? '<g stroke-linecap="round" stroke-width="4"><path d="M29 67v12m-6-6h12" stroke="#31A88F"/><path d="M207 42v12m-6-6h12" stroke="#A875CA"/><circle cx="190" cy="163" r="3" fill="#F0AF65"/></g>' : ''}
    <g stroke="${p.ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${group(body, pose.body)}</g>
  </svg>`;
}

export const ZUNI_COSTUMES = Object.freeze(poses.map(pose => Object.freeze({
  id: pose.id, name: pose.name, svg: costumeSVG(pose),
  width: 120, height: 120, rotationCenterX: 60, rotationCenterY: 60
})));
export const ZUNI_ART = ZUNI_COSTUMES[0].svg;
