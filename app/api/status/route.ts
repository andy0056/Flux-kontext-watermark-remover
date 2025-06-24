import { NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY
  const demoMode = process.env.DEMO_MODE === "true"
  const falEmail = process.env.FAL_EMAIL
  const falPassword = process.env.FAL_PASSWORD

  // Test if the API key looks valid (basic format check)
  const isValidFormat = apiKey && apiKey.length > 10

  return NextResponse.json({
    demoMode: demoMode,
    apiConfigured: !!apiKey,
    apiKeyFormat: isValidFormat ? "valid" : "invalid",
    provider: demoMode ? "demo" : apiKey ? "fal" : "demo",
    message: demoMode
      ? "Running in demo mode (DEMO_MODE=true)"
      : apiKey
        ? `Fal.ai API key configured ${isValidFormat ? "(format looks correct)" : "(please check format)"}`
        : "No API key found - running in demo mode",
    keyLength: apiKey ? apiKey.length : 0,
    keyPrefix: apiKey ? `${apiKey.substring(0, 4)}...` : null,
    emailConfigured: !!falEmail,
    passwordConfigured: !!falPassword,
  })
}
