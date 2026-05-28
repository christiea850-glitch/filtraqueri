# Domain Report Recipes Phase B+ Plan

## Goal

Prepare SQL Report Recipes for domain-aware named report drafts while preserving the current safety model: recipes draft SQL into Monaco for review, and `Run query` remains the only execution trigger.

## Safety Boundaries

- No backend/API changes.
- No execution path changes.
- No automatic query execution.
- No Monaco wiring changes.
- No Query Builder changes.
- No Human Mode changes.
- No ResultsGrid or ActiveResultModel changes.
- No routing/back behavior changes.
- No upload/session restore changes.
- No export or pagination changes.

## Product Principle

Ship universal report patterns before specialized domain recipes.

Do not force CRM, churn, sales, customer, or subscription assumptions onto every dataset. A recipe should block when its required schema signals are missing, and blocked messaging should say what structure is needed rather than implying the dataset is wrong.

Churn Analysis is a specialized CRM/subscription recipe only. It must block unless the schema clearly supports customer/subscription-style analysis.

## Corrected Recipe Order

Wave 1:

1. Inactive Records Report.
   - Universal anchor recipe.
   - Detects entity/activity patterns without assuming customers.
2. Customer Lifetime Value.
   - Customer/revenue-oriented recipe.
3. Year-over-Year / Period-over-Period.
   - Time comparison recipe.
4. RFM Segmentation.
   - Customer/order/value-oriented recipe.
5. Churn Analysis.
   - Specialized CRM/subscription recipe only.
   - Blocks without clear customer/subscription-style schema support.

Wave 2:

1. Cohort.
2. Funnel.
3. Market Basket.

Pause after Wave 1 for the density checkpoint before starting Wave 2.

## Step 1 Foundation

Add optional domain metadata to report recipes.

- Add a `domains?: SqlReportRecipeDomain[]` field.
- Keep the field optional so existing recipes continue working with omitted or empty domains.
- Add domain chips only when `domains` exists.
- Include domain tags in Report Recipe search.
- Do not add new recipe SQL in Step 1.

## Step 2 Inactive Records Report

Add the Inactive Records Report as the universal anchor recipe.

Entity detection should be broad and non-domain-specific:

- Person-like: customer, user, account, member, subscriber, patient, employee, tenant.
- Asset-like: product, item, sku, unit, property, asset, track, song, device.
- Workflow-like: order, ticket, case, contract, lease, claim.

The recipe title must remain `Inactive Records Report`.

The `businessPurpose` line should adapt based on the detected entity type:

- Person-like: identifies people or accounts with no recent activity.
- Asset-like: identifies assets or items with no recent activity.
- Workflow-like: identifies operational records with no recent activity.
- Generic entity: identifies records with no recent activity.

The recipe should block with a clear `needs more structure` message when no entity-like field or date/activity-like field exists.

Do not add CRM, churn, sales, or customer assumptions to the universal inactive report.

## UX/UI Hygiene Safeguards

Before expanding the recipe count:

- Add a required domain/category filter strip in Report Recipes.
- Sort supported recipes first.
- Group blocked recipes under a small `Not supported on this dataset` section with a count.
- Cap visible domain chips at two, with `+1` or `+2` for extra domains.
- Keep surface framing distinct:
  - Template Library = syntax patterns.
  - Complex SQL Assist = describe a custom SQL task.
  - Report Recipes = named report drafts.
- Avoid making Complex SQL Assist example prompts duplicate recipe names too closely.

## Density Checkpoint

After Wave 1 recipes land, pause for a UX/scannability audit before starting Wave 2.

The audit should check:

- Card density.
- Blocked recipe visibility.
- Chip clutter.
- Redundancy between Template Library, Complex SQL Assist, and Report Recipes.
- Whether the panel still feels calm and easy to use.

## Verification Expectations

Each implementation step should verify:

- Existing recipes still render.
- Existing recipe SQL output is unchanged unless the step explicitly adds a new recipe.
- New recipes insert SQL only through existing `onInsertSql(...)`.
- Existing `Run query` remains the only execution trigger.
- Frontend build passes.
