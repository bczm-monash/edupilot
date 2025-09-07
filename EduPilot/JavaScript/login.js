async function signIn(event) {
  if (event) event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert('Please enter email and password.');
    return false;
  }

  if (!window.supabase) {
    alert('Supabase is not initialized. Check supabase-init.js config.');
    return false;
  }

  try {
    const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(`Login failed: ${error.message}`);
      return false;
    }

    const user = data.user;
    const role = user?.user_metadata?.role || 'student';

    if (role === 'Teacher') {
      toTCourse();
    } else {
      toSCourse();
    }
    return true;
  } catch (e) {
    alert(`Unexpected error during login: ${e.message || e}`);
    return false;
  }
}
