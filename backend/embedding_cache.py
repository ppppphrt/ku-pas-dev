"""Cache embeddings by prepared content, row order, and model identity."""

import logging
import pickle
from pathlib import Path

log = logging.getLogger(__name__)


def compute_or_load_embeddings(
    df,
    mdl,
    cache_path: str,
    model_name: str,
):
    """Return precomputed embeddings, rebuilding if CSV changed."""
    if Path(cache_path).exists():
        log.info("Loading cached embeddings from %s", cache_path)
        with open(cache_path, "rb") as f:
            cached = pickle.load(f)
        if (
            cached.get("n_courses") == len(df)
            and cached.get("dataset_version") == df.attrs["dataset_version"]
            and cached.get("model_name") == model_name
        ):
            return cached["embeddings"]
        log.info("Cache content or model mismatch — re-encoding.")

    log.info("Encoding %d courses with SBERT (this may take a moment)…", len(df))
    texts = df["_embed_text"].tolist()
    embeddings = mdl.encode(
        texts,
        batch_size=64,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,  # pre-normalise -> dot product == cosine
    )
    with open(cache_path, "wb") as f:
        pickle.dump(
            {
                "n_courses": len(df),
                "embeddings": embeddings,
                "dataset_version": df.attrs["dataset_version"],
                "model_name": model_name,
            },
            f,
        )
    log.info("Embeddings saved to %s", cache_path)
    return embeddings
