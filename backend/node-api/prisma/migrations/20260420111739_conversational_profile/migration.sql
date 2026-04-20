-- CreateTable
CREATE TABLE "ConversationalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avgMessageLength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgWordsPerMessage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "slangRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "formalityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emojiFrequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urgencyWordCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTimeMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMessagesSampled" INTEGER NOT NULL DEFAULT 0,
    "panicPhrase" TEXT,
    "safePhrase" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationalProfile_userId_key" ON "ConversationalProfile"("userId");

-- AddForeignKey
ALTER TABLE "ConversationalProfile" ADD CONSTRAINT "ConversationalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
