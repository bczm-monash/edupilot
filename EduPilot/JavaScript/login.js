async function signIn(event) {
  if (event) event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  if (!email || !password) {
    alert('Please enter email and password.');
    return false;
  }

  // Handle Remember Me functionality
  if (rememberMe) {
    localStorage.setItem('rememberedEmail', email);
    localStorage.setItem('rememberedPassword', password);
  } else {
    localStorage.removeItem('rememberedEmail');
    localStorage.removeItem('rememberedPassword');
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
    let role = 'student';

    if (user) {
      try {
        const { data: users, error: roleError } = await window.supabase
          .from('users')
          .select('users_role')
          .eq('users_email', user.email || email)
          .maybeSingle();

        if (roleError) {
          console.warn('Failed to fetch user role', roleError);
        } else if (users?.users_role) {
          role = users.users_role;
        }
      } catch (roleException) {
        console.warn('Unexpected error fetching user role', roleException);
      }
    }

    if (role === 'Teacher') {
      toTCourse();
    } else if (role === 'Admin') {
      toAdmin();
    } else if (role == 'Student'){
      toSWelcome();
    } else {
      alert("You have been banned!")
    }
    return true;
  } catch (e) {
    alert(`Unexpected error during login: ${e.message || e}`);
    return false;
  }
}

document.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    const target = event.target;
    if (target.id === 'email' || target.id === 'password') {
      signIn();
    }
  }
});

// Pre-fill email and password if remembered
document.addEventListener('DOMContentLoaded', function() {
  const rememberedEmail = localStorage.getItem('rememberedEmail');
  const rememberedPassword = localStorage.getItem('rememberedPassword');
  if (rememberedEmail) {
    document.getElementById('email').value = rememberedEmail;
    document.getElementById('rememberMe').checked = true;
  }
  if (rememberedPassword) {
    document.getElementById('password').value = rememberedPassword;
  }
});
