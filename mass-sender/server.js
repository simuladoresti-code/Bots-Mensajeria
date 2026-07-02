const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuración de multer para subida de archivos
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 5242880 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv') {
      return cb(new Error('Solo se permiten archivos CSV'));
    }
    cb(null, true);
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Base de datos en memoria (en producción usar base de datos real)
let campaigns = [];
let campaignHistory = [];
let stats = {
  totalContacts: 0,
  sent: 0,
  errors: 0,
  pending: 0
};

// Validar email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validar teléfono (formato internacional)
function isValidPhone(phone) {
  const re = /^\d{10,15}$/;
  return re.test(phone.replace(/[\D]/g, ''));
}

// Reemplazar variables en texto
function replaceVariables(text, data) {
  let result = text;
  Object.keys(data).forEach(key => {
    result = result.replace(new RegExp(`{${key}}`, 'g'), data[key]);
  });
  return result;
}

// Rutas de la API

// 1. Subir y procesar CSV
app.post('/api/upload-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  const filePath = req.file.path;
  const contacts = [];
  const errors = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row, index) => {
      const contact = {
        nombre: row.nombre || '',
        telefono: row.telefono || '',
        email: row.email || '',
        valid: true,
        errors: []
      };

      // Validar email si existe
      if (contact.email && !isValidEmail(contact.email)) {
        contact.errors.push('Email inválido');
        contact.valid = false;
      }

      // Validar teléfono si existe
      if (contact.telefono && !isValidPhone(contact.telefono)) {
        contact.errors.push('Teléfono inválido');
        contact.valid = false;
      }

      if (!contact.nombre) {
        contact.errors.push('Nombre requerido');
        contact.valid = false;
      }

      if (contact.valid || contact.email || contact.telefono) {
        contacts.push(contact);
      }
    })
    .on('end', () => {
      // Limpiar archivo subido
      fs.unlinkSync(filePath);

      stats.totalContacts = contacts.length;
      stats.pending = contacts.length;

      res.json({
        success: true,
        contacts,
        summary: {
          total: contacts.length,
          valid: contacts.filter(c => c.valid).length,
          invalid: contacts.filter(c => !c.valid).length
        }
      });
    })
    .on('error', (error) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: 'Error al procesar CSV: ' + error.message });
    });
});

// 2. Enviar emails masivos
app.post('/api/send-emails', async (req, res) => {
  const { contacts, subject, message, delay, senderName } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'No hay contactos para enviar' });
  }

  if (!subject || !message) {
    return res.status(400).json({ error: 'Asunto y mensaje son requeridos' });
  }

  const emailFrom = senderName || process.env.EMAIL_FROM_NAME;
  const campaignId = `campaign_${Date.now()}`;
  const campaignData = {
    id: campaignId,
    type: 'email',
    status: 'enviando',
    total: contacts.length,
    sent: 0,
    errors: 0,
    createdAt: new Date(),
    results: []
  };

  campaigns.push(campaignData);

  // Procesar envíos de forma asincrónica
  (async () => {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      if (!contact.valid || !contact.email) {
        campaignData.results.push({
          contact,
          status: 'error',
          message: 'Email no válido'
        });
        campaignData.errors++;
        stats.errors++;
        continue;
      }

      try {
        const finalMessage = replaceVariables(message, contact);
        const finalSubject = replaceVariables(subject, contact);

        // Enviar con Resend
        const result = await resend.emails.send({
          from: `${emailFrom} <${process.env.RESEND_API_KEY || 'onboarding@resend.dev'}>`,
          to: contact.email,
          subject: finalSubject,
          html: `<p>${finalMessage.replace(/\n/g, '<br>')}</p>`
        });

        if (result.error) {
          campaignData.results.push({
            contact,
            status: 'error',
            message: result.error.message
          });
          campaignData.errors++;
          stats.errors++;
        } else {
          campaignData.results.push({
            contact,
            status: 'enviado',
            messageId: result.data?.id
          });
          campaignData.sent++;
          stats.sent++;
        }
      } catch (error) {
        campaignData.results.push({
          contact,
          status: 'error',
          message: error.message
        });
        campaignData.errors++;
        stats.errors++;
      }

      stats.pending--;

      // Aplicar delay entre envíos
      if (i < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay || 1000));
      }
    }

    campaignData.status = 'completado';
    campaignHistory.push(campaignData);
  })();

  res.json({
    success: true,
    campaignId,
    message: 'Envío iniciado. El proceso ocurre en segundo plano.'
  });
});

