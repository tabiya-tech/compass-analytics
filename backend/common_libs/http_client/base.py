import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class HttpClientError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


class AsyncHttpClient:
    """
    Thin async wrapper around httpx.AsyncClient. Raises HttpClientError on non-2xx
    responses so callers don't have to inspect status codes themselves.

    Intended as the base for future external API clients (e.g. CompassApiClient).
    """

    def __init__(self, base_url: str, headers: dict[str, str] | None = None, timeout: float = 30.0):
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers=headers or {},
            timeout=timeout,
        )

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        response = await self._client.get(path, params=params)
        return self._handle_response(response)

    async def post(self, path: str, body: dict[str, Any] | None = None) -> Any:
        response = await self._client.post(path, json=body)
        return self._handle_response(response)

    async def close(self) -> None:
        await self._client.aclose()

    @staticmethod
    def _handle_response(response: httpx.Response) -> Any:
        if response.is_success:
            return response.json() if response.content else None
        raise HttpClientError(
            status_code=response.status_code,
            message=f"HTTP {response.status_code}: {response.text[:200]}",
        )

    async def __aenter__(self) -> "AsyncHttpClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()
