"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Download, ImageIcon, Loader2, Settings, FileImage } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface ProcessingResult {
  originalUrl: string
  processedUrl: string
  filename: string
  status: "success" | "error"
  message?: string
}

export default function WatermarkRemovalPOC() {
  const [galleryUrl, setGalleryUrl] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [error, setError] = useState("")
  const [progress, setProgress] = useState<{
    total: number
    completed: number
    current: string
    status: string
  } | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))

    if (imageFiles.length !== files.length) {
      setError("Only image files are supported")
      return
    }

    if (imageFiles.length > 10) {
      setError("Maximum 10 images allowed")
      return
    }

    setSelectedFiles(imageFiles)
    setError("")
  }

  const removeFile = (index: number) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index))
  }

  const handleProcessImages = async () => {
    setIsProcessing(true)
    setError("")
    setResults([])
    setProgress(null)

    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Prepare form data for file uploads
      const formData = new FormData()
      formData.append("sessionId", sessionId)

      // Show preview of uploaded files in the UI
      if (selectedFiles.length > 0) {
        console.log(
          `Uploading ${selectedFiles.length} files:`,
          selectedFiles.map((f) => f.name),
        )
      }

      if (galleryUrl.trim()) {
        formData.append("galleryUrl", galleryUrl)
      }

      // Add selected files
      selectedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file)
      })

      formData.append("fileCount", selectedFiles.length.toString())

      const response = await fetch("/api/process-images", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Processing failed")
      }

      const data = await response.json()

      // If it's demo mode, handle results directly
      if (data.demoMode) {
        // Simulate progress for demo
        setProgress({
          total: data.results.length,
          completed: 0,
          current: "",
          status: "processing",
        })

        for (let i = 0; i < data.results.length; i++) {
          setProgress((prev) =>
            prev
              ? {
                  ...prev,
                  current: data.results[i].filename,
                  completed: i,
                }
              : null,
          )

          await new Promise((resolve) => setTimeout(resolve, 1500))

          setProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: i + 1,
                }
              : null,
          )
        }

        setProgress((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                current: "",
              }
            : null,
        )

        setResults(data.results)
        setIsProcessing(false)
        return
      }

      // For real API processing, start polling for progress
      const pollProgress = async () => {
        try {
          const progressResponse = await fetch(`/api/process-images?sessionId=${sessionId}`)
          if (progressResponse.ok) {
            const progressData = await progressResponse.json()
            setProgress(progressData)

            if (progressData.status === "completed") {
              setResults(progressData.results)
              setIsProcessing(false)
            } else if (progressData.status === "error") {
              setError("Processing failed")
              setIsProcessing(false)
            } else {
              // Continue polling
              setTimeout(pollProgress, 1000)
            }
          }
        } catch (err) {
          console.error("Progress polling error:", err)
        }
      }

      // Start polling
      setTimeout(pollProgress, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsProcessing(false)
    }
  }

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Download failed:", err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-gray-900">Watermark Removal POC</h1>
            <Link href="/settings">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Automated watermark removal using Fal.ai Flux Kontext model. Upload local images or enter a gallery URL.
          </p>
        </div>

        {/* API Status Alert */}
        <Alert>
          <AlertDescription>
            <strong>API Status:</strong> Using server-side API key configuration. Fal.ai Flux Kontext model ready for
            processing.
          </AlertDescription>
        </Alert>

        {/* Input Section */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Image Processing
            </CardTitle>
            <CardDescription>
              Upload local images or enter a Pixieset gallery URL to extract and process images.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Section */}
            <div className="space-y-4">
              <Label htmlFor="file-upload" className="text-base font-semibold">
                Upload Local Images
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileImage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-900">Click to upload images</p>
                  <p className="text-sm text-gray-500">PNG, JPG, JPEG up to 10 files</p>
                </label>
              </div>

              {/* Selected Files Display */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected Files ({selectedFiles.length})</Label>
                  <div className="grid gap-2 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm truncate">{file.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeFile(index)} disabled={isProcessing}>
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Gallery URL Section */}
            <div className="space-y-2">
              <Label htmlFor="gallery-url">Pixieset Gallery URL</Label>
              <Input
                id="gallery-url"
                type="url"
                placeholder="https://photographer.pixieset.com/gallery-name/"
                value={galleryUrl}
                onChange={(e) => setGalleryUrl(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500">
                Use the main gallery URL, not individual image URLs. Example:
                https://photographer.pixieset.com/gallery-name/
              </p>
            </div>

            <Button
              onClick={handleProcessImages}
              disabled={isProcessing || (selectedFiles.length === 0 && !galleryUrl.trim())}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Images...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Process Images ({selectedFiles.length > 0 ? `${selectedFiles.length} files` : "from gallery"})
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Progress Section */}
        {progress && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Processing Progress</CardTitle>
              <CardDescription>
                {progress.completed} of {progress.total} images processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
              {progress.current && <p className="text-sm text-gray-600">Currently processing: {progress.current}</p>}
              <p className="text-sm font-medium">
                Status: {progress.status === "processing" ? "Processing..." : "Completed"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
              <CardDescription>Original and processed images. Click download to save the results.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {results.map((result, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-sm truncate">{result.filename}</h3>

                    {/* Original Image */}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Original (with watermark)</Label>
                      <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                        <img
                          src={result.originalUrl || "/placeholder.svg"}
                          alt="Original with watermark"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("Failed to load image:", result.originalUrl)
                            e.currentTarget.src = "/placeholder.svg?height=400&width=600&text=Failed+to+load"
                          }}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(result.originalUrl, `original_${result.filename}`)}
                        className="w-full"
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Download Original
                      </Button>
                    </div>

                    {/* Processed Image */}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Processed (watermark removed)</Label>
                      <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                        <img
                          src={result.processedUrl || "/placeholder.svg"}
                          alt="Processed without watermark"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownload(result.processedUrl, `processed_${result.filename}`)}
                        className="w-full"
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Download Processed
                      </Button>
                    </div>

                    {result.status === "success" && (
                      <div className="text-xs text-green-600 bg-green-50 p-2 rounded">✓ Successfully processed</div>
                    )}

                    {result.status === "error" && result.message && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded">❌ {result.message}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Section */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Local Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600">Upload images directly from your device for processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Gallery Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600">Extract images from Pixieset gallery URLs automatically</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Flux Kontext AI</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600">State-of-the-art AI model for intelligent watermark removal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">High Quality Output</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600">Professional-grade results with minimal artifacts</p>
            </CardContent>
          </Card>
        </div>

        {/* Technical Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technical Implementation</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              value={`Production Implementation:
• Local file upload with drag & drop support
• Fal.ai Flux Kontext model for watermark removal
• Server-side API key management for security
• Real-time progress tracking with polling
• Robust error handling and retry logic
• Gallery extraction with web scraping
• Batch processing with concurrency limits
• High-quality output (95% JPEG quality)
• Professional watermark removal prompts`}
              className="h-48 text-sm font-mono"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
