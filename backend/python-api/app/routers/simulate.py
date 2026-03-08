from fastapi import APIRouter
from app.models.simulate_models import (
    SplurgeRequest,
    SplurgeResponse,
    InvestRequest,
    InvestResponse,
    CutRequest,
    CutResponse,
)
from app.services.simulation_engine import simulate_splurge, simulate_invest, simulate_cut

router = APIRouter()


@router.post("/splurge", response_model=SplurgeResponse)
def splurge_check(req: SplurgeRequest):
    return simulate_splurge(req)


@router.post("/invest", response_model=InvestResponse)
def invest_sim(req: InvestRequest):
    return simulate_invest(req)


@router.post("/cut", response_model=CutResponse)
def cut_sim(req: CutRequest):
    return simulate_cut(req)
