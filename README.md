# Oqerun Store

The official open-source application store for Oqerun OS.

Oqerun Store is a metadata-driven catalog and installation layer for open-source applications. It supports native Oqerun packages alongside PWAs, web apps, WebAssembly apps and other providers.

## Architecture

Application repository -> metadata/release -> Store catalog -> Store client -> installation provider -> Oqerun OS

The UI uses one generic installation flow. Format-specific behavior belongs to installation providers.

## Status

Store v0.2.0. The standalone client supports discovery, filtering, trust metadata, application details, installed-app tracking, update management, settings, feedback, and automated GitHub community catalog discovery. Native installation is intentionally not faked; the Oqerun OS installation bridge will be connected when the OS API is ready.

## License

MIT


## Third-party and community applications

Oqerun Store distinguishes first-party Oqerun software from independent community applications.

Community listings:
- are explicitly labeled **Community** in the Store UI;
- identify the original publisher;
- link directly to the original source repository;
- show the declared project license;
- do not imply that VRuntime Labs owns or publishes the third-party project.

The repository contains [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) with the current attribution record and Store policy. License and ownership remain with each original project and its applicable license terms. GitHub notes that open-source licenses determine how software may be used, modified, and distributed, so Store listings preserve the project's license identity rather than replacing it. 
