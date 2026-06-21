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
    "time_of_day_anomaly": 15,
    "velocity_check_high": 20,
    "velocity_check_very_high": 35,
    "beneficiary_trust_high": 20,
    "beneficiary_trust_very_high": 35,
    "conversational_risk_low": 10,
    "conversational_risk_medium": 25,
    "conversational_risk_high": 40,
    "round_number_check": 10,
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
    "time_of_day_anomaly": "This action is happening outside your normal active hours",
    "velocity_check": "Unusually high number of actions in a short period",
    "beneficiary_trust": "You have never sent money to this recipient before",
    "conversational_risk": "How you are communicating right now differs from your normal pattern",
    "round_number_check": "Large round number transfers to new recipients are a common fraud pattern",
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

    hour = req.hour_of_day if req.hour_of_day is not None else 0
    typical_hours = set(req.user_typical_hours or [])
    if hour not in typical_hours and req.amount > 10000:
        score += SIGNAL_WEIGHTS["time_of_day_anomaly"]
        triggered.append("time_of_day_anomaly")

    if (req.actions_last_hour or 0) > 10:
        score += SIGNAL_WEIGHTS["velocity_check_very_high"]
        triggered.append("velocity_check")
    elif (req.actions_last_hour or 0) > 5:
        score += SIGNAL_WEIGHTS["velocity_check_high"]
        triggered.append("velocity_check")

    if req.is_new_beneficiary and req.amount > 25000:
        score += SIGNAL_WEIGHTS["beneficiary_trust_very_high"]
        triggered.append("beneficiary_trust")
    elif req.is_new_beneficiary and req.amount > 5000:
        score += SIGNAL_WEIGHTS["beneficiary_trust_high"]
        triggered.append("beneficiary_trust")

    conv_score = req.conversational_deviation_score or 0
    if conv_score > 70:
        score += SIGNAL_WEIGHTS["conversational_risk_high"]
        triggered.append("conversational_risk")
    elif conv_score > 45:
        score += SIGNAL_WEIGHTS["conversational_risk_medium"]
        triggered.append("conversational_risk")
    elif conv_score > 20:
        score += SIGNAL_WEIGHTS["conversational_risk_low"]
        triggered.append("conversational_risk")

    if req.is_new_beneficiary and req.amount > 10000 and req.amount % 1000 == 0:
        score += SIGNAL_WEIGHTS["round_number_check"]
        triggered.append("round_number_check")

    if score >= 90:
        level, decision = "CRITICAL", "CRITICAL_BLOCK"
        message = "This action has been blocked for your protection."
        recommendation = "This high-risk action cannot be overridden."
    elif score >= 60:
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

    def _weight_for_signal(sig: str) -> int:
        if sig == "velocity_check":
            return SIGNAL_WEIGHTS["velocity_check_very_high"] if (req.actions_last_hour or 0) > 10 else SIGNAL_WEIGHTS["velocity_check_high"]
        if sig == "beneficiary_trust":
            return SIGNAL_WEIGHTS["beneficiary_trust_very_high"] if req.amount > 25000 else SIGNAL_WEIGHTS["beneficiary_trust_high"]
        if sig == "conversational_risk":
            if conv_score > 70:
                return SIGNAL_WEIGHTS["conversational_risk_high"]
            if conv_score > 45:
                return SIGNAL_WEIGHTS["conversational_risk_medium"]
            return SIGNAL_WEIGHTS["conversational_risk_low"]
        return SIGNAL_WEIGHTS.get(sig, 0)

    explanation = {
        sig: f"{SIGNAL_DESCRIPTIONS[sig]} (+{_weight_for_signal(sig)} points)"
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
