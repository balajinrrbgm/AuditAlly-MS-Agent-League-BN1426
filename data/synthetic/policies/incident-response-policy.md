# Incident Response Policy

> Synthetic policy document for the AuditAlly demo. Fictional company "Contoso". For demonstration only.

**Policy ID:** POL-IR-001 · **Version:** 3.0 · **Owner:** Security Operations · **Review cadence:** Annual

## 1. Purpose
Defines how Contoso detects, responds to, and recovers from information security incidents,
and how privacy breaches involving personal data are escalated.

## 2. Detection & Monitoring
- Security events are aggregated in Microsoft Sentinel with analytics rules and alerting.
- Alerts are triaged within a **1-hour SLA** for high severity and **8 hours** for medium.

## 3. Response Plan
- A documented Incident Response Plan defines roles, severity tiers, and communication paths.
- The plan is **tested at least annually via a tabletop exercise**, with minutes retained as evidence.
- A post-incident review is completed within 10 business days of resolution.

## 4. Breach Notification (Privacy)
- Suspected personal-data breaches are escalated to the Privacy Office immediately.
- Where required, the supervisory authority is notified **within 72 hours** of becoming aware.
- A breach notification runbook documents decision criteria and notification templates.

## 5. Mapping to Controls
- SOC 2 **CC7.2** (monitoring), **CC7.4** (incident response)
- GDPR **Article 33** (breach notification within 72 hours)
- ISO/IEC 27001 **A.5.24 – A.5.26** (incident management)
