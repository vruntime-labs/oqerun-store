# OQPKG Specification — Draft

OQPKG is the native application package format intended for Oqerun OS.

The exact archive/container and signing rules remain deliberately open until the Oqerun application runtime and security model are stable.

A package should describe identity, version, publisher, runtime/entry point, required Oqerun version, permissions, file/protocol associations and integrity information.

Proposed layout:

    example.oqpkg
    ├── manifest.json
    ├── app/
    ├── assets/
    └── metadata/

The Store must verify package integrity and compatibility before asking Oqerun OS to install a package. Open-source status is useful provenance but is not itself a security guarantee.
