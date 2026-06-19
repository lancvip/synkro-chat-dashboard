# Monorepo Chat Dashboard & WhatsApp Webhook 💬

Este repositorio es una solución **monolítica e independiente (Monorepo)** que contiene tanto la interfaz de usuario (React Frontend) como el servidor webhook (Node.js Backend) para gestionar interacciones y campañas a través de la **API Cloud de WhatsApp (Meta)**.

---

## 📂 Estructura del Proyecto

* **`/` (Raíz):** Contiene el código frontend construido en **React + Vite**.
* **`/server`:** Contiene el servidor backend construido en **Node.js + Express** para procesar los mensajes y webhooks de Meta.

---

## 🚀 Arquitectura del Sistema

```
     ┌──────────────────────────────────────────────────────────┐
     │                      META CLOUD API                      │
     └─────────────┬──────────────────────────────▲─────────────┘
      Webhooks de  │                              │  Peticiones HTTP
       Mensajes    │                              │   (Graph API)
                   ▼                              │
     ┌──────────────────────────┐    API REST    ┌┴─────────────────────────┐
     │      SERVER BACKEND      ├───────────────►│    SUPABASE DATABASE     │
     │     (Node.js/Express)    │                │  Historial y Realtime    │
     └──────────────────────────┘                └──────────────┬───────────┘
                                                                │  Updates
                                                                │  Realtime
                                                                ▼
                                                 ┌─────────────────────────┐
                                                 │      CHAT DASHBOARD     │
                                                 │      (React/Vite)       │
                                                 └─────────────────────────┘
```

---

## ⚙️ Configuración y Variables de Entorno

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/lancvip/synkro-chat-dashboard.git
cd synkro-chat-dashboard

# Instalar dependencias del Frontend (Raíz)
npm install

# Instalar dependencias del Backend (Server)
cd server
npm install
```

### 2. Configurar Variables de Entorno (`.env`)
Debes crear un archivo `.env` en cada sección del proyecto:

#### A. Frontend (`/.env`)
Crea el archivo en la raíz y configura tus accesos de Supabase y el URL de tu servidor backend:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_KEY=tu-anon-key-de-supabase
VITE_BACKEND_URL=http://localhost:3000
```

#### B. Backend (`/server/.env`)
Crea el archivo dentro de la carpeta `/server` y agrega las credenciales secretas de Supabase y Meta:
```env
PORT=3000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-key-de-supabase -- Requerido para omitir políticas RLS si es necesario

# Configuración de WhatsApp API Cloud (Meta)
WHATSAPP_TOKEN=tu-token-permanente-de-desarrollador-de-facebook
WHATSAPP_PHONE_NUMBER_ID=tu-id-de-telefono-de-whatsapp
WHATSAPP_VERIFY_TOKEN=token_secreto_elegido_por_ti
```

---

## 🔌 Configuración del Webhook en Facebook Developers

Para conectar tu número de WhatsApp con esta aplicación, debes dar de alta tu Webhook en el portal de desarrolladores de Facebook:

1. Ve a tu aplicación en **[Facebook Developers](https://developers.facebook.com/)**.
2. Añade o configura el producto **WhatsApp** y dirígete a **Configuración > API Setup**.
3. En la sección de **Webhooks**, haz clic en **Editar**:
   * **URL de devolución de llamada (Callback URL):** `https://tu-dominio-publico.com/webhook/meta` *(En desarrollo local, puedes usar herramientas como Ngrok para exponer tu puerto 3000, ej: `https://xxxx.ngrok-free.app/webhook/meta`)*.
   * **Token de verificación:** Escribe el mismo valor que pusiste en la variable `WHATSAPP_VERIFY_TOKEN` en tu archivo `/server/.env`.
4. Haz clic en **Verificar y guardar**.
5. En la misma pantalla de Webhooks, busca la tabla de campos y haz clic en **Suscribirse** a los eventos:
   * **`messages`** (Obligatorio para recibir mensajes y ubicaciones).
   * **`message_template_status`** (Opcional, para monitorear estados de plantillas).

---

## 📂 Esquema de Base de Datos en Supabase (Migración SQL)

Ejecuta el siguiente código en el **SQL Editor** de tu consola de Supabase para inicializar la tabla de mensajes y activar el flujo de actualización en tiempo real:

```sql
-- 1. Tabla de Mensajes
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  body text,
  is_from_user boolean default false,
  status text check (status in ('sent', 'delivered', 'read', 'failed')),
  push_name text,
  type text default 'text',
  metadata jsonb,
  message_id text unique, -- Identificador único (wamid) de Meta
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla Opcional de Perfiles/Contactos (para vincular números a nombres en el chat)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_number text unique,
  role text default 'usuario',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Habilitar tiempo real (Supabase Realtime) en la tabla de mensajes
alter table public.chat_messages replica identity full;
alter publish supabase_realtime add table public.chat_messages;
```

---
