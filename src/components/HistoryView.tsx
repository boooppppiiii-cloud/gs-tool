/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Scroll as CalendarIcon,
  ChevronRight,
  Trash2,
  FileText,
  Hammer as Server,
  Shield as Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
} from 'lucide-react';
import { MonthHistory, HistoryRecord } from '../types';

interface Props {
  history: MonthHistory[];
  onSelect: (record: HistoryRecord) => void;
  onDelete: (month: string, id: string) => void;
}

export default function HistoryView({ history, onSelect, onDelete }: Props) {
  const [expandedMonths, setExpandedMonths] = React.useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadCsv = async (id: string, filename: string) => {
    setDownloading(id);
    try {
      const res = await fetch('/api/db/getDoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'chat_csv_files', id }),
      });
      const { data } = await res.json();
      if (!data?.content) return;
      const blob = new Blob([data.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]);
  };

  return (
    <div className="space-y-10">
      {/* ── 专家分析存档 ─────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-base font-black text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" /> 专家分析存档
        </h3>
        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-amber-50 border border-amber-200/60 rounded-full flex items-center justify-center mx-auto mb-4 adventure-icon shadow-lg shadow-amber-100">
              <Clock className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">暂无历史记录</h3>
            <p className="text-slate-500 mt-2">完成分析后，结果将自动保存至后端存储。</p>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((monthGroup) => (
              <div key={monthGroup.month} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleMonth(monthGroup.month)}
                  className="w-full px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-indigo-600 adventure-icon" />
                    <span className="font-black text-slate-800 uppercase tracking-tight">{monthGroup.month}</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full uppercase">
                      {monthGroup.records.length} 份档案
                    </span>
                  </div>
                  {expandedMonths.includes(monthGroup.month) ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {expandedMonths.includes(monthGroup.month) && (
                  <div className="divide-y divide-slate-100">
                    {monthGroup.records.map((record) => (
                      <div key={record.id} className="group flex items-center justify-between p-4 hover:bg-indigo-50/30 transition-colors">
                        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => onSelect(record)}>
                          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 truncate">{record.serverConfig.name || '未命名区服'}</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                {new Date(record.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Server className="w-3 h-3" /> {record.serverConfig.openingDate || '未知日期'}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Users className="w-3 h-3" /> {record.serverConfig.keyPlayers?.length ?? 0} 名重点玩家
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {record.hasCsv && (
                            <button
                              onClick={() => downloadCsv(record.id, `chat_${record.serverConfig?.name ?? record.id}_${record.timestamp.slice(0, 10)}.csv`)}
                              disabled={downloading === record.id}
                              className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                              title="下载原始 CSV"
                            >
                              {downloading === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => onSelect(record)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="查看报告">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <button onClick={() => onDelete(monthGroup.month, record.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="删除记录">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
