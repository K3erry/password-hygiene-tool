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
  const passwordFields = findPasswordFields();
  
  console.log(`🎯 Found ${passwordFields.length} password field(s)`);
  
  passwordFields.forEach(field => {
    if (!indicators.has(field)) {
      console.log(`👁️ Monitoring password field`);
      createCompleteIndicator(field);
      indicators.set(field, true);
    }
  });
  
  setupAutoShowMeter();
}

function createCompleteIndicator(passwordField) {
  if (passwordField._phatCompleteIndicator) return;
  
  const container = document.createElement('div');
  container.className = 'phat-complete-indicator';
  container.style.cssText = `
    position: absolute;
    z-index: 2147483646;
    width: 280px;
    padding: 12px;
    background: #ffffff;
    border-radius: 10px;
    border: 2px solid #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
    display: none;
    pointer-events: none;
    font-size: 12px;
  `;
  
  const rect = passwordField.getBoundingClientRect();
  const isRightSide = rect.left < window.innerWidth / 2;
  
  container.style.top = (rect.top + window.scrollY) + 'px';
  if (isRightSide) {
    container.style.left = (rect.right + 10) + 'px';
  } else {
    container.style.left = (rect.left - 290) + 'px';
  }
  
  setTimeout(() => {
    const containerRect = container.getBoundingClientRect();
    if (containerRect.right > window.innerWidth) {
      container.style.left = (window.innerWidth - containerRect.width - 10) + 'px';
    }
    if (containerRect.left < 0) {
      container.style.left = '10px';
    }
  }, 0);
  
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f0f0f0;
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 13px;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    gap: 4px;
  `;
  title.innerHTML = '🔒 Password Security';
  
  const scoreBadge = document.createElement('div');
  scoreBadge.style.cssText = `
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 12px;
    background: #e9ecef;
    color: #495057;
    min-width: 35px;
    text-align: center;
  `;
  scoreBadge.textContent = '0/4';
  
  header.appendChild(title);
  header.appendChild(scoreBadge);
  
  const strengthSection = document.createElement('div');
  strengthSection.style.cssText = `
    margin-bottom: 8px;
  `;
  
  const strengthHeader = document.createElement('div');
  strengthHeader.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  `;
  
  const strengthLabel = document.createElement('span');
  strengthLabel.style.cssText = `
    font-size: 13px;
    font-weight: 600;
    color: #ff6b6b;
  `;
  strengthLabel.textContent = 'Very Weak';
  
  strengthHeader.appendChild(strengthLabel);
  
  const strengthBar = document.createElement('div');
  strengthBar.style.cssText = `
    width: 100%;
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    overflow: hidden;
  `;
  
  const strengthFill = document.createElement('div');
  strengthFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: #ff6b6b;
    transition: width 0.3s ease;
  `;
  
  strengthBar.appendChild(strengthFill);
  strengthSection.appendChild(strengthHeader);
  strengthSection.appendChild(strengthBar);
  
  const details = document.createElement('div');
  details.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 11px;
    color: #6c757d;
    margin: 6px 0;
  `;
  
  const charCount = document.createElement('div');
  const charSpan = document.createElement('span');
  charSpan.id = 'char-count';
  charSpan.textContent = '0';
  charCount.innerHTML = '📏 ';
  charCount.appendChild(charSpan);
  
  const crackTime = document.createElement('div');
  const timeSpan = document.createElement('span');
  timeSpan.id = 'crack-time';
  timeSpan.textContent = 'instant';
  crackTime.innerHTML = '⏱️ ';
  crackTime.appendChild(timeSpan);
  
  details.appendChild(charCount);
  details.appendChild(crackTime);
  
  const breachSection = document.createElement('div');
  breachSection.style.cssText = `
    padding: 6px 8px;
    background: #f8f9fa;
    border-radius: 6px;
    margin: 6px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  `;
  
  const breachIcon = document.createElement('span');
  breachIcon.style.fontSize = '14px';
  breachIcon.textContent = '⏳';
  
  const breachText = document.createElement('span');
  breachText.style.cssText = `
    color: #6c757d;
    flex: 1;
  `;
  breachText.textContent = 'Checking...';
  
  breachSection.appendChild(breachIcon);
  breachSection.appendChild(breachText);
  
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    font-size: 11px;
    padding: 4px 6px;
    margin-top: 4px;
    border-radius: 4px;
    display: none;
  `;
  
  container.appendChild(header);
  container.appendChild(strengthSection);
  container.appendChild(details);
  container.appendChild(breachSection);
  container.appendChild(feedback);
  
  document.body.appendChild(container);
  
  passwordField._phatCompleteIndicator = {
    container,
    scoreBadge,
    strengthFill,
    strengthLabel,
    breachIcon,
    breachText,
    charCount: charSpan,
    crackTime: timeSpan,
    feedback
  };
  
  const updatePosition = () => {
    const rect = passwordField.getBoundingClientRect();
    if (rect.width === 0) return;
    
    container.style.top = (rect.top + window.scrollY) + 'px';
    if (isRightSide) {
      container.style.left = (rect.right + 10) + 'px';
    } else {
      container.style.left = (rect.left - 290) + 'px';
    }
  };
  
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition);
  
  passwordField._phatCleanup = () => {
    window.removeEventListener('scroll', updatePosition);
    window.removeEventListener('resize', updatePosition);
  };
  
  let timeoutId;
  passwordField.addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      await analyzeComplete(passwordField, e.target.value);
    }, 300);
  });
  
  const observer = new MutationObserver(() => {
    if (!document.body.contains(passwordField)) {
      if (passwordField._phatCleanup) passwordField._phatCleanup();
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
  
  const meter = document.createElement('div');
  meter.id = 'pm-draggable-meter';
  meter.className = 'pm-draggable-meter';
  
  meter.innerHTML = `
    <div class="pm-meter-header">
      <span class="pm-meter-title">🔒 Password Security</span>
      <span class="pm-close-btn" title="Close">×</span>
    </div>
    <div class="pm-meter-content">
      <div class="pm-rating pm-good">Good</div>
      <div class="pm-status">Safe: No breaches found</div>
      <div class="pm-details">
        <p><strong>Length:</strong> 9 characters</p>
        <p><strong>Crack time:</strong> less than a second</p>
        <p><strong>Last checked:</strong> Just now</p>
      </div>
      <div class="pm-meter-actions">
        <button class="pm-refresh-btn">Refresh Check</button>
        <button class="pm-details-btn">More Details</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(meter);
  
  makeDraggable(meter);
  
  meter.querySelector('.pm-close-btn').addEventListener('click', () => {
    meter.style.display = 'none';
    chrome.runtime.sendMessage({ 
      type: 'meterClosed', 
      timestamp: Date.now() 
    });
  });
  
  meter.querySelector('.pm-refresh-btn').addEventListener('click', () => {
    refreshMeterData();
  });
  
  meter.querySelector('.pm-details-btn').addEventListener('click', () => {
    alert('Detailed security report:\n• Password strength analysis\n• Breach history\n• Recommendations\n• Cross-device sync status');
  });
  
  chrome.storage.sync.get(['meterPosition'], (result) => {
    if (result.meterPosition) {
      meter.style.left = result.meterPosition.x + 'px';
      meter.style.top = result.meterPosition.y + 'px';
    }
  });
  
  console.log('📦 Draggable meter widget created');
  return meter;
}

