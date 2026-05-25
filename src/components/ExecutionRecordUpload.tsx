import React from 'react';
import { Upload, X, FileText, Image as ImageIcon, Calendar, Tag } from 'lucide-react';
import { ExecutionRecord } from '../types';

interface Props {
  outburstIndex: number;
  playerName: string;
  outburstTitle: string;
  existing?: ExecutionRecord;
  onChange: (index: number, data: Partial<ExecutionRecord>) => void;
}

export default function ExecutionRecordUpload({ outburstIndex, playerName, outburstTitle, existing, onChange }: Props) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [category, setCategory] = React.useState<'待推进' | '已解决'>(existing?.category ?? '待推进');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [attachments, setAttachments] = React.useState<{ name: string; type: string; dataUrl: string }[]>(existing?.attachments ?? []);
  const dateStr = existing?.date ?? new Date().toLocaleDateString('zh-CN');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const notify = (patch: Partial<ExecutionRecord>) => {
    onChange(outburstIndex, {
      category,
      description,
      attachments,
      date: dateStr,
      ...patch,
    });
  };

  const handleCategoryChange = (v: '待推进' | '已解决') => {
    setCategory(v);
    notify({ category: v });
  };

  const handleDescriptionChange = (v: string) => {
    setDescription(v);
    notify({ description: v });
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const next = [...attachments, { name: file.name, type: file.type, dataUrl }];
        setAttachments(next);
        notify({ attachments: next });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (i: number) => {
    const next = attachments.filter((_, idx) => idx !== i);
    setAttachments(next);
    notify({ attachments: next });
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${category === '已解决' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-sm font-bold text-slate-700 truncate">{playerName}</span>
          <span className="text-xs text-slate-400 truncate hidden sm:block">{outburstTitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            category === '已解决' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {category}
          </span>
          <span className="text-xs text-slate-400">{isExpanded ? '收起' : '填写记录'}</span>
        </div>
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/40">
          {/* Category + Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Tag className="w-3 h-3" /> 分类
              </label>
              <select
                value={category}
                onChange={e => handleCategoryChange(e.target.value as '待推进' | '已解决')}
                className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="待推进">待推进</option>
                <option value="已解决">已解决</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 记录日期
              </label>
              <div className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white text-slate-500">
                {dateStr}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">解决过程描述</label>
            <textarea
              value={description}
              onChange={e => handleDescriptionChange(e.target.value)}
              placeholder="描述处置过程、沟通情况、玩家反馈等..."
              rows={4}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">附件上传</label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="relative group flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                  {att.type.startsWith('image/') ? (
                    <>
                      <img src={att.dataUrl} alt={att.name} className="w-8 h-8 object-cover rounded" />
                      <span className="text-slate-600 max-w-[80px] truncate font-medium">{att.name}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600 max-w-[80px] truncate font-medium">{att.name}</span>
                    </>
                  )}
                  <button
                    onClick={() => removeAttachment(i)}
                    className="ml-1 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors bg-white"
              >
                <Upload className="w-3.5 h-3.5" />
                添加附件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.txt,.doc,.docx"
                onChange={handleFiles}
                className="hidden"
              />
            </div>
            <p className="text-[10px] text-slate-400">支持图片、PDF、Word、TXT，文件以 Base64 存储于本地</p>
          </div>
        </div>
      )}
    </div>
  );
}
