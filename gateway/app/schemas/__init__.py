"""
SovereignMsg Gateway - Module Schémas
"""

from app.schemas.schemas import (
    ActivationRequest,
    ActivationResponse,
    ActivationConfirmRequest,
    ActivationConfirmResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    AgentCreateRequest,
    AgentCreateResponse,
    AgentRevokeResponse,
)

__all__ = [
    "ActivationRequest",
    "ActivationResponse",
    "ActivationConfirmRequest",
    "ActivationConfirmResponse",
    "LoginRequest",
    "LoginResponse",
    "MeResponse",
    "AgentCreateRequest",
    "AgentCreateResponse",
    "AgentRevokeResponse",
]
