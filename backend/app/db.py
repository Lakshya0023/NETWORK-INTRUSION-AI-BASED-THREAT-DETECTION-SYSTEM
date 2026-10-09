from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker


engine = create_engine(
    "sqlite:///nids.db",
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False
)

Base = declarative_base()


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    type = Column(String)
    severity = Column(String)
    src_ip = Column(String)
    dst_ip = Column(String, default="")
    details = Column(String, default="")
    source_file = Column(String)


class TrafficBucket(Base):
    __tablename__ = "traffic"

    id = Column(Integer, primary_key=True)
    ts = Column(Float)
    packets = Column(Integer)
    bytes = Column(Integer)
    suspicious = Column(Integer)
    source_file = Column(String)


def init_db():
    Base.metadata.create_all(engine)
