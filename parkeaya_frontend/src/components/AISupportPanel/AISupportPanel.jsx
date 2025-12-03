import React, { useState } from 'react';
import { useAISupport } from '../../hooks/useAISupport';
import './AISupportPanel.css';

const AISupportPanel = ({ onClose }) => {
  const [inputMessage, setInputMessage] = useState('');
  const { messages, isTyping, sendMessage, clearChat, messagesEndRef } = useAISupport();

  const quickActions = [
    { icon: '📊', title: 'Ver Reservas', description: 'Estado actual', prompt: '¿Cómo ver mis reservas de hoy?' },
    { icon: '💰', title: 'Reportes', description: 'Ingresos y métricas', prompt: 'Necesito ver mis reportes de ingresos' },
    { icon: '⚙️', title: 'Configurar', description: 'Ajustes del parking', prompt: 'Cómo configurar mi estacionamiento' },
    { icon: '🚗', title: 'Espacios', description: 'Disponibilidad', prompt: 'cómo gestionar espacios disponibles' }
  ];

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isTyping) return;
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleQuickAction = (prompt) => {
    sendMessage(prompt);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ai-support-panel">
      <div className="ai-support-header">
        <div className="ai-support-title">
          <div className="ai-avatar">🤖</div>
          <div>
            <h3>Asistente Parkeaya</h3>
            <span className="ai-status">{isTyping ? 'Escribiendo...' : 'En línea • IA Local'}</span>
          </div>
        </div>
        <div className="ai-support-actions">
          <button className="btn-clear" onClick={clearChat} title="Limpiar chat">🔄</button>
          {onClose && <button className="btn-close" onClick={onClose} title="Cerrar">✕</button>}
        </div>
      </div>

      {/* Quick actions always visible (first 4) */}
      <div className="ai-quick-actions">
        <h4>¿Qué necesitas hacer?</h4>
        <div className="ai-actions-grid">
          {quickActions.slice(0, 4).map((action, index) => (
            <button key={index} className="ai-action-card" onClick={() => handleQuickAction(action.prompt)} disabled={isTyping}>
              <div className="ai-action-icon">{action.icon}</div>
              <div className="ai-action-text">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="ai-messages-container">
        {messages.map((message) => {
          const ts = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
          return (
            <div key={message.id} className={`ai-message ai-message-${message.sender}`}>
              {message.sender === 'bot' && <div className="ai-message-avatar">🤖</div>}
              <div className="ai-message-content">
                <div className="ai-message-text">
                  {message.text.split('\n').map((line, index) => (<p key={index}>{line}</p>))}
                </div>
                <span className="ai-message-time">{ts.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="ai-message ai-message-bot">
            <div className="ai-message-avatar">🤖</div>
            <div className="ai-message-content">
              <div className="ai-typing-indicator"><span></span><span></span><span></span></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="ai-messages-end" />
      </div>

      <div className="ai-input-container">
        <div className="ai-input-wrapper">
          <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Escribe tu pregunta..." disabled={isTyping} className="ai-message-input" />
          <button onClick={handleSendMessage} disabled={!inputMessage.trim() || isTyping} className="ai-send-button">{isTyping ? '⏳' : '📤'}</button>
        </div>
        <div className="ai-input-hint">Presiona Enter para enviar • Soporte 100% gratuito</div>
      </div>
    </div>
  );
};

export default AISupportPanel;
