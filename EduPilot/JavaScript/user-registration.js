function openPopup(){
    let popup = document.getElementById("popup")
    popup.classList.add("open-popup");
}

async function validateForm() {
    const title = document.getElementById("title").value;
    const firstname = document.getElementById("firstname").value.trim();
    const lastname = document.getElementById("lastname").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmpassword").value;
    const role = document.getElementById("role").value;
    const key = document.getElementById("key").value.trim();

    // make sure every field is filled
    if (!title || !firstname || !lastname || !email || !password || !confirmPassword || !role) {
        alert("Please fill in all required fields.");
        return false;
    }

    // validate email
    const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,}$/i;
    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address.");
        return false;
    }

    // validate pw
    const passPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passPattern.test(password)) {
        alert("Password must have at least 8 characters, 1 lowercase, 1 uppercase, and 1 number.");
        return false;
    }

    // cfm pw match
    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return false;
    }

    // teacher key
    const requiredKey = "teacher2025"; 
    if (role === "Teacher" && !key) {
        alert("Teachers must provide a key.");
        return false;
    } else if (role === "Teacher" && key !== requiredKey) {
        alert("Invalid key for teacher registration.");
        return false;
    }

    // Add to supabase
    if (!window.supabase) {
        alert("Supabase is not initialized. Please check your supabase-init.js configuration.");
        return false;
    }

    try {
        // Check if email already exists
        try {
            const { data: existing, error: checkErr } = await window.supabase
                .from('users')
                .select('users_id')
                .eq('users_email', email)
                .maybeSingle();

            if (!checkErr && existing) {
                alert('This email is already registered. Please log in.');
                return false;
            }
        } catch (_) {
        }

        const { data, error } = await window.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    title,
                    first_name: firstname,
                    last_name: lastname,
                    role,
                },
            },
        });

        if (error) {
            alert(`Sign up failed: ${error.message}`);
            return false;
        }

        openPopup();
        return true;
    } catch (e) {
        alert(`Unexpected error during sign up: ${e.message || e}`);
        return false;
    }
}
