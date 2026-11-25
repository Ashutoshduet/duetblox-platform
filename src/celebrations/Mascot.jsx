import React from 'react';
import './celebrations.css';

export const MASCOT_DANCES = ['bounce', 'shuffle', 'spin', 'high-five', 'victory'];

// Original, code-native Zuni artwork. Separate body parts let the same lightweight
// character work as an editor companion and a small sprite without image downloads.
export default function Mascot({mascot = 'zuni', palette = 'lilac', dance = 'bounce', playing = false, motionReduced = false, className = ''}) {
  const safeMascot = ['zuni', 'duvi', 'tiko'].includes(mascot) ? mascot : 'zuni';
  const safePalette = ['lilac', 'ocean', 'sunset'].includes(palette) ? palette : 'lilac';
  const fox = safeMascot === 'tiko', robot = safeMascot === 'duvi';
  const safeDance = MASCOT_DANCES.includes(dance) ? dance : 'bounce';
  return <svg className={`celebration-mascot zuni-mascot mascot-${safeMascot} zuni-${safeDance} ${className}`} data-palette={safePalette} viewBox="0 0 240 240" fill="none"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"
    data-playing={playing && !motionReduced ? 'true' : 'false'} data-reduced-motion={motionReduced ? 'true' : 'false'}>
    <ellipse className="zuni-shadow" cx="124" cy="218" rx="54" ry="8" fill="#E5DDEE"/>
    <g className="zuni-sparkles" strokeLinecap="round" strokeWidth="4">
      <path d="M30 87v12m-6-6h12" stroke="#31A88F"/>
      <path d="M207 42v12m-6-6h12" stroke="#A875CA"/>
      <path d="m192 136 5 5m-4-28 4-4" stroke="#F0AF65"/>
      <path d="m48 47 5 5m-4 73 4 4" stroke="#D887AB"/>
      <circle cx="174" cy="25" r="2" fill="#31A88F" stroke="none"/>
    </g>
    <g className="zuni-body" stroke="var(--mascot-ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      {!robot && <g className="zuni-tail">
        <path d="M99 183c-24 15-48 9-56-14-8-20-1-46-19-56 29-5 47 9 51 30 2 11 12 11 24 18Z" fill="var(--mascot-shell)"/>
        {!fox && <path d="M43 169c-5-12-5-24-7-35 12-1 25 3 38 12 4 11 14 8 25 15v13c-21 10-40 9-56-5Z" fill="var(--mascot-accent)"/>}
        <path d="M36 134c-2-9-5-15-12-21 22-4 38 4 46 18-11 0-23 0-34 3Z" fill="var(--mascot-face)"/>
      </g>}
      <g className="zuni-leg zuni-leg-left">
        <path d="m99 179-4 24 22 2 3-26Z" fill="var(--mascot-accent)"/>
        <path d="M97 200c-10 1-15 8-15 15 9 5 25 6 36 1v-14Z" fill="var(--mascot-shell)"/>
        <path d="M90 214c6-8 18-8 27-4v6c-9 4-19 4-27-2Z" fill="var(--mascot-face)" stroke="none"/>
      </g>
      <g className="zuni-leg zuni-leg-right">
        <path d="m136 178 3 26 21-3-3-24Z" fill="var(--mascot-accent)"/>
        <path d="M141 200v17c12 3 25 2 34-3-1-9-8-14-17-15Z" fill="var(--mascot-shell)"/>
        <path d="M143 210c9-5 20-4 25 4-8 3-17 4-25 2Z" fill="var(--mascot-face)" stroke="none"/>
      </g>
      <path d="M104 125c-17 11-21 39-13 59 19 12 48 12 68-2 6-24-4-47-19-57Z" fill="var(--mascot-shell)"/>
      <path d="M111 136c-11 10-14 27-10 42 14 8 33 7 46-1 3-17-2-31-13-41Z" fill="var(--mascot-face)"/>
      {fox ? <path d="m104 128 39-1-12 16-7-7-10 18Z" fill="#82CDBE" strokeWidth="2.5"/> : <>
        <rect x="112" y="147" width="18" height="18" rx="5" fill="#8BD5C3" strokeWidth="2.3"/>
        <rect x="126" y="158" width="15" height="15" rx="4" fill="#F3B67C" strokeWidth="2.3"/>
      </>}
      <g className="zuni-arm zuni-arm-left">
        <path d="M96 138c-5 9-13 13-20 20l10 14c13-6 21-15 23-24Z" fill="var(--mascot-shell)"/>
        {!fox && <circle cx="99" cy="139" r="10" fill="var(--mascot-accent)"/>}
        <path d="M78 156c-6-3-12 0-13 6-7-3-11 4-6 9-1 8 5 13 11 9 5 5 11 1 12-5 8-2 8-9 1-11Z" fill="var(--mascot-face)"/>
      </g>
      <g className="zuni-arm zuni-arm-right">
        <path d="m155 139 16-19 12 10c-6 14-13 24-25 25Z" fill="var(--mascot-shell)"/>
        {!fox && <circle cx="154" cy="139" r="10" fill="var(--mascot-accent)"/>}
        <path d="M173 123c-5-7-4-13 0-15 4-2 7 2 9 6-3-7-5-16 0-18 5-2 8 6 9 12 0-8 1-14 6-13 5 1 5 9 3 15 4-6 9-9 12-5 3 4-2 10-6 14 6-3 12-3 13 1 1 4-8 10-15 14-9 6-20 1-25-5Z" fill="var(--mascot-face)"/>
      </g>
      <g className="zuni-head">
        {!robot && <><path d="M77 82 66 34c-1-7 4-11 10-7l35 29Z" fill="var(--mascot-shell)"/>
        <path d="m78 62-5-25 24 21Z" fill="var(--mascot-ear)" strokeWidth="2"/>
        <path d="m143 55 31-30c6-5 12-2 11 6l-5 51Z" fill="var(--mascot-shell)"/>
        <path d="m157 58 21-23-3 29Z" fill="var(--mascot-ear)" strokeWidth="2"/></>}
        {robot && <><path d="M99 47c-10-14-8-23 2-29" strokeWidth="5"/><rect x="93" y="10" width="17" height="17" rx="5" fill="#8BD5C3" strokeWidth="2.5"/><rect x="106" y="6" width="16" height="16" rx="5" fill="#F3B67C" strokeWidth="2.5"/></>}
        <path d="M66 86c1-28 26-43 61-43 34 0 58 18 59 45 1 32-26 47-61 47-36 0-61-18-59-49Z" fill={fox || robot ? 'var(--mascot-shell)' : 'var(--mascot-accent)'}/>
        <path d="M75 91c-1-19 18-32 32-28 10 4 20 4 30 0 16-5 39 7 39 29 0 22-22 35-50 35S76 115 75 91Z" fill="var(--mascot-face)"/>
        {!robot && <path d="M107 46c13 0 27 3 37 12-10 8-23 10-34 2l-13-9Z" fill="var(--mascot-shell)" strokeWidth="2.5"/>}
        <ellipse cx="103" cy="90" rx="7" ry="10" fill="var(--mascot-ink)" stroke="none"/>
        <ellipse cx="149" cy="89" rx="7" ry="10" fill="var(--mascot-ink)" stroke="none"/>
        <ellipse cx="105" cy="86" rx="2.3" ry="3" fill="white" stroke="none"/>
        <ellipse cx="151" cy="85" rx="2.3" ry="3" fill="white" stroke="none"/>
        {!robot && <path d="m121 100 7 1-4 4Z" fill="var(--mascot-ink)" strokeWidth="2"/>}
        <path d="M115 109c5 13 18 13 24-1-8 3-15 3-24 1Z" fill="#D7799C" strokeWidth="2"/>
        <path d="m94 73 8-3m43-1 9 3" strokeWidth="2.5"/>
        <ellipse cx="88" cy="105" rx="6" ry="3" fill="var(--mascot-blush)" stroke="none"/>
        <ellipse cx="163" cy="104" rx="6" ry="3" fill="var(--mascot-blush)" stroke="none"/>
        {!fox && <><circle cx="68" cy="94" r="12" fill="var(--mascot-shell)"/>
          <circle cx="68" cy="94" r="6" fill="var(--mascot-accent)" strokeWidth="2"/></>}
      </g>
    </g>
  </svg>;
}
