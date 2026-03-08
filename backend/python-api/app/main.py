from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import risk, simulate, insights, chat
import os

load_dotenv()

app = FastAPI(title="PERSONA Intelligence API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(risk.router,     prefix="/risk",     tags=["Risk Engine"])
app.include_router(simulate.router, prefix="/simulate", tags=["Simulations"])
app.include_router(insights.router, prefix="/insights", tags=["Insights"])
app.include_router(chat.router,     prefix="/chat",     tags=["Chat"])

@app.get("/")
def root():
    return {"status": "PERSONA Python API running"}
