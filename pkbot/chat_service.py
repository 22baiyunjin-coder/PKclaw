from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, request


DEFAULT_SYSTEM_PROMPT = (
    "You are PKclaw's poker discussion copilot. Your job is to turn structured poker context into a short, "
    "human-readable explanation. Start with a brief emotional acknowledgement when the user sounds uncertain or frustrated, "
    "then give a short conclusion, then only 2-3 practical points, then invite a follow-up. "
    "If the user pastes a raw hand history or describes a new hand, analyze that pasted hand first and do not get stuck on the current page state. "
    "Use the provided structured poker context when it exists. Be clear about uncertainty, do not pretend to be solver-perfect, "
    "do not invent missing hand details, avoid long essays, and keep the tone concise, poker-aware, and product-oriented."
)

REQUEST_TYPE_DEFAULT = "general"
REQUEST_TYPE_EXPLAIN = "explain_current_hand"
REQUEST_TYPE_ALTERNATIVE = "why_not_action"
REQUEST_TYPE_COMPARE_STYLE = "compare_style"
REQUEST_TYPE_REVIEW = "review_hand"
REQUEST_TYPE_HAND_HISTORY = "hand_history_first_pass"
DEFAULT_REMOTE_BASE_URL = "https://api.minimaxi.com/v1"
DEFAULT_REMOTE_MODEL = "MiniMax-M2.7-highspeed"
DEFAULT_REMOTE_API_PATH = "/chat/completions"
DEFAULT_REMOTE_API_KEY = "sk-api-a6AFFjOHhJATiYzqisHcEEdlwEoLOwUN9dWjAf8BJsYbwXLEW7ntALFGHA-PjRO0UUJKG-VV9HK2MPfN0xjs6u8ZK84nIlcBHoVSWPSFD3rwqNizax7aP6c"
DEFAULT_CHAT_LOG_DIR = "outputs/chat_logs"
CHAT_LOG_FILE_NAME = "chat_events.jsonl"
SFT_EXPORT_FILE_NAME = "chat_sft_dataset.jsonl"


class ChatServiceError(RuntimeError):
    """Raised when the chat backend is unavailable or misconfigured."""


@dataclass(frozen=True)
class ChatBackendStatus:
    provider: str
    configured: bool
    model: str
    base_url: str
    message: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "configured": self.configured,
            "model": self.model,
            "base_url": self.base_url,
            "message": self.message,
        }


@dataclass(frozen=True)
class ChatConfig:
    provider: str
    base_url: str
    api_key: str
    model: str
    api_path: str
    temperature: float
    timeout_seconds: float
    system_prompt: str
    extra_headers: dict[str, str]
    max_output_tokens: int
    reasoning_effort: str | None = None


@dataclass(frozen=True)
class ChatRequestContext:
    request_type: str = REQUEST_TYPE_DEFAULT
    request_meta: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ChatCompletionResult:
    content: str
    model: str
    usage: dict[str, Any] | None = None
    response_flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "content": self.content,
            "model": self.model,
            "usage": self.usage or {},
            "response_flags": list(self.response_flags),
        }


class ChatModelClient(ABC):
    @abstractmethod
    def complete(self, messages: list[dict[str, str]]) -> ChatCompletionResult:
        raise NotImplementedError


class OpenAICompatibleChatClient(ChatModelClient):
    def __init__(self, config: ChatConfig) -> None:
        self.config = config

    def complete(self, messages: list[dict[str, str]]) -> ChatCompletionResult:
        url = self.config.base_url.rstrip("/") + self.config.api_path
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        headers.update(self.config.extra_headers)
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_output_tokens,
        }

        req = request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=True).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=self.config.timeout_seconds) as response:
                raw_payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise ChatServiceError(f"Chat API request failed with {exc.code}: {body[:400]}") from exc
        except error.URLError as exc:
            raise ChatServiceError(f"Chat API connection failed: {exc.reason}") from exc

        content = _extract_response_content(raw_payload)
        if not content:
            raise ChatServiceError("Chat API returned an empty assistant message.")

        return ChatCompletionResult(
            content=content,
            model=str(raw_payload.get("model") or self.config.model),
            usage=raw_payload.get("usage"),
            response_flags=_derive_response_flags(content),
        )


