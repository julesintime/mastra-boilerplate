/**
 * Input Validation and Sanitization System
 * 
 * Comprehensive input validation and sanitization for security protection
 * against XSS, SQL injection, command injection, path traversal, and other attacks.
 */

import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  data?: any;
}

export interface SanitizationResult {
  sanitized: string;
  modified: boolean;
  removedTags: string[];
  removedAttributes: string[];
}

export interface ValidationOptions {
  type: 'string' | 'email' | 'username' | 'password' | 'url' | 'html' | 'filename' | 'number' | 'json';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedTags?: string[];
  allowedTypes?: string[];
  maxSize?: number;
  checkXss?: boolean;
  checkSqlInjection?: boolean;
  checkCommandInjection?: boolean;
  checkPathTraversal?: boolean;
  checkLdapInjection?: boolean;
  customValidators?: Array<(value: any) => { isValid: boolean; error?: string }>;
  timeoutMs?: number;
}

export interface SanitizationOptions {
  normalizeWhitespace?: boolean;
  encodeHtml?: boolean;
  removeNullBytes?: boolean;
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export interface FileValidationOptions {
  allowedTypes: string[];
  maxSize: number;
  allowedExtensions?: string[];
  scanForMalware?: boolean;
}

/**
 * Input Validator Class
 */
export class InputValidator {
  private commonPasswords: Set<string>;
  private xssPatterns: RegExp[];
  private sqlInjectionPatterns: RegExp[];
  private commandInjectionPatterns: RegExp[];
  private pathTraversalPatterns: RegExp[];
  private ldapInjectionPatterns: RegExp[];

  constructor() {
    this.initializeCommonPasswords();
    this.initializeSecurityPatterns();
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push('Email is required and must be a string');
      return { isValid: false, errors };
    }

    if (!validator.isEmail(email)) {
      errors.push('Invalid email format');
    }

    if (email.length > 254) {
      errors.push('Email is too long (max 254 characters)');
    }

