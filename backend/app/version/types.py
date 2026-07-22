from pydantic import BaseModel


class VersionInfo(BaseModel):
    date: str = "N/A"
    branch: str = "N/A"
    buildNumber: str = "N/A"
    sha: str = "N/A"

    def to_version_string(self) -> str:
        return f"{self.branch}-{self.buildNumber} ({self.sha})"
