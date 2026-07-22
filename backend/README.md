# Compass Analytics Backend

FastAPI + Pydantic backend for the Compass Analytics dashboard.

## Setup

Requires Python 3.11 and [Poetry](https://python-poetry.org/).

```bash
poetry install
cp .env.example .env  # then fill in real values
poetry run uvicorn app.server:app --reload --port 8080
```

## Scripts

| Command | What it does |
| --- | --- |
| `poetry run uvicorn app.server:app --reload --port 8080` | Run the dev server |
| `poetry run pylint --recursive=y .` | Lint |
| `poetry run bandit -c bandit.yaml -r .` | Security scan |
| `poetry run pytest -m "not smoke_test"` | Run unit/integration tests |
| `poetry run pytest -m smoke_test` | Run smoke tests against a deployed environment |

## Testing

Tests are colocated with source (`*_test.py`), not in a separate `tests/` directory. Tests requiring MongoDB use
an in-memory Mongo instance (`pymongo_inmemory`) via fixtures in `conftest.py` — no real database needed to run
the suite locally.

See [testing-guidelines.md](../testing-guidelines.md) for BDD test-writing conventions.
