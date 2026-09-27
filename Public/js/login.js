const loginForm = document.getElementById("loginForm");

const email = document.getElementById("email");

const password = document.getElementById("password");

const emailError =
	document.getElementById("emailError");

const passwordError =
	document.getElementById("passwordError");

const passwordToggle =
	document.getElementById("passwordToggle");

const formMessage =
	document.getElementById("formMessage");

const googleLogin =
	document.getElementById("googleLogin");


// ==========================================
// SHOW / HIDE PASSWORD
// ==========================================

passwordToggle.addEventListener("click", () => {

	if (password.type === "password") {

		password.type = "text";

		passwordToggle.textContent = "Hide";

	} else {

		password.type = "password";

		passwordToggle.textContent = "Show";
	}

});


// ==========================================
// LOGIN FORM
// ==========================================

loginForm.addEventListener("submit", async (event) => {

	event.preventDefault();

	clearErrors();

	const emailValue =
		email.value.trim();

	const passwordValue =
		password.value;

	let isValid = true;


	// -------------------------------
	// Email validation
	// -------------------------------

	if (!emailValue) {

		emailError.textContent =
			"Email is required";

		isValid = false;

	} else if (!isValidEmail(emailValue)) {

		emailError.textContent =
			"Enter a valid email address";

		isValid = false;
	}


	// -------------------------------
	// Password validation
	// -------------------------------

	if (!passwordValue) {

		passwordError.textContent =
			"Password is required";

		isValid = false;

	} else if (passwordValue.length > 72) {

		passwordError.textContent =
			"Password cannot exceed 72 characters";

		isValid = false;
	}


	// -------------------------------
	// Stop if invalid
	// -------------------------------

	if (!isValid) {
		return;
	}


	try {
		const response = await fetch('/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ email: emailValue, password: passwordValue })
		});
		const result = await response.json();

		if (!response.ok) {
			formMessage.textContent = result.error || 'Unable to sign in.';
			formMessage.className = 'form-message error';
			return;
		}

		window.location.assign('/');
	} catch {
		formMessage.textContent = 'Unable to reach the server. Please try again.';
		formMessage.className = 'form-message error';
	}

});


// ==========================================
// GOOGLE LOGIN
// ==========================================

googleLogin.addEventListener("click", () => {
	window.location.assign('/auth/google');

});


// ==========================================
// EMAIL VALIDATION
// ==========================================

function isValidEmail(value) {

	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

}


// ==========================================
// CLEAR ERRORS
// ==========================================

function clearErrors() {

	emailError.textContent = "";

	passwordError.textContent = "";

	formMessage.textContent = "";

	formMessage.className =
		"form-message";

}
