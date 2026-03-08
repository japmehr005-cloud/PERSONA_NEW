from app.models.risk_models import RiskRequest, RiskResponse

SIGNAL_WEIGHTS = {
    "new_device": 20,
    "fast_action": 15,
    "large_amount": 25,
    "very_large_amount": 40,
    "multiple_otp_attempts": 20,
    "first_time_action_type": 10,
    "high_retry_count": 15,
    "very_high_amount_abs": 20,
    "weak_security_posture": 20,
}

SIGNAL_DESCRIPTIONS = {
    "new_device": "Login from an unrecognized device",
    "fast_action": "Action taken within 10 seconds of login",
    "large_amount": "Amount is over 2.5× your usual transaction",
    "very_large_amount": "Amount is over 5× your usual transaction",
    "multiple_otp_attempts": "Multiple OTP attempts detected this session",
    "first_time_action_type": "First time performing this type of action",
    "high_retry_count": "This action was retried multiple times",
    "very_high_amount_abs": "Amount exceeds ₹1,00,000",
    "weak_security_posture": "Security hardening score is below 50",
}


def calculate_risk(req: RiskRequest) -> RiskResponse:
    score = 0
    triggered = []

    if req.isNewDevice:
        score += SIGNAL_WEIGHTS["new_device"]
        triggered.append("new_device")

    if req.sessionAgeSeconds < 10:
        score += SIGNAL_WEIGHTS["fast_action"]
        triggered.append("fast_action")

    if req.userAvgTransactionAmount > 0:
        ratio = req.amount / req.userAvgTransactionAmount
        if ratio > 5:
            score += SIGNAL_WEIGHTS["very_large_amount"]
            triggered.append("very_large_amount")
        elif ratio > 2.5:
            score += SIGNAL_WEIGHTS["large_amount"]
            triggered.append("large_amount")

    if req.amount > 100000:
        score += SIGNAL_WEIGHTS["very_high_amount_abs"]
        triggered.append("very_high_amount_abs")

    if req.otpAttempts > 2:
        score += SIGNAL_WEIGHTS["multiple_otp_attempts"]
        triggered.append("multiple_otp_attempts")

    if req.isFirstTimeActionType:
        score += SIGNAL_WEIGHTS["first_time_action_type"]
        triggered.append("first_time_action_type")

    if req.retryCount > 2:
        score += SIGNAL_WEIGHTS["high_retry_count"]
        triggered.append("high_retry_count")

    if req.securityScore is not None and req.securityScore < 50:
        score += SIGNAL_WEIGHTS["weak_security_posture"]
        triggered.append("weak_security_posture")

    if score >= 60:
        level, decision = "HIGH", "BLOCK"
        message = "This action has been blocked due to high fraud risk signals. Please contact your bank or retry after 30 minutes."
        recommendation = "If this was you, log in again from your trusted device and retry."
    elif score >= 30:
        level, decision = "MEDIUM", "WARN"
        message = "Unusual signals detected. Please review carefully before confirming."
        recommendation = "Take a moment to verify this is the right action. Confirm only if you initiated this."
    else:
        level, decision = "LOW", "ALLOW"
        message = "Action looks safe."
        recommendation = "All clear — proceed."

    explanation = {
        sig: f"{SIGNAL_DESCRIPTIONS[sig]} (+{SIGNAL_WEIGHTS[sig]} points)"
        for sig in triggered
    }

    return RiskResponse(
        riskScore=score,
        riskLevel=level,
        decision=decision,
        triggeredSignals=triggered,
        explanation=explanation,
        message=message,
        recommendation=recommendation,
    )
