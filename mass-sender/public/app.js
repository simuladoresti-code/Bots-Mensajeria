// Estado global de la aplicación
const appState = {
  contacts: [],
  currentCampaignId: null,
  config: {},
  whatsappLinks: []
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Cargar configuración
  loadConfig();
  
  // Cargar estadísticas
  loadStats();
  
  // Cargar historial
  loadHistory();

  // Event listeners para navegación
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  // Event listeners de formularios
  document.getElementById('csvFile').addEventListener('change', handleFileUpload);
  document.getElementById('emailForm').addEventListener('submit', handleEmailSubmit);
  document.getElementById('whatsappForm').addEventListener('submit', handleWhatsappSubmit);
  document.getElementById('configForm').addEventListener('submit', handleConfigSubmit);

  // Drag and drop
  const uploadZone = document.getElementById('uploadZone');
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.background = 'rgba(233, 69, 96, 0.3)';
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.background = 'rgba(233, 69, 96, 0.1)';
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.background = 'rgba(233, 69, 96, 0.1)';
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      document.getElementById('csvFile').files = e.dataTransfer.files;
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  });
}

// Cambiar pestaña
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(tabName).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Manejar subida de CSV
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload-csv', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      appState.contacts = data.contacts;
      displayContactsPreview(data.contacts);
      showElement('filePreview');
      updateStats({
        totalContacts: data.summary.total,
        pending: data.summary.total
      });
    } else {
      showAlert('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showAlert('Error al subir archivo: ' + error.message, 'error');
  }
}

// Mostrar preview de contactos
function displayContactsPreview(contacts) {
  let html = `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Teléfono</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
  `;

  contacts.slice(0, 10).forEach(contact => {
    const statusClass = contact.valid ? 'status-valid' : 'status-invalid';
    const status = contact.valid ? '✓ Válido' : '✗ ' + (contact.errors[0] || 'Inválido');
    html += `
      <tr>
        <td>${contact.nombre}</td>
        <td>${contact.email || '-'}</td>
        <td>${contact.telefono || '-'}</td>
        <td><span class="${statusClass}">${status}</span></td>
      </tr>
    `;
  });

  if (contacts.length > 10) {
    html += `<tr><td colspan="4" style="text-align:center;color:#a0a0a0;">+ ${contacts.length - 10} contactos más</td></tr>`;
  }

  html += `
      </tbody>
    </table>
  `;

  document.getElementById('previewTable').innerHTML = html;
}

// Resetear upload
function resetUpload() {
  document.getElementById('csvFile').value = '';
  document.getElementById('filePreview').style.display = 'none';
  appState.contacts = [];
}

// Manejar envío de emails
async function handleEmailSubmit(e) {
  e.preventDefault();

  if (appState.contacts.length === 0) {
    showAlert('Por favor carga un archivo CSV primero', 'warning');
    return;
  }

  const subject = document.getElementById('emailSubject').value;
  const message = document.getElementById('emailMessage').value;
  const delay = parseInt(document.getElementById('emailDelay').value);
  const senderName = document.getElementById('emailFrom').value;

  if (!subject || !message) {
    showAlert('Completa todos los campos', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/send-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: appState.contacts.filter(c => c.valid),
        subject,
        message,
        delay,
        senderName
      })
    });

    const data = await response.json();

    if (data.success) {
      appState.currentCampaignId = data.campaignId;
      showElement('emailProgress');
      showAlert('Envío iniciado. Se procesará en segundo plano.', 'success');
      monitorCampaign(data.campaignId);
    } else {
      showAlert('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showAlert('Error: ' + error.message, 'error');
  }
}

