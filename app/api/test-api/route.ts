import { type NextRequest, NextResponse } from "next/server"

interface TestApiRequest {
  provider: string
  apiKey: string
  endpoint?: string
}

async function testFalAI(apiKey: string): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Test with a simple status check first
    const response = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Minimal test payload to check API key validity
        prompt: "test",
        image_url: "https://via.placeholder.com/100x100.png",
        // Add minimal required parameters
      }),
    })

    const result = await response.json()

    if (response.status === 401) {
      return {
        success: false,
        message: "Invalid API key - Authentication failed",
      }
    }

    if (response.status === 400 && result.detail) {
      // API key is valid but request format might be wrong (expected for test)
      return {
        success: true,
        message: "API key is valid - Ready for watermark removal",
        details: "Authentication successful",
      }
    }

    if (response.ok) {
      return {
        success: true,
        message: "API key is valid and working",
        details: result,
      }
    }

    return {
      success: false,
      message: `API test failed: ${response.status} ${response.statusText}`,
      details: result,
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

async function testLightPDF(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://api.lightpdf.com/api/v1/account/info", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        message: `API key valid - Account: ${data.email || "Unknown"}`,
      }
    } else {
      return {
        success: false,
        message: `Invalid API key: ${response.status} ${response.statusText}`,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, endpoint }: TestApiRequest = await request.json()

    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json(
        { success: false, message: "API key appears to be too short or invalid" },
        { status: 400 },
      )
    }

    // Mask API key in logs for security
    const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    console.log(`Testing API key: ${maskedKey} for provider: ${provider}`)

    let result: { success: boolean; message: string; details?: any }

    switch (provider) {
      case "fal":
        result = await testFalAI(apiKey)
        break
      case "lightpdf":
        result = await testLightPDF(apiKey)
        break
      default:
        return NextResponse.json({ success: false, message: "Unsupported API provider for testing" }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("API test error:", error)
    return NextResponse.json({ success: false, message: "Test failed due to server error" }, { status: 500 })
  }
}