// 3. Generar links de WhatsApp
app.post('/api/generate-whatsapp-links', (req, res) => {
  const { contacts, message } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'No hay contactos' });
  }

  const links = contacts
    .filter(c => c.valid && c.telefono)
    .map(contact => {
      const finalMessage = replaceVariables(message, contact);
      const encodedMessage = encodeURIComponent(finalMessage);
      const cleanPhone = contact.telefono.replace(/[\D]/g, '');
      return {
        contact,
        link: `https://wa.me/${cleanPhone}?text=${encodedMessage}`,
        message: finalMessage
      };
    });

  res.json({
    success: true,
    links,
    total: links.length
  });
});

// 4. Obtener estado de campaña
app.get('/api/campaign/:id', (req, res) => {
  const campaign = campaigns.find(c => c.id === req.params.id) ||
                   campaignHistory.find(c => c.id === req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaña no encontrada' });
  }

  res.json(campaign);
});

// 5. Obtener estadísticas
app.get('/api/stats', (req, res) => {
  res.json({
    stats,
    totalCampaigns: campaignHistory.length,
    campaigns: campaignHistory.map(c => ({
      id: c.id,
      type: c.type,
      createdAt: c.createdAt,
      total: c.total,
      sent: c.sent,
      errors: c.errors
    }))
  });
});

// 6. Descargar CSV de resultados
app.get('/api/export/campaign/:id/sent', (req, res) => {
  const campaign = campaignHistory.find(c => c.id === req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaña no encontrada' });
  }

  const sent = campaign.results.filter(r => r.status === 'enviado');

  if (sent.length === 0) {
    return res.status(400).json({ error: 'No hay registros enviados' });
  }

  let csv = 'nombre,email,telefono,estado\n';
  sent.forEach(result => {
    csv += `"${result.contact.nombre}","${result.contact.email}","${result.contact.telefono}",enviado\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="enviados_${req.params.id}.csv"`);
  res.send(csv);
});

// 7. Descargar CSV de errores
app.get('/api/export/campaign/:id/errors', (req, res) => {
  const campaign = campaignHistory.find(c => c.id === req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaña no encontrada' });
  }

  const errors = campaign.results.filter(r => r.status === 'error');

  if (errors.length === 0) {
    return res.status(400).json({ error: 'No hay registros con error' });
  }

  let csv = 'nombre,email,telefono,error\n';
  errors.forEach(result => {
    csv += `"${result.contact.nombre}","${result.contact.email}","${result.contact.telefono}","${result.message}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="errores_${req.params.id}.csv"`);
  res.send(csv);
});

// 8. Obtener configuración actual
app.get('/api/config', (req, res) => {
  res.json({
    emailFrom: process.env.EMAIL_FROM,
    emailFromName: process.env.EMAIL_FROM_NAME,
    maxFileSize: process.env.MAX_FILE_SIZE,
    defaultDelay: process.env.DEFAULT_DELAY
  });
});

// 9. Actualizar configuración
app.post('/api/config', (req, res) => {
  const { apiKey, emailFrom, defaultDelay } = req.body;

  if (apiKey) process.env.RESEND_API_KEY = apiKey;
  if (emailFrom) process.env.EMAIL_FROM = emailFrom;
  if (defaultDelay) process.env.DEFAULT_DELAY = defaultDelay;

  res.json({
    success: true,
    message: 'Configuración actualizada'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Mass Sender PRO corriendo en http://localhost:${PORT}`);
});