class OpenAIResponsesChatClient(ChatModelClient):
    def __init__(self, config: ChatConfig) -> None:
        self.config = config

    def complete(self, messages: list[dict[str, str]]) -> ChatCompletionResult:
        url = self.config.base_url.rstrip("/") + self.config.api_path
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        headers.update(self.config.extra_headers)
        payload: dict[str, Any] = {
            "model": self.config.model,
            "input": messages,
            "store": False,
            "max_output_tokens": self.config.max_output_tokens,
        }
        # The official migration guide recommends Responses for new projects and shows
        # simple chat-style message arrays can be passed as `input`.
        if self.config.reasoning_effort:
            payload["reasoning"] = {"effort": self.config.reasoning_effort}

        req = request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=True).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=self.config.timeout_seconds) as response:
                raw_payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise ChatServiceError(f"OpenAI Responses request failed with {exc.code}: {body[:400]}") from exc
        except error.URLError as exc:
            raise ChatServiceError(f"OpenAI Responses connection failed: {exc.reason}") from exc

        content = _extract_response_content(raw_payload)
        if not content:
            raise ChatServiceError("OpenAI Responses returned an empty assistant message.")

        return ChatCompletionResult(
            content=content,
            model=str(raw_payload.get("model") or self.config.model),
            usage=raw_payload.get("usage"),
            response_flags=_derive_response_flags(content),
        )


class MockChatClient(ChatModelClient):
    def __init__(self, config: ChatConfig) -> None:
        self.config = config

    def complete(self, messages: list[dict[str, str]]) -> ChatCompletionResult:
        latest_user_message = ""
        latest_context = ""
        for message in reversed(messages):
            if message["role"] == "user" and not latest_user_message:
                latest_user_message = message["content"]
            if message["role"] == "system" and "PKclaw context package" in message["content"] and not latest_context:
                latest_context = message["content"]
            if latest_user_message and latest_context:
                break

        summary_lines = [
            "Mock chat mode is active, so this is a local stand-in for the external API.",
            "The chat layer wiring is working and ready for a real model endpoint.",
        ]
        if latest_context:
            summary_lines.append("Current context is attached, so we can already thread hand-state data into the conversation.")
        if latest_user_message:
            summary_lines.append(f"Your question was: {latest_user_message.strip()[:220]}")
        summary_lines.append(
            "Next step for a real remote provider is to set PKCLAW_BASE_URL, PKCLAW_API_KEY, and PKCLAW_MODEL "
            "(or their PKCLAW_CHAT_* aliases)."
        )
        return ChatCompletionResult(content="\n\n".join(summary_lines), model="mock-chat")


def get_chat_status() -> ChatBackendStatus:
    config = _load_chat_config()
    if config.provider == "mock":
        return ChatBackendStatus(
            provider="mock",
            configured=True,
            model="mock-chat",
            base_url="local",
            message="Mock chat is active for local UI testing.",
        )

    missing = []
    if not config.base_url:
        missing.append("PKCLAW_BASE_URL or PKCLAW_CHAT_BASE_URL")
    if config.provider == "openai" and not config.api_key:
        if config.provider == "openai":
            missing.append("OPENAI_API_KEY or PKCLAW_API_KEY or PKCLAW_CHAT_API_KEY")
    if not config.model:
        if config.provider == "openai":
            missing.append("OPENAI_MODEL or PKCLAW_MODEL or PKCLAW_CHAT_MODEL")
        else:
            missing.append("PKCLAW_MODEL or PKCLAW_CHAT_MODEL")

    if missing:
        return ChatBackendStatus(
            provider=config.provider,
            configured=False,
            model=config.model,
            base_url=config.base_url,
            message=f"Chat backend is not configured yet. Missing: {', '.join(missing)}",
        )

    ready_message = "Remote chat backend is configured and ready."
    if config.provider == "openai":
        ready_message = "OpenAI chat backend is configured and ready."
    elif config.provider == "openai_compatible":
        ready_message = "OpenAI-compatible chat backend is configured and ready."

    return ChatBackendStatus(
        provider=config.provider,
        configured=True,
        model=config.model,
        base_url=config.base_url,
        message=ready_message,
    )


