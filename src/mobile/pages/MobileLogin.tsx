// 移动端登录页 — 轻量单列表单（不复用桌面 LoginPage）
import React, { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { login } from '../../data/api';
import { UserInfo } from '../../types';

const MobileLogin: React.FC<{ onLogin: (u: UserInfo) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      const auth = await login(username.trim(), password);
      onLogin(auth.user);
    } catch (err: any) {
      setError(err.message || '登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col justify-center px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 backdrop-blur mb-4">
          <Camera className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">工程水印相机</h1>
        <p className="text-blue-200 text-sm mt-2">全过程工程咨询管理系统 · 移动端</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1.5">用户名</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="请输入用户名"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1.5">密码</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full h-12 px-4 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="请输入密码"
          />
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-blue-600 text-white text-base font-medium active:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? '登录中…' : '登 录'}
        </button>
      </form>

      <p className="text-center text-blue-200/70 text-xs mt-6">与电脑端使用同一账号登录</p>
    </div>
  );
};

export default MobileLogin;
