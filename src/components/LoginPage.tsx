import React, { useState } from 'react';
import { LogIn, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { AuthState } from '../types';
import * as api from '../data/api';
import { toast } from './Toast';

interface LoginPageProps { onLogin: (auth: AuthState) => void; }

// 模块网格：8列×5行=40个模块方块，未来随开发进展逐步点亮
// 值 = opacity (1-indexed)，未列出的方块使用默认透明度
const GRID_ACTIVE_CELLS: Record<number, number> = {
  1: 1.0, 3: 1.0, 5: 0.6, 8: 1.0, 9: 0.7,
  12: 1.0, 14: 0.5, 16: 1.0, 18: 0.8,
  21: 1.0, 23: 0.6, 25: 1.0, 27: 0.4,
  29: 1.0, 32: 0.9, 34: 1.0, 37: 0.7,
  39: 1.0, 40: 0.5,
};

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReg, setShowReg] = useState(false);
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDept, setRegDept] = useState('');

  const handleDemoLogin = () => onLogin({
    token: 'demo-token-' + Date.now(),
    user: { id: 1, username: '管理员', displayName: '管理员', role: 'admin' },
    permissions: { can_upload: true, can_download: true, can_use_ai: true },
  });

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true); setError('');
    try {
      const users = JSON.parse(localStorage.getItem('registered-users') || '[]');
      const found = users.find((u: any) => u.username === username && u.password === password);
      if (found) {
        if (found.role === 'pending') { setError('账号待管理员审批，审批后可操作项目'); setLoading(false); return; }
        onLogin({ token: 'registered-' + Date.now(), user: { id: 2, username: found.username, displayName: found.username, role: found.role || 'user' }, permissions: { can_upload: true, can_download: true, can_use_ai: false } });
        return;
      }
      const auth = await api.login(username.trim(), password);
      onLogin(auth);
    } catch (err: any) { setError(err.message || '登录失败'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regUser.trim() || !regPass.trim()) { setError('请填写用户名和密码'); return; }
    if (regPass.length < 6) { setError('密码至少6位'); return; }
    setLoading(true); setError('');
    try {
      await api.register(regUser, regPass, regUser, regPhone, regDept);
      setError(''); setShowReg(false);
      toast('注册成功！等待管理员审批后即可登录', 'success');
    } catch (err: any) {
      setError(err.message || '注册失败，请稍后重试');
    }
    finally { setLoading(false); }
  };

  const fontFamily = "'Century Gothic','Futura','Tw Cen MT',-apple-system,'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif";

  return (
    <div className="flex h-screen min-h-[600px]" style={{ fontFamily, background: '#FAFAF8', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.028) 1px, transparent 1px)', backgroundSize: '40px 40px', color: '#141414' }}>

      {/* ═══════════════ LEFT: VISUAL + BRAND ═══════════════ */}
      <aside className="hidden md:flex relative overflow-hidden items-end" style={{ flex: '0 0 44%', background: '#F4F4EF', padding: '64px 56px' }}>

        {/* Dense engineering grid overlay (::before equivalent) */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Geometric composition layer */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Large faint circle */}
          <div className="absolute rounded-full border" style={{ width: 300, height: 300, borderColor: 'rgba(0,0,0,0.07)', top: '10%', left: -40 }} />

          {/* Horizontal rules */}
          <div className="absolute h-px left-0" style={{ background: 'rgba(0,0,0,0.1)', width: '62%', top: '22%' }} />
          <div className="absolute h-px" style={{ background: 'rgba(0,0,0,0.1)', width: '44%', top: '34%', left: '16%' }} />
          <div className="absolute h-px left-0" style={{ background: 'rgba(0,0,0,0.1)', width: '78%', top: '48%' }} />
          <div className="absolute h-px" style={{ background: 'rgba(0,0,0,0.1)', width: '52%', top: '62%', left: '20%' }} />

          {/* Vertical rules */}
          <div className="absolute w-px" style={{ background: 'rgba(0,0,0,0.08)', height: '70%', left: '38%', top: '18%' }} />
          <div className="absolute w-px" style={{ background: 'rgba(0,0,0,0.08)', height: '50%', left: '66%', top: '34%' }} />

          {/* Diagonal connector */}
          <div className="absolute w-px" style={{ background: 'rgba(0,0,0,0.09)', height: 120, top: '30%', left: '54%', transform: 'rotate(22deg)', transformOrigin: 'top left' }} />

          {/* Solid nodes — processed data */}
          <div className="absolute" style={{ width: 10, height: 10, top: '20%', left: '36%', background: '#141414', opacity: 0.55 }} />
          <div className="absolute" style={{ width: 16, height: 8, top: '32%', left: '64%', background: '#141414', opacity: 0.4 }} />
          <div className="absolute" style={{ width: 8, height: 14, top: '46%', left: '30%', background: '#141414', opacity: 0.5 }} />
          <div className="absolute" style={{ width: 12, height: 12, top: '60%', left: '55%', background: '#141414', opacity: 0.45 }} />
          <div className="absolute" style={{ width: 20, height: 6, top: '50%', left: '72%', background: '#141414', opacity: 0.35 }} />

          {/* Scattered data points — raw input */}
          {[[12,12],[17,28],[10,44],[24,18],[19,56],[14,70],[28,38],[31,62],[8,80],[23,82],[36,10],[39,48]].map(([t,l], i) => (
            <div key={'dot'+i} className="absolute rounded-full" style={{ width: 4, height: 4, top: `${t}%`, left: `${l}%`, background: 'rgba(0,0,0,0.35)' }} />
          ))}

          {/* ═══ 模块网格阵列 (8×5=40) — 灰度方块代表各模块，未来随开发逐步点亮 ═══ */}
          <div className="absolute grid" style={{ bottom: '26%', left: '10%', width: 180, height: 100, gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(5, 1fr)', gap: 3, opacity: 0.25 }}>
            {Array.from({ length: 40 }, (_, i) => {
              const n = i + 1; // 1-indexed per CSS nth-child
              const alpha = GRID_ACTIVE_CELLS[n];
              return (
                <span key={'m'+n}
                  className="block"
                  style={{
                    background: '#141414',
                    opacity: alpha !== undefined ? alpha : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Brand overlay */}
        <div className="relative" style={{ zIndex: 2 }}>
          <div className="flex items-center justify-center mb-8 select-none" style={{ width: 48, height: 48, background: '#1D4F91', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.02em', color: '#FAFAF8' }}>ZHJK</div>
          <h1 className="font-bold mb-3" style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1.3, color: '#141414' }}>全过程工程咨询管理系统</h1>
          <div className="mb-3" style={{ width: 48, height: 2, background: '#141414' }} />
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.05em', lineHeight: 1.6, color: '#6E6E68' }}>
            <span style={{ color: '#141414', fontWeight: 600 }}>数据加工中心</span> &nbsp;·&nbsp; AI底座 &nbsp;·&nbsp; 资产沉淀
          </p>
          <div style={{ marginTop: 18, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', color: '#6E6E68' }}>中航建科</div>
        </div>
      </aside>

      {/* Mobile brand header */}
      <div className="md:hidden absolute top-0 left-0 right-0 p-6 flex items-center gap-4" style={{ zIndex: 10 }}>
        <div className="flex items-center justify-center text-white flex-shrink-0" style={{ width: 40, height: 40, background: '#1D4F91', fontSize: '0.75rem', fontWeight: 900 }}>ZHJK</div>
        <div>
          <h1 className="text-base font-bold" style={{ color: '#141414' }}>全过程工程咨询管理系统</h1>
          <p className="text-[10px] tracking-wider" style={{ color: '#6E6E68' }}>数据加工中心 · AI底座 · 资产沉淀</p>
        </div>
      </div>

      {/* ═══════════════ RIGHT: LOGIN ═══════════════ */}
      <main className="flex-1 flex items-center justify-center" style={{ padding: 48 }}>
        <div className="w-full" style={{ maxWidth: 380 }}>

          {showReg ? (
            /* ── REGISTRATION ── */
            <div>
              <div className="uppercase mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: '#6E6E68' }}>Create Account</div>
              <h2 className="font-bold" style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.05em', color: '#141414', marginBottom: 28 }}>创建账号</h2>

              {error && <div className="mb-4 p-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

              <div className="space-y-5">
                {[
                  { label: '用户名 *', type: 'text', val: regUser, set: setRegUser, ph: '请输入用户名' },
                  { label: '密码 * (至少6位)', type: 'password', val: regPass, set: setRegPass, ph: '········' },
                  { label: '手机号', type: 'tel', val: regPhone, set: setRegPhone, ph: '选填' },
                  { label: '所属部门', type: 'text', val: regDept, set: setRegDept, ph: '如：工程部' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block font-semibold uppercase mb-1.5" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#6E6E68' }}>{f.label}</label>
                    <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                      className="w-full bg-transparent border-0 outline-none transition-colors placeholder:text-[#BFBFB8]"
                      style={{ padding: '8px 0', fontSize: '0.9rem', fontFamily, letterSpacing: '0.03em', color: '#141414', borderBottom: '1.5px solid #D4D4CE' }}
                      onFocus={e => (e.target.style.borderBottomColor = '#141414')}
                      onBlur={e => (e.target.style.borderBottomColor = '#D4D4CE')} />
                  </div>
                ))}
              </div>

              <button onClick={handleRegister}
                className="w-full mt-6 border-[1.5px] cursor-pointer transition-all duration-[0.18s] flex items-center justify-center gap-2"
                style={{ fontFamily, padding: '10px 0', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.14em', color: '#FAFAF8', background: '#141414', borderColor: '#141414' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#141414'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#FAFAF8'; }}>
                <UserPlus className="w-4 h-4" />注 册
              </button>

              <p className="text-center mt-5" style={{ fontSize: '0.65rem', letterSpacing: '0.05em', color: '#BFBFB8' }}>
                已有账号？<button onClick={() => { setShowReg(false); setError(''); }} className="hover:underline underline-offset-2 font-medium ml-1" style={{ color: '#6E6E68' }}>返回登录</button>
              </p>
            </div>
          ) : (
            /* ── LOGIN ── */
            <form onSubmit={handlePasswordLogin} autoComplete="off">
              <div className="uppercase mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: '#6E6E68' }}>Welcome</div>
              <h2 className="font-bold" style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.05em', color: '#141414', marginBottom: 28 }}>系统登录</h2>

              {error && <div className="mb-4 p-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

              {/* Username */}
              <div style={{ marginBottom: 18 }}>
                <label className="block font-semibold uppercase mb-1.5" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#6E6E68' }}>账号</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="w-full rounded border-0 bg-transparent px-0 py-2 text-gray-800 placeholder:text-[#BFBFB8] focus:outline-none"
                  style={{ padding: '8px 0', fontSize: '0.9rem', fontFamily, letterSpacing: '0.03em', color: '#141414', borderBottom: '1.5px solid #D4D4CE' }}
                  onFocus={e => (e.target.style.borderBottomColor = '#141414')}
                  onBlur={e => (e.target.style.borderBottomColor = '#D4D4CE')} />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 18 }}>
                <label className="block font-semibold uppercase mb-1.5" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#6E6E68' }}>密码</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    className="w-full rounded border-0 bg-transparent px-0 py-2 text-gray-800 placeholder:text-[#BFBFB8] focus:outline-none"
                    style={{ padding: '8px 0', fontSize: '0.9rem', fontFamily, letterSpacing: '0.03em', color: '#141414', borderBottom: '1.5px solid #D4D4CE' }}
                    onFocus={e => (e.target.style.borderBottomColor = '#141414')}
                    onBlur={e => (e.target.style.borderBottomColor = '#D4D4CE')} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1" style={{ color: '#BFBFB8' }}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end" style={{ marginBottom: 18 }}>
                <button type="button" className="transition-colors hover:text-[#141414]" style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: '#6E6E68' }}>忘记密码？</button>
              </div>

              {/* Login button */}
              <button type="submit" disabled={loading}
                className="w-full border-[1.5px] cursor-pointer transition-all duration-[0.18s] flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ fontFamily, padding: '10px 0', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.14em', color: '#FAFAF8', background: '#141414', borderColor: '#141414' }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#141414'; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#FAFAF8'; } }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />登录中...</> : <><LogIn className="w-4 h-4" />登 录</>}
              </button>

              {/* Demo login — 生产环境可通过 VITE_DISABLE_DEMO=true 关闭 */}
              {!import.meta.env.VITE_DISABLE_DEMO && (<>
              <div className="relative flex items-center" style={{ margin: '20px 0' }}>
                <div className="flex-1 border-t" style={{ borderColor: '#D4D4CE' }} />
                <span className="px-3 shrink-0" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: '#BFBFB8', background: '#FAFAF8' }}>演示入口</span>
                <div className="flex-1 border-t" style={{ borderColor: '#D4D4CE' }} />
              </div>

              <button type="button" onClick={handleDemoLogin}
                className="w-full border-[1.5px] cursor-pointer transition-all duration-[0.18s]"
                style={{ fontFamily, padding: '10px 0', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.14em', color: '#6E6E68', background: 'transparent', borderColor: '#D4D4CE' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#141414'; e.currentTarget.style.borderColor = '#141414'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6E6E68'; e.currentTarget.style.borderColor = '#D4D4CE'; }}>
                离线演示（管理员权限）
              </button>
              </>)}

              {/* Footer */}
              <div className="leading-snug" style={{ marginTop: 32, fontSize: '0.65rem', letterSpacing: '0.05em', color: '#BFBFB8' }}>
                <p>首次登录请联系系统管理员获取账号</p>
                <p className="mt-1">
                  还没有账号？<button type="button" onClick={() => { setShowReg(true); setError(''); }} className="hover:underline underline-offset-2 font-medium ml-1" style={{ color: '#6E6E68' }}>立即注册</button>
                </p>
                <p className="mt-2">&copy; 全过程工程咨询管理系统</p>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
