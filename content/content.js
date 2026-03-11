console.log("🔍 Browser Detection Starting...");

function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  let browser = "Unknown";
  let version = "Unknown";
  
  if (userAgent.includes('Brave')) {
    browser = "Brave";
    const match = userAgent.match(/Brave\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  else if (userAgent.includes('Chrome') && !userAgent.includes('Edg') && !userAgent.includes('OPR')) {
    browser = "Chrome";
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  else if (userAgent.includes('Edg')) {
    browser = "Edge";
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  else if (userAgent.includes('Firefox')) {
    browser = "Firefox";
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = "Safari";
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  
  return { browser, version, userAgent: userAgent.substring(0, 50) + "..." };
}

const browserInfo = getBrowserInfo();
console.log(`🌐 Running on: ${browserInfo.browser} v${browserInfo.version}`);
console.log(`📱 User Agent: ${browserInfo.userAgent}`);

console.log("🔧 Extension APIs:");
console.log("  - chrome API:", typeof chrome !== 'undefined' ? "Available ✅" : "Missing ❌");
console.log("  - browser API:", typeof browser !== 'undefined' ? "Available ✅" : "Missing ❌");
console.log("  - crypto.subtle:", typeof crypto !== 'undefined' && crypto.subtle ? "Available ✅" : "Missing ❌");
console.log("  - fetch API:", typeof fetch !== 'undefined' ? "Available ✅" : "Missing ❌");  

console.log("✅ Password Hygiene Analytics Tool: Content script loaded!");
console.log("📦 zxcvbn available:", typeof zxcvbn !== 'undefined');

const indicators = new WeakMap();
const breachCache = new Map();

async function sha1Hash(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

async function checkBreach(password) {
  if (!password || password.length === 0) {
    return { isBreached: false, count: 0 };
  }
  
  try {
    const hash = await sha1Hash(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    const cacheKey = prefix;
    if (breachCache.has(cacheKey)) {
      const suffixes = breachCache.get(cacheKey);
      const isBreached = suffixes.includes(suffix);
      return { isBreached, count: isBreached ? 1 : 0, hashPrefix: prefix };
    }
    
    console.log(`🔍 Checking breach for prefix: ${prefix}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'Password-Hygiene-Analytics-Tool' },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
    
    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }
    
    const text = await response.text();
    const suffixes = text.split('\r\n').map(line => line.split(':')[0]);
    
    breachCache.set(cacheKey, suffixes);
    const isBreached = suffixes.includes(suffix);
    const count = isBreached ? 1 : 0;
    
    console.log(`🔐 Breach check: ${isBreached ? '❌ BREACHED' : '✅ Safe'} (prefix: ${prefix})`);
    
    return { isBreached, count, hashPrefix: prefix };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Breach check timeout');
      return { isBreached: false, count: 0, error: 'Request timeout' };
    } else {
      console.error('❌ Breach check failed:', error);
      return { isBreached: false, count: 0, error: error.message };
    }
  }
}

function findPasswordFields() {
  return document.querySelectorAll('input[type="password"]');
}

function monitorPasswordFields() {
  console.log('🔍 Scanning for password fields...');
  const passwordFields = findPasswordFields();
  
  console.log(`🎯 Found ${passwordFields.length} password field(s)`);
  
  if (passwordFields.length === 0) {
    console.log('⚠️ No password fields found on this page');
    return;
  }
  
  // Only create ONE indicator for the first password field
  // This ensures only one meter appears
  const field = passwordFields[0];
  console.log(`📋 Using primary field:`, field.id || field.name || 'unnamed field');
  
  if (!indicators.has(field)) {
    console.log(`👁️ Creating single password meter`);
    createPasswordMeter(field);
    indicators.set(field, true);
    console.log(`✅ Password meter created`);
  }
  
  console.log('🔄 Setting up auto-show meter');
  setupAutoShowMeter();
}

function makeDraggable(element, handleSelector = '.meter-header') {
  const handle = element.querySelector(handleSelector);
  if (!handle) {
    console.error('❌ Drag handle not found for element:', element);
    return;
  }
  
  console.log('🎯 Making element draggable with handle:', handle);
  
  handle.style.cursor = 'grab';
  let isDragging = false;
  let offsetX, offsetY;
  let startX, startY;
  let wasDragged = false;

  function startDrag(e) {
    if (e.target.classList.contains('close-btn')) {
      console.log('🚫 Close button clicked, not dragging');
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    wasDragged = false;
    
    const rect = element.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (!clientX || !clientY) return;
    
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    
    startX = clientX;
    startY = clientY;
    
    handle.style.cursor = 'grabbing';
    element.style.transition = 'none';
    element.classList.add('dragging');
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', dragTouch, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
    console.log('👉 Drag started');
  }

  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) {
      wasDragged = true;
    }
    
    let newX = clientX - offsetX;
    let newY = clientY - offsetY;
    
    newX = Math.max(0, Math.min(newX, window.innerWidth - element.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - element.offsetHeight));
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
    element.style.position = 'fixed';
  }

  function dragTouch(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) {
      wasDragged = true;
    }
    
    let newX = clientX - offsetX;
    let newY = clientY - offsetY;
    
    newX = Math.max(0, Math.min(newX, window.innerWidth - element.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - element.offsetHeight));
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
    element.style.position = 'fixed';
  }

  function stopDrag() {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = 'grab';
      element.style.transition = '';
      element.classList.remove('dragging');
      
      if (wasDragged) {
        savePosition(element.id, {
          x: parseInt(element.style.left) || 0,
          y: parseInt(element.style.top) || 0
        });
        console.log('💾 Drag stopped, position saved');
      }
    }
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', dragTouch);
    document.removeEventListener('touchend', stopDrag);
  }

  handle.addEventListener('mousedown', startDrag);
  handle.addEventListener('touchstart', startDrag, { passive: false });
  
  function savePosition(id, pos) {
    const key = id + 'Position';
    chrome.storage.sync.set({ [key]: pos });
  }
  
  chrome.storage.sync.get([element.id + 'Position'], (result) => {
    const pos = result[element.id + 'Position'];
    if (pos) {
      element.style.position = 'fixed';
      element.style.left = pos.x + 'px';
      element.style.top = pos.y + 'px';
      console.log('📌 Loaded saved position for', element.id);
    }
  });
}

function createPasswordMeter(passwordField) {
  console.log('🔧 Creating single password meter for field:', passwordField);
  
  if (passwordField._passwordMeter) {
    console.log('⚠️ Meter already exists, returning');
    return;
  }
  
  const container = document.createElement('div');
  container.id = 'password-meter-' + Math.random().toString(36).substr(2, 9);
  container.className = 'password-strength-meter';
  container.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    width: 320px;
    background: #ffffff;
    border-radius: 16px;
    border: 2px solid #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 12px 28px rgba(0,0,0,0.2);
    display: none;
    font-size: 13px;
    overflow: hidden;
  `;
  
  // Header
  const header = document.createElement('div');
  header.className = 'meter-header';
  header.style.cssText = `
    background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
    color: white;
    padding: 16px 20px;
    font-weight: 700;
    font-size: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: grab;
    user-select: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  title.innerHTML = '🔒 Password Security Dashboard';
  
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.style.cssText = `
    cursor: pointer;
    font-size: 24px;
    padding: 0 8px;
    border-radius: 4px;
    transition: background 0.2s;
  `;
  closeBtn.innerHTML = '×';
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.2)');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'none');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
  });
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Content
  const content = document.createElement('div');
  content.style.cssText = `padding: 20px;`;
  
  // Password Strength Section
  const strengthSection = document.createElement('div');
  strengthSection.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  `;
  
  const strengthLabel = document.createElement('div');
  strengthLabel.style.cssText = `
    font-size: 20px;
    font-weight: 700;
    color: #ff6b6b;
  `;
  strengthLabel.textContent = 'Very Weak';
  
  const scoreBadge = document.createElement('div');
  scoreBadge.style.cssText = `
    background: #e9ecef;
    color: #495057;
    padding: 6px 12px;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 600;
  `;
  scoreBadge.textContent = '0/4';
  
  strengthSection.appendChild(strengthLabel);
  strengthSection.appendChild(scoreBadge);
  
  // Security Level Bar
  const securityLevelSection = document.createElement('div');
  securityLevelSection.style.cssText = `margin-bottom: 20px;`;
  
  const securityLevelHeader = document.createElement('div');
  securityLevelHeader.style.cssText = `
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    color: #6c757d;
  `;
  securityLevelHeader.innerHTML = '<span>Security Level</span><span class="security-value">0/4</span>';
  
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 100%;
    height: 10px;
    background: #e9ecef;
    border-radius: 5px;
    overflow: hidden;
  `;
  
  const progressFill = document.createElement('div');
  progressFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: #ff6b6b;
    transition: width 0.3s ease;
    border-radius: 5px;
  `;
  
  progressBar.appendChild(progressFill);
  securityLevelSection.appendChild(securityLevelHeader);
  securityLevelSection.appendChild(progressBar);
  
  // Metrics Grid
  const metricsGrid = document.createElement('div');
  metricsGrid.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    background: #f8f9fa;
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 16px;
  `;
  
  // Length
  const lengthMetric = document.createElement('div');
  lengthMetric.style.cssText = `text-align: center;`;
  lengthMetric.innerHTML = `
    <div style="font-size: 11px; color: #6c757d; margin-bottom: 4px;">📏 LENGTH</div>
    <div style="font-size: 18px; font-weight: 700; color: #495057;" class="length-value">0</div>
  `;
  
  // Crack Time
  const crackTimeMetric = document.createElement('div');
  crackTimeMetric.style.cssText = `text-align: center;`;
  crackTimeMetric.innerHTML = `
    <div style="font-size: 11px; color: #6c757d; margin-bottom: 4px;">⏱️ CRACK TIME</div>
    <div style="font-size: 14px; font-weight: 600; color: #495057;" class="crack-time-value">instant</div>
  `;
  
  // Breach Status
  const breachMetric = document.createElement('div');
  breachMetric.style.cssText = `text-align: center; grid-column: span 2;`;
  breachMetric.innerHTML = `
    <div style="font-size: 11px; color: #6c757d; margin-bottom: 4px;">🔐 BREACH STATUS</div>
    <div style="font-size: 16px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block;" class="breach-status-value">Checking...</div>
  `;
  
  metricsGrid.appendChild(lengthMetric);
  metricsGrid.appendChild(crackTimeMetric);
  metricsGrid.appendChild(breachMetric);
  
  // Feedback Message
  const feedbackMessage = document.createElement('div');
  feedbackMessage.style.cssText = `
    padding: 12px 16px;
    background: #f0fff4;
    border-left: 4px solid #28a745;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.5;
    display: none;
  `;
  
  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
  `;
  
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '↻ Refresh';
  refreshBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    background: #e9ecef;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  refreshBtn.addEventListener('mouseenter', () => {
    refreshBtn.style.background = '#dee2e6';
  });
  refreshBtn.addEventListener('mouseleave', () => {
    refreshBtn.style.background = '#e9ecef';
  });
  refreshBtn.addEventListener('click', () => {
    refreshMeterData(passwordField);
  });
  
  const detailsBtn = document.createElement('button');
  detailsBtn.textContent = '📋 Details';
  detailsBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  detailsBtn.addEventListener('mouseenter', () => {
    detailsBtn.style.background = '#3a7bc8';
  });
  detailsBtn.addEventListener('mouseleave', () => {
    detailsBtn.style.background = '#4a90e2';
  });
  detailsBtn.addEventListener('click', () => {
    showDetailedAnalysis(passwordField);
  });
  
  buttonContainer.appendChild(refreshBtn);
  buttonContainer.appendChild(detailsBtn);
  
  // Assemble content
  content.appendChild(strengthSection);
  content.appendChild(securityLevelSection);
  content.appendChild(metricsGrid);
  content.appendChild(feedbackMessage);
  content.appendChild(buttonContainer);
  
  container.appendChild(header);
  container.appendChild(content);
  
  document.body.appendChild(container);
  
  // Position near the password field
  const rect = passwordField.getBoundingClientRect();
  const defaultLeft = Math.min(rect.right + 20, window.innerWidth - 340);
  const defaultTop = Math.max(rect.top - 10, 10);
  
  container.style.left = defaultLeft + 'px';
  container.style.top = defaultTop + 'px';
  container.style.display = 'none';
  
  makeDraggable(container, '.meter-header');
  
  // Store references
  passwordField._passwordMeter = {
    container,
    strengthLabel,
    scoreBadge,
    progressFill,
    securityLevelHeader,
    lengthValue: lengthMetric.querySelector('.length-value'),
    crackTimeValue: crackTimeMetric.querySelector('.crack-time-value'),
    breachStatusValue: breachMetric.querySelector('.breach-status-value'),
    feedbackMessage
  };
  
  // Input listener
  if (passwordField._inputHandler) {
    passwordField.removeEventListener('input', passwordField._inputHandler);
  }
  
  passwordField._inputHandler = function(e) {
    clearTimeout(passwordField._inputTimeout);
    passwordField._inputTimeout = setTimeout(async () => {
      await analyzePassword(passwordField, e.target.value);
    }, 300);
  };
  
  passwordField.addEventListener('input', passwordField._inputHandler);
  
  // Cleanup observer
  const observer = new MutationObserver(() => {
    if (!document.body.contains(passwordField)) {
      container.remove();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function getStrengthData(score) {
  const strengths = [
    { name: 'Very Weak', color: '#ff6b6b', level: '0/4' },
    { name: 'Weak', color: '#ffa726', level: '1/4' },
    { name: 'Fair', color: '#ffd93d', level: '2/4' },
    { name: 'Good', color: '#6bcf7f', level: '3/4' },
    { name: 'Strong', color: '#4caf50', level: '4/4' }
  ];
  return strengths[score] || strengths[0];
}

function formatCrackTime(seconds) {
  if (!seconds || seconds === 'unknown') return 'unknown';
  
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const month = day * 30;
  const year = day * 365;
  
  if (seconds < minute) return Math.ceil(seconds) + ' seconds';
  if (seconds < hour) return Math.ceil(seconds / minute) + ' minutes';
  if (seconds < day) return Math.ceil(seconds / hour) + ' hours';
  if (seconds < month) return Math.ceil(seconds / day) + ' days';
  if (seconds < year) return Math.ceil(seconds / month) + ' months';
  return Math.ceil(seconds / year) + ' years';
}

async function analyzePassword(passwordField, password) {
  console.log('🔍 Analyzing password:', password);
  
  const meter = passwordField._passwordMeter;
  if (!meter) return;
  
  if (password.length === 0) {
    meter.container.style.display = 'none';
    return;
  }
  
  meter.container.style.display = 'block';
  
  // Update breach status to checking
  meter.breachStatusValue.textContent = 'Checking...';
  meter.breachStatusValue.style.background = '#e9ecef';
  meter.breachStatusValue.style.color = '#495057';
  
  let score, analysis;
  if (typeof zxcvbn !== 'undefined') {
    analysis = zxcvbn(password);
    score = analysis.score;
    
    console.log('🔐 zxcvbn analysis:', {
      score: score,
      crackTime: analysis.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown'
    });
  } else {
    score = Math.min(4, Math.floor(password.length / 3));
    analysis = { 
      crack_times_display: { offline_fast_hashing_1e10_per_second: 'unknown' },
      feedback: { warning: '', suggestions: [] }
    };
  }
  
  const breachPromise = checkBreach(password);
  
  // Wait for breach result FIRST
  let breachResult = { isBreached: false, count: 0 };
  
  try {
    const result = await breachPromise;
    breachResult = result;
  } catch (error) {
    console.error('Breach check error:', error);
    breachResult.error = error.message;
  }
  
  // ===== FIX: Override score if password is breached =====
  // If password is breached, force score to 0 (Very Weak)
  // Also check for common weak passwords
  const commonWeakPasswords = [
    '123456', '12345678', 'password', '123456789', '12345', 
    '1234567', 'password1', '1234567890', '123123', '0',
    '111111', 'abc123', 'qwerty', 'admin', 'letmein', 'welcome'
  ];
  
  let finalScore = score;
  let finalStrengthData = getStrengthData(score);
  
  if (breachResult.isBreached) {
    console.log('🚨 Password breached - forcing score to 0');
    finalScore = 0;
    finalStrengthData = getStrengthData(0);
    
    // Update feedback message for breached password
    if (meter.feedbackMessage) {
      meter.feedbackMessage.textContent = `🚨 CRITICAL: This password has appeared in ${breachResult.count} data breach(es)! Do NOT use this password anywhere.`;
      meter.feedbackMessage.style.background = '#fff5f5';
      meter.feedbackMessage.style.borderLeftColor = '#dc3545';
      meter.feedbackMessage.style.display = 'block';
    }
  } 
  else if (commonWeakPasswords.includes(password.toLowerCase())) {
    console.log('⚠️ Common weak password detected - forcing score to 0');
    finalScore = 0;
    finalStrengthData = getStrengthData(0);
    
    // Update feedback message for common weak password
    if (meter.feedbackMessage) {
      meter.feedbackMessage.textContent = `⚠️ This is a very common password and is extremely easy to guess. Choose a different, unique password.`;
      meter.feedbackMessage.style.background = '#fff5f5';
      meter.feedbackMessage.style.borderLeftColor = '#dc3545';
      meter.feedbackMessage.style.display = 'block';
    }
  }
  else if (score <= 1) {
    // Already weak, keep as is
    if (meter.feedbackMessage) {
      let feedbackText = '';
      if (analysis?.feedback?.warning) {
        feedbackText = `⚠️ ${analysis.feedback.warning}`;
      } else {
        feedbackText = '⚠️ This password is too weak. Add more characters, numbers, and symbols.';
      }
      meter.feedbackMessage.textContent = feedbackText;
      meter.feedbackMessage.style.background = '#fff5f5';
      meter.feedbackMessage.style.borderLeftColor = '#dc3545';
      meter.feedbackMessage.style.display = 'block';
    }
  }
  
  const widthPercent = (finalScore + 1) * 20;
  
  // Update UI with FINAL score (overridden if breached)
  meter.strengthLabel.textContent = finalStrengthData.name;
  meter.strengthLabel.style.color = finalStrengthData.color;
  
  meter.scoreBadge.textContent = `${finalScore}/4`;
  meter.scoreBadge.style.background = finalStrengthData.color;
  meter.scoreBadge.style.color = '#ffffff';
  
  meter.securityLevelHeader.querySelector('.security-value').textContent = `${finalScore}/4`;
  
  meter.progressFill.style.width = widthPercent + '%';
  meter.progressFill.style.background = finalStrengthData.color;
  
  meter.lengthValue.textContent = password.length;
  
  // Format crack time
  const crackTimeSeconds = analysis?.crack_times_display?.offline_fast_hashing_1e10_per_second;
  let crackTimeDisplay = 'unknown';
  
  if (crackTimeSeconds && crackTimeSeconds !== 'unknown') {
    if (typeof crackTimeSeconds === 'number') {
      crackTimeDisplay = formatCrackTime(crackTimeSeconds);
    } else {
      crackTimeDisplay = crackTimeSeconds;
    }
  }
  
  // Override crack time for breached/common passwords
  if (breachResult.isBreached || commonWeakPasswords.includes(password.toLowerCase())) {
    crackTimeDisplay = 'INSTANT (breached)';
  }
  
  meter.crackTimeValue.textContent = crackTimeDisplay;
  
  // Update breach status
  if (breachResult.isBreached) {
    meter.breachStatusValue.textContent = `❌ BREACHED (${breachResult.count})`;
    meter.breachStatusValue.style.background = '#dc3545';
    meter.breachStatusValue.style.color = 'white';
  } else if (breachResult.error) {
    meter.breachStatusValue.textContent = '⚠️ CHECK FAILED';
    meter.breachStatusValue.style.background = '#ffc107';
    meter.breachStatusValue.style.color = '#495057';
  } else {
    meter.breachStatusValue.textContent = '✅ SAFE';
    meter.breachStatusValue.style.background = '#28a745';
    meter.breachStatusValue.style.color = 'white';
  }
  
  // Update feedback message if not already set by breach/weak conditions
  if (!meter.feedbackMessage.style.display || meter.feedbackMessage.style.display === 'none') {
    if (analysis && analysis.feedback) {
      let feedbackText = '';
      
      if (analysis.feedback.warning) {
        feedbackText = `⚠️ ${analysis.feedback.warning}`;
        meter.feedbackMessage.style.background = '#fff5f5';
        meter.feedbackMessage.style.borderLeftColor = '#dc3545';
      } else if (analysis.feedback.suggestions && analysis.feedback.suggestions.length > 0) {
        feedbackText = `💡 ${analysis.feedback.suggestions[0]}`;
        meter.feedbackMessage.style.background = '#f0fff4';
        meter.feedbackMessage.style.borderLeftColor = '#28a745';
      }
      
      if (feedbackText) {
        meter.feedbackMessage.textContent = feedbackText;
        meter.feedbackMessage.style.display = 'block';
      } else {
        meter.feedbackMessage.style.display = 'none';
      }
    } else {
      meter.feedbackMessage.style.display = 'none';
    }
  }
}
function refreshMeterData(passwordField) {
  console.log('🔄 Refreshing meter data');
  if (passwordField && passwordField.value) {
    analyzePassword(passwordField, passwordField.value);
  }
}

function showDetailedAnalysis(passwordField) {
  const password = passwordField.value || 'empty';
  const analysis = typeof zxcvbn !== 'undefined' ? zxcvbn(password) : null;
  
  // Check if breached
  let breachStatus = 'Unknown';
  let breachCount = 0;
  
  // We need to get breach result - for now, we'll use a placeholder
  // In a real implementation, you'd want to pass the breach result
  checkBreach(password).then(breachResult => {
    breachStatus = breachResult.isBreached ? 'BREACHED' : 'SAFE';
    breachCount = breachResult.count || 0;
    
    let details = '🔍 DETAILED ANALYSIS\n\n';
    details += `Password: ${'•'.repeat(Math.min(password.length, 20))}\n`;
    details += `Length: ${password.length} characters\n`;
    details += `Breach Status: ${breachStatus} ${breachCount > 0 ? `(${breachCount} breaches)` : ''}\n\n`;
    
    if (analysis) {
      // Override score if breached
      const finalScore = breachResult.isBreached ? 0 : analysis.score;
      const strengthNames = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
      
      details += `Strength: ${strengthNames[finalScore]} (${finalScore}/4)\n`;
      details += `Crack Time (offline): ${analysis.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown'}\n`;
      details += `Entropy: ${Math.log2(Math.pow(10, analysis.guesses_log10 || 0)).toFixed(1)} bits\n\n`;
      
      if (breachResult.isBreached) {
        details += `🚨 CRITICAL: This password has been exposed in data breaches!\n`;
        details += `Do NOT use this password anywhere. Change it immediately.\n\n`;
      }
      
      if (analysis.feedback?.warning) {
        details += `⚠️ Warning: ${analysis.feedback.warning}\n`;
      }
      
      if (analysis.feedback?.suggestions?.length > 0) {
        details += '\n💡 Suggestions:\n';
        analysis.feedback.suggestions.forEach(s => details += `  • ${s}\n`);
      }
    }
    
    alert(details);
  }).catch(error => {
    alert('Error checking breach status. Please try again.');
  });
}

function showMeterOnFocus() {
  const field = this;
  if (field._passwordMeter) {
    field._passwordMeter.container.style.display = 'block';
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 Content script received:', request);
  
  if (request.action === 'toggleMeter') {
    const fields = findPasswordFields();
    if (fields.length > 0) {
      const field = fields[0];
      if (field._passwordMeter) {
        const meter = field._passwordMeter.container;
        meter.style.display = meter.style.display === 'none' ? 'block' : 'none';
        sendResponse({ success: true });
      } else {
        createPasswordMeter(field);
        sendResponse({ success: true });
      }
    }
    return true;
  }
  
  if (request.action === 'checkPasswords') {
    sendResponse({
      success: true,
      found: findPasswordFields().length > 0,
      count: findPasswordFields().length
    });
    return true;
  }
  
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// Initialization
console.log("🔍 Starting initialization...");
monitorPasswordFields();

const observer = new MutationObserver(() => {
  monitorPasswordFields();
  setupAutoShowMeter();
});
observer.observe(document.body, { childList: true, subtree: true });

setTimeout(monitorPasswordFields, 1000);

console.log("✅ Complete password analyzer active!");