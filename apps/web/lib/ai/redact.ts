/**
 * PII redaction for synopsis text before sending to AI.
 * Redacts: phone numbers, Aadhaar numbers, email addresses, PAN numbers.
 */

interface RedactionResult {
  redacted: string;
  redactedCount: number;
}

// Indian phone: +91, 0-prefixed, or bare 10-digit
const PHONE_REGEX = /(?:\+91[\s-]?|0)?[6-9]\d{9}\b/g;

// Aadhaar: 12 digits, optionally space/dash separated in groups of 4
const AADHAAR_REGEX = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

// Email
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
const PAN_REGEX = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

const REDACTION_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: AADHAAR_REGEX, label: "[AADHAAR_REDACTED]" },
  { regex: PAN_REGEX, label: "[PAN_REDACTED]" },
  { regex: EMAIL_REGEX, label: "[EMAIL_REDACTED]" },
  { regex: PHONE_REGEX, label: "[PHONE_REDACTED]" },
];

export function redactPII(text: string): RedactionResult {
  let redacted = text;
  let redactedCount = 0;

  for (const { regex, label } of REDACTION_PATTERNS) {
    const matches = redacted.match(regex);
    if (matches) {
      redactedCount += matches.length;
      redacted = redacted.replace(regex, label);
    }
  }

  return { redacted, redactedCount };
}