// Monitorear progreso de campaña
async function monitorCampaign(campaignId) {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/campaign/${campaignId}`);
      const campaign = await response.json();

      const progress = (campaign.sent / campaign.total) * 100;
      const progressFill = document.getElementById('emailProgressFill');
      progressFill.style.width = progress + '%';
      progressFill.textContent = Math.round(progress) + '%';

      document.getElementById('emailProgressText').textContent = 
        `Enviados: ${campaign.sent} / ${campaign.total} | Errores: ${campaign.errors}`;

      // Mostrar resultados
      displayEmailResults(campaign.results);

      if (campaign.status === 'completado') {
        clearInterval(interval);
        loadHistory();
      }
    } catch (error) {
      clearInterval(interval);
    }
  }, 1000);
}

// Mostrar resultados de email
function displayEmailResults(results) {
  let html = '';
  results.slice(-5).forEach(result => {
    const statusClass = result.status === 'enviado' ? 'success' : 'error';
    html += `
      <div class="result-row ${statusClass}">
        <div class="result-info">
          <strong>${result.contact.nombre}</strong>
          <p>${result.contact.email}</p>
          <p class="result-status">${result.status === 'enviado' ? '✓ Enviado' : '✗ Error: ' + result.message}</p>
        </div>
      </div>
    `;
  });
  document.getElementById('emailResults').innerHTML = html;
}

// Manejar WhatsApp
async function handleWhatsappSubmit(e) {
  e.preventDefault();

  if (appState.contacts.length === 0) {
    showAlert('Por favor carga un archivo CSV primero', 'warning');
    return;
  }

  const message = document.getElementById('whatsappMessage').value;
  const delay = parseInt(document.getElementById('whatsappDelay').value);

  if (!message) {
    showAlert('Ingresa un mensaje', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/generate-whatsapp-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: appState.contacts.filter(c => c.valid && c.telefono),
        message
      })
    });

    const data = await response.json();

    if (data.success) {
      appState.whatsappLinks = data.links;
      displayWhatsappLinks(data.links);
      showElement('whatsappResults');
      showAlert(`Generados ${data.total} links de WhatsApp`, 'success');
    } else {
      showAlert('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showAlert('Error: ' + error.message, 'error');
  }
}

// Mostrar links de WhatsApp
function displayWhatsappLinks(links) {
  let html = '';
  links.forEach((item, index) => {
    html += `
      <div class="link-card">
        <div class="link-card-name">${item.contact.nombre}</div>
        <div class="link-card-phone">📱 ${item.contact.telefono}</div>
        <div class="link-card-message">${item.message}</div>
        <button class="btn btn-success" onclick="openWhatsappLink(${index})">
          Abrir chat
        </button>
      </div>
    `;
  });
  document.getElementById('whatsappLinksContainer').innerHTML = html;
}

// Abrir link de WhatsApp
function openWhatsappLink(index) {
  const link = appState.whatsappLinks[index];
  window.open(link.link, '_blank');
}

// Abrir todos los links de WhatsApp
async function abrirTodosWhatsapp() {
  for (let i = 0; i < appState.whatsappLinks.length; i++) {
    setTimeout(() => {
      openWhatsappLink(i);
    }, parseInt(document.getElementById('whatsappDelay').value) * i);
  }
}

// Cargar configuración
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    appState.config = await response.json();

    document.getElementById('configEmailFrom').value = appState.config.emailFrom || '';
    document.getElementById('configDelay').value = appState.config.defaultDelay || 1000;
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Guardar configuración
async function handleConfigSubmit(e) {
  e.preventDefault();

  const apiKey = document.getElementById('resendApiKey').value;
  const emailFrom = document.getElementById('configEmailFrom').value;
  const defaultDelay = parseInt(document.getElementById('configDelay').value);

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        emailFrom,
        defaultDelay
      })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('Configuración guardada correctamente', 'success');
      loadConfig();
    } else {
      showAlert('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showAlert('Error: ' + error.message, 'error');
  }
}

// Cargar estadísticas
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    document.getElementById('totalContacts').textContent = data.stats.totalContacts;
    document.getElementById('sentCount').textContent = data.stats.sent;
    document.getElementById('pendingCount').textContent = data.stats.pending;
    document.getElementById('errorCount').textContent = data.stats.errors;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Cargar historial
async function loadHistory() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    let html = '';

    if (data.campaigns && data.campaigns.length > 0) {
      data.campaigns.forEach(campaign => {
        const date = new Date(campaign.createdAt);
        const errorRate = campaign.total > 0 ? ((campaign.errors / campaign.total) * 100).toFixed(1) : 0;
        
        html += `
          <div class="history-card">
            <div class="history-header">
              <div>
                <span class="history-type">${campaign.type.toUpperCase()}</span>
              </div>
              <span class="history-date">${date.toLocaleString('es-ES')}</span>
            </div>
            <div class="history-stats">
              <div class="history-stat">
                <div class="history-stat-label">Total</div>
                <div class="history-stat-value">${campaign.total}</div>
              </div>
              <div class="history-stat">
                <div class="history-stat-label">Enviados</div>
                <div class="history-stat-value">${campaign.sent}</div>
              </div>
              <div class="history-stat">
                <div class="history-stat-label">Errores (${errorRate}%)</div>
                <div class="history-stat-value">${campaign.errors}</div>
              </div>
            </div>
            <div class="history-actions">
              <button class="btn btn-secondary" onclick="exportCampaign('${campaign.id}', 'sent')">
                Descargar Enviados
              </button>
              <button class="btn btn-secondary" onclick="exportCampaign('${campaign.id}', 'errors')">
                Descargar Errores
              </button>
            </div>
          </div>
        `;
      });
    } else {
      html = '<p class="empty-state">No hay campañas aún</p>';
    }

    document.getElementById('historyContainer').innerHTML = html;
    document.getElementById('recentCampaigns').innerHTML = data.campaigns?.length > 0 ? html : '<p class="empty-state">No hay campañas aún</p>';
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

// Exportar campaña
function exportCampaign(campaignId, type) {
  window.location.href = `/api/export/campaign/${campaignId}/${type}`;
}

// Utilidades
function showElement(id) {
  document.getElementById(id).style.display = 'block';
}

function hideElement(id) {
  document.getElementById(id).style.display = 'none';
}

function showAlert(message, type = 'info') {
  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 20px 30px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#0096c8'};
    color: white;
    border-radius: 8px;
    z-index: 9999;
    font-weight: 600;
    animation: slideIn 0.3s ease;
  `;
  alertBox.textContent = message;
  document.body.appendChild(alertBox);

  setTimeout(() => {
    alertBox.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => alertBox.remove(), 300);
  }, 3000);
}

function updateStats(newStats) {
  Object.assign(appState, newStats);
  loadStats();
}

// Auto-refresh de estadísticas cada 5 segundos
setInterval(() => {
  loadStats();
}, 5000);
