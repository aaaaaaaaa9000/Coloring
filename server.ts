/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { installLogin } from './login';
import { HEX_RE, findPose, findShade } from './catalog';

// ---- Config (all from env) ----
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';
const APP_USERNAME = process.env.APP_USERNAME || 'user';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE) || 10;
const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB) || 8;
const MAX_IMAGE_BASE64 = Math.ceil((MAX_IMAGE_MB * 1024 * 1024 * 4) / 3);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
];

// ---- Gemini client (created once, lazily) ----
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error('GEMINI_API_KEY is not set'), { status: 'NO_KEY' });
  }
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiClient;
}

// ---- Prompts (built only from the fixed catalog, never from free user text) ----
const recolorPrompt = (color: string) =>
  `You are an expert fashion photo editor. Recolor the primary garment being worn by the person in the image to ${color}. ` +
  `You MUST NOT change anything else in the image: the person, their face, their pose, other clothing items, the lighting and the background must remain identical. ` +
  `Keep the fabric texture, folds, shadows and highlights of the garment realistic. Return ONLY the final photorealistic image.`;

const posePrompt = (pose: string) =>
  `You are an expert fashion photo editor. Change the pose of the person in the image to: ${pose}. ` +
  `You MUST NOT change the person's identity, face, body shape, their clothing (including its exact colors) or the background. ` +
  `The final image should be photorealistic and seamlessly edited. Return ONLY the final image.`;

// ---- Helpers ----
type ImageInput = { base64: string; mimeType: string };

/** Returns an Arabic error message if the image is invalid, otherwise null. */
function validateImage(img: unknown): string | null {
  const i = img as Partial<ImageInput> | undefined;
  if (!i || typeof i.base64 !== 'string' || !i.base64) return 'ارفع الصورة الأول.';
  if (typeof i.mimeType !== 'string' || !ALLOWED_MIME.has(i.mimeType)) {
    return 'نوع الصورة غير مدعوم. استخدم صورة عادية (جي بي جي أو بي إن جي).';
  }
  if (i.base64.length > MAX_IMAGE_BASE64) return `الصورة كبيرة جدًا. الحد الأقصى ${MAX_IMAGE_MB} ميجا.`;
  return null;
}

/** Maps a Gemini SDK error to an HTTP status and an Arabic message; logs details server-side. */
function sendGeminiError(res: Response, error: any, context: string) {
  console.error(`[${context}]`, error?.status, error?.message);
  const msg = String(error?.message || '');
  if (error?.status === 'NO_KEY') {
    return res.status(500).json({ error: 'مفتاح جيميناي مش متضبط على السيرفر.' });
  }
  if (error?.status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return res.status(429).json({ error: 'تم تجاوز حد الاستخدام للمفتاح. جرّب تاني بعد شوية.' });
  }
  if (error?.status === 403 || /PERMISSION_DENIED|API_KEY_INVALID|API key/i.test(msg)) {
    return res.status(502).json({ error: 'مفتاح جيميناي مرفوض. راجع المفتاح في إعدادات السيرفر.' });
  }
  return res.status(500).json({ error: 'حصلت مشكلة أثناء المعالجة. جرّب تاني.' });
}

async function editImage(res: Response, image: ImageInput, prompt: string, context: string) {
  try {
    const response = await getAI().models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: prompt }] },
      config: { safetySettings: SAFETY_SETTINGS as any },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return res.json({ base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' });
      }
    }

    const reason = response.candidates?.[0]?.finishReason || response.promptFeedback?.blockReason;
    console.warn(`[${context}] no image returned, reason:`, reason);
    if (reason && reason !== 'STOP') {
      return res.status(422).json({ error: 'الموديل رفض يعدّل الصورة دي. جرّب صورة تانية.' });
    }
    return res.status(502).json({ error: 'الموديل ماطلّعش صورة. جرّب تاني.' });
  } catch (error) {
    return sendGeminiError(res, error, context);
  }
}

// ---- Rate limit (per IP, fixed 1-minute window, in memory) ----
const hits = new Map<string, { count: number; reset: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (h.reset <= now) hits.delete(ip);
}, 60_000).unref();

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || h.reset <= now) {
    h = { count: 0, reset: now + 60_000 };
    hits.set(ip, h);
  }
  h.count++;
  if (h.count > RATE_LIMIT_PER_MINUTE) {
    res.setHeader('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
    return res.status(429).json({ error: 'طلبات كتير في وقت قصير. استنى دقيقة وجرّب تاني.' });
  }
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Health check (before auth so Docker/Traefik can reach it)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // In-page login form + session cookie (only when APP_PASSWORD is set)
  installLogin(app, { appName: 'استوديو التلوين', username: APP_USERNAME, password: APP_PASSWORD, accent: '#9C3548' });

  app.use(express.json({ limit: `${MAX_IMAGE_MB * 1.4 + 1}mb` }));

  app.post('/api/recolor', rateLimit, async (req, res) => {
    const { image, colorId, hex } = req.body || {};
    const imageError = validateImage(image);
    if (imageError) return res.status(400).json({ error: imageError });

    let colorText: string;
    if (typeof hex === 'string' && hex) {
      if (!HEX_RE.test(hex)) return res.status(400).json({ error: 'كود اللون غلط.' });
      colorText = `the exact color with hex code ${hex.toLowerCase()}`;
    } else {
      const shade = typeof colorId === 'string' ? findShade(colorId) : undefined;
      if (!shade) return res.status(400).json({ error: 'اختار لون من القائمة.' });
      colorText = `'${shade.en}' (hex ${shade.hex})`;
    }
    return editImage(res, image, recolorPrompt(colorText), 'recolor');
  });

  app.post('/api/pose', rateLimit, async (req, res) => {
    const { image, poseId } = req.body || {};
    const imageError = validateImage(image);
    if (imageError) return res.status(400).json({ error: imageError });
    const pose = typeof poseId === 'string' ? findPose(poseId) : undefined;
    if (!pose) return res.status(400).json({ error: 'اختار وضعية من القائمة.' });
    return editImage(res, image, posePrompt(pose.en), 'pose');
  });

  // Unknown API routes → JSON 404 (instead of the SPA page)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Body too large / bad JSON → JSON error in Arabic
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: `الصورة كبيرة جدًا. الحد الأقصى ${MAX_IMAGE_MB} ميجا.` });
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'طلب غير صالح.' });
    return next(err);
  });

  if (IS_PROD) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distPath, { index: false }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server on :${PORT} | image model: ${IMAGE_MODEL} | auth: ${APP_PASSWORD ? 'on' : 'off'} | ` +
        `rate limit: ${RATE_LIMIT_PER_MINUTE}/min | key: ${process.env.GEMINI_API_KEY ? 'set' : 'MISSING'}`,
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
