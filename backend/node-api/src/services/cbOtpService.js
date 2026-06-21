import crypto from 'crypto'

/**
 * Context-Bound OTP (CB-OTP) Service
 * ----------------------------------
 * An OTP is NEVER globally valid. It only works when ALL of these hold:
 *   1. It belongs to an existing, active session
 *   2. The session is bound to the exact device that created it
 *   3. The session (and the OTP) is still inside its short time window
 *   4. The OTP has not already been used
 *
 * Even a "correct" OTP is rejected when any context condition fails.
 *
 * Storage is in-memory (a Map) which is perfect for a hackathon demo.
 * Swapping this for Redis later only means changing the four helper
 * functions below (get/set/del/all) — the lifecycle logic stays the same.
 */

const SESSION_TTL_MS = 120_000 // session lives for 2 minutes
const OTP_TTL_MS = 60_000 // OTP lives for 1 minute once generated

// sessionId -> session object
const sessions = new Map()

export const SESSION_STATUS = {
  CREATED: 'CREATED', // secure session created, waiting for device approval
  DEVICE_APPROVED: 'DEVICE_APPROVED', // device confirmed the session is active
  OTP_SENT: 'OTP_SENT', // OTP generated & bound to this session
  COMPLETED: 'COMPLETED', // OTP validated and transaction executed
  REJECTED: 'REJECTED', // a validation attempt failed
  EXPIRED: 'EXPIRED' // session timed out
}

// Machine-readable rejection codes so the UI can clearly explain WHY a failure happened.
export const REJECT_CODE = {
  NO_SESSION: 'NO_SESSION',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  WRONG_DEVICE: 'WRONG_DEVICE',
  NOT_ACTIVATED: 'NOT_ACTIVATED',
  NO_OTP: 'NO_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_REUSED: 'OTP_REUSED',
  OTP_MISMATCH: 'OTP_MISMATCH',
  WRONG_OWNER: 'WRONG_OWNER'
}

function log(...args) {
  console.log('[CB-OTP]', ...args)
}

function now() {
  return Date.now()
}

function isExpired(session) {
  return now() > session.expiresAt
}

function remainingMs(session) {
  return Math.max(0, session.expiresAt - now())
}

/**
 * Step 1 — Create a secure session bound to a device.
 * The pending transaction payload is parked on the session so it can ONLY
 * be executed through the full CB-OTP flow.
 */
export function createSession({ userId, deviceId, amount, recipient, actionType, riskLevel, riskScore }) {
  const id = crypto.randomUUID()
  const session = {
    id,
    userId,
    deviceId, // the device this session is permanently bound to
    amount: Number(amount) || 0,
    recipient: recipient || 'Unknown',
    actionType: actionType || 'TRANSFER',
    riskLevel: riskLevel || 'HIGH',
    riskScore: riskScore ?? null,
    status: SESSION_STATUS.CREATED,
    otp: null,
    otpExpiresAt: null,
    otpUsed: false,
    createdAt: now(),
    expiresAt: now() + SESSION_TTL_MS
  }
  sessions.set(id, session)
  log(`SESSION CREATED id=${id} user=${userId} device=${deviceId} amount=${session.amount} -> ${recipient}`)
  log(`           session valid for ${SESSION_TTL_MS / 1000}s (expires ${new Date(session.expiresAt).toISOString()})`)
  return session
}

/**
 * Step 2 — Simulate device approval ("Approve on your phone").
 * The session can only be activated by the SAME device that created it.
 */
export function activateSession({ sessionId, userId, deviceId }) {
  const session = sessions.get(sessionId)
  if (!session) {
    log(`ACTIVATE REJECTED — no such session (${sessionId})`)
    return { ok: false, code: REJECT_CODE.NO_SESSION, message: 'No active session found for this request.' }
  }
  if (session.userId !== userId) {
    log(`ACTIVATE REJECTED — session owner mismatch (${sessionId})`)
    return { ok: false, code: REJECT_CODE.WRONG_OWNER, message: 'This session does not belong to you.' }
  }
  if (isExpired(session)) {
    session.status = SESSION_STATUS.EXPIRED
    log(`ACTIVATE REJECTED — session expired (${sessionId})`)
    return { ok: false, code: REJECT_CODE.SESSION_EXPIRED, message: 'Session expired before device approval.' }
  }
  if (session.deviceId !== deviceId) {
    log(`ACTIVATE REJECTED — device mismatch. bound=${session.deviceId} got=${deviceId}`)
    return { ok: false, code: REJECT_CODE.WRONG_DEVICE, message: 'Approval came from a device not bound to this session.' }
  }

  session.status = SESSION_STATUS.DEVICE_APPROVED
  log(`SESSION ACTIVATED id=${sessionId} (device ${deviceId} approved)`)
  return { ok: true, session }
}

/**
 * Step 3 — Generate an OTP that is BOUND to this session.
 * Requires the session to be device-approved and still alive.
 */
