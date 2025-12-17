import React, { useState } from 'react';
import { translations, Language } from '../utils/translations';

interface LoginScreenProps {
  onLogin: (username: string) => void;
  isLoading: boolean;
  lang: Language;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isLoading, lang }) => {
  const [username, setUsername] = useState('');
  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && !isLoading) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">
            <i className="fas fa-shield-alt mr-3"></i>{t.loginTitle}
          </h1>
          <p className="text-gray-400">{t.loginPrompt}</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              placeholder={t.loginPrompt}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 transition duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-lock text-cyan-400 group-hover:text-cyan-300"></i>}
            </span>
            {isLoading ? t.loading : t.loginOrCreate}
          </button>
        </form>
         <p className="text-xs text-center text-gray-500">
            {t.noPassword}
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;