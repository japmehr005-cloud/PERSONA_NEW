from pydantic import BaseModel
from typing import List


class SplurgeRequest(BaseModel):
    purchaseAmount: float
    monthlyIncome: float
    monthlyExpenses: float
    goalTargetAmount: float
    currentBalance: float


class SplurgeResponse(BaseModel):
    purchaseAmount: float
    monthlySavings: float
    pctOfSavings: float
    goalDelayDays: int
    monthsToGoalBefore: float
    monthsToGoalAfter: float
    verdictLevel: str
    verdictMessage: str


class InvestRequest(BaseModel):
    monthlyAmount: float
    years: int
    annualReturnPct: float


class ChartPoint(BaseModel):
    year: int
    value: float
    invested: float


class InvestResponse(BaseModel):
    chartData: List[ChartPoint]
    totalInvested: float
    futureValue: float
    totalGain: float
    returnMultiple: float


class CutRequest(BaseModel):
    monthlyCutAmount: float
    currentMonthlySavings: float
    goalTargetAmount: float
    currentBalance: float


class CutResponse(BaseModel):
    cutAmount: float
    newMonthlySavings: float
    monthsToGoalBefore: float
    monthsToGoalAfter: float
    monthsSaved: float
    annualSavingFromCut: float
