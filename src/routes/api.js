import { Router } from 'express';
import authRoutes from './auth.js';
import profileRoutes from './profile.js';
import newsRoutes from './news.js';
import documentRoutes from './documents.js';
import supportRoutes from './support.js';
import legacyRoutes from './legacy.js';

const router = Router();

// Public route registry. Domain routers can be added here without changing
// server.js or the API mount points.
router.use(authRoutes);
router.use(profileRoutes);
router.use(newsRoutes);
router.use(documentRoutes);
router.use(supportRoutes);
router.use(legacyRoutes);

export default router;
