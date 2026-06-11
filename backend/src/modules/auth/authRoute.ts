// src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import {login, logout, me, requestPasswordReset, resetPassword} from './authController';
import { authenticateToken } from '../../middleware/auth';
import type { AuthRequest } from '../../middleware/auth';

const router: Router = Router();

// Public routes
router.post('/login', (req: Request, res: Response) => login(req, res));
router.post('/request-password-reset', (req: Request, res: Response) => requestPasswordReset(req, res));
router.post('/reset-password', (req: Request, res: Response) => resetPassword(req, res));

// Protected routes (require authentication)
router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => logout(req, res));
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => me(req, res));

export default router;