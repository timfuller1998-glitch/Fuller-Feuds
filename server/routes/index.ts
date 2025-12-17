import express from 'express';
import authRoutes from './auth';
import topicRoutes from './topics';
import userRoutes from './users';
import opinionRoutes from './opinions';
import debateRoutes from './debates';
import moderationRoutes from './moderation';
import statsRoutes from './stats';
import objectRoutes from './objects';
import seedingRoutes from './seeding';

const router = express.Router();

// Mount route modules with their prefixes
router.use('/auth', authRoutes);
router.use('/topics', topicRoutes);
router.use('/users', userRoutes);
router.use('/opinions', opinionRoutes);
router.use('/debates', debateRoutes);
router.use('/admin', moderationRoutes);
router.use('/stats', statsRoutes);
router.use('/objects', objectRoutes);
router.use('/admin/seeding', seedingRoutes);

export default router;
