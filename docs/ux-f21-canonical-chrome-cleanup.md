# UX-F21 Canonical Chrome Cleanup

## Summary

UX-F21 applies the canonical workspace layout specification to the app chrome without changing backend or feature behavior.

- Sidebar remains navigation-only with active state, collapse, resize, and routing preserved.
- Right investigation rail now shows only the investigation header, one suggested next action, and trail nodes.
- Removed always-visible rail metadata stacks, extra path drawers, priority badges, repeated current-step cards, and technical runtime/system cards.
- Human Mode copy was softened where visible in Data, Build, and Results surfaces.
- Page hierarchy remains title, context strip, primary content, primary action, and supporting detail.

## Preservation

The pass does not change `executeWorkspaceQuery`, Query Builder request shapes, `ActiveResultModel`, `ResultsGrid`, Monaco/editor behavior, SQL draft restore, workbook/session restore, routing/back behavior, Human/Analyst switching, pagination, exports, upload/session persistence, runtime persistence schema, or investigation trail navigation.

## Validation Notes

Required checks:

- `npm run build`
- targeted lint on changed TypeScript files
- inspect Data, Build, Results, and Analyst for chrome density and horizontal overflow
- confirm Results table controls still sort, paginate, export, switch tabs, and manage columns
- confirm Analyst SQL workspace still restores drafts and keeps Monaco behavior
