'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { 
  Sparkles, 
  Send, 
  X, 
  MessageSquare, 
  Bot, 
  AlertTriangle 
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export default function AiAssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: '🚀 Chào phi hành gia! Tôi là Leo - trợ lý phi hành gia ảo thuộc cabin điều khiển CardTKB. Tôi có thể giúp bạn phân tích trùng lịch, tối ưu hóa quỹ đạo học kỳ này hoặc cùng trò chuyện ngoài không gian. Bạn muốn tôi hỗ trợ gì?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { courseCards, versions, currentVersionId, placedCards } = useScheduleStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Chuẩn bị dữ liệu TKB thực tế từ Zustand để gửi cho AI
      const currentVersion = versions.find(v => v.id === currentVersionId);
      const activePlacedCards = currentVersion ? currentVersion.placedCards : placedCards;
      
      // Lọc các môn học được xếp trong version hiện tại
      const activeCards = courseCards.filter(card => 
        activePlacedCards.some(pc => pc.courseCardId === card.id)
      );

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      const storedGroqKey = localStorage.getItem('cardtkb_groq_api_key');
      if (storedGroqKey) {
        headers['x-groq-api-key'] = storedGroqKey;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          message: textToSend,
          courseCards: activeCards,
          versions: versions
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Lỗi không xác định từ AI');
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ Kết nối với trạm không gian thất bại: ${err.message || 'Vui lòng thử lại sau.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSend(question);
  };

  return (
    <>
      {/* 1. NÚT TRÒN MỞ KHUNG CHAT (BẤM ĐỂ GỌI TRỢ LÝ) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.4)] border border-cyan-400/40 hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer"
          title="Trợ lý phi hành gia ảo Gemini"
        >
          <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-ping pointer-events-none" />
          <Bot className="w-8 h-8 text-white group-hover:rotate-12 transition-transform duration-300" />
          <Sparkles className="w-4 h-4 text-cyan-300 absolute top-2 right-2 animate-pulse" />
        </button>
      )}

      {/* 2. KHUNG HỘP CHATBOT AI */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-[#0b1329]/95 backdrop-blur-xl border border-cyan-500/30 rounded-3xl shadow-[0_0_40px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          
          {/* HEADER CHAT: HIỂN THỊ AVATAR PHI HÀNH GIA 3D ĐỘC ĐÁO */}
          <div className="relative h-28 bg-gradient-to-r from-slate-900 via-[#0e162f] to-slate-900 border-b border-cyan-500/20 px-4 py-2 flex items-center justify-between">
            {/* Avatar Robot Trợ lý ảo */}
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-full flex items-center justify-center border-2 border-cyan-400/40 bg-slate-950/80 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                {/* Biểu tượng trợ lý ảo LEO */}
                <Bot className="w-8 h-8 text-cyan-400 animate-pulse" />
                {/* Đèn báo tín hiệu trực tuyến nhấp nháy */}
                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-cyan-400 tracking-wider text-sm flex items-center gap-1.5">
                  LEO ASTRONAUT
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                </h4>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest animate-pulse">Trạm không gian CardTKB</p>
              </div>
            </div>
            
            {/* Nút đóng */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-800/80 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* THÂN HỘP CHAT: DANH SÁCH TIN NHẮN */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none border border-cyan-500/20'
                      : 'bg-slate-900/90 text-gray-200 rounded-bl-none border border-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-line text-xs">{msg.text}</p>
                  <span className="block text-[8px] text-gray-500 mt-1 text-right">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Trạng thái AI đang suy nghĩ */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-bl-none px-4 py-3 shadow-md flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* GỢI Ý HỎI NHANH */}
          {messages.length === 1 && !loading && (
            <div className="px-4 py-2 border-t border-slate-900 flex flex-col gap-1.5 bg-[#090f20]/50">
              <span className="text-[10px] text-gray-500 tracking-wider font-semibold">GỢI Ý HỎI LEO:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleQuickQuestion('Hãy kiểm tra xem thời khóa biểu của tôi có bị trùng lịch học nào không?')}
                  className="px-2.5 py-1.5 bg-slate-900/60 hover:bg-cyan-950/20 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 text-[10px] text-gray-400 rounded-lg transition-all text-left cursor-pointer"
                >
                  🔍 Kiểm tra trùng lịch học
                </button>
                <button
                  onClick={() => handleQuickQuestion('Có cách nào tối ưu hóa thời khóa biểu hiện tại không? Hãy cho tôi lời khuyên.')}
                  className="px-2.5 py-1.5 bg-slate-900/60 hover:bg-cyan-950/20 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 text-[10px] text-gray-400 rounded-lg transition-all text-left cursor-pointer"
                >
                  💡 Gợi ý tối ưu lịch
                </button>
                <button
                  onClick={() => handleQuickQuestion('Nói chuyện phiếm ngẫu nhiên về vũ trụ đi.')}
                  className="px-2.5 py-1.5 bg-slate-900/60 hover:bg-cyan-950/20 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 text-[10px] text-gray-400 rounded-lg transition-all text-left cursor-pointer"
                >
                  🌌 Trò chuyện ngoài không gian
                </button>
              </div>
            </div>
          )}

          {/* CHÂN HỘP CHAT: NHẬP VÀ GỬI TIN NHẮN */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-slate-950 border-t border-cyan-500/20 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Gửi tin nhắn lên cabin điều khiển..."
              disabled={loading}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-500 transition-all duration-300"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:hover:from-cyan-600 disabled:hover:to-blue-600 text-white rounded-xl transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
