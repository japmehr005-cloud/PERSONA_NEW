from groq import Groq
from dotenv import load_dotenv
import os
import random
from math import ceil

load_dotenv()

def detect_intent(message: str) -> str:
    msg = message.lower()
    if any(w in msg for w in ["buy", "purchase", "afford", "concert", "ticket", "shoes", "jeans", "phone", "laptop", "trip", "spend", "splurge"]):
        return "splurge_advice"
    if any(w in msg for w in ["saving", "save", "savings rate", "enough", "how much saving"]):
        return "savings_check"
    if any(w in msg for w in ["goal", "progress", "how long", "target", "when will i"]):
        return "goal_progress"
    if any(w in msg for w in ["invest", "sip", "mutual fund", "stocks", "fd", "gold", "returns"]):
        return "investment_advice"
    if any(w in msg for w in ["streak", "xp", "level", "achievement", "points", "rank"]):
        return "gamification_status"
    if any(w in msg for w in ["security", "safe", "fraud", "protect", "hack", "risk"]):
        return "security_advice"
    if any(w in msg for w in ["salary", "income", "earn", "pay", "ctc"]):
        return "income_context"
    if any(w in msg for w in ["expense", "spending", "cut", "reduce", "budget"]):
        return "expense_advice"
    if any(w in msg for w in ["hello", "hi", "hey", "start", "help"]) or message.strip() == "":
        return "greeting"
    return "general_health"

def get_suggested_actions(intent: str) -> list:
    actions = {
        "splurge_advice":      [{"label": "Run full impact sim", "action": "navigate:/simulate"}, {"label": "Check my goal", "action": "intent:goal_progress"}],
        "savings_check":       [{"label": "See expense breakdown", "action": "intent:expense_advice"}, {"label": "Simulate cutting expenses", "action": "navigate:/simulate"}],
        "goal_progress":       [{"label": "Update goal progress", "action": "navigate:/account"}, {"label": "Simulate investing more", "action": "navigate:/simulate"}],
        "investment_advice":   [{"label": "Open SIP calculator", "action": "navigate:/simulate"}, {"label": "See investment options", "action": "navigate:/simulate"}],
        "gamification_status": [{"label": "View achievements", "action": "navigate:/achievements"}, {"label": "Run a simulation", "action": "navigate:/simulate"}],
        "security_advice":     [{"label": "Go to Security tab", "action": "navigate:/security"}],
        "expense_advice":      [{"label": "Simulate cutting this", "action": "navigate:/simulate"}],
        "income_context":      [{"label": "Check savings rate", "action": "intent:savings_check"}],
        "greeting":            [{"label": "How are my savings?", "action": "intent:savings_check"}, {"label": "Goal progress?", "action": "intent:goal_progress"}, {"label": "Investment advice", "action": "intent:investment_advice"}],
        "general_health":      [{"label": "Check my goals", "action": "intent:goal_progress"}, {"label": "How are my savings?", "action": "intent:savings_check"}],
    }
    return actions.get(intent, actions["general_health"])

def build_system_prompt(uc: dict) -> str:
    monthly_savings = (uc['salary'] + uc['otherIncome']) - (
        uc['rent'] + uc['food'] + uc['transport'] +
        uc['subscriptions'] + uc['entertainment'] + uc['miscExpenses']
    )
    total_income = uc['salary'] + uc['otherIncome']
    total_expenses = total_income - monthly_savings

    return f"""
You are PERSONA's AI financial advisor for {uc['name']}.

USER FINANCIAL DATA (always use these exact numbers in your response):
- Monthly Income: Rs{total_income:,.0f} (Salary Rs{uc['salary']:,.0f} + Other Rs{uc['otherIncome']:,.0f})
- Monthly Expenses: Rs{total_expenses:,.0f}
- Monthly Savings: Rs{monthly_savings:,.0f}
- Savings Rate: {uc['savingsRate']:.1f}%
- Balance: Rs{uc['balance']:,.0f}
- Investments: Rs{uc['investments']:,.0f}
- Primary Goal: {uc['primaryGoalName']} at {uc['primaryGoalPct']:.0f}% complete
- Months to Goal: {uc['monthsToGoal']:.1f}
- XP: {uc['xp']} | Level: {uc['level']} | Streak: {uc['streakDays']} days
- Security Score: {uc['securityScore']}/100
- KYC: {'Verified' if uc['kycVerified'] else 'Pending'}

RULES:
- Always reference the user's real numbers, never make up figures
- Keep responses under 100 words
- Be specific and actionable
- Never recommend specific stocks by name
- Add "For demo purposes only" if giving investment advice
- Be helpful, clear and friendly
- Use simple language
- Maximum one emoji per response
- No slang
"""

def generate_response(message: str, uc: dict, history: list) -> str:
    system_prompt = build_system_prompt(uc)

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            max_tokens=150,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        monthly_savings = (uc['salary'] + uc['otherIncome']) - (
            uc['rent'] + uc['food'] + uc['transport'] +
            uc['subscriptions'] + uc['entertainment'] + uc['miscExpenses']
        )
        return (
            f"Your savings rate is {uc['savingsRate']:.1f}% "
            f"with Rs{monthly_savings:,.0f}/month saved. "
            f"Goal '{uc['primaryGoalName']}' is {uc['primaryGoalPct']:.0f}% complete "
            f"with {uc['monthsToGoal']:.1f} months to go. "
            f"(AI temporarily offline)"
        )

def check_ai_status() -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        return {"running": True, "modelLoaded": True, "provider": "Groq - Llama 3.1"}
    return {"running": False, "modelLoaded": False, "provider": "None"}
