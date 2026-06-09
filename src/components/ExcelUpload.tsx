/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Upload, CheckCircle2, AlertTriangle as AlertTriangleIcon, Loader2,
  ImageIcon, X, Scan, Database, ChevronRight, ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ChatRecord, RechargeRecord } from '../types';
import { logUsage } from '../services/analyticsService';

// ── Internal types for image extraction ──────────────────────────────────────
interface GameMessage { roleName: string; content: string; chatType?: string }
interface WechatMessage { senderName: string; content: string }
type ExtractResult =
  | { type: 'game'; messages: GameMessage[] }
  | { type: 'wechat'; messages: WechatMessage[]; uniqueSenders: string[] }
  | { error: string }

interface Props {
  onDataLoaded: (chat: ChatRecord[], recharge: RechargeRecord[], fileName: string) => void;
  isAnalyzing: boolean;
}

type Mode = 'upload' | 'image' | 'db';

interface DbPingResult { ch?: string; mysql?: string; chError?: string; mysqlError?: string }
interface DbColumn { name: string; type: string }
interface DbExploreResult {
  clickhouse?: { databases?: string[]; tables?: Record<string, string[]>; error?: string };
  mysql?: { databases?: string[]; tables?: Record<string, string[]>; error?: string };
}

function parseCsvContent(text: string): ChatRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const records: ChatRecord[] = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return { time: cols[2] || '', roleName: cols[3] || '', type: cols[4] || '', content: cols[5] || '', target: cols[7] || '' };
  }).filter(r => r.roleName && r.content);
  records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return records;
}

