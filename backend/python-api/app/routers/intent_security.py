from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.conversation_analyser import (
    build_baseline,
    score_deviation,
    classify_intent,
    generate_security_response,
)

router = APIRouter(prefix="/intent", tags=["Intent Security"])


class AnalyseIntentRequest(BaseModel):
    userId: str
    message: str
    actionType: str
    actionDetails: Dict[str, Any] = Field(default_factory=dict)
    conversationalProfile: Dict[str, Any] = Field(default_factory=dict)
    panicPhrase: Optional[str] = None
    safePhrase: Optional[str] = None


class BuildBaselineRequest(BaseModel):
    userId: str
    messages: List[str]


class UpdateBaselineRequest(BaseModel):
    userId: str
    newMessage: str
    currentProfile: Dict[str, Any] = Field(default_factory=dict)


@router.post("/analyse")
def analyse_intent(req: AnalyseIntentRequest):
    message = (req.message or "").strip()
    panic_phrase = (req.panicPhrase or "").strip()

    if panic_phrase and message.lower() == panic_phrase.lower():
        return {
            "deviation_score": 100,
            "risk_level": "CRITICAL",
            "triggered_signals": [{
                "name": "Panic Phrase Triggered",
                "explanation": "Silent distress phrase matched exactly."
            }],
            "intent": "COERCED",
            "confidence": "HIGH",
            "reasoning": "Panic phrase triggered emergency coercion handling.",
            "chatbot_message": "Got it, I am processing your request now. This may take a few minutes.",
            "recommended_action": "SILENT_BLOCK",
            "show_cooloff_option": False,
            "silent_block": True,
        }

    deviation_result = score_deviation(message, req.conversationalProfile or {})
    intent_result = classify_intent(message, deviation_result, req.actionType)
    response_result = generate_security_response(intent_result["intent"], req.actionType, req.actionDetails)

    return {
        "deviation_score": deviation_result["deviation_score"],
        "risk_level": deviation_result["risk_level"],
        "triggered_signals": deviation_result["triggered_signals"],
        "intent": intent_result["intent"],
        "confidence": intent_result["confidence"],
        "reasoning": intent_result["reasoning"],
        "chatbot_message": response_result["chatbot_message"],
        "recommended_action": response_result["recommended_action"],
        "show_cooloff_option": response_result["show_cooloff_option"],
        "silent_block": response_result["silent_block"],
    }


@router.post("/build-baseline")
def build_intent_baseline(req: BuildBaselineRequest):
    return build_baseline(req.messages or [])


@router.post("/update-baseline")
def update_intent_baseline(req: UpdateBaselineRequest):
    current = req.currentProfile or {}
    new_metrics = build_baseline([req.newMessage])

    existing_weight = 0.85
    new_weight = 0.15
    keys = [
        "avg_message_length",
        "avg_words_per_message",
        "slang_ratio",
        "formality_score",
        "emoji_frequency",
        "urgency_word_count",
    ]

    updated = {}
    for key in keys:
        old_val = float(current.get(key, 0) or 0)
        new_val = float(new_metrics.get(key, 0) or 0)
        updated[key] = (old_val * existing_weight) + (new_val * new_weight)

    updated["avg_response_time_ms"] = float(current.get("avgResponseTimeMs", current.get("avg_response_time_ms", 0)) or 0)
    updated["total_messages_sampled"] = int(current.get("totalMessagesSampled", current.get("total_messages_sampled", 0)) or 0) + 1
    updated["panic_phrase"] = current.get("panicPhrase", current.get("panic_phrase"))
    updated["safe_phrase"] = current.get("safePhrase", current.get("safe_phrase"))
    return updated
