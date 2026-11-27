import express from 'express';
import authRoutes from './auth.js';
import topicRoutes from './topics.js';
import feedRoutes from './feed.js';
import userRoutes from './users.js';
import opinionRoutes from './opinions.js';
import counterpointRoutes from './counterpoints.js';
import debateRoutes from './debates.js';
import debateRoomRoutes from './debate-rooms.js';
import moderationRoutes from './moderation.js';
import statsRoutes from './stats.js';
import objectRoutes from './objects.js';
import healthRoutes from './health.js';
import auditRoutes from './admin/audit.js';
import presenceRoutes from './presence.js';
import profileRoutes from './profile.js';
import followRoutes from './follow.js';
import leaderboardRoutes from './leaderboards.js';
import handleRoutes from './handles.js';
import notificationRoutes from './notifications.js';
import { feedbackRouter, adminFeedbackRouter } from './feedback.js';
import { publicFoundersRouter, foundersRouter, adminFoundersRouter } from './founders.js';

const router = express.Router();

// Mount route modules with their prefixes
router.use('/auth', authRoutes);
router.use('/topics', topicRoutes);
router.use('/feed', feedRoutes);
router.use('/users', userRoutes);
// Settings and onboarding call /api/profile-picture (not /api/users/profile-picture).
router.put('/profile-picture', (req, res, next) => {
  req.url = '/profile-picture';
  return userRoutes(req, res, next);
});
router.use('/opinions', opinionRoutes);
router.use('/counterpoints', counterpointRoutes);
router.use('/debates', debateRoutes);
router.use('/debate-rooms', debateRoomRoutes);
router.use('/admin/feedback', adminFeedbackRouter);
router.use('/admin/founders', adminFoundersRouter);
router.use('/admin', moderationRoutes);
router.use('/admin/audit', auditRoutes);
router.use('/stats', statsRoutes);
router.use('/objects', objectRoutes);
router.use('/health', healthRoutes);
router.use('/presence', presenceRoutes);
router.use('/profile', profileRoutes);
router.use('/follow', followRoutes);
router.use('/leaderboards', leaderboardRoutes);
router.use('/handles', handleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/feedback', feedbackRouter);
router.use('/founders', foundersRouter);
router.use('/', publicFoundersRouter);

export default router;
