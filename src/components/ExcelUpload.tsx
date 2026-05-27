/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle as AlertTriangleIcon, Loader2, Database, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ChatRecord, RechargeRecord, CrawlerChatRecord } from '../types';
import { logUsage } from '../services/analyticsService';

interface Props {
  onDataLoaded: (chat: ChatRecord[], recharge: RechargeRecord[], fileName: string) => void;
  isAnalyzing: boolean;
  crawlerLogs?: CrawlerChatRecord[];
}

type Mode = 'upload' | 'crawler';

function parseCsvContent(text: string): ChatRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const records: ChatRecord[] = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return { time: cols[2] || '', roleName: cols[3] || '', type: cols[4] || '', content: cols[5] || '', target: cols[7] || '' };
  }).filter(r => r.roleName && r.content);
  records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return records;
}

export default function ExcelUpload({ onDataLoaded, isAnalyzing, crawlerLogs = [] }: Props) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>('upload');
  const [loadingCrawlId, setLoadingCrawlId] = React.useState<string | null>(null);
  const [selectedCrawlId, setSelectedCrawlId] = React.useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    try {
      logUsage('excel_upload', `Started processing ${file.name}`);
      if (isCSV) {
        const text = await file.text();
        const chatRecords = parseCsvContent(text);
        onDataLoaded(chatRecords, [], file.name);
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const chatSheet = workbook.Sheets[workbook.SheetNames[0]];
        const chatJson = XLSX.utils.sheet_to_json<any>(chatSheet, { header: 'A' });
        const chatRecords: ChatRecord[] = chatJson.slice(1).map(row => ({
          time: String(row.C || ''), roleName: String(row.D || ''), type: String(row.E || ''),
          content: String(row.F || ''), target: String(row.H || ''),
        })).filter(r => r.roleName && r.content);
        chatRecords.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        const rechargeSheet = workbook.Sheets[workbook.SheetNames[1]];
        const rechargeJson = XLSX.utils.sheet_to_json<any>(rechargeSheet, { header: 'A' });
        const rechargeRecords: RechargeRecord[] = rechargeJson.slice(1).map(row => ({
          amount: String(row.B || ''), roleName: String(row.C || ''), status: String(row.G || ''), method: String(row.H || ''),
        })).filter(r => r.roleName);
        onDataLoaded(chatRecords, rechargeRecords, file.name);
      }
    } catch (err) {
      console.error(err);
      setError('文件解析失败，请确认格式正确（Excel: Sheet1聊天/Sheet2充值；CSV: 逗号分隔聊天记录）');
    }
  };

  const handleSelectCrawlerLog = async (log: CrawlerChatRecord) => {
    setLoadingCrawlId(log.id);
    setError(null);
    try {
      const res = await fetch('/api/db/getDoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'chat_csv_files', id: log.csvFileId }),
      });
      const { data } = await res.json();
      if (!data?.content) throw new Error('CSV 内容为空');
      const chatRecords = parseCsvContent(data.content);
      setSelectedCrawlId(log.id);
      setFileName(`${log.serverName} · ${new Date(log.crawlStart).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → ${new Date(log.crawlEnd).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);
      onDataLoaded(chatRecords, [], log.serverName);
      logUsage('crawler_log_selected', `server=${log.serverName} rows=${log.rowCount}`);
    } catch (err) {
      console.error(err);
      setError('爬虫记录加载失败，请重试');
    } finally {
      setLoadingCrawlId(null);
    }
  };

  // Group logs by month for display
  const logsByMonth = React.useMemo(() => {
    const groups: { month: string; logs: CrawlerChatRecord[] }[] = [];
    const seen = new Map<string, CrawlerChatRecord[]>();
    crawlerLogs.forEach(l => {
      const m = l.timestamp.slice(0, 7);
      if (!seen.has(m)) seen.set(m, []);
      seen.get(m)!.push(l);
    });
    seen.forEach((logs, month) => groups.push({ month, logs }));
    groups.sort((a, b) => b.month.localeCompare(a.month));
    return groups;
  }, [crawlerLogs]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Mode tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
            mode === 'upload' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> 上传文件
        </button>
        <button
          onClick={() => setMode('crawler')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
            mode === 'crawler' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> 爬虫记录
          {crawlerLogs.length > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] leading-none">{crawlerLogs.length}</span>
          )}
        </button>
      </div>

      {mode === 'upload' && (
        <div className="p-8">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10 transition-colors hover:border-indigo-300 group relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isAnalyzing}
            />
            <div className="flex flex-col items-center gap-4 w-full">
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-800">专家正在深度分析数据...</p>
                    <p className="text-sm text-slate-500">正在识别玩家心理、付费潜力及流失风险</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-amber-50 border border-amber-200/60 rounded-full flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors adventure-icon shadow-lg shadow-indigo-600/10">
                    <Upload className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-800">
                      {fileName ? fileName : '上传 Excel 数据文件'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">支持 .xlsx / .xls / .csv 格式 | CSV 文件名即为区服名称</p>
                  </div>
                  {fileName && !error && (
                    <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>数据已就绪，点击下方按钮开始分析</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-lg text-sm">
              <AlertTriangleIcon className="w-4 h-4" /> {error}
            </div>
          )}
          <div className="mt-6 grid grid-cols-3 gap-4 text-xs text-slate-400">
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /><p>Sheet1: C时间, D角色, E类型, F内容, H目标</p></div>
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /><p>Sheet2: B金额, C角色, G状态, H方式</p></div>
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /><p>CSV: 文件名为区服名，仅含聊天记录</p></div>
          </div>
        </div>
      )}

      {mode === 'crawler' && (
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {crawlerLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Database className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-500">暂无爬虫记录</p>
              <p className="text-xs text-slate-400">完成一次「立即爬取」后记录将自动出现在此处</p>
            </div>
          ) : (
            <>
              {selectedCrawlId && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  已加载：{fileName} — 点击下方按钮开始分析
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                  <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
              )}
              {logsByMonth.map(({ month, logs }) => (
                <div key={month} className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{month}</p>
                  {logs.map(log => (
                    <button
                      key={log.id}
                      onClick={() => handleSelectCrawlerLog(log)}
                      disabled={!!loadingCrawlId || isAnalyzing}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                        selectedCrawlId === log.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-slate-50 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">{log.serverName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">{log.rowCount.toLocaleString()} 条</span>
                          {selectedCrawlId === log.id && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {new Date(log.crawlStart).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {new Date(log.crawlEnd).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {loadingCrawlId === log.id ? (
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 -rotate-90" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