def chat_about_hand(
    messages: list[dict[str, Any]],
    context_package: dict[str, Any] | None = None,
    hand_context: dict[str, Any] | None = None,
    request_type: str | None = None,
    request_meta: dict[str, Any] | None = None,
) -> ChatCompletionResult:
    sanitized_messages = _sanitize_messages(messages)
    if not sanitized_messages:
        raise ChatServiceError("Chat request did not include any usable user messages.")

    config = _load_chat_config()
    client = _build_chat_client(config)
    effective_request_type = _resolve_request_type(
        explicit_request_type=request_type,
        sanitized_messages=sanitized_messages,
    )
    user_supplied_hand = _extract_user_supplied_hand_history(sanitized_messages)
    request_context = ChatRequestContext(
        request_type=effective_request_type,
        request_meta=dict(request_meta or {}),
    )

    request_messages = [{"role": "system", "content": config.system_prompt}]
    context_text = _format_context_package(context_package or hand_context)
    if context_text:
        request_messages.append({"role": "system", "content": context_text})
    if user_supplied_hand:
        request_messages.append(
            {
                "role": "system",
                "content": (
                    "User-supplied hand history or raw hand description detected. "
                    "Treat the user's pasted hand as the primary analysis target. "
                    "Use the PKclaw page context only as secondary background if it helps. "
                    "Do not say you are missing the current page context when the user already supplied a hand."
                ),
            }
        )
        request_messages.append(
            {
                "role": "system",
                "content": f"User-provided hand to analyze:\n{user_supplied_hand}",
            }
        )
    task_prompt = _build_request_type_prompt(request_context)
    if task_prompt:
        request_messages.append({"role": "system", "content": task_prompt})
    request_messages.extend(sanitized_messages[-16:])
    log_payload = {
        "request_type": request_context.request_type,
        "request_meta": request_context.request_meta,
        "context_package": context_package or hand_context or {},
        "messages": sanitized_messages,
        "provider": config.provider,
        "model": config.model,
        "base_url": config.base_url,
    }
    try:
        result = client.complete(request_messages)
    except Exception as exc:
        _append_chat_log(
            {
                **log_payload,
                "status": "error",
                "error": str(exc),
                "structured_prompt_messages": request_messages,
            }
        )
        raise

    _append_chat_log(
        {
            **log_payload,
            "status": "ok",
            "response": result.to_dict(),
            "structured_prompt_messages": request_messages,
        }
    )
    return result


def _build_chat_client(config: ChatConfig) -> ChatModelClient:
    if config.provider == "mock":
        return MockChatClient(config)
    if config.provider == "openai":
        status = get_chat_status()
        if not status.configured:
            raise ChatServiceError(status.message)
        return OpenAIResponsesChatClient(config)
    if config.provider in {"openai_compatible", "remote"}:
        status = get_chat_status()
        if not status.configured:
            raise ChatServiceError(status.message)
        return OpenAICompatibleChatClient(config)
    raise ChatServiceError(f"Unsupported chat provider: {config.provider}")


