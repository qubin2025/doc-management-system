
import React, { useState } from 'react';
import { Phone, ShieldCheck, Cpu, ArrowRight, Loader2 } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (phone: string, code: string) => void;
  t: any;
}

const Login: React.FC<LoginProps> = ({ onLogin, t }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      setStep('code');
    }, 800);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setTimeout(() => {
      onLogin(phone, code);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1e1b4b_0%,_#030712_100%)] opacity-50" />
      
      <div className="relative w-full max-w-md bg-gray-900/40 backdrop-blur-2xl border border-white/5 p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/20 mb-6">
            <Cpu className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">{t.loginTitle}</h1>
          <p className="text-gray-500 text-sm text-center">{t.loginDesc}</p>
        </div>

        <form onSubmit={step === 'phone' ? handleSendCode : handleVerify} className="space-y-6">
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
              {step === 'phone' ? <Phone size={20} /> : <ShieldCheck size={20} />}
            </div>
            <input 
              type={step === 'phone' ? "tel" : "text"}
              value={step === 'phone' ? phone : code}
              onChange={(e) => step === 'phone' ? setPhone(e.target.value) : setCode(e.target.value)}
              placeholder={step === 'phone' ? t.phonePlaceholder : t.codePlaceholder}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-lg font-medium tracking-wide"
              disabled={loading}
              autoFocus
            />
          </div>

          <button 
            disabled={loading || (step === 'phone' && !phone) || (step === 'code' && !code)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>{step === 'phone' ? t.sendCode : t.verifyBtn}</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex justify-center gap-4">
           {step === 'code' && (
             <button onClick={() => setStep('phone')} className="text-xs font-bold text-gray-500 hover:text-gray-300 uppercase tracking-widest transition-colors">
               Back to Phone
             </button>
           )}
        </div>
      </div>

      <div className="absolute bottom-8 text-center w-full">
         <p className="text-[10px] text-gray-700 font-bold uppercase tracking-[0.2em]">Nexus3D Protocol v{localStorage.getItem('app_version') || '1.1.0'}</p>
      </div>
    </div>
  );
};

export default Login;
