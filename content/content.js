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
  
  passwordFields.forEach((field, index) => {
    console.log(`📋 Field ${index}:`, field.id || field.name || 'unnamed field');
    
    if (!indicators.has(field)) {
      console.log(`👁️ Creating indicator for field ${index}`);
      createCompleteIndicator(field);
      indicators.set(field, true);
      console.log(`✅ Indicator created and stored for field ${index}`);
    } else {
      console.log(`👁️ Indicator already exists for field ${index}`);
    }
  });
  
  console.log('🔄 Setting up auto-show meter');
  setupAutoShowMeter();
}

function makeDraggable(element, handleSelector = '.indicator-header') {
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
    if (e.target.classList.contains('close-btn') || e.target.classList.contains('pm-close-btn')) {
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

function createCompleteIndicator(passwordField) {
  console.log('🔧 createCompleteIndicator called for field:', passwordField);
  
  if (passwordField._phatCompleteIndicator) {
    console.log('⚠️ Indicator already exists, returning');
    return;
  }
  
  const container = document.createElement('div');
  container.id = 'indicator-' + Math.random().toString(36).substr(2, 9);
  container.className = 'phat-complete-indicator';
  container.style.cssText = `
    position: fixed;
    z-index: 2147483646;
    width: 300px;
    background: #ffffff;
    border-radius: 12px;
    border: 2px solid #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    display: none;
    font-size: 12px;
    resize: both;
    overflow: auto;
    min-width: 280px;
    min-height: 200px;
    max-width: 400px;
  `;
  
  const header = document.createElement('div');
  header.className = 'indicator-header';
  header.style.cssText = `
    background: #4a90e2;
    color: white;
    padding: 12px 16px;
    font-weight: 700;
    border-radius: 10px 10px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: grab;
    user-select: none;
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  `;
  title.innerHTML = '🔒 Password Security Analyzer';
  
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.style.cssText = `
    cursor: pointer;
    font-size: 20px;
    padding: 0 8px;
    border-radius: 4px;
  `;
  closeBtn.innerHTML = '×';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
    console.log('❌ Indicator closed by user');
  });
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  const content = document.createElement('div');
  content.style.cssText = `padding: 16px;`;
  
  const scoreSection = document.createElement('div');
  scoreSection.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `;
  
  const scoreBadge = document.createElement('div');
  scoreBadge.style.cssText = `
    font-size: 24px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    background: #e9ecef;
    color: #495057;
  `;
  scoreBadge.textContent = '0/4';
  
  const strengthLabel = document.createElement('div');
  strengthLabel.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: #ff6b6b;
  `;
  strengthLabel.textContent = 'Very Weak';
  
  scoreSection.appendChild(strengthLabel);
  scoreSection.appendChild(scoreBadge);
  
  const strengthBar = document.createElement('div');
  strengthBar.style.cssText = `
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 16px;
  `;
  
  const strengthFill = document.createElement('div');
  strengthFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: #ff6b6b;
    transition: width 0.3s ease;
  `;
  strengthBar.appendChild(strengthFill);
  
  const detailsGrid = document.createElement('div');
  detailsGrid.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
    background: #f8f9fa;
    padding: 12px;
    border-radius: 8px;
  `;
  
  const charCount = document.createElement('div');
  charCount.style.cssText = `color: #495057;`;
  charCount.innerHTML = `<strong>📏 Length:</strong> <span id="char-count">0</span>`;
  
  const crackTime = document.createElement('div');
  crackTime.style.cssText = `color: #495057;`;
  crackTime.innerHTML = `<strong>⏱️ Crack time:</strong> <span id="crack-time">instant</span>`;
  
  detailsGrid.appendChild(charCount);
  detailsGrid.appendChild(crackTime);
  
  const breachSection = document.createElement('div');
  breachSection.style.cssText = `
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 4px solid #6c757d;
  `;
  
  const breachIcon = document.createElement('span');
  breachIcon.style.fontSize = '20px';
  breachIcon.textContent = '⏳';
  
  const breachText = document.createElement('div');
  breachText.style.cssText = `
    font-size: 13px;
    color: #6c757d;
    flex: 1;
  `;
  breachText.textContent = 'Checking breach status...';
  
  breachSection.appendChild(breachIcon);
  breachSection.appendChild(breachText);
  
  const feedbackSection = document.createElement('div');
  feedbackSection.style.cssText = `
    padding: 12px;
    border-radius: 8px;
    margin-top: 12px;
    display: none;
    font-size: 13px;
    line-height: 1.5;
  `;
  
  // ===== NEW: Help button container (only shows for weak/breached passwords) =====
  const helpButtonContainer = document.createElement('div');
  helpButtonContainer.style.cssText = `
    margin-top: 12px;
    display: none;
    text-align: center;
  `;
  
  const helpButton = document.createElement('button');
  helpButton.textContent = '🛟 Get Password Help';
  helpButton.style.cssText = `
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: background 0.2s ease;
  `;
  helpButton.addEventListener('mouseenter', () => {
    helpButton.style.background = '#3a7bc8';
  });
  helpButton.addEventListener('mouseleave', () => {
    helpButton.style.background = '#4a90e2';
  });
  helpButton.addEventListener('click', () => {
    // Open help page in new tab
    chrome.runtime.sendMessage({ 
      action: 'openHelpPage',
      passwordStrength: 'weak',
      breached: false
    });
    // Fallback if message doesn't work
    window.open('https://your-extension-help-page.com', '_blank');
  });
  
  helpButtonContainer.appendChild(helpButton);
  // ===== END NEW =====
  
  content.appendChild(scoreSection);
  content.appendChild(strengthBar);
  content.appendChild(detailsGrid);
  content.appendChild(breachSection);
  content.appendChild(feedbackSection);
  content.appendChild(helpButtonContainer);  // Add help button container
  
  container.appendChild(header);
  container.appendChild(content);
  
  document.body.appendChild(container);
  console.log('✅ Indicator container created with ID:', container.id);
  
  const rect = passwordField.getBoundingClientRect();
  const defaultLeft = Math.min(rect.right + 20, window.innerWidth - 320);
  const defaultTop = Math.max(rect.top, 0);
  
  container.style.left = defaultLeft + 'px';
  container.style.top = defaultTop + 'px';
  container.style.display = 'none';
  
  makeDraggable(container, '.indicator-header');
  
  passwordField._phatCompleteIndicator = {
    container,
    scoreBadge,
    strengthFill,
    strengthLabel,
    breachIcon,
    breachText,
    charCount: charCount.querySelector('span'),
    crackTime: crackTime.querySelector('span'),
    feedbackSection,
    breachSection,
    helpButtonContainer,  // Store reference
    helpButton            // Store reference
  };
  
  console.log('👂 Attaching input listener to field');
  
  // Remove any existing listeners first
  if (passwordField._inputHandler) {
    passwordField.removeEventListener('input', passwordField._inputHandler);
  }
  
  // Define and store the handler
  passwordField._inputHandler = function(e) {
    console.log('⌨️ Input event detected, value:', e.target.value);
    clearTimeout(passwordField._inputTimeout);
    passwordField._inputTimeout = setTimeout(async () => {
      console.log('⏰ Timeout triggered, analyzing:', e.target.value);
      await analyzeComplete(passwordField, e.target.value);
    }, 300);
  };
  
  passwordField.addEventListener('input', passwordField._inputHandler);
  console.log('✅ Input listener attached successfully');
  
  const observer = new MutationObserver(() => {
    if (!document.body.contains(passwordField)) {
      console.log('🗑️ Password field removed, cleaning up indicator');
      container.remove();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function getStrengthData(score) {
  const strengths = [
    { name: 'Very Weak', color: '#ff6b6b' },
    { name: 'Weak', color: '#ffa726' },
    { name: 'Fair', color: '#ffd93d' },
    { name: 'Good', color: '#6bcf7f' },
    { name: 'Strong', color: '#4caf50' }
  ];
  return strengths[score] || strengths[0];
}

function createDraggableMeter() {
  if (document.getElementById('pm-draggable-meter')) {
    return document.getElementById('pm-draggable-meter');
  }
  
  console.log('📦 Creating draggable meter');
  
  const meter = document.createElement('div');
  meter.id = 'pm-draggable-meter';
  meter.className = 'pm-draggable-meter';
  meter.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    width: 320px;
    background: #ffffff;
    border-radius: 12px;
    border: 2px solid #e0e0e0;
    box-shadow: 0 8px 28px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    resize: both;
    overflow: auto;
    min-width: 280px;
    min-height: 250px;
    max-width: 400px;
    display: none;
  `;
  
  meter.innerHTML = `
    <div class="pm-meter-header" style="
      background: #4a90e2;
      color: white;
      padding: 14px 16px;
      font-weight: 700;
      border-radius: 10px 10px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      user-select: none;
    ">
      <span style="display: flex; align-items: center; gap: 8px;">
        <span>🔒</span> Password Security Dashboard
      </span>
      <span class="pm-close-btn" style="
        cursor: pointer;
        font-size: 24px;
        padding: 0 8px;
        border-radius: 4px;
      " title="Close">×</span>
    </div>
    <div class="pm-meter-content" style="padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div class="pm-rating pm-good" style="font-size: 18px; font-weight: 700;">Good</div>
        <div style="font-size: 14px; color: #6c757d;">Password Strength</div>
      </div>
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 13px; color: #6c757d;">Security Level</span>
          <span class="pm-score" style="font-weight: 600;">3/4</span>
        </div>
        <div style="width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
          <div class="pm-strength-fill" style="height: 100%; width: 75%; background: #6bcf7f;"></div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
        <div><strong>📏 Length:</strong> <span class="pm-length">9</span></div>
        <div><strong>⏱️ Crack time:</strong> <span class="pm-crack-time">less than a second</span></div>
        <div><strong>🔐 Breach status:</strong> <span class="pm-breach-status" style="color: #28a745;">Safe</span></div>
        <div><strong>📊 Entropy:</strong> <span class="pm-entropy">28 bits</span></div>
      </div>
      <div class="pm-breach-details" style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px; display: none;">
        <strong style="color: #dc3545;">⚠️ Breach Details</strong>
        <p style="margin: 4px 0 0; font-size: 12px;">This password has appeared in data breaches.</p>
      </div>
      <div class="pm-feedback" style="padding: 12px; background: #f0fff4; border-radius: 8px; border-left: 4px solid #28a745; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 13px;">💡 Use a mix of letters, numbers, and symbols.</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="pm-refresh-btn" style="flex: 1; padding: 10px; background: #e9ecef; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">↻ Refresh</button>
        <button class="pm-details-btn" style="flex: 1; padding: 10px; background: #4a90e2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📋 Details</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(meter);
  
  makeDraggable(meter, '.pm-meter-header');
  
  meter.querySelector('.pm-close-btn').addEventListener('click', () => {
    meter.style.display = 'none';
    console.log('❌ Meter closed by user');
  });
  
  meter.querySelector('.pm-refresh-btn').addEventListener('click', () => {
    console.log('🔄 Refresh button clicked');
    refreshMeterData();
  });
  
  meter.querySelector('.pm-details-btn').addEventListener('click', () => {
    alert('🔍 Detailed Analysis:\n\n• Password strength based on entropy\n• Pattern detection (dictionary, sequences, repeats)\n• Real-time breach database check\n• k-anonymity privacy protection\n• Character composition analysis');
  });
  
  console.log('📦 Draggable meter widget created');
  return meter;
}

function refreshMeterData() {
  const meter = document.getElementById('pm-draggable-meter');
  if (!meter) return;
  
  const passwordFields = findPasswordFields();
  if (passwordFields.length > 0) {
    const latestField = passwordFields[0];
    const password = latestField.value;
    
    if (password.length > 0) {
      analyzeComplete(latestField, password);
    }
  }
}

function setupAutoShowMeter() {
  const passwordFields = findPasswordFields();
  
  passwordFields.forEach(field => {
    field.removeEventListener('focus', showMeterOnFocus);
    field.removeEventListener('input', showMeterOnInput);
    
    field.addEventListener('focus', showMeterOnFocus);
    field.addEventListener('input', showMeterOnInput);
  });
}

function showMeterOnFocus() {
  let meter = document.getElementById('pm-draggable-meter');
  if (!meter) {
    meter = createDraggableMeter();
  }
  meter.style.display = 'block';
}

function showMeterOnInput(e) {
  let meter = document.getElementById('pm-draggable-meter');
  if (!meter && e.target.value.length > 0) {
    meter = createDraggableMeter();
    meter.style.display = 'block';
  }
}

async function analyzeComplete(passwordField, password) {
  console.log('🔍 analyzeComplete called with password:', password);
  
  const indicator = passwordField._phatCompleteIndicator;
  if (!indicator) {
    console.error('❌ No indicator found for field');
    return;
  }
  
  console.log('✅ Indicator found, container ID:', indicator.container.id);
  
  if (password.length === 0) {
    console.log('📪 Password empty, hiding indicator');
    indicator.container.style.display = 'none';
    return;
  }
  
  console.log('📊 Processing password, showing indicator');
  indicator.container.style.display = 'block';
  
  indicator.breachIcon.textContent = '⏳';
  indicator.breachText.textContent = 'Checking breach status...';
  indicator.breachText.style.color = '#6c757d';
  indicator.breachSection.style.borderLeftColor = '#6c757d';
  
  let score, analysis;
  if (typeof zxcvbn !== 'undefined') {
    analysis = zxcvbn(password);
    score = analysis.score;
    
    console.log('🔐 zxcvbn analysis:', {
      score: score,
      crackTime: analysis.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown'
    });
  } else {
    console.warn('⚠️ zxcvbn not available, using fallback');
    score = Math.min(4, Math.floor(password.length / 3));
    analysis = { 
      crack_times_display: { offline_fast_hashing_1e10_per_second: 'unknown' },
      feedback: { warning: '', suggestions: [] }
    };
  }
  
  const breachPromise = checkBreach(password);
  
  const strengthData = getStrengthData(score);
  const widthPercent = (score + 1) * 20;
  
  indicator.scoreBadge.textContent = `${score}/4`;
  indicator.scoreBadge.style.background = strengthData.color;
  indicator.scoreBadge.style.color = '#ffffff';
  
  indicator.strengthFill.style.width = `${widthPercent}%`;
  indicator.strengthFill.style.background = strengthData.color;
  
  indicator.strengthLabel.textContent = strengthData.name;
  indicator.strengthLabel.style.color = strengthData.color;
  
  indicator.charCount.textContent = password.length;
  
  const crackTime = analysis?.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown';
  indicator.crackTime.textContent = crackTime;
  
  let breachResult = { isBreached: false, count: 0 };
  
  try {
    const result = await breachPromise;
    breachResult = result;
    
    if (breachResult.isBreached) {
      indicator.breachIcon.textContent = '🚨';
      indicator.breachText.textContent = `❌ BREACHED: Found in ${breachResult.count} data breaches`;
      indicator.breachText.style.color = '#dc3545';
      indicator.breachSection.style.borderLeftColor = '#dc3545';
      console.log('🚨 Password breached!');
    } else {
      indicator.breachIcon.textContent = '✅';
      indicator.breachText.textContent = '✅ Safe: No breaches found';
      indicator.breachText.style.color = '#28a745';
      indicator.breachSection.style.borderLeftColor = '#28a745';
      console.log('✅ Password safe');
    }
    
    if (breachResult.error) {
      indicator.breachIcon.textContent = '⚠️';
      indicator.breachText.textContent = `⚠️ Check failed: ${breachResult.error}`;
      indicator.breachText.style.color = '#ffc107';
      indicator.breachSection.style.borderLeftColor = '#ffc107';
    }
  } catch (error) {
    indicator.breachIcon.textContent = '⚠️';
    indicator.breachText.textContent = '⚠️ Breach check failed';
    indicator.breachText.style.color = '#ffc107';
    indicator.breachSection.style.borderLeftColor = '#ffc107';
    console.error('Breach check error:', error);
    breachResult.error = error.message;
  }
  
  if (analysis && analysis.feedback) {
    let feedbackHtml = '';
    
    if (analysis.feedback.warning && analysis.feedback.warning !== '') {
      feedbackHtml += `<div style="color: #dc3545; margin-bottom: 4px;">⚠️ ${analysis.feedback.warning}</div>`;
    }
    
    if (analysis.feedback.suggestions && analysis.feedback.suggestions.length > 0) {
      feedbackHtml += '<div style="color: #28a745;">💡 Suggestions:</div><ul style="margin: 4px 0 0 16px; color: #28a745;">';
      analysis.feedback.suggestions.forEach(suggestion => {
        feedbackHtml += `<li style="font-size: 12px;">${suggestion}</li>`;
      });
      feedbackHtml += '</ul>';
    }
    
    if (feedbackHtml) {
      indicator.feedbackSection.innerHTML = feedbackHtml;
      indicator.feedbackSection.style.display = 'block';
      indicator.feedbackSection.style.background = analysis.feedback.warning ? '#fff5f5' : '#f0fff4';
    } else {
      indicator.feedbackSection.style.display = 'none';
    }
  } else {
    indicator.feedbackSection.style.display = 'none';
  }
  
  // ===== NEW: Show help button only for weak (score <= 1) or breached passwords =====
  if (indicator.helpButtonContainer && indicator.helpButton) {
    if (score <= 1 || breachResult.isBreached) {
      indicator.helpButtonContainer.style.display = 'block';
      console.log('🆘 Help button shown - password needs attention');
      
      // Update button text based on situation
      if (breachResult.isBreached && score <= 1) {
        indicator.helpButton.textContent = '🆘 Password Breached & Weak - Get Help';
      } else if (breachResult.isBreached) {
        indicator.helpButton.textContent = '🚨 Password Breached - Get Help';
      } else if (score <= 1) {
        indicator.helpButton.textContent = '⚠️ Weak Password - Get Help';
      }
    } else {
      indicator.helpButtonContainer.style.display = 'none';
    }
  }
  // ===== END NEW =====
  
  try {
    const meterElement = document.getElementById('pm-draggable-meter');
    if (meterElement && meterElement.style.display !== 'none') {
      updateDraggableMeterWithAnalysis(score, password, breachResult, analysis);
    }
  } catch (meterError) {
    console.log('Could not update draggable meter:', meterError);
  }
}

function updateDraggableMeterWithAnalysis(score, password, breachResult, analysis) {
  const meter = document.getElementById('pm-draggable-meter');
  if (!meter) return;
  
  const strengthData = getStrengthData(score);
  
  const ratingEl = meter.querySelector('.pm-rating');
  if (ratingEl) {
    ratingEl.textContent = strengthData.name;
    ratingEl.style.color = strengthData.color;
  }
  
  const scoreEl = meter.querySelector('.pm-score');
  if (scoreEl) scoreEl.textContent = `${score}/4`;
  
  const fillEl = meter.querySelector('.pm-strength-fill');
  if (fillEl) {
    fillEl.style.width = ((score + 1) * 20) + '%';
    fillEl.style.background = strengthData.color;
  }
  
  const lengthEl = meter.querySelector('.pm-length');
  if (lengthEl) lengthEl.textContent = password.length;
  
  const crackTimeEl = meter.querySelector('.pm-crack-time');
  if (crackTimeEl) {
    crackTimeEl.textContent = analysis?.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown';
  }
  
  const breachStatusEl = meter.querySelector('.pm-breach-status');
  if (breachStatusEl) {
    if (breachResult && breachResult.isBreached) {
      breachStatusEl.textContent = 'BREACHED!';
      breachStatusEl.style.color = '#dc3545';
    } else {
      breachStatusEl.textContent = 'Safe';
      breachStatusEl.style.color = '#28a745';
    }
  }
  
  const entropyEl = meter.querySelector('.pm-entropy');
  if (entropyEl && analysis) {
    const entropy = Math.log2(Math.pow(10, analysis.guesses_log10 || 0)).toFixed(1);
    entropyEl.textContent = entropy + ' bits';
  }
  
  const breachDetailsEl = meter.querySelector('.pm-breach-details');
  if (breachDetailsEl) {
    breachDetailsEl.style.display = breachResult?.isBreached ? 'block' : 'none';
  }
  
  const feedbackEl = meter.querySelector('.pm-feedback');
  if (feedbackEl && analysis?.feedback) {
    if (analysis.feedback.warning) {
      feedbackEl.innerHTML = `<p style="margin: 0; font-size: 13px;">⚠️ ${analysis.feedback.warning}</p>`;
      feedbackEl.style.background = '#fff5f5';
      feedbackEl.style.borderLeftColor = '#dc3545';
    } else if (analysis.feedback.suggestions && analysis.feedback.suggestions.length > 0) {
      feedbackEl.innerHTML = `<p style="margin: 0; font-size: 13px;">💡 ${analysis.feedback.suggestions[0]}</p>`;
      feedbackEl.style.background = '#f0fff4';
      feedbackEl.style.borderLeftColor = '#28a745';
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 Content script received:', request);
  
  if (request.action === 'toggleMeter') {
    let meter = document.getElementById('pm-draggable-meter');
    
    if (meter) {
      meter.style.display = meter.style.display === 'none' ? 'block' : 'none';
      sendResponse({ success: true, visible: meter.style.display !== 'none' });
    } else {
      meter = createDraggableMeter();
      meter.style.display = 'block';
      sendResponse({ success: true, visible: true });
    }
    return true;
  }
  
  if (request.action === 'checkPasswords') {
    const passwordFields = findPasswordFields();
    sendResponse({
      success: true,
      found: passwordFields.length > 0,
      count: passwordFields.length
    });
    return true;
  }
  
  // ===== NEW: Handle help page opening =====
  if (request.action === 'openHelpPage') {
    // Create help page URL
    const helpUrl = chrome.runtime.getURL('help.html') + 
      '?strength=' + (request.passwordStrength || 'weak') +
      '&breached=' + (request.breached || false);
    
    chrome.tabs.create({ url: helpUrl });
    sendResponse({ success: true });
    return true;
  }
  // ===== END NEW =====
  
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// Initialization
console.log("🔍 Starting initialization...");
monitorPasswordFields();

chrome.storage.sync.get(['autoShowMeter'], (result) => {
  if (result.autoShowMeter) {
    createDraggableMeter().style.display = 'block';
  }
});

const observer = new MutationObserver(() => {
  monitorPasswordFields();
  setupAutoShowMeter();
});
observer.observe(document.body, { childList: true, subtree: true });

setTimeout(monitorPasswordFields, 1000);

setTimeout(() => {
  console.log('🔍 Final check:');
  const meter = document.getElementById('pm-draggable-meter');
  if (meter) {
    console.log('✅ Meter exists');
  }
  const fields = findPasswordFields();
  console.log(`📊 Total password fields: ${fields.length}`);
  fields.forEach((field, i) => {
    console.log(`📋 Field ${i} has indicator:`, !!field._phatCompleteIndicator);
  });
}, 3000);

console.log("✅ Complete password analyzer active!");