FROM python:3.11-slim AS builder

RUN pip install poetry==2.1.4

RUN poetry config virtualenvs.create false

WORKDIR /code

COPY ./pyproject.toml ./README.md ./poetry.lock* ./

RUN poetry install --no-interaction --no-ansi --no-root --without dev

## Second stage to build the final image with a smaller image size

# Using python:3.11-slim (not alpine) for wheel-compatibility with compiled dependencies
FROM python:3.11-slim

# Copy the dependencies from the builder image
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

WORKDIR /code

COPY ./app ./app
COPY ./common_libs ./common_libs

EXPOSE 8080

CMD exec uvicorn app.server:app --host 0.0.0.0 --port 8080
