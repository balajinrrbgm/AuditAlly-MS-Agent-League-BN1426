# Business Continuity & Backup Policy

> Synthetic policy document for the AuditAlly demo. Fictional company "Contoso". For demonstration only.

**Policy ID:** POL-BC-001 · **Version:** 1.0 · **Owner:** IT Operations · **Review cadence:** Annual

## 1. Purpose
Ensures Contoso can recover information and services after disruption.

## 2. Backups
- Production data is backed up via Azure Backup with **geo-redundant** storage.
- Backup configuration is exported as evidence semi-annually.

## 3. Restore Testing
- **Restore tests are performed at least semi-annually** and results are documented.
- Recovery Time Objective (RTO): 4 hours. Recovery Point Objective (RPO): 1 hour.

## 4. Mapping to Controls
- ISO/IEC 27001 **A.8.13** (information backup), **A.5.30** (ICT readiness for continuity)
- SOC 2 **A1.2** (availability / recovery)
