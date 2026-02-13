import { describe, it, expect } from "vitest";
import { redactPII } from "./redact";

describe("redactPII", () => {
  it("should redact Indian phone numbers", () => {
    const result = redactPII("Call me at 9876543210 or +91 8765432109");
    expect(result.redacted).toBe(
      "Call me at [PHONE_REDACTED] or [PHONE_REDACTED]"
    );
    expect(result.redactedCount).toBe(2);
  });

  it("should redact Aadhaar numbers", () => {
    const result = redactPII("Aadhaar: 1234 5678 9012");
    expect(result.redacted).toBe("Aadhaar: [AADHAAR_REDACTED]");
    expect(result.redactedCount).toBe(1);
  });

  it("should redact Aadhaar without spaces", () => {
    const result = redactPII("Aadhaar: 123456789012");
    expect(result.redacted).toBe("Aadhaar: [AADHAAR_REDACTED]");
    expect(result.redactedCount).toBe(1);
  });

  it("should redact email addresses", () => {
    const result = redactPII("Email: student@university.edu.in");
    expect(result.redacted).toBe("Email: [EMAIL_REDACTED]");
    expect(result.redactedCount).toBe(1);
  });

  it("should redact PAN numbers", () => {
    const result = redactPII("PAN: ABCDE1234F");
    expect(result.redacted).toBe("PAN: [PAN_REDACTED]");
    expect(result.redactedCount).toBe(1);
  });

  it("should redact multiple PII types in one string", () => {
    const text =
      "Dr. Sharma (ABCDE1234F) can be reached at dr.sharma@hospital.org or 9876543210";
    const result = redactPII(text);
    expect(result.redacted).toContain("[PAN_REDACTED]");
    expect(result.redacted).toContain("[EMAIL_REDACTED]");
    expect(result.redacted).toContain("[PHONE_REDACTED]");
    expect(result.redactedCount).toBe(3);
  });

  it("should return unchanged text when no PII is found", () => {
    const text =
      "This is a cross-sectional study of 100 patients at SSKM Hospital.";
    const result = redactPII(text);
    expect(result.redacted).toBe(text);
    expect(result.redactedCount).toBe(0);
  });

  it("should handle empty string", () => {
    const result = redactPII("");
    expect(result.redacted).toBe("");
    expect(result.redactedCount).toBe(0);
  });
});
