/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImageFile } from '../types';

async function post(path: string, body: unknown, name: string): Promise<ImageFile> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.');
  }

  const data = await response.json().catch(() => null);
  if (response.status === 401) throw new Error('انتهت الجلسة. حدّث الصفحة وسجّل الدخول من جديد.');
  if (!response.ok) throw new Error(data?.error || `حصلت مشكلة (${response.status}). جرّب تاني.`);
  if (!data?.base64) throw new Error('السيرفر مارجّعش صورة.');

  return { base64: data.base64, mimeType: data.mimeType || 'image/png', name };
}

const strip = (img: ImageFile) => ({ base64: img.base64, mimeType: img.mimeType });

export function recolor(image: ImageFile, color: { colorId?: string; hex?: string }) {
  return post('/api/recolor', { image: strip(image), ...color }, 'recolored.png');
}

export function changePose(image: ImageFile, poseId: string) {
  return post('/api/pose', { image: strip(image), poseId }, 'pose.png');
}
