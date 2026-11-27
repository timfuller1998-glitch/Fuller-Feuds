import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const PROFILE_PICTURE_BUCKET = 'profile-pictures';
export const PROFILE_PICTURE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vrutowfygjodifolelyd.supabase.co';
  return url.replace(/\/$/, '');
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error('Supabase storage is not configured (set SUPABASE_SERVICE_ROLE_KEY)');
  }
  return key;
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function publicProfilePictureUrl(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${PROFILE_PICTURE_BUCKET}/${path}`;
}

export function extensionForContentType(contentType: string): string | null {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return ALLOWED_TYPES[mime] ?? null;
}

export function isAllowedProfilePictureType(contentType: string): boolean {
  return extensionForContentType(contentType) !== null;
}

export function assertOwnProfilePicturePath(userId: string, path: string): string {
  const normalized = String(path || '').replace(/^\/+/, '');
  if (!userId || !normalized.startsWith(`${userId}/`) || normalized.includes('..') || normalized.includes('\\')) {
    throw new Error('Invalid profile picture path');
  }
  return normalized;
}

export async function uploadProfilePicture(userId: string, body: Buffer, contentType: string): Promise<{ path: string; publicUrl: string }> {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new Error('No image uploaded');
  }
  if (body.length > PROFILE_PICTURE_MAX_BYTES) {
    throw new Error('File size must be less than 10MB');
  }
  const ext = extensionForContentType(contentType);
  if (!ext) {
    throw new Error('Please upload a JPEG, PNG, WebP, GIF, or HEIC image');
  }
  const path = `${userId}/${Date.now()}-${randomUUID()}.${ext}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(PROFILE_PICTURE_BUCKET).upload(path, body, {
    contentType: contentType.split(';')[0].trim().toLowerCase(),
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, publicUrl: publicProfilePictureUrl(path) };
}
