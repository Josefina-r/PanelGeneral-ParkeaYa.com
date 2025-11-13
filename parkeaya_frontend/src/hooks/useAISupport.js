import { useState, useRef, useEffect } from 'react';

// Lightweight local hook to power the AISupportPanel during development.
// - messages: [{ id, sender: 'user'|'bot', text, timestamp }]
// - isTyping: boolean
// - sendMessage(text): appends user message and simulates a bot reply
// - clearChat(): clears messages
// - messagesEndRef: ref to scroll-to-end element

let nextId = 1;

export function useAISupport() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // scroll to bottom when messages change (if element available)
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        // ignore in non-browser test env
      }
    }
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
  };

  const sendMessage = (text) => {
    const userMsg = { id: nextId++, sender: 'user', text: text, timestamp: new Date() };
    setMessages((m) => [...m, userMsg]);

    // simulate bot typing and reply
    setIsTyping(true);
    setTimeout(() => {
      const replyText = generateBotReply(text);
      const botMsg = { id: nextId++, sender: 'bot', text: replyText, timestamp: new Date() };
      setMessages((m) => [...m, botMsg]);
      setIsTyping(false);
    }, 700 + Math.random() * 800);
  };

  return { messages, isTyping, sendMessage, clearChat, messagesEndRef };
}

function generateBotReply(userText) {
  // Very small deterministic replies for common keywords; otherwise generic.
  const t = (userText || '').toLowerCase();
  if (t.includes('reserva') || t.includes('reservas')) return 'Puedes ver tus reservas en la sección Reservas → Hoy.';
  if (t.includes('reporte') || t.includes('ingresos')) return 'Generando un resumen de ingresos... (demo)';
  if (t.includes('configur') || t.includes('config')) return 'Ve a Perfil → Configuración para actualizar los ajustes del estacionamiento.';
  if (t.includes('espacio') || t.includes('plaza') || t.includes('disponibilidad')) return 'Actualmente tienes X plazas disponibles. Usa la pestaña Espacios para más detalles.';
  return 'Hola — cuéntame qué necesitas y te ayudo a encontrar la sección correspondiente.';
}
