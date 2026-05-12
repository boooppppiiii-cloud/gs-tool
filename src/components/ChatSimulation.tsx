import React, { useState, useRef, useEffect } from 'react';
import { Send, Shield as User, MessageSquare, Bot, Sparkles, RefreshCcw, Settings, Sword } from 'lucide-react';
import { ServerProfile } from '../types';
import { logUsage } from '../services/analyticsService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  profiles: ServerProfile[];
}

export default function ChatSimulation({ profiles }: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id || '');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find(p => p.id === selectedProfileId);
  const players = activeProfile?.persistentPortraits ? Object.keys(activeProfile.persistentPortraits) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startNewSimulation = () => {
    if (!activeProfile || !selectedPlayer) return;
    
    logUsage('simulation_start', `Simulating with player ${selectedPlayer} in profile ${activeProfile.name}`);
    const portrait = activeProfile.persistentPortraits?.[selectedPlayer] as any;
    const gsPersona = activeProfile.gsPersona;
    
    setMessages([
      {
        role: 'assistant',
        content: `你好，我是${activeProfile.gsName || 'GS'}。我已经准备好模拟与玩家“${selectedPlayer}”的对话了。你可以扮演玩家进行提问或发起冲突，我会尝试以GS的身份引导话题，维护区服生态。`
      }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeProfile || !selectedPlayer) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    logUsage('simulation_msg', `Sent message to GS ${activeProfile.gsName || 'Default'}`);
    try {
      const portrait = activeProfile.persistentPortraits?.[selectedPlayer] as any;
      const gsPersona = activeProfile.gsPersona;

      const systemInstruction = `你是一款名为《傲世传奇》的手游中的 GS (Game Support)。目前你正在进行一场对话模拟。

你的身份 (GS 人设):
- 角色名: ${activeProfile.gsName || '系统默认'}
- 年龄: ${gsPersona?.age || '未知'}
- 家乡: ${gsPersona?.hometown || '未知'}
- 职业: ${gsPersona?.occupation || '未知'}
- 生活作息: ${gsPersona?.lifestyle || '未知'}
- 性格/补充: ${gsPersona?.others || '亲和且专业'}

你对话的对象 (玩家画像):
- 角色名: ${selectedPlayer}
- 总体评价: ${portrait?.summary || '普通玩家'}
- 付费习惯: ${portrait?.paymentHabits || '中等'}
- 性格: ${portrait?.personality || '温和'}
- 游戏习惯: ${portrait?.gameHabits || '活跃'}
- 现实人设: ${portrait?.realLifePersona || '未知'}

当前区服生态: ${activeProfile.serverEcology || '稳定'}

目标: 扮演GS角色，稳定玩家情绪，引导健康消费。说话语气符合人设，简练真实，避免大段说教。`;

      const history = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const response = await fetch('/api/gemini/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          stream: true,
          messages: [
            { role: 'system', content: systemInstruction },
            ...history,
            { role: 'user', content: input },
          ],
        }),
      });

      if (!response.ok) throw new Error(`Gemini 响应异常: ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
          try {
            const delta = JSON.parse(trimmed.slice(6)).choices?.[0]?.delta?.content ?? '';
            assistantContent += delta;
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: assistantContent }]);
          } catch { /* 忽略解析异常行 */ }
        }
      }
    } catch (error) {
      console.error('Chat simulation failed:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，对话模拟过程中出现了问题，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] font-sans animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Sidebar: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600 adventure-icon-active" />
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">模拟设置</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">选择区服</label>
                <select 
                  value={selectedProfileId} 
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">目标玩家</label>
                <select 
                  value={selectedPlayer} 
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- 请选择玩家 --</option>
                  {players.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={startNewSimulation}
                disabled={!selectedPlayer}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/10 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500 adventure-icon" />
                重新开始模拟
              </button>
            </div>
          </div>

          {activeProfile && selectedPlayer && activeProfile.persistentPortraits?.[selectedPlayer] && (
            <div className="bg-indigo-50/50 p-6 rounded-[32px] border border-indigo-100 space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-700">正在模拟与 {selectedPlayer} 的对话</h4>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">玩家特征</p>
                <p className="text-xs text-slate-600 italic">“{(activeProfile.persistentPortraits[selectedPlayer] as any).summary}”</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">GS 身份</p>
                <p className="text-xs text-slate-800 font-bold">{activeProfile.gsName || '系统默认'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl border border-indigo-600/20 flex items-center justify-center text-indigo-600 shadow-xl shadow-slate-200 adventure-icon-active group">
                <Sword className="w-5 h-5 group-hover:text-amber-500 transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">智能对话模拟器</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">AI 扮演 GS · 用户扮演玩家</p>
              </div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-indigo-500 animate-pulse">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">AI 思考中...</span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-10 space-y-6 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4">
                <Bot className="w-16 h-16 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-40">请在左侧选择玩家后开始模拟</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`flex gap-4 max-w-[80%] ${m.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      m.role === 'assistant' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
                    }`}>
                      {m.role === 'assistant' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div className={`p-6 rounded-[32px] text-sm leading-relaxed ${
                      m.role === 'assistant' 
                        ? 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100' 
                        : 'bg-indigo-50 text-indigo-900 rounded-tr-none border border-indigo-100'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-8 bg-slate-50/50 border-t border-slate-100">
            <div className="flex gap-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={selectedPlayer ? `作为玩家“${selectedPlayer}”向 GS 说话...` : "请先开始模拟..."}
                disabled={!selectedPlayer || isLoading}
                className="flex-1 px-8 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !selectedPlayer}
                className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 group"
              >
                <Send className="w-5 h-5 group-hover:scale-125 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
