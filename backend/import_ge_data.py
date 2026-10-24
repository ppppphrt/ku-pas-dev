"""Validate a normalized registration/GE JSON export before installing it atomically."""

import argparse
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from catalog import Catalog
from chat import GEData, GEExport


def install(source, catalog_path, destination):
    catalog = Catalog(catalog_path)
    GEData(catalog, source)  # Strict schema, exact identities, snapshot version.
    payload = GEExport.model_validate_json(Path(source).read_text())
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=destination.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(payload.model_dump_json(indent=2) + "\n")
        os.replace(temporary, destination)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()
    return len(payload.courses), len(payload.offerings)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--catalog", default=str(Path(__file__).parent / "data/catalog.json.gz"))
    parser.add_argument("--output", default=str(Path(__file__).parent / "data/gened.json"))
    args = parser.parse_args()
    print("Installed GE courses / offerings:", install(args.source, args.catalog, args.output))
