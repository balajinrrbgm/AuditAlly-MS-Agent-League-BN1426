# Access Control Policy

> Synthetic policy document for the AuditAlly demo. Fictional company "Contoso". For demonstration only — not legal advice.

**Policy ID:** POL-AC-001 · **Version:** 4.0 · **Owner:** Security Engineering · **Review cadence:** Annual

## 1. Purpose
This policy defines how logical access to Contoso systems, applications, and data
is granted, reviewed, and revoked to protect confidentiality, integrity, and availability.

## 2. Least Privilege
- Access is granted on a **least-privilege**, need-to-know basis.
- Privileged roles are time-bound and approved through Privileged Identity Management (PIM).
- Standing administrative access is prohibited except for break-glass accounts.

## 3. Access Reviews
- User access to production systems is **reviewed quarterly** by the system owner.
- Reviews are attested in writing and retained as audit evidence for at least 24 months.
- Access for terminated users is revoked within 24 hours of separation.

## 4. Multi-Factor Authentication (MFA)
- **MFA is mandatory** for all users on all internal and customer-facing systems.
- Conditional Access enforces MFA, device compliance, and blocks legacy authentication.
- Conditional Access policy exports are captured at least annually as evidence.

## 5. Mapping to Controls
- SOC 2 **CC6.1** (logical access / least privilege)
- SOC 2 **CC6.6** (multi-factor authentication)
- ISO/IEC 27001 **A.5.15** (access control)
