import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Define the User payload interface
export interface UserPayload {
  id: number
  email: string
  tenant_id: number
  role_id: number
  iat?: number
  exp?: number
}

// Extend Request to include user
export interface AuthRequest extends Request {
  user?: UserPayload
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Response => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    console.error('JWT_SECRET environment variable is not set')
    return res.status(500).json({ error: 'Internal server error' })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload
    req.user = decoded
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ error: 'Token expired' })
    } else if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid token' })
    } else {
      console.error('Token verification error:', error)
      return res.status(403).json({ error: 'Token verification failed' })
    }
  }
}