import { type NextRequest, NextResponse } from "next/server"
import { WatermarkRemovalAPI } from "@/lib/watermark-api"
import { put } from "@vercel/blob"

interface ProcessingProgress {
  total: number
  completed: number
  current: string
  status: "processing" | "completed" | "error"
  results: ProcessingResult[]
}

interface ProcessingResult {
  originalUrl: string
  processedUrl: string
  filename: string
  status: "success" | "error" | "processing"
  message?: string
  jobId?: string
}

interface UploadedFileInfo {
  id: string
  filename: string
  dataUrl: string
}

// In-memory storage for progress tracking (in production, use Redis or database)
const progressStore = new Map<string, ProcessingProgress>()

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds
  backoffMultiplier: 2,
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = RETRY_CONFIG.maxRetries,
  delay: number = RETRY_CONFIG.retryDelay,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying in ${delay}ms... (${retries} retries left)`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return retryWithBackoff(fn, retries - 1, delay * RETRY_CONFIG.backoffMultiplier)
    }
    throw error
  }
}

async function processImageWithRetry(
  api: WatermarkRemovalAPI,
  imageUrl: string,
  filename: string,
): Promise<ProcessingResult> {
  try {
    const result = await retryWithBackoff(async () => {
      return await api.removeWatermark(imageUrl, filename)
    })

    if (result.success && result.processedImageUrl) {
      return {
        originalUrl: imageUrl,
        processedUrl: result.processedImageUrl,
        filename,
        status: "success",
        jobId: result.jobId,
      }
    } else {
      return {
        originalUrl: imageUrl,
        processedUrl: imageUrl, // Fallback to original
        filename,
        status: "error",
        message: result.error || "Processing failed",
      }
    }
  } catch (error) {
    return {
      originalUrl: imageUrl,
      processedUrl: imageUrl, // Fallback to original
      filename,
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const sessionId = formData.get("sessionId") as string
    const galleryUrl = formData.get("galleryUrl") as string
    const fileCount = Number.parseInt((formData.get("fileCount") as string) || "0")

    // Check if we're in demo mode
    const demoMode = process.env.DEMO_MODE === "true"
    const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY || ""

    if (demoMode || !apiKey) {
      console.log("Running in demo mode")

      // Use placeholder images for demo
      const sampleImages = [
        { url: "/placeholder.svg?height=400&width=600&text=Sample+Image+1+with+Watermark", filename: "sample_1.jpg" },
        { url: "/placeholder.svg?height=400&width=600&text=Sample+Image+2+with+Watermark", filename: "sample_2.jpg" },
        { url: "/placeholder.svg?height=400&width=600&text=Sample+Image+3+with+Watermark", filename: "sample_3.jpg" },
      ]

      // Simulate processing results
      const results = sampleImages.map((image) => ({
        originalUrl: image.url,
        processedUrl: image.url.replace("with+Watermark", "Watermark+Removed"),
        filename: image.filename,
        status: "success" as const,
        message: "Demo processing completed",
      }))

      return NextResponse.json({ results, sessionId, demoMode: true })
    }

    console.log("Using real Fal.ai API key")

    // Get API settings from environment variables
    const apiSettings = {
      provider: "fal",
      apiKey: apiKey,
      endpoint: "",
    }

    let imagesToProcess: { url: string; filename: string; isUploaded?: boolean }[] = []

    // Handle uploaded files first – upload to Vercel Blob to obtain public URLs
    if (fileCount > 0) {
      console.log(`Processing ${fileCount} uploaded files`)

      for (let i = 0; i < fileCount; i++) {
        const file = formData.get(`file_${i}`) as File | null
        if (!file) continue

        // ✅ upload to Vercel Blob (public access)
        try {
          const blob = await put(`uploads/${Date.now()}_${file.name}`, file, { access: "public" })

          imagesToProcess.push({
            url: blob.url, // publicly reachable
            filename: file.name,
            isUploaded: true,
          })

          console.log(`Uploaded ${file.name} → ${blob.url}`)
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err)

          // still show the user’s image in UI but mark as error
          const arrayBuffer = await file.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString("base64")
          const dataUrl = `data:${file.type};base64,${base64}`

          imagesToProcess.push({
            url: dataUrl,
            filename: file.name,
            isUploaded: true,
          })
          // and we’ll pick it up later; Fal will skip because it isn’t public
        }
      }
    }

    // Extract images from gallery if provided
    if (galleryUrl && galleryUrl.trim()) {
      try {
        // Fix the gallery URL format
        let processedGalleryUrl = galleryUrl.trim()

        // If it's an individual image URL, try to extract the gallery base URL
        if (processedGalleryUrl.includes("?pid=") || processedGalleryUrl.includes("&id=")) {
          // Extract the base gallery URL
          const urlParts = processedGalleryUrl.split("?")[0]
          processedGalleryUrl = urlParts
          console.log(`Converted individual image URL to gallery URL: ${processedGalleryUrl}`)
        }

        const extractResponse = await fetch(`${request.nextUrl.origin}/api/extract-gallery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ galleryUrl: processedGalleryUrl }),
        })

        if (extractResponse.ok) {
          const { images } = await extractResponse.json()
          imagesToProcess.push(...images.map((img: any) => ({ ...img, isUploaded: false })))
          console.log(`Extracted ${images.length} images from gallery`)
        } else {
          const errorData = await extractResponse.json()
          console.error("Gallery extraction failed:", errorData)
          throw new Error(`Gallery extraction failed: ${errorData.error}`)
        }
      } catch (error) {
        console.error("Gallery extraction failed:", error)
        // Don't fail completely if we have uploaded files
        if (imagesToProcess.length === 0) {
          throw error
        }
      }
    }

    // If no images from files or gallery, use sample images
    if (imagesToProcess.length === 0) {
      imagesToProcess = [
        {
          url: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=800&h=600&fit=crop",
          filename: "sample_landscape.jpg",
          isUploaded: false,
        },
        {
          url: "https://images.unsplash.com/photo-1516117172878-fd2c41f4a759?w=800&h=600&fit=crop",
          filename: "sample_architecture.jpg",
          isUploaded: false,
        },
      ]
    }

    console.log(`Processing ${imagesToProcess.length} images`)

    // Initialize progress tracking
    const progress: ProcessingProgress = {
      total: imagesToProcess.length,
      completed: 0,
      current: "",
      status: "processing",
      results: [],
    }

    progressStore.set(sessionId, progress)

    // Process images asynchronously
    const api = new WatermarkRemovalAPI(apiSettings)

    // Process images in parallel with concurrency limit
    const concurrencyLimit = 2 // Reduced for Fal.ai rate limits
    const results: ProcessingResult[] = []

    for (let i = 0; i < imagesToProcess.length; i += concurrencyLimit) {
      const batch = imagesToProcess.slice(i, i + concurrencyLimit)

      const batchPromises = batch.map(async (image) => {
        // Update progress
        const currentProgress = progressStore.get(sessionId)
        if (currentProgress) {
          currentProgress.current = image.filename
          progressStore.set(sessionId, currentProgress)
        }

        const result = await processImageWithRetry(api, image.url, image.filename)

        // Update progress
        const updatedProgress = progressStore.get(sessionId)
        if (updatedProgress) {
          updatedProgress.completed++
          updatedProgress.results.push(result)

          if (updatedProgress.completed >= updatedProgress.total) {
            updatedProgress.status = "completed"
            updatedProgress.current = ""
          }

          progressStore.set(sessionId, updatedProgress)
        }

        return result
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return NextResponse.json({ results, sessionId })
  } catch (error) {
    console.error("Processing error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process images",
      },
      { status: 500 },
    )
  }
}

// GET endpoint for progress tracking
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 })
  }

  const progress = progressStore.get(sessionId)

  if (!progress) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  return NextResponse.json(progress)
}
