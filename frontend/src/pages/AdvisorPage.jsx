import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import nodeClient from '../api/nodeClient'
import { useStore } from '../store/useStore'

const ADVISOR_META = {
  emoji: '🧠',
  name: 'Advisor',
  subtitle: 'Helpful, clear, and friendly guidance'
}

const QUICK_CHIPS = [
  'Should I buy this? 🛍️',
  'How are my savings? 💰',
  'Goal progress? 🎯',
  'Best investment? 📈',
  'My security 🔐',
  'Level me up ⭐'
]

const INTENT_TO_PROMPT = {
  savings_check: 'How are my savings?',
  goal_progress: 'Goal progress?',
  investment_advice: 'Best investment?',
  expense_advice: 'How can I reduce expenses?',
  gamification_status: 'How do I level up faster?',
  security_advice: 'How secure is my account?'
}

export default function AdvisorPage() {
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const profile = useStore((s) => s.profile)
  const gamification = useStore((s) => s.gamification)
  const setProfile = useStore((s) => s.setProfile)
  const setGamification = useStore((s) => s.setGamification)
  const showXPToast = useStore((s) => s.showXPToast)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState({ running: false, modelLoaded: false })
  const [expandedReasoning, setExpandedReasoning] = useState({})
  const [summarySnapshot, setSummarySnapshot] = useState(null)
  const [messageCount, setMessageCount] = useState(0)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const financialContext = useMemo(() => {
    const salary = Number(profile?.salary || summarySnapshot?.totalIncome || 0)
    const otherIncome = Number(profile?.otherIncome || 0)
    const totalIncome = profile ? Number(profile.salary || 0) + Number(profile.otherIncome || 0) : Number(summarySnapshot?.totalIncome || 0)
    const totalExpenses = profile
      ? Number(profile.rent || 0) + Number(profile.food || 0) + Number(profile.transport || 0) + Number(profile.subscriptions || 0) + Number(profile.entertainment || 0) + Number(profile.miscExpenses || 0)
      : Number(summarySnapshot?.totalExpenses || 0)
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : Number(summarySnapshot?.savingsRate || 0)
    const balance = Number(profile?.balance ?? summarySnapshot?.balance ?? 0)
    const goals = Array.isArray(summarySnapshot?.goals) ? summarySnapshot.goals : []
    const primaryGoal = summarySnapshot?.primaryGoal || goals[0] || null
    const primaryGoalPct = primaryGoal && primaryGoal.targetAmount > 0
      ? ((primaryGoal.savedAmount || 0) / primaryGoal.targetAmount) * 100
      : 0

    return {
      name: user?.name || 'there',
      salary,
      otherIncome,
      rent: Number(profile?.rent || 0),
      food: Number(profile?.food || 0),
      transport: Number(profile?.transport || 0),
      subscriptions: Number(profile?.subscriptions || 0),
      entertainment: Number(profile?.entertainment || 0),
      miscExpenses: Number(profile?.miscExpenses || 0),
      balance,
      investments: Number(profile?.investments || 0),
      savingsRate: Number(savingsRate || 0),
      streakDays: Number(gamification?.streakDays || 0),
      xp: Number(gamification?.xp || 0),
      level: Number(gamification?.level || 1),
      primaryGoalName: primaryGoal?.name || 'No goal set',
      primaryGoalPct: Number(primaryGoalPct || 0),
      monthsToGoal: Number(summarySnapshot?.monthsToGoal || 0),
      kycVerified: !!profile?.kycVerified,
      securityScore: Number(summarySnapshot?.securityScore || 0)
    }
  }, [profile, gamification, summarySnapshot, user])

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  function buildGreeting(name, savingsRate, primaryGoalName, primaryGoalPct) {
    const roundedSavings = Number(savingsRate || 0).toFixed(1)
    const roundedGoalPct = Number(primaryGoalPct || 0).toFixed(0)
    return `Hi ${name}! Your savings rate is ${roundedSavings}% and your '${primaryGoalName}' goal is ${roundedGoalPct}% complete. What would you like to work on today?`
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text }
    const historySnapshot = [...messages]
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const { data } = await nodeClient.post('/chat', {
        message: text,
        conversationHistory: historySnapshot
      })
      await new Promise((r) => setTimeout(r, 600))
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.reply,
        reasoning: data.reasoning,
        suggestedActions: data.suggestedActions,
        intent: data.intent,
        financialActionDetected: data.financialActionDetected,
        detectedAmount: data.detectedAmount,
        detectedAction: data.detectedAction,
        intentCheckSuggested: data.intentCheckSuggested,
        intentMessage: data.intentMessage,
        dismissedIntentCard: false
      }])
      showXPToast('Chat XP', 'Message sent', '+3 XP')
      const nextCount = messageCount + 1
      setMessageCount(nextCount)
      if (nextCount % 5 === 0) {
        // Kept for future threshold tuning; baseline update runs on every message.
      }
      nodeClient.post('/intent/update-baseline', { message: text }).catch(() => null)
      const gRes = await nodeClient.get('/gamification').catch(() => null)
      if (gRes?.data) setGamification(gRes.data)
    } catch (err) {
      console.error(err)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        reasoning: '',
        suggestedActions: []
      }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  const handleSuggestedAction = (actionObj) => {
    if (!actionObj?.action) return
    if (actionObj.action.startsWith('navigate:')) {
      navigate(actionObj.action.replace('navigate:', ''))
      return
    }
    if (actionObj.action.startsWith('intent:')) {
      const intent = actionObj.action.replace('intent:', '')
      const prompt = INTENT_TO_PROMPT[intent] || actionObj.label
      sendMessage(prompt)
    }
  }

  const dismissIntentCard = (idx) => {
    setMessages((prev) => prev.map((msg, i) => (
      i === idx ? { ...msg, dismissedIntentCard: true } : msg
    )))
  }

  const triggerIntentCheckFromChat = (msg) => {
    const payload = {
      requiresIntentCheck: true,
      chatbot_message: msg.intentMessage || 'Before proceeding, please confirm this action.',
      recommended_action: 'PROCEED_WITH_CONFIRMATION',
      actionType: 'CHAT_FINANCIAL_ACTION',
      actionDetails: {
        amount: msg.detectedAmount || 0,
        action: msg.detectedAction || 'financial action'
      },
      riskScore: 25,
      riskLevel: 'MEDIUM',
      signals: [{ name: 'Financial action in chat', explanation: 'User mentioned a potentially executable money action.' }],
      pendingRequest: {
        url: '/intent/check',
        method: 'post',
        data: JSON.stringify({
          message: `Please proceed with ${msg.detectedAction || 'this action'} of ₹${msg.detectedAmount || 0}`,
          actionType: 'CHAT_FINANCIAL_ACTION',
          actionDetails: {
            amount: msg.detectedAmount || 0,
            action: msg.detectedAction || 'financial action'
          }
        }),
        headers: {}
      }
    }
    window.dispatchEvent(new CustomEvent('intentCheckRequired', { detail: payload }))
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [healthRes, summaryRes, gamiRes, profileRes, secRes] = await Promise.all([
          nodeClient.get('/chat/health').catch(() => ({ data: { running: false, modelLoaded: false } })),
          nodeClient.get('/profile/summary').catch(() => ({ data: null })),
          nodeClient.get('/gamification').catch(() => ({ data: null })),
          profile ? Promise.resolve({ data: profile }) : nodeClient.get('/profile').catch(() => ({ data: null })),
          nodeClient.get('/security/score').catch(() => ({ data: { score: 0 } }))
        ])

        setAiStatus(healthRes.data || { running: false, modelLoaded: false })

        const mergedSummary = {
          ...(summaryRes.data || {}),
          securityScore: secRes?.data?.score ?? 0
        }
        setSummarySnapshot(mergedSummary)
        if (profileRes?.data) setProfile(profileRes.data)
        if (gamiRes?.data) setGamification(gamiRes.data)
      } catch (err) {
        console.error(err)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const greeting = buildGreeting(
      financialContext.name,
      financialContext.savingsRate,
      financialContext.primaryGoalName,
      financialContext.primaryGoalPct
    )
    setMessages([{ role: 'assistant', content: greeting, reasoning: '', suggestedActions: [] }])
  }, [financialContext.name, financialContext.savingsRate, financialContext.primaryGoalName, financialContext.primaryGoalPct])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const primaryGoalName = financialContext.primaryGoalName
  const primaryGoalPct = Number(financialContext.primaryGoalPct || 0).toFixed(0)
  const monthsToGoal = Number(financialContext.monthsToGoal || 0).toFixed(1)
  const savingsRate = Number(financialContext.savingsRate || 0).toFixed(1)
  const streakDays = Number(financialContext.streakDays || 0)

  return (
    <div className="h-[calc(100vh-64px)] bg-[#0a0a0f] text-[var(--text)] flex overflow-hidden">
      <aside className="w-[300px] shrink-0 border-r border-[var(--border)] bg-[#13131a] p-4 overflow-y-auto">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 mb-4">
          <h2 className="font-semibold text-[var(--text)] mb-2">Advisor</h2>
          <p className="text-sm text-[var(--text)]">{ADVISOR_META.emoji} {ADVISOR_META.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{ADVISOR_META.subtitle}</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <h2 className="font-semibold text-[var(--text)] mb-3">💡 Quick Insights</h2>
          <div className="space-y-2 text-xs text-[var(--text-muted)]">
            <p>
              {Number(savingsRate) >= 50
                ? `Saving ${savingsRate}% — top 10% for your age 🎉`
                : 'Boost savings to 50% to unlock Saver Pro badge'}
            </p>
            <p>
              '{primaryGoalName}' is {primaryGoalPct}% done — {monthsToGoal} months to go
            </p>
            <p>
              {streakDays >= 7
                ? `🔥 ${streakDays} day streak! Keep logging in daily`
                : 'Log in daily to build your streak and earn bonus XP'}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              aiStatus.running && aiStatus.modelLoaded
                ? 'bg-[var(--success)]/20 text-[var(--success)]'
                : 'bg-[var(--danger)]/20 text-[var(--danger)]'
            }`}
          >
            {aiStatus.running && aiStatus.modelLoaded
              ? '🟢 AI Online — Llama 3.1 (Groq)'
              : '🔴 AI Offline — Fallback mode'}
          </span>
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-[var(--border)] px-4 flex items-center justify-between bg-[#13131a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center text-white text-lg">
              {ADVISOR_META.emoji}
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">{ADVISOR_META.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{ADVISOR_META.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            return (
              <div key={`${msg.role}-${idx}`} className={`max-w-[78%] ${isUser ? 'self-end' : 'self-start'}`}>
                <div
                  className={`px-4 py-3 text-sm ${
                    isUser
                      ? 'bg-gradient-to-br from-purple-600 to-violet-700 text-white rounded-2xl rounded-br-sm'
                      : 'bg-[#13131a] border border-[var(--border)] text-[var(--text)] rounded-2xl rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                {!isUser && (
                  <div className="mt-2 space-y-2">
                    {msg.intentCheckSuggested && !msg.dismissedIntentCard && (
                      <div className="border border-yellow-500 bg-yellow-500/10 rounded-xl p-3 mt-2">
                        <p className="text-sm font-semibold text-yellow-300">⚡ Financial action detected</p>
                        <p className="text-xs text-yellow-100 mt-1">
                          You mentioned {msg.detectedAction || 'an action'} of ₹{Number(msg.detectedAmount || 0).toLocaleString('en-IN')}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => triggerIntentCheckFromChat(msg)}
                            className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold"
                          >
                            Execute this safely
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissIntentCard(idx)}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-xs"
                          >
                            Just talking
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.reasoning && (
                      <div className="text-xs">
                        <button
                          type="button"
                          className="text-[var(--accent)] hover:underline"
                          onClick={() => setExpandedReasoning((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        >
                          💡 Why this advice?
                        </button>
                        {expandedReasoning[idx] && (
                          <p className="mt-1 text-[var(--text-muted)]">{msg.reasoning}</p>
                        )}
                      </div>
                    )}
                    {Array.isArray(msg.suggestedActions) && msg.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.suggestedActions.map((act, actionIdx) => (
                          <button
                            key={`${idx}-action-${actionIdx}`}
                            type="button"
                            onClick={() => handleSuggestedAction(act)}
                            className="px-2 py-1 rounded-full text-xs bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {loading && (
            <div className="self-start px-4 py-3 rounded-2xl rounded-bl-sm bg-[#13131a] border border-[var(--border)]">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce [animation-delay:120ms]" />
                <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce [animation-delay:240ms]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-[var(--border)] px-4 py-3 bg-[#13131a]">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(input)
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your money..."
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-50"
            >
              →
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
