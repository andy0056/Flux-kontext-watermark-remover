import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface GalleryImage {
  url: string
  filename: string
  thumbnail?: string
}

async function extractPixiesetGallery(galleryUrl: string): Promise<GalleryImage[]> {
  try {
    console.log(`Extracting gallery from: ${galleryUrl}`)

    // Add user agent to avoid blocking
    const response = await fetch(galleryUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const images: GalleryImage[] = []

    console.log(`HTML content length: ${html.length}`)

    // Multiple strategies to find images in Pixieset galleries

    // Strategy 1: Look for data-src attributes (lazy loading)
    $("img[data-src]").each((index, element) => {
      const $img = $(element)
      const src = $img.attr("data-src")

      if (src && src.includes("pixieset")) {
        const highResSrc = src
          .replace(/\/w_\d+/, "/w_2048")
          .replace(/\/h_\d+/, "/h_2048")
          .replace(/\/c_fill/, "/c_fit")

        images.push({
          url: highResSrc,
          filename: `pixieset_image_${images.length + 1}.jpg`,
          thumbnail: src,
        })
      }
    })

    // Strategy 2: Look for regular src attributes
    $("img[src]").each((index, element) => {
      const $img = $(element)
      const src = $img.attr("src")

      if (src && src.includes("pixieset") && !src.includes("logo") && !src.includes("icon")) {
        const highResSrc = src
          .replace(/\/w_\d+/, "/w_2048")
          .replace(/\/h_\d+/, "/h_2048")
          .replace(/\/c_fill/, "/c_fit")

        // Avoid duplicates
        if (!images.some((img) => img.url === highResSrc)) {
          images.push({
            url: highResSrc,
            filename: `pixieset_image_${images.length + 1}.jpg`,
            thumbnail: src,
          })
        }
      }
    })

    // Strategy 3: Look for JSON-LD structured data
    $('script[type="application/ld+json"]').each((index, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || "{}")
        if (jsonData.image) {
          const imageUrls = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image]
          imageUrls.forEach((imgUrl: string, idx: number) => {
            if (imgUrl && imgUrl.includes("pixieset")) {
              images.push({
                url: imgUrl,
                filename: `structured_image_${idx + 1}.jpg`,
                thumbnail: imgUrl,
              })
            }
          })
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    })

    // Strategy 4: Look for JavaScript variables containing image data
    $("script").each((index, element) => {
      const scriptContent = $(element).html() || ""

      // Look for common patterns in Pixieset JavaScript
      const imageUrlMatches = scriptContent.match(/https:\/\/[^"'\s]+pixieset[^"'\s]+\.(jpg|jpeg|png)/gi)
      if (imageUrlMatches) {
        imageUrlMatches.forEach((url, idx) => {
          if (!images.some((img) => img.url === url)) {
            images.push({
              url: url,
              filename: `js_extracted_${idx + 1}.jpg`,
              thumbnail: url,
            })
          }
        })
      }
    })

    console.log(`Found ${images.length} images using various strategies`)

    // Remove duplicates and limit results
    const uniqueImages = images.filter((img, index, self) => index === self.findIndex((i) => i.url === img.url))

    console.log(`After deduplication: ${uniqueImages.length} unique images`)

    // If we didn't find any images, try to provide helpful feedback
    if (uniqueImages.length === 0) {
      console.log("No images found. HTML preview:", html.substring(0, 500))

      // Check if this might be a password-protected gallery
      if (html.includes("password") || html.includes("Password")) {
        throw new Error("Gallery appears to be password protected")
      }

      // Check if this is actually a Pixieset page
      if (!html.includes("pixieset")) {
        throw new Error("This doesn't appear to be a Pixieset gallery page")
      }
    }

    return uniqueImages.slice(0, 20) // Limit to 20 images for POC
  } catch (error) {
    console.error("Gallery extraction error:", error)
    throw new Error(`Failed to extract gallery: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { galleryUrl } = await request.json()

    if (!galleryUrl) {
      return NextResponse.json({ error: "Gallery URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(galleryUrl)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Check if it's a supported gallery type
    if (!galleryUrl.includes("pixieset.com")) {
      return NextResponse.json({ error: "Currently only Pixieset galleries are supported" }, { status: 400 })
    }

    const images = await extractPixiesetGallery(galleryUrl)

    if (images.length === 0) {
      return NextResponse.json(
        {
          error: "No images found in the gallery. Please check the URL and ensure it's a public gallery.",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({ images })
  } catch (error) {
    console.error("Gallery extraction error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to extract gallery",
      },
      { status: 500 },
    )
  }
}
