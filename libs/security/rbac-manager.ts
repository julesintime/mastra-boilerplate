/**
 * Role-Based Access Control (RBAC) Manager
 * 
 * Comprehensive RBAC system with role hierarchy, permission inheritance,
 * caching, audit logging, and integration with the authentication system.
 */

import { z } from 'zod';
import crypto from 'crypto';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  parentRoles?: string[];
  status: 'active' | 'inactive' | 'deprecated';
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, any>;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  metadata: Record<string, any>;
}

export interface PermissionCondition {
  type: 'owner' | 'time' | 'ip' | 'custom';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  field?: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  assignedAt: number;
  assignedBy: string;
  expiresAt?: number;
  conditions?: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  action: string;
  roleName?: string;
  userId?: string;
  timestamp: number;
  metadata: Record<string, any>;
}

// Validation schemas
const RoleSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_:-]+$/, 'Invalid role name format'),
  description: z.string().min(1).max(200),
  permissions: z.array(z.string()),
  parentRoles: z.array(z.string()).optional(), 
  metadata: z.record(z.any()).optional(),
});

const PermissionSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_*]+:[a-zA-Z0-9_*]+$/, 'Permission must follow resource:action format'),
  description: z.string().min(1).max(200),
  resource: z.string().min(1),
  action: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

/**
 * RBAC Manager
 */
export class RoleManager {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private userRoles: Map<string, Set<string>> = new Map(); // userId -> roleIds
  private roleUsers: Map<string, Set<string>> = new Map(); // roleId -> userIds
  private permissionCache: Map<string, boolean> = new Map();
  private auditLog: AuditEvent[] = [];
  private restrictedPermissions: Set<string> = new Set([
    'admin:nuclear',
    'system:destroy',
    'admin:sudo'
  ]);

  constructor() {
    this.loadDefaultRoles();
    this.startCacheCleanup();
  }

