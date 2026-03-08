# PERSONA ? SecureWealth Twin

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker Desktop (for local Postgres + Redis)
- OR use Neon + Upstash (cloud, no Docker needed)

### Setup
1. cd backend/node-api && npm install && npx prisma migrate dev
2. cd backend/python-api && py -3.11 -m pip install -r requirements.txt
3. cd frontend && npm install

### Start
Terminal 1: cd backend/node-api && npm run dev
Terminal 2: cd backend/python-api && py -3.11 -m uvicorn app.main:app --reload --port 8000
Terminal 3: cd frontend && npm run dev

## Environment Variables
See .env.example in each service folder.
