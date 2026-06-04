import React, { useState } from 'react';
import { Crown, Zap, CheckCircle2, Save } from 'lucide-react';
import { PlayerBehaviorReport } from '../types';

function PortraitDetail({ title, content, color }: { title: string; content: string; color: string }) {
  return (
    <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-500">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${color}`}>
        {title}
      </span>
      <p className="text-sm text-slate-600 leading-snug">{content}</p>
    </div>
  );
}

interface Props {
  player: PlayerBehaviorReport;
  serverName?: string;
  onUpdatePortrait?: (roleName: string, updates: Record<string, string>) => void;
}

const PortraitTableCard = React.memo(function PortraitTableCard({ player, onUpdatePortrait }: Props) {
  const pt = player.portraitTable;
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const EDITABLE_LABELS = new Set(['职业']);

  const handleEditChange = (label: string, value: string) => {
    setEditValues(prev => ({ ...prev, [label]: value }));
    setSaveState('idle');
  };

  const handleSave = () => {
    if (!onUpdatePortrait) return;
    const updates: Record<string, string> = {};
    if ('职业' in editValues) updates.occupation = editValues['职业'];
    onUpdatePortrait(player.roleName, updates);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  };

  if (!pt) {
    return (
      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="px-8 py-6 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-indigo-500" />
            <h4 className="text-lg font-black text-slate-900">{player.roleName}</h4>
          </div>
          <p className="text-sm text-slate-600 italic mt-2 pl-8 leading-relaxed">{player.portrait.summary}</p>
        </div>
        <div className="p-8 grid grid-cols-2 gap-4">
          <PortraitDetail title="付费习惯" content={player.portrait.paymentHabits} color="bg-emerald-50 text-emerald-700" />
          <PortraitDetail title="性格特征" content={player.portrait.personality} color="bg-violet-50 text-violet-700" />
          <PortraitDetail title="游戏习惯" content={player.portrait.gameHabits} color="bg-blue-50 text-blue-700" />
          <PortraitDetail title="现实人设" content={player.portrait.realLifePersona} color="bg-amber-50 text-amber-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 py-6 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Crown className="w-5 h-5 text-indigo-500 shrink-0" />
            <h4 className="text-lg font-black text-slate-900">{player.roleName}</h4>
            {pt.isKeyPlayer && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-black rounded-full">
                <Zap className="w-3 h-3" /> 重点玩家 ≥500元
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">画像完成度</p>
            <p className="text-2xl font-black text-indigo-600">{Math.round(pt.overallCompletion * 100)}%</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 italic mt-2 pl-8 leading-relaxed">{player.portrait.summary}</p>
      </div>

      {/* Basic data */}
      <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap gap-6 items-start text-sm">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">累计充值</p>
            <p className="font-black text-indigo-600">¥{pt.basicData.totalRecharge.toLocaleString()}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">近期活跃</p>
            <p className="text-slate-700 text-xs leading-relaxed">{pt.basicData.recentActivity}</p>
          </div>
          {pt.basicData.anomalySignals && pt.basicData.anomalySignals !== '无' && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">异常信号</p>
              <p className="text-rose-700 text-xs leading-relaxed">{pt.basicData.anomalySignals}</p>
            </div>
          )}
        </div>
      </div>

      {/* Portrait table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-24">维度</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-28">信息词条</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">玩家具体信息</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">信息依据</th>
              <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-20">是否获取到</th>
              <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">画像完成度</th>
            </tr>
          </thead>
          <tbody>
            {pt.dimensions.map(dim =>
              dim.items.map((item, itemIdx) => (
                <tr key={`${dim.name}-${item.label}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {itemIdx === 0 && (
                    <td rowSpan={dim.items.length} className="px-4 py-3 align-middle border-r border-slate-200 bg-slate-50/30">
                      <span className="inline-block px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg leading-tight text-center">
                        {dim.name.replace(/^维度[一二三四五六七八九十]：/, '')}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-bold text-slate-700 border-r border-slate-100">
                    {item.label}
                    {EDITABLE_LABELS.has(item.label) && (
                      <span className="ml-1 text-[8px] text-indigo-400 font-bold align-middle">✎</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-100">
                    {EDITABLE_LABELS.has(item.label) && onUpdatePortrait ? (
                      <input
                        type="text"
                        value={editValues[item.label] ?? (item.obtained ? item.value : '')}
                        onChange={e => handleEditChange(item.label, e.target.value)}
                        placeholder={item.obtained ? item.value : '手动填写…'}
                        className="w-full px-2 py-1 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-indigo-50/30 placeholder:text-slate-300"
                      />
                    ) : (
                      <span className={item.obtained && item.value ? 'text-slate-700' : 'text-slate-300 italic'}>
                        {item.value || '数据中无记录'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 border-r border-slate-100 leading-relaxed">
                    {item.evidence || '—'}
                  </td>
                  <td className="px-4 py-3 text-center border-r border-slate-100">
                    {item.obtained ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black">✓</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 text-slate-400 rounded-full text-[10px]">—</span>
                    )}
                  </td>
                  {itemIdx === 0 && (
                    <td rowSpan={dim.items.length} className="px-4 py-3 text-center align-middle">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-base font-black text-indigo-600">
                          {Math.round(dim.completionRate * 100)}%
                        </span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full"
                            style={{ width: `${Math.round(dim.completionRate * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Save button for editable fields */}
      {Object.keys(editValues).length > 0 && onUpdatePortrait && (
        <div className="px-8 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              saveState === 'saved'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {saveState === 'saved' ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> 已保存</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> 保存画像补充</>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

export default PortraitTableCard;
