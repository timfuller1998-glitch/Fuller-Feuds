import { Router } from 'express';
import { UserRepository } from '../repositories/userRepository.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();
const userRepository = new UserRepository();

// GET /api/auth/user - Get current user info
router.get('/user', async (req, res) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:12',message:'Auth check started',data:{hasIsAuthenticated:typeof req.isAuthenticated==='function',isAuthenticatedResult:typeof req.isAuthenticated==='function'?req.isAuthenticated():undefined,hasSession:!!req.session,sessionId:req.session?.id,hasUser:!!req.user,userId:req.user?.id,cookies:Object.keys(req.cookies||{}),cookieHeader:req.get('cookie')?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:15',message:'Auth check failed',data:{hasIsAuthenticated:typeof req.isAuthenticated==='function',hasSession:!!req.session,sessionId:req.session?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
