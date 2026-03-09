"""
Server service definition registry.
Mirrors server/src/services/definitions/registry.ts
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from services.definitions.types import ServerServiceDefinition
from services.definitions.resident_copy import resident_copy_server_definition
from services.definitions.health_insurance_and_tax import (
    health_insurance_server_definition,
    tax_certificate_server_definition,
)

_registry: dict[str, ServerServiceDefinition] = {}


def register_server_service_definition(definition: ServerServiceDefinition) -> None:
    _registry[definition.id] = definition


def get_server_service_definition(service_id: str) -> ServerServiceDefinition | None:
    return _registry.get(service_id)


def get_all_server_service_definitions() -> list[ServerServiceDefinition]:
    return list(_registry.values())


# Register all definitions
register_server_service_definition(resident_copy_server_definition)
register_server_service_definition(health_insurance_server_definition)
register_server_service_definition(tax_certificate_server_definition)
