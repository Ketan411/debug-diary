/**
 * Sensitive Data Redaction Engine (Security Module)
 * Responsible for sanitizing raw commit diffs, logs, and pull requests
 * to ensure zero leakage of credentials, tokens, or API keys before AI processing.
 */

interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const REDACTION_RULES: RedactionRule[] = [
  // 1. OpenAI, Groq, Anthropic, Gemini, GitHub, Stripe API Keys
  {
    name: "OpenAI API Key",
    pattern: /\bsk-(proj-)?[a-zA-Z0-9_-]{20,}\b/g,
    replacement: "[REDACTED_OPENAI_API_KEY]",
  },
  {
    name: "Groq API Key",
    pattern: /\bgsk_[a-zA-Z0-9_]{20,}\b/g,
    replacement: "[REDACTED_GROQ_API_KEY]",
  },
  {
    name: "Gemini API Key",
    pattern: /\bAIzaSy[a-zA-Z0-9_-]{33}\b/g,
    replacement: "[REDACTED_GEMINI_API_KEY]",
  },
  {
    name: "Anthropic API Key",
    pattern: /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
    replacement: "[REDACTED_ANTHROPIC_API_KEY]",
  },
  {
    name: "GitHub Token",
    pattern: /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b|\bgithub_pat_[a-zA-Z0-9_]{22,}\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    name: "Stripe Key",
    pattern: /\b(sk_live|sk_test|rk_live|rk_test)_[a-zA-Z0-9]{24,}\b/g,
    replacement: "[REDACTED_STRIPE_KEY]",
  },

  // 2. AWS Credentials
  {
    name: "AWS Access Key",
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: "[REDACTED_AWS_ACCESS_KEY]",
  },
  {
    name: "AWS Secret Key",
    pattern: /(aws_secret_access_key|aws_secret_key)\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    replacement: "$1=[REDACTED_AWS_SECRET_KEY]",
  },

  // 3. JWT Tokens
  {
    name: "JWT Token",
    pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
    replacement: "[REDACTED_JWT_TOKEN]",
  },

  // 4. Database Connection Strings
  {
    name: "Database URI",
    pattern: /\b(postgres|postgresql|mongodb|mongodb\+srv|mysql|redis):\/\/[^\s'":]+:[^\s'":@]+@[^\s'"]+\b/gi,
    replacement: "$1://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]",
  },

  // 5. Private Keys
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----[\s\S]*?-----END (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },

  // 6. Generic Key-Value Passwords & Secrets
  {
    name: "Generic Secret Assignment",
    pattern: /\b(password|passwd|secret|api_key|apikey|auth_token|access_token|private_key)\s*[:=]\s*["']([^"'\s]{4,})["']/gi,
    replacement: '$1="[REDACTED_SECRET]"',
  },

  // 7. Authorization Bearer Headers
  {
    name: "Bearer Token",
    pattern: /\bBearer\s+[a-zA-Z0-9\._\-]{20,}\b/gi,
    replacement: "Bearer [REDACTED_BEARER_TOKEN]",
  },
];

/**
 * Sanitizes input text by replacing all matched secrets and credentials with safe [REDACTED] placeholders.
 */
export function redactSecrets(text: string): string {
  if (!text) return "";
  let sanitized = text;

  for (const rule of REDACTION_RULES) {
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
  }

  return sanitized;
}

/**
 * Checks whether the input text contains any detectable secrets.
 */
export function containsSecrets(text: string): boolean {
  if (!text) return false;
  return REDACTION_RULES.some((rule) => rule.pattern.test(text));
}
