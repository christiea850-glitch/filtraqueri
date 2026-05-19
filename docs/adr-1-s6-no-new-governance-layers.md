# ADR-1: No New S6/S7 Governance Layers

Status: accepted

## Context

S5 introduced Runtime Bridge consumers, navigation governance, preservation metadata, integrity assertions, controlled routed detail activation, route governance reporting, workspace shell governance, and workspace governance reporting.

S6 begins with stabilization. Adding more registries, posture reports, or readiness layers before stabilizing the existing governance surface would increase drift risk and make future workspace activation harder to audit.

## Decision

S6 and S7 must not introduce a new top-level governance layer, posture report, readiness registry, or parallel snapshot family unless it is paired with real activation or explicitly replaces an existing one.

S6/S7 work should harden existing governance, improve naming clarity, add audit checks, reduce duplication, and compose existing readers instead of expanding the governance surface.

## Consequences

- Existing route and workspace reports remain the source of governance observability.
- New workspace activation must consume existing governance reports rather than inventing a parallel one.
- Any future governance expansion needs an explicit ADR or phase request.
- Shared read surfaces are allowed when they compose existing route/workspace governance without creating new readiness registries or posture report families.
