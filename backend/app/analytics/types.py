"""
Shared, cross-slice analytics types.

Slice-specific models live in their own subpackage (e.g. app/analytics/reach/types.py).
This module is for types reused across slices (e.g. a future Institution,
PaginatedListResponse[T], or common filter enums) — intentionally near-empty
while reach is the only slice.
"""
