import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#0B0E14';
ctx.fillRect(0, 0, width, height);

// Accent border top
ctx.fillStyle = '#a78bfa';
ctx.fillRect(0, 0, width, 4);

// Large circle (logo mark) - left side
const circleX = 150;
const circleY = 315;
const circleRadius = 100;

// Outer circle
ctx.strokeStyle = '#a78bfa';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
ctx.stroke();

// Inner dot
ctx.fillStyle = '#a78bfa';
ctx.beginPath();
ctx.arc(circleX, circleY, 30, 0, Math.PI * 2);
ctx.fill();

// Text - right side
ctx.fillStyle = '#e0e7ff';
ctx.font = 'bold 72px "Space Grotesk", sans-serif';
ctx.textAlign = 'left';
ctx.fillText('Traqcker', 350, 280);

// Subtitle
ctx.fillStyle = '#a78bfa';
ctx.font = 'bold 36px "Space Grotesk", sans-serif';
ctx.fillText('Easy Mode', 350, 340);

// Tagline
ctx.fillStyle = '#cbd5e1';
ctx.font = '24px "Space Grotesk", sans-serif';
ctx.fillText('Stock scores. Community votes. Free.', 350, 390);

// Bottom accent
ctx.fillStyle = '#a78bfa';
ctx.fillRect(0, height - 4, width, 4);

// Save
const buffer = canvas.toBuffer('image/png');
const filepath = path.join(process.cwd(), 'public/og-image.png');
fs.writeFileSync(filepath, buffer);

console.log(`OG image created: ${filepath}`);
