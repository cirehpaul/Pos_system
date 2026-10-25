import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, Eye, EyeOff, ArrowRight } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { initializeDatabase } from '../../db/database';
import './LoginScreen.css';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, isAuthenticated, currentUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    initializeDatabase().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(currentUser?.role === 'cashier' ? '/pos' : '/dashboard');
    }
  }, [isAuthenticated, navigate, currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setSubmitting(true);
    const result = await login(username.trim(), password);
    setSubmitting(false);

    if (!result.success) {
      setError(result.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword('');
    }
  };

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-loading">
          <div className="login-loading__spinner animate-spin"></div>
          <p>Initializing System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      {/* Floating orbs for visual flair */}
      <div className="login-orb login-orb--1"></div>
      <div className="login-orb login-orb--2"></div>
      <div className="login-orb login-orb--3"></div>

      <div className={`login-card animate-scale-in ${shake ? 'animate-shake' : ''}`}>
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand__logo-wrap">
            <img
              src="/LUCID.png"
              alt="Lucid Logo"
              className="login-brand__logo"
              onError={(e) => {
                e.target.style.display = 'none';
                const fb = document.getElementById('login-fallback-icon');
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div id="login-fallback-icon" className="login-brand__icon" style={{ display: 'none' }}>
              <Lock size={28} />
            </div>
          </div>
          <h1 className="login-brand__title">Lucid</h1>
          <p className="login-brand__subtitle">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username" className="login-field__label">Username</label>
            <div className="login-field__input-wrapper">
              <User size={18} className="login-field__icon" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-field__label">Password</label>
            <div className="login-field__input-wrapper">
              <Lock size={18} className="login-field__icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="login-error animate-fade-in">{error}</p>}

          <button
            type="submit"
            className="login-submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div className="login-submit__spinner"></div>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