def _load_chat_config() -> ChatConfig:
    explicit_provider = _env_first("PKCLAW_CHAT_PROVIDER", "PKCLAW_PROVIDER")
    provider_base_url = _env_first("PKCLAW_BASE_URL", "PKCLAW_CHAT_BASE_URL")
    provider_api_key = _env_first("PKCLAW_API_KEY", "PKCLAW_CHAT_API_KEY")
    provider_model = _env_first("PKCLAW_MODEL", "PKCLAW_CHAT_MODEL")
    openai_api_key = _env_first("OPENAI_API_KEY")
    openai_model = _env_first("OPENAI_MODEL")

    if explicit_provider:
        provider = explicit_provider
    elif provider_base_url or provider_api_key or provider_model:
        provider = "remote"
    elif openai_api_key:
        provider = "openai"
    else:
        provider = "remote"

    extra_headers_raw = _env_first("PKCLAW_EXTRA_HEADERS", "PKCLAW_CHAT_EXTRA_HEADERS")
    extra_headers: dict[str, str] = {}
    if extra_headers_raw:
        try:
            extra_headers = {str(key): str(value) for key, value in json.loads(extra_headers_raw).items()}
        except json.JSONDecodeError as exc:
            raise ChatServiceError("PKCLAW_EXTRA_HEADERS / PKCLAW_CHAT_EXTRA_HEADERS must be valid JSON.") from exc

    if provider == "openai":
        base_url = provider_base_url or "https://api.openai.com/v1"
        api_key = provider_api_key or openai_api_key
        # Practical default for product chat: low-cost general reasoning model.
        model = provider_model or openai_model or "gpt-5-mini"
        api_path = _env_first("PKCLAW_API_PATH", "PKCLAW_CHAT_API_PATH") or "/responses"
    else:
        base_url = provider_base_url or DEFAULT_REMOTE_BASE_URL
        api_key = provider_api_key or openai_api_key or DEFAULT_REMOTE_API_KEY
        model = provider_model or openai_model or DEFAULT_REMOTE_MODEL
        api_path = _env_first("PKCLAW_API_PATH", "PKCLAW_CHAT_API_PATH") or DEFAULT_REMOTE_API_PATH

    return ChatConfig(
        provider=provider,
        base_url=base_url,
        api_key=api_key,
        model=model,
        api_path=api_path,
        temperature=float(_env_first("PKCLAW_TEMPERATURE", "PKCLAW_CHAT_TEMPERATURE") or "0.35"),
        timeout_seconds=float(_env_first("PKCLAW_TIMEOUT_SECONDS", "PKCLAW_CHAT_TIMEOUT_SECONDS") or "45"),
        system_prompt=(_env_first("PKCLAW_SYSTEM_PROMPT", "PKCLAW_CHAT_SYSTEM_PROMPT") or DEFAULT_SYSTEM_PROMPT).strip(),
        extra_headers=extra_headers,
        max_output_tokens=int(_env_first("PKCLAW_MAX_OUTPUT_TOKENS", "PKCLAW_CHAT_MAX_OUTPUT_TOKENS") or "280"),
        reasoning_effort=_env_first("PKCLAW_REASONING_EFFORT", "PKCLAW_CHAT_REASONING_EFFORT") or None,
    )


def _env_first(*names: str) -> str:
    for name in names:
        value = (os.getenv(name, "") or "").strip()
        if value:
            return value
    return ""


