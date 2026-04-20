import re

SLANG_WORDS = {
    "lol", "tbh", "ngl", "rn", "bro", "yaar", "kya", "hai",
    "haha", "omg", "wtf", "imo", "idk", "btw", "asap", "gonna", "wanna",
    "lemme", "dunno", "yeah", "yep", "nope", "ok", "okay", "hm", "hmm"
}

URGENCY_PHRASES = [
    "immediately", "urgent", "right now", "asap", "quickly",
    "hurry", "fast", "now", "instant", "emergency", "they are waiting",
    "please just", "dont ask", "no questions", "just do it", "do it now",
    "transfer now", "send now", "cant wait", "no time", "in a hurry"
]

THIRD_PARTY_PATTERNS = [
    "they", "he told me", "she said", "they want", "someone asked",
    "person said", "they need", "he wants"
]

CONFUSION_PATTERNS = [
    "should i", "is it okay", "not sure", "i think maybe", "i dont know",
    "am i supposed to", "they said to"
]

MONEY_PATTERNS = [
    "rs", "₹", "rupee", "money", "amount", "pay", "transfer", "send"
]


def _tokenize(message: str) -> list[str]:
    return re.findall(r"\b[\w']+\b", (message or "").lower())


def _count_emojis(text: str) -> int:
    # Covers major emoji ranges commonly used in chat text.
    emoji_regex = re.compile(
        "["
        "\U0001F300-\U0001F5FF"
        "\U0001F600-\U0001F64F"
        "\U0001F680-\U0001F6FF"
        "\U0001F700-\U0001F77F"
        "\U0001F780-\U0001F7FF"
        "\U0001F800-\U0001F8FF"
        "\U0001F900-\U0001F9FF"
        "\U0001FA00-\U0001FAFF"
        "\u2600-\u26FF"
        "\u2700-\u27BF"
        "]",
        flags=re.UNICODE,
    )
    return len(emoji_regex.findall(text or ""))


def _message_formality_score(message: str) -> float:
    text = (message or "").strip()
    if not text:
        return 0.0

    words = _tokenize(text)
    lowered = text.lower()
    slang_present = any(w in SLANG_WORDS for w in words)
    emoji_present = _count_emojis(text) > 0
    word_count = len(words)

    score = 0
    if text.endswith((".", "?", "!")):
        score += 20
    if text[0].isalpha() and text[0].isupper():
        score += 20
    if not slang_present:
        score += 20
    if word_count > 15:
        score += 20
    if not emoji_present:
        score += 20
    return float(score)


def _count_phrase_occurrences(message: str, phrases: list[str]) -> int:
    lowered = (message or "").lower()
    return sum(1 for phrase in phrases if phrase in lowered)


def build_baseline(messages: list[str]) -> dict:
    cleaned = [m.strip() for m in (messages or []) if isinstance(m, str) and m.strip()]
    total_messages = len(cleaned)
    if total_messages == 0:
        return {
            "avg_message_length": 0.0,
            "avg_words_per_message": 0.0,
            "slang_ratio": 0.0,
            "formality_score": 0.0,
            "emoji_frequency": 0.0,
            "urgency_word_count": 0.0,
            "total_messages_sampled": 0,
        }

    total_chars = 0
    total_words = 0
    total_slang_words = 0
    total_formality = 0.0
    total_emojis = 0
    total_urgency_hits = 0

    for msg in cleaned:
        words = _tokenize(msg)
        total_chars += len(msg)
        total_words += len(words)
        total_slang_words += sum(1 for word in words if word in SLANG_WORDS)
        total_formality += _message_formality_score(msg)
        total_emojis += _count_emojis(msg)
        total_urgency_hits += _count_phrase_occurrences(msg, URGENCY_PHRASES)

    slang_ratio = (total_slang_words / total_words) if total_words > 0 else 0.0
    return {
        "avg_message_length": total_chars / total_messages,
        "avg_words_per_message": total_words / total_messages,
        "slang_ratio": slang_ratio,
        "formality_score": total_formality / total_messages,
        "emoji_frequency": total_emojis / total_messages,
        "urgency_word_count": total_urgency_hits / total_messages,
        "total_messages_sampled": total_messages,
    }


