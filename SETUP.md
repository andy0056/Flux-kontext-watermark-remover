# Watermark Removal App Setup Guide

## Prerequisites

1. **Fal.ai Account**: Sign up at [fal.ai](https://fal.ai) and get your API key
2. **Vercel Account**: For deployment and blob storage
3. **Node.js**: Version 18 or higher

## Environment Variables Setup

### For Local Development

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your Fal.ai API key:
   ```env
   FAL_KEY=your_actual_fal_api_key_here
   DEMO_MODE=false
   ```

3. (Optional) Add Vercel Blob token for file uploads:
   ```env
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

### For Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables:
   - `FAL_KEY` = your Fal.ai API key
   - `DEMO_MODE` = false
   - `BLOB_READ_WRITE_TOKEN` = your Vercel blob token (optional)

## Getting Your Fal.ai API Key

1. Visit [fal.ai](https://fal.ai)
2. Sign up for an account
3. Go to your dashboard
4. Navigate to API Keys section
5. Create a new API key
6. Copy the key and add it to your environment variables

## Installation & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Features

- **Local File Upload**: Upload images directly from your device
- **Gallery Processing**: Extract images from Pixieset gallery URLs
- **AI Watermark Removal**: Uses Fal.ai's Flux Kontext model
- **Progress Tracking**: Real-time processing updates
- **High Quality Output**: Professional-grade results

## Testing the Setup

1. Go to Settings page (`/settings`) to check API configuration
2. Use the "Test Fal.ai API Connection" button to verify your setup
3. Try uploading a sample image or using a gallery URL

## Troubleshooting

### Common Issues

1. **"No API key configured"**
   - Make sure `FAL_KEY` is set in your environment variables
   - Restart your development server after adding the key

2. **"Invalid API key"**
   - Verify your Fal.ai API key is correct
   - Check that you have sufficient credits in your Fal.ai account

3. **"Image URL is not accessible"**
   - Ensure uploaded files are publicly accessible
   - For gallery URLs, make sure they're public Pixieset galleries

4. **File upload issues**
   - Add `BLOB_READ_WRITE_TOKEN` for Vercel Blob storage
   - Or use gallery URLs instead of file uploads

### Demo Mode

If you want to test the UI without API calls:
```env
DEMO_MODE=true
```

This will show placeholder results without making actual API calls.

## API Endpoints

- `POST /api/process-images` - Main processing endpoint
- `GET /api/process-images?sessionId=X` - Progress tracking
- `POST /api/extract-gallery` - Gallery URL extraction
- `GET /api/status` - API configuration status
- `POST /api/test-fal` - API connection testing

## Deployment

The app is ready for deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

Your app will be live and ready to process watermark removal requests!