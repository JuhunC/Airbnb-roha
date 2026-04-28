'use strict';

const CONFIG_KEY = 'roha_config';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

function buildSystemPrompt(config) {
  const p = config.property || {};
  const lines = [
    'You are a friendly and helpful AI assistant for an Airbnb property.',
    'Answer guest questions concisely and warmly based on the property information below.',
    'If a question falls outside the provided information, politely say so and suggest contacting the host directly.',
    '',
    '=== PROPERTY INFORMATION ===',
  ];
  if (p.name)                  lines.push('Property Name: ' + p.name);
  if (p.location)               lines.push('Location: ' + p.location);
  if (p.checkin_time)           lines.push('Check-in Time: ' + p.checkin_time);
  if (p.checkout_time)          lines.push('Check-out Time: ' + p.checkout_time);
  if (p.max_guests)             lines.push('Max Guests: ' + p.max_guests);
  if (p.bedrooms)               lines.push('Bedrooms: ' + p.bedrooms);
  if (p.bathrooms)              lines.push('Bathrooms: ' + p.bathrooms);
  if (p.description)            lines.push('', 'Description:', p.description);
  if (p.amenities)              lines.push('', 'Amenities:', p.amenities);
  if (p.rules)                  lines.push('', 'House Rules:', p.rules);
  if (p.checkin_instructions)   lines.push('', 'Check-in Instructions:', p.checkin_instructions);
  if (p.faq)                    lines.push('', 'FAQ:', p.faq);
  if (p.additional_info)        lines.push('', 'Additional Info:', p.additional_info);
  lines.push('=== END ===');
  return lines.join('\n');
}

const messagesEl   = document.getElementById('chat-messages');
const inputEl      = document.getElementById('message-input');
const sendBtn      = document.getElementById('send-btn');
const propNameEl   = document.getElementById('property-name');

let history   = [];
let busy      = false;

function appendMessage(role, text) {
  const wrap = document.createElement('div');
  wrap.className = 'message ' + role;

  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = role === 'bot' ? '🏠' : '👤';

  const bub = document.createElement('div');
  bub.className = 'msg-bubble';
  bub.textContent = text;

  wrap.appendChild(av);
  wrap.appendChild(bub);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message bot';
  wrap.id = 'typing-msg';

  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = '🏠';

  const bub = document.createElement('div');
  bub.className = 'typing-bubble';
  bub.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

  wrap.appendChild(av);
  wrap.appendChild(bub);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-msg');
  if (el) el.remove();
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || busy) return;

  const config = getConfig();
  if (!config.api_key) return;

  inputEl.value = '';
  busy = true;
  sendBtn.disabled = true;

  appendMessage('user', text);
  history.push({ role: 'user', content: text });

  showTyping();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      config.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system:     buildSystemPrompt(config),
        messages:   history,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API request failed (status ' + res.status + ')');
    }

    const data  = await res.json();
    const reply = data.content[0].text;

    removeTyping();
    appendMessage('bot', reply);
    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    removeTyping();
    appendMessage('bot', 'Sorry, something went wrong: ' + err.message);
  }

  busy = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

function init() {
  const config = getConfig();

  if (config.property?.name) {
    propNameEl.textContent = config.property.name;
    document.title = config.property.name;
  }

  if (!config.api_key) {
    messagesEl.innerHTML = `
      <div class="not-configured">
        <div class="icon">⚙️</div>
        <p><strong>Chatbot not configured yet.</strong></p>
        <p>Visit the <a href="admin.html">admin panel</a> to set up the property info and API key.</p>
      </div>`;
    inputEl.disabled = true;
    sendBtn.disabled = true;
    return;
  }

  const welcome = config.welcome_message ||
    `Hi there! 👋 I'm the assistant for ${config.property?.name || 'this property'}. Ask me anything — check-in times, amenities, rules, and more!`;
  appendMessage('bot', welcome);
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

init();