def score_deviation(message: str, baseline: dict) -> dict:
    baseline = baseline or {}
    msg = (message or "").strip()
    words = _tokenize(msg)
    word_count = len(words)
    message_length = len(msg)

    baseline_formality = float(baseline.get("formality_score", 0) or 0)
    baseline_length = float(baseline.get("avg_message_length", 0) or 0)
    baseline_slang = float(baseline.get("slang_ratio", 0) or 0)
    total_messages_sampled = int(baseline.get("total_messages_sampled", baseline.get("totalMessagesSampled", 0)) or 0)

    current_formality = _message_formality_score(msg)
    current_slang_count = sum(1 for word in words if word in SLANG_WORDS)
    current_slang_ratio = (current_slang_count / word_count) if word_count > 0 else 0.0
    urgency_hits = _count_phrase_occurrences(msg, URGENCY_PHRASES)

    triggered = []
    score = 0
    lowered = msg.lower()

    third_party_detected = any(pattern in lowered for pattern in THIRD_PARTY_PATTERNS)
    confusion_detected = any(pattern in lowered for pattern in CONFUSION_PATTERNS)

    if total_messages_sampled < 5:
        return {
            "deviation_score": 0,
            "triggered_signals": [],
            "risk_level": "LOW",
            "baseline_mature": False,
            "urgency_detected": urgency_hits > 0,
            "third_party_detected": third_party_detected,
            "confusion_detected": confusion_detected,
        }

    if abs(current_formality - baseline_formality) > 35:
        score += 20
        triggered.append({
            "name": "Unusual Formality Shift",
            "explanation": "Your writing style is unusually different from normal"
        })

    if urgency_hits > 0:
        score += 25
        triggered.append({
            "name": "Urgency Language Detected",
            "explanation": "Message contains words associated with pressure or rush"
        })

    if baseline_length > 0:
        deviation_ratio = abs(message_length - baseline_length) / baseline_length
        if deviation_ratio > 0.60:
            score += 15
            triggered.append({
                "name": "Unusual Message Length",
                "explanation": "This message is very different in length from your usual style"
            })

    if baseline_slang > 0 and (baseline_slang - current_slang_ratio) / baseline_slang > 0.40:
        score += 15
        triggered.append({
            "name": "Communication Style Change",
            "explanation": "You are communicating much more formally than usual"
        })

    if third_party_detected:
        score += 25
        triggered.append({
            "name": "Third Party Influence Detected",
            "explanation": "Message suggests someone else may be directing this action"
        })

    money_present = any(pattern in lowered for pattern in MONEY_PATTERNS) or bool(re.search(r"\d", lowered))
    if urgency_hits > 0 and money_present:
        score += 30
        triggered.append({
            "name": "Pressured Financial Action",
            "explanation": "Combination of urgency and financial action is a fraud signal"
        })

    if confusion_detected:
        score += 10
        triggered.append({
            "name": "Decision Uncertainty",
            "explanation": "You seem uncertain about this action"
        })

    if score <= 20:
        risk_level = "LOW"
    elif score <= 45:
        risk_level = "MEDIUM"
    elif score <= 70:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"

    return {
        "deviation_score": min(score, 100),
        "triggered_signals": triggered,
        "risk_level": risk_level,
        "baseline_mature": True,
        "urgency_detected": urgency_hits > 0,
        "third_party_detected": third_party_detected,
        "confusion_detected": confusion_detected,
    }


