import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { DateTime } from 'luxon';
import {
  Search, Send, User, MapPin, MoreVertical, CheckCheck,
  MessageSquare, Users, Radio, CircleDashed, Settings,
  Smile, Paperclip, Mic, Plus, ChevronLeft, X, Zap, AlertCircle,
  Building2, Phone, Calendar, BellOff, Ban, Trash2, Image as ImageIcon, ChevronRight
} from 'lucide-react';

const fmtTime = (iso) => DateTime.fromISO(iso).setLocale('es').toFormat('h:mm a');
const fmtDate = (iso) => {
  const d = DateTime.fromISO(iso).setLocale('es');
  const now = DateTime.now();
  if (d.hasSame(now, 'day')) return 'HOY';
  if (d.hasSame(now.minus({ days: 1 }), 'day')) return 'AYER';
  return d.toFormat("d 'de' LLLL");
};
const avatarUrl = (name, bg = 'random') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&bold=true&size=200`;

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages]  = useState([]);
  const [draft, setDraft]        = useState('');
  const [search, setSearch]      = useState('');
  const [msgSearch, setMsgSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [tab, setTab] = useState('chats');
  const [searchTermEmp, setSearchTermEmp] = useState('');
  const [bulkTemplateName, setBulkTemplateName] = useState('invitacion_empleado');
  const [newChatData, setNewChatData] = useState({ phone: '', name: '', template: 'invitacion_empleado' });
  const [unreadCounts, setUnreadCounts] = useState({});
  const bottomRef = useRef(null);
  const selectedPhoneRef = useRef(null);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  useEffect(() => {
    fetchConversations();
    fetchEmployees();
    
    const sub = supabase.channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        fetchConversations(); // Nos aseguramos de llamar la función correcta para reordenar
        
        if (newMsg.phone_number === selectedPhoneRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (newMsg.is_from_user) {
          // Si el mensaje es de un usuario y NO tenemos el chat abierto, sumamos al globo
          setUnreadCounts(prev => ({
            ...prev,
            [newMsg.phone_number]: (prev[newMsg.phone_number] || 0) + 1
          }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const updated = payload.new;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m));
        setConversations(prev => prev.map(c => c.phone_number === updated.phone_number ? { ...c, status: updated.status } : c));
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  useEffect(() => {
    if (!selectedPhone) return;
    loadMessages(selectedPhone);
    loadProfile(selectedPhone);
    setShowMsgSearch(false);
    setMsgSearch('');
    
    // Al abrir el chat, reiniciamos el contador de no leídos a 0
    setUnreadCounts(prev => ({ ...prev, [selectedPhone]: 0 }));
  }, [selectedPhone]);

  // Manejar tecla ESC para cerrar el chat actual
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedPhone(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchConversations() {
    const { data: msgs } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: false });
    if (!msgs) return;
    
    // Obtener teléfonos únicos de los mensajes
    const phones = [...new Set(msgs.map(m => m.phone_number))];
    // Obtener todos los perfiles para garantizar el cruce perfecto de números
    const { data: profs } = await supabase.from('profiles').select('phone_number, full_name, role');
      
    // Mapear ignorando cualquier espacio, '+' o guion
    const map = Object.fromEntries((profs || []).map(p => {
      const clean = p.phone_number ? p.phone_number.replace(/\D/g, '') : '';
      return [clean, p];
    }));
    
    const seen = new Set();
    const convList = [];
    for (const m of msgs) {
      if (!seen.has(m.phone_number)) {
        seen.add(m.phone_number);
        const inboundMsg = msgs.find(x => x.phone_number === m.phone_number && x.is_from_user && x.push_name);
        
        // Limpiar el número del mensaje (por si acaso) para buscar en el mapa
        const cleanPhone = m.phone_number.replace(/\D/g, '');
        
        convList.push({
          ...m,
          push_name: inboundMsg?.push_name || null,
          user_info: map[cleanPhone] ?? { full_name: `+${m.phone_number}`, role: 'externo' }
        });
      }
    }
    setConversations(convList);
  }

  async function fetchEmployees() {
    try {
      const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/webhook/employees-list`);
      if (r.ok) setEmployees(await r.json());
    } catch (err) {
      console.warn('[dashboard] Error al cargar empleados');
    }
  }

  async function loadMessages(phone) {
    const { data } = await supabase.from('chat_messages').select('*').eq('phone_number', phone).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function loadProfile(phone) {
    const { data } = await supabase.from('profiles').select('*, companies(name), locations(name)').eq('phone_number', phone).maybeSingle();
    setSelectedUser(data ?? null);
  }

  async function send(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !selectedPhone) return;
    setDraft('');
    
    // Solo pedimos al backend que envíe. El backend lo guardará y nos llegará por Realtime.
    const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/webhook/meta-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: selectedPhone, text: body })
    }).catch(() => null);
    if (r && !r.ok) console.warn('[dashboard] Error al enviar mensaje de texto');
  }

  async function sendTemplate(templateName) {
    if (!selectedPhone) return;
    setShowTemplateMenu(false);

    // Busca el mejor nombre para el contacto desde el perfil o el push_name
    const conv = conversations.find(c => c.phone_number === selectedPhone);
    const nombre = selectedUser?.full_name
      || conv?.push_name
      || `+${selectedPhone}`;

    const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/webhook/meta-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: selectedPhone, templateName, employeeName: nombre })
    }).catch(() => null);

    if (!r || !r.ok) {
      alert('❌ Error al enviar la plantilla. Verifica que el número sea válido y que la plantilla esté activa.');
    } else {
      // Si enviamos a un número nuevo, esperamos un momento y forzamos refresco de conversaciones
      setTimeout(() => fetchConversations(), 1500);
    }
  }

  async function handleNewChatSubmit(e) {
    e.preventDefault();
    const { phone, name, template } = newChatData;
    if (!phone || !name) return alert('Por favor llena todos los campos');
    
    // Limpiar número
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) return alert('Número de teléfono inválido');

    await sendTemplateManual(cleanPhone, template, name);
    setShowNewChatModal(false);
    setNewChatData({ phone: '', name: '', template: 'invitacion_empleado' });
    setSelectedPhone(cleanPhone);
  }

  async function sendTemplateManual(phone, templateName, employeeName) {
    const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/webhook/meta-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, templateName, employeeName })
    }).catch(() => null);

    if (!r || !r.ok) {
      alert('❌ Error al enviar. Verifica tu conexión y que el número sea correcto.');
    } else {
      setTimeout(() => fetchConversations(), 1500);
    }
  }

  async function sendBulkTemplates() {
    if (selectedEmployees.length === 0) return;
    if (!confirm(`¿Estás seguro de enviar invitaciones a ${selectedEmployees.length} empleados?`)) return;

    setIsBulkSending(true);
    const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/webhook/meta-bulk-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        employees: selectedEmployees, 
        templateName: bulkTemplateName 
      })
    }).catch(() => null);

    if (r && r.ok) {
      alert(`🚀 Envío masivo iniciado. La plantilla "${bulkTemplateName}" se enviará a ${selectedEmployees.length} empleados cada 2 segundos.`);
      setSelectedEmployees([]);
      setShowBulkModal(false);
    } else {
      alert('❌ Error al iniciar el envío masivo.');
    }
    setIsBulkSending(false);
  }

  const toggleEmployeeSelection = (emp) => {
    const phone = emp.phone_number.replace(/\D/g, '');
    setSelectedEmployees(prev => {
      const exists = prev.find(e => e.phone === phone);
      if (exists) return prev.filter(e => e.phone !== phone);
      return [...prev, { phone, name: emp.full_name }];
    });
  };

  const toggleSelectAll = (filtered) => {
    if (selectedEmployees.length === filtered.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filtered.map(emp => ({
        phone: emp.phone_number.replace(/\D/g, ''),
        name: emp.full_name
      })));
    }
  };

  function getBestName(conv) {
    if (conv.user_info?.full_name && !conv.user_info.full_name.startsWith('+')) return conv.user_info.full_name;
    if (conv.push_name) return conv.push_name;
    return `+${conv.phone_number}`;
  }

  const filteredConversations = conversations.filter(c =>
    getBestName(c).toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search)
  );

  const filteredMessages = messages.filter(m => 
    m.body.toLowerCase().includes(msgSearch.toLowerCase())
  );

  const grouped = [];
  let lastDate = null;
  const msgsToRender = msgSearch ? filteredMessages : messages;
  for (const m of msgsToRender) {
    const d = fmtDate(m.created_at);
    if (d !== lastDate) { grouped.push({ type: 'date', label: d, id: d + m.id }); lastDate = d; }
    grouped.push({ type: 'msg', ...m });
  }

  const activeConv = conversations.find(c => c.phone_number === selectedPhone);
  const activeName = activeConv ? getBestName(activeConv) : `+${selectedPhone}`;

  // Lógica de "En línea" (Simulada: si escribió en los últimos 5 min)
  const isOnline = activeConv && DateTime.fromISO(activeConv.created_at) > DateTime.now().minus({ minutes: 5 });

  return (
    <div className="app">
      
      {/* ======= SIDEBAR ======= */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sb-logo">
            <div className="avatar-sm"><img src={avatarUrl('Admin', '00a884')} alt="" /></div>
            <div>
              <div className="sb-logo-name">Admin Panel</div>
              <div className="sb-logo-status">Online</div>
            </div>
          </div>
          <div className="sb-icons">
            <button onClick={() => setTab('chats')} className={tab === 'chats' ? 'active' : ''}><MessageSquare size={20} /></button>
            <button onClick={() => setShowBulkModal(true)} title="Envío Masivo"><Users size={20} /></button>
            <MoreVertical size={20} />
          </div>
        </div>

        <div className="search-wrap">
          <div className="search-box">
            <Search size={17} color="var(--c-muted)" />
            <input type="text" placeholder="Search or start new chat" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button 
            className="sidebar-btn-plus" 
            title="Nuevo mensaje / Enviar plantilla"
            onClick={() => setShowNewChatModal(true)}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', 
              color: 'var(--c-muted)', padding: '5px', display: 'flex', 
              alignItems: 'center', marginLeft: '5px' 
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--c-muted)'}
          >
            <Plus size={22} />
          </button>
        </div>

        <nav className="nav-tabs">
          <div className="nav-tab active"><MessageSquare size={18} /><span>Chats</span></div>
          <div className="nav-tab"><CircleDashed size={18} /><span>Status</span></div>
          <div className="nav-tab"><Radio size={18} /><span>Channels</span></div>
          <div className="nav-tab"><Users size={18} /><span>Communities</span></div>
        </nav>

        <div className="chat-list">
          {filteredConversations.map(c => (
            <div key={c.id} className={`chat-row${selectedPhone === c.phone_number ? ' selected' : ''}`} onClick={() => setSelectedPhone(c.phone_number)}>
              <div className="avatar"><img src={avatarUrl(getBestName(c))} alt="" /></div>
              <div className="chat-row-info">
                <div className="chat-row-top">
                  <span className="chat-row-name">
                    {getBestName(c)}
                    {c.user_info?.role && c.user_info.role !== 'externo' && (
                      <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--c-accent)', fontWeight: 700 }}>✓</span>
                    )}
                  </span>
                  <span className="chat-row-time">{fmtTime(c.created_at)}</span>
                </div>
                <div className="chat-row-preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    {!c.is_from_user && (
                      <span style={{ marginRight: '4px', display: 'flex', alignItems: 'center' }}>
                        {c.status === 'read' ? (
                          <CheckCheck size={14} color="#53bdeb" />
                        ) : c.status === 'failed' ? (
                          <AlertCircle size={14} color="#ef4444" />
                        ) : c.status === 'delivered' ? (
                          <CheckCheck size={14} color="var(--c-muted)" />
                        ) : (
                          <CheckCheck size={14} style={{ opacity: 0.5 }} color="var(--c-muted)" />
                        )}
                      </span>
                    )}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.type === 'location' ? '📍 Ubicación compartida' : 
                       c.body ? c.body : 
                       c.type === 'template' ? `[Plantilla enviada]` : ''}
                    </span>
                  </div>
                  {unreadCounts[c.phone_number] > 0 && (
                    <div style={{
                      backgroundColor: 'var(--c-accent)', color: '#111b21',
                      fontSize: '11px', fontWeight: 'bold', minWidth: '20px', height: '20px',
                      borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 6px', marginLeft: '6px', flexShrink: 0
                    }}>
                      {unreadCounts[c.phone_number]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="settings-row"><Settings size={20} /><span>Settings</span></div>
      </aside>

      {/* ======= CHAT MAIN ======= */}
      <main className="chat-main">
        {selectedPhone ? (<>
          <div className="chat-header">
            <div className="chat-header-left" onClick={() => setShowProfile(true)}>
              <div className="avatar-sm"><img src={avatarUrl(activeName)} alt="" /></div>
              <div>
                <div className="chat-header-name">{activeName}</div>
                <div className="chat-header-status">{isOnline ? 'online' : 'offline'}</div>
              </div>
            </div>
            <div className="chat-header-icons">
              <Search size={20} onClick={() => setShowMsgSearch(!showMsgSearch)} style={{ color: showMsgSearch ? 'var(--c-accent)' : 'inherit' }} />
              <MoreVertical size={20} />
            </div>
          </div>

          {showMsgSearch && (
            <div className="search-messages-bar">
              <Search size={18} color="var(--c-muted)" />
              <input 
                autoFocus
                type="text" 
                placeholder="Buscar en la conversación..." 
                style={{ background: 'none', border: 'none', outline: 'none', color: 'white', flex: 1 }}
                value={msgSearch}
                onChange={e => setMsgSearch(e.target.value)}
              />
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => { setShowMsgSearch(false); setMsgSearch(''); }} />
            </div>
          )}

          <div className="messages-area">
            {grouped.map(item =>
              item.type === 'date' ? <div key={item.id} className="date-chip">{item.label}</div> : (
                <div key={item.id} className={`bubble ${item.is_from_user ? 'bubble-in' : 'bubble-out'}`}>
                  {item.type === 'location' ? (
                    <div className="loc-card">
                      <div className="loc-header"><MapPin size={16} color="#ef4444" /><span>Ubicación</span></div>
                      <a href={`https://google.com/maps?q=${item.metadata?.lat},${item.metadata?.lng}`} target="_blank" rel="noreferrer" className="loc-link">Ver Mapa</a>
                    </div>
                  ) : <p className="bubble-text">{item.body}</p>}
                  <div className="bubble-footer">
                    <span className="bubble-time">{fmtTime(item.created_at)}</span>
                    {!item.is_from_user && (
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: '3px' }}>
                        {item.status === 'read' ? (
                          <CheckCheck size={14} color="#53bdeb" />
                        ) : item.status === 'failed' ? (
                          <AlertCircle size={14} color="#ef4444" title="No se pudo entregar. La ventana de 24h puede estar cerrada." />
                        ) : item.status === 'delivered' ? (
                          <CheckCheck size={14} color="var(--c-muted)" />
                        ) : (
                          <CheckCheck size={14} style={{ opacity: 0.5 }} color="var(--c-muted)" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-footer" onSubmit={send}>
            <div className="footer-icons">
              <Smile size={24} />
              <Paperclip size={24} />
              {/* Botón de Plantillas — abre menú con plantillas aprobadas por Meta */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  title="Enviar plantilla (inicia conversación fuera de 24h)"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: showTemplateMenu ? 'var(--c-accent)' : 'var(--c-muted)', display: 'flex', alignItems: 'center' }}
                  onClick={() => setShowTemplateMenu(v => !v)}
                >
                  <Zap size={22} />
                </button>
                {showTemplateMenu && (
                  <div style={{
                    position: 'absolute', bottom: '44px', left: 0,
                    background: '#2a3942', borderRadius: '10px', padding: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: '220px', zIndex: 50
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--c-muted)', padding: '4px 8px 8px', borderBottom: '1px solid var(--c-border)', marginBottom: '6px' }}>
                      ⚡ Plantillas aprobadas por Meta
                    </div>
                    <button
                      type="button"
                      onClick={() => sendTemplate('invitacion_empleado')}
                      style={{
                        display: 'block', width: '100%', background: 'none', border: 'none',
                        color: 'var(--c-text)', cursor: 'pointer', padding: '8px 10px',
                        borderRadius: '7px', textAlign: 'left', fontSize: '13px', transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.target.style.background = 'var(--c-hover)'}
                      onMouseLeave={e => e.target.style.background = 'none'}
                    >
                      👋 invitacion_empleado
                      <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>Bienvenida a SYNKRO PULSE</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendTemplate('bienvenida_empleado_')}
                      style={{
                        display: 'block', width: '100%', background: 'none', border: 'none',
                        color: 'var(--c-text)', cursor: 'pointer', padding: '8px 10px',
                        borderRadius: '7px', textAlign: 'left', fontSize: '13px', transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.target.style.background = 'var(--c-hover)'}
                      onMouseLeave={e => e.target.style.background = 'none'}
                    >
                      🏢 bienvenida_empleado
                      <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>Canal oficial SYNKRO PULSE</div>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="footer-input-wrap">
              <input type="text" className="footer-input" placeholder="Type a message" value={draft} onChange={e => setDraft(e.target.value)} />
            </div>
            {draft.trim() ? <button type="submit" style={{ background: 'none', border: 'none' }}><Send size={24} color="var(--c-accent)" /></button> : <Mic size={24} />}
          </form>
        </>) : (
          <div className="empty-state">
            <div className="empty-icon"><User size={44} /></div>
            <h2>WhatsApp Manager</h2>
            <p>Selecciona una conversación para comenzar</p>
          </div>
        )}
      </main>

      {/* ======= PROFILE SIDEBAR ======= */}
      {showProfile && (
        <aside className="profile-sidebar" style={{ width: '400px', minWidth: '400px' }}>
          <div className="profile-header" style={{ height: '60px' }}>
            <button className="back-btn" onClick={() => setShowProfile(false)}><ChevronLeft size={22} /></button>
            <span>Información del contacto</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0c1317' }}>
            <div className="profile-section" style={{ padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="profile-avatar"><img src={avatarUrl(activeName, '00a884')} alt="" /></div>
              <h2 className="profile-name" style={{ marginTop: '15px' }}>{activeName}</h2>
              <p style={{ color: 'var(--c-muted)', fontSize: '14px' }}>+{selectedPhone}</p>
            </div>

            <div className="profile-section" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ fontSize: '13px', color: 'var(--c-muted)', fontWeight: 500 }}>Archivos, enlaces y documentos</span>
                <ChevronRight size={18} color="var(--c-muted)" />
              </div>
              <div className="media-grid">
                {[1,2,3].map(i => <div key={i} className="media-item"><ImageIcon size={24} color="var(--c-muted)" /></div>)}
              </div>
            </div>

            <div className="profile-section">
               <div className="profile-field" style={{ padding: '20px' }}>
                  <BellOff size={20} className="profile-field-icon" />
                  <div style={{ flex: 1 }}>Silenciar notificaciones</div>
                  <input type="checkbox" />
               </div>
               <div className="profile-field" style={{ padding: '20px' }}>
                  <div style={{ flex: 1 }}>Mensajes temporales</div>
                  <span style={{ fontSize: '13px', color: 'var(--c-muted)' }}>Desactivados</span>
               </div>
            </div>

            {selectedUser && (
              <div className="profile-section" style={{ padding: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <div className="profile-field-label">Empresa</div>
                  <div className="profile-field-value">{selectedUser.companies?.name ?? 'N/A'}</div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <div className="profile-field-label">Cargo / Rol</div>
                  <div className="profile-field-value">{selectedUser.role}</div>
                </div>
                <div>
                  <div className="profile-field-label">Miembro desde</div>
                  <div className="profile-field-value">{DateTime.fromISO(selectedUser.created_at).toFormat('d LLL yyyy')}</div>
                </div>
              </div>
            )}

            <div className="profile-section" style={{ paddingBottom: '40px' }}>
               <button className="profile-action-btn"><Ban size={20} /> Bloquear a {activeName}</button>
               <button className="profile-action-btn"><Trash2 size={20} /> Vaciar chat</button>
            </div>
          </div>
        </aside>
      )}
      {/* Modal para Nuevo Mensaje / Plantilla */}
      {showNewChatModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>⚡ Enviar Invitación a Nuevo Número</h3>
              <button onClick={() => setShowNewChatModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleNewChatSubmit}>
              <div className="form-group">
                <label>Número de WhatsApp (con código de país, ej: 51904...)</label>
                <input 
                  type="text" 
                  placeholder="51904332333" 
                  autoFocus
                  value={newChatData.phone}
                  onChange={e => setNewChatData({...newChatData, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Nombre del Empleado</label>
                <input 
                  type="text" 
                  placeholder="Nombre completo" 
                  value={newChatData.name}
                  onChange={e => setNewChatData({...newChatData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Seleccionar Plantilla</label>
                <select 
                  value={newChatData.template}
                  onChange={e => setNewChatData({...newChatData, template: e.target.value})}
                >
                  <option value="invitacion_empleado">invitacion_empleado (Correcta)</option>
                  <option value="bienvenida_empleado_">bienvenida_empleado_ (Con error E)</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowNewChatModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Enviar Plantilla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Envío Masivo */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content bulk-modal">
            <div className="modal-header">
              <h3>👥 Directorio de Empleados</h3>
              <button onClick={() => setShowBulkModal(false)}><X size={20} /></button>
            </div>
            <div className="bulk-body">
              <p className="bulk-desc">Selecciona los empleados para enviar invitación. Se enviarán con una pausa de 2s para evitar baneos.</p>
              
              <div className="bulk-controls">
                <div className="bulk-search">
                  <Search size={16} />
                  <input 
                    type="text" 
                    placeholder="Buscar por nombre o teléfono..." 
                    value={searchTermEmp}
                    onChange={e => setSearchTermEmp(e.target.value)}
                  />
                </div>
              </div>

              <div className="bulk-controls" style={{ marginBottom: '20px' }}>
                <select 
                  className="bulk-template-select"
                  value={bulkTemplateName}
                  onChange={e => setBulkTemplateName(e.target.value)}
                  style={{
                    flex: 1, background: '#111b21', color: 'var(--c-text)', 
                    border: '1px solid var(--c-border)', borderRadius: '8px', 
                    padding: '8px 12px', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="invitacion_empleado">Plantilla: invitacion_empleado</option>
                  <option value="bienvenida_empleado_">Plantilla: bienvenida_empleado_</option>
                </select>
                <button 
                  type="button" 
                  className="btn-select-all"
                  onClick={() => {
                    const filtered = employees.filter(e => 
                      e.full_name.toLowerCase().includes(searchTermEmp.toLowerCase()) ||
                      e.phone_number.includes(searchTermEmp)
                    );
                    toggleSelectAll(filtered);
                  }}
                >
                  {selectedEmployees.length === employees.filter(e => 
                    e.full_name.toLowerCase().includes(searchTermEmp.toLowerCase()) ||
                    e.phone_number.includes(searchTermEmp)
                  ).length ? 'Desmarcar Todos' : 'Seleccionar Todos'}
                </button>
              </div>

              <div className="employee-list">
                {employees
                  .filter(emp => 
                    emp.full_name.toLowerCase().includes(searchTermEmp.toLowerCase()) ||
                    emp.phone_number.includes(searchTermEmp)
                  )
                  .map(emp => {
                    const phone = emp.phone_number.replace(/\D/g, '');
                    const isSelected = selectedEmployees.some(e => e.phone === phone);
                    const hasChat = conversations.some(c => c.phone_number === phone);
                    
                    return (
                      <div 
                        key={phone} 
                        className={`employee-item ${isSelected ? 'selected' : ''} ${hasChat ? 'has-chat' : ''}`}
                        onClick={() => toggleEmployeeSelection(emp)}
                      >
                        <div className="emp-avatar" style={{ background: hasChat ? 'var(--c-accent)' : '#3b4a54' }}>
                          {emp.full_name[0]}
                        </div>
                        <div className="emp-info">
                          <div className="emp-name">
                            {emp.full_name}
                            {hasChat && <span className="badge-active">Chat Activo</span>}
                          </div>
                          <div className="emp-phone">+{phone}</div>
                        </div>
                        <div className="emp-check">
                          {isSelected && <CheckCheck size={16} color="var(--c-accent)" />}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="modal-footer">
              <div className="selection-count">{selectedEmployees.length} seleccionados</div>
              <button type="button" className="btn-cancel" onClick={() => setShowBulkModal(false)}>Cerrar</button>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={selectedEmployees.length === 0 || isBulkSending}
                onClick={sendBulkTemplates}
              >
                {isBulkSending ? 'Iniciando...' : 'Enviar Invitaciones'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