def _sanitize_messages(messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    sanitized: list[dict[str, str]] = []
    for item in messages:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role", "user")).strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        sanitized.append({"role": role, "content": content[:6000]})
    return sanitized


def _format_context_package(context_package: dict[str, Any] | None) -> str:
    if not isinstance(context_package, dict) or not context_package:
        return ""

    lines = ["PKclaw context package:"]
    scenario = context_package.get("scenario") or {}
    if scenario:
        lines.append(f"- Scenario: {scenario.get('label') or scenario.get('key')}")

    game_state = context_package.get("game_state") or {}
    if game_state:
        lines.append("- Game state:")
        state_pairs = [
            ("Street", game_state.get("street")),
            ("Hero position", game_state.get("hero_position")),
            ("Hero hand", " ".join(game_state.get("hero_hole_cards") or [])),
            ("Board", " ".join(game_state.get("board_cards") or [])),
            ("Pot (BB)", game_state.get("pot_size")),
            ("Effective stack (BB)", game_state.get("effective_stack")),
            ("Amount to call (BB)", game_state.get("amount_to_call")),
            ("Legal actions", ", ".join(game_state.get("legal_actions") or [])),
        ]
        for label, value in state_pairs:
            if value not in (None, "", []):
                lines.append(f"  - {label}: {value}")
        history = game_state.get("action_history") or []
        if history:
            lines.append("  - Action history:")
            for record in history[-8:]:
                if not isinstance(record, dict):
                    continue
                lines.append(
                    f"    - {record.get('street', '?')} | {record.get('position', '?')} "
                    f"{record.get('player_name', '?')} {record.get('action', '?')} {record.get('amount', 0)}"
                )

    style_profile = context_package.get("style_profile") or {}
    if style_profile:
        lines.append("- Style profile:")
        style_fields = [
            "name",
            "mode",
            "preset_key",
            "vpip",
            "pfr",
            "three_bet",
            "aggression",
            "flop_cbet",
            "turn_barrel",
            "river_bluff",
            "hero_call",
            "risk_tolerance",
        ]
        for field_name in style_fields:
            value = style_profile.get(field_name)
            if value not in (None, "", []):
                lines.append(f"  - {field_name}: {value}")

    evaluator_summary = context_package.get("evaluator_summary") or {}
    if evaluator_summary:
        lines.append("- Evaluator summary:")
        for label, value in (
            ("source", evaluator_summary.get("source")),
            ("hand_bucket", evaluator_summary.get("hand_bucket")),
            ("hand_score", evaluator_summary.get("hand_score")),
            ("board_texture", evaluator_summary.get("board_texture")),
            ("board_tags", ", ".join(evaluator_summary.get("board_tags") or [])),
            ("model_outputs", json.dumps(evaluator_summary.get("model_outputs") or {}, ensure_ascii=True)),
        ):
            if value not in (None, "", [], "{}"):
                lines.append(f"  - {label}: {value}")

    policy_summary = context_package.get("policy_summary") or {}
    if policy_summary:
        lines.append("- Policy summary:")
        if policy_summary.get("action_probabilities"):
            lines.append(
                f"  - action_probabilities: {json.dumps(policy_summary['action_probabilities'], ensure_ascii=True)}"
            )
        if policy_summary.get("selected_size_bucket"):
            lines.append(f"  - selected_size_bucket: {policy_summary['selected_size_bucket']}")
        if policy_summary.get("reason_tags"):
            lines.append(f"  - reason_tags: {', '.join(policy_summary['reason_tags'])}")
        notes = policy_summary.get("notes") or []
        if notes:
            lines.append("  - notes:")
            for note in notes[:6]:
                lines.append(f"    - {note}")

    decision = context_package.get("decision") or {}
    if decision:
        lines.append("- Current decision:")
        for label, value in (
            ("action", decision.get("action")),
            ("size", decision.get("size")),
            ("size_bucket", decision.get("size_bucket")),
            ("reason_tags", ", ".join(decision.get("reason_tags") or [])),
        ):
            if value not in (None, "", []):
                lines.append(f"  - {label}: {value}")

    return "\n".join(lines)


def _build_request_type_prompt(request_context: ChatRequestContext) -> str:
    request_type = request_context.request_type
    request_meta = request_context.request_meta
    if request_type == REQUEST_TYPE_EXPLAIN:
        return (
            "Primary task: explain the current hand and why the current action was chosen. "
            "Focus on the current state, the selected action, size bucket, evaluator signals, and style profile."
        )
    if request_type == REQUEST_TYPE_ALTERNATIVE:
        alternative_action = str(request_meta.get("alternative_action", "")).strip()
        if alternative_action:
            return (
                f"Primary task: compare the chosen action against `{alternative_action}`. "
                "Explain why the current line was selected instead, and mention what would have to change for the alternative to become better."
            )
        return "Primary task: explain why the chosen action beats a natural alternative in this spot."
    if request_type == REQUEST_TYPE_COMPARE_STYLE:
        comparison_style = str(request_meta.get("comparison_style", "")).strip()
        if comparison_style:
            return (
                f"Primary task: compare the current bot with a `{comparison_style}` style. "
                "Describe how preflop range width, aggression, and sizing intent would change."
            )
        return "Primary task: compare the current decision with how a different style profile would likely behave."
    if request_type == REQUEST_TYPE_REVIEW:
        return (
            "Primary task: review this hand in a replay style. Walk through the spot cleanly, call out key inflection points, "
            "and keep the explanation practical rather than solver-theoretical. Reply briefly."
        )
    if request_type == REQUEST_TYPE_HAND_HISTORY:
        return (
            "Primary task: the user likely pasted a messy hand-history-style message. "
            "Give a short first-pass analysis: brief acknowledgement, short conclusion, 2-3 key points, "
            "call out the likely mistake street if one stands out, do not invent missing cards or actions, "
            "and invite follow-up. Focus on the user's pasted hand first, not the current page state."
        )
    return (
        "Primary task: answer the user's poker question using the current PKclaw context package. "
        "Be explicit about tradeoffs between fold/check/call/bet/raise where relevant. Keep the answer compact."
    )


def _extract_response_content(payload: dict[str, Any]) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return _normalize_assistant_content(output_text)
    choices = payload.get("choices") or []
    if not choices:
        output_items = payload.get("output") or []
        parts: list[str] = []
        for item in output_items:
            if not isinstance(item, dict) or item.get("type") != "message":
                continue
            for content_item in item.get("content") or []:
                if not isinstance(content_item, dict):
                    continue
                text_value = content_item.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    parts.append(text_value.strip())
        return _normalize_assistant_content("\n".join(parts).strip())
    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, str):
        return _normalize_assistant_content(content.strip())
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if not isinstance(item, dict):
                continue
            text_value = item.get("text")
            if isinstance(text_value, str):
                parts.append(text_value)
                continue
            if item.get("type") in {"output_text", "text"} and isinstance(item.get("content"), str):
                parts.append(item["content"])
        return _normalize_assistant_content("\n".join(part.strip() for part in parts if part and part.strip()).strip())
    return ""


