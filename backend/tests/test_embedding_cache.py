import pickle
import tempfile
import unittest
from pathlib import Path

from embedding_cache import compute_or_load_embeddings


class Column:
    def __init__(self, values):
        self.values = values

    def tolist(self):
        return self.values


class Frame:
    def __init__(self, version):
        self.attrs = {"dataset_version": version}

    def __len__(self):
        return 2

    def __getitem__(self, key):
        return Column(["one", "two"])


class Model:
    def __init__(self):
        self.calls = 0

    def encode(self, texts, **options):
        self.calls += 1
        return [[1.0, 0.0] for text in texts]


class EmbeddingCacheTests(unittest.TestCase):
    def test_content_and_model_changes_rebuild_even_with_same_count(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = str(Path(directory) / "embeddings.pkl")
            model = Model()

            def compute(version="v1", name="model-a"):
                return compute_or_load_embeddings(Frame(version), model, cache, name)

            expected = compute()
            self.assertEqual(expected, compute())
            self.assertEqual(model.calls, 1)
            compute("v2")
            self.assertEqual(model.calls, 2)
            compute("v2", "model-b")
            self.assertEqual(model.calls, 3)

    def test_legacy_count_only_cache_rebuilt(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / "embeddings.pkl"
            with cache.open("wb") as target:
                pickle.dump({"n_courses": 2, "embeddings": "stale"}, target)
            model = Model()
            result = compute_or_load_embeddings(Frame("v1"), model, str(cache), "model-a")
            self.assertEqual(model.calls, 1)
            self.assertNotEqual(result, "stale")
