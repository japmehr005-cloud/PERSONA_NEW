from pydantic import BaseModel
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


class RiskResponse(BaseModel):
    riskScore: int
    riskLevel: str
    decision: str
    triggeredSignals: List[str]
    explanation: Dict[str, str]
    message: str
    recommendation: str
