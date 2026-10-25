
const form = document.querySelector("#register-form");
const feedback = document.querySelector("#feedback");
const submitButton = document.querySelector("#submit-button");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;
  const confirmPassword = form.elements.confirmPassword.value;

  if (password !== confirmPassword) {
    showFeedback("As senhas não coincidem.", false);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Criando conta...";
  feedback.classList.add("hidden");

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      showFeedback(
        result.error || "Não foi possível criar sua conta.",
        false
      );
      return;
    }

    showFeedback(result.message, true);
    form.reset();
  } catch {
    showFeedback(
      "Não foi possível conectar ao servidor. Tente novamente.",
      false
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Criar conta";
  }
});

function showFeedback(message, success) {
  feedback.textContent = message;
  feedback.className = success
    ? "rounded-lg bg-green-900/50 p-3 text-sm text-green-300"
    : "rounded-lg bg-red-900/50 p-3 text-sm text-red-300";
}
