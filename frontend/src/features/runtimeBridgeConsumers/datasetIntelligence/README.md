# Dataset Intelligence Consumer

This folder contains the S5-1B dataset intelligence preview consumer.

The adapter is preview-only. It returns a small, schema-versioned, read-only dataset intelligence view model for existing inline dataset summary surfaces. Full dataset intelligence detail pages, routed drilldowns, and workspace extraction come later.

Renderers should consume this view model instead of reaching directly into future Runtime Bridge metadata or consumer internals.

The adapter must not render UI, use React, use hooks, mutate descriptors, call runtime systems, call backend APIs, persist data, use timers, use random IDs, or perform async IO.

