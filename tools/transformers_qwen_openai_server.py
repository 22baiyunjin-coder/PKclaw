from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _lazy_import_backends():
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    return torch, AutoModelForCausalLM, AutoTokenizer


@dataclass(frozen=True)
class ServerConfig:
    model_path: str
    served_model_name: str
    host: str
    port: int
    max_new_tokens: int
    temperature: float
    top_p: float
    dtype: str


class QwenService:
    def __init__(self, config: ServerConfig) -> None:
        self.config = config
        self._torch, auto_model, auto_tokenizer = _lazy_import_backends()
        self.tokenizer = auto_tokenizer.from_pretrained(config.model_path, trust_remote_code=True)
        torch_dtype = self._resolve_dtype(config.dtype)
        self.model = auto_model.from_pretrained(
            config.model_path,
            torch_dtype=torch_dtype,
            device_map="auto",
            trust_remote_code=True,
        )
        self._device = next(self.model.parameters()).device

    def chat_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        messages = payload.get("messages") or []
        if not isinstance(messages, list) or not messages:
            raise ValueError("`messages` must be a non-empty list.")

        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        max_tokens = int(payload.get("max_tokens") or payload.get("max_completion_tokens") or self.config.max_new_tokens)
        temperature = float(payload.get("temperature", self.config.temperature))
        top_p = float(payload.get("top_p", self.config.top_p))
        content = self._generate_from_prompt(prompt, max_tokens=max_tokens, temperature=temperature, top_p=top_p)
        prompt_tokens = len(self.tokenizer.encode(prompt, add_special_tokens=False))
        completion_tokens = len(self.tokenizer.encode(content, add_special_tokens=False))

        return {
            "id": f"chatcmpl-{uuid.uuid4().hex}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": self.config.served_model_name,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content,
                        "refusal": None,
                        "annotations": None,
                        "audio": None,
                        "function_call": None,
                        "tool_calls": [],
                    },
                    "logprobs": None,
                    "finish_reason": "stop",
                    "stop_reason": None,
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "prompt_tokens_details": None,
            },
            "service_tier": None,
            "system_fingerprint": None,
        }

    def completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        prompt = str(payload.get("prompt", "")).strip()
        if not prompt:
            raise ValueError("`prompt` must be a non-empty string.")
        max_tokens = int(payload.get("max_tokens") or self.config.max_new_tokens)
        temperature = float(payload.get("temperature", self.config.temperature))
        top_p = float(payload.get("top_p", self.config.top_p))
        content = self._generate_from_prompt(prompt, max_tokens=max_tokens, temperature=temperature, top_p=top_p)
        prompt_tokens = len(self.tokenizer.encode(prompt, add_special_tokens=False))
        completion_tokens = len(self.tokenizer.encode(content, add_special_tokens=False))

        return {
            "id": f"cmpl-{uuid.uuid4().hex}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": self.config.served_model_name,
            "choices": [
                {
                    "index": 0,
                    "text": content,
                    "logprobs": None,
                    "finish_reason": "stop",
                    "stop_reason": None,
                    "prompt_logprobs": None,
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "prompt_tokens_details": None,
            },
            "service_tier": None,
            "system_fingerprint": None,
        }

    def model_list(self) -> dict[str, Any]:
        return {
            "object": "list",
            "data": [
                {
                    "id": self.config.served_model_name,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "pkclaw-transformers",
                    "root": self.config.model_path,
                    "parent": None,
                }
            ],
        }

    def health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "model": self.config.served_model_name,
            "model_path": self.config.model_path,
            "device": str(self._device),
        }

    def _generate_from_prompt(self, prompt: str, *, max_tokens: int, temperature: float, top_p: float) -> str:
        encoded = self.tokenizer(prompt, return_tensors="pt")
        encoded = {name: tensor.to(self._device) for name, tensor in encoded.items()}
        do_sample = temperature > 0
        generation_kwargs: dict[str, Any] = {
            **encoded,
            "max_new_tokens": max_tokens,
            "do_sample": do_sample,
            "pad_token_id": self.tokenizer.eos_token_id,
        }
        if do_sample:
            generation_kwargs["temperature"] = max(temperature, 1e-5)
            generation_kwargs["top_p"] = top_p
        with self._torch.no_grad():
            generated = self.model.generate(**generation_kwargs)
        prompt_len = encoded["input_ids"].shape[1]
        completion = self.tokenizer.decode(generated[0][prompt_len:], skip_special_tokens=True)
        return completion.strip()

    def _resolve_dtype(self, dtype_name: str):
        if dtype_name == "bfloat16":
            return self._torch.bfloat16
        if dtype_name == "float16":
            return self._torch.float16
        if dtype_name == "float32":
            return self._torch.float32
        return "auto"


def build_config() -> ServerConfig:
    model_path = os.getenv("PKCLAW_QWEN_MODEL_PATH", "/data/Brian/Qwen3-4B-Instruct-2507")
    served_model_name = os.getenv("PKCLAW_QWEN_MODEL_NAME", Path(model_path).name)
    return ServerConfig(
        model_path=model_path,
        served_model_name=served_model_name,
        host=os.getenv("PKCLAW_QWEN_HOST", "0.0.0.0"),
        port=int(os.getenv("PKCLAW_QWEN_PORT", "8001")),
        max_new_tokens=int(os.getenv("PKCLAW_QWEN_MAX_NEW_TOKENS", "220")),
        temperature=float(os.getenv("PKCLAW_QWEN_TEMPERATURE", "0.2")),
        top_p=float(os.getenv("PKCLAW_QWEN_TOP_P", "0.9")),
        dtype=os.getenv("PKCLAW_QWEN_DTYPE", "bfloat16"),
    )


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "PKclawTransformersServer/1.0"

    @property
    def service(self) -> QwenService:
        return self.server.service  # type: ignore[attr-defined]

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, self.service.health())
            return
        if parsed.path == "/v1/models":
            self._send_json(200, self.service.model_list())
            return
        self.send_error(404, "Unknown endpoint")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            payload = self._read_json_body()
            if parsed.path == "/v1/chat/completions":
                self._send_json(200, self.service.chat_completion(payload))
                return
            if parsed.path == "/v1/completions":
                self._send_json(200, self.service.completion(payload))
                return
            self.send_error(404, "Unknown endpoint")
        except ValueError as exc:
            self._send_json(400, {"error": {"message": str(exc), "type": "invalid_request_error"}})
        except Exception as exc:  # pragma: no cover - remote helper
            self._send_json(500, {"error": {"message": str(exc), "type": "server_error"}})

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("Request body must be valid JSON.") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    config = build_config()
    service = QwenService(config)
    server = ThreadingHTTPServer((config.host, config.port), RequestHandler)
    server.service = service  # type: ignore[attr-defined]
    print(
        f"PKclaw transformers chat server running on http://{config.host}:{config.port} "
        f"for model {config.served_model_name}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down transformers chat server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