export default function ExcelUpload({ onDataLoaded, isAnalyzing }: Props) {
  // ── Upload mode ────────────────────────────────────────────────────────────
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // ── Image mode ─────────────────────────────────────────────────────────────
  const [imgItems, setImgItems] = React.useState<{ file: File; dataUrl: string }[]>([]);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [imgError, setImgError] = React.useState<string | null>(null);
  // After extraction:
  const [gameMessages, setGameMessages] = React.useState<GameMessage[]>([]);
  const [wechatMessages, setWechatMessages] = React.useState<WechatMessage[]>([]);
  const [uniqueSenders, setUniqueSenders] = React.useState<string[]>([]);
  const [roleMapping, setRoleMapping] = React.useState<Record<string, string>>({});
  const [imgReady, setImgReady] = React.useState(false);

  // ── Mode ───────────────────────────────────────────────────────────────────
  const [mode, setMode] = React.useState<Mode>('upload');

  // ── Database mode ──────────────────────────────────────────────────────────
  const [dbPing, setDbPing] = React.useState<DbPingResult | null>(null);
  const [dbExplore, setDbExplore] = React.useState<DbExploreResult | null>(null);
  const [dbColumns, setDbColumns] = React.useState<{ engine: string; db: string; table: string; cols: DbColumn[] } | null>(null);
  const [dbLoading, setDbLoading] = React.useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());

  const toggleNode = (key: string) =>
    setExpandedNodes(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const handleDbPing = async () => {
    setDbLoading('ping');
    try {
      const res = await fetch('/api/db/ping');
      setDbPing(await res.json());
    } catch { setDbPing({ ch: 'error', mysql: 'error', chError: '无法连接服务器', mysqlError: '无法连接服务器' }); }
    setDbLoading(null);
  };

  const handleDbExplore = async () => {
    setDbLoading('explore');
    try {
      const res = await fetch('/api/db/explore');
      setDbExplore(await res.json());
    } catch { setDbExplore(null); }
    setDbLoading(null);
  };

  const handleDbDescribe = async (engine: string, database: string, table: string) => {
    setDbLoading(`${engine}/${database}/${table}`);
    try {
      const res = await fetch('/api/db/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, database, table }),
      });
      const data = await res.json();
      setDbColumns({ engine, db: database, table, cols: data.columns || [] });
    } catch { setDbColumns(null); }
    setDbLoading(null);
  };

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadError(null);
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
      setUploadError('文件解析失败，请确认格式正确（Excel: Sheet1聊天/Sheet2充值；CSV: 逗号分隔聊天记录）');
    }
  };

  // ── Image handlers ─────────────────────────────────────────────────────────
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setImgItems(prev => [...prev, { file, dataUrl: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImgItems(prev => prev.filter((_, i) => i !== idx));
    // Reset extraction results when images change
    setGameMessages([]);
    setWechatMessages([]);
    setUniqueSenders([]);
    setRoleMapping({});
    setImgReady(false);
    setImgError(null);
  };

  const handleExtract = async () => {
    if (imgItems.length === 0) return;
    setIsExtracting(true);
    setImgError(null);
    setGameMessages([]);
    setWechatMessages([]);
    setUniqueSenders([]);
    setImgReady(false);

    const allGame: GameMessage[] = [];
    const allWechat: WechatMessage[] = [];
    const senderSet = new Set<string>();
    const errors: string[] = [];

    for (const { file, dataUrl } of imgItems) {
      try {
        const base64 = dataUrl.split(',')[1];
        const mimeType = file.type || 'image/jpeg';
        const res = await fetch('/api/image/extract-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result: ExtractResult = await res.json();
        if ('error' in result) throw new Error(result.error);
        if (result.type === 'game') {
          allGame.push(...result.messages);
        } else {
          allWechat.push(...result.messages);
          result.uniqueSenders.forEach(s => senderSet.add(s));
        }
      } catch (err: any) {
        errors.push(`「${file.name}」: ${err.message}`);
      }
    }

    setGameMessages(allGame);
    setWechatMessages(allWechat);
    const senders = Array.from(senderSet);
    setUniqueSenders(senders);
    setRoleMapping(Object.fromEntries(senders.map(s => [s, ''])));

    if (errors.length > 0) setImgError(errors.join('；'));

    // If only game messages (no wechat), load immediately
    if (allWechat.length === 0 && allGame.length > 0) {
      const records = allGame.map(m => ({
        time: '', roleName: m.roleName, type: m.chatType || '世界', content: m.content, target: '',
      } as ChatRecord));
      onDataLoaded(records, [], '图片识别');
      setImgReady(true);
      logUsage('image_extract', `game mode, ${records.length} records`);
    }

    setIsExtracting(false);
  };

  const handleConfirmMapping = () => {
    const records: ChatRecord[] = [
      ...gameMessages.map(m => ({
        time: '', roleName: m.roleName, type: m.chatType || '世界', content: m.content, target: '',
      } as ChatRecord)),
      ...wechatMessages.map(m => ({
        time: '', roleName: roleMapping[m.senderName]?.trim() || m.senderName,
        type: '微信', content: m.content, target: '',
      } as ChatRecord)).filter(r => r.roleName),
    ];
    onDataLoaded(records, [], '图片识别');
    setImgReady(true);
    logUsage('image_extract', `wechat mode, ${records.length} records`);
  };

  const needsMapping = wechatMessages.length > 0 && !imgReady;
  const totalExtracted = gameMessages.length + wechatMessages.length;

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
          onClick={() => setMode('image')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
            mode === 'image' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> 图片识别
        </button>
        <button
          onClick={() => setMode('db')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
            mode === 'db' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> 数据库
        </button>
      </div>

      {/* ── Upload mode ──────────────────────────────────────────────────────── */}
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
                  {fileName && !uploadError && (
                    <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>数据已就绪，点击下方按钮开始分析</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {uploadError && (
            <div className="mt-4 flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-lg text-sm">
              <AlertTriangleIcon className="w-4 h-4" /> {uploadError}
            </div>
          )}
          <div className="mt-6 grid grid-cols-3 gap-4 text-xs text-slate-400">
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /><p>Sheet1: C时间, D角色, E类型, F内容, H目标</p></div>
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /><p>Sheet2: B金额, C角色, G状态, H方式</p></div>
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /><p>CSV: 文件名为区服名，仅含聊天记录</p></div>
          </div>
        </div>
      )}

      {/* ── Image mode ───────────────────────────────────────────────────────── */}
      {mode === 'image' && (
        <div className="p-5 space-y-4">
          {/* Drop zone */}
          {!isExtracting && !needsMapping && (
            <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-indigo-300 transition-colors group">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagePick}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isAnalyzing}
              />
              <div className="flex flex-col items-center gap-2 pointer-events-none">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <ImageIcon className="w-6 h-6 text-indigo-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">点击或拖拽上传聊天截图</p>
                <p className="text-xs text-slate-400">支持游戏内截图 / 微信截图 / 文字截图，可多选</p>
              </div>
            </div>
          )}

          {/* Thumbnails */}
          {imgItems.length > 0 && !isExtracting && !needsMapping && !imgReady && (
            <div className="grid grid-cols-3 gap-2">
              {imgItems.map(({ file, dataUrl }, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50">
                  <img src={dataUrl} alt={file.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-slate-800/70 hover:bg-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <p className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1 py-0.5 truncate">{file.name}</p>
                </div>
              ))}
            </div>
          )}

          {/* Extracting */}
          {isExtracting && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <p className="text-sm font-bold text-slate-600">AI 正在识别聊天内容...</p>
              <p className="text-xs text-slate-400">共 {imgItems.length} 张图片</p>
            </div>
          )}

          {/* WeChat mapping UI */}
          {needsMapping && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-bold">
                <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                检测到微信/通讯软件聊天记录，请填写每位发言者对应的游戏角色名
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {uniqueSenders.map(sender => (
                  <div key={sender} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-bold text-slate-700 min-w-0 flex-1 truncate" title={sender}>{sender}</span>
                    <span className="text-slate-300 text-sm shrink-0">→</span>
                    <input
                      type="text"
                      placeholder="游戏角色名"
                      value={roleMapping[sender] ?? ''}
                      onChange={e => setRoleMapping(prev => ({ ...prev, [sender]: e.target.value }))}
                      className="w-32 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white shrink-0"
                    />
                  </div>
                ))}
              </div>
              {gameMessages.length > 0 && (
                <p className="text-[10px] text-slate-400 px-1">同时识别到 {gameMessages.length} 条游戏截图聊天，将自动合并</p>
              )}
              <button
                onClick={handleConfirmMapping}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                确认并加载（{totalExtracted} 条聊天）
              </button>
            </div>
          )}

          {/* Ready state */}
          {imgReady && (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              已加载 {gameMessages.length + wechatMessages.length} 条聊天记录 — 点击下方按钮开始分析
            </div>
          )}

          {/* Error */}
          {imgError && (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
              <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {imgError}
            </div>
          )}

          {/* Extract button */}
          {!isExtracting && !needsMapping && !imgReady && imgItems.length > 0 && (
            <button
              onClick={handleExtract}
              disabled={isAnalyzing}
              className="w-full py-2.5 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Scan className="w-4 h-4" />
              开始识别（{imgItems.length} 张图片）
            </button>
          )}
          {!isExtracting && !needsMapping && !imgReady && imgItems.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-2">上传截图后点击识别，AI 将自动提取聊天记录</p>
          )}
        </div>
      )}

      {/* ── Database mode ────────────────────────────────────────────────────── */}
      {mode === 'db' && (
        <div className="p-5 space-y-4">

          {/* 连接测试 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest">连接状态</p>
              <button
                onClick={handleDbPing}
                disabled={dbLoading === 'ping'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {dbLoading === 'ping' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                测试连接
              </button>
            </div>
            {dbPing && (
              <div className="grid grid-cols-2 gap-2">
                {(['ch', 'mysql'] as const).map(eng => {
                  const ok = dbPing[eng] === 'ok';
                  const err = eng === 'ch' ? dbPing.chError : dbPing.mysqlError;
                  return (
                    <div key={eng} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="min-w-0">
                        <p className="font-black text-slate-700">{eng === 'ch' ? 'ClickHouse :8123' : 'MySQL :3306'}</p>
                        <p className={ok ? 'text-emerald-600' : 'text-rose-600'}>{ok ? '连接正常' : (err || '连接失败')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!dbPing && (
              <p className="text-[11px] text-slate-400 leading-relaxed px-1">先在项目根目录的 <code className="bg-slate-100 px-1 rounded">.env</code> 文件中填写数据库连接信息，再点击「测试连接」</p>
            )}
          </div>

          {/* 浏览表结构 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest">数据库结构</p>
              <button
                onClick={handleDbExplore}
                disabled={!!dbLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                {dbLoading === 'explore' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                浏览所有表
              </button>
            </div>

            {dbExplore && (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                {(['clickhouse', 'mysql'] as const).map(eng => {
                  const info = dbExplore[eng];
                  if (!info) return null;
                  const label = eng === 'clickhouse' ? 'ClickHouse' : 'MySQL';
                  const color = eng === 'clickhouse' ? 'text-amber-700 bg-amber-50' : 'text-blue-700 bg-blue-50';
                  return (
                    <div key={eng} className="border-b border-slate-100 last:border-0">
                      <button onClick={() => toggleNode(eng)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left">
                        {expandedNodes.has(eng) ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${color}`}>{label}</span>
                        {info.error && <span className="text-rose-500 text-[10px] ml-1">{info.error}</span>}
                      </button>
                      {expandedNodes.has(eng) && info.tables && Object.entries(info.tables).map(([db, tables]) => (
                        <div key={db} className="pl-4 border-t border-slate-50">
                          <button onClick={() => toggleNode(`${eng}/${db}`)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-left">
                            {expandedNodes.has(`${eng}/${db}`) ? <ChevronDown className="w-3 h-3 text-slate-300 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
                            <Database className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-700">{db}</span>
                            <span className="text-slate-400">({(tables as string[]).length} 张表)</span>
                          </button>
                          {expandedNodes.has(`${eng}/${db}`) && (tables as string[]).map(tbl => (
                            <button
                              key={tbl}
                              onClick={() => handleDbDescribe(eng === 'clickhouse' ? 'ch' : 'mysql', db, tbl)}
                              disabled={dbLoading === `${eng === 'clickhouse' ? 'ch' : 'mysql'}/${db}/${tbl}`}
                              className="w-full flex items-center gap-2 pl-10 pr-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 text-left text-slate-600 disabled:opacity-50 transition-colors"
                            >
                              {dbLoading === `${eng === 'clickhouse' ? 'ch' : 'mysql'}/${db}/${tbl}`
                                ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                : <ChevronRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100" />}
                              {tbl}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 表字段详情 */}
          {dbColumns && (
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest">
                字段结构：{dbColumns.db}.{dbColumns.table}
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider w-1/2">字段名</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbColumns.cols.map(col => (
                      <tr key={col.name} className="border-b border-slate-50 last:border-0 hover:bg-indigo-50/50">
                        <td className="px-3 py-2 font-mono font-bold text-indigo-700">{col.name}</td>
                        <td className="px-3 py-2 text-slate-500">{col.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed px-1 bg-amber-50 border border-amber-100 rounded-lg p-3">
                <span className="font-bold text-amber-700">下一步：</span> 记录下聊天记录所在的表名和字段名（时间、角色名、消息类型、内容），以及充值记录所在的表名和字段名（金额、角色名、状态），告知开发者后即可实现一键导入数据。
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
