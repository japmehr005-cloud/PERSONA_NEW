import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL

export const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    })
  : null
