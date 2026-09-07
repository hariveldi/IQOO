import React, { useState } from 'react'
import { Send, Mic, Paperclip } from 'lucide-react'

export default function AIPage() {
  const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: 'user' | 'ai' }>>([
    {
      id: '1',
      text: 'Hi! I\'m your AI productivity assistant. How can I help you today?',
      sender: 'ai',
    },
  ])
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (input.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        text: input,
        sender: 'user' as const,
      }
      setMessages([...messages, newMessage])
      setInput('')

      // Simulate AI response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            text: 'I\'ve received your message. Let me analyze your tasks and help you prioritize.',
            sender: 'ai',
          },
        ])
      }, 500)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-screen bg-white pb-24 md:pb-4">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-sm text-gray-600">Your intelligent productivity partner</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-3 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Mic className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="p-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
