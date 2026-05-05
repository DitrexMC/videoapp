document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const authId = document.getElementById('auth-id').value.trim();
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authId }),
        });
        if (res.ok) {
            window.location.href = '/';
        } else {
            document.getElementById('error-msg').textContent = '認証IDが無効です';
        }
    } catch {
        document.getElementById('error-msg').textContent = 'ネットワークエラー';
    }
});
