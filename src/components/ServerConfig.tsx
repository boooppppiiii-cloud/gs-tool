/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Server, Users, Calendar, Plus, X, Trash2, Edit2, Check, ChevronRight, UserCircle, Map, Search, BookOpen, Clock } from 'lucide-react';
import { ServerProfile } from '../types';

interface Props {
  profiles: ServerProfile[];
  activeProfileId: string | null;
  onProfilesChange: (profiles: ServerProfile[]) => void;
  onSelectProfile: (id: string) => void;
  onSaveProfile: (profile: ServerProfile) => void;
  onDeleteProfile: (id: string) => void;
  onUpdateProfile: (id: string, updates: Partial<ServerProfile>) => void;
}

export default function ServerConfig({ profiles, activeProfileId, onProfilesChange, onSelectProfile, onSaveProfile, onDeleteProfile, onUpdateProfile }: Props) {
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const [editingPortraitKey, setEditingPortraitKey] = React.useState<string | null>(null);
  const [portraitEditValues, setPortraitEditValues] = React.useState<{
    summary: string; paymentHabits: string; personality: string;
    gameHabits: string; realLifePersona: string;
  } | null>(null);

  const addProfile = () => {
    const newProfile: ServerProfile = {
      id: Date.now().toString(),
      name: '新区服',
      keyPlayers: [],
      openingDate: new Date().toISOString().split('T')[0],
      gsName: '',
      gsPersona: {
        age: '',
        hometown: '',
        occupation: '',
        family: '',
        lifestyle: '',
        others: ''
      },
      serverEcology: '',
      persistentPortraits: {},
      ownerId: '' // Will be set by App or dataService
    };
    onProfilesChange([...profiles, newProfile]);
    onSelectProfile(newProfile.id);
  };

  const updateProfile = (id: string, updates: Partial<ServerProfile>) => {
    onProfilesChange(profiles.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateGsPersona = (field: keyof ServerProfile['gsPersona'], value: string) => {
    if (!activeProfile) return;
    const currentPersona = activeProfile.gsPersona || {};
    updateProfile(activeProfile.id, {
      gsPersona: { ...currentPersona, [field]: value }
    });
  };

  const deleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteProfile(id);
    onProfilesChange(profiles.filter(p => p.id !== id));
    if (activeProfileId === id) {
      onSelectProfile('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">区服配置手册</h3>
          </div>
          <button 
            onClick={addProfile}
            className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors"
            title="添加新区服"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
          {profiles.map(profile => (
            <div 
              key={profile.id}
              onClick={() => onSelectProfile(profile.id)}
              className={`group flex items-center justify-between p-3 cursor-pointer transition-colors ${
                activeProfileId === profile.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${activeProfileId === profile.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {profile.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3 h-3 text-slate-300" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                    {profile.openingDate} ({Math.floor((new Date().getTime() - new Date(profile.openingDate).getTime()) / (1000 * 60 * 60 * 24))}天)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => deleteProfile(profile.id, e)}
                  className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {activeProfileId === profile.id && <ChevronRight className="w-4 h-4 text-indigo-400 ml-2" />}
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-xs text-slate-400 italic">暂无区服配置，请点击上方按钮添加</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Profile Editor */}
      {activeProfile && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">区服信息编辑</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Server className="w-3 h-3" /> 区服正式名称
              </label>
              <input
                type="text"
                value={activeProfile.name}
                onChange={(e) => updateProfile(activeProfile.id, { name: e.target.value })}
                placeholder="例如：傲世1区"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3" /> 确切开服日期
              </label>
              <input
                type="date"
                value={activeProfile.openingDate}
                onChange={(e) => updateProfile(activeProfile.id, { openingDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Map className="w-3 h-3" /> 合服阶段
              </label>
              <select
                value={activeProfile.mergeStage || ''}
                onChange={(e) => updateProfile(activeProfile.id, { mergeStage: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">未设置</option>
                {['零合','一合','二合','三合','四合','五合'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800">GS 角色与人设</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">GS 角色名</label>
                <input
                  type="text"
                  value={activeProfile.gsName || ''}
                  onChange={(e) => updateProfile(activeProfile.id, { gsName: e.target.value })}
                  placeholder="例如：小美"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">年龄</label>
                <input
                  type="text"
                  value={activeProfile.gsPersona?.age || ''}
                  onChange={(e) => updateGsPersona('age', e.target.value)}
                  placeholder="例如：24岁"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">家乡</label>
                <input
                  type="text"
                  value={activeProfile.gsPersona?.hometown || ''}
                  onChange={(e) => updateGsPersona('hometown', e.target.value)}
                  placeholder="例如：成都"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">职业</label>
                <input
                  type="text"
                  value={activeProfile.gsPersona?.occupation || ''}
                  onChange={(e) => updateGsPersona('occupation', e.target.value)}
                  placeholder="例如：自由摄影师"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">家庭情况</label>
                <input
                  type="text"
                  value={activeProfile.gsPersona?.family || ''}
                  onChange={(e) => updateGsPersona('family', e.target.value)}
                  placeholder="例如：独生女，父母经商"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">生活作息</label>
                <input
                  type="text"
                  value={activeProfile.gsPersona?.lifestyle || ''}
                  onChange={(e) => updateGsPersona('lifestyle', e.target.value)}
                  placeholder="例如：晚睡晚起，爱熬夜"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">其他补充人设</label>
              <textarea
                value={activeProfile.gsPersona?.others || ''}
                onChange={(e) => updateGsPersona('others', e.target.value)}
                placeholder="例如：性格阳光开朗，偶尔有点小迷糊..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
              />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-3 h-3" /> 历史画像沉淀 ({Object.keys(activeProfile.persistentPortraits || {}).length})
            </label>
            <div className="space-y-3">
              {Object.entries(activeProfile.persistentPortraits || {}).map(([roleName, p]) => {
                const portrait = p as any;
                const isEditingThis = editingPortraitKey === roleName;
                return (
                  <div key={roleName} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                    {/* Header row */}
                    <div className="p-4 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <UserCircle className="w-8 h-8 text-indigo-200 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-800">{roleName}</p>
                          <p className="text-[10px] text-slate-400">更新于 {new Date(portrait.lastUpdated).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isEditingThis && (
                          <button
                            onClick={() => {
                              setEditingPortraitKey(roleName);
                              setPortraitEditValues({
                                summary: portrait.summary || '',
                                paymentHabits: portrait.paymentHabits || '',
                                personality: portrait.personality || '',
                                gameHabits: portrait.gameHabits || '',
                                realLifePersona: portrait.realLifePersona || '',
                              });
                            }}
                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="编辑画像"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const newPortraits = { ...activeProfile.persistentPortraits };
                            delete newPortraits[roleName];
                            updateProfile(activeProfile.id, { persistentPortraits: newPortraits });
                            onUpdateProfile(activeProfile.id, { persistentPortraits: newPortraits });
                            if (editingPortraitKey === roleName) setEditingPortraitKey(null);
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          title="删除画像"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {isEditingThis && portraitEditValues && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
                        <div className="pt-3 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">一句话总结</label>
                          <textarea
                            rows={2}
                            value={portraitEditValues.summary}
                            onChange={e => setPortraitEditValues(v => v && ({ ...v, summary: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                          />
                        </div>
                        {([
                          { field: 'paymentHabits' as const, label: '付费习惯' },
                          { field: 'personality' as const,   label: '行为特征' },
                          { field: 'gameHabits' as const,    label: '游戏偏好' },
                          { field: 'realLifePersona' as const, label: '现实身份' },
                        ]).map(({ field, label }) => (
                          <div key={field} className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
                            <textarea
                              rows={2}
                              value={portraitEditValues[field]}
                              onChange={e => setPortraitEditValues(v => v && ({ ...v, [field]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => { setEditingPortraitKey(null); setPortraitEditValues(null); }}
                            className="px-4 py-2 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => {
                              if (!portraitEditValues) return;
                              const updated = {
                                ...activeProfile.persistentPortraits,
                                [roleName]: {
                                  ...portraitEditValues,
                                  lastUpdated: new Date().toISOString(),
                                },
                              };
                              updateProfile(activeProfile.id, { persistentPortraits: updated });
                              onUpdateProfile(activeProfile.id, { persistentPortraits: updated });
                              setEditingPortraitKey(null);
                              setPortraitEditValues(null);
                            }}
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> 保存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(activeProfile.persistentPortraits || {}).length === 0 && (
                <p className="text-[10px] text-slate-400 italic">暂无历史画像沉淀</p>
              )}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t-2 border-dashed border-slate-100">
            <button 
              onClick={() => {
                onSaveProfile(activeProfile);
                onSelectProfile('');
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group"
            >
              <Check className="w-4 h-4 group-hover:scale-125 transition-transform" />
              保存并应用全局配置
            </button>
            <p className="text-[9px] text-center text-slate-400 mt-3 font-bold uppercase tracking-widest">
              保存后系统将自动关联该区服的 GS 人设与历史画像进行分析
            </p>
          </div>
          
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3" /> 手动重点关注玩家 ({activeProfile.keyPlayers.length})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="new-player-input"
                placeholder="输入玩家角色名..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    const val = input.value.trim();
                    if (val && !activeProfile.keyPlayers.includes(val)) {
                      const newPlayers = [...activeProfile.keyPlayers, val];
                      updateProfile(activeProfile.id, { keyPlayers: newPlayers });
                      onUpdateProfile(activeProfile.id, { keyPlayers: newPlayers });
                      input.value = '';
                    }
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('new-player-input') as HTMLInputElement;
                  const val = input.value.trim();
                  if (val && !activeProfile.keyPlayers.includes(val)) {
                    const newPlayers = [...activeProfile.keyPlayers, val];
                    updateProfile(activeProfile.id, { keyPlayers: newPlayers });
                    onUpdateProfile(activeProfile.id, { keyPlayers: newPlayers });
                    input.value = '';
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-all"
              >
                添加
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {activeProfile.keyPlayers.map(player => (
                <div key={player} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 group">
                  {player}
                  <button 
                    onClick={() => {
                      const newPlayers = activeProfile.keyPlayers.filter(p => p !== player);
                      updateProfile(activeProfile.id, { keyPlayers: newPlayers });
                      onUpdateProfile(activeProfile.id, { keyPlayers: newPlayers });
                    }}
                    className="p-0.5 hover:bg-rose-100 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {activeProfile.keyPlayers.length === 0 && (
                <p className="text-[10px] text-slate-400 italic">暂无手动添加的重点玩家</p>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
             <div className="flex items-center gap-2 text-indigo-600">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold">重点玩家将由 AI 自动扫描识别</span>
             </div>
             <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
               系统会自动根据聊天活跃、充值权重及言论倾向筛选出 Top 1-3 的重点玩家进行深度分析。
             </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkles(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