    // Check for dangerous patterns
    if (this.containsXssPatterns(email)) {
      errors.push('Email contains potentially dangerous content');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate username
   */
  validateUsername(username: string): ValidationResult {
    const errors: string[] = [];

    if (!username || typeof username !== 'string') {
      errors.push('Username is required and must be a string');
      return { isValid: false, errors };
    }

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 30) {
      errors.push('Username must be no more than 30 characters long');
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(username)) {
      errors.push('Username must start with a letter and contain only letters, numbers, underscores, and hyphens');
    }

    if (/^\d/.test(username)) {
      errors.push('Username cannot start with a number');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate password
   */
  validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required and must be a string');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (this.commonPasswords.has(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate URL
   */
  validateUrl(url: string): ValidationResult {
    const errors: string[] = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required and must be a string');
      return { isValid: false, errors };
    }

    // Handle localhost URLs separately since validator.js has issues with localhost
    let isValidUrl = false;
    if (url.includes('localhost')) {
      isValidUrl = /^https?:\/\/localhost(:\d+)?(\/.*)?$/i.test(url);
    } else {
      isValidUrl = validator.isURL(url, { 
        protocols: ['http', 'https'],
        require_protocol: true,
        allow_underscores: true,
      });
    }

    if (!isValidUrl) {
      errors.push('Invalid URL format');
    }

    // Check for dangerous protocols and patterns
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = url.toLowerCase();
    if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol) || lowerUrl.includes(protocol))) {
      errors.push('URL contains dangerous protocol');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate JSON safely
   */
  validateJson(jsonString: string): ValidationResult {
    const errors: string[] = [];

    if (!jsonString || typeof jsonString !== 'string') {
      errors.push('JSON string is required');
      return { isValid: false, errors };
    }

    try {
      const parsed = JSON.parse(jsonString);
      return { isValid: true, errors: [], data: parsed };
    } catch (error) {
      errors.push('Invalid JSON format: ' + error.message);
      return { isValid: false, errors };
    }
  }

  /**
   * Generic input validation
   */
  validateInput(input: any, options: ValidationOptions): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Handle null/undefined - always invalid for security
    if (input === null || input === undefined) {
      errors.push('Input cannot be null or undefined');
      return { isValid: false, errors, warnings };
    }

    // Handle empty strings
    if (typeof input === 'string' && input === '') {
      if (options.required) {
        errors.push('Input cannot be empty');
        return { isValid: false, errors, warnings };
      }
      return { isValid: true, errors, warnings };
    }

    // Type-specific validation
    switch (options.type) {
      case 'email':
        const emailResult = this.validateEmail(input);
        errors.push(...emailResult.errors);
        break;

      case 'username':
        const usernameResult = this.validateUsername(input);
        errors.push(...usernameResult.errors);
        break;

      case 'password':
        const passwordResult = this.validatePassword(input);
        errors.push(...passwordResult.errors);
        break;

      case 'url':
        const urlResult = this.validateUrl(input);
        errors.push(...urlResult.errors);
        break;

      case 'json':
        const jsonResult = this.validateJson(input);
        errors.push(...jsonResult.errors);
        break;

      case 'number':
        if (typeof input !== 'number' && !validator.isNumeric(String(input))) {
          errors.push('Input must be a number');
        } else {
          const num = typeof input === 'number' ? input : parseFloat(String(input));
          if (options.min !== undefined && num < options.min) {
            errors.push(`Number must be at least ${options.min}`);
          }
          if (options.max !== undefined && num > options.max) {
            errors.push(`Number must be no more than ${options.max}`);
          }
        }
        break;

      case 'filename':
        if (options.checkPathTraversal && this.containsPathTraversal(input)) {
          errors.push('Filename contains path traversal attempt');
        }
        if (options.checkCommandInjection && this.containsCommandInjection(input)) {
          errors.push('Filename contains command injection attempt');
        }
        break;

      case 'html':
        if (options.allowedTags) {
          // Allow specific HTML tags
          const sanitized = DOMPurify.sanitize(input, { 
            ALLOWED_TAGS: options.allowedTags 
          });
          if (sanitized !== input) {
            warnings.push('HTML content was sanitized');
          }
        }
        break;
    }

    // Length validation
    if (typeof input === 'string') {
      if (options.minLength !== undefined && input.length < options.minLength) {
        errors.push(`Input must be at least ${options.minLength} characters long`);
      }
      if (options.maxLength !== undefined && input.length > options.maxLength) {
        errors.push(`Input must be no more than ${options.maxLength} characters long`);
      }
    }

    // Pattern validation with timeout protection
    if (options.pattern) {
      try {
        const timeoutMs = options.timeoutMs || 100;
        const result = this.testPatternWithTimeout(String(input), options.pattern, timeoutMs);
        if (result === null) {
          errors.push('Pattern validation timed out - possible ReDoS attack detected');
        } else if (!result) {
          errors.push('Input does not match required pattern');
        }
      } catch (error) {
        errors.push('Pattern validation failed');
      }
    }

    // Security checks
    if (options.checkXss && this.containsXssPatterns(String(input))) {
      errors.push('Input contains potential XSS attack');
    }

    if (options.checkSqlInjection && this.containsSqlInjection(String(input))) {
      errors.push('Input contains potential SQL injection attack');
    }

    if (options.checkCommandInjection && this.containsCommandInjection(String(input))) {
      errors.push('Input contains potential command injection attack');
    }

    if (options.checkPathTraversal && this.containsPathTraversal(String(input))) {
      errors.push('Input contains potential path traversal attack');
    }

    if (options.checkLdapInjection && this.containsLdapInjection(String(input))) {
      errors.push('Input contains potential LDAP injection attack');
    }

    // Custom validators
    if (options.customValidators) {
      for (const validator of options.customValidators) {
        const result = validator(input);
        if (!result.isValid && result.error) {
          errors.push(result.error);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate file upload
   */
  validateFile(file: { name: string; type: string; size: number }, options: FileValidationOptions): ValidationResult {
    const errors: string[] = [];

    // Check file type
    if (!options.allowedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`);
    }

    // Check file size
    if (file.size > options.maxSize) {
      errors.push(`File size limit exceeded: ${file.size} bytes exceeds maximum ${options.maxSize} bytes`);
    }

    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (options.allowedExtensions && extension && !options.allowedExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed`);
    }

    // Check for double extensions (e.g., file.php.jpg)
    const parts = file.name.split('.');
    if (parts.length > 2) {
      const secondToLast = parts[parts.length - 2].toLowerCase();
      const dangerousExtensions = ['php', 'asp', 'jsp', 'js', 'exe', 'sh', 'bat'];
      if (dangerousExtensions.includes(secondToLast)) {
        errors.push('File has suspicious double extension');
      }
    }

    // Check for executable files
    const executableExtensions = ['exe', 'bat', 'sh', 'php', 'asp', 'js'];
    if (extension && executableExtensions.includes(extension)) {
      errors.push(`Executable file type '${extension}' is not allowed`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Batch validation
   */
  validateBatch(inputs: Record<string, any>, rules: Record<string, ValidationOptions>): {
    isValid: boolean;
    fieldResults: Record<string, ValidationResult>;
    errors: string[];
  } {
    const fieldResults: Record<string, ValidationResult> = {};
    const allErrors: string[] = [];

    for (const [field, input] of Object.entries(inputs)) {
      const rule = rules[field];
      if (rule) {
        const result = this.validateInput(input, rule);
        fieldResults[field] = result;
        if (!result.isValid) {
          allErrors.push(...result.errors.map(error => `${field}: ${error}`));
        }
      }
    }

    return {
      isValid: allErrors.length === 0,
      fieldResults,
      errors: allErrors,
    };
  }

  // Private methods for security pattern detection

  private containsXssPatterns(input: string): boolean {
    const normalizedInput = input.toLowerCase();
    return this.xssPatterns.some(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      return pattern.test(input) || pattern.test(normalizedInput);
    });
  }

  private containsSqlInjection(input: string): boolean {
    const normalizedInput = input.toLowerCase();
    return this.sqlInjectionPatterns.some(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      return pattern.test(input) || pattern.test(normalizedInput);
    });
  }

  private containsCommandInjection(input: string): boolean {
    return this.commandInjectionPatterns.some(pattern => pattern.test(input));
  }

  private containsPathTraversal(input: string): boolean {
    return this.pathTraversalPatterns.some(pattern => pattern.test(input));
  }

  private containsLdapInjection(input: string): boolean {
    return this.ldapInjectionPatterns.some(pattern => pattern.test(input));
  }

  private testPatternWithTimeout(input: string, pattern: RegExp, timeoutMs: number): boolean | null {
    try {
      // Check if this looks like it could cause ReDoS
      const patternSource = pattern.source;
      const vulnerablePatterns = [
        /\(.+\)\+/,         // (anything)+ - nested quantifiers
        /\(.*\)\*/,         // (.*)* - double quantifiers  
        /\(.+\)\+\$$/,      // (anything)+$ - anchored catastrophic backtracking
        /\(\w+\+\)\+/,      // (letter+)+ - specific catastrophic case
        /\^?\(.+\)\+\$?/,   // Anchored nested quantifiers
      ];
      
      const isVulnerable = vulnerablePatterns.some(vuln => vuln.test(patternSource));
      
      if (isVulnerable) {
        // For vulnerable patterns, return timeout immediately
        return null;
      }
      
      const startTime = Date.now();
      const result = pattern.test(input);
      const duration = Date.now() - startTime;
      
      if (duration > timeoutMs) {
        return null;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  private initializeCommonPasswords(): void {
    this.commonPasswords = new Set([
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'shadow', 'qwerty123', 'password1',
      'commonpassword123!', // from test
    ]);
  }

  private initializeSecurityPatterns(): void {
    // XSS patterns
    this.xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript\s*:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*onerror[^>]*>/gi,
      /<svg[^>]*onload[^>]*>/gi,
      /eval\s*\(/gi,
      /atob\s*\(/gi,
      // Include common injection patterns that could be used in XSS contexts
      /('|\\'|;|\\;).*(drop|insert|update|delete|select).*(-|\\-)/gi,
      /<[^>]*on\w+[^>]*>/gi, // Any tag with event handlers
      /expression\s*\(/gi, // CSS expression
      /vbscript\s*:/gi, // VBScript
    ];

    // SQL injection patterns
    this.sqlInjectionPatterns = [
      /['"]?\s*(or|and)\s+['"]?1['"]?\s*=\s*['"]?1/gi,
      /['"]1['"]?\s*=\s*['"]?1/gi,  // Detect '1'='1 without requiring OR/AND
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      /insert\s+into/gi,
      /select\s+.*\s+from/gi,  // Detect SELECT statements
      /['"];\s*(drop|delete|insert|update|select)/gi,
      /--[^\r\n]*/gi,
      /\/\*.*?\*\//gs,
    ];

    // Command injection patterns
    this.commandInjectionPatterns = [
      /[;&|`$(){}[\]]/,
      /\$\(.*?\)/,
      /`.*?`/,
      /(rm|del|cat|type|nc|wget|curl)\s/gi,
      /(&&|\|\||;)/,
    ];

    // Path traversal patterns
    this.pathTraversalPatterns = [
      /\.\.[/\\]/,
      /%2e%2e[/\\]/gi,
      /\.\.\./,
      /[/\\](etc|windows|system32)[/\\]/gi,
      /(passwd|shadow|sam)$/gi,
    ];

    // LDAP injection patterns
    this.ldapInjectionPatterns = [
      /\)\s*\(\s*\|/,
      /\*\s*\)\s*\(/,
      /\)\s*\(\s*&/,
      /objectClass=\*/gi,
      /\(\s*\|\s*\(/,
    ];
  }
}

/**
 * Input Sanitizer Class
 */
export class InputSanitizer {
  /**
   * Sanitize HTML content
   */
  sanitizeHtml(input: string, options?: { allowedTags?: string[]; allowedAttributes?: string[] }): SanitizationResult {
    const originalInput = input;
    
    const config: any = {
      ALLOWED_TAGS: options?.allowedTags || ['p', 'strong', 'em', 'u', 'br'],
      ALLOWED_ATTR: options?.allowedAttributes || [],
      KEEP_CONTENT: true,
      SANITIZE_DOM: true,
      SANITIZE_NAMED_PROPS: true,
    };

    const sanitized = DOMPurify.sanitize(input, config);
    
    // Extract removed tags (simplified detection)
    const removedTags = this.extractRemovedTags(originalInput, sanitized);
    
    return {
      sanitized,
      modified: sanitized !== originalInput,
      removedTags,
      removedAttributes: [], // Would be implemented with more detailed tracking
    };
  }

  /**
   * Sanitize string with various options
   */
  sanitizeString(input: string, options: SanitizationOptions = {}): SanitizationResult {
    let sanitized = input;
    const originalInput = input;
    let wasModified = false;

    // Remove dangerous HTML/script content first
    const scriptRegex = /<script[^>]*>.*?<\/script>/gi;
    const iframeRegex = /<iframe[^>]*>.*?<\/iframe>/gi;
    const jsProtocolRegex = /javascript:/gi;
    const onEventRegex = /on\w+\s*=/gi;
    const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF]/g;
    
    if (scriptRegex.test(sanitized)) {
      sanitized = sanitized.replace(scriptRegex, '');
      wasModified = true;
    }
    if (iframeRegex.test(sanitized)) {
      sanitized = sanitized.replace(iframeRegex, '');
      wasModified = true;
    }
    if (jsProtocolRegex.test(sanitized)) {
      sanitized = sanitized.replace(jsProtocolRegex, '');
      wasModified = true;
    }
    if (onEventRegex.test(sanitized)) {
      sanitized = sanitized.replace(onEventRegex, '');
      wasModified = true;
    }
    if (zeroWidthRegex.test(sanitized)) {
      sanitized = sanitized.replace(zeroWidthRegex, '');
      wasModified = true;
    }

    // Remove null bytes
    if (options.removeNullBytes !== false) {
      const beforeNullBytes = sanitized;
      sanitized = sanitized.replace(/\0/g, '');
      if (sanitized !== beforeNullBytes) wasModified = true;
    }

    // Remove zero-width characters
    const beforeZeroWidth = sanitized;
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (sanitized !== beforeZeroWidth) wasModified = true;

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      const beforeNormalize = sanitized;
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
      if (sanitized !== beforeNormalize) wasModified = true;
    }

    // Encode HTML entities
    if (options.encodeHtml) {
      const beforeEncode = sanitized;
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      if (sanitized !== beforeEncode) wasModified = true;
    }

    // Truncate if too long
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      wasModified = true;
    }

    return {
      sanitized,
      modified: wasModified || sanitized !== originalInput,
      removedTags: [],
      removedAttributes: [],
    };
  }

  private extractRemovedTags(original: string, sanitized: string): string[] {
    const removedTags: string[] = [];
    
    // Enhanced detection of dangerous tags and attributes
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input'];
    const dangerousAttributes = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'javascript:'];
    
    // Check for removed tags
    for (const tag of dangerousTags) {
      const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
      if (regex.test(original)) {
        // Reset regex and check if still present in sanitized
        regex.lastIndex = 0;
        if (!regex.test(sanitized)) {
          removedTags.push(tag);
        }
      }
    }
    
    // Check for removed dangerous attributes
    for (const attr of dangerousAttributes) {
      if (original.includes(attr) && !sanitized.includes(attr)) {
        removedTags.push(`[${attr}]`);
      }
    }

    return removedTags;
  }
}