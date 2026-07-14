import enum

import bcrypt

from ..extensions import db
from .mixins import TimestampMixin


class Role(str, enum.Enum):
    """Application roles — keep in sync with PostgreSQL enum type ``role``."""

    user = "user"
    agent = "agent"
    verifier = "verifier"
    admin = "admin"
    surveyor = "surveyor"
    claims_manager = "claims_manager"

    @classmethod
    def values(cls) -> list[str]:
        return [member.value for member in cls]

    @classmethod
    def from_value(cls, value: str) -> "Role":
        return cls(value)


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    city = db.Column(db.String(80))
    state = db.Column(db.String(80))
    pincode = db.Column(db.String(12))
    date_of_birth = db.Column(db.Date)
    identity_proof_type = db.Column(db.String(30))
    identity_proof_number = db.Column(db.String(40))
    kyc_status = db.Column(db.String(20), default="submitted")
    role = db.Column(
        db.Enum(
            Role,
            name="role",
            native_enum=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=Role.user,
        nullable=False,
    )
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    vehicles = db.relationship("Vehicle", back_populates="owner", lazy="dynamic")
    policies = db.relationship("Policy", back_populates="owner", lazy="dynamic")
    claims = db.relationship("Claim", back_populates="owner", lazy="dynamic")

    def set_password(self, raw: str) -> None:
        self.password_hash = bcrypt.hashpw(
            raw.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, raw: str) -> bool:
        try:
            return bcrypt.checkpw(
                raw.encode("utf-8"), self.password_hash.encode("utf-8")
            )
        except (ValueError, AttributeError):
            return False

    def to_dict(self, *, include_sensitive: bool = False) -> dict:
        id_number = self.identity_proof_number
        if id_number and not include_sensitive and len(id_number) > 4:
            id_number = f"{'*' * (len(id_number) - 4)}{id_number[-4:]}"
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "pincode": self.pincode,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "identity_proof_type": self.identity_proof_type,
            "identity_proof_number": id_number,
            "kyc_status": self.kyc_status,
            "role": self.role.value,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
