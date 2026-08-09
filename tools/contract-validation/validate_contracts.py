from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, ValidationError
from openapi_spec_validator import validate_spec
from referencing import Registry, Resource


PROJECT_ROOT = Path(__file__).resolve().parents[2]
AI_SCHEMA_ROOT = PROJECT_ROOT / "schemas" / "ai"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_json_schemas() -> tuple[dict[str, dict], dict[str, dict]]:
    schemas: dict[str, dict] = {}
    for path in sorted(AI_SCHEMA_ROOT.glob("*.schema.json")):
        schema = load_json(path)
        Draft202012Validator.check_schema(schema)
        schemas[schema["$id"]] = schema

    fact_schema = load_json(PROJECT_ROOT / "schemas" / "fact-schema.v1.json")
    Draft202012Validator.check_schema(fact_schema)
    schemas[fact_schema["$id"]] = fact_schema

    examples: dict[str, dict] = {}
    for path in sorted((AI_SCHEMA_ROOT / "examples").glob("*.json")):
        examples[path.name] = load_json(path)
    return schemas, examples


def validate_examples(schemas: dict[str, dict], examples: dict[str, dict]) -> None:
    registry = Registry().with_resources(
        (uri, Resource.from_contents(schema)) for uri, schema in schemas.items()
    )
    request_schema = schemas["https://pipl.local/schemas/ai/ai-workflow-request.v1.schema.json"]
    response_schema = schemas["https://pipl.local/schemas/ai/ai-workflow-response.v1.schema.json"]

    request_validator = Draft202012Validator(request_schema, registry=registry)
    response_validator = Draft202012Validator(response_schema, registry=registry)

    request_validator.validate(examples["workflow-request.scenario-triage.json"])
    response_validator.validate(examples["workflow-response.needs-input.json"])
    response_validator.validate(examples["workflow-response.failed.json"])

    question_tree = load_json(PROJECT_ROOT / "schemas" / "question-tree.v1.json")
    ruleset = load_json(PROJECT_ROOT / "schemas" / "ruleset.v1.json")
    scenario_catalog = load_json(PROJECT_ROOT / "schemas" / "scenario-catalog.v1.json")
    question_codes = {item["code"] for item in question_tree["questions"]}
    rule_codes = {item["code"] for item in ruleset["rules"]}
    scenario_codes = {item["code"] for item in scenario_catalog["scenarios"]}

    request_example = examples["workflow-request.scenario-triage.json"]
    response_example = examples["workflow-response.needs-input.json"]
    assert request_example["context"]["scenario"]["scenario_code"] in scenario_codes
    assert all(item["rule_code"] in rule_codes for item in request_example["context"]["rule_results"])
    assert all(
        not item.get("question_code") or item["question_code"] in question_codes
        for item in response_example["output"]["questions"]
    )

    def assert_invalid(validator: Draft202012Validator, instance: dict, label: str) -> None:
        try:
            validator.validate(instance)
        except ValidationError:
            return
        raise AssertionError(f"Expected invalid contract instance: {label}")

    request_with_tenant = deepcopy(examples["workflow-request.scenario-triage.json"])
    request_with_tenant["tenant_id"] = "44444444-4444-4444-8444-444444444444"
    assert_invalid(request_validator, request_with_tenant, "persistent tenant ID forwarded to model")

    mismatched_output = deepcopy(examples["workflow-response.needs-input.json"])
    mismatched_output["output_type"] = "assessment"
    assert_invalid(response_validator, mismatched_output, "output_type does not match child schema")

    confirmed_candidate = deepcopy(examples["workflow-response.needs-input.json"])
    confirmed_candidate["output"]["candidate_facts"] = [
        {
            "candidate_id": "55555555-5555-4555-8555-555555555555",
            "fact_code": "XFER.EXISTS",
            "subject_ref": {
                "subject_type": "processing_activity",
                "local_ref": "activity:crm-contact",
            },
            "value_type": "enum",
            "value": "yes",
            "status": "confirmed",
            "source_refs": ["fact:ownership"],
            "confidence": "low",
            "needs_user_confirmation": True,
        }
    ]
    assert_invalid(response_validator, confirmed_candidate, "AI returned confirmed fact")

    failed_without_error = deepcopy(examples["workflow-response.failed.json"])
    failed_without_error["failure"] = None
    assert_invalid(response_validator, failed_without_error, "failed response without structured failure")


def validate_openapi() -> int:
    path = PROJECT_ROOT / "api" / "openapi.v1.yaml"
    with path.open("r", encoding="utf-8") as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return len(spec["paths"])


def main() -> int:
    schemas, examples = validate_json_schemas()
    validate_examples(schemas, examples)
    knowledge_schema = load_json(PROJECT_ROOT / "dify" / "knowledge-metadata-schema.v1.json")
    Draft202012Validator.check_schema(knowledge_schema)
    path_count = validate_openapi()
    print(
        "PASS: "
        f"{len(schemas) - 1} AI schemas, {len(examples)} examples, "
        f"1 Dify knowledge schema, OpenAPI {path_count} paths"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
