interface ApiSettings {
  provider: string
  apiKey: string
  endpoint?: string
}

interface WatermarkRemovalResult {
  success: boolean
  processedImageUrl?: string
  error?: string
  jobId?: string
}

export class WatermarkRemovalAPI {
  private settings: ApiSettings

  constructor(settings: ApiSettings) {
    this.settings = settings
  }

  async removeWatermark(imageUrl: string, filename: string): Promise<WatermarkRemovalResult> {
    switch (this.settings.provider) {
      case "fal":
        return this.removeWithFluxKontext(imageUrl, filename)
      case "lightpdf":
        return this.removeLightPDF(imageUrl, filename)
      case "watermarkremover":
        return this.removeWatermarkRemover(imageUrl, filename)
      case "rapidapi":
        return this.removeRapidAPI(imageUrl, filename)
      case "custom":
        return this.removeCustom(imageUrl, filename)
      default:
        throw new Error("Unsupported API provider")
    }
  }

  private async removeWithFluxKontext(imageUrl: string, filename: string): Promise<WatermarkRemovalResult> {
    try {
      console.log(`Processing ${filename} with Flux Kontext model`)
      console.log(`Image URL: ${imageUrl}`)
      console.log(`API Key prefix: ${this.settings.apiKey.substring(0, 8)}...`)

      // Validate that the URL is publicly accessible
      if (imageUrl.startsWith("/") || imageUrl.includes("placeholder.svg")) {
        throw new Error("Image URL must be publicly accessible. Local URLs are not supported by Fal.ai")
      }

      // Test the image URL first
      try {
        const testResponse = await fetch(imageUrl, { method: "HEAD" })
        if (!testResponse.ok) {
          throw new Error(`Image URL is not accessible: ${testResponse.status} ${testResponse.statusText}`)
        }
        console.log(`Image URL is accessible: ${testResponse.status}`)
      } catch (error) {
        console.error("Image URL test failed:", error)
        throw new Error(`Cannot access image URL: ${imageUrl}`)
      }

      // Direct API call to Fal.ai
      const requestBody = {
        prompt: "Remove watermark, clean image, high quality, professional photo editing, restore original content",
        image_url: imageUrl,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
        output_quality: 95,
        strength: 0.8,
        seed: Math.floor(Math.random() * 1000000),
      }

      console.log("Sending request to Fal.ai:", JSON.stringify(requestBody, null, 2))

      const response = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
        method: "POST",
        headers: {
          Authorization: `Key ${this.settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log(`Fal.ai response status: ${response.status}`)
      console.log(`Fal.ai response headers:`, Object.fromEntries(response.headers.entries()))

      // Get response text first to handle both JSON and HTML responses
      const responseText = await response.text()
      console.log(`Response text (first 200 chars): ${responseText.substring(0, 200)}`)

      if (!response.ok) {
        // Try to parse as JSON, but handle HTML error pages
        let errorData: any = {}
        try {
          errorData = JSON.parse(responseText)
        } catch (parseError) {
          // If it's not JSON, it's likely an HTML error page
          console.error("Failed to parse error response as JSON:", parseError)
          throw new Error(
            `Fal API error: ${response.status} - ${response.statusText}. Response: ${responseText.substring(0, 100)}`,
          )
        }

        console.error("Fal API error:", response.status, errorData)

        // Provide more specific error messages
        if (response.status === 422) {
          const detail = errorData.detail?.[0]
          if (detail?.type === "file_download_error") {
            throw new Error(
              `Cannot download image from URL: ${imageUrl}. Please ensure the URL is publicly accessible.`,
            )
          }
        }

        if (response.status === 401) {
          throw new Error("Invalid API key. Please check your Fal.ai API key.")
        }

        if (response.status === 403) {
          throw new Error("Access forbidden. Please check your Fal.ai API key permissions.")
        }

        throw new Error(`Fal API error: ${response.status} - ${errorData.detail || response.statusText}`)
      }

      // Try to parse successful response as JSON
      let result: any
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse success response as JSON:", parseError)
        throw new Error(`Invalid JSON response from Fal.ai: ${responseText.substring(0, 100)}`)
      }

      console.log("Fal API response received successfully")

      // Check if we got images back
      if (result.images && result.images.length > 0) {
        return {
          success: true,
          processedImageUrl: result.images[0].url,
          jobId: result.request_id || `flux_${Date.now()}`,
        }
      } else {
        console.error("No images in response:", result)
        throw new Error("No processed images returned from Flux Kontext")
      }
    } catch (error) {
      console.error("Flux Kontext processing error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  private async removeLightPDF(imageUrl: string, filename: string): Promise<WatermarkRemovalResult> {
    try {
      // Step 1: Upload image
      const uploadResponse = await fetch("https://api.lightpdf.com/api/v1/file/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: imageUrl,
          filename: filename,
        }),
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`)
      }

      const uploadResult = await uploadResponse.json()
      const fileId = uploadResult.file_id

      // Step 2: Process watermark removal
      const processResponse = await fetch("https://api.lightpdf.com/api/v1/watermark/remove", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: fileId,
          auto_detect: true,
        }),
      })

      if (!processResponse.ok) {
        throw new Error(`Processing failed: ${processResponse.statusText}`)
      }

      const processResult = await processResponse.json()

      return {
        success: true,
        processedImageUrl: processResult.download_url,
        jobId: processResult.job_id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async removeWatermarkRemover(imageUrl: string, filename: string): Promise<WatermarkRemovalResult> {
    try {
      const response = await fetch("https://api.watermarkremover.io/v1/remove", {
        method: "POST",
        headers: {
          "X-API-Key": this.settings.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageUrl,
          filename: filename,
          quality: "high",
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        processedImageUrl: result.result_url,
        jobId: result.job_id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async removeRapidAPI(imageUrl: string, filename: string): Promise<WatermarkRemovalResult> {
    try {
      const response = await fetch("https://watermark-remover.p.rapidapi.com/remove", {
        method: "POST",
        headers: {
          "X-RapidAPI-Key": this.settings.apiKey,
          "X-RapidAPI-Host": "watermark-remover.p.rapidapi.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageUrl,
          filename: filename,
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        processedImageUrl: result.output_url,
        jobId: result.request_id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async removeCustom(imageUrl: string, filename: string): Promise<WatermarkRemovalResult> {
    try {
      if (!this.settings.endpoint) {
        throw new Error("Custom endpoint not configured")
      }

      const response = await fetch(`${this.settings.endpoint}/remove`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageUrl,
          filename: filename,
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        processedImageUrl: result.processed_url,
        jobId: result.job_id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
