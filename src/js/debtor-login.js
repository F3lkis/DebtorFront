const API = {
  base:     'https://debtor-api-81qs.onrender.com', 
  users:    '/users', 
  register: '/save',  
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  btn.disabled = on;
  on ? btn.classList.add('loading') : btn.classList.remove('loading');
}
function showAlert(id, show) {
  const el = document.getElementById(id);
  show ? el.classList.add('show') : el.classList.remove('show');
}
function fieldErr(id, show) {
  const el = document.getElementById(id);
  el && (show ? el.classList.add('show') : el.classList.remove('show'));
}
function markInput(id, error) {
  const el = document.getElementById(id);
  el && (error ? el.classList.add('has-error') : el.classList.remove('has-error'));
}
function clearErrors(...ids) {
  ids.forEach(id => { 
    fieldErr(id, false); 
    markInput(id.replace('-err','').replace('reg-','reg-').replace('login-','login-').replace('recovery-','recovery-'), false); 
  });
}
function val(id)  { return document.getElementById(id).value.trim(); }
function isEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  const hide = inp.type === 'password';
  inp.type = hide ? 'text' : 'password';
  btn.querySelector('svg').innerHTML = hide
    ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function checkStrength(pw) {
  let score = 0;
  if (pw.length >= 8)   score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const colors = ['', '#C8183A', '#E8820C', '#1845C8', '#0E7A50'];
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  for (let i = 1; i <= 4; i++) {
    document.getElementById('bar' + i).style.background = i <= score ? colors[score] : '#ECEEF2';
  }
  document.getElementById('pw-hint').textContent = pw.length === 0
    ? 'Use letras, números e símbolos'
    : 'Senha ' + (labels[score] || 'Fraca');
  document.getElementById('pw-hint').style.color = pw.length === 0 ? 'var(--ink-ghost)' : colors[score];
}

async function handleRegister() {
  showAlert('register-error', false);
  clearErrors('reg-first-err', 'reg-last-err', 'reg-email-err', 'reg-pw-err');

  const firstName = val('reg-first');
  const lastName  = val('reg-last');
  const email     = val('reg-email');
  const password  = val('reg-password');
  let valid = true;

  if (!firstName) { markInput('reg-first', true); fieldErr('reg-first-err', true); valid = false; }
  if (!lastName)  { markInput('reg-last', true);  fieldErr('reg-last-err', true);  valid = false; }
  if (!isEmail(email)) { markInput('reg-email', true); fieldErr('reg-email-err', true); valid = false; }
  if (password.length < 8) { markInput('reg-password', true); fieldErr('reg-pw-err', true); valid = false; }
  
  if (!valid) return;

  setLoading('btn-register', true);

  try {
    const res = await fetch(API.base + API.register, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password })
    });

    const responseText = await res.text();

    if (res.ok && responseText.includes("Saved")) {
      document.getElementById('reg-first').value = '';
      document.getElementById('reg-last').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      
      alert("Conta criada com sucesso! Faça login para continuar.");
      showScreen('screen-login');
    } else {
      throw new Error("Falha ao salvar no banco de dados.");
    }

  } catch (err) {
    document.getElementById('register-error-msg').textContent = 'Erro ao conectar com a API. Verifique a internet.';
    showAlert('register-error', true);
    console.error('[register]', err);
  } finally {
    setLoading('btn-register', false);
  }
}

async function handleLogin() {
  showAlert('login-error', false);
  clearErrors('login-email-err', 'login-pw-err');

  const email    = val('login-email');
  const password = val('login-password');
  let valid = true;

  if (!isEmail(email)) {
    markInput('login-email', true);
    fieldErr('login-email-err', true);
    valid = false;
  }
  if (!password) {
    markInput('login-password', true);
    fieldErr('login-pw-err', true);
    valid = false;
  }
  if (!valid) return;

  setLoading('btn-login', true);

  try {
    const res = await fetch(API.base + API.users);
    
    if (!res.ok) throw new Error("Erro ao buscar usuários");
    
    const users = await res.json(); 
    const userFound = users.find(u => u.email === email && u.password === password);

    if (userFound) {
      localStorage.setItem('dh_user_id', userFound.id);
      localStorage.setItem('dh_user_email', userFound.email);
      localStorage.setItem('dh_user_name', userFound.firstName);
      
      // Caminho relativo para não causar erro 404
      window.location.href = 'dashboard.html'; 
    } else {
      document.getElementById('login-error-msg').textContent = 'E-mail ou senha incorretos.';
      showAlert('login-error', true);
    }

  } catch (err) {
    document.getElementById('login-error-msg').textContent = 'Sem conexão com o servidor.';
    showAlert('login-error', true);
    console.error('[login]', err);
  } finally {
    setLoading('btn-login', false);
  }
}

function handleRecovery() {
  showAlert('recovery-success', false);
  showAlert('recovery-error', false);
  clearErrors('recovery-email-err');

  const email = val('recovery-email');

  if (!isEmail(email)) {
    markInput('recovery-email', true);
    fieldErr('recovery-email-err', true);
    return;
  }

  setLoading('btn-recovery', true);
  
  setTimeout(() => {
    document.getElementById('recovery-form-wrap').style.display = 'none';
    showAlert('recovery-success', true);
    setLoading('btn-recovery', false);
  }, 1500);
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.screen.active').id;
  if (active === 'screen-login')    handleLogin();
  if (active === 'screen-register') handleRegister();
  if (active === 'screen-recovery') handleRecovery();
});