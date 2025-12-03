// components/SupportPanel.jsx
import { useState, useRef, useEffect } from 'react';

const SupportPanel = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "¡Hola María! Soy tu asistente de Parkeaya. ¿En qué puedo ayudarte hoy?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // Simular respuesta automática
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: getAIResponse(inputMessage),
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const getAIResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('reserva') || lowerMessage.includes('ocupación')) {
      return "Puedo ayudarte con la gestión de reservas. Veo que hoy tienes 78% de ocupación. ¿Necesitas revisar alguna reserva específica?";
    }
    
    if (lowerMessage.includes('pago') || lowerMessage.includes('ingreso')) {
      return "Para consultas de ingresos, puedes generar reportes detallados en la sección 'Reportes Locales'. ¿Quieres que te guíe?";
    }
    
    if (lowerMessage.includes('configuración') || lowerMessage.includes('editar')) {
      return "La configuración de tu estacionamiento está en 'Mi Estacionamiento'. ¿Qué aspecto necesitas modificar?";
    }
    
    return "Entiendo tu consulta. Si necesitas ayuda más específica, puedo conectarte con nuestro equipo de soporte humano. ¿Prefieres que lo haga?";
  };

  const commonQuestions = [
    "¿Cómo aumentar mis reservas?",
    "Problema con un pago",
    "Configurar horarios",
    "Reportar un problema técnico"
  ];

  return (
    <div className="support-panel">
      {/* Header del Chat */}
      <div className="support-header">
        <div className="support-info">
          <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></div>
          <div>
            <h3>Soporte Parkeaya</h3>
            <span>{isOnline ? 'En línea' : 'No disponible'}</span>
          </div>
        </div>
        <div className="support-actions">
          <button className="btn-call">
            <i className="fas fa-phone"></i>
          </button>
          <button className="btn-video">
            <i className="fas fa-video"></i>
          </button>
        </div>
      </div>

      {/* Área de Mensajes */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <p>{message.text}</p>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Preguntas Rápidas */}
      <div className="quick-questions">
        <p>Preguntas frecuentes:</p>
        <div className="questions-grid">
          {commonQuestions.map((question, index) => (
            <button 
              key={index}
              className="question-chip"
              onClick={() => setInputMessage(question)}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Input de Mensaje */}
      <div className="message-input-container">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Escribe tu mensaje..."
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} disabled={!inputMessage.trim()}>
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default SupportPanel;