import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import goalsRoutes from './routes/goals.js'
import transactionRoutes from './routes/transactions.js'
import gamificationRoutes from './routes/gamification.js'
import securityRoutes from './routes/security.js'
import simulateRiskRoutes from './routes/simulateRisk.js'
import chatRoutes from './routes/chat.js'

const app = express()
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL || ''
  ].filter(Boolean),
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/goals', goalsRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/gamification', gamificationRoutes)
app.use('/api/security', securityRoutes)
app.use('/api/simulate', simulateRiskRoutes)
app.use('/api/chat', chatRoutes)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Node API running on ${PORT}`))
