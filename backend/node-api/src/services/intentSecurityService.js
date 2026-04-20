import axios from 'axios'

function toPythonProfile(profile) {
  if (!profile) return {}
  return {
    avg_message_length: profile.avgMessageLength ?? 0,
    avg_words_per_message: profile.avgWordsPerMessage ?? 0,
    slang_ratio: profile.slangRatio ?? 0,
    formality_score: profile.formalityScore ?? 0,
    emoji_frequency: profile.emojiFrequency ?? 0,
    urgency_word_count: profile.urgencyWordCount ?? 0,
    avg_response_time_ms: profile.avgResponseTimeMs ?? 0,
    total_messages_sampled: profile.totalMessagesSampled ?? 0,
    panicPhrase: profile.panicPhrase ?? null,
    safePhrase: profile.safePhrase ?? null
  }
}

export async function getOrCreateProfile(userId, prisma) {
  let profile = await prisma.conversationalProfile.findUnique({ where: { userId } })
  if (!profile) {
    profile = await prisma.conversationalProfile.create({
      data: {
        userId,
        avgMessageLength: 0,
        avgWordsPerMessage: 0,
        slangRatio: 0,
        formalityScore: 0,
        emojiFrequency: 0,
        urgencyWordCount: 0,
        avgResponseTimeMs: 0,
        totalMessagesSampled: 0
      }
    })
  }
  return profile
}

export async function updateProfile(userId, newMessage, prisma) {
  const profile = await getOrCreateProfile(userId, prisma)
  const { data } = await axios.post(`${process.env.PYTHON_API_URL}/intent/update-baseline`, {
    userId,
    newMessage,
    currentProfile: {
      ...toPythonProfile(profile),
      panicPhrase: profile.panicPhrase || null,
      safePhrase: profile.safePhrase || null
    }
  })

  const updated = await prisma.conversationalProfile.update({
    where: { userId },
    data: {
      avgMessageLength: data.avg_message_length ?? profile.avgMessageLength,
      avgWordsPerMessage: data.avg_words_per_message ?? profile.avgWordsPerMessage,
      slangRatio: data.slang_ratio ?? profile.slangRatio,
      formalityScore: data.formality_score ?? profile.formalityScore,
      emojiFrequency: data.emoji_frequency ?? profile.emojiFrequency,
      urgencyWordCount: data.urgency_word_count ?? profile.urgencyWordCount,
      avgResponseTimeMs: data.avg_response_time_ms ?? profile.avgResponseTimeMs,
      totalMessagesSampled: data.total_messages_sampled ?? profile.totalMessagesSampled,
      panicPhrase: profile.panicPhrase,
      safePhrase: profile.safePhrase
    }
  })

  return updated
}

export async function analyseIntent(userId, message, actionType, actionDetails, prisma) {
  const profile = await getOrCreateProfile(userId, prisma)
  const { data } = await axios.post(`${process.env.PYTHON_API_URL}/intent/analyse`, {
    userId,
    message,
    actionType,
    actionDetails: actionDetails || {},
    conversationalProfile: toPythonProfile(profile),
    panicPhrase: profile.panicPhrase || null,
    safePhrase: profile.safePhrase || null
  })
  return data
}

export async function logConversationalRiskEvent(userId, analysis, actionType, prisma) {
  await prisma.riskEvent.create({
    data: {
      userId,
      actionType: `${actionType}_INTENT_CHECK`,
      amount: 0,
      riskScore: Number(analysis?.deviation_score || 0),
      riskLevel: analysis?.risk_level || 'LOW',
      decision: analysis?.recommended_action || 'PROCEED_WITH_CONFIRMATION',
      triggeredSignals: analysis?.triggered_signals || []
    }
  })
}
