// Renders the two illustrated sample photos used by the demo ("Sample leaf
// photo", "Sample harvest photo") to public/demo/*.jpg. They are drawings, not
// real crop photos — a real vision model will describe them as illustrations.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("public/demo", { recursive: true });

const leaf = (x, y, r, rot, fill, spots = []) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M0 0 C ${r * 0.55} ${-r * 0.35}, ${r * 0.9} ${-r * 0.15}, ${r} 0 C ${r * 0.9} ${r * 0.15}, ${r * 0.55} ${r * 0.35}, 0 0 Z" fill="${fill}"/>
    <path d="M0 0 L ${r * 0.95} 0" stroke="#8fb06a" stroke-width="${r * 0.012}" opacity="0.7"/>
    ${[0.25, 0.45, 0.65].map((t) => `<path d="M${r * t} 0 q ${r * 0.08} ${-r * 0.1} ${r * 0.16} ${-r * 0.14}" stroke="#8fb06a" stroke-width="${r * 0.008}" fill="none" opacity="0.6"/><path d="M${r * t} 0 q ${r * 0.08} ${r * 0.1} ${r * 0.16} ${r * 0.14}" stroke="#8fb06a" stroke-width="${r * 0.008}" fill="none" opacity="0.6"/>`).join("")}
    ${spots.map(([sx, sy, sr]) => `<circle cx="${r * sx}" cy="${r * sy}" r="${r * sr * 1.6}" fill="#c9b84a" opacity="0.55"/><circle cx="${r * sx}" cy="${r * sy}" r="${r * sr}" fill="#6b4a2b"/>`).join("")}
  </g>`;

const noise = `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0.10 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

const leafSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>${noise}<radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#d9cfb8"/><stop offset="1" stop-color="#a99a7c"/></radialGradient></defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <rect width="1000" height="1000" filter="url(#n)"/>
  ${leaf(170, 560, 720, -12, "#4f7d38", [[0.32, -0.06, 0.025], [0.48, 0.07, 0.02], [0.58, -0.09, 0.03], [0.7, 0.04, 0.018], [0.41, -0.15, 0.015], [0.63, 0.12, 0.022]])}
  ${leaf(240, 700, 380, 28, "#5e8f42", [[0.5, -0.05, 0.03]])}
</svg>`;

const bunch = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-6" y="40" width="12" height="120" fill="#6f8f45"/>
  ${[[-60, -10, -40], [50, -20, 30], [-20, -60, -10], [30, -70, 15], [-70, -70, -60], [70, -60, 50], [0, -100, 0], [-40, 20, -70], [45, 25, 70]].map(([lx, ly, rot]) => leaf(lx, ly, 120, rot - 90, rot % 20 === 0 ? "#3f6e2e" : "#4c7f37")).join("")}
</g>`;

const harvestSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>${noise}</defs>
  <rect width="1000" height="1000" fill="#cbbfa3"/>
  <rect width="1000" height="1000" filter="url(#n)"/>
  <rect x="90" y="420" width="820" height="470" rx="18" fill="#3f6fb0"/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="${130 + i * 112}" y="560" width="70" height="280" rx="10" fill="#2f5a95"/>`).join("")}
  ${[[230, 430, 1.25], [420, 410, 1.35], [610, 430, 1.25], [790, 440, 1.15], [320, 520, 1.1], [520, 520, 1.15], [710, 520, 1.05]].map(([x, y, s]) => bunch(x, y, s)).join("")}
  <rect x="90" y="700" width="820" height="190" rx="18" fill="#3f6fb0"/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="${130 + i * 112}" y="740" width="70" height="110" rx="10" fill="#2f5a95"/>`).join("")}
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
for (const [name, svg] of [["basil-leaf", leafSvg], ["basil-harvest", harvestSvg]]) {
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: `public/demo/${name}.jpg`, type: "jpeg", quality: 86 });
}
await browser.close();
console.log("Wrote public/demo/basil-leaf.jpg and public/demo/basil-harvest.jpg");
