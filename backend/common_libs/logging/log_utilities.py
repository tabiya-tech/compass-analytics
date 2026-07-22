import logging.config
from pathlib import Path

import yaml


def setup_logging_config(config_path: str) -> None:
    path = Path(config_path)
    with path.open("r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    logging.config.dictConfig(config)
