/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Server, Calendar, Plus, X, Trash2, Edit2, Check, ChevronRight, UserCircle, Map, AlertCircle } from 'lucide-react';
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

const SERVER_NAME_RE = /^\d{5}$/;

function validateProfile(p: ServerProfile): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!p.name.trim()) {
    errs.name = '区服名称为必填项';
  } else if (!SERVER_NAME_RE.test(p.name.trim())) {
    errs.name = '区服名称必须为五位数阿拉伯数字，如 27596';
  }
  if (!p.openingDate) errs.openingDate = '确切开服日期为必填项';
  if (!p.mergeStage) errs.mergeStage = '合服阶段为必填项';
  if (!p.gsName?.trim()) errs.gsName = 'GS 角色名为必填项';
  return errs;
}

function RequiredBadge() {
  return <span className="text-rose-500 font-black ml-0.5">*</span>;
}

export default function ServerConfig({ profiles, activeProfileId, onProfilesChange, onSelectProfile, onSaveProfile, onDeleteProfile, onUpdateProfile }: Props) {
  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const [attempted, setAttempted] = React.useState(false);

  React.useEffect(() => {
    setAttempted(false);
  }, [activeProfileId]);

  const errors = activeProfile ? validateProfile(activeProfile) : {};
  const isValid = Object.keys(errors).length === 0;

  const addProfile = () => {
    const newProfile: ServerProfile = {
      id: Date.now().toString(),
      name: '',
      keyPlayers: [],
      openingDate: '',
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
      ownerId: ''
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

  const handleSave = () => {
    setAttempted(true);
    if (!isValid || !activeProfile) return;
    onSaveProfile(activeProfile);
    onSelectProfile('');
  };

  const fieldClass = (field: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${
      attempted && errors[field] ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
    }`;

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
          {profiles.map(profile => {
            const profileErrors = validateProfile(profile);
            const profileInvalid = Object.keys(profileErrors).length > 0;
            return (
              <div
                key={profile.id}
                onClick={() => onSelectProfile(profile.id)}
                className={`group flex items-center justify-between p-3 cursor-pointer transition-colors ${
                  activeProfileId === profile.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-bold truncate ${activeProfileId === profile.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {profile.name || <span className="text-slate-400 font-normal italic">未命名区服</span>}
                    </p>
                    {profileInvalid && (
                      <span title="配置不完整">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      </span>
                    )}
                  </div>
                  {profile.openingDate && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-300" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                        {profile.openingDate} ({Math.floor((new Date().getTime() - new Date(profile.openingDate).getTime()) / (1000 * 60 * 60 * 24))}天)
                      </span>
                    </div>
                  )}
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
            );
          })}
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
            <p className="text-[10px] text-slate-400">
              <span className="text-rose-500 font-black">*</span> 为必填项
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* 区服名称 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Server className="w-3 h-3" /> 区服名称<RequiredBadge />
              </label>
              <input
                type="text"
                value={activeProfile.name}
                onChange={(e) => updateProfile(activeProfile.id, { name: e.target.value })}
                placeholder="五位数字，如 27596"
                maxLength={5}
                className={fieldClass('name') + ' font-bold'}
              />
              {attempted && errors.name ? (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.name}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">必须填入原始区服编号，与爬虫聊天后台中的区服名称一致</p>
              )}
            </div>

            {/* 确切开服日期 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3" /> 确切开服日期<RequiredBadge />
              </label>
              <input
                type="date"
                value={activeProfile.openingDate}
                onChange={(e) => updateProfile(activeProfile.id, { openingDate: e.target.value })}
                className={fieldClass('openingDate')}
              />
              {attempted && errors.openingDate && (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.openingDate}
                </p>
              )}
            </div>

            {/* 合服阶段 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Map className="w-3 h-3" /> 合服阶段<RequiredBadge />
              </label>
              <select
                value={activeProfile.mergeStage || ''}
                onChange={(e) => updateProfile(activeProfile.id, { mergeStage: e.target.value })}
                className={fieldClass('mergeStage')}
              >
                <option value="">请选择合服阶段</option>
                {['零合', '一合', '二合', '三合', '四合', '五合'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {attempted && errors.mergeStage && (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.mergeStage}
                </p>
              )}
            </div>
          </div>

          {/* GS 角色与人设 */}
          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800">GS 角色与人设</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GS 角色名 — 必填 */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  GS 角色名<RequiredBadge />
                </label>
                <input
                  type="text"
                  value={activeProfile.gsName || ''}
                  onChange={(e) => updateProfile(activeProfile.id, { gsName: e.target.value })}
                  placeholder="填写 GS 在游戏内使用的角色名"
                  className={fieldClass('gsName') + ' font-bold'}
                />
                {attempted && errors.gsName && (
                  <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.gsName}
                  </p>
                )}
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

          <div className="pt-6 mt-6 border-t-2 border-dashed border-slate-100 space-y-3">
            {attempted && !isValid && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                请填写所有必填项后再保存
              </div>
            )}
            <button
              onClick={handleSave}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 group-hover:scale-125 transition-transform" />
              保存并应用全局配置
            </button>
            <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">
              保存后系统将自动关联该区服的 GS 人设与历史画像进行分析
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
