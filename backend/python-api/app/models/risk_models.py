from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class RiskRequest(BaseModel):
    userId: str
    actionType: str
    amount: float
    sessionAgeSeconds: int
    isNewDevice: bool
    otpAttempts: int
    isFirstTimeActionType: bool
    retryCount: int
    userAvgTransactionAmount: float
    securityScore: Optional[float] = None
    hour_of_day: Optional[int] = 0
    user_typical_hours: Optional[List[int]] = Field(default_factory=list)
    actions_last_hour: Optional[int] = 0
    is_new_beneficiary: Optional[bool] = False
    previous_transfer_count_to_beneficiary: Optional[int] = 0
    conversational_deviation_score: Optional[float] = 0


class RiskResponse(BaseModel):
    riskScore: int
    riskLevel: str
    decision: str
    triggeredSignals: List[str]
    explanation: Dict[str, str]
    message: str
    recommendation: str
