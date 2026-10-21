/**
 * QuillGrade — Interactive Prototype Script
 * Handles screen navigation, mode toggle, counter animation,
 * and micro-interaction states.
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------- Screen Navigation --------
  const screens = document.querySelectorAll('.screen');
  const navItems = document.querySelectorAll('.nav-item');
  const settingsBack = document.getElementById('settingsBack');

  function showScreen(screenId) {
    screens.forEach(s => {
      if (s.classList.contains('active')) {
        s.classList.remove('active');
        s.classList.add('exit-left');
        setTimeout(() => s.classList.remove('exit-left'), 400);
      }
    });

    const target = document.getElementById(screenId);
    if (target) {
      requestAnimationFrame(() => {
        target.classList.add('active');
      });
    }

    // Update nav active states
    navItems.forEach(n => {
      n.classList.toggle('active', n.dataset.screen === screenId);
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetScreen = item.dataset.screen;
      if (targetScreen === 'screenHome' || targetScreen === 'screenSettings') {
        showScreen(targetScreen);
      }
    });
  });

  if (settingsBack) {
    settingsBack.addEventListener('click', () => showScreen('screenHome'));
  }

  // -------- Mode Toggle --------
  const modeToggle = document.getElementById('modeToggle');
  const modeBtns = modeToggle?.querySelectorAll('.mode-btn');

  modeBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modeToggle.dataset.active = btn.dataset.mode;
    });
  });

  // -------- Counter Animation --------
  function animateCounter(el, target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  const scansCounter = document.getElementById('scansCounter');
  if (scansCounter) {
    // Start counter animation after a brief delay
    setTimeout(() => animateCounter(scansCounter, 28), 600);
    scansCounter.textContent = '0';
  }

  // -------- Scan Button Feedback --------
  const startScanBtn = document.getElementById('startScanBtn');
  startScanBtn?.addEventListener('click', () => {
    startScanBtn.style.background = 'linear-gradient(145deg, #0F5132, #14532D)';
    startScanBtn.style.color = 'white';
    startScanBtn.textContent = '';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons-round';
    icon.textContent = 'autorenew';
    icon.style.animation = 'spin 0.8s linear infinite';
    
    const label = document.createTextNode(' Initializing Camera…');
    startScanBtn.appendChild(icon);
    startScanBtn.appendChild(label);

    setTimeout(() => {
      startScanBtn.style.background = 'white';
      startScanBtn.style.color = '#0F5132';
      startScanBtn.innerHTML = `
        <span class="material-icons-round">camera_alt</span>
        Start Optical Scan
        <div class="scan-btn-shimmer"></div>
      `;
    }, 2000);
  });

  // -------- FAB Haptic --------
  const fab = document.getElementById('fabScan');
  fab?.addEventListener('click', () => {
    fab.style.transform = 'scale(0.88)';
    setTimeout(() => {
      fab.style.transform = '';
    }, 150);
  });

  // -------- Alert Bell --------
  const alertBell = document.getElementById('alertBell');
  alertBell?.addEventListener('click', () => {
    const dot = alertBell.querySelector('.bell-dot');
    if (dot) {
      dot.style.opacity = '0';
      dot.style.transform = 'scale(0)';
    }
  });

  // -------- Scan Item Ripple --------
  const scanItems = document.querySelectorAll('.scan-item');
  scanItems.forEach(item => {
    item.addEventListener('click', function() {
      this.style.background = 'var(--surface-subtle)';
      setTimeout(() => {
        this.style.background = 'var(--surface)';
      }, 200);
    });
  });

  // -------- Settings Items Press State --------
  const settingsItems = document.querySelectorAll('.settings-item');
  settingsItems.forEach(item => {
    item.addEventListener('mousedown', function() {
      this.style.transform = 'scale(0.98)';
    });
    item.addEventListener('mouseup', function() {
      this.style.transform = '';
    });
    item.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });

  // -------- Sign Out Confirmation --------
  const signOutBtn = document.getElementById('signOutBtn');
  signOutBtn?.addEventListener('click', () => {
    signOutBtn.innerHTML = `
      <span class="material-icons-round" style="font-size:18px">warning_amber</span>
      Are you sure? Tap again.
    `;
    signOutBtn.style.background = 'var(--red-100)';
    signOutBtn.style.borderColor = 'var(--red-600)';

    // Auto-reset after 3 seconds
    setTimeout(() => {
      signOutBtn.innerHTML = `
        <span class="material-icons-round">logout</span>
        Sign Out
      `;
      signOutBtn.style.background = 'var(--surface)';
      signOutBtn.style.borderColor = 'var(--red-100)';
    }, 3000);
  });

  // -------- Inject Spin Keyframe --------
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
});
