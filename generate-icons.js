#!/usr/bin/env node
/**
 * generate-icons.js
 * Gera todos os ícones PWA do Finara usando apenas Node.js + Canvas API
 * Execute: node generate-icons.js
 */

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT   = path.join(__dirname, 'icons');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const r      = size * 0.18; // border-radius
  const pad    = size * 0.0;

  // ── Background ──
  roundRect(ctx, pad, pad, size - pad*2, size - pad*2, r);
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0,   '#0e1e3a');
  bg.addColorStop(0.5, '#1a2b4a');
  bg.addColorStop(1,   '#0a1628');
  ctx.fillStyle = bg;
  ctx.fill();

  // ── Accent circle ──
  const cx = size / 2, cy = size / 2;
  const accentR = size * 0.33;
  const glow = ctx.createRadialGradient(cx, cy - accentR*0.2, 0, cx, cy, accentR * 1.4);
  glow.addColorStop(0,   'rgba(79,128,255,0.25)');
  glow.addColorStop(1,   'rgba(79,128,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, accentR * 1.4, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // ── Icon (layers / stacked lines — brand logo) ──
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.lineWidth   = size * 0.055;

  const s = size * 0.34; // half-width of lines
  const yTop = cy - size * 0.145;
  const yMid = cy;
  const yBot = cy + size * 0.145;

  // Top line (short)
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.55, yTop - s * 0.3);
  ctx.lineTo(cx,             yTop);
  ctx.lineTo(cx + s * 0.55,  yTop - s * 0.3);
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  // Middle line
  ctx.beginPath();
  ctx.moveTo(cx - s, yMid - s * 0.45);
  ctx.lineTo(cx,     yMid);
  ctx.lineTo(cx + s, yMid - s * 0.45);
  ctx.globalAlpha = 0.75;
  ctx.stroke();

  // Bottom line
  ctx.beginPath();
  ctx.moveTo(cx - s, yBot - s * 0.45);
  ctx.lineTo(cx,     yBot);
  ctx.lineTo(cx + s, yBot - s * 0.45);
  ctx.globalAlpha = 1;
  ctx.stroke();

  // ── Accent dot ──
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, yMid, size * 0.045, 0, Math.PI * 2);
  const dot = ctx.createRadialGradient(cx, yMid, 0, cx, yMid, size * 0.045);
  dot.addColorStop(0, '#7aaeff');
  dot.addColorStop(1, '#4f80ff');
  ctx.fillStyle = dot;
  ctx.fill();

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

SIZES.forEach(size => {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const file   = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, buffer);
  console.log(`✓ icon-${size}.png`);
});

console.log('\n✅ Todos os ícones gerados em /icons/');
console.log('   Se precisar de screenshots, adicione manualmente em /icons/screenshot-wide.png e screenshot-mobile.png');
