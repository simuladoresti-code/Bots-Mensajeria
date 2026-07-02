# 🚀 Mass Sender PRO

Aplicación web completa para envío masivo de correos electrónicos y mensajes de WhatsApp a partir de archivos CSV.

## ✨ Características

### 📧 Envío de Emails
- Carga de archivos CSV con contactos
- Plantillas dinámicas con variables: `{nombre}`, `{email}`, `{telefono}`
- Envío masivo con delay configurable
- Validación de emails y teléfonos
- Reporte de estado: Pendiente, Enviado, Error

### 💬 WhatsApp Masivo
- Generación automática de links wa.me
- Reemplazo dinámico de variables
- Apertura en pestañas con delay configurables
- Vista previa de mensajes

### 📊 Dashboard
- Estadísticas en tiempo real
- Total de contactos, enviados, pendientes, errores
- Historial de campañas
- Gráficos de estado

### 💾 Funcionalidades Adicionales
- Exportación de resultados en CSV
- Historial completo de campañas
- Gestión de configuración
- Interfaz CRM moderna con tema oscuro

## 🛠️ Tecnologías

### Frontend
- HTML5
- CSS3 (Diseño responsive)
- JavaScript Vanilla (ES6+)

### Backend
- Node.js
- Express.js
- Multer (carga de archivos)
- CSV Parser
- Resend API (envío de emails)
- Dotenv (variables de entorno)

## 📋 Requisitos

- Node.js 16+ instalado
- Cuenta en [Resend](https://resend.com) para API Key

## 🚀 Instalación

### 1. Clonar o descargar el proyecto

```bash
cd mass-sender
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus configuraciones:

```env
RESEND_API_KEY=tu_api_key_aqui
EMAIL_FROM=noreply@tudominio.com
EMAIL_FROM_NAME=Mass Sender PRO
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE=5242880
DEFAULT_DELAY=1000
```

### 4. Ejecutar la aplicación

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

Accede a `http://localhost:3000`

## 📁 Estructura del Proyecto

```
mass-sender/
├── server.js                # Servidor principal
├── package.json             # Dependencias
├── .env                     # Variables de entorno
├── .gitignore               # Archivos ignorados
├── README.md                # Este archivo
└── public/
    ├── index.html           # Página principal
    ├── style.css            # Estilos CSS
    └── app.js               # Lógica frontend
```

## 📊 Formato del CSV

Tu archivo CSV debe tener las siguientes columnas:

```csv
nombre,email,telefono
Juan Pérez,juan@example.com,51987654321
María García,maria@example.com,51911223344
Pedro López,pedro@example.com,51945678901
```

### Campos requeridos:
- **nombre**: Requerido. Nombre del contacto
- **email**: Opcional. Email válido para envío de correos
- **telefono**: Opcional. Número de teléfono para WhatsApp (10-15 dígitos)

## 🔧 Uso

### 1. Cargar CSV
1. Ve a la pestaña "Subir CSV"
2. Selecciona o arrastra tu archivo CSV
3. Revisa la vista previa de contactos

### 2. Enviar Emails
1. Completa los campos: Remitente, Asunto, Mensaje
2. Usa variables: `{nombre}`, `{email}`, `{telefono}`
3. Configura el delay entre envíos
4. Haz clic en "Enviar Emails Masivos"
5. Monitorea el progreso en tiempo real

### 3. WhatsApp Masivo
1. Ingresa el mensaje con variables
2. Haz clic en "Generar Links WhatsApp"
3. Abre chats individuales o todos a la vez

### 4. Descargar Resultados
1. Ve al "Historial"
2. Selecciona una campaña
3. Descarga CSV de "Enviados" o "Errores"

## 🔐 Configuración

### API Key de Resend
1. Crea una cuenta en [Resend](https://resend.com)
2. Genera una API Key en el dashboard
3. Ve a "Configuración" en la app
4. Ingresa tu API Key

### Personalizar delay
- Email: Recomendado 1000-2000ms entre envíos
- WhatsApp: Recomendado 500-1000ms entre aperturas

## 🌐 Deploy en Render

### 1. Preparar repositorio
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. Subir a GitHub
- Crea un repositorio en GitHub
- Push del código

### 3. Conectar con Render
1. Ve a [render.com](https://render.com)
2. Conecta tu repositorio de GitHub
3. Crea un nuevo Web Service
4. Configura:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables: Agrega tu `.env`

### 4. Deploy
- Render desplegará automáticamente con cada push a main

## 📝 Variables Disponibles en Plantillas

```
{nombre}   - Nombre del contacto
{email}    - Email del contacto
{telefono} - Teléfono del contacto
```

### Ejemplo de plantilla:
```
Asunto: Promoción especial para {nombre}

Mensaje:
Hola {nombre},

Te escribimos para ofrecerte una promoción especial en nuestros servicios.
Tus datos:
- Email: {email}
- Teléfono: {telefono}

¡Aprovecha esta oportunidad hoy!
```

## ⚙️ API Endpoints

### Gestión de contactos
- `POST /api/upload-csv` - Subir y procesar CSV

### Emails
- `POST /api/send-emails` - Enviar emails masivos
- `GET /api/export/campaign/:id/sent` - Descargar enviados
- `GET /api/export/campaign/:id/errors` - Descargar errores

### WhatsApp
- `POST /api/generate-whatsapp-links` - Generar links

### Campañas
- `GET /api/campaign/:id` - Estado de campaña
- `GET /api/stats` - Estadísticas globales

### Configuración
- `GET /api/config` - Obtener configuración
- `POST /api/config` - Actualizar configuración

## 🐛 Solución de Problemas

### Error: "Port 3000 already in use"
```bash
# Cambiar puerto en .env
PORT=3001
```

### Error: "CSV file too large"
```bash
# Aumentar límite en .env
MAX_FILE_SIZE=10485760  # 10MB
```

### Error: "Invalid API Key"
- Verifica que tu API Key de Resend sea correcta
- Copia sin espacios en blanco

### Emails no se envían
- Comprueba la API Key
- Revisa que el email del remitente sea válido
- Verifica que los emails de contactos sean válidos

## 📞 Soporte

Para reportar issues o sugerencias, contacta al equipo de desarrollo.

## 📄 Licencia

MIT License

## 🎯 Roadmap

- [ ] Integración con Twilio para SMS
- [ ] Múltiples plantillas guardadas
- [ ] Programación de campañas
- [ ] Base de datos persistente
- [ ] Análisis de resultados avanzados
- [ ] Integración con Google Sheets

---

**Mass Sender PRO** - Solución profesional para campañas masivas. 🚀
