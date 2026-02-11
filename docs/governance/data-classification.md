# Data Classification & Retention Policy

> Reference: `docs/PLAN.md` > Governance > Data Classification & Retention

## Classification Levels

| Level | Description | Examples |
|-------|-------------|---------|
| **Highly Sensitive** | Patient or health data; requires immediate deletion on project removal | Uploaded datasets (CSV/Excel with patient data) |
| **Sensitive** | Personally identifiable information | User name, email, phone |
| **Confidential** | User-created intellectual property | Synopsis text, thesis content, compiled PDFs |
| **Financial** | Payment and billing records | Razorpay/Stripe transaction records |
| **Internal** | Operational data with no external exposure | AI conversation logs, audit trails |
| **Compliance** | Regulatory audit data | Audit logs |

## Retention Schedule

| Data Type | Classification | Retention | Deletion Trigger |
|-----------|---------------|-----------|-----------------|
| User PII (name, email) | Sensitive | Account lifetime + 30 days | Account deletion request |
| Synopsis text | Confidential | Project lifetime + 90 days | Project deletion |
| Thesis content (sections) | Confidential | Project lifetime + 90 days | Project deletion |
| Dataset (patient data) | Highly Sensitive | Project lifetime only | **Immediate** on project deletion |
| AI conversations | Internal | 90 days after project completion | Auto-purge job |
| Audit logs | Compliance | 2 years | Auto-purge job |
| Compiled PDFs | Confidential | Project lifetime + 30 days | Project deletion |
| Payment records | Financial | 7 years (Indian legal requirement) | Per regulation |
| R2 file objects | Follows parent data type | Follows parent | Cleanup job within 24hrs of project deletion |

## Data Residency

| Data | Location | Notes |
|------|----------|-------|
| Supabase (DB + Auth) | ap-south-1 (Mumbai) or closest | Primary database and auth |
| Hetzner VPS | eu-central (Germany) | Compute; student data crosses borders — disclosed in ToS |
| Cloudflare R2 | Auto-region (Cloudflare selects) | File storage |
| Claude API | US-based processing | No patient-identifiable data in prompts (enforced by PII redaction gate) |
| Hetzner Storage Box | eu-central (Germany) | R2 backups |

## Handling Rules

### Highly Sensitive (Datasets)
- Never send raw row-level data to AI (only column names + aggregated stats)
- Validate for PII patterns on upload (flag columns matching names, phone, Aadhaar)
- Delete immediately when project is deleted — no grace period
- Encrypted at rest (Supabase/R2 default encryption)

### Sensitive (User PII)
- Hash candidate name, registration number, guide name in `thesis_licenses` (SHA-256)
- Never log PII in plain text to Sentry, PostHog, or structured logs
- Sentry `beforeSend` strips email, name, registration_no — only sends user_id (UUID)
- PostHog `sanitize_properties` strips PII fields

### Confidential (Thesis Content)
- Access controlled by RLS policies (user can only access own projects)
- Signed URLs for all file access (15-minute expiry for reads, 5-minute for uploads)
- DOCX export includes fidelity warning

### Financial (Payment Records)
- Stored in Supabase with RLS
- Webhook payloads verified via HMAC signatures before processing
- 7-year retention per Indian tax/financial regulations

## DPDP Act 2023 (India) Compliance

- **Consent**: Clear consent screen at registration describing data collection, processing, and storage
- **Dataset consent**: Explicit acknowledgement that data will be processed by AI and R services
- **Data principal rights**: Access, correction, erasure, grievance — all supported via account settings
- **Breach notification**: Target within 72 hours (exact timeline subject to DPDP rules yet to be notified — confirm with legal counsel before launch)
- **Privacy policy and ToS**: Required before launch