def classify_intent(message: str, deviation_result: dict, action_type: str) -> dict:
    message = (message or "").lower()
    deviation_score = int(deviation_result.get("deviation_score", 0) or 0)
    signals = deviation_result.get("triggered_signals", []) or []
    signal_names = {s.get("name", "") for s in signals}
    action_type = (action_type or "").lower()

    is_transfer_like = "transfer" in action_type or "send" in action_type or "payment" in action_type
    amount_match = re.search(r"\b\d{4,}\b", message)
    involves_large_amount = bool(amount_match) or "large" in action_type

    urgency_signal = "Urgency Language Detected" in signal_names or bool(deviation_result.get("urgency_detected"))
    third_party_signal = "Third Party Influence Detected" in signal_names or bool(deviation_result.get("third_party_detected"))
    uncertainty_signal = "Decision Uncertainty" in signal_names
    panic_flag = bool(deviation_result.get("panic_phrase_detected", False))
    baseline_mature = bool(deviation_result.get("baseline_mature", True))

    if not baseline_mature:
        if urgency_signal and third_party_signal:
            return {
                "intent": "COERCED",
                "confidence": "HIGH",
                "reasoning": "Urgency plus third-party direction detected while baseline is still learning."
            }
        if urgency_signal or third_party_signal:
            return {
                "intent": "PRESSURED",
                "confidence": "MEDIUM",
                "reasoning": "Early warning signals detected before behavioural baseline matures."
            }
        return {
            "intent": "GENUINE",
            "confidence": "HIGH",
            "reasoning": "Baseline is still maturing; no pressure signals detected."
        }

    if deviation_score > 65 or panic_flag or (third_party_signal and urgency_signal):
        return {
            "intent": "COERCED",
            "confidence": "HIGH",
            "reasoning": "High-risk conversational pressure indicators suggest possible coercion."
        }

    if 40 <= deviation_score <= 65 or (urgency_signal and (is_transfer_like or involves_large_amount)) or third_party_signal:
        return {
            "intent": "PRESSURED",
            "confidence": "MEDIUM",
            "reasoning": "Message shows signs of urgency or external influence."
        }

    if uncertainty_signal and (is_transfer_like or involves_large_amount):
        return {
            "intent": "CONFUSED",
            "confidence": "MEDIUM",
            "reasoning": "User appears uncertain while attempting a significant action."
        }

    return {
        "intent": "GENUINE",
        "confidence": "HIGH",
        "reasoning": "Conversation appears consistent with normal intent."
    }


def generate_security_response(intent: str, action_type: str, action_details: dict, baseline_mature: bool = True) -> dict:
    action_type = action_type or "this action"
    action_details = action_details or {}
    amount = action_details.get("amount")
    recipient = action_details.get("recipient")

    if amount is not None:
        key_detail = f"amount ₹{amount}"
    elif recipient:
        key_detail = f"recipient {recipient}"
    else:
        key_detail = "the selected details"

    if intent == "GENUINE":
        if not baseline_mature:
            return {
                "chatbot_message": (
                    f"Just to confirm — you want to {action_type} for {key_detail}. "
                    "Is that correct? This is a quick safety check we do for significant actions."
                ),
                "recommended_action": "PROCEED_WITH_CONFIRMATION",
                "show_cooloff_option": False,
                "silent_block": False,
            }
        return {
            "chatbot_message": (
                f"I can see you want to {action_type}. Just to confirm — {key_detail}. Is that right?"
            ),
            "recommended_action": "PROCEED_WITH_CONFIRMATION",
            "show_cooloff_option": False,
            "silent_block": False,
        }

    if intent == "CONFUSED":
        return {
            "chatbot_message": (
                f"It looks like you might have some questions about this. This action will {action_type}. "
                "There is no rush at all — would you like to proceed, or would you prefer to schedule this for later "
                "when you have had more time to think?"
            ),
            "recommended_action": "EXPLAIN_AND_RECONFIRM",
            "show_cooloff_option": True,
            "silent_block": False,
        }

    if intent == "PRESSURED":
        return {
            "chatbot_message": (
                "Hey, I just want to make sure you are comfortable with this decision. "
                "This is a significant action and there is absolutely no rush. "
                "I have saved your request and can process it in a few hours. You can cancel anytime. Is everything okay?"
            ),
            "recommended_action": "COOLING_OFF",
            "show_cooloff_option": True,
            "silent_block": False,
        }

    return {
        "chatbot_message": "Got it, I am processing your request now. This may take a few minutes.",
        "recommended_action": "SILENT_BLOCK",
        "show_cooloff_option": False,
        "silent_block": True,
    }