function makeDraggable(element) {
  const header = element.querySelector('.pm-meter-header');
  if (!header) {
    console.error('Header not found for draggable');
    return;
  }
  
  console.log('Making meter draggable with header:', header);
  
  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener('mousedown', startDrag);
  header.addEventListener('touchstart', startDragTouch, { passive: false });
  header.addEventListener('dragstart', (e) => e.preventDefault());
  
  function startDrag(e) {
    if (e.target.classList.contains('pm-close-btn')) {
      console.log('Close button clicked, not dragging');
      return;
    }
    
    console.log('Starting drag');
    isDragging = true;
    
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    element.classList.add('dragging');
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  }

  function startDragTouch(e) {
    if (e.target.classList.contains('pm-close-btn')) return;
    
    console.log('Starting touch drag');
    isDragging = true;
    
    const touch = e.touches[0];
    const rect = element.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
    
    element.classList.add('dragging');
    
    document.addEventListener('touchmove', dragTouch, { passive: false });
    document.addEventListener('touchend', stopDrag);
    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;
    
    newX = Math.max(10, Math.min(newX, window.innerWidth - element.offsetWidth - 10));
    newY = Math.max(10, Math.min(newY, window.innerHeight - element.offsetHeight - 10));
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
    
    savePosition(newX, newY);
  }

  function dragTouch(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    let newX = touch.clientX - offsetX;
    let newY = touch.clientY - offsetY;
    
    newX = Math.max(10, Math.min(newX, window.innerWidth - element.offsetWidth - 10));
    newY = Math.max(10, Math.min(newY, window.innerHeight - element.offsetHeight - 10));
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
    
    savePosition(newX, newY);
  }

  function stopDrag() {
    if (isDragging) {
      console.log('Stopping drag');
      isDragging = false;
      element.classList.remove('dragging');
    }
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', dragTouch);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  function savePosition(x, y) {
    const pos = { x: x, y: y };
    chrome.storage.sync.set({ meterPosition: pos });
    console.log('Saved position:', pos);
  }
}