def _normalize_assistant_content(content: str) -> str:
    normalized = re.sub(r"<think>.*?</think>", "", content, flags=re.IGNORECASE | re.DOTALL)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _resolve_request_type(explicit_request_type: str | None, sanitized_messages: list[dict[str, str]]) -> str:
    normalized = (explicit_request_type or REQUEST_TYPE_DEFAULT).strip() or REQUEST_TYPE_DEFAULT
    if normalized != REQUEST_TYPE_DEFAULT:
        return normalized
    if not sanitized_messages:
        return REQUEST_TYPE_DEFAULT
    latest_user_message = ""
    for item in reversed(sanitized_messages):
        if item["role"] == "user":
            latest_user_message = item["content"]
            break
    if _looks_like_hand_history(latest_user_message):
        return REQUEST_TYPE_HAND_HISTORY
    return REQUEST_TYPE_DEFAULT


def _looks_like_hand_history(text: str) -> bool:
    if not text or len(text) < 80:
        return False
    lowered = text.lower()
    keywords = [
        "flop",
        "turn",
        "river",
        "btn",
        "button",
        "sb",
        "bb",
        "utg",
        "hj",
        "co",
        "lj",
        "mp",
        "call",
        "raise",
        "bet",
        "3b",
        "3-bet",
        "check",
        "jam",
        "all in",
        "blinds",
        "open",
        "cold call",
        "squeeze",
        "pot",
        "stack",
        "hero",
        "villain",
        "小盲",
        "大盲",
        "按钮",
        "翻牌",
        "转牌",
        "河牌",
        "下注",
        "跟注",
        "加注",
        "全下",
        "盲注",
        "后手",
        "冷跟",
    ]
    matches = sum(1 for keyword in keywords if keyword in lowered)
    numeric_structure = bool(re.search(r"\b\d{2,6}/\d{2,6}(?:/\d{2,6})?\b", text))
    action_chain = bool(re.search(r"\b(btn|sb|bb|utg|hj|co|mp)\b.*\b(open|raise|call|3b|3-bet|check|jam)\b", lowered))
    chinese_action_chain = any(token in text for token in ["翻牌", "转牌", "河牌"]) and any(
        token in text for token in ["加注", "跟注", "下注", "check", "raise", "call"]
    )
    return matches >= 4 or ("\n" in text and matches >= 3) or numeric_structure or action_chain or chinese_action_chain


