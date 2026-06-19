const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Guarda un mensaje en el historial
 * @param {string} push_name - Nombre de WhatsApp del usuario (solo para mensajes entrantes)
 */
async function saveMessage({ phone_number, body, type = 'text', is_from_user = true, push_name = null, metadata = {} }) {
    try {
        const cleanPhone = phone_number.replace('whatsapp:', '').replace('+', '');
        const row = {
            phone_number: cleanPhone,
            body,
            type,
            is_from_user,
            metadata,
            message_id: metadata.message_id || null, // Extraer ID de Meta
            created_at: new Date().toISOString()
        };
        // Solo guardamos push_name si nos lo proporcionan (mensajes entrantes de Meta)
        if (push_name) row.push_name = push_name;

        const { error } = await supabase.from('chat_messages').insert([row]);
        if (error) console.error('[chat-service] Error saving message:', error.message);
    } catch (err) {
        console.error('[chat-service] Unexpected error:', err.message);
    }
}

module.exports = { saveMessage };
