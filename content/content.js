console.log("🔍 Browser Detection Starting...");

function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  let browser = "Unknown";
  let version = "Unknown";
  
  // Brave detection (Brave has 'Brave' in userAgent)
  if (userAgent.includes('Brave')) {
    browser = "Brave";
    const match = userAgent.match(/Brave\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  // Chrome detection
  else if (userAgent.includes('Chrome') && !userAgent.includes('Edg') && !userAgent.includes('OPR')) {
    browser = "Chrome";
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  // Edge detection
  else if (userAgent.includes('Edg')) {
    browser = "Edge";
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  // Firefox detection
  else if (userAgent.includes('Firefox')) {
    browser = "Firefox";
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : "Unknown";
  }
  // Safari detection
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

// Log extension API availability
console.log("🔧 Extension APIs:");
console.log("  - chrome API:", typeof chrome !== 'undefined' ? "Available ✅" : "Missing ❌");
console.log("  - browser API:", typeof browser !== 'undefined' ? "Available ✅" : "Missing ❌");
console.log("  - crypto.subtle:", typeof crypto !== 'undefined' && crypto.subtle ? "Available ✅" : "Missing ❌");
console.log("  - fetch API:", typeof fetch !== 'undefined' ? "Available ✅" : "Missing ❌");  

console.log("✅ Password Hygiene Analytics Tool: Content script loaded!");
console.log("📦 zxcvbn available:", typeof zxcvbn !== 'undefined');

const indicators = new WeakMap();
const breachCache = new Map(); // Cache for API responses

// SHA-1 hashing function (for k-anonymity)
async function sha1Hash(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

// Check password against HIBP using k-anonymity
async function checkBreach(password) {
  if (!password || password.length === 0) {
    return { isBreached: false, count: 0 };
  }
  
  try {
    // 1. Create SHA-1 hash locally
    const hash = await sha1Hash(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    // 2. Check cache first
    const cacheKey = prefix;
    if (breachCache.has(cacheKey)) {
      const suffixes = breachCache.get(cacheKey);
      const isBreached = suffixes.includes(suffix);
      const count = isBreached ? 1 : 0; // Simplified count
      return { isBreached, count, hashPrefix: prefix };
    }
    
    // 3. Fetch from HIBP API (k-anonymity: only send prefix)
    console.log(`🔍 Checking breach for prefix: ${prefix}...`);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'Password-Hygiene-Analytics-Tool' }
    });
    
    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }
    
    const text = await response.text();
    const suffixes = text.split('\r\n').map(line => line.split(':')[0]);
    
    // 4. Cache the result
    breachCache.set(cacheKey, suffixes);
    
    // 5. Check if our hash suffix is in the list
    const isBreached = suffixes.includes(suffix);
    const count = isBreached ? 1 : 0;
    
    console.log(`🔐 Breach check: ${isBreached ? '❌ BREACHED' : '✅ Safe'} (prefix: ${prefix})`);
    
    return { isBreached, count, hashPrefix: prefix };
    
  } catch (error) {
    console.error('❌ Breach check failed:', error);
    return { isBreached: false, count: 0, error: error.message };
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
  
  // Setup auto-show for draggable meter
  setupAutoShowMeter();
}

function createCompleteIndicator(passwordField) {
  // Create indicator container
  const container = document.createElement('div');
  container.className = 'phat-complete-indicator';
  container.style.cssText = `
    margin-top: 12px;
    padding: 14px;
    background: #ffffff;
    border-radius: 10px;
    border: 2px solid #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    display: none;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f0f0f0;
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 16px;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  const lockIcon = document.createElement('span');
  lockIcon.textContent = '🔒';
  
  title.appendChild(lockIcon);
  title.appendChild(document.createTextNode('Password Security'));
  
  const scoreBadge = document.createElement('div');
  scoreBadge.style.cssText = `
    font-size: 14px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 15px;
    background: #e9ecef;
    color: #495057;
    min-width: 50px;
    text-align: center;
  `;
  scoreBadge.textContent = '0/4';
  
  header.appendChild(title);
  header.appendChild(scoreBadge);
  
  // Strength section
  const strengthSection = document.createElement('div');
  strengthSection.style.cssText = `
    margin-bottom: 15px;
  `;
  
  const strengthLabel = document.createElement('div');
  strengthLabel.style.cssText = `
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #ff6b6b;
  `;
  strengthLabel.textContent = 'Very Weak';
  
  const strengthBar = document.createElement('div');
  strengthBar.style.cssText = `
    width: 100%;
    height: 10px;
    background: #e9ecef;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 8px;
  `;
  
  const strengthFill = document.createElement('div');
  strengthFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: #ff6b6b;
    transition: all 0.3s ease;
  `;
  
  strengthBar.appendChild(strengthFill);
  
  // Breach status
  const breachSection = document.createElement('div');
  breachSection.style.cssText = `
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
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
  breachText.textContent = 'Breach check: Not checked';
  
  breachSection.appendChild(breachIcon);
  breachSection.appendChild(breachText);
  
  // Details section
  const details = document.createElement('div');
  details.style.cssText = `
    font-size: 13px;
    color: #6c757d;
    line-height: 1.6;
  `;
  
  const charCount = document.createElement('div');
  charCount.textContent = '📏 Length: 0 characters';
  
  const crackTime = document.createElement('div');
  crackTime.textContent = '⏱️ Crack time: instant';
  
  const warning = document.createElement('div');
  warning.style.cssText = `
    color: #dc3545;
    margin-top: 8px;
    padding: 6px;
    background: #fff5f5;
    border-radius: 4px;
    border-left: 3px solid #dc3545;
    display: none;
  `;
  
  const suggestion = document.createElement('div');
  suggestion.style.cssText = `
    color: #28a745;
    margin-top: 8px;
    padding: 6px;
    background: #f0fff4;
    border-radius: 4px;
    border-left: 3px solid #28a745;
    font-style: italic;
    display: none;
  `;
  
  details.appendChild(charCount);
  details.appendChild(crackTime);
  details.appendChild(warning);
  details.appendChild(suggestion);
  
  // Assemble container
  strengthSection.appendChild(strengthLabel);
  strengthSection.appendChild(strengthBar);
  
  container.appendChild(header);
  container.appendChild(strengthSection);
  container.appendChild(breachSection);
  container.appendChild(details);
  
  // Insert after password field
  if (passwordField.parentNode) {
    passwordField.parentNode.insertBefore(container, passwordField.nextSibling);
  }
  
  // Store references
  passwordField._phatCompleteIndicator = {
    container,
    scoreBadge,
    strengthFill,
    strengthLabel,
    breachIcon,
    breachText,
    charCount,
    crackTime,
    warning,
    suggestion
  };
  
  // Listen for input with debouncing
  let timeoutId;
  passwordField.addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      await analyzeComplete(passwordField, e.target.value);
    }, 300); // Wait 300ms after typing stops
  });
}

// ===== MOVED FUNCTIONS - NOW DEFINED EARLY =====
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
  // Check if meter already exists
  if (document.getElementById('pm-draggable-meter')) {
    return document.getElementById('pm-draggable-meter');
  }
  
  const meter = document.createElement('div');
  meter.id = 'pm-draggable-meter';
  meter.className = 'pm-draggable-meter';
  
  // Meter HTML content with updated class names
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
  
  // Make it draggable
  makeDraggable(meter);
  
  // Add event listeners
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
  
  // Load saved position
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
  let startX, startY;

  // Mouse events
  header.addEventListener('mousedown', startDrag);
  
  // Touch events for mobile
  header.addEventListener('touchstart', startDragTouch, { passive: false });
  
  // Prevent text selection while dragging
  header.addEventListener('dragstart', (e) => e.preventDefault());
  
  function startDrag(e) {
    // Don't drag if clicking close button
    if (e.target.classList.contains('pm-close-btn')) {
      console.log('Close button clicked, not dragging');
      return;
    }
    
    console.log('Starting drag');
    isDragging = true;
    
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    startX = e.clientX;
    startY = e.clientY;
    
    // Add dragging class
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
    
    startX = touch.clientX;
    startY = touch.clientY;
    
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
    
    // Keep within viewport
    newX = Math.max(10, Math.min(newX, window.innerWidth - element.offsetWidth - 10));
    newY = Math.max(10, Math.min(newY, window.innerHeight - element.offsetHeight - 10));
    
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
    
    // Save position
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
  
  // Get the latest password analysis from your existing system
  const passwordFields = findPasswordFields();
  if (passwordFields.length > 0) {
    const latestField = passwordFields[0];
    const password = latestField.value;
    
    if (password.length > 0) {
      analyzeComplete(latestField, password).then(() => {
        // Update meter with the latest analysis
        updateMeterWithLatest();
      });
    }
  }
  
  // Update timestamp
  const details = meter.querySelector('.pm-details');
  if (details) {
    const timestamp = details.querySelector('p:nth-child(3)');
    if (timestamp) {
      timestamp.innerHTML = `<strong>Last checked:</strong> ${new Date().toLocaleTimeString()}`;
    }
  }
}

function updateMeterWithLatest() {
  // This function would sync the draggable meter with your analyzer's results
  console.log('🔄 Updating meter with latest analysis...');
}
// ===== END OF MOVED FUNCTIONS =====

// Auto-show draggable meter when user interacts with password fields
function setupAutoShowMeter() {
  const passwordFields = findPasswordFields();
  
  passwordFields.forEach(field => {
    // Remove any existing listeners to avoid duplicates
    field.removeEventListener('focus', showMeterOnFocus);
    field.removeEventListener('input', showMeterOnInput);
    
    // Add new listeners
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
  
  // Update breach status to "checking"
  indicator.breachIcon.textContent = '⏳';
  indicator.breachText.textContent = 'Breach check: Checking...';
  indicator.breachText.style.color = '#6c757d';
  
  // 1. Run zxcvbn analysis
  let score, analysis;
  if (typeof zxcvbn !== 'undefined') {
    analysis = zxcvbn(password);
    score = analysis.score;
    
    console.log('🔐 zxcvbn analysis:', {
      score: score,
      crackTime: analysis.crack_times_display.offline_fast_hashing_1e10_per_second,
      warnings: analysis.feedback.warning,
      suggestions: analysis.feedback.suggestions
    });
  } else {
    score = Math.min(4, Math.floor(password.length / 3));
    analysis = { 
      crack_times_display: { offline_fast_hashing_1e10_per_second: 'unknown' },
      feedback: { warning: '', suggestions: [] }
    };
  }
  
  // 2. Run breach check in parallel
  const breachPromise = checkBreach(password);
  
  // 3. Update strength UI immediately
  const strengthData = getStrengthData(score);
  const widthPercent = (score + 1) * 20;
  
  indicator.scoreBadge.textContent = `${score}/4`;
  indicator.scoreBadge.style.background = strengthData.color;
  indicator.scoreBadge.style.color = '#ffffff';
  
  indicator.strengthFill.style.width = `${widthPercent}%`;
  indicator.strengthFill.style.background = strengthData.color;
  
  indicator.strengthLabel.textContent = strengthData.name;
  indicator.strengthLabel.style.color = strengthData.color;
  
  indicator.charCount.textContent = `📏 Length: ${password.length} characters`;
  indicator.crackTime.textContent = `⏱️ Crack time: ${analysis.crack_times_display.offline_fast_hashing_1e10_per_second}`;
  
  // Show warnings/suggestions
  if (analysis.feedback.warning) {
    indicator.warning.textContent = `⚠️ ${analysis.feedback.warning}`;
    indicator.warning.style.display = 'block';
  } else {
    indicator.warning.style.display = 'none';
  }
  
  if (analysis.feedback.suggestions && analysis.feedback.suggestions.length > 0) {
    indicator.suggestion.textContent = `💡 ${analysis.feedback.suggestions[0]}`;
    indicator.suggestion.style.display = 'block';
  } else {
    indicator.suggestion.style.display = 'none';
  }
  
  // 4. Update breach status when check completes
  let breachResult = { isBreached: false, count: 0 };
  
  try {
    const result = await breachPromise;
    breachResult = result;
    
    if (breachResult.isBreached) {
      indicator.breachIcon.textContent = '🚨';
      indicator.breachText.textContent = `❌ BREACHED: Found in ${breachResult.count} data breaches`;
      indicator.breachText.style.color = '#dc3545';
      indicator.container.style.borderColor = '#dc3545';
    } else {
      indicator.breachIcon.textContent = '✅';
      indicator.breachText.textContent = '✅ Safe: No breaches found';
      indicator.breachText.style.color = '#28a745';
      indicator.container.style.borderColor = strengthData.color;
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
     // Safely update draggable meter with analysis
  try {
    const meter = document.getElementById('pm-draggable-meter');
    if (meter && meter.style.display !== 'none') {
      if (typeof updateDraggableMeterWithAnalysis === 'function') {
        updateDraggableMeterWithAnalysis(score, password, breachResult, analysis);
      } else {
        console.log('updateDraggableMeterWithAnalysis function not available yet');
      }
    }
  } catch (meterError) {
    console.log('Could not update draggable meter:', meterError);
  }
  // Update rating
  const ratingEl = meter.querySelector('.pm-rating');
  if (ratingEl) {
    ratingEl.textContent = strengthData.name;
    ratingEl.className = `pm-rating pm-${strengthData.name.toLowerCase().replace(/ /g, '-')}`;
  }
  
  // Update status
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
  
  // Update details
  const detailsEl = meter.querySelector('.pm-details');
  if (detailsEl) {
    detailsEl.innerHTML = `
      <p><strong>Length:</strong> ${password.length} characters</p>
      <p><strong>Crack time:</strong> ${analysis?.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown'}</p>
      <p><strong>Last checked:</strong> ${new Date().toLocaleTimeString()}</p>
    `;
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
  
  // Update rating
  const ratingEl = meter.querySelector('.pm-rating');
  if (ratingEl) {
    ratingEl.textContent = strengthData.name;
    ratingEl.className = `pm-rating pm-${strengthData.name.toLowerCase().replace(/ /g, '-')}`;
  }
  
  // Update status
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
  
  // Update details
  const detailsEl = meter.querySelector('.pm-details');
  if (detailsEl) {
    detailsEl.innerHTML = `
      <p><strong>Length:</strong> ${password.length} characters</p>
      <p><strong>Crack time:</strong> ${analysis?.crack_times_display?.offline_fast_hashing_1e10_per_second || 'unknown'}</p>
      <p><strong>Last checked:</strong> ${new Date().toLocaleTimeString()}</p>
    `;
  }
}

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 Content script received:', request);
  
  // Handle toggle meter request from popup
  if (request.action === 'toggleMeter') {
    let meter = document.getElementById('pm-draggable-meter');
    
    if (meter) {
      // Toggle visibility
      meter.style.display = meter.style.display === 'none' ? 'block' : 'none';
      const isVisible = meter.style.display !== 'none';
      
      sendResponse({ 
        success: true, 
        visible: isVisible,
        message: isVisible ? 'Meter shown' : 'Meter hidden'
      });
    } else {
      // Create new meter
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
  
  // Handle password check request
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
  
  // Handle get status request
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

// Initialization
console.log("🔍 Scanning for password fields...");
monitorPasswordFields();

// Check if we should show the draggable meter automatically
chrome.storage.sync.get(['autoShowMeter'], (result) => {
  if (result.autoShowMeter) {
    createDraggableMeter().style.display = 'block';
  }
});

// Monitor for dynamic content
const observer = new MutationObserver(() => {
  monitorPasswordFields();
  setupAutoShowMeter();
});
observer.observe(document.body, { childList: true, subtree: true });

// Also check after delay for dynamically loaded pages
setTimeout(monitorPasswordFields, 1000);

// Debug test for draggable
setTimeout(() => {
  const meter = document.getElementById('pm-draggable-meter');
  if (meter) {
    console.log('Meter exists, header:', meter.querySelector('.pm-meter-header'));
    console.log('Draggable function exists:', typeof makeDraggable === 'function');
  }
}, 2000);

console.log("✅ Complete password analyzer active!");
console.log("📦 Draggable meter system ready!");