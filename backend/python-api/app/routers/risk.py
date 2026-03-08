from fastapi import APIRouter
from app.models.risk_models import RiskRequest, RiskResponse
from app.services.risk_engine import calculate_risk

router = APIRouter()


@router.post("/score", response_model=RiskResponse)
def score_action(req: RiskRequest):
    return calculate_risk(req)
