/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Scroll as Calendar, 
  ChevronRight, 
  Trash2, 
  FileText, 
  Hammer as Server, 
  Shield as Users,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MonthHistory, HistoryRecord } from '../types';

interface Props {
  history: MonthHistory[];
  onSelect: (record: HistoryRecord) => void;
  onDelete: (month: string, id: string) => void;
}

export default function HistoryView({ history, onSelect, onDelete }: Props) {
  const [expandedMonths, setExpandedMonths] = React.useState<string[]>([]);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => 
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  if (history.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 adventure-icon shadow-lg shadow-indigo-600/10">
          <Clock className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">暂无历史记录</h3>
        <p className="text-slate-500 mt-2">完成分析后，结果将自动保存至后端存储。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {history.map((monthGroup) => (
        <div key={monthGroup.month} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleMonth(monthGroup.month)}
            className="w-full px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600 adventure-icon" />
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
                          <Users className="w-3 h-3" /> {record.serverConfig.keyPlayers.length} 名重点玩家
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onSelect(record)}
                      className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="查看报告"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => { onDelete(monthGroup.month, record.id); }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="删除记录"
                    >
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
  );
}
