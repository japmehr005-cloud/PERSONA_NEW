from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.services.chat_engine import generate_response, detect_intent, get_suggested_actions, check_ai_status

router = APIRouter()

class HistoryMessage(BaseModel):
    role: str
    content: str

class UserContext(BaseModel):
    name: str
    salary: float
    otherIncome: float
    rent: float
    food: float
    transport: float
    subscriptions: float
    entertainment: float
    miscExpenses: float
    balance: float
    investments: float
    savingsRate: float
    streakDays: int
    xp: int
    level: int
    primaryGoalName: str
    primaryGoalPct: float
    monthsToGoal: float
    kycVerified: bool
    securityScore: int

class ChatRequest(BaseModel):
    message: str
    conversationHistory: List[HistoryMessage] = []
    userContext: UserContext

class ChatResponse(BaseModel):
    reply: str
    intent: str
    reasoning: str
    suggestedActions: list

@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest):
    intent = detect_intent(req.message)
    reply = generate_response(
        req.message,
        req.userContext.dict(),
        [h.dict() for h in req.conversationHistory]
    )
    actions = get_suggested_actions(intent)
    reasoning = (
        f"Intent detected: {intent}. "
        f"Response generated using Llama 3.1 (Groq) with real user data injected. "
        f"Savings rate {req.userContext.savingsRate:.1f}%, "
        f"goal {req.userContext.primaryGoalPct:.0f}% complete."
    )
    return ChatResponse(reply=reply, intent=intent, reasoning=reasoning, suggestedActions=actions)

@router.get("/health")
def chat_health():
    return check_ai_status()
