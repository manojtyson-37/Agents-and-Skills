const REFRESH_INTERVAL = 2000;
let taskChart = null;
let decisionChart = null;
let workflow = {}, decisions = [], metrics = {}, history = [], notifications = [], archives = [];
let expandedWorkflows = new Set(['current']);

async function fetchData() {
  try {
    [workflow, decisions, metrics, history, notifications, archives] = await Promise.all([
      fetch('/api/workflow').then(r => r.json()),
      fetch('/api/decisions').then(r => r.json()),
      fetch('/api/metrics').then(r => r.json()),
      fetch('/api/history').then(r => r.json()),
      fetch('/api/notifications').then(r => r.json()),
      fetch('/api/archives').then(r => r.json()).catch(() => [])
    ]);
    render();
    updateTime();
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

function render() {
  renderHeader();
  renderActiveTask();
  renderKPIs();
  renderCharts();
  renderAlerts();
  renderTasks();
  renderDecisions();
}

function renderActiveTask() {
  const content = document.getElementById('active-task-content');
  const statusEl = document.getElementById('active-status');
  const hero = document.getElementById('hero-character');

  if (!workflow.inProgressTask || !workflow.tasks) {
    document.getElementById('active-title').textContent = 'No active task';
    document.getElementById('active-owner').textContent = '--';
    document.getElementById('active-timer').textContent = '00:00';
    document.getElementById('active-progress-bar').style.width = '0%';
    statusEl.textContent = workflow.status === 'completed' ? 'DONE' : 'WAITING';
    statusEl.className = 'meta-item' + (workflow.status === 'completed' ? '' : ' status-badge-active');
    if (hero) hero.className = 'hero-wrap ' + (workflow.status === 'completed' ? 'done' : 'idle');
    return;
  }

  const task = workflow.tasks[workflow.inProgressTask];
  if (!task) return;

  document.getElementById('active-title').textContent = task.title || workflow.inProgressTask;
  document.getElementById('active-owner').textContent = `${task.owner || 'unassigned'} · Est: ${task.estimate || '—'}h`;
  document.getElementById('active-estimate').textContent = `Est: ${task.estimate}h`;
  statusEl.textContent = 'IN PROGRESS';
  statusEl.className = 'meta-item status-badge-active';
  if (hero) hero.className = 'hero-wrap flying';

  const estimate = (task.estimate || 0.5) * 3600;
  const elapsed = task.startedAt ? Math.round((Date.now() - new Date(task.startedAt)) / 1000) : 0;
  const progress = Math.min(100, (elapsed / estimate) * 100);
  document.getElementById('active-progress-bar').style.width = progress + '%';
  updateTaskTimer(elapsed);
}

function updateTaskTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  document.getElementById('active-timer').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function renderHeader() {
  const badge = document.getElementById('status-badge');
  const light = document.getElementById('status-indicator');

  if (workflow.status === 'completed') {
    badge.className = 'status-badge completed';
    badge.textContent = 'DONE';
    light.className = 'status-light idle';
  } else if (workflow.status === 'in-progress' || workflow.status === 'bootstrapping') {
    badge.className = 'status-badge working';
    badge.textContent = workflow.status === 'bootstrapping' ? 'STARTING' : 'ACTIVE';
    light.className = 'status-light working';
  } else {
    badge.className = 'status-badge idle';
    badge.textContent = 'IDLE';
    light.className = 'status-light idle';
  }
}

function renderKPIs() {
  document.getElementById('workflow-title').textContent = workflow.objective || 'Ready for tasks';

  const taskCount = Object.keys(workflow.tasks || {}).length;
  const completedCount = (workflow.completedTasks || []).length;
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  document.getElementById('progress-bar').style.width = progress + '%';
  document.getElementById('progress-text').textContent = progress + '%';
  document.getElementById('elapsed-time').textContent = workflow.elapsedTime || '—';

  const healthScore = calculateHealthScore();
  const healthEl = document.getElementById('health-score');
  healthEl.textContent = healthScore + '%';
  healthEl.className = healthScore >= 80 ? 'value good' : healthScore >= 60 ? 'value warning' : 'value danger';

  const usage = metrics.tokenUsage || {};
  const totalTk = usage.totalTokens || 0;
  document.getElementById('total-tokens').textContent = totalTk > 0 ? formatTokenCount(totalTk) : '--';
  document.getElementById('burn-rate').textContent = usage.burnRate ? formatTokenCount(usage.burnRate) : '--';
  document.getElementById('tool-calls').textContent = usage.toolCalls || '--';
  document.getElementById('avg-per-call').textContent = usage.avgPerCall ? formatTokenCount(usage.avgPerCall) : '--';
  document.getElementById('peak-output').textContent = usage.peakOutput ? formatTokenCount(usage.peakOutput) : '--';

  const approved = decisions.filter(d => d.decision === 'APPROVE').length;
  const reworked = decisions.filter(d => d.decision === 'REWORK').length;
  const escalated = decisions.filter(d => d.decision === 'ESCALATE').length;
  document.getElementById('decisions-approved').textContent = approved;
  document.getElementById('decisions-reworked').textContent = reworked;
  document.getElementById('decisions-escalated').textContent = escalated;
}

function calculateHealthScore() {
  let score = 100;
  if (workflow.blockers && workflow.blockers.length > 0) score -= workflow.blockers.length * 10;
  const reworkCount = decisions.filter(d => d.decision === 'REWORK').length;
  score -= reworkCount * 5;
  const tasks = workflow.tasks || {};
  const overrunCount = Object.values(tasks).filter(t => {
    if (!t.estimate || !t.completedAt || !t.startedAt) return false;
    const actual = (new Date(t.completedAt) - new Date(t.startedAt)) / 1000 / 3600;
    return actual > t.estimate * 1.2;
  }).length;
  score -= overrunCount * 5;
  return Math.max(0, Math.min(100, score));
}

function renderCharts() {
  const tasks = workflow.tasks || {};
  const taskStats = {
    completed: (workflow.completedTasks || []).length,
    active: workflow.inProgressTask ? 1 : 0,
    pending: (workflow.queuedTasks || []).length,
    blocked: Object.values(tasks).filter(t => {
      if (!t.blockedBy?.length) return false;
      return !t.blockedBy.every(b => tasks[b]?.status === 'completed');
    }).length
  };

  const taskData = [taskStats.completed, taskStats.active, taskStats.pending, taskStats.blocked];
  const taskColors = ['#2ED8A3', '#FF9F43', '#5C5C66', '#FF6B8A'];

  // Update doughnut in-place if it exists
  const taskCtx = document.getElementById('task-chart')?.getContext('2d');
  if (taskCtx) {
    if (taskChart) {
      taskChart.data.datasets[0].data = taskData;
      taskChart.update('none');
    } else {
      taskChart = new Chart(taskCtx, {
        type: 'doughnut',
        data: {
          labels: ['Done', 'Active', 'Queued', 'Blocked'],
          datasets: [{
            data: taskData,
            backgroundColor: taskColors,
            borderColor: '#1A1A1E',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '72%',
          animation: { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#232328',
              titleColor: '#F5F5F7',
              bodyColor: '#C8C8CF',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 10
            }
          }
        }
      });
    }
  }

  // Decision timeline — update in-place
  const decisionByHour = {};
  decisions.forEach(d => {
    const hour = new Date(d.timestamp).getHours();
    decisionByHour[hour] = (decisionByHour[hour] || 0) + 1;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const counts = hours.map(h => decisionByHour[h] || 0);

  const decisionCtx = document.getElementById('decision-chart')?.getContext('2d');
  if (decisionCtx) {
    if (decisionChart) {
      decisionChart.data.datasets[0].data = counts;
      decisionChart.update('none');
    } else {
      decisionChart = new Chart(decisionCtx, {
        type: 'line',
        data: {
          labels: hours.map(h => h + ':00'),
          datasets: [{
            label: 'Decisions',
            data: counts,
            borderColor: '#FF9F43',
            backgroundColor: 'rgba(255,159,67,0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#FF9F43',
            pointBorderColor: '#1A1A1E',
            pointBorderWidth: 2,
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          animation: { duration: 400 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#232328',
              titleColor: '#F5F5F7',
              bodyColor: '#C8C8CF',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 10
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: '#5C5C66', font: { size: 10 } },
              grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }
            },
            x: {
              ticks: {
                color: '#5C5C66',
                font: { size: 10 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12
              },
              grid: { display: false }
            }
          }
        }
      });
    }
  }
}

function renderAlerts() {
  const container = document.getElementById('alerts-container');
  const alerts = [];

  const pendingNotifications = notifications.filter(n => !n.acknowledged && n.requiresUserAck);
  pendingNotifications.forEach(n => {
    let type = 'info';
    if (n.type === 'workflow-complete' || (n.message && n.message.includes('WORKFLOW COMPLETE'))) type = 'success';
    else if (n.type === 'blocker-detected') type = 'danger';
    else if (n.type === 'feedback-needed') type = 'warning';

    alerts.push({
      type,
      message: n.message || n.type,
      time: new Date(n.timestamp).toLocaleTimeString(),
      id: n.id
    });
  });

  if (workflow.blockers && workflow.blockers.length > 0) {
    workflow.blockers.forEach(b => {
      alerts.push({ type: 'danger', message: `Blocked: ${b}`, time: new Date().toLocaleTimeString() });
    });
  }

  const allTasks = workflow.tasks || {};
  Object.entries(allTasks).forEach(([id, task]) => {
    if (task.status === 'in-progress' && task.estimate && task.startedAt) {
      const elapsed = (Date.now() - new Date(task.startedAt)) / 1000 / 3600;
      if (elapsed > task.estimate * 1.3) {
        alerts.push({ type: 'warning', message: `${task.title || id} over estimate`, time: new Date().toLocaleTimeString() });
      }
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = '<p class="empty">No alerts</p>';
  } else {
    container.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.type}" ${a.id ? `data-id="${a.id}"` : ''}>
        <span>${a.message}</span>
        <span class="alert-time">${a.time}</span>
        ${a.id ? `<button class="alert-ack-btn" onclick="acknowledgeNotification('${a.id}')">Dismiss</button>` : ''}
      </div>
    `).join('');
  }
}

async function acknowledgeNotification(notificationId) {
  try {
    const r = await fetch(`/api/notifications/${notificationId}/acknowledge`, { method: 'POST' });
    if (r.ok) fetchData();
  } catch (e) {
    console.error('Ack error:', e);
  }
}

function toggleWorkflow(id) {
  if (expandedWorkflows.has(id)) expandedWorkflows.delete(id);
  else expandedWorkflows.add(id);
  renderTaskHistory();
}

function renderTaskHistory() {
  const container = document.getElementById('task-history-container');
  const allWorkflows = [];

  // Current workflow first
  if (workflow.objective && Object.keys(workflow.tasks || {}).length > 0) {
    allWorkflows.push({ ...workflow, _id: 'current', _label: 'Current' });
  }

  // Archived workflows
  archives.forEach((a, i) => {
    allWorkflows.push({ ...a, _id: 'archive-' + i, _label: 'Past' });
  });

  const totalTasks = allWorkflows.reduce((sum, w) => sum + Object.keys(w.tasks || {}).length, 0);
  document.getElementById('task-count').textContent = totalTasks;

  if (allWorkflows.length === 0) {
    container.innerHTML = '<p class="empty">No task history yet</p>';
    return;
  }

  container.innerHTML = allWorkflows.map(w => {
    const tasks = w.tasks || {};
    const entries = Object.entries(tasks);
    const total = entries.length;
    const completedFromArray = (w.completedTasks || []).length;
    const completedFromStatus = entries.filter(([, t]) => t.status === 'completed').length;
    const completed = w.status === 'completed' ? total : Math.max(completedFromArray, completedFromStatus);
    const isExpanded = expandedWorkflows.has(w._id);
    const isCurrent = w._id === 'current';

    let wfStatus = 'idle';
    if (w.status === 'completed') wfStatus = 'done';
    else if (w.status === 'in-progress' || w.status === 'bootstrapping') wfStatus = 'active';

    const date = w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    const subtasksHtml = entries.map(([id, task]) => {
      let status = 'pending', icon = '⏳';
      if (task.status === 'completed' || wfStatus === 'done') { status = 'completed'; icon = '✓'; }
      else if (task.status === 'in-progress') { status = 'active'; icon = '▶'; }
      else if (task.blockedBy?.length > 0) {
        const allBlockersComplete = task.blockedBy.every(b => {
          const blocker = tasks[b];
          return blocker && blocker.status === 'completed';
        });
        if (!allBlockersComplete) { status = 'blocked'; icon = '✗'; }
      }

      const duration = task.completedAt && task.startedAt
        ? Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000 / 60) + 'm'
        : task.startedAt ? 'running' : '—';

      return `
        <div class="task-item ${status}">
          <div class="task-status-icon">${icon}</div>
          <div class="task-content">
            <div class="task-name">${task.title || id}</div>
            <div class="task-meta">${task.owner || '?'} · ${task.estimate ? task.estimate + 'h' : '—'}</div>
          </div>
          <div class="task-duration">
            <div class="duration-value">${duration}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="workflow-group ${wfStatus} ${isExpanded ? 'expanded' : ''}">
        <div class="workflow-group-header" onclick="toggleWorkflow('${w._id}')">
          <span class="wf-chevron">${isExpanded ? '▾' : '▸'}</span>
          <div class="wf-header-content">
            <div class="wf-title">${w.objective || 'Untitled workflow'}</div>
            <div class="wf-header-meta">
              <span class="wf-date">${date}</span>
              <span class="wf-progress-pill ${wfStatus}">${completed}/${total}</span>
              ${isCurrent ? '<span class="wf-current-badge">LIVE</span>' : ''}
            </div>
          </div>
        </div>
        <div class="workflow-group-body" style="${isExpanded ? '' : 'display:none'}">
          ${subtasksHtml}
        </div>
      </div>`;
  }).join('');
}

function renderTasks() {
  renderTaskHistory();
}

function renderDecisions() {
  const container = document.getElementById('decision-log');
  document.getElementById('decision-count').textContent = decisions.length;

  if (decisions.length === 0) {
    container.innerHTML = '<p class="empty">No decisions logged</p>';
    return;
  }

  container.innerHTML = decisions.slice().reverse().slice(0, 50).map(d => {
    const time = new Date(d.timestamp).toLocaleTimeString();
    let type = 'approve';
    if (d.decision === 'REWORK') type = 'rework';
    else if (d.decision === 'ESCALATE') type = 'escalate';

    return `
      <div class="decision-entry ${type}">
        <div class="decision-body">
          <div class="decision-action">${d.decision || 'EVENT'}</div>
          <div class="decision-reason">${d.reason || ''}</div>
          ${d.nextTask ? `<div class="decision-next">→ ${d.nextTask}</div>` : ''}
        </div>
        <div class="decision-time">${time}</div>
      </div>
    `;
  }).join('');
}

function formatTokenCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function updateTime() {
  const now = new Date();
  document.getElementById('current-time').textContent =
    now.toLocaleTimeString('en-US', { hour12: false });
  document.getElementById('last-update').textContent =
    now.toLocaleTimeString();
}

// Live timer for active task
setInterval(() => {
  if (workflow.inProgressTask && workflow.tasks?.[workflow.inProgressTask]?.startedAt) {
    const elapsed = Math.round((Date.now() - new Date(workflow.tasks[workflow.inProgressTask].startedAt)) / 1000);
    updateTaskTimer(elapsed);
  }
}, 1000);

setInterval(fetchData, REFRESH_INTERVAL);
fetchData();
setInterval(updateTime, 1000);