export function generateOtp({ sessionId, userId, deviceId }) {
  const session = sessions.get(sessionId)
  if (!session) {
    log(`OTP-GEN REJECTED — no such session (${sessionId})`)
    return { ok: false, code: REJECT_CODE.NO_SESSION, message: 'No active session found.' }
  }
  if (session.userId !== userId) {
    return { ok: false, code: REJECT_CODE.WRONG_OWNER, message: 'This session does not belong to you.' }
  }
  if (isExpired(session)) {
    session.status = SESSION_STATUS.EXPIRED
    log(`OTP-GEN REJECTED — session expired (${sessionId})`)
    return { ok: false, code: REJECT_CODE.SESSION_EXPIRED, message: 'Session expired. Start again.' }
  }
  if (session.deviceId !== deviceId) {
    log(`OTP-GEN REJECTED — device mismatch (${sessionId})`)
    return { ok: false, code: REJECT_CODE.WRONG_DEVICE, message: 'OTP cannot be issued to a different device.' }
  }
  if (session.status === SESSION_STATUS.CREATED) {
    log(`OTP-GEN REJECTED — session not device-approved yet (${sessionId})`)
    return { ok: false, code: REJECT_CODE.NOT_ACTIVATED, message: 'Approve the session on your device first.' }
  }

  const otp = String(crypto.randomInt(100000, 1000000)) // 6-digit
  session.otp = otp
  session.otpUsed = false
  session.otpExpiresAt = Math.min(now() + OTP_TTL_MS, session.expiresAt)
  session.status = SESSION_STATUS.OTP_SENT
  log(`OTP GENERATED for session=${sessionId} otp=${otp} (bound to device ${deviceId})`)
  log(`           OTP valid until ${new Date(session.otpExpiresAt).toISOString()}`)
  return { ok: true, otp, session }
}

/**
 * Step 4 — Validate the OTP under STRICT context rules.
 * Order of checks is deliberate so the rejection reason is always the
 * "most fundamental" failure first.
 */
export function validateOtp({ sessionId, userId, deviceId, otp }) {
  // 1. Session must exist (defeats "correct OTP but no session")
  const session = sessions.get(sessionId)
  if (!session) {
    log(`VALIDATE REJECTED — NO_SESSION (otp=${otp})`)
    return { ok: false, code: REJECT_CODE.NO_SESSION, message: 'OTP is not tied to any active session.' }
  }
  // 2. Must belong to the requesting user
  if (session.userId !== userId) {
    log(`VALIDATE REJECTED — WRONG_OWNER (${sessionId})`)
    return { ok: false, code: REJECT_CODE.WRONG_OWNER, message: 'This session does not belong to you.' }
  }
  // 3. Session window still open (defeats "correct OTP but expired session")
  if (isExpired(session)) {
    session.status = SESSION_STATUS.EXPIRED
    log(`VALIDATE REJECTED — SESSION_EXPIRED (${sessionId})`)
    return { ok: false, code: REJECT_CODE.SESSION_EXPIRED, message: 'Session window has expired.' }
  }
  // 4. Device binding (defeats "correct OTP but wrong device")
  if (session.deviceId !== deviceId) {
    session.status = SESSION_STATUS.REJECTED
    log(`VALIDATE REJECTED — WRONG_DEVICE bound=${session.deviceId} got=${deviceId}`)
    return { ok: false, code: REJECT_CODE.WRONG_DEVICE, message: 'OTP used from a device not bound to this session.' }
  }
  // 5. An OTP must have been issued for this session
  if (!session.otp) {
    log(`VALIDATE REJECTED — NO_OTP (${sessionId})`)
    return { ok: false, code: REJECT_CODE.NO_OTP, message: 'No OTP has been generated for this session.' }
  }
  // 6. OTP must not be reused
  if (session.otpUsed) {
    log(`VALIDATE REJECTED — OTP_REUSED (${sessionId})`)
    return { ok: false, code: REJECT_CODE.OTP_REUSED, message: 'This OTP has already been used.' }
  }
  // 7. OTP within its own short window
  if (now() > session.otpExpiresAt) {
    log(`VALIDATE REJECTED — OTP_EXPIRED (${sessionId})`)
    return { ok: false, code: REJECT_CODE.OTP_EXPIRED, message: 'OTP has expired. Request a new one.' }
  }
  // 8. Finally, the value itself (constant-time compare)
  const provided = String(otp || '')
  const expected = String(session.otp)
  const match =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  if (!match) {
    log(`VALIDATE REJECTED — OTP_MISMATCH provided=${provided} (${sessionId})`)
    return { ok: false, code: REJECT_CODE.OTP_MISMATCH, message: 'Incorrect OTP.' }
  }

  // Success — burn the OTP so it can never be replayed.
  session.otpUsed = true
  session.status = SESSION_STATUS.COMPLETED
  log(`VALIDATE OK — session=${sessionId} OTP accepted, transaction authorized.`)
  return { ok: true, session }
}

/** Force a session to expire immediately — used by the "expired session" attack demo. */
export function forceExpire(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return { ok: false, code: REJECT_CODE.NO_SESSION }
  session.expiresAt = now() - 1
  session.otpExpiresAt = now() - 1
  session.status = SESSION_STATUS.EXPIRED
  log(`SESSION FORCE-EXPIRED id=${sessionId} (attack simulation)`)
  return { ok: true, session }
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null
}

/** Public-safe view of a session (never leaks the live OTP value). */
export function publicSession(session) {
  if (!session) return null
  return {
    id: session.id,
    status: session.status,
    deviceId: session.deviceId,
    amount: session.amount,
    recipient: session.recipient,
    actionType: session.actionType,
    riskLevel: session.riskLevel,
    riskScore: session.riskScore,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    remainingMs: remainingMs(session),
    otpIssued: !!session.otp,
    otpUsed: session.otpUsed,
    otpExpiresAt: session.otpExpiresAt
  }
}

// Periodic cleanup so the in-memory map does not grow unbounded during a long demo.
setInterval(() => {
  for (const [id, session] of sessions.entries()) {
    if (now() > session.expiresAt + 60_000) sessions.delete(id)
  }
}, 60_000).unref?.()
