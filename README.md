# Synkro Chat Dashboard 💬

Este es un panel de administración y chat en tiempo real al estilo **WhatsApp Web**, diseñado para gestionar interacciones y flujos a través de la **API Cloud de WhatsApp (Meta)** de forma visual e intuitiva.

El proyecto está diseñado de forma **independiente** para conectar cualquier frontend de mensajería con un backend de integración y base de datos sobre **Supabase**.

---

## 🚀 Arquitectura Independiente

Este dashboard interactúa con dos componentes principales:
1. **Supabase (Base de datos y tiempo real):** Lee y recibe las actualizaciones en vivo de los mensajes entrantes y salientes.
2. **Servidor Backend (Meta API):** Envía las peticiones REST al backend que gestiona la API Cloud de WhatsApp (Meta) para procesar el envío de mensajes de texto y plantillas oficiales.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 19, Vite, Framer Motion, Lucide React, Luxon.
* **Backend Recomendado:** Servidor Node.js/Express integrado con la API Cloud de WhatsApp y el SDK de Supabase Admin.

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

Edita el archivo `.env` con tus credenciales de desarrollo/producción:
```env
# URL y clave anónima pública de tu proyecto en Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_KEY=tu-anon-key-de-supabase

# URL del servidor backend que expone los endpoints de envío de Meta
VITE_BACKEND_URL=https://tu-servidor-backend.com
```

### 4. Inicializar en modo desarrollo
```bash
npm run dev
```

---

## 📂 Configuración en Supabase (Tablas y Realtime)

Para que el chat cargue y actualice las conversaciones en tiempo real, debes crear las siguientes tablas en tu base de datos de Supabase. Puedes ejecutar este código SQL directamente en el **SQL Editor** de Supabase:

### 1. Tabla de Mensajes de Chat (`chat_messages`)
Esta tabla almacena todo el historial de conversaciones de WhatsApp:

```sql
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,                      -- Número con código de país (ej: 51904332333)
  body text,                                       -- Contenido del mensaje de texto
  is_from_user boolean default false,              -- true = entrante, false = saliente
  status text check (status in ('sent', 'delivered', 'read', 'failed')), -- Estado del mensaje
  push_name text,                                  -- Nombre de perfil de WhatsApp del contacto
  type text default 'text',                        -- Tipo de mensaje ('text', 'location', 'template', etc.)
  metadata jsonb,                                  -- Datos extra (ej: { "lat": -12.04, "lng": -77.03 } para ubicación)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar réplicas Realtime para actualizaciones en vivo en la UI
alter table public.chat_messages replica identity full;
alter publish supabase_realtime add table public.chat_messages;
```

### 2. Tabla Opcional de Perfiles (`profiles`)
Si deseas que el panel cruce los números telefónicos con nombres reales de empleados/contactos en tu base de datos:

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_number text unique,                        -- Número de teléfono único
  role text default 'usuario',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

---

## 🔌 Requisitos del Servidor Backend

El frontend realiza peticiones HTTP `POST` y `GET` al `VITE_BACKEND_URL` configurado. Tu servidor backend debe exponer y controlar los siguientes endpoints:

### 1. `POST /webhook/meta-reply`
Envía un mensaje de texto plano a través de la API Cloud de WhatsApp.
* **Cuerpo (JSON):**
  ```json
  {
    "phone": "51904332333",
    "text": "Hola, ¿cómo estás?"
  }
  ```

### 2. `POST /webhook/meta-template`
Envía una plantilla pre-aprobada por Meta.
* **Cuerpo (JSON):**
  ```json
  {
    "phone": "51904332333",
    "templateName": "invitacion_empleado",
    "employeeName": "Richard"
  }
  ```

### 3. `POST /webhook/meta-bulk-template`
Inicia un hilo de envíos masivos para una lista de destinatarios.
* **Cuerpo (JSON):**
  ```json
  {
    "employees": [
      { "phone": "51904332333", "name": "Richard" },
      { "phone": "51988888888", "name": "Carlos" }
    ],
    "templateName": "invitacion_empleado"
  }
  ```

### 4. `GET /webhook/employees-list`
Retorna un listado de empleados para el selector masivo.
* **Respuesta (JSON):**
  ```json
  [
    { "phone_number": "+51904332333", "full_name": "Richard" }
  ]
  ```

---

## 📄 Licencia
Este proyecto es de código abierto y está disponible bajo la licencia [MIT](LICENSE).

Desarrollado y mantenido por **[Lancvip](https://lancvip.online)**.
