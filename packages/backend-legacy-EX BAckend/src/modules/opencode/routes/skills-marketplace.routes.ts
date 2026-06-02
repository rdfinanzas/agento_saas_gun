/**
 * Skills Marketplace Routes
 */

import { Router } from 'express';
import { skillsMarketplaceController } from '../controllers/skills-marketplace.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ============================================
// Browse Marketplace
// ============================================

// Get all marketplace skills (with filters)
router.get('/skills', (req, res) => skillsMarketplaceController.getSkills(req, res));

// Get categories
router.get('/categories', (req, res) => skillsMarketplaceController.getCategories(req, res));

// Get popular tags
router.get('/tags', (req, res) => skillsMarketplaceController.getPopularTags(req, res));

// Get single skill
router.get('/skills/:skillId', (req, res) => skillsMarketplaceController.getSkillById(req, res));

// Get skill reviews
router.get('/skills/:skillId/reviews', (req, res) => skillsMarketplaceController.getReviews(req, res));

// ============================================
// Install/Uninstall
// ============================================

// Get installed skills
router.get('/installed', (req, res) => skillsMarketplaceController.getInstalledSkills(req, res));

// Install a skill
router.post('/skills/:skillId/install', (req, res) => skillsMarketplaceController.installSkill(req, res));

// Uninstall a skill
router.delete('/skills/:skillId/install', (req, res) => skillsMarketplaceController.uninstallSkill(req, res));

// ============================================
// Publish/Manage
// ============================================

// Get my published skills
router.get('/my-skills', (req, res) => skillsMarketplaceController.getMyPublishedSkills(req, res));

// Publish a skill
router.post('/publish', (req, res) => skillsMarketplaceController.publishSkill(req, res));

// Update a published skill
router.patch('/skills/:skillId', (req, res) => skillsMarketplaceController.updatePublishedSkill(req, res));

// Unpublish a skill
router.delete('/skills/:skillId', (req, res) => skillsMarketplaceController.unpublishSkill(req, res));

// ============================================
// Reviews
// ============================================

// Add a review
router.post('/skills/:skillId/reviews', (req, res) => skillsMarketplaceController.addReview(req, res));

export { router as skillsMarketplaceRoutes };
