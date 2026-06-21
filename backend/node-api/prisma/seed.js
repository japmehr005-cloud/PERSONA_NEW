import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'demo@persona.app'
  const password = 'demo123'
  const name = 'Demo User'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Demo user already exists:', email)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      profile: { create: {} },
      gamification: { create: {} },
    },
  })
  console.log('Demo user created!')
  console.log('  Email:', email)
  console.log('  Password:', password)
  console.log('  → Use these to log in at http://localhost:5173')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
