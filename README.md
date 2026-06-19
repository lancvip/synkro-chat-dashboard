# Synkro Chat Dashboard 💬

Este es un panel de administración y chat en tiempo real al estilo **WhatsApp Web**, diseñado para gestionar interacciones y flujos a través de la **API Cloud de WhatsApp (Meta)**. 

El proyecto está construido sobre **React**, **Vite**, **Framer Motion**, y utiliza **Supabase** como backend de base de datos y mensajería en tiempo real.

---

## 🚀 Características Clave

* **Sincronización en Tiempo Real:** Recepción y actualización de mensajes al instante usando Supabase Realtime Channels.
* **Control de Lectura:** Visualización de ticks de lectura (Enviado, Entregado, Leído, Fallido) integrados con los webhooks de Meta.
* **Gestor de Plantillas (Templates):** Envío de mensajes de plantilla oficiales aprobados por Meta para iniciar conversaciones fuera de la ventana de 24 horas.
* **Envíos Masivos:** Módulo de envío masivo para lanzar plantillas e invitaciones a múltiples contactos de forma automatizada y con pausas controladas para prevenir bloqueos o spam.
* **Geolocalización:** Soporte para la recepción e interpretación de marcaciones o ubicaciones compartidas en el mapa.
* **Diseño Premium:** Interfaz oscura, fluida y moderna con microinteracciones estilizadas con Framer Motion y Lucide Icons.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 19, Vite, Framer Motion, Lucide React, Luxon.
* **Backend y Base de Datos:** Supabase (PostgreSQL + Realtime).
* **Integración de Canales:** API Cloud de WhatsApp (Meta Webhooks).

---

## ⚙️ Configuración del Proyecto

### 1. Clonar el repositorio
```bash
git clone https://github.com/lancvip/synkro-chat-dashboard.git
cd synkro-chat-dashboard
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto basándote en el archivo `.env.example`:
```bash
cp .env.example .env
```
Edita el archivo `.env` con tus credenciales del proyecto:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_KEY=tu-anon-key-de-supabase
VITE_BACKEND_URL=https://tu-servidor-backend.com
```

### 4. Inicializar en modo desarrollo
```bash
npm run dev
```

---

## 📂 Estructura de Datos (Requerida en Supabase)

Para el correcto funcionamiento del panel de chat, se asume la existencia de una tabla `chat_messages` en Supabase con la siguiente estructura básica:

```sql
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  body text,
  is_from_user boolean default false,
  status text check (status in ('sent', 'delivered', 'read', 'failed')),
  push_name text,
  type text default 'text',
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar réplicas Realtime para esta tabla en Supabase
alter table public.chat_messages replica identity full;
```

---

## 📄 Licencia
Este proyecto es de código abierto y está disponible bajo la licencia [MIT](LICENSE).

Desarrollado y mantenido por **[Lancvip](https://lancvip.online)**.
