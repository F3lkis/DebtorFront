/* ══════════════════════════════════════════
   API CONFIG — Apontando para a Render
   ══════════════════════════════════════════ */
const API = {
  base:     'https://debtor-api-81qs.onrender.com', 
  users:    '/users', // GET para listar e validar login
  register: '/save',  // POST para criar conta
};

/* ── Helpers de UI (Mantidos do seu código original) ── */
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

/* ══════════════════════════════════════════
   INTEGRAÇÃO COM A API JAVA
   ══════════════════════════════════════════ */

/* ── REGISTER (Criar Conta via /save) ── */
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

    // Como o Java retorna "Saved ...", nós lemos como texto puro
    const responseText = await res.text();

    if (res.ok && responseText.includes("Saved")) {
      // Conta criada com sucesso! Guarda o usuário no navegador para simular login
      localStorage.setItem('dh_user_email', email);
      localStorage.setItem('dh_user_name', firstName);
      
      // Limpa os campos e vai para a tela de login (ou dashboard)
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
    document.getElementById('register-error-msg').textContent = 'Erro ao conectar com a API. Verifique o CORS ou a internet.';
    showAlert('register-error', true);
    console.error('[register]', err);
  } finally {
    setLoading('btn-register', false);
  }
}

/* ── LOGIN (Simulado via GET /users) ── */
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
    // Busca a lista de todos os usuários cadastrados
    const res = await fetch(API.base + API.users);
    
    if (!res.ok) throw new Error("Erro ao buscar usuários");
    
    // Como a rota /users retorna uma lista em JSON, lemos como json
    const users = await res.json(); 

    // Procura na lista se existe alguém com esse e-mail e senha
    const userFound = users.find(u => u.email === email && u.password === password);

    if (userFound) {
      // Sucesso! Usuário encontrado
      localStorage.setItem('dh_user_email', userFound.email);
      localStorage.setItem('dh_user_name', userFound.firstName);
      
      // Redireciona para o painel principal (ajuste este link para a sua página real)
      window.location.href = '/dashboard.html'; 
    } else {
      // Usuário não encontrado ou senha errada
      document.getElementById('login-error-msg').textContent = 'E-mail ou senha incorretos.';
      showAlert('login-error', true);
    }

  } catch (err) {
    document.getElementById('login-error-msg').textContent = 'Sem conexão com o servidor. Verifique o CORS ou sua internet.';
    showAlert('login-error', true);
    console.error('[login]', err);
  } finally {
    setLoading('btn-login', false);
  }
}

/* ── RECOVERY (Mock - já que não há envio de e-mail no backend ainda) ── */
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
  
  // Simula o tempo de envio
  setTimeout(() => {
    document.getElementById('recovery-form-wrap').style.display = 'none';
    showAlert('recovery-success', true);
    setLoading('btn-recovery', false);
  }, 1500);
}

/* ── Eventos de Tela ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.screen.active').id;
  if (active === 'screen-login')    handleLogin();
  if (active === 'screen-register') handleRegister();
  if (active === 'screen-recovery') handleRecovery();
});