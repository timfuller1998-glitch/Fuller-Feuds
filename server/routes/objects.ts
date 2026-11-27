import { Router, raw } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import {
  uploadProfilePicture,
  PROFILE_PICTURE_MAX_BYTES,
  isAllowedProfilePictureType,
} from '../lib/profilePictureStorage.js';

const router = Router();

// GET /api/objects/:objectPath(*) - legacy download path; avatars now use the public Storage URL.
router.get('/:objectPath(*)', async (req, res) => {
  res.status(404).json({ message: 'Object not found' });
});

// POST /api/objects/upload - authenticated profile picture upload to Supabase Storage.
router.post(
  '/upload',
  isAuthenticated,
  raw({ type: (req) => isAllowedProfilePictureType(String(req.headers['content-type'] || '')), limit: PROFILE_PICTURE_MAX_BYTES }),
  async (req, res) => {
    try {
      const user = req.user as Express.User;
      if (!user?.id) return res.status(401).json({ message: 'User not authenticated' });
      const contentType = String(req.headers['content-type'] || '');
      if (!isAllowedProfilePictureType(contentType)) {
        return res.status(400).json({ message: 'Please upload a JPEG, PNG, WebP, GIF, or HEIC image' });
      }
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
      const result = await uploadProfilePicture(String(user.id), body, contentType);
      res.json({
        path: result.path,
        publicUrl: result.publicUrl,
        uploadURL: result.publicUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload object';
      if (message.includes('not configured')) {
        console.error('Error uploading object: missing SUPABASE_SERVICE_ROLE_KEY');
        return res.status(503).json({ message: 'Photo upload is not configured yet' });
      }
      if (message.includes('less than 10MB') || message.includes('No image') || message.includes('Please upload')) {
        return res.status(400).json({ message });
      }
      console.error('Error uploading object:', error);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  },
);

export default router;
