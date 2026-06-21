from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class ProfileInput(BaseModel):
    salary: float
    otherIncome: float
    rent: float
    food: float
    transport: float
    subscriptions: float
    entertainment: float
    miscExpenses: float
    balance: float
    goals: list


class Insight(BaseModel):
    type: str
    message: str
    metric: str


class InsightsResponse(BaseModel):
    insights: List[Insight]
    savingsRate: float
    topExpenseCategory: str
    monthsToGoal: float


@router.post("/", response_model=InsightsResponse)
def get_insights(p: ProfileInput):
    income = p.salary + p.otherIncome
    expenses = (
        p.rent
        + p.food
        + p.transport
        + p.subscriptions
        + p.entertainment
        + p.miscExpenses
    )
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else 0

    expense_map = {
        "Rent/EMI": p.rent,
        "Food": p.food,
        "Transport": p.transport,
        "Subscriptions": p.subscriptions,
        "Entertainment": p.entertainment,
        "Misc": p.miscExpenses,
    }
    top_expense = max(expense_map, key=expense_map.get)

    months_to_goal = 9999
    if p.goals and savings > 0:
        g = p.goals[0]
        remaining = max(0, g.get("targetAmount", 0) - g.get("savedAmount", 0))
        months_to_goal = round(remaining / savings, 1)

    insights = []

    if savings_rate >= 50:
        insights.append(
            Insight(
                type="positive",
                message="Your savings rate is in the top 10% for your age group. Keep it up!",
                metric=f"{savings_rate:.1f}%",
            )
        )
    elif savings_rate >= 30:
        insights.append(
            Insight(
                type="positive",
                message="Good savings rate! Pushing to 50% would cut your goal timeline significantly.",
                metric=f"{savings_rate:.1f}%",
            )
        )
    else:
        insights.append(
            Insight(
                type="warning",
                message="Your savings rate is below 30%. Consider reducing your top expense category.",
                metric=f"{savings_rate:.1f}%",
            )
        )

    if p.entertainment > income * 0.1:
        insights.append(
            Insight(
                type="warning",
                message=f"Entertainment is over 10% of your income. Cutting it in half saves ₹{p.entertainment/2:,.0f}/month.",
                metric=f"₹{p.entertainment:,.0f}/mo",
            )
        )

    if p.subscriptions > 3000:
        insights.append(
            Insight(
                type="tip",
                message="You're spending heavily on subscriptions. Audit and cancel unused ones for quick wins.",
                metric=f"₹{p.subscriptions:,.0f}/mo",
            )
        )

    insights.append(
        Insight(
            type="tip",
            message=f"Your biggest expense is {top_expense}. This is where the most optimization potential lies.",
            metric=top_expense,
        )
    )

    return InsightsResponse(
        insights=insights,
        savingsRate=round(savings_rate, 1),
        topExpenseCategory=top_expense,
        monthsToGoal=months_to_goal,
    )
