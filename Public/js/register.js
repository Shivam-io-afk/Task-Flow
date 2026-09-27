const registerForm =
	document.getElementById("registerForm");

const nameInput =
	document.getElementById("name");

const email =
	document.getElementById("email");

const password =
	document.getElementById("password");

const confirmPassword =
	document.getElementById("confirmPassword");

const terms =
	document.getElementById("terms");

const nameError =
	document.getElementById("nameError");

const emailError =
	document.getElementById("emailError");

const passwordError =
	document.getElementById("passwordError");

const confirmPasswordError =
	document.getElementById("confirmPasswordError");

const termsError =
	document.getElementById("termsError");

const formMessage =
	document.getElementById("formMessage");

const passwordToggle =
	document.getElementById("passwordToggle");

const confirmPasswordToggle =
	document.getElementById("confirmPasswordToggle");

const googleSignup =
	document.getElementById("googleSignup");


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
// SHOW / HIDE CONFIRM PASSWORD
// ==========================================

confirmPasswordToggle.addEventListener("click", () => {

	if (confirmPassword.type === "password") {

		confirmPassword.type = "text";

		confirmPasswordToggle.textContent = "Hide";

	} else {

		confirmPassword.type = "password";

		confirmPasswordToggle.textContent = "Show";

	}

});


// ==========================================
// REGISTER FORM
// ==========================================

registerForm.addEventListener("submit", async (event) => {

	event.preventDefault();

	clearErrors();

	const nameValue =
		nameInput.value.trim();

	const emailValue =
		email.value.trim();

	const passwordValue =
		password.value;

	const confirmPasswordValue =
		confirmPassword.value;

	let isValid = true;


	// --------------------------------
	// Name validation
	// --------------------------------

	if (!nameValue) {

		nameError.textContent =
			"Full name is required";

		isValid = false;

	} else if (nameValue.length < 2) {

		nameError.textContent =
			"Enter your full name";

		isValid = false;

	}


	// --------------------------------
	// Email validation
	// --------------------------------

	if (!emailValue) {

		emailError.textContent =
			"Email is required";

		isValid = false;

	} else if (!isValidEmail(emailValue)) {

		emailError.textContent =
			"Enter a valid email address";

		isValid = false;

	}


	// --------------------------------
	// Password validation
	// --------------------------------

	if (!passwordValue) {

		passwordError.textContent =
			"Password is required";

		isValid = false;

	} else if (passwordValue.length < 10) {

		passwordError.textContent =
			"Password must be at least 10 characters";

		isValid = false;

	} else if (passwordValue.length > 72 ||
		!/[a-z]/.test(passwordValue) ||
		!/[A-Z]/.test(passwordValue) ||
		!/[0-9]/.test(passwordValue)) {

		passwordError.textContent =
			"Use uppercase, lowercase, and a number (maximum 72 characters)";

		isValid = false;

	}


	// --------------------------------
	// Confirm password
	// --------------------------------

	if (!confirmPasswordValue) {

		confirmPasswordError.textContent =
			"Please confirm your password";

		isValid = false;

	} else if (
		passwordValue !== confirmPasswordValue
	) {

		confirmPasswordError.textContent =
			"Passwords do not match";

		isValid = false;

	}


	// --------------------------------
	// Terms
	// --------------------------------

	if (!terms.checked) {

		termsError.textContent =
			"You must accept the terms";

		isValid = false;

	}


	// --------------------------------
	// Stop if invalid
	// --------------------------------

	if (!isValid) {

		return;

	}


	try {
		const response = await fetch('/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ name: nameValue, email: emailValue, password: passwordValue })
		});
		const result = await response.json();

		if (!response.ok) {
			formMessage.textContent = result.error || 'Unable to create your account.';
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
// GOOGLE SIGNUP
// ==========================================

googleSignup.addEventListener("click", () => {
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

	nameError.textContent = "";

	emailError.textContent = "";

	passwordError.textContent = "";

	confirmPasswordError.textContent = "";

	termsError.textContent = "";

	formMessage.textContent = "";

	formMessage.className =
		"form-message";

}