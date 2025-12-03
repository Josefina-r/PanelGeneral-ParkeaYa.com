import React, { useState, useEffect, useRef } from 'react';
import './OwnerReservations.css';

const OwnerReservations = ({ userRole }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    date: '',
    search: ''
  });
  const [selectedReservations, setSelectedReservations] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [ticketModal, setTicketModal] = useState(null);
  const [stats, setStats] = useState(null);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    // Cargar datos iniciales SIN polling automático
    loadReservations();
    loadReservationStats();

    // ✅ REMOVIDO: pollingIntervalRef y setInterval cada 5 segundos
    // El componente ahora solo carga datos al montar y cuando se ejecutan acciones

    // Cleanup innecesario ahora
    return () => {
      // Sin intervalo que limpiar
    };
  }, [filters.status, filters.date]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📋 Cargando reservas del propietario...');

      let url = `${API_BASE}/reservations/owner/reservas/`;
      const params = new URLSearchParams();

      // ✅ Enviar los parámetros que el backend espera y mapear el estado a los valores en DB
      const mapStatusToBackend = (s) => {
        if (!s || s === 'all') return null;
        const m = {
          active: 'activa',
          upcoming: 'proxima',
          completed: 'finalizada',
          cancelled: 'cancelada',
          pending: 'pendiente',
          confirmed: 'confirmada'
        };
        return m[s] || s;
      };

      const backendEstado = mapStatusToBackend(filters.status);
      if (backendEstado) params.append('estado', backendEstado);
      if (filters.date) params.append('fecha', filters.date);

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status reservations:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reservas cargadas:', data);

        let items = [];
        if (Array.isArray(data)) items = data;
        else if (data.results) items = data.results;
        else if (data.reservations) items = data.reservations;
        else items = data.data || [];

        // ✅ Normalización priorizando los campos añadidos por el backend Owner serializer
        const normalize = (r) => {
          const usuario_info = r.usuario || r.usuario_info || null;
          const usuario_nombre = r.usuario_nombre || (usuario_info && `${usuario_info.first_name || ''} ${usuario_info.last_name || ''}`.trim()) || null;
          const telefono = r.telefono_formateado || (usuario_info && (usuario_info.telefono_formateado || usuario_info.telefono)) || r.phone || r.telefono || null;
          const veh = r.vehiculo || r.vehiculo_info || {};
          const placa = r.placa || veh.placa || r.vehicle_plate || r.plate || null;
          const modelo = r.modelo || veh.modelo || r.vehicle_model || null;
          const amount = (r.costo_estimado != null) ? Number(r.costo_estimado) : ((r.amount != null) ? Number(r.amount) : (Number(r.monto) || 0));
          const start_time = r.hora_entrada || r.start_time || r.entrada || r.check_in_time || null;
          const end_time = r.hora_salida || r.end_time || r.salida || null;

          const mapStatus = (s) => {
            if (!s) return s;
            const lower = String(s).toLowerCase();
            if (['activa', 'active', 'in_progress'].includes(lower)) return 'active';
            if (['proxima', 'proximo', 'upcoming', 'confirmed', 'confirmada'].includes(lower)) return 'upcoming';
            if (['finalizada', 'finished', 'completed'].includes(lower)) return 'completed';
            if (['cancelada', 'cancelled'].includes(lower)) return 'cancelled';
            return lower;
          };

          // Detectar datos de pago por varias claves posibles
          const rawPayment = r.payment || r.pago || r.payment_info || null;

          // ✅ MEJORADO: Priorizar múltiples fuentes para monto, incluyendo fallback a amount
          const paymentFromFlat = {
            metodo: rawPayment?.metodo || r.metodo_pago || r.payment_method || r.pago_metodo || r.metodo || null,
            monto: rawPayment?.monto ?? (r.monto_pagado ?? r.payment_amount ?? r.pago_monto ?? r.amount_pagado ?? r.paid_amount ?? amount),
            moneda: rawPayment?.moneda || r.moneda || r.currency || 'PEN',
            estado: rawPayment?.estado || r.estado_pago || r.payment_status || r.pago_estado || r.payment_state || null,
            referencia_pago: rawPayment?.referencia_pago || rawPayment?.reference || r.referencia || r.payment_reference || r.reference || null,
            fecha_creacion: rawPayment?.fecha_creacion || rawPayment?.created_at || r.payment_created_at || r.pago_creado || null,
            fecha_pago: rawPayment?.fecha_pago || rawPayment?.paid_at || r.payment_paid_at || r.pago_fecha || null,
            comision_plataforma: rawPayment?.comision_plataforma ?? rawPayment?.commission ?? r.comision ?? r.commission ?? null,
            monto_propietario: rawPayment?.monto_propietario ?? rawPayment?.owner_amount ?? r.monto_propietario ?? r.net_amount ?? null
          };

          // Asegurar tipos numéricos en monto/comision/neto
          if (paymentFromFlat.monto != null) paymentFromFlat.monto = Number(paymentFromFlat.monto);
          if (paymentFromFlat.comision_plataforma != null) paymentFromFlat.comision_plataforma = Number(paymentFromFlat.comision_plataforma);
          if (paymentFromFlat.monto_propietario != null) paymentFromFlat.monto_propietario = Number(paymentFromFlat.monto_propietario);

          // ✅ MEJORADO: Si payment existe pero monto es 0/null, usar monto de reserva
          const payment = (rawPayment || paymentFromFlat.monto != null) ? {
            ...paymentFromFlat,
            // Fallback: si monto de payment es 0 o null, usar amount de reserva
            monto: (paymentFromFlat.monto && paymentFromFlat.monto > 0) ? paymentFromFlat.monto : amount
          } : null;

          // ✅ MEJORADO: Detectar estado de pago con más variantes
          const detectPaymentStatus = () => {
            if (!payment) return 'pending';
            const estado = String(payment.estado || '').toLowerCase().trim();
            if (['pagado', 'paid', 'pago'].includes(estado)) return 'pagado';
            if (['pendiente', 'pending'].includes(estado)) return 'pending';
            if (['fallido', 'failed'].includes(estado)) return 'failed';
            if (['reembolsado', 'refunded'].includes(estado)) return 'refunded';
            if (['procesando', 'processing'].includes(estado)) return 'processing';
            return estado || 'pending';
          };

          const normalized = {
            ...r,
            // Campos de usuario: preferir usuario_nombre plano
            user: usuario_info || null,
            usuario_nombre: usuario_nombre,
            phone: telefono,

            // Vehículo plano
            vehicle_plate: placa,
            vehicle_model: modelo,

            // Tiempos
            start_time: start_time,
            end_time: end_time,
            actual_start_time: r.actual_start_time || r.check_in_time || null,
            actual_end_time: r.actual_end_time || r.check_out_time || null,

            // Monto y estado
            amount: amount,
            status: mapStatus(r.estado || r.status),

            // Pago (normalizado)
            payment: payment,
            payment_status: detectPaymentStatus(),
            payment_method: payment?.metodo || r.payment_method || r.metodo_pago || null,

            // Spot
            parking_spot: r.parking_spot || r.spot || null,
            spot_number: r.spot_number || r.parking_spot?.number || r.estacionamiento?.nombre || r.spot?.number || null,

            // Asegurarse de tener codigo_reserva
            codigo_reserva: r.codigo_reserva || r.codigo || r.code || r.reservation_code || null
          };

          return normalized;
        };

        const normalizedItems = items.map(normalize);
        setReservations(normalizedItems);

        // Si el backend no devuelve estadísticas o están vacías, calcular localmente
        const computeClientStats = (list) => {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const last30 = new Date(); last30.setDate(last30.getDate() - 30);

          let total = list.length;
          let today_earnings = 0;
          let monthly_earnings = 0;
          let paidCount = 0;

          list.forEach(r => {
            const p = r.payment;
            // ✅ MEJORADO: Detectar pagados con más variantes y validar monto > 0
            const isPaid = p && (
              String(p.estado).toLowerCase().includes('pagado') ||
              String(p.estado).toLowerCase().includes('paid') ||
              String(r.payment_status).toLowerCase().includes('pagado') ||
              String(r.payment_status).toLowerCase().includes('paid')
            );

            if (isPaid) {
              const monto = Number(p.monto || 0);
              // ✅ No contar si monto es 0
              if (monto > 0) {
                paidCount += 1;
                // fecha_pago puede ser null -> considerarlo cobrado ahora
                const fechaPago = p.fecha_pago ? new Date(p.fecha_pago) : null;
                if (!fechaPago || fechaPago >= startOfToday) {
                  today_earnings += monto;
                }
                if (!fechaPago || fechaPago >= last30) {
                  monthly_earnings += monto;
                }
              }
            }
          });

          return {
            total,
            paidCount,
            today_earnings,
            monthly_earnings
          };
        };

        const clientStats = computeClientStats(normalizedItems);
        // si stats ya viene del backend (no implementado aquí) respetarlo, sino usar clientStats
        setStats(prev => {
          if (prev && (prev.today_earnings || prev.monthly_earnings)) return prev;
          return {
            total: clientStats.total,
            active: normalizedItems.filter(r => r.status === 'active' || r.status === 'in_progress').length,
            upcoming: normalizedItems.filter(r => r.status === 'upcoming' || r.status === 'confirmed').length,
            completed: normalizedItems.filter(r => r.status === 'completed' || r.status === 'finished').length,
            cancelled: normalizedItems.filter(r => r.status === 'cancelled').length,
            today_earnings: clientStats.today_earnings,
            monthly_earnings: clientStats.monthly_earnings
          };
        });

      } else {
        const errorText = await response.text();
        console.error('❌ Error en respuesta:', errorText);
        setError(`Error ${response.status} al cargar reservas`);
        setReservations([]);
      }
    } catch (error) {
      console.error('💥 Error cargando reservas:', error);
      setError('Error de conexión con el servidor');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReservationStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/reservations/dashboard/owner/stats/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📈 Estadísticas cargadas del backend:', data);
        setStats(data);
      } else {
        // ✅ SILENCIAR: No loguear errores 500 del endpoint stats
        // El frontend ya calcula stats localmente desde reservations, así que esto es opcional
        console.debug('⚠️ Endpoint stats no disponible, usando cálculo local');
        // No hacer setStats aquí - dejar que el cálculo local en loadReservations lo maneje
      }
    } catch (error) {
      // ✅ SILENCIAR: Error de conexión, ignorar sin ruido
      console.debug('⚠️ Error conectando a stats, usando cálculo local');
      // No hacer setStats aquí - dejar que loadReservations maneje
    }
  };

  const handleReservationAction = async (reservationId, action, payload = null) => {
    try {
      setActionLoading(reservationId);

      let endpoint = '';
      let method = 'POST';

      const reservation = reservations.find(r => r.id === reservationId);
      if (!reservation) {
        alert('Reserva no encontrada');
        return;
      }

      const codigoReserva = reservation.codigo_reserva || reservation.reservation_code;

      switch (action) {
        case 'check_in':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/checkin/`;
          break;
        case 'check_out':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/checkout/`;
          break;
        case 'cancel':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/cancel/`;
          break;
        case 'confirm':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/checkin/`;
          break;
        case 'validate_payment':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/validate_payment/`;
          break;
        case 'send_ticket':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/send_ticket/`;
          break;
        default:
          return;
      }

      const fetchOptions = {
        method,
        headers: getAuthHeaders()
      };
      if (payload) {
        fetchOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(endpoint, fetchOptions);

      // Si la acción es validate_payment, intentar respaldo creando el Payment si el endpoint de reservas no lo registra.
      if (action === 'validate_payment') {
        // Intentamos primero la llamada original (ya hecha). Si no ok, guardamos el error para mostrarlo.
        let reservationResult = null;
        if (response.ok) {
          reservationResult = await response.json().catch(() => null);
        } else {
          // guardar mensaje de error para mostrar más abajo
          const err = await response.json().catch(() => ({ detail: 'Error desconocido' }));
          console.warn('Error validating reservation payment:', err);
          // ✅ MEJORADO: Loguear respuesta del servidor completa
          console.error('Response body:', err);
          console.error('Reservation ID:', reservation.id);
          console.error('Codigo:', codigoReserva);
        }

        // Si la reserva ahora no tiene payment o el endpoint devolvió error, intentar crear/asegurar Payment en backend
        const shouldCreatePayment = !reservation.payment || (reservation.payment_status && String(reservation.payment_status).toLowerCase() !== 'pagado') || !response.ok;

        if (shouldCreatePayment) {
          try {
            // ✅ MEJORADO: Payload simple para el nuevo endpoint owner_validate
            const paymentPayload = {
              reserva: reservation.id,  // Solo el ID numérico
              monto: Number(payload?.monto || reservation.amount || 0),
              estado: 'pagado',
              moneda: payload?.moneda || (reservation.payment?.moneda || 'PEN'),
              metodo: 'manual',
              referencia_pago: 'validado_por_owner'
            };

            console.log('📤 Sending payment payload:', paymentPayload);

            // ✅ USAR NUEVO ENDPOINT: owner_validate en lugar de /payments/
            const payRes = await fetch(`${API_BASE}/payments/owner_validate/`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify(paymentPayload)
            });

            if (payRes.ok) {
              const payData = await payRes.json().catch(() => null);
              console.log('✅ Payment creado/asegurado:', payData);

              // ✅ MEJORADO: Actualizar estado local inmediatamente para reflejar el pago en UI
              setReservations(prev => prev.map(r => {
                if (r.id === reservation.id) {
                  const paymentObj = payData || {
                    metodo: paymentPayload.metodo,
                    monto: Number(paymentPayload.monto),
                    moneda: paymentPayload.moneda,
                    estado: paymentPayload.estado,
                    referencia_pago: paymentPayload.referencia_pago,
                    fecha_creacion: new Date().toISOString(),
                    fecha_pago: new Date().toISOString(),
                    comision_plataforma: null,
                    monto_propietario: null
                  };
                  return {
                    ...r,
                    payment: paymentObj,
                    payment_status: paymentObj.estado || 'pagado',
                    payment_method: paymentObj.metodo
                  };
                }
                return r;
              }));

              // ✅ IMPORTANTE: Solo recargar stats, NO reservations (ya actualizadas localmente)
              await loadReservationStats();
              setSelectedReservations([]);
              alert('Pago validado y registrado correctamente.');

              // --- NUEVO: Crear ticket para la app del usuario ---
              try {
                const ticketPayload = {
                  reserva: reservation.id,
                  usuario: reservation.user?.id || reservation.user_id || null,
                  tipo_ticket: 'pago_validado',
                  estado: 'valido',
                  datos_adicionales: {
                    validado_por: 'owner',
                    monto: Number(paymentPayload.monto),
                    metodo_pago: paymentPayload.metodo,
                    referencia: paymentPayload.referencia_pago || `ticket_owner_${Date.now()}`
                  }
                };

                console.log('📤 Creando ticket para app móvil:', ticketPayload);

                const ticketRes = await fetch(`${API_BASE}/tickets/tickets/create-for-reservation/`, {
                  method: 'POST',
                  headers: getAuthHeaders(),
                  body: JSON.stringify(ticketPayload)
                });

                if (ticketRes.ok) {
                  const ticketData = await ticketRes.json().catch(() => null);
                  console.log('✅ Ticket creado para app:', ticketData);
                  // Guardar ticket en el estado de la reserva para permitir visualizarlo
                  setReservations(prev => prev.map(r => {
                    if (r.id === reservation.id) {
                      return { ...r, ticket: ticketData };
                    }
                    return r;
                  }));
                } else {
                  const errText = await ticketRes.text().catch(() => '');
                  console.warn('⚠️ Error creando ticket:', ticketRes.status, errText);
                  // No bloquear flujo al owner; notificar apenas si desea
                }
              } catch (ticketErr) {
                console.error('Error creando ticket para app:', ticketErr);
              }
            } else {
              // ✅ MEJORADO: Loguear error 400 completo
              const payErr = await payRes.json().catch(() => ({ detail: 'Error creando payment' }));
              console.warn('❌ Error en owner_validate (400):', payErr);
              console.error('Payment payload que causó error:', paymentPayload);
              console.error('Response status:', payRes.status);

              if (!response.ok) {
                alert(`Error al validar pago: ${payErr.detail || 'Error del servidor'}`);
              } else {
                alert('Validación realizada pero no se pudo crear registro de pago (revise panel).');
              }
            }
          } catch (err) {
            console.error('Error creando payment fallback:', err);
            alert('Error de conexión al intentar crear registro de pago.');
          } finally {
            setActionLoading(null);
          }

          return;
        }
        // Si no necesitamos crear payment de respaldo, continuar con el flujo estándar de refresco.
      }

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Acción ${action} exitosa:`, result);

        // ✅ MEJORADO: Solo recargar si NO es validate_payment
        // validate_payment ya actualiza el estado local, no necesita recargar
        if (action !== 'validate_payment' && action !== 'send_ticket') {
          await loadReservations();
          await loadReservationStats();
        }

        setSelectedReservations([]);
        alert(`Reserva ${action === 'check_in' ? 'check-in' : action === 'check_out' ? 'check-out' : action} exitosa`);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Error desconocido' }));
        alert(`Error al ${action} reserva: ${errorData.detail || 'Error del servidor'}`);
      }
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      alert('Error de conexión al procesar la acción');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedReservations.length === 0) {
      alert('Selecciona al menos una reserva');
      return;
    }

    try {
      setActionLoading('bulk');

      const promises = selectedReservations.map(reservationId =>
        handleReservationAction(reservationId, action)
      );

      await Promise.all(promises);

    } catch (error) {
      console.error('Error en acción masiva:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleReservationSelection = (reservationId) => {
    setSelectedReservations(prev =>
      prev.includes(reservationId)
        ? prev.filter(id => id !== reservationId)
        : [...prev, reservationId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReservations.length === filteredReservations.length) {
      setSelectedReservations([]);
    } else {
      setSelectedReservations(filteredReservations.map(res => res.id));
    }
  };

  const filteredReservations = reservations.filter(reservation => {
    const matchesStatus = filters.status === 'all' || reservation.status === filters.status;

    const searchTerm = filters.search.toLowerCase();
    const matchesSearch = searchTerm === '' ||
      // Buscar por codigo_reserva (siempre disponible gracias al serializer del backend)
      (reservation.codigo_reserva && reservation.codigo_reserva.toLowerCase().includes(searchTerm)) ||
      (reservation.reservation_code && reservation.reservation_code.toLowerCase().includes(searchTerm)) ||
      // Buscar por nombre plano provisto por el backend
      (reservation.usuario_nombre && reservation.usuario_nombre.toLowerCase().includes(searchTerm)) ||
      (reservation.user?.first_name && reservation.user.first_name.toLowerCase().includes(searchTerm)) ||
      (reservation.user?.last_name && reservation.user.last_name.toLowerCase().includes(searchTerm)) ||
      // Buscar por placa
      (reservation.placa && reservation.placa.toLowerCase().includes(searchTerm)) ||
      (reservation.vehicle_plate && reservation.vehicle_plate.toLowerCase().includes(searchTerm));

    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (amount) => {
    const value = Number(amount || 0);
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(value);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '--/--/---- --:--';
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statuses = {
      active: { label: 'Activa', class: 'status-active', icon: 'fas fa-play-circle' },
      upcoming: { label: 'Próxima', class: 'status-upcoming', icon: 'fas fa-clock' },
      completed: { label: 'Completada', class: 'status-completed', icon: 'fas fa-check-circle' },
      cancelled: { label: 'Cancelada', class: 'status-cancelled', icon: 'fas fa-times-circle' },
      pending: { label: 'Pendiente', class: 'status-pending', icon: 'fas fa-hourglass-half' },
      confirmed: { label: 'Confirmada', class: 'status-confirmed', icon: 'fas fa-check-circle' },
      in_progress: { label: 'En Progreso', class: 'status-active', icon: 'fas fa-play-circle' },
      finished: { label: 'Finalizada', class: 'status-completed', icon: 'fas fa-check-circle' }
    };
    return statuses[status] || { label: status || 'Desconocido', class: 'status-unknown', icon: '' };
  };

  const getPaymentStatusBadge = (status) => {
    const statuses = {
      pagado: { label: 'Pagado', class: 'payment-paid', icon: 'fas fa-check' },
      pendiente: { label: 'Pendiente', class: 'payment-pending', icon: 'fas fa-clock' },
      fallido: { label: 'Fallido', class: 'payment-failed', icon: 'fas fa-times' },
      reembolsado: { label: 'Reembolsado', class: 'payment-refunded', icon: 'fas fa-undo' },
      procesando: { label: 'Procesando', class: 'payment-processing', icon: 'fas fa-sync' },
      paid: { label: 'Pagado', class: 'payment-paid', icon: 'fas fa-check' },
      pending: { label: 'Pendiente', class: 'payment-pending', icon: 'fas fa-clock' },
      failed: { label: 'Fallido', class: 'payment-failed', icon: 'fas fa-times' },
      refunded: { label: 'Reembolsado', class: 'payment-refunded', icon: 'fas fa-undo' },
      partially_paid: { label: 'Pago Parcial', class: 'payment-partial', icon: 'fas fa-exclamation-circle' }
    };
    return statuses[status] || { label: status || 'No especificado', class: 'payment-unknown', icon: '' };
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '--:--';
    const startTime = new Date(start);
    const endTime = new Date(end);
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleExport = (type) => {
    alert(`Exportando ${type}...`);
  };

  if (loading) {
    return (
      <div className="owner-reservations-loading">
        <div className="loading-spinner"></div>
        <p>Cargando reservas...</p>
      </div>
    );
  }

  return (
    <div className="owner-reservations">
      <div className="owner-reservations-header">
        <div className="header-content">
          <h1>Gestión de Reservas</h1>
          <p>Administra y controla todas las reservas de tu estacionamiento</p>
        </div>
        <button onClick={loadReservations} className="refresh-btn">
          <i className="fas fa-sync"></i>
          Actualizar
        </button>
      </div>

      <div className="reservations-stats">
        <div className="stat-card total">
          <div className="stat-icon">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <div className="stat-content">
            <h3>{stats?.total || reservations.length}</h3>
            <p>Total Reservas</p>
          </div>
        </div>

        <div className="stat-card active">
          <div className="stat-icon">
            <i className="fas fa-play-circle"></i>
          </div>
          <div className="stat-content">
            <h3>{stats?.active || reservations.filter(r => r.status === 'active' || r.status === 'in_progress').length}</h3>
            <p>Activas Ahora</p>
          </div>
        </div>

        <div className="stat-card upcoming">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <h3>{stats?.upcoming || reservations.filter(r => r.status === 'upcoming' || r.status === 'confirmed').length}</h3>
            <p>Próximas</p>
          </div>
        </div>

        <div className="stat-card earnings">
          <div className="stat-icon">
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <div className="stat-content">
            <h3>{formatCurrency(stats?.today_earnings)}</h3>
            <p>Ingresos Hoy</p>
          </div>
        </div>
      </div>

      <div className="reservations-controls">
        <div className="filters-section">
          <div className="filter-group">
            <label>Filtrar por Estado:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="upcoming">Próximas</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmadas</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Filtrar por Fecha:</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="filter-group">
            <label>Buscar:</label>
            <input
              type="text"
              placeholder="Código, nombre o placa..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>

        {selectedReservations.length > 0 && (
          <div className="bulk-actions">
            <span>{selectedReservations.length} reservas seleccionadas</span>
            <div className="bulk-buttons">
              <button
                className="btn-confirm"
                onClick={() => handleBulkAction('confirm')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Confirmar Seleccionadas'}
              </button>
              <button
                className="btn-cancel"
                onClick={() => handleBulkAction('cancel')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Cancelar Seleccionadas'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="reservations-list">
        {filteredReservations.length > 0 && (
          <div className="reservations-header">
            <div className="select-all">
              <input
                type="checkbox"
                checked={selectedReservations.length === filteredReservations.length && filteredReservations.length > 0}
                onChange={toggleSelectAll}
              />
              <span>Seleccionar todas</span>
            </div>
            <div className="reservations-count">
              {filteredReservations.length} reserva{filteredReservations.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {filteredReservations.map(reservation => {
          const statusInfo = getStatusBadge(reservation.status);
          const paymentInfo = getPaymentStatusBadge(reservation.payment_status);
          const duration = calculateDuration(reservation.start_time, reservation.end_time);
          const reservationCode = reservation.codigo_reserva || reservation.reservation_code;

          return (
            <div key={reservation.id} className={`reservation-card ${reservation.status}`}>
              <div className="reservation-header">
                <div className="reservation-info">
                  <div className="reservation-code">
                    <h4>{reservationCode}</h4>
                    <span className="created-at">
                      Creada: {formatDateTime(reservation.created_at)}
                    </span>
                  </div>

                  <div className="reservation-badges">
                    <span className={`status-badge ${statusInfo.class}`}>
                      {statusInfo.icon && <i className={statusInfo.icon}></i>}
                      {statusInfo.label}
                    </span>
                    <span className={`payment-badge ${paymentInfo.class}`}>
                      {paymentInfo.icon && <i className={paymentInfo.icon}></i>}
                      {paymentInfo.label}
                    </span>
                  </div>
                </div>

                <div className="reservation-selection">
                  <input
                    type="checkbox"
                    checked={selectedReservations.includes(reservation.id)}
                    onChange={() => toggleReservationSelection(reservation.id)}
                  />
                </div>
              </div>

              <div className="reservation-details">
                <div className="user-info">
                  <div className="user-main">
                    <strong>
                      {/* Mostrar nombre preferente provisto por backend */}
                      {reservation.usuario_nombre || (reservation.user?.first_name || 'Usuario')} {reservation.user?.last_name || ''}
                    </strong>
                    <span className="user-contact">
                      <i className="fas fa-phone"></i>
                      {reservation.user?.phone || reservation.phone || 'No disponible'}
                    </span>
                  </div>
                  <div className="vehicle-info">
                    <span className="vehicle-plate">
                      {reservation.placa || reservation.user?.vehicle_plate || reservation.vehicle_plate || 'N/A'}
                    </span>
                    <span className="vehicle-model">
                      {reservation.user?.vehicle_model || reservation.vehicle_model || ''}
                    </span>
                  </div>
                </div>

                <div className="time-info">
                  <div className="time-slot">
                    <div className="time-item">
                      <i className="fas fa-play"></i>
                      <div>
                        <strong>Inicio</strong>
                        <span>{formatDateTime(reservation.start_time)}</span>
                        {reservation.actual_start_time && (
                          <small className="actual-time">
                            Real: {formatTime(reservation.actual_start_time)}
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="time-item">
                      <i className="fas fa-stop"></i>
                      <div>
                        <strong>Fin</strong>
                        <span>{formatDateTime(reservation.end_time)}</span>
                        {reservation.actual_end_time && (
                          <small className="actual-time">
                            Real: {formatTime(reservation.actual_end_time)}
                          </small>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="duration-info">
                    <span className="duration">{duration}</span>
                    <span className="spot">
                      Espacio: {reservation.spot_number || reservation.parking_spot?.number || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* ✅ AGREGAR: Información del pago */}
                {reservation.payment && (
                  <div className="payment-details">
                    <h5>
                      <i className="fas fa-credit-card"></i> Información de Pago
                    </h5>
                    <div className="payment-grid">
                      <div className="payment-item">
                        <strong>Método:</strong>
                        <span className="payment-method">
                          {reservation.payment.metodo === 'yape' && <i className="fas fa-mobile-alt"></i>}
                          {reservation.payment.metodo === 'plin' && <i className="fas fa-wallet"></i>}
                          {reservation.payment.metodo === 'tarjeta' && <i className="fas fa-credit-card"></i>}
                          {reservation.payment.metodo}
                        </span>
                      </div>
                      <div className="payment-item">
                        <strong>Monto:</strong>
                        <span className="payment-amount">
                          {formatCurrency(reservation.payment.monto)}
                        </span>
                      </div>
                      <div className="payment-item">
                        <strong>Estado:</strong>
                        <span className={`payment-status ${reservation.payment.estado || reservation.payment_status}`}>
                          {reservation.payment.estado || reservation.payment_status}
                        </span>
                      </div>
                      <div className="payment-item">
                        <strong>Referencia:</strong>
                        <span className="payment-reference">
                          {reservation.payment.referencia_pago}
                        </span>
                      </div>
                      {reservation.payment.fecha_pago && (
                        <div className="payment-item full-width">
                          <strong>Fecha de pago:</strong>
                          <span>{formatDateTime(reservation.payment.fecha_pago)}</span>
                        </div>
                      )}
                      {reservation.payment.comision_plataforma != null && (
                        <div className="payment-item">
                          <strong>Comisión:</strong>
                          <span>{formatCurrency(reservation.payment.comision_plataforma)}</span>
                        </div>
                      )}
                      {reservation.payment.monto_propietario != null && (
                        <div className="payment-item">
                          <strong>Neto:</strong>
                          <span>{formatCurrency(reservation.payment.monto_propietario)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="payment-info">
                  <div className="amount">
                    <strong>{formatCurrency(reservation.amount)}</strong>
                    {!reservation.payment && (
                      <span className="no-payment">
                        <i className="fas fa-clock"></i>
                        Pendiente de pago
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {reservation.notes && (
                <div className="reservation-notes">
                  <i className="fas fa-sticky-note"></i>
                  <span>{reservation.notes}</span>
                </div>
              )}

              <div className="reservation-actions">
                {(reservation.status === 'upcoming' || reservation.status === 'pending' || reservation.status === 'confirmed') && (
                  <>
                    <button
                      className="btn-check-in"
                      onClick={() => handleReservationAction(reservation.id, 'check_in')}
                      disabled={actionLoading === reservation.id}
                    >
                      {actionLoading === reservation.id ? '...' : 'Check-in'}
                    </button>
                    <button
                      className="btn-cancel"
                      onClick={() => handleReservationAction(reservation.id, 'cancel')}
                      disabled={actionLoading === reservation.id}
                    >
                      {actionLoading === reservation.id ? '...' : 'Cancelar'}
                    </button>
                  </>
                )}

                {/* Botón para que el owner valide pago manualmente si está pendiente */}
                {(!reservation.payment || reservation.payment_status === 'pending') && (
                  <button
                    className="btn-validate-payment"
                    onClick={() => {
                      // ✅ CAMBIO: eliminar prompt. Validación automática usando monto de la reserva.
                      const montoDefault = Number(reservation.amount || 0);
                      const payload = {
                        monto: montoDefault,
                        estado: 'pagado',
                        moneda: reservation.payment?.moneda || 'PEN'
                      };
                      // Llamar al flujo normal (handleReservationAction) sin preguntar nada al owner
                      handleReservationAction(reservation.id, 'validate_payment', payload);
                    }}
                    disabled={actionLoading === reservation.id}
                  >
                    {actionLoading === reservation.id ? '...' : 'Validar Pago'}
                  </button>
                )}

                {/* Botón para enviar/guardar ticket (si ya existe info de pago o después de validar) */}
                <button
                  className="btn-send-ticket"
                  onClick={async () => {
                    // Envío automático de ticket a la app móvil sin prompt
                    setActionLoading(reservation.id);
                    try {
                      const ticketPayload = {
                        reserva: reservation.id,
                        usuario: reservation.user?.id || reservation.user_id || null,
                        tipo: 'pago_validado',
                        estado: 'valido',
                        datos_adicionales: {
                          creado_por: 'owner_panel',
                          nota: 'Ticket generado por propietario desde panel web'
                        },
                        notas: `Creado por owner desde panel - ${new Date().toISOString()}`
                      };

                      console.log('📤 Creando ticket (owner):', ticketPayload);
                      const res = await fetch(`${API_BASE}/tickets/tickets/create-for-reservation/`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(ticketPayload)
                      });

                      if (res.ok) {
                        const ticketData = await res.json().catch(() => null);
                        console.log('✅ Ticket creado para app:', ticketData);
                        // Guardar ticket en la reserva local y añadir nota
                        setReservations(prev => prev.map(r => {
                          if (r.id === reservation.id) {
                            return {
                              ...r,
                              ticket: ticketData,
                              notes: (r.notes ? r.notes + '\n' : '') + `Ticket creado: ${ticketData?.codigo_ticket || ticketData?.id || 'OK'}`
                            };
                          }
                          return r;
                        }));
                        alert('Ticket creado y enviado a la app móvil del usuario.');
                      } else {
                        const txt = await res.text().catch(() => '');
                        console.warn('⚠️ Error creando ticket:', res.status, txt);
                        alert('No se pudo crear el ticket (revisa el panel).');
                      }
                    } catch (err) {
                      console.error('Error creando ticket:', err);
                      alert('Error de conexión al crear ticket.');
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  disabled={actionLoading === reservation.id}
                >
                  {actionLoading === reservation.id ? '...' : 'Enviar Ticket'}
                </button>
                {/* Mostrar botón Ver Ticket si existe ticket en la reserva */}
                {reservation.ticket && (
                  <button
                    className="btn-view-ticket"
                    onClick={() => setTicketModal(reservation.ticket)}
                  >
                    <i className="fas fa-ticket-alt"></i> Ver Ticket
                  </button>
                )
                }
              </div>
            </div>
          );
        })}

        {filteredReservations.length === 0 && (
          <div className="no-reservations">
            <i className="fas fa-calendar-times"></i>
            <h3>No hay reservas</h3>
            <p>{reservations.length === 0 ? 'No hay reservas en tu estacionamiento' : 'No se encontraron reservas con los filtros aplicados'}</p>
            <button onClick={() => setFilters({ status: 'all', date: '', search: '' })} className="btn-clear-filters">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <div className="global-actions">
        <button
          className="btn-export"
          onClick={() => handleExport('reservations')}
        >
          <i className="fas fa-download"></i>
          Exportar Reporte
        </button>

        <button
          className="btn-print"
          onClick={() => window.print()}
        >
          <i className="fas fa-print"></i>
          Imprimir Lista
        </button>
      </div>

      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles de la Reserva</h2>
              <button className="close-btn" onClick={() => setViewModal(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Información General</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Código:</strong>
                    <span>{viewModal.codigo_reserva || viewModal.reservation_code}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Estado:</strong>
                    <span className={`status-badge ${getStatusBadge(viewModal.status).class}`}>
                      {getStatusBadge(viewModal.status).label}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Monto:</strong>
                    <span>{formatCurrency(viewModal.amount)}</span>
                  </div>
                </div>
              </div>

              {/* ✅ AGREGAR: Sección de información del pago en el modal */}
              {viewModal.payment && (
                <div className="detail-section">
                  <h3>Información de Pago</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Método:</strong>
                      <span>
                        {viewModal.payment.metodo === 'yape' && <i className="fas fa-mobile-alt"></i>}
                        {viewModal.payment.metodo === 'plin' && <i className="fas fa-wallet"></i>}
                        {viewModal.payment.metodo === 'tarjeta' && <i className="fas fa-credit-card"></i>}
                        {' '}{viewModal.payment.metodo}
                      </span>
                    </div>
                    <div className="detail-item">
                      <strong>Monto:</strong>
                      <span>{formatCurrency(viewModal.payment.monto)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Estado:</strong>
                      <span className={`payment-badge ${getPaymentStatusBadge(viewModal.payment.estado || viewModal.payment_status).class}`}>
                        {getPaymentStatusBadge(viewModal.payment.estado || viewModal.payment_status).icon && (
                          <i className={getPaymentStatusBadge(viewModal.payment.estado || viewModal.payment_status).icon}></i>
                        )}
                        {getPaymentStatusBadge(viewModal.payment.estado || viewModal.payment_status).label}
                      </span>
                    </div>
                    <div className="detail-item">
                      <strong>Referencia:</strong>
                      <span>{viewModal.payment.referencia_pago}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Fecha creación:</strong>
                      <span>{formatDateTime(viewModal.payment.fecha_creacion)}</span>
                    </div>
                    {viewModal.payment.fecha_pago && (
                      <div className="detail-item">
                        <strong>Fecha pago:</strong>
                        <span>{formatDateTime(viewModal.payment.fecha_pago)}</span>
                      </div>
                    )}
                    {viewModal.payment.comision_plataforma != null && (
                      <div className="detail-item">
                        <strong>Comisión plataforma:</strong>
                        <span>{formatCurrency(viewModal.payment.comision_plataforma)}</span>
                      </div>
                    )}
                    {viewModal.payment.monto_propietario != null && (
                      <div className="detail-item">
                        <strong>Monto propietario:</strong>
                        <span>{formatCurrency(viewModal.payment.monto_propietario)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Información del Cliente</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Nombre:</strong>
                    <span>{viewModal.user?.first_name || 'Usuario'} {viewModal.user?.last_name || ''}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Email:</strong>
                    <span>{viewModal.user?.email || viewModal.email || 'No disponible'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Teléfono:</strong>
                    <span>{viewModal.user?.phone || viewModal.phone || 'No disponible'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Vehículo:</strong>
                    <span>
                      {viewModal.user?.vehicle_model || viewModal.vehicle_model || 'Modelo no especificado'}
                      ({viewModal.user?.vehicle_plate || viewModal.vehicle_plate || 'N/A'})
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Detalles de Tiempo</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Inicio Programado:</strong>
                    <span>{formatDateTime(viewModal.start_time)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Fin Programado:</strong>
                    <span>{formatDateTime(viewModal.end_time)}</span>
                  </div>
                  {viewModal.actual_start_time && (
                    <div className="detail-item">
                      <strong>Check-in Real:</strong>
                      <span>{formatDateTime(viewModal.actual_start_time)}</span>
                    </div>
                  )}
                  {viewModal.actual_end_time && (
                    <div className="detail-item">
                      <strong>Check-out Real:</strong>
                      <span>{formatDateTime(viewModal.actual_end_time)}</span>
                    </div>
                  )}
                </div>
              </div>

              {viewModal.notes && (
                <div className="detail-section">
                  <h3>Notas</h3>
                  <p>{viewModal.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver ticket */}
      {ticketModal && (
        <div className="modal-overlay" onClick={() => setTicketModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ticket: {ticketModal.codigo_ticket || ticketModal.id}</h2>
              <button className="close-btn" onClick={() => setTicketModal(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><strong>Tipo:</strong> {ticketModal.tipo}</div>
                <div className="detail-item"><strong>Estado:</strong> {ticketModal.estado}</div>
                <div className="detail-item"><strong>Emitido:</strong> {formatDateTime(ticketModal.fecha_emision)}</div>
                <div className="detail-item"><strong>Válido hasta:</strong> {formatDateTime(ticketModal.fecha_validez_hasta)}</div>
                {ticketModal.qr_image_url && (
                  <div className="detail-item full-width">
                    <strong>QR:</strong>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <img src={ticketModal.qr_image_url} alt="QR Ticket" style={{ maxWidth: '100%', height: 'auto' }} />
                    </div>
                  </div>
                )}
                {ticketModal.datos_adicionales && (
                  <div className="detail-item full-width">
                    <strong>Datos adicionales:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(ticketModal.datos_adicionales, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default OwnerReservations;