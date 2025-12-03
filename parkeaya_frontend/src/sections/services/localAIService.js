class LocalAIService {
  constructor() {
    this.knowledgeBase = {
      'reserva': {
        patterns: ['reserva', 'booking', 'reservar', 'ocupación', 'ocupacion', 'disponibilidad'],
        responses: [
          "📊 Veo que tienes 78% de ocupación hoy con 15 reservas. ¿Necesitas gestionar alguna específicamente?",
          "📍 Para gestionar reservas, ve a 'Gestión Reservas' en tu panel.",
          "🚗 ¿Problema con alguna reserva? Revisa en 'Reservas Activas'.",
          "⏰ Tu ocupación actual es del 78%. ¿Quieres estrategias para mejorarla?"
        ]
      },
      'pagos': {
        patterns: ['pago', 'pagar', 'factura', 'ingreso', 'dinero', 'tarifa', 'precio', 'cobro'],
        responses: [
          "💰 Tus reportes de ingresos están en 'Reportes Locales'. ¿Problema con algún pago?",
          "💳 Configura tarifas en 'Mi Estacionamiento' → 'Configuración de Precios'.",
          "📈 Para optimizar ingresos, revisa los reportes de horas pico.",
          "🔧 ¿Problema de pagos? Verifica tu conexión con la pasarela."
        ]
      },
      'configuracion': {
        patterns: ['configurar', 'configuración', 'editar', 'modificar', 'ajustes', 'setup'],
        responses: [
          "⚙️ La configuración completa está en 'Mi Estacionamiento'. ¿Qué necesitas modificar?",
          "🔧 Puedes editar horarios, precios y disponibilidad en la configuración.",
          "📱 ¿Problema técnico? Intenta reiniciar la configuración.",
          "🎯 Configura tus horarios pico para maximizar ingresos."
        ]
      },
      'reportes': {
        patterns: ['reporte', 'analítica', 'estadística', 'métrica', 'gráfico', 'grafico', 'dato'],
        responses: [
          "📊 Tus reportes detallados están en 'Reportes Locales'. ¿Necesitas ayuda?",
          "📈 Tu ocupación actual es 78%. Los reportes se actualizan cada hora.",
          "💹 Puedo ayudarte a analizar tendencias. Revisa los gráficos de ingresos.",
          "🔍 ¿Qué métrica específica necesitas? Ingresos, ocupación o reservas?"
        ]
      },
      'default': {
        responses: [
          "🤔 Interesante pregunta. Revisa en 'Mi Estacionamiento' o contacta soporte.",
          "💡 Buena consulta. Déjame conectarte con la información más relevante.",
          "🎯 Entiendo tu necesidad. Te sugiero revisar la sección correspondiente.",
          "🔍 ¿Podrías darme más detalles? Así puedo darte una respuesta más precisa."
        ]
      }
    };
  }

  findBestMatch(userMessage) {
    const lowerMessage = userMessage.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    for (const [category, data] of Object.entries(this.knowledgeBase)) {
      for (const pattern of data.patterns) {
        const cleanPattern = pattern.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (lowerMessage.includes(cleanPattern)) {
          return category;
        }
      }
    }
    
    return 'default';
  }

  getResponse(userMessage) {
    const category = this.findBestMatch(userMessage);
    const responses = this.knowledgeBase[category].responses;
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }
}

export const localAI = new LocalAIService();
export default localAI;