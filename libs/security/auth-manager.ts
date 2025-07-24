/**
 * User Authentication and Authorization System
 * 
 * Provides JWT-based authentication with role-based access control,
 * session management, and secure user credential handling.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// User and authentication types
export interface User {
  id: string;
  email: string;
  username: string;
  hashedPassword: string;
  roles: string[];
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  createdAt: number;
  lastLogin?: number;
  loginAttempts: number;
  lockedUntil?: number;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  metadata: Record<string, any>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
  status: 'active' | 'expired' | 'revoked';
}

export interface LoginAttempt {
  id: string;
  identifier: string; // email or username
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: number;
  failureReason?: string;
}

// Validation schemas
export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

export const LoginSchema = z.object({
  identifier: z.string(), // email or username
  password: z.string(),
  mfaCode: z.string().length(6).optional(),
  rememberMe: z.boolean().optional(),
});

/**
 * Authentication Manager
 */
export class AuthManager {
  private static instance: AuthManager;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private loginAttempts: LoginAttempt[] = [];
  private jwtSecret: string;
  private refreshSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.refreshSecret = process.env.REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
    
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set in environment. Using generated secret (not recommended for production)');
    }

    this.startSessionCleanup();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Register a new user
   */
  async registerUser(data: z.infer<typeof UserRegistrationSchema>): Promise<{
    success: boolean;
    user?: Omit<User, 'hashedPassword'>;
    error?: string;
  }> {
    try {
      // Validate input
      const validated = UserRegistrationSchema.parse(data);

      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(
        u => u.email === validated.email || u.username === validated.username
      );

      if (existingUser) {
        return { 
          success: false, 
          error: existingUser.email === validated.email ? 'Email already registered' : 'Username already taken'
        };
      }

      // Hash password
      const saltRounds = 12;
      const userHashedPassword = await bcrypt.hash(validated.password, saltRounds);

      // Create user
      const userId = `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const user: User = {
        id: userId,
        email: validated.email,
        username: validated.username,
        hashedPassword: userHashedPassword,
        roles: ['user'], // Default role
        permissions: ['read:profile', 'update:profile'],
        status: 'pending_verification',
        createdAt: Date.now(),
        loginAttempts: 0,
        emailVerified: false,
        mfaEnabled: false,
        metadata: {
          firstName: validated.firstName,
          lastName: validated.lastName,
          registrationIp: 'unknown', // Would be set from request context
        },
      };

      this.users.set(userId, user);

      console.log(`New user registered: ${validated.email} (${userId})`);

      // Return user without sensitive data
      const { hashedPassword, mfaSecret, ...safeUser } = user;
      return { success: true, user: safeUser };

    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors[0].message };
      }
      return { success: false, error: 'Registration failed' };
    }
  }

  /**
   * Authenticate user and create session
   */
  async login(data: z.infer<typeof LoginSchema>, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    tokens?: AuthToken;
    user?: Omit<User, 'hashedPassword'>;
    error?: string;
    requiresMfa?: boolean;
  }> {
    const attemptId = `attempt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    try {
      const validated = LoginSchema.parse(data);

      // Find user by email or username
      const user = Array.from(this.users.values()).find(
        u => u.email === validated.identifier || u.username === validated.identifier
      );

      // Log attempt
      this.loginAttempts.push({
        id: attemptId,
        identifier: validated.identifier,
        ipAddress: context?.ipAddress || 'unknown',
        userAgent: context?.userAgent || 'unknown',
        success: false,
        timestamp: Date.now(),
      });

      if (!user) {
        this.updateLoginAttempt(attemptId, false, 'User not found');
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if account is locked
      if (user.lockedUntil && Date.now() < user.lockedUntil) {
        this.updateLoginAttempt(attemptId, false, 'Account locked');
        return { success: false, error: 'Account temporarily locked' };
      }

      // Check account status
      if (user.status === 'suspended') {
        this.updateLoginAttempt(attemptId, false, 'Account suspended');
        return { success: false, error: 'Account suspended' };
      }

      if (user.status === 'inactive') {
        this.updateLoginAttempt(attemptId, false, 'Account inactive');
        return { success: false, error: 'Account inactive' };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(validated.password, user.hashedPassword);
      if (!passwordValid) {
        user.loginAttempts++;
        
        // Lock account after 5 failed attempts
        if (user.loginAttempts >= 5) {
          user.lockedUntil = Date.now() + (30 * 60 * 1000); // 30 minutes
          this.updateLoginAttempt(attemptId, false, 'Too many failed attempts - account locked');
          return { success: false, error: 'Account locked due to too many failed attempts' };
        }

        this.updateLoginAttempt(attemptId, false, 'Invalid password');
        return { success: false, error: 'Invalid credentials' };
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!validated.mfaCode) {
          return { success: false, requiresMfa: true, error: 'MFA code required' };
        }

        const mfaValid = this.verifyMfaCode(user.mfaSecret!, validated.mfaCode);
        if (!mfaValid) {
          this.updateLoginAttempt(attemptId, false, 'Invalid MFA code');
          return { success: false, error: 'Invalid MFA code' };
        }
      }

      // Reset failed attempts on successful login
      user.loginAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLogin = Date.now();

      // Create session and tokens
      const tokens = await this.createSession(user, {
        rememberMe: validated.rememberMe,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      this.updateLoginAttempt(attemptId, true);

      console.log(`User logged in: ${user.email} (${user.id})`);

      // Return user without sensitive data
      const { hashedPassword, mfaSecret, ...safeUser } = user;
      return { success: true, tokens, user: safeUser };

    } catch (error) {
      this.updateLoginAttempt(attemptId, false, error.message);
      
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors[0].message };
      }
      return { success: false, error: 'Login failed' };
    }
  }

  /**
   * Logout user and revoke session
   */
  async logout(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'revoked';
    this.sessions.delete(sessionId);

    console.log(`User logged out - session revoked: ${sessionId}`);
    return true;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as any;
      const session = this.sessions.get(decoded.sessionId);

      if (!session || session.status !== 'active') {
        return { success: false, error: 'Invalid session' };
      }

      if (Date.now() > session.expiresAt) {
        session.status = 'expired';
        return { success: false, error: 'Session expired' };
      }

      const user = this.users.get(session.userId);
      if (!user || user.status !== 'active') {
        return { success: false, error: 'User not active' };
      }

      // Generate new access token
      const accessToken = jwt.sign(
        {
          userId: user.id,
          sessionId: session.id,
          roles: user.roles,
          permissions: user.permissions,
        },
        this.jwtSecret,
        { expiresIn: '15m' }
      );

      session.accessToken = accessToken;
      session.lastActivity = Date.now();

      return { success: true, accessToken };

    } catch (error) {
      return { success: false, error: 'Invalid refresh token' };
    }
  }

  /**
   * Verify access token and get user info
   */
  async verifyToken(token: string): Promise<{
    valid: boolean;
    user?: Omit<User, 'hashedPassword'>;
    session?: Session;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      const session = this.sessions.get(decoded.sessionId);

      if (!session || session.status !== 'active') {
        return { valid: false, error: 'Invalid session' };
      }

      const user = this.users.get(decoded.userId);
      if (!user) {
        return { valid: false, error: 'User not found' };
      }

      if (user.status !== 'active') {
        return { valid: false, error: 'User not active' };
      }

      // Update last activity
      session.lastActivity = Date.now();

      // Return user without sensitive data
      const { hashedPassword, mfaSecret, ...safeUser } = user;
      return { valid: true, user: safeUser, session };

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      }
      return { valid: false, error: 'Invalid token' };
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || 
           user.roles.some(role => this.getRolePermissions(role).includes(permission));
  }

  /**
   * Check if user has role
   */
  hasRole(user: User, role: string): boolean {
    return user.roles.includes(role);
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): Omit<User, 'hashedPassword'> | null {
    const user = this.users.get(userId);
    if (!user) return null;

    const { hashedPassword, mfaSecret, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<Pick<User, 'email' | 'username' | 'roles' | 'permissions' | 'status' | 'metadata'>>): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    Object.assign(user, updates);
    console.log(`User updated: ${userId}`);
    return true;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const currentValid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!currentValid) {
      return { success: false, error: 'Current password incorrect' };
    }

    // Hash new password
    const saltRounds = 12;
    user.hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    console.log(`Password changed for user: ${userId}`);
    return { success: true };
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId && session.status === 'active');
  }

  /**
   * Revoke all user sessions
   */
  revokeAllUserSessions(userId: string): number {
    const userSessions = this.getUserSessions(userId);
    
    for (const session of userSessions) {
      session.status = 'revoked';
      this.sessions.delete(session.id);
    }

    console.log(`Revoked ${userSessions.length} sessions for user: ${userId}`);
    return userSessions.length;
  }

  /**
   * Get login attempts for analysis
   */
  getLoginAttempts(hours: number = 24): LoginAttempt[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.loginAttempts.filter(attempt => attempt.timestamp >= cutoff);
  }

  /**
   * Create session and tokens
   */
  private async createSession(user: User, options?: {
    rememberMe?: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthToken> {
    const sessionId = `session_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresIn = options?.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 1 day

    // Create access token (short-lived)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        sessionId,
        roles: user.roles,
        permissions: user.permissions,
      },
      this.jwtSecret,
      { expiresIn: '15m' }
    );

    // Create refresh token (long-lived)
    const refreshToken = jwt.sign(
      { sessionId },
      this.refreshSecret,
      { expiresIn: options?.rememberMe ? '30d' : '1d' }
    );

    // Store session
    const session: Session = {
      id: sessionId,
      userId: user.id,
      accessToken,
      refreshToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
      lastActivity: Date.now(),
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      status: 'active',
    };

    this.sessions.set(sessionId, session);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      tokenType: 'Bearer',
    };
  }

  /**
   * Update login attempt record
   */
  private updateLoginAttempt(attemptId: string, success: boolean, failureReason?: string): void {
    const attempt = this.loginAttempts.find(a => a.id === attemptId);
    if (attempt) {
      attempt.success = success;
      attempt.failureReason = failureReason;
    }
  }

  /**
   * Verify MFA code (simplified TOTP implementation)
   */
  private verifyMfaCode(secret: string, code: string): boolean {
    // Simplified MFA verification - in production, use a proper TOTP library
    const window = Math.floor(Date.now() / 30000);
    const expectedCode = crypto.createHmac('sha1', secret)
      .update(window.toString())
      .digest('hex')
      .slice(-6);
    
    return code === expectedCode;
  }

  /**
   * Get permissions for role
   */
  private getRolePermissions(role: string): string[] {
    const rolePermissions = {
      user: ['read:profile', 'update:profile'],
      admin: ['read:profile', 'update:profile', 'read:users', 'manage:users', 'read:system'],
      superadmin: ['*'], // All permissions
    };

    return rolePermissions[role] || [];
  }

  /**
   * Clean up expired sessions
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now > session.expiresAt || session.status !== 'active') {
          expired.push(sessionId);
        }
      }

      for (const sessionId of expired) {
        this.sessions.delete(sessionId);
      }

      if (expired.length > 0) {
        console.log(`Cleaned up ${expired.length} expired sessions`);
      }

      // Clean up old login attempts (keep 7 days)
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      this.loginAttempts = this.loginAttempts.filter(attempt => attempt.timestamp >= weekAgo);

    }, 60 * 60 * 1000); // Run every hour
  }
}

// Global instance
export const authManager = AuthManager.getInstance();