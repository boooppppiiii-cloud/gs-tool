import React from 'react';
import { Users, Clock } from 'lucide-react';

import { ServerProfile } from '../types';

interface Props {
  serverProfiles: ServerProfile[];
}

export default function HomeView({ serverProfiles }: Props) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

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

                    return (
                      <div
                        key={roleName}
                        className={`bg-white rounded-[40px] border transition-all duration-500 overflow-hidden cursor-pointer group ${
                          isExpanded
                            ? 'ring-4 ring-indigo-500/10 border-indigo-200 shadow-2xl col-span-full md:col-span-2 lg:col-span-2 p-10'
                            : 'border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 p-8'
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : cardKey)}
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
                        <p className={`text-slate-500 leading-relaxed italic border-indigo-100 mb-8 ${
                          isExpanded ? 'text-xl border-l-8 pl-8 py-4 bg-indigo-50/20 rounded-r-3xl' : 'text-sm border-l-4 pl-4 line-clamp-2'
                        }`}>
                          "{portrait.summary}"
                        </p>

                        {/* Portrait Fields */}
                        <div className={`grid gap-4 ${isExpanded ? 'grid-cols-2 mt-10' : 'grid-cols-2'}`}>
                          <PortraitTag label="付费性格" value={portrait.paymentHabits} color="blue" large={isExpanded} />
                          <PortraitTag label="行为特征" value={portrait.personality} color="purple" large={isExpanded} />
                          <PortraitTag label="游戏偏好" value={portrait.gameHabits} color="emerald" large={isExpanded} />
                          <PortraitTag label="现实身份" value={portrait.realLifePersona} color="indigo" large={isExpanded} />
                        </div>

                        {isExpanded && (
                          <div className="mt-10 pt-10 border-t border-slate-100 flex items-center justify-end">
                            <button
                              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                              onClick={e => { e.stopPropagation(); setExpandedId(null); }}
                            >
                              收起详情
                            </button>
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
