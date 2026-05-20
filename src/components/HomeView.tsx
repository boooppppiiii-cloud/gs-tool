import React from 'react';
import { Users, BookOpen, Clock, Pencil, Check, X } from 'lucide-react';

import { ServerProfile } from '../types';

type PortraitData = {
  paymentHabits: string;
  personality: string;
  gameHabits: string;
  realLifePersona: string;
  summary: string;
};

interface Props {
  serverProfiles: ServerProfile[];
  onUpdatePortrait: (profileId: string, roleName: string, portrait: PortraitData) => void;
}

const EMPTY_FORM: PortraitData = { paymentHabits: '', personality: '', gameHabits: '', realLifePersona: '', summary: '' };

export default function HomeView({ serverProfiles, onUpdatePortrait }: Props) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<PortraitData>(EMPTY_FORM);

  const startEdit = (e: React.MouseEvent, profileId: string, roleName: string, portrait: any) => {
    e.stopPropagation();
    setEditingKey(`${profileId}-${roleName}`);
    setEditForm({
      paymentHabits: portrait.paymentHabits || '',
      personality: portrait.personality || '',
      gameHabits: portrait.gameHabits || '',
      realLifePersona: portrait.realLifePersona || '',
      summary: portrait.summary || '',
    });
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingKey(null);
  };

  const saveEdit = (e: React.MouseEvent, profileId: string, roleName: string) => {
    e.stopPropagation();
    onUpdatePortrait(profileId, roleName, editForm);
    setEditingKey(null);
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-700 font-sans pt-10">
      {serverProfiles.map(profile => {
        const portraits = Object.entries(profile.persistentPortraits || {});

        return (
          <section key={profile.id} className="space-y-8 pb-12 border-b border-slate-100 last:border-0">
            {/* Server Header */}
            <div className="space-y-4 px-2">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                {profile.name}
              </h2>
              {profile.serverEcology ? (
                <div className="max-w-3xl">
                  <p className="text-lg text-slate-500 font-medium leading-relaxed border-l-4 border-indigo-500 pl-6 py-2 bg-indigo-50/30 rounded-r-2xl">
                    {profile.serverEcology}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic opacity-50">暂无区服生态分析数据</p>
              )}
            </div>

            {/* Portraits Grid */}
            {portraits.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2 mb-6">
                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">重点玩家画像库</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {portraits.map(([roleName, p]) => {
                    const portrait = p as any;
                    const cardKey = `${profile.id}-${roleName}`;
                    const isExpanded = expandedId === cardKey;
                    const isEditing = editingKey === cardKey;

                    return (
                      <div
                        key={roleName}
                        className={`bg-white rounded-[40px] border transition-all duration-500 overflow-hidden cursor-pointer group ${
                          isExpanded
                            ? 'ring-4 ring-indigo-500/10 border-indigo-200 shadow-2xl col-span-full md:col-span-2 lg:col-span-2 p-10'
                            : 'border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 p-8'
                        }`}
                        onClick={() => !isEditing && setExpandedId(isExpanded ? null : cardKey)}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h4 className={`font-black text-slate-800 transition-colors ${isExpanded ? 'text-4xl mb-2' : 'text-xl group-hover:text-indigo-600'}`}>
                              {roleName}
                            </h4>
                            {isExpanded && (
                              <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest">
                                <Clock className="w-3 h-3" /> 最近更新：{new Date(portrait.lastUpdated).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          {!isExpanded && (
                            <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
                              点击查看详情
                            </div>
                          )}
                        </div>

                        {/* Summary */}
                        {isEditing ? (
                          <textarea
                            className="w-full text-sm text-slate-700 border border-indigo-200 rounded-2xl px-4 py-3 mb-8 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            rows={2}
                            placeholder="一句话总结（30字内）"
                            value={editForm.summary}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))}
                          />
                        ) : (
                          <p className={`text-slate-500 leading-relaxed italic border-indigo-100 mb-8 ${
                            isExpanded ? 'text-xl border-l-8 pl-8 py-4 bg-indigo-50/20 rounded-r-3xl' : 'text-sm border-l-4 pl-4 line-clamp-2'
                          }`}>
                            "{portrait.summary}"
                          </p>
                        )}

                        {/* Portrait Fields */}
                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            {([
                              { key: 'paymentHabits', label: '付费性格', color: 'blue' },
                              { key: 'personality',   label: '行为特征', color: 'purple' },
                              { key: 'gameHabits',    label: '游戏偏好', color: 'emerald' },
                              { key: 'realLifePersona', label: '现实身份', color: 'indigo' },
                            ] as const).map(({ key, label, color }) => (
                              <div key={key} className={`rounded-2xl border p-4 ${colorClass(color)}`}>
                                <p className="text-xs opacity-40 uppercase tracking-widest mb-2">{label}</p>
                                <textarea
                                  className="w-full bg-transparent text-sm text-slate-800 resize-none focus:outline-none"
                                  rows={3}
                                  value={editForm[key]}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={`grid gap-4 ${isExpanded ? 'grid-cols-2 mt-10' : 'grid-cols-2'}`}>
                            <PortraitTag label="付费性格" value={portrait.paymentHabits} color="blue" large={isExpanded} />
                            <PortraitTag label="行为特征" value={portrait.personality} color="purple" large={isExpanded} />
                            <PortraitTag label="游戏偏好" value={portrait.gameHabits} color="emerald" large={isExpanded} />
                            <PortraitTag label="现实身份" value={portrait.realLifePersona} color="indigo" large={isExpanded} />
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-10 pt-10 border-t border-slate-100 flex items-center justify-end gap-3">
                            {isEditing ? (
                              <>
                                <button
                                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-colors"
                                  onClick={cancelEdit}
                                >
                                  <X className="w-4 h-4" /> 取消
                                </button>
                                <button
                                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                  onClick={e => saveEdit(e, profile.id, roleName)}
                                >
                                  <Check className="w-4 h-4" /> 保存
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-colors"
                                  onClick={e => startEdit(e, profile.id, roleName, portrait)}
                                >
                                  <Pencil className="w-4 h-4" /> 编辑画像
                                </button>
                                <button
                                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                  onClick={e => { e.stopPropagation(); setExpandedId(null); }}
                                >
                                  收起详情
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );
      })}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10">
        <StatsCard title="分析区服指数" value="24" icon={<BookOpen className="w-6 h-6 text-indigo-600 adventure-icon" />} />
        <StatsCard title="活跃玩家画像" value="156" icon={<Users className="w-6 h-6 text-indigo-600 adventure-icon" />} />
        <StatsCard title="算法最近更新" value="2026-04-24" icon={<Clock className="w-6 h-6 text-indigo-600 adventure-icon" />} />
      </div>
    </div>
  );
}

function colorClass(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return map[color] || '';
}

function PortraitTag({ label, value, color, large }: { label: string, value: string, color: string, large?: boolean }) {
  return (
    <div className={`rounded-2xl border ${colorClass(color)} font-bold group/tag ${
      large ? 'p-6' : 'px-4 py-2 text-[10px]'
    }`}>
      <p className={`opacity-40 uppercase tracking-widest ${large ? 'text-xs mb-2' : 'mb-0.5'}`}>{label}</p>
      <p className={large ? 'text-lg text-slate-800' : 'truncate'}>{value}</p>
    </div>
  );
}

function StatsCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
      </div>
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}
