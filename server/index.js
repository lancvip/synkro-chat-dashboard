require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { saveMessage } = require('./chat');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend compilado en producción
app.use(express.static(path.join(__dirname, '../dist')));


const PORT = process.env.PORT || 3000;

// ==========================================
// 1. VERIFICACIÓN DEL WEBHOOK DE META (Facebook Developer Setup)
// ==========================================
app.get('/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('[meta] ✓ Webhook verificado exitosamente por Meta');
        return res.status(200).send(challenge);
    }
    console.warn('[meta] ✗ Verificación fallida — token de verificación incorrecto');
    return res.sendStatus(403);
});

// ==========================================
// 2. RECEPCIÓN DE MENSAJES DE META (Webhook Callback)
// ==========================================
app.post('/webhook/meta', async (req, res) => {
    // Retornamos 200 de inmediato a Meta para evitar reintentos y timeouts
    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // A. Manejar confirmaciones y estados (Entregado, Leído, Fallido)
    if (value?.statuses?.[0]) {
        const statusUpdate = value.statuses[0];
        const wamid = statusUpdate.id;
        const newStatus = statusUpdate.status; 
        
        console.log(`[meta] Estado de mensaje: ${wamid} → ${newStatus}`);
        
        await supabase.from('chat_messages')
            .update({ status: newStatus })
            .eq('message_id', wamid);
        return;
    }

    // B. Procesar mensaje entrante
    const message = value?.messages?.[0];
    if (!message) return;

    const telefono = message.from; 
    const tipo = message.type;
    const pushName = value?.contacts?.[0]?.profile?.name || null;

    let bodyText = '';
    let lat = null;
    let lng = null;

    if (tipo === 'text') {
        bodyText = message.text?.body || '';
    } else if (tipo === 'location') {
        lat = message.location?.latitude;
        lng = message.location?.longitude;
        bodyText = 'Ubicación enviada';
    } else if (tipo === 'interactive') {
        bodyText = message.interactive?.button_reply?.title
            || message.interactive?.list_reply?.title
            || '';
    }

    console.log(`[meta] ← Mensaje recibido de +${telefono} | tipo: ${tipo} | "${bodyText.substring(0, 50)}"`);

    // Persistir el mensaje directamente en Supabase
    await saveMessage({
        phone_number: telefono,
        body: bodyText,
        type: tipo,
        push_name: pushName,
        is_from_user: true,
        metadata: { 
            ...(tipo === 'location' ? { lat, lng } : {}), 
            message_id: message.id 
        }
    });
});

// ==========================================
// 3. ENVIAR MENSAJE INDIVIDUAL (Meta API Cloud)
// ==========================================
app.post('/webhook/meta-reply', async (req, res) => {
    const { phone, text } = req.body;
    if (!phone || !text) return res.status(400).json({ error: 'Faltan campos: phone, text' });

    try {
        await _enviarMeta(phone, { type: 'text', text: { body: String(text) } }, text);
        res.json({ success: true });
    } catch (err) {
        console.error('[meta-reply] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 4. ENVIAR PLANTILLA (Meta API Cloud)
// ==========================================
app.post('/webhook/meta-template', async (req, res) => {
    const { phone, templateName, employeeName } = req.body;
    if (!phone || !templateName || !employeeName) {
        return res.status(400).json({ error: 'Faltan campos: phone, templateName, employeeName' });
    }

    try {
        const components = [
            {
                type: 'body',
                parameters: [{ type: 'text', text: String(employeeName) }]
            }
        ];

        const payload = {
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'es_PE' },
                components
            }
        };

        await _enviarMeta(phone, payload, `[Plantilla: ${templateName}]`);
        res.json({ success: true });
    } catch (err) {
        console.error('[meta-template] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. ENVIAR TEMPLATE MASIVO (Anti-Ban 2s delay)
// ==========================================
app.post('/webhook/meta-bulk-template', async (req, res) => {
    const { employees, templateName } = req.body;
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ error: 'Lista de empleados vacía' });
    }

    res.json({ success: true, message: 'Envío masivo iniciado' });

    for (const emp of employees) {
        try {
            const components = [
                {
                    type: 'body',
                    parameters: [{ type: 'text', text: String(emp.name) }]
                }
            ];

            const payload = {
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'es_PE' },
                    components
                }
            };

            await _enviarMeta(emp.phone, payload, `[Plantilla: ${templateName}]`);
            console.log(`[bulk] ✓ Enviado a ${emp.name} (+${emp.phone})`);
            
            // Espera de 2 segundos recomendada por Meta
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
            console.error(`[bulk] Error con ${emp.name}:`, err.message);
        }
    }
});

// ==========================================
// 6. LISTA DE EMPLEADOS (Supabase profiles query)
// ==========================================
app.get('/webhook/employees-list', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('full_name, phone_number, role')
            .not('phone_number', 'is', null);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[employees-list] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// AUXILIAR: ENVÍO A GRAPH API DE FACEBOOK
// ==========================================
async function _enviarMeta(phoneNumber, payloadExtra, bodyParaLog) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    const destinatario = String(phoneNumber || '').trim().replace(/\D/g, '');

    if (!phoneNumberId || !token) throw new Error('Falta configuración de Meta (Phone ID o Token) en variables de entorno.');
    if (!destinatario) throw new Error('Número de teléfono inválido');

    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: destinatario,
            ...payloadExtra
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Error en la petición a Meta Graph API');
    }

    const wamid = data.messages?.[0]?.id;
    console.log(`[meta] ✓ Mensaje enviado exitosamente a +${destinatario} | wamid: ${wamid}`);

    // Guardar el mensaje saliente en Supabase con estado inicial 'sent'
    await saveMessage({
        phone_number: destinatario,
        body: bodyParaLog,
        is_from_user: false,
        metadata: { message_id: wamid }
    });
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend de WhatsApp corriendo en el puerto ${PORT}`);
});