function refreshMeterData() {
  const meter = document.getElementById('pm-draggable-meter');
  if (!meter) return;
  
  const passwordFields = findPasswordFields();
  if (passwordFields.length > 0) {
    const latestField = passwordFields[0];
    const password = latestField.value;
    
    if (password.length > 0) {
      analyzeComplete(latestField, password).then(() => {
        updateMeterWithLatest();
      });
    }
  }
  
  const details = meter.querySelector('.pm-details');
  if (details) {
    const timestamp = details.querySelector('p:nth-child(3)');
    if (timestamp) {
      timestamp.innerHTML = `<strong>Last checked:</strong> ${new Date().toLocaleTimeString()}`;
    }
  }
}

function updateMeterWithLatest() {
  console.log('🔄 Updating meter with latest analysis...');
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
  const indicator = passwordField._phatCompleteIndicator;
  if (!indicator) return;
  
  if (password.length === 0) {
    indicator.container.style.display = 'none';
    return;
  }
  
  indicator.container.style.display = 'block';
  
  indicator.breachIcon.textContent = '⏳';
  indicator.breachText.textContent = 'Breach check: Checking...';
  indicator.breachText.style.color = '#6c757d';
  
  let score, analysis;
  if (typeof zxcvbn !== 'undefined') {
    analysis = zxcvbn(password);
    score = analysis.score;
    
    console.log('🔐 zxcvbn analysis:', {
      score: score,
      crackTime: analysis.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown',
      warnings: analysis.feedback?.warning || '',
      suggestions: analysis.feedback?.suggestions || []
    });
  } else {
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
    } else {
      indicator.breachIcon.textContent = '✅';
      indicator.breachText.textContent = '✅ Safe: No breaches found';
      indicator.breachText.style.color = '#28a745';
    }
    
    if (breachResult.error) {
      indicator.breachIcon.textContent = '⚠️';
      indicator.breachText.textContent = `⚠️ Check failed: ${breachResult.error}`;
      indicator.breachText.style.color = '#ffc107';
    }
  } catch (error) {
    indicator.breachIcon.textContent = '⚠️';
    indicator.breachText.textContent = '⚠️ Breach check failed';
    indicator.breachText.style.color = '#efd78fff';
    console.error('Breach check error:', error);
    breachResult.error = error.message;
  }
  
  if (analysis && analysis.feedback) {
    let feedbackText = '';
    
    if (analysis.feedback.warning && analysis.feedback.warning !== '') {
      feedbackText = `⚠️ ${analysis.feedback.warning}`;
    }
    
    if (!feedbackText && analysis.feedback.suggestions && analysis.feedback.suggestions.length > 0) {
      feedbackText = `💡 ${analysis.feedback.suggestions[0]}`;
    }
    
    if (feedbackText) {
      indicator.feedback.textContent = feedbackText;
      indicator.feedback.style.display = 'block';
      indicator.feedback.style.background = feedbackText.includes('⚠️') ? '#fff5f5' : '#f0fff4';
      indicator.feedback.style.color = feedbackText.includes('⚠️') ? '#dc3545' : '#28a745';
      indicator.feedback.style.borderLeft = feedbackText.includes('⚠️') ? '3px solid #dc3545' : '3px solid #28a745';
    } else {
      indicator.feedback.style.display = 'none';
    }
  } else {
    indicator.feedback.style.display = 'none';
  }
  
  try {
    const meterElement = document.getElementById('pm-draggable-meter');
    if (meterElement && meterElement.style.display !== 'none') {
      if (typeof updateDraggableMeterWithAnalysis === 'function') {
        updateDraggableMeterWithAnalysis(score, password, breachResult, analysis);
      }
    }
  } catch (meterError) {
    console.log('Could not update draggable meter:', meterError);
  }
}

