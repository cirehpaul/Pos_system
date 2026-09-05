import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Delete, LogIn } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { initializeDatabase } from '../../db/database';
import './LoginScreen.css';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [shake, setShake] = useState(false);
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

  const handlePinInput = (digit) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) {
      setError('Enter at least 4 digits');
      return;
    }
    const result = await login(pin);
    if (!result.success) {
      setError(result.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  }, [pin, login]);

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin, handleSubmit]);

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-loading">
          <div className="login-loading__spinner animate-spin"></div>
          <p>Initializing POS System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card animate-scale-in">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand__icon">
            <ShoppingCart size={32} />
          </div>
          <h1 className="login-brand__title">FoodPOS</h1>
          <p className="login-brand__subtitle">Enter your PIN to continue</p>
        </div>

        {/* PIN Display */}
        <div className={`login-pin ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`login-pin__dot ${i < pin.length ? 'login-pin__dot--filled' : ''}`}
            />
          ))}
        </div>

        {/* Error */}
        {error && <p className="login-error animate-fade-in">{error}</p>}

        {/* Number Pad */}
        <div className="login-numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              className="login-numpad__btn"
              onClick={() => handlePinInput(String(num))}
            >
              {num}
            </button>
          ))}
          <button className="login-numpad__btn login-numpad__btn--action" onClick={handleBackspace}>
            <Delete size={24} />
          </button>
          <button className="login-numpad__btn" onClick={() => handlePinInput('0')}>
            0
          </button>
          <button className="login-numpad__btn login-numpad__btn--submit" onClick={handleSubmit}>
            <LogIn size={24} />
          </button>
        </div>

        {/* Default PINs hint */}
        <div className="login-hint">
          <p>Default PINs: Owner: <strong>1234</strong> | Cashier: <strong>0000</strong></p>
        </div>
      </div>
    </div>
  );
}
