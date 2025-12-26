import express from 'express';
import authRoutes from './auth.js';
import topicRoutes from './topics.js';
import userRoutes from './users.js';
import opinionRoutes from './opinions.js';
import debateRoutes from './debates.js';
import debateRoomRoutes from './debate-rooms.js';
import moderationRoutes from './moderation.js';
import statsRoutes from './stats.js';
import objectRoutes from './objects.js';
import seedingRoutes from './seeding.js';

const router = express.Router();

// Mount route modules with their prefixes
router.use('/auth', authRoutes);
router.use('/topics', topicRoutes);
router.use('/users', userRoutes);
router.use('/opinions', opinionRoutes);
router.use('/debates', debateRoutes);
router.use('/debate-rooms', debateRoomRoutes);
router.use('/admin', moderationRoutes);
router.use('/stats', statsRoutes);
router.use('/objects', objectRoutes);
router.use('/admin/seeding', seedingRoutes);

export default router;
