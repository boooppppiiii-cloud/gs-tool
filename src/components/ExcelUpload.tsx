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

    const isCsv = file.name.toLowerCase().endsWith('.csv');
    setFileName(file.name);
    setError(null);

    try {
      logUsage('excel_upload', `Started processing ${file.name}`);

      let chatRecords: ChatRecord[];
      let rechargeRecords: RechargeRecord[];

      if (isCsv) {
        // Tab-delimited CSV: columns [2]=时间, [3]=角色名, [4]=聊天类型, [5]=聊天内容, [6]=目标帐号
        const text = await file.text();
        const rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t'));

        chatRecords = rows.slice(1).map(row => ({
          time:     String(row[2] || '').trim(),
          roleName: String(row[3] || '').trim(),
          type:     String(row[4] || '').trim(),
          content:  String(row[5] || '').trim(),
          target:   String(row[6] || '').trim()
        })).filter(r => r.roleName && r.content);

        rechargeRecords = [];
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);

        // Sheet 1: Chat Logs — C列时间、D列角色名、E列类型、F列内容、H列目标
        const chatSheet = workbook.Sheets[workbook.SheetNames[0]];
        const chatJson = XLSX.utils.sheet_to_json<any>(chatSheet, { header: 'A' });

        chatRecords = chatJson.slice(1).map(row => ({
          time:     String(row.C || ''),
          roleName: String(row.D || ''),
          type:     String(row.E || ''),
          content:  String(row.F || ''),
          target:   String(row.H || '')
        })).filter(r => r.roleName && r.content);

        // Sheet 2: Recharge — B列金额/礼包、C列角色名、G列状态、H列方式
        const rechargeSheet = workbook.Sheets[workbook.SheetNames[1]];
        const rechargeJson = XLSX.utils.sheet_to_json<any>(rechargeSheet, { header: 'A' });

        rechargeRecords = rechargeJson.slice(1).map(row => ({
          amount:   String(row.B || ''),
          roleName: String(row.C || ''),
          status:   String(row.G || ''),
          method:   String(row.H || '')
        })).filter(r => r.roleName);
      }

      chatRecords.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      // For CSV, strip extension so the bare filename serves as server/region name
      const displayName = isCsv ? file.name.replace(/\.csv$/i, '') : file.name;
      onDataLoaded(chatRecords, rechargeRecords, displayName);
    } catch (err) {
      console.error(err);
      setError(isCsv
        ? 'CSV 文件解析失败，请确保文件为制表符分隔格式，包含标准聊天记录列'
        : '文件解析失败，请确保格式符合要求（Sheet1: 聊天, Sheet2: 充值）'
      );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10 transition-colors hover:border-indigo-300 group relative">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
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
                  支持 .xlsx, .xls, .csv 格式 | CSV 文件以文件名作为区服名称
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
          <p>Excel Sheet1: C时间, D角色, E类型, F内容, H目标</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" />
          <p>Excel Sheet2: B金额, C角色, G状态, H方式</p>
        </div>
        <div className="flex items-start gap-2 col-span-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" />
          <p>CSV（制表符分隔）: 角色ID, 帐号, 时间, 角色名, 聊天类型, 聊天内容, 目标帐号, 目标角色, 历史IP, 当前IP</p>
        </div>
      </div>
    </div>
  );
}
