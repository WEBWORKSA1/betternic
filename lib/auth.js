// Auth page logic
let authMode = 'signin';

function toggleMode(e) {
  e.preventDefault();
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  if (authMode === 'signup') {
    document.getElementById('auth-title').textContent = 'Create account';
    document.getElementById('auth-sub').textContent = 'Start selling domains in 2 minutes.';
    document.getElementById('auth-submit').textContent = 'Create account';
    document.getElementById('toggle-text').textContent = 'Already have an account?';
    document.getElementById('toggle-link').textContent = 'Sign in';
  } else {
    document.getElementById('auth-title').textContent = 'Sign in';
    document.getElementById('auth-sub').textContent = 'Welcome back. Sign in to manage your domains.';
    document.getElementById('auth-submit').textContent = 'Sign in';
    document.getElementById('toggle-text').textContent = 'New to BetterNic?';
    document.getElementById('toggle-link').textContent = 'Create an account';
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.remove('visible');

  try {
    if (authMode === 'signup') {
      const { error } = await API.signUp(email, password);
      if (error) throw error;
      alert('Check your email to verify your account.');
    } else {
      const { error } = await API.signIn(email, password);
      if (error) throw error;
      window.location.href = '/dashboard.html';
    }
  } catch (err) {
    errEl.textContent = err.message || 'Authentication failed. Make sure Supabase is configured in lib/config.js.';
    errEl.classList.add('visible');
  }
}