function updateDraggableMeterWithAnalysis(score, password, breachResult, analysis) {
  console.log('Updating meter with analysis', {score, password});
  
  const meter = document.getElementById('pm-draggable-meter');
  if (!meter) {
    console.log('Meter not found, cannot update');
    return;
  }
  
  const strengthData = getStrengthData(score);
  
  const ratingEl = meter.querySelector('.pm-rating');
  if (ratingEl) {
    ratingEl.textContent = strengthData.name;
    ratingEl.className = `pm-rating pm-${strengthData.name.toLowerCase().replace(/ /g, '-')}`;
    ratingEl.style.color = strengthData.color;
  }
  
  const statusEl = meter.querySelector('.pm-status');
  if (statusEl) {
    if (breachResult && breachResult.isBreached) {
      statusEl.textContent = `❌ BREACHED: Found in ${breachResult.count} data breaches`;
      statusEl.style.color = '#dc3545';
    } else {
      statusEl.textContent = '✅ Safe: No breaches found';
      statusEl.style.color = '#28a745';
    }
  }
  
  const detailsEl = meter.querySelector('.pm-details');
  if (detailsEl) {
    const crackTime = analysis?.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown';
    detailsEl.innerHTML = `
      <p><strong>Length:</strong> ${password.length} characters</p>
      <p><strong>Crack time:</strong> ${crackTime}</p>
      <p><strong>Last checked:</strong> ${new Date().toLocaleTimeString()}</p>
    `;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 Content script received:', request);
  
  if (request.action === 'toggleMeter') {
    let meter = document.getElementById('pm-draggable-meter');
    
    if (meter) {
      meter.style.display = meter.style.display === 'none' ? 'block' : 'none';
      const isVisible = meter.style.display !== 'none';
      
      sendResponse({ 
        success: true, 
        visible: isVisible,
        message: isVisible ? 'Meter shown' : 'Meter hidden'
      });
    } else {
      meter = createDraggableMeter();
      meter.style.display = 'block';
      sendResponse({ 
        success: true, 
        visible: true,
        message: 'Meter created and shown'
      });
    }
    return true;
  }
  
  if (request.action === 'checkPasswords') {
    const passwordFields = findPasswordFields();
    const found = passwordFields.length > 0;
    
    const fieldInfo = Array.from(passwordFields).map((field, index) => ({
      id: field.id || `password-${index}`,
      name: field.name || 'unnamed',
      placeholder: field.placeholder || 'No placeholder',
      valueLength: field.value ? field.value.length : 0,
      hasIndicator: !!field._phatCompleteIndicator
    }));
    
    sendResponse({
      success: true,
      found: found,
      count: passwordFields.length,
      fields: fieldInfo,
      page: window.location.href,
      timestamp: Date.now()
    });
    return true;
  }
  
  if (request.action === 'getMeterStatus') {
    const meter = document.getElementById('pm-draggable-meter');
    sendResponse({
      exists: !!meter,
      visible: meter ? meter.style.display !== 'none' : false,
      position: meter ? {
        x: parseInt(meter.style.left) || 50,
        y: parseInt(meter.style.top) || 50
      } : null
    });
    return true;
  }
  
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

console.log("🔍 Scanning for password fields...");
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
  const meter = document.getElementById('pm-draggable-meter');
  if (meter) {
    console.log('Meter exists, header:', meter.querySelector('.pm-meter-header'));
    console.log('Draggable function exists:', typeof makeDraggable === 'function');
  }
}, 2000);

console.log("✅ Complete password analyzer active!");
console.log("📦 Draggable meter system ready!");