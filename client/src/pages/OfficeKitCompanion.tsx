import { useState, useEffect, useRef } from 'react'
import {
  Laptop,
  AlertCircle,
  Download,
  RefreshCw,
  FileText,
  Clock,
  Wifi,
  WifiOff,
  Radio,
  Smartphone,
  ArrowDownLeft,
} from 'lucide-react'
import { apiClient } from '../services/api'

export default function OfficeKitCompanion() {
  const [connected, setConnected] = useState(false)
  const [laptopName, setLaptopName] = useState('My Work Laptop')
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connectedRef = useRef(false)
  const laptopNameRef = useRef(laptopName)
  laptopNameRef.current = laptopName

  // Fetch Office Kit files
  const fetchFiles = async () => {
    try {
      setSyncing(true)
      const res = await apiClient.getOfficeKitFiles()
      const docs = res?.data?.documents || []
      setDocuments(docs)
    } catch (err: any) {
      console.warn('Failed to fetch Office Kit files:', err)
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  // Connect laptop to backend
  const handleConnect = async (customName?: string) => {
    try {
      setError(null)
      const name = customName || laptopNameRef.current
      const res = await apiClient.connectLaptop(name)
      if (res?.success) {
        connectedRef.current = true
        setConnected(true)
        setLastHeartbeat(new Date().toLocaleTimeString())
        await fetchFiles()
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect laptop.')
    }
  }

  // Disconnect laptop
  const handleDisconnect = async () => {
    try {
      connectedRef.current = false
      setConnected(false)
      setLastHeartbeat(null)
      await apiClient.disconnectLaptop()
    } catch (err: any) {
      console.warn('Disconnect error:', err)
    }
  }

  // Check initial status and establish connection
  useEffect(() => {
    let interval: any = null

    const checkStatus = async () => {
      try {
        const res = await apiClient.getOfficeKitStatus()
        if (res?.data?.connected) {
          connectedRef.current = true
          setConnected(true)
          if (res.data.laptop?.name) {
            setLaptopName(res.data.laptop.name)
          }
          setLastHeartbeat(new Date().toLocaleTimeString())
        } else {
          // Auto connect as companion device on page open
          await handleConnect()
        }
      } catch {
        // Retry
      } finally {
        await fetchFiles()
      }
    }

    checkStatus()

    // Heartbeat every 15 seconds ONLY when connected
    interval = setInterval(async () => {
      if (connectedRef.current) {
        try {
          await apiClient.laptopHeartbeat(laptopNameRef.current)
          setConnected(true)
          setLastHeartbeat(new Date().toLocaleTimeString())
          await fetchFiles()
        } catch {
          connectedRef.current = false
          setConnected(false)
        }
      }
    }, 15000)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  const handleDownload = async (doc: any) => {
    try {
      const blob = await apiClient.downloadOfficeKitFile(doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName || 'officekit_task.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download document.')
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">iQOO Office Kit — Laptop Companion</h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                  connected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {connected ? (
                  <>
                    <Wifi className="w-3 h-3 animate-pulse" /> Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" /> Disconnected
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Live Phone ↔ PC Bridge for Ambient AI tasks and digital work files
            </p>
          </div>
        </div>

        {/* Connection Controls */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={laptopName}
            onChange={(e) => setLaptopName(e.target.value)}
            disabled={connected}
            placeholder="Device Name"
            className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-44"
          />
          {connected ? (
            <button
              onClick={handleDisconnect}
              className="text-xs px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-xl transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => handleConnect()}
              className="text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all"
            >
              Connect This Laptop
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Info Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Bridge Status
          </span>
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${connected ? 'text-emerald-600 animate-pulse' : 'text-gray-400'}`} />
            <span className="text-sm font-bold text-gray-900">
              {connected ? 'Active Heartbeat Stream' : 'Offline'}
            </span>
          </div>
          {lastHeartbeat && (
            <span className="text-[11px] text-gray-500 block">
              Last synced at {lastHeartbeat}
            </span>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Paired Phone Source
          </span>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-900">iQOO AI Assistant</span>
          </div>
          <span className="text-[11px] text-gray-500 block">
            Ambient AI listening on phone
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Transferred Tasks & Files
          </span>
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-gray-900">
              {documents.length} items ready
            </span>
          </div>
          <button
            onClick={fetchFiles}
            disabled={syncing}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            Refresh now
          </button>
        </div>
      </div>

      {/* Transferred Files / Tasks Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900">Received from Phone (Office Kit)</h2>
          </div>
          <span className="text-xs text-gray-400">
            Auto-polling every 15s
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            Checking Office Kit incoming queue...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
              <Laptop className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">No tasks received yet</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              When Ambient AI creates a task on your phone, choose <strong>"Send to Laptop"</strong> or <strong>"Send to Both"</strong> to transfer it here instantly.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc: any) => (
              <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{doc.fileName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {doc.fileType || 'task/markdown'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1">{doc.summary || 'Office Kit Transfer'}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(doc.createdAt).toLocaleString()}
                    </span>
                    <span>{doc.fileSize} bytes</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download / Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
