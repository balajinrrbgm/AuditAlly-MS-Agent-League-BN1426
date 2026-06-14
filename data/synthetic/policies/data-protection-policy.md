# Data Protection Policy

> Synthetic policy document for the AuditAlly demo. Fictional company "Contoso". For demonstration only.

**Policy ID:** POL-DP-001 · **Version:** 2.0 · **Owner:** Privacy Office · **Review cadence:** Annual

## 1. Purpose
Describes how Contoso protects personal data and meets GDPR obligations as a data controller and processor.

## 2. Records of Processing (RoPA)
- A **Record of Processing Activities** is maintained for every personal-data flow.
- Microsoft Purview is the system of record; the RoPA register is reviewed semi-annually.

## 3. Security of Processing
- Personal data is **encrypted at rest and in transit** (TLS 1.2+).
- Pseudonymization is applied to analytics datasets where feasible.
- A **Data Protection Impact Assessment (DPIA)** is required before any new high-risk processing
  (for example, deploying a new CRM that processes customer personal data).

## 4. Data Subject Rights
- Requests (access, rectification, erasure) are fulfilled within statutory timelines.

## 5. Mapping to Controls
- GDPR **Article 30** (records of processing)
- GDPR **Article 32** (security of processing — encryption, DPIA)
- ISO/IEC 27001 **A.5.34** (privacy and protection of PII)
