import bcrypt from "bcryptjs";

import jwt from 'jsonwebtoken';
import { Request, Response } from 'express'
import { prisma } from '../../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import crypto from "crypto";
import nodemailer from "nodemailer";

// Token payload type
interface TokenPayload {
  id: number
  email: string
  tenant_id: number
  role_id: number
}

// Email configuration - with better error handling
let transporter: nodemailer.Transporter;

try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Add timeout to prevent hanging
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  // Verify transporter configuration
  transporter.verify(function(error) {
    if (error) {
      console.error('SMTP configuration error:', error.message);
    } else {
      console.log('SMTP server is ready to send emails');
    }
  });
} catch (error) {
  console.error('Failed to create email transporter:', error);
}

// Email template for password reset
const resetPasswordEmailTemplate = (resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold; 
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <p><a href="${resetLink}" class="button">Reset Password</a></p>
        <p>Or copy and paste this link into your browser:</p>
        <p><code>${resetLink}</code></p>
        <div class="warning">
            <p><strong>⚠️ Important:</strong> This link will expire in 15 minutes.</p>
        </div>
        <p>If you didn't request this, please ignore this email.</p>
        <div class="footer">
            <p>Thank you,<br>The Application Team</p>
        </div>
    </div>
</body>
</html>
`;

// ---------------------------------------------
// LOGIN
// ---------------------------------------------
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Please provide both email and password' 
      })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        role: true
      }
    })

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password. Please check your credentials.' 
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid email or password. Please check your credentials.' 
      })
    }

    // Check if user account is active/verified if needed
    // Example:
    // if (!user.isActive) {
    //   return res.status(403).json({ 
    //     error: 'Your account is inactive. Please contact support.' 
    //   })
    // }

    // environment variable check
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not configured')
      return res.status(500).json({ 
        error: 'Server configuration error. Please try again later.' 
      })
    }

    // Create JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        tenant_id: user.tenantId,
        role_id: user.roleId
      } as TokenPayload,
      jwtSecret,
      { expiresIn: '24h' }
    )

    // Remove password from response (typesafe)
    const { password: _password, ...userWithoutPassword } = user

    return res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ 
      error: 'Unable to process login. Please try again later.' 
    })
  }
}

// ---------------------------------------------
// LOGOUT
// ---------------------------------------------
export const logout = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    return res.json({ 
      message: 'You have been logged out successfully' 
    })
  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ 
      error: 'Unable to process logout. Please try again.' 
    })
  }
}

// ---------------------------------------------
// ME (Current logged user)
// ---------------------------------------------
export const me = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Please log in to access this information' 
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        tenant: true,
        role: true
      }
    })

    if (!user) {
      return res.status(404).json({ 
        error: 'Your account could not be found. Please contact support.' 
      })
    }

    // Check if user account is active/verified if needed
    // Example:
    // if (!user.isActive) {
    //   return res.status(403).json({ 
    //     error: 'Your account has been deactivated. Please contact support.' 
    //   })
    // }

    const { password: _password, ...userWithoutPassword } = user

    return res.json({
      message: 'User profile retrieved successfully',
      user: userWithoutPassword
    })
  } catch (error) {
    console.error('Get user error:', error)
    return res.status(500).json({ 
      error: 'Unable to retrieve your profile. Please try again later.' 
    })
  }
}

// ---------------------------------------------
// REQUEST PASSWORD RESET
// ---------------------------------------------
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Please provide your email address' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Please provide a valid email address' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // For security: don't reveal if email exists
      return res.json({ 
        message: 'If your email exists in our system, you will receive password reset instructions shortly.' 
      });
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Delete any existing reset tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email }
    });

    // Save token to DB with expiration time
    await prisma.passwordReset.create({
      data: {
        email,
        token
      }
    });

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    // Check if email transporter is available
    if (!transporter) {
      console.error('Email transporter not available');
      
      // Still delete the token since we can't send email
      await prisma.passwordReset.deleteMany({
        where: { email }
      });

      return res.status(503).json({
        error: 'Email service is currently unavailable. Please try again in a few minutes.',
        details: 'If the problem persists, please contact our support team for assistance.'
      });
    }

    // Send email
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Your App'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
        to: email,
        subject: "Reset Your Password",
        html: resetPasswordEmailTemplate(resetLink),
        text: `Please reset your password by clicking the following link: ${resetLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✓ Password reset email sent to ${email}`);

      return res.json({
        message: 'Password reset instructions have been sent to your email',
        note: 'Please check your inbox (and spam folder) for the reset link.'
      });

    } catch (emailError: any) {
      console.error("✗ Failed to send email:", emailError.message);

      // Delete the token since email failed
      await prisma.passwordReset.deleteMany({
        where: { email }
      });

      // Determine the specific error type
      let userMessage = 'We encountered an issue sending the reset email.';
      let errorDetails = '';

      if (emailError.code === 'EAUTH' || emailError.code === 'EENVELOPE') {
        // Authentication or envelope error
        userMessage = 'Email authentication failed. Our email service is having issues.';
        errorDetails = 'Please try again in 15-20 minutes or contact support if the problem continues.';
      } else if (emailError.code === 'ECONNECTION' || emailError.code === 'ETIMEDOUT') {
        // Connection/timeout error
        userMessage = 'Cannot connect to email server at the moment.';
        errorDetails = 'This is usually a temporary issue. Please try again in a few minutes.';
      } else if (emailError.responseCode && emailError.responseCode >= 500) {
        // Server error from email provider
        userMessage = 'Our email service provider is experiencing issues.';
        errorDetails = 'Please try again in 30 minutes. We apologize for the inconvenience.';
      } else if (emailError.message?.includes('quota') || emailError.message?.includes('limit')) {
        // Rate limiting or quota exceeded
        userMessage = 'Email sending limit reached temporarily.';
        errorDetails = 'Please wait for 1 hour before trying again, or contact support for immediate assistance.';
      } else {
        // Generic email error
        userMessage = 'We were unable to send the reset email.';
        errorDetails = 'Please try again in a few minutes. If the problem continues, please contact our support team.';
      }

      return res.status(502).json({
        error: userMessage,
        details: errorDetails,
        suggestion: 'You can also try using a different email address if you have one registered.'
      });
    }

  } catch (error) {
    console.error("Request password reset error:", error);
    
    // Check if it's a database error
    if (error instanceof Error && error.message.includes('prisma') || error instanceof Error && error.message.includes('database')) {
      return res.status(500).json({ 
        error: 'Unable to process your request due to a database issue.',
        details: 'Please try again in a few minutes. Our technical team has been notified.'
      });
    }
    
    return res.status(500).json({ 
      error: 'Unable to process your password reset request. Please try again later.',
      details: 'If this problem continues, please contact our support team.'
    });
  }
};

// ---------------------------------------------
// RESET PASSWORD
// ---------------------------------------------
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ 
        error: 'Reset token is missing. Please use the reset link from your email.' 
      });
    }

    if (!newPassword) {
      return res.status(400).json({ 
        error: 'Please enter a new password' 
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Check for common weak passwords (optional)
    const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123', 'letmein', 'welcome'];
    if (weakPasswords.includes(newPassword.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Please choose a stronger password. Avoid common words and sequences.' 
      });
    }

    // Find token in DB
    const resetRecord = await prisma.passwordReset.findFirst({
      where: { token },
      orderBy: { createdAt: "desc" }
    });

    if (!resetRecord) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset link. Please request a new password reset.' 
      });
    }

    // Token expiry check: 15 minutes
    const tokenAge = Date.now() - resetRecord.createdAt.getTime();
    const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
    if (tokenAge > TOKEN_EXPIRY_MS) {
      // Clean up expired token
      await prisma.passwordReset.delete({
        where: { id: resetRecord.id }
      });
      return res.status(400).json({ 
        error: 'This reset link has expired. Please request a new one.' 
      });
    }

    // Get the user by email
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email }
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'User account not found. Please contact support.' 
      });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        error: 'New password must be different from your current password' 
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword }
    });

    // Delete all reset tokens for this user
    await prisma.passwordReset.deleteMany({
      where: { email: resetRecord.email }
    });

    // Send confirmation email (but don't fail the reset if email fails)
    if (transporter) {
      try {
        const mailOptions = {
          from: `"${process.env.EMAIL_FROM_NAME || 'Your App'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
          to: user.email,
          subject: "Your Password Has Been Updated",
          html: `
            <!DOCTYPE html>
            <html>
            <body>
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Password Successfully Updated</h2>
                <p>Your password has been changed successfully on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.</p>
                <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>🔒 Security Note:</strong> If you did not make this change, please contact our support team immediately.</p>
                </div>
                <p>You can now log in to your account with your new password.</p>
                <div style="margin-top: 30px; font-size: 12px; color: #666;">
                  <p>Thank you,<br>The ${process.env.EMAIL_FROM_NAME || 'Application'} Team</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Your password has been changed successfully on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.\n\nIf you did not make this change, please contact our support team immediately.\n\nYou can now log in to your account with your new password.`,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✓ Password reset confirmation sent to ${user.email}`);
        
        return res.json({ 
          message: 'Your password has been updated successfully!',
          details: 'A confirmation email has been sent to your inbox. You can now log in with your new password.',
          note: 'Please check your spam folder if you don\'t see the confirmation email.'
        });

      } catch (emailError: any) {
        console.error("✗ Failed to send confirmation email:", emailError.message);
        // Password was still reset successfully, so continue
        return res.json({ 
          message: 'Your password has been updated successfully!',
          warning: 'Note: We were unable to send a confirmation email. You can still log in with your new password.',
          suggestion: 'If you have any concerns, please contact our support team.'
        });
      }
    } else {
      // Email service not available, but password was reset
      console.warn('Email service not available for confirmation');
      return res.json({ 
        message: 'Your password has been updated successfully!',
        warning: 'Note: Email service is currently unavailable. You can still log in with your new password.',
        suggestion: 'Please save your new password in a secure place.'
      });
    }

  } catch (error) {
    console.error("Reset password error:", error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('bcrypt') || error.message.includes('hash')) {
        return res.status(500).json({ 
          error: 'Unable to process your new password.',
          details: 'Please try again with a different password.'
        });
      }
      
      if (error.message.includes('prisma') || error.message.includes('database')) {
        return res.status(500).json({ 
          error: 'Database error while updating your password.',
          details: 'Please try again. If the problem persists, contact support.'
        });
      }
    }
    
    return res.status(500).json({ 
      error: 'Unable to reset your password. Please try again.',
      details: 'If this continues, please use the "Forgot Password" option again or contact support.'
    });
  }
};