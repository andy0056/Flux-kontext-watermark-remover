"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Shield, CheckCircle, XCircle, Info, TestTube } from "lucide-react"
import Link from "next/link"

interface ApiStatus {
  demoMode: boolean
  apiConfigured: boolean
  apiKeyFormat: string
  provider: string
  message: string
  keyLength: number
  keyPrefix: string | null
  emailConfigured: boolean
  passwordConfigured: boolean
}

export default function SettingsPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  useEffect(() => {
    // Check API status on component mount
    const checkApiStatus = async () => {
      try {
        const response = await fetch("/api/status")
        const status = await response.json()
        setApiStatus(status)
      } catch (error) {
        console.error("Failed to check API status:", error)
        setApiStatus({
          demoMode: false,
          apiConfigured: false,
          provider: "unknown",
          message: "Failed to check API status",
        })
      } finally {
        setIsLoading(false)
      }
    }

    checkApiStatus()
  }, [])

  const handleTestApi = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/test-fal", {
        method: "POST",
      })

      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: "Test failed: Unable to connect to server",
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Main
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">API Settings</h1>
        </div>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Security:</strong> This application uses server-side environment variables for API key management.
            Your API keys are secure and never exposed to the client.
          </AlertDescription>
        </Alert>

        {/* API Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isLoading ? (
                <Info className="h-5 w-5 animate-pulse" />
              ) : apiStatus?.apiConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              API Configuration Status
            </CardTitle>
            <CardDescription>Current status of your API key configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Checking API status...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold">Provider</h4>
                    <p className="text-sm text-gray-600">
                      {apiStatus?.provider === "fal" ? "Fal.ai (Flux Kontext)" : "Demo Mode"}
                    </p>
                    {apiStatus?.keyPrefix && (
                      <p className="text-xs text-gray-500">
                        Key: {apiStatus.keyPrefix} ({apiStatus.keyLength} chars)
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <h4 className="font-semibold">Status</h4>
                    <p className={`text-sm ${apiStatus?.apiConfigured ? "text-green-600" : "text-orange-600"}`}>
                      {apiStatus?.apiConfigured ? "Configured" : "Not Configured"}
                    </p>
                    {apiStatus?.apiKeyFormat && (
                      <p
                        className={`text-xs ${apiStatus.apiKeyFormat === "valid" ? "text-green-500" : "text-yellow-500"}`}
                      >
                        Format: {apiStatus.apiKeyFormat}
                      </p>
                    )}
                  </div>
                </div>

                <Alert variant={apiStatus?.apiConfigured ? "default" : "destructive"}>
                  <AlertDescription>{apiStatus?.message}</AlertDescription>
                </Alert>

                {/* Test API Button */}
                {apiStatus?.apiConfigured && (
                  <Button onClick={handleTestApi} disabled={isTesting} variant="outline" className="w-full">
                    {isTesting ? (
                      <>Testing...</>
                    ) : (
                      <>
                        <TestTube className="mr-2 h-4 w-4" />
                        Test Fal.ai API Connection
                      </>
                    )}
                  </Button>
                )}

                {/* Test Results */}
                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    <AlertDescription>
                      <strong>{testResult.success ? "✅ Success:" : "❌ Failed:"}</strong>{" "}
                      {testResult.error || testResult.message}
                      {testResult.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">View details</summary>
                          <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
                            {JSON.stringify(testResult.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Environment Variables Setup */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables Setup</CardTitle>
            <CardDescription>How to configure your Fal.ai API key securely</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">For Local Development:</h4>
              <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                <div># Create a .env.local file in your project root</div>
                <div>FAL_KEY=your_fal_api_key_here</div>
                <div>DEMO_MODE=false</div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">For Production (Vercel):</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                <li>Go to your Vercel project dashboard</li>
                <li>Navigate to Settings → Environment Variables</li>
                <li>
                  Add: <code className="bg-gray-200 px-1 rounded">FAL_KEY</code> = your API key
                </li>
                <li>
                  Add: <code className="bg-gray-200 px-1 rounded">DEMO_MODE</code> = false
                </li>
                <li>Deploy your changes</li>
              </ol>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Getting Your Fal.ai API Key:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                <li>
                  Visit{" "}
                  <a
                    href="https://fal.ai"
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    fal.ai
                  </a>
                </li>
                <li>Sign up for an account or log in</li>
                <li>Go to your dashboard and navigate to API Keys</li>
                <li>Create a new API key</li>
                <li>Copy the key and add it to your environment variables</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
