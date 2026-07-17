const totalEl = document.getElementById('total-value');
const activeEl = document.getElementById('active-value');
const updatedEl = document.getElementById('updated-at');
const dotEl = document.getElementById('status-dot');
const closeBtn = document.getElementById('close-btn');

closeBtn.addEventListener('click', () => window.widgetAPI.closeApp());

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

window.widgetAPI.onStatsUpdate(({ ok, stats, error }) => {
  if (ok) {
    totalEl.textContent = stats.total.toLocaleString('es-ES');
    activeEl.textContent = stats.active.toLocaleString('es-ES');
    updatedEl.textContent = `Actualizado ${formatTime(stats.updatedAt)}`;
    dotEl.className = 'dot ok';
  } else {
    updatedEl.textContent = `Error: ${error}`;
    dotEl.className = 'dot error';
  }
});
