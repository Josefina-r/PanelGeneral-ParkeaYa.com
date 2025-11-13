import { useState, useRef, useEffect } from 'react';
import { localAI } from '../services/localAIService';

export const useAISupport = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([{
      id: 1,
      text: "¡Hola! 👋 Soy tu asistente de Parkeaya. Puedo ayudarte con:\n\n• 📊 Gestión de reservas\n• 💰 Configuración de pagos\n• ⚙️ Ajustes técnicos\n• 📈 Reportes y análisis\n\n¿En qué necesitas ayuda?",
      sender: 'bot',
      timestamp: new Date(),
      type: 'welcome'
    }]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (userMessage) => {
    if (!userMessage.trim()) return;

    const userMsg = {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const typingDelay = 800 + Math.random() * 1200;
    
    setTimeout(() => {
      const aiResponse = localAI.getResponse(userMessage);
      
      const botMsg = {
        id: Date.now() + 1,
        text: aiResponse,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, typingDelay);
  };

  const clearChat = () => {
    setMessages([{
      id: 1,
      text: "¡Conversación reiniciada! ¿En qué puedo ayudarte ahora?",
      sender: 'bot',
      timestamp: new Date()
    }]);
  };

  return {
    messages,
    isTyping,
    sendMessage,
    clearChat,
    messagesEndRef
  };
};