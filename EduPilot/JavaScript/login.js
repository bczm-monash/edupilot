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
      toSCourse();
    } else {
      alert("You have been banned!")
    }
    return true;
  } catch (e) {
    alert(`Unexpected error during login: ${e.message || e}`);
    return false;
  }
}
