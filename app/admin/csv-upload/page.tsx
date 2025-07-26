'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface UploadResult {
  file: string
  success: boolean
  inserted?: number
  message: string
}

interface UploadResponse {
  success: boolean
  message: string
  totalInserted: number
  results: UploadResult[]
}

export default function CSVUploadPage() {
  const [station, setStation] = useState<string>('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [status, setStatus] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files)
  }

  const handleUpload = async () => {
    if (!station || !files || files.length === 0) {
      alert('Bitte wählen Sie eine Station und mindestens eine CSV-Datei aus.')
      return
    }

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('station', station)
      
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const response = await fetch('/api/admin/upload-csv-bulk', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        // Aktualisiere Status nach erfolgreichem Upload
        fetchStatus()
      }

    } catch (error) {
      console.error('Upload error:', error)
      setResult({
        success: false,
        message: 'Fehler beim Upload',
        totalInserted: 0,
        results: []
      })
    } finally {
      setUploading(false)
    }
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/upload-csv-bulk')
      const data = await response.json()
      if (data.success) {
        setStatus(data.status)
      }
    } catch (error) {
      console.error('Status fetch error:', error)
    }
  }

  // Lade Status beim ersten Laden
  useState(() => {
    fetchStatus()
  })

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Bulk Upload
          </CardTitle>
          <CardDescription>
            Laden Sie mehrere CSV-Dateien für eine Station hoch. Die Dateien werden sofort verarbeitet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Station Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Station</label>
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger>
                <SelectValue placeholder="Wählen Sie eine Station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ort">Ort</SelectItem>
                <SelectItem value="techno">Techno</SelectItem>
                <SelectItem value="heuballern">Heuballern</SelectItem>
                <SelectItem value="band">Band</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">CSV-Dateien</label>
            <input
              type="file"
              multiple
              accept=".csv"
              onChange={handleFileChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            {files && (
              <div className="text-sm text-gray-600">
                {files.length} Datei(en) ausgewählt
              </div>
            )}
          </div>

          {/* Upload Button */}
          <Button 
            onClick={handleUpload} 
            disabled={!station || !files || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upload läuft...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                CSV-Dateien hochladen
              </>
            )}
          </Button>

          {/* Result */}
          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                <div className="font-medium mb-2">{result.message}</div>
                {result.success && (
                  <div className="text-sm">
                    <div className="mb-2">Gesamt importiert: <Badge variant="secondary">{result.totalInserted}</Badge></div>
                    <div className="space-y-1">
                      {result.results.map((fileResult, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          {fileResult.success ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                          <FileText className="h-3 w-3 text-gray-500" />
                          <span className="font-mono">{fileResult.file}</span>
                          {fileResult.success && fileResult.inserted && (
                            <Badge variant="outline" className="text-xs">
                              {fileResult.inserted} Messwerte
                            </Badge>
                          )}
                          <span className="text-gray-600">- {fileResult.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Status */}
          {status && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Aktueller Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(status).map(([station, data]: [string, any]) => (
                  <Card key={station} className="p-3">
                    <div className="text-sm font-medium capitalize">{station}</div>
                    <div className="text-2xl font-bold">{data.fileCount}</div>
                    <div className="text-xs text-gray-500">CSV-Dateien</div>
                    {data.files && data.files.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        Neueste: {data.files[0]}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 