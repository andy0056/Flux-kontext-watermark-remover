import { type NextRequest, NextResponse } from "next/server"

interface ApiSettings {
  provider: string
  apiKey: string
  endpoint?: string
}

async function validateLightPDF(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.lightpdf.com/api/v1/account/info", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function validateWatermarkRemover(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.watermarkremover.io/v1/account", {
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function validateRapidAPI(apiKey: string): Promise<boolean> {
  try {
    // Test with a common RapidAPI watermark removal endpoint
    const response = await fetch("https://watermark-remover.p.rapidapi.com/status", {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "watermark-remover.p.rapidapi.com",
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function validateCustomEndpoint(endpoint: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/status`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })
    return response.ok
  } catch {
    return false
  }
}

async function validateFalAI(apiKey: string): Promise<boolean> {
  try {
    // Test with a minimal request to check API key validity
    const response = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "test",
        image_url: "https://via.placeholder.com/100x100.png",
      }),
    })

    // If we get 401, the API key is invalid
    if (response.status === 401) {
      return false
    }

    // If we get 400, the API key is likely valid but the request format is wrong (expected for test)
    if (response.status === 400) {
      return true
    }

    // If we get 200, everything is working
    return response.ok
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings: ApiSettings = await request.json()

    if (!settings.apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    let isValid = false

    switch (settings.provider) {
      case "lightpdf":
        isValid = await validateLightPDF(settings.apiKey)
        break
      case "watermarkremover":
        isValid = await validateWatermarkRemover(settings.apiKey)
        break
      case "rapidapi":
        isValid = await validateRapidAPI(settings.apiKey)
        break
      case "fal":
        isValid = await validateFalAI(settings.apiKey)
        break
      case "custom":
        if (!settings.endpoint) {
          return NextResponse.json({ error: "Custom endpoint URL is required" }, { status: 400 })
        }
        isValid = await validateCustomEndpoint(settings.endpoint, settings.apiKey)
        break
      default:
        return NextResponse.json({ error: "Unsupported API provider" }, { status: 400 })
    }

    if (isValid) {
      return NextResponse.json({ valid: true })
    } else {
      return NextResponse.json({ error: "Invalid API key or service unavailable" }, { status: 401 })
    }
  } catch (error) {
    console.error("API validation error:", error)
    return NextResponse.json({ error: "Validation failed" }, { status: 500 })
  }
}
