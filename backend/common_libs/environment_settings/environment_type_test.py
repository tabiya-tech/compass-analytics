import pytest

from common_libs.environment_settings.environment_type import EnvironmentType


class TestEnvironmentTypeFromString:
    @pytest.mark.parametrize(
        "given, expected",
        [
            ("local", EnvironmentType.LOCAL),
            ("dev", EnvironmentType.DEV),
            ("test", EnvironmentType.TEST),
            ("prod", EnvironmentType.PROD),
        ],
    )
    def test_should_parse_known_values(self, given, expected):
        # WHEN a known env-type string is parsed
        # THEN it maps to the matching enum member
        assert EnvironmentType.from_string(given) == expected

    @pytest.mark.parametrize("given", ["Local", "localhost", "staging", "", None])
    def test_should_default_unknown_to_prod(self, given):
        # GIVEN an unknown/missing value (typo, unset var)
        # WHEN parsed
        # THEN it defaults to PROD — the safe, auth-verifying fallback
        assert EnvironmentType.from_string(given) == EnvironmentType.PROD
