from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any
from urllib import error, request


DEFAULT_SYSTEM_PROMPT = (
    "You are PKclaw's poker discussion copilot. Help users talk through hands, board texture, "
    "ranges, sizing, and style-driven decisions in practical product language. Use the provided "
    "hand context when it exists. Be clear about uncertainty, do not pretend to be solver-perfect, "
    "and prefer concise, actionable reasoning."
)


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


@dataclass(frozen=True)
class ChatCompletionResult:
    content: str
    model: str
    usage: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"content": self.content, "model": self.model, "usage": self.usage or {}}


class ChatModelClient(ABC):
    @abstractmethod
    def complete(self, messages: list[dict[str, str]]) -> ChatCompletionResult:
        raise NotImplementedError


class OpenAICompatibleChatClient(ChatModelClient):
    def __init__(self, config: ChatConfig) -> None:
        self.config = config

    def complete(self, messages: list[dict[str, str]]) -> ChatCompletionResult:
        url = self.config.base_url.rstrip("/") + self.config.api_path
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }
        headers.update(self.config.extra_headers)
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
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
            if message["role"] == "system" and "Hand replay context" in message["content"] and not latest_context:
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
        summary_lines.append("Next step for a real provider is to set PKCLAW_CHAT_BASE_URL, PKCLAW_CHAT_API_KEY, and PKCLAW_CHAT_MODEL.")
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
        missing.append("PKCLAW_CHAT_BASE_URL")
    if not config.api_key:
        missing.append("PKCLAW_CHAT_API_KEY")
    if not config.model:
        missing.append("PKCLAW_CHAT_MODEL")

    if missing:
        return ChatBackendStatus(
            provider=config.provider,
            configured=False,
            model=config.model,
            base_url=config.base_url,
            message=f"Chat backend is not configured yet. Missing: {', '.join(missing)}",
        )

    return ChatBackendStatus(
        provider=config.provider,
        configured=True,
        model=config.model,
        base_url=config.base_url,
        message="Chat backend is configured and ready.",
    )


def chat_about_hand(messages: list[dict[str, Any]], hand_context: dict[str, Any] | None = None) -> ChatCompletionResult:
    sanitized_messages = _sanitize_messages(messages)
    if not sanitized_messages:
        raise ChatServiceError("Chat request did not include any usable user messages.")

    config = _load_chat_config()
    client = _build_chat_client(config)

    request_messages = [{"role": "system", "content": config.system_prompt}]
    context_text = _format_hand_context(hand_context)
    if context_text:
        request_messages.append({"role": "system", "content": context_text})
    request_messages.extend(sanitized_messages[-16:])
    return client.complete(request_messages)


def _build_chat_client(config: ChatConfig) -> ChatModelClient:
    if config.provider == "mock":
        return MockChatClient(config)
    if config.provider == "openai_compatible":
        status = get_chat_status()
        if not status.configured:
            raise ChatServiceError(status.message)
        return OpenAICompatibleChatClient(config)
    raise ChatServiceError(f"Unsupported chat provider: {config.provider}")


def _load_chat_config() -> ChatConfig:
    provider = (os.getenv("PKCLAW_CHAT_PROVIDER", "openai_compatible") or "openai_compatible").strip()
    extra_headers_raw = (os.getenv("PKCLAW_CHAT_EXTRA_HEADERS", "") or "").strip()
    extra_headers: dict[str, str] = {}
    if extra_headers_raw:
        try:
            extra_headers = {str(key): str(value) for key, value in json.loads(extra_headers_raw).items()}
        except json.JSONDecodeError as exc:
            raise ChatServiceError("PKCLAW_CHAT_EXTRA_HEADERS must be valid JSON.") from exc

    return ChatConfig(
        provider=provider,
        base_url=(os.getenv("PKCLAW_CHAT_BASE_URL", "") or "").strip(),
        api_key=(os.getenv("PKCLAW_CHAT_API_KEY", "") or "").strip(),
        model=(os.getenv("PKCLAW_CHAT_MODEL", "") or "").strip(),
        api_path=(os.getenv("PKCLAW_CHAT_API_PATH", "/chat/completions") or "/chat/completions").strip(),
        temperature=float(os.getenv("PKCLAW_CHAT_TEMPERATURE", "0.35")),
        timeout_seconds=float(os.getenv("PKCLAW_CHAT_TIMEOUT_SECONDS", "45")),
        system_prompt=(os.getenv("PKCLAW_CHAT_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT) or DEFAULT_SYSTEM_PROMPT).strip(),
        extra_headers=extra_headers,
    )


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


def _format_hand_context(hand_context: dict[str, Any] | None) -> str:
    if not isinstance(hand_context, dict) or not hand_context:
        return ""

    lines = ["Hand replay context from the PKclaw local demo:"]
    simple_pairs = [
        ("Seed", hand_context.get("seed")),
        ("Street", hand_context.get("street")),
        ("Pot (BB)", hand_context.get("pot_bb")),
        ("Acting player", hand_context.get("acting_player")),
        ("Current event", hand_context.get("event_label")),
        ("Event kind", hand_context.get("event_kind")),
        ("Headline", hand_context.get("headline")),
    ]
    for label, value in simple_pairs:
        if value not in (None, "", []):
            lines.append(f"- {label}: {value}")

    board = hand_context.get("board") or []
    if board:
        lines.append(f"- Board: {' '.join(str(card) for card in board)}")

    winners = hand_context.get("winners") or []
    if winners:
        lines.append(f"- Winners shown so far: {', '.join(str(name) for name in winners)}")

    players = hand_context.get("players") or []
    if players:
        lines.append("- Players:")
        for player in players[:8]:
            if not isinstance(player, dict):
                continue
            player_line = (
                f"  - {player.get('position', '?')} {player.get('name', '?')} "
                f"[{player.get('profile_name', 'unknown profile')}] "
                f"stack={player.get('stack_bb', '?')} BB "
                f"in_hand={player.get('in_hand', True)} "
                f"last_action={player.get('last_action', 'waiting')}"
            )
            hole_cards = player.get("hole_cards") or []
            if hole_cards:
                player_line += f" hole_cards={' '.join(str(card) for card in hole_cards)}"
            lines.append(player_line)

    recent_actions = hand_context.get("recent_actions") or []
    if recent_actions:
        lines.append("- Recent actions:")
        for action in recent_actions[-8:]:
            lines.append(f"  - {action}")

    return "\n".join(lines)


def _extract_response_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
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
        return "\n".join(part.strip() for part in parts if part and part.strip()).strip()
    return ""
