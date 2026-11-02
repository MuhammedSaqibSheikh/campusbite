import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base

logger = logging.getLogger("campusbite.migrations")


def upgrade_schema(engine: Engine) -> None:
    """Create new tables and add new nullable columns to existing tables.

    The project has no migration tool; this keeps databases created by earlier versions working
    without dropping data. Only nullable columns are added automatically.
    """
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                if not column.nullable or column.primary_key:
                    logger.warning("Cannot auto-add NOT NULL column %s.%s", table.name, column.name)
                    continue
                col_type = column.type.compile(dialect=engine.dialect)
                conn.execute(text(f"ALTER TABLE {quote(table.name)} ADD COLUMN {quote(column.name)} {col_type}"))
                logger.info("Added column %s.%s", table.name, column.name)
