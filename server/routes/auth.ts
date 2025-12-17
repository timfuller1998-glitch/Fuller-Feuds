import { Router } from 'express';
import { UserRepository } from '../repositories/userRepository';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const userRepository = new UserRepository();

// GET /api/auth/user - Get current user info
router.get('/user', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as Express.User;
    
    if (!user || !user.id) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch fresh user data from database to ensure we have the latest onboarding status
    // This prevents race conditions where the session might have stale data
    const freshUser = await userRepository.findById(user.id);
    
    if (!freshUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data without sensitive information
    // Ensure onboardingComplete is always a boolean (never null/undefined)
    res.json({
      id: freshUser.id,
      email: freshUser.email,
      firstName: freshUser.firstName,
      lastName: freshUser.lastName,
      role: freshUser.role,
      status: freshUser.status,
      onboardingStep: freshUser.onboardingStep ?? 0,
      onboardingComplete: freshUser.onboardingComplete ?? false, // Always return a boolean
      bio: freshUser.bio,
      location: freshUser.location,
      profileImageUrl: freshUser.profileImageUrl,
      followedCategories: freshUser.followedCategories ?? [],
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
