# Oqerun Store

The official open-source application store for Oqerun OS.

Oqerun Store is a metadata-driven catalog and installation layer for open-source applications. It supports native Oqerun packages alongside PWAs, web apps, WebAssembly apps and other providers.

## Architecture

Application repository -> metadata/release -> Store catalog -> Store client -> installation provider -> Oqerun OS

The UI uses one generic installation flow. Format-specific behavior belongs to installation providers.

## Status

Early development — v0.1.0. The standalone client can browse and search the catalog. Native installation is intentionally not faked; the Oqerun OS installation bridge will be connected when the OS API is ready.

## License

MIT
