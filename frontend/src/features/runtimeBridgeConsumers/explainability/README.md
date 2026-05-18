# Explainability Consumer

This folder contains the first Runtime Bridge Consumer adapter.

The adapter is a read-only deterministic transform that returns a schema-versioned view model for lightweight inline explainability previews. Renderers consume this view model instead of consuming Runtime Bridge metadata directly.

The adapter must not render UI, use React, use hooks, mutate descriptors, call runtime systems, call backend APIs, persist data, use timers, use random IDs, or perform async IO.

