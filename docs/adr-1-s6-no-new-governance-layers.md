# ADR-1: No New S6 Governance Layers

Status: accepted

## Context

S5 introduced Runtime Bridge consumers, navigation governance, preservation metadata, integrity assertions, controlled routed detail activation, route governance reporting, workspace shell governance, and workspace governance reporting.

S6 begins with stabilization. Adding more registries, posture reports, or readiness layers before stabilizing the existing governance surface would increase drift risk and make future workspace activation harder to audit.

## Decision

S6 must not introduce a new governance layer, posture report, readiness registry, or parallel snapshot family unless a later phase explicitly replaces an existing one.

S6 work should harden existing governance, improve naming clarity, add audit checks, and reduce duplication.

## Consequences

- Existing route and workspace reports remain the source of governance observability.
- New workspace activation must consume existing governance reports rather than inventing a parallel one.
- Any future governance expansion needs an explicit ADR or phase request.

