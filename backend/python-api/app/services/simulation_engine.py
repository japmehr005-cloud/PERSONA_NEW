import math
from app.models.simulate_models import (
    SplurgeRequest,
    SplurgeResponse,
    InvestRequest,
    InvestResponse,
    ChartPoint,
    CutRequest,
    CutResponse,
)


def simulate_splurge(req: SplurgeRequest) -> SplurgeResponse:
    savings = req.monthlyIncome - req.monthlyExpenses
    remaining_before = max(0, req.goalTargetAmount - req.currentBalance)
    remaining_after = remaining_before + req.purchaseAmount

    months_before = math.ceil(remaining_before / savings) if savings > 0 else 9999
    months_after = math.ceil(remaining_after / savings) if savings > 0 else 9999
    pct = (req.purchaseAmount / savings * 100) if savings > 0 else 9999
    delay_days = math.ceil((req.purchaseAmount / savings) * 30) if savings > 0 else 9999

    if pct > 50:
        level, msg = (
            "BAD",
            f"🚨 That's {pct:.1f}% of your monthly savings. Your goal gets pushed back {delay_days} days.",
        )
    elif pct > 20:
        level, msg = (
            "WARN",
            f"⚠️ That's {pct:.1f}% of your monthly savings. A noticeable setback — consider waiting.",
        )
    else:
        level, msg = (
            "OK",
            f"✅ Only {pct:.1f}% of your savings. You can afford this — go for it!",
        )

    return SplurgeResponse(
        purchaseAmount=req.purchaseAmount,
        monthlySavings=savings,
        pctOfSavings=round(pct, 1),
        goalDelayDays=delay_days,
        monthsToGoalBefore=months_before,
        monthsToGoalAfter=months_after,
        verdictLevel=level,
        verdictMessage=msg,
    )


def simulate_invest(req: InvestRequest) -> InvestResponse:
    r = (req.annualReturnPct / 100) / 12
    chart = []
    for y in range(1, req.years + 1):
        m = y * 12
        fv = (
            req.monthlyAmount * ((math.pow(1 + r, m) - 1) / r)
            if r > 0
            else req.monthlyAmount * m
        )
        invested = req.monthlyAmount * m
        chart.append(ChartPoint(year=y, value=round(fv, 2), invested=round(invested, 2)))

    final = chart[-1]
    return InvestResponse(
        chartData=chart,
        totalInvested=final.invested,
        futureValue=final.value,
        totalGain=round(final.value - final.invested, 2),
        returnMultiple=round(final.value / final.invested, 2) if final.invested > 0 else 0,
    )


def simulate_cut(req: CutRequest) -> CutResponse:
    new_savings = req.currentMonthlySavings + req.monthlyCutAmount
    remaining = max(0, req.goalTargetAmount - req.currentBalance)

    months_before = (
        math.ceil(remaining / req.currentMonthlySavings)
        if req.currentMonthlySavings > 0
        else 9999
    )
    months_after = math.ceil(remaining / new_savings) if new_savings > 0 else 9999

    return CutResponse(
        cutAmount=req.monthlyCutAmount,
        newMonthlySavings=new_savings,
        monthsToGoalBefore=months_before,
        monthsToGoalAfter=months_after,
        monthsSaved=max(0, months_before - months_after),
        annualSavingFromCut=req.monthlyCutAmount * 12,
    )