def _extract_user_supplied_hand_history(sanitized_messages: list[dict[str, str]]) -> str:
    for item in reversed(sanitized_messages):
        if item["role"] != "user":
            continue
        content = item["content"].strip()
        if _looks_like_hand_history(content):
            return content[:4000]
    return ""


def _derive_response_flags(content: str) -> list[str]:
    flags: list[str] = []
    stripped = content.strip()
    if not stripped:
        flags.append("empty_response")
        return flags
    if len(stripped) > 1400:
        flags.append("long_response")
    if "<think>" in content.lower():
        flags.append("contains_think_tags")
    lines = [line.strip() for line in stripped.splitlines() if line.strip()]
    if len(lines) <= 1 and len(stripped) < 40:
        flags.append("thin_response")
    poker_keywords = ["raise", "call", "fold", "bet", "bluff", "value", "river", "turn", "flop", "pot", "range", "board", "hand"]
    lowered = stripped.lower()
    if len(stripped) > 30 and not any(keyword in lowered for keyword in poker_keywords):
        flags.append("off_domain_response")
    punctuation_ratio = sum(1 for char in stripped if not char.isalnum() and not char.isspace()) / max(len(stripped), 1)
    if punctuation_ratio > 0.18 or re.search(r"\([A-Za-z]{1,4}\)", stripped):
        flags.append("garbled_response")
    return flags


def _append_chat_log(payload: dict[str, Any]) -> None:
    if _env_first("PKCLAW_CHAT_LOGGING", "PKCLAW_LOG_CHAT", "PKCLAW_CHAT_LOG_ENABLED") in {"0", "false", "False"}:
        return
    log_dir = Path(_env_first("PKCLAW_CHAT_LOG_DIR", "PKCLAW_LOG_DIR") or DEFAULT_CHAT_LOG_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)
    log_entry = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    log_path = log_dir / CHAT_LOG_FILE_NAME
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(log_entry, ensure_ascii=True) + "\n")


def export_chat_sft_dataset(
    *,
    log_dir: str | Path | None = None,
    output_path: str | Path | None = None,
    include_failures: bool = False,
) -> Path:
    resolved_log_dir = Path(log_dir or DEFAULT_CHAT_LOG_DIR)
    input_path = resolved_log_dir / CHAT_LOG_FILE_NAME
    if not input_path.exists():
        raise ChatServiceError(f"Chat log file does not exist yet: {input_path}")

    destination = Path(output_path) if output_path else resolved_log_dir / SFT_EXPORT_FILE_NAME
    written = 0
    with input_path.open("r", encoding="utf-8") as source, destination.open("w", encoding="utf-8") as target:
        for raw_line in source:
            raw_line = raw_line.strip()
            if not raw_line:
                continue
            event = json.loads(raw_line)
            if event.get("status") != "ok":
                if not include_failures:
                    continue
                example = {
                    "status": "error",
                    "timestamp_utc": event.get("timestamp_utc"),
                    "request_type": event.get("request_type"),
                    "messages": event.get("messages") or [],
                    "context_package": event.get("context_package") or {},
                    "error": event.get("error", ""),
                }
                target.write(json.dumps(example, ensure_ascii=True) + "\n")
                written += 1
                continue

            response = event.get("response") or {}
            target.write(
                json.dumps(
                    {
                        "status": "ok",
                        "timestamp_utc": event.get("timestamp_utc"),
                        "request_type": event.get("request_type"),
                        "request_meta": event.get("request_meta") or {},
                        "messages": event.get("messages") or [],
                        "context_package": event.get("context_package") or {},
                        "assistant_response": response.get("content", ""),
                        "assistant_model": response.get("model", ""),
                        "response_flags": response.get("response_flags") or [],
                        "provider": event.get("provider", ""),
                    },
                    ensure_ascii=True,
                )
                + "\n"
            )
            written += 1

    if written == 0:
        raise ChatServiceError("No chat samples were exported. Generate some chat traffic first.")
    return destination
