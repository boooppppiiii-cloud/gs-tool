/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle as AlertTriangleIcon, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ChatRecord, RechargeRecord } from '../types';
import { logUsage } from '../services/analyticsService';

interface Props {
  onDataLoaded: (chat: ChatRecord[], recharge: RechargeRecord[], fileName: string) => void;
  isAnalyzing: boolean;
}

export default function ExcelUpload({ onDataLoaded, isAnalyzing }: Props) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    try {
      logUsage('excel_upload', `Started processing ${file.name}`);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // Sheet 1: Chat Logs
      const chatSheet = workbook.Sheets[workbook.SheetNames[0]];
      const chatJson = XLSX.utils.sheet_to_json<any>(chatSheet, { header: 'A' });
      
      // Map columns based on user request: C列时间、D列角色名、E列类型、F列内容、H列目标
      const chatRecords: ChatRecord[] = chatJson.slice(1).map(row => ({
        time: String(row.C || ''),
        roleName: String(row.D || ''),
        type: String(row.E || ''),
        content: String(row.F || ''),
        target: String(row.H || '')
      })).filter(r => r.roleName && r.content);

      // Sort by time
      chatRecords.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      // Sheet 2: Recharge
      const rechargeSheet = workbook.Sheets[workbook.SheetNames[1]];
      const rechargeJson = XLSX.utils.sheet_to_json<any>(rechargeSheet, { header: 'A' });

      // Map columns: B列金额/礼包、C列角色名、G列状态、H列方式
      const rechargeRecords: RechargeRecord[] = rechargeJson.slice(1).map(row => ({
        amount: String(row.B || ''),
        roleName: String(row.C || ''),
        status: String(row.G || ''),
        method: String(row.H || '')
      })).filter(r => r.roleName);

      onDataLoaded(chatRecords, rechargeRecords, file.name);
    } catch (err) {
      console.error(err);
      setError('文件解析失败，请确保格式符合要求（Sheet1: 聊天, Sheet2: 充值）');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10 transition-colors hover:border-indigo-300 group relative">
        <input
          type="file"
          accept=".xlsx, .xls"
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
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 group-hover:bg-slate-800 transition-colors adventure-icon shadow-lg shadow-indigo-600/10">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-800">
                  <span>{fileName ? fileName : '上传 Excel 数据文件'}</span>
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  支持 .xlsx, .xls 格式 | 必须包含聊天记录与充值记录两个 Sheet
                </p>
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
          <AlertTriangleIcon className="w-4 h-4 adventure-icon" />
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-slate-400">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" />
          <p>Sheet1: C时间, D角色, E类型, F内容, H目标</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" />
          <p>Sheet2: B金额, C角色, G状态, H方式</p>
        </div>
      </div>
    </div>
  );
}
