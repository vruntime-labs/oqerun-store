# Oqerun Store Catalog Specification — Draft

The catalog is metadata-first and decoupled from application packages.

Each entry identifies a stable application ID, display name, version, description, category, publisher, source, license, application type, Oqerun compatibility, installation source and permissions.

Supported types: `oqpkg`, `pwa`, `web`, `wasm`, `external`.

New types should be implemented as installation providers without requiring a rewrite of the Store UI.