  /**
   * Create a new role
   */
  async createRole(data: z.infer<typeof RoleSchema>): Promise<{
    success: boolean;
    role?: Role;
    error?: string;
  }> {
    try {
      const validated = RoleSchema.parse(data);

      // Check if role already exists
      if (this.roles.has(validated.name)) {
        return { success: false, error: `Role '${validated.name}' already exists` };
      }

      // Validate permissions exist and are not restricted
      for (const permission of validated.permissions) {
        if (this.restrictedPermissions.has(permission)) {
          return { success: false, error: `Permission '${permission}' is restricted` };
        }
        
        if (!this.permissions.has(permission) && !this.isWildcardPermission(permission)) {
          // Auto-create permission if it follows proper format
          const [resource, action] = permission.split(':');
          await this.createPermission({
            name: permission,
            description: `Auto-created permission for ${resource} ${action}`,
            resource,
            action,
          });
        }
      }

      // Check for circular dependencies
      if (validated.parentRoles) {
        if (this.wouldCreateCircularDependency(validated.name, validated.parentRoles)) {
          return { success: false, error: 'Would create circular role dependency' };
        }
      }

      const role: Role = {
        id: `role_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        name: validated.name,
        description: validated.description,
        permissions: validated.permissions,
        parentRoles: validated.parentRoles,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: validated.metadata || {},
      };

      this.roles.set(validated.name, role);
      this.invalidateCache();
      
      await this.logAuditEvent({
        action: 'role_created',
        roleName: validated.name,
        userId: 'system',
        timestamp: Date.now(),
        metadata: { permissions: validated.permissions }
      });

      return { success: true, role };

    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors[0].message };
      }
      return { success: false, error: 'Failed to create role' };
    }
  }

  /**
   * Update existing role
   */
  async updateRole(roleName: string, updates: Partial<Pick<Role, 'description' | 'permissions' | 'parentRoles' | 'status' | 'metadata'>>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const role = this.roles.get(roleName);
    if (!role) {
      return { success: false, error: 'Role not found' };
    }

    // Check for circular dependencies if updating parent roles
    if (updates.parentRoles) {
      if (this.wouldCreateCircularDependency(roleName, updates.parentRoles)) {
        return { success: false, error: 'Would create circular role dependency' };
      }
    }

    // Validate new permissions
    if (updates.permissions) {
      for (const permission of updates.permissions) {
        if (this.restrictedPermissions.has(permission)) {
          return { success: false, error: `Permission '${permission}' is restricted` };
        }
      }
    }

    Object.assign(role, updates, { updatedAt: Date.now() });
    this.invalidateCache();

    await this.logAuditEvent({
      action: 'role_updated',
      roleName,
      userId: 'system',
      timestamp: Date.now(),
      metadata: updates
    });

    return { success: true };
  }

  /**
   * Delete role
   */
  async deleteRole(roleName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const role = this.roles.get(roleName);
    if (!role) {
      return { success: false, error: 'Role not found' };
    }

    // Check if role has active users
    const usersWithRole = this.getUsersWithRole(roleName);
    if (usersWithRole.length > 0) {
      return { success: false, error: `Cannot delete role with ${usersWithRole.length} active users` };
    }

    this.roles.delete(roleName);
    this.roleUsers.delete(roleName);
    this.invalidateCache();

    await this.logAuditEvent({
      action: 'role_deleted',
      roleName,
      userId: 'system',
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Get role by name
   */
  getRole(roleName: string): Role | null {
    return this.roles.get(roleName) || null;
  }

  /**
   * List all roles with optional filtering
   */
  listRoles(filters?: {
    status?: Role['status'];
    hasPermission?: string;
    parentRole?: string;
  }): Role[] {
    let roles = Array.from(this.roles.values());

    if (filters) {
      if (filters.status) {
        roles = roles.filter(r => r.status === filters.status);
      }
      
      if (filters.hasPermission) {
        roles = roles.filter(r => 
          this.getEffectivePermissions(r.name).includes(filters.hasPermission!)
        );
      }
      
      if (filters.parentRole) {
        roles = roles.filter(r => r.parentRoles?.includes(filters.parentRole!));
      }
    }

    return roles;
  }

  /**
   * Create a new permission
   */
  async createPermission(data: z.infer<typeof PermissionSchema>): Promise<{
    success: boolean;
    permission?: Permission;
    error?: string;
  }> {
    try {
      const validated = PermissionSchema.parse(data);

      if (this.permissions.has(validated.name)) {
        return { success: false, error: `Permission '${validated.name}' already exists` };
      }

      const permission: Permission = {
        id: `perm_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        name: validated.name,
        description: validated.description,
        resource: validated.resource,
        action: validated.action,
        metadata: validated.metadata || {},
      };

      this.permissions.set(validated.name, permission);
      
      return { success: true, permission };

    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors[0].message };
      }
      return { success: false, error: 'Failed to create permission' };
    }
  }

  /**
   * Check if a permission matches another (supports wildcards)
   */
  async checkPermission(granted: string, requested: string): Promise<boolean> {
    if (granted === requested) return true;
    if (granted === '*:*') return true;

    const [grantedResource, grantedAction] = granted.split(':');
    const [requestedResource, requestedAction] = requested.split(':');

    return (
      (grantedResource === '*' || grantedResource === requestedResource) &&
      (grantedAction === '*' || grantedAction === requestedAction)
    );
  }

  /**
   * Get effective permissions for a role (including inherited)
   */
  getEffectivePermissions(roleName: string): string[] {
    const role = this.roles.get(roleName);
    if (!role) return [];

    const allPermissions = new Set<string>(role.permissions);

    // Add permissions from parent roles recursively
    if (role.parentRoles) {
      for (const parentRole of role.parentRoles) {
        const parentPermissions = this.getEffectivePermissions(parentRole);
        parentPermissions.forEach(p => allPermissions.add(p));
      }
    }

    return Array.from(allPermissions);
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const role = this.roles.get(roleName);
    if (!role) {
      return { success: false, error: 'Role not found' };
    }

    // Get or create user roles set
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }
    
    // Get or create role users set
    if (!this.roleUsers.has(roleName)) {
      this.roleUsers.set(roleName, new Set());
    }

    this.userRoles.get(userId)!.add(roleName);
    this.roleUsers.get(roleName)!.add(userId);
    this.invalidateUserCache(userId);

    await this.logAuditEvent({
      action: 'role_assigned',
      roleName,
      userId,
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const userRolesSet = this.userRoles.get(userId);
    const roleUsersSet = this.roleUsers.get(roleName);

    if (userRolesSet) {
      userRolesSet.delete(roleName);
    }
    
    if (roleUsersSet) {
      roleUsersSet.delete(userId);
    }

    this.invalidateUserCache(userId);

    await this.logAuditEvent({
      action: 'role_removed',
      roleName,
      userId,
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Get user's roles
   */
  getUserRoles(userId: string): string[] {
    const userRolesSet = this.userRoles.get(userId);
    return userRolesSet ? Array.from(userRolesSet) : [];
  }

  /**
   * Get users with specific role
   */
  getUsersWithRole(roleName: string): string[] {
    const roleUsersSet = this.roleUsers.get(roleName);
    return roleUsersSet ? Array.from(roleUsersSet) : [];
  }

  /**
   * Check if user has specific permission
   */
  async userHasPermission(userId: string, permission: string, context?: Record<string, any>): Promise<boolean> {
    const cacheKey = `${userId}:${permission}:${JSON.stringify(context || {})}`;
    
    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    const userRoles = this.getUserRoles(userId);
    if (userRoles.length === 0) {
      this.permissionCache.set(cacheKey, false);
      return false;
    }

    // Check permissions across all user roles
    for (const roleName of userRoles) {
      const effectivePermissions = this.getEffectivePermissions(roleName);
      
      for (const grantedPermission of effectivePermissions) {
        if (await this.checkPermission(grantedPermission, permission)) {
          // Check conditions if specified
          if (context && await this.checkPermissionConditions(grantedPermission, context)) {
            this.permissionCache.set(cacheKey, true);
            return true;
          } else if (!context) {
            this.permissionCache.set(cacheKey, true);
            return true;
          }
        }
      }
    }

    this.permissionCache.set(cacheKey, false);
    return false;
  }

  /**
   * Check multiple permissions for user
   */
  async userHasPermissions(userId: string, permissions: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const permission of permissions) {
      results[permission] = await this.userHasPermission(userId, permission);
    }

    return results;
  }

  /**
   * Create role from template
   */
  async createRoleFromTemplate(template: {
    name: string;
    description: string;
    permissions: string[];
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    role?: Role;
    error?: string;
  }> {
    return await this.createRole(template);
  }

  /**
   * Create multiple roles in bulk
   */
  async createRolesBulk(roles: Array<{
    name: string;
    description: string;
    permissions: string[];
    metadata?: Record<string, any>;
  }>): Promise<{
    success: boolean;
    created: number;
    errors: Array<{ role: string; error: string; }>;
  }> {
    let created = 0;
    const errors: Array<{ role: string; error: string; }> = [];

    for (const roleData of roles) {
      const result = await this.createRole(roleData);
      if (result.success) {
        created++;
      } else {
        errors.push({ role: roleData.name, error: result.error || 'Unknown error' });
      }
    }

    return {
      success: errors.length === 0,
      created,
      errors,
    };
  }

  /**
   * Export roles for backup/migration
   */
  exportRoles(): {
    roles: Role[];
    permissions: Permission[];
    userRoles: Array<{ userId: string; roles: string[] }>;
  } {
    return {
      roles: Array.from(this.roles.values()),
      permissions: Array.from(this.permissions.values()),
      userRoles: Array.from(this.userRoles.entries()).map(([userId, roles]) => ({
        userId,
        roles: Array.from(roles),
      })),
    };
  }

  /**
   * Import roles from backup/migration
   */
  async importRoles(data: ReturnType<typeof RoleManager.prototype.exportRoles>): Promise<{
    success: boolean;
    imported: { roles: number; permissions: number; assignments: number };
    error?: string;
  }> {
    try {
      // Import permissions first
      for (const permission of data.permissions) {
        this.permissions.set(permission.name, permission);
      }

      // Import roles
      for (const role of data.roles) {
        this.roles.set(role.name, role);
      }

      // Import user role assignments
      for (const { userId, roles } of data.userRoles) {
        this.userRoles.set(userId, new Set(roles));
        
        // Update reverse mapping
        for (const roleName of roles) {
          if (!this.roleUsers.has(roleName)) {
            this.roleUsers.set(roleName, new Set());
          }
          this.roleUsers.get(roleName)!.add(userId);
        }
      }

      this.invalidateCache();

      return {
        success: true,
        imported: {
          roles: data.roles.length,
          permissions: data.permissions.length,
          assignments: data.userRoles.length,
        },
      };

    } catch (error) {
      return {
        success: false,
        imported: { roles: 0, permissions: 0, assignments: 0 },
        error: 'Import failed: ' + error.message,
      };
    }
  }

  /**
   * Validate JWT token permissions
   */
  async validateTokenPermissions(token: {
    userId: string;
    roles: string[];
    permissions: string[];
  }, requiredPermission: string): Promise<boolean> {
    // Check direct token permissions first
    for (const permission of token.permissions) {
      if (await this.checkPermission(permission, requiredPermission)) {
        return true;
      }
    }

    // Check role-based permissions
    return await this.userHasPermission(token.userId, requiredPermission);
  }

  /**
   * Load default system roles
   */
  async loadDefaultRoles(): Promise<void> {
    const defaultRoles = [
      {
        name: 'system:user',
        description: 'Basic user role',
        permissions: ['read:profile', 'update:profile'],
        metadata: { system: true, default: true },
      },
      {
        name: 'system:admin',
        description: 'System administrator',
        permissions: ['*:*'],
        metadata: { system: true },
      },
      {
        name: 'system:moderator',
        description: 'Content moderator',
        permissions: ['read:content', 'moderate:content', 'delete:content'],
        parentRoles: ['system:user'],
        metadata: { system: true },
      },
    ];

    for (const roleData of defaultRoles) {
      if (!this.roles.has(roleData.name)) {
        await this.createRole(roleData);
      }
    }
  }

  /**
   * Check for circular role dependencies
   */
  private wouldCreateCircularDependency(roleName: string, parentRoles: string[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCircle = (role: string): boolean => {
      if (recursionStack.has(role)) return true;
      if (visited.has(role)) return false;

      visited.add(role);
      recursionStack.add(role);

      const roleData = this.roles.get(role);
      if (roleData?.parentRoles) {
        for (const parent of roleData.parentRoles) {
          if (hasCircle(parent)) return true;
        }
      }

      // Check new parent roles for the role being updated
      if (role === roleName) {
        for (const parent of parentRoles) {
          if (hasCircle(parent)) return true;
        }
      }

      recursionStack.delete(role);
      return false;
    };

    return hasCircle(roleName);
  }

  /**
   * Check if permission is a wildcard
   */
  private isWildcardPermission(permission: string): boolean {
    return permission.includes('*');
  }

  /**
   * Check permission conditions
   */
  private async checkPermissionConditions(permission: string, context: Record<string, any>): Promise<boolean> {
    const permissionData = this.permissions.get(permission);
    if (!permissionData?.conditions) return true;

    for (const condition of permissionData.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PermissionCondition, context: Record<string, any>): boolean {
    const contextValue = condition.field ? context[condition.field] : context;

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'contains':
        return String(contextValue).includes(String(condition.value));
      case 'greater_than':
        return Number(contextValue) > Number(condition.value);
      case 'less_than':
        return Number(contextValue) < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(event: Omit<AuditEvent, 'id'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      ...event,
    };

    this.auditLog.push(auditEvent);

    // Keep only recent audit events (last 10000)
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Invalidate all caches
   */
  private invalidateCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Invalidate cache for specific user
   */
  private invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.permissionCache.delete(key);
    }
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    // Clear cache every hour to prevent memory leaks
    setInterval(() => {
      this.invalidateCache();
    }, 60 * 60 * 1000);
  }
}

// Global instance
export const roleManager = new RoleManager();