import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, children, size = 'md', showClose = true }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal modal--${size}`}
        ref={modalRef}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="modal__header">
            <h3 className="modal__title">{title}</h3>
            {showClose && (
              <button className="modal__close" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="modal__body">
          {children}
        </div>
      </div>
    </div>
  );
}
