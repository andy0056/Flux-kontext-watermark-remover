import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "No API key configured" }, { status: 400 })
    }

    console.log(`Testing Fal.ai API key: ${apiKey.substring(0, 8)}...`)

    // Test with a simple request to check API key validity
    const testResponse = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "test image",
        image_url: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400&h=300&fit=crop",
        num_inference_steps: 10, // Minimal steps for testing
        guidance_scale: 3.5,
        num_images: 1,
      }),
    })

    console.log(`Test response status: ${testResponse.status}`)
    console.log(`Test response headers:`, Object.fromEntries(testResponse.headers.entries()))

    const responseText = await testResponse.text()
    console.log(`Test response text (first 500 chars): ${responseText.substring(0, 500)}`)

    if (testResponse.status === 401) {
      return NextResponse.json({
        success: false,
        error: "Invalid API key - Authentication failed",
        details: responseText.substring(0, 200),
      })
    }

    if (testResponse.status === 403) {
      return NextResponse.json({
        success: false,
        error: "Access forbidden - Check API key permissions",
        details: responseText.substring(0, 200),
      })
    }

    if (!testResponse.ok) {
      let errorData: any = {}
      try {
        errorData = JSON.parse(responseText)
      } catch {
        // Not JSON, probably HTML error page
        return NextResponse.json({
          success: false,
          error: `API test failed: ${testResponse.status} ${testResponse.statusText}`,
          details: responseText.substring(0, 200),
        })
      }

      return NextResponse.json({
        success: false,
        error: `API test failed: ${testResponse.status}`,
        details: errorData,
      })
    }

    // Try to parse successful response
    let result: any
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: "Invalid JSON response from Fal.ai",
        details: responseText.substring(0, 200),
      })
    }

    return NextResponse.json({
      success: true,
      message: "API key is valid and working",
      details: {
        status: testResponse.status,
        hasImages: !!(result.images && result.images.length > 0),
        requestId: result.request_id,
      },
    })
  } catch (error) {
    console.error("API test error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
