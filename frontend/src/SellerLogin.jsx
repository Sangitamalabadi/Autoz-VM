import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { initializeCSRF } from './api'

export default function SellerLogin() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()

    if (loading) return

    setError('')

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    setLoading(true)

    try {
      const csrfToken = await initializeCSRF()

      const response = await api.post(
        'auth/login/',
        {
          username: username.trim(),
          password,
        },
        {
          headers: {
            'X-CSRFToken': csrfToken,
          },
          withCredentials: true,
        }
      )

      if (response.data?.success && response.data?.user?.role === 'Seller') {
        navigate('/seller/dashboard', { replace: true })
      } else {
        setError(response.data?.message || 'Seller login failed.')
      }
    } catch (err) {
      console.error('SELLER LOGIN ERROR:', err)
      setError(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Unable to login. Please check your credentials and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Link to="/" style={styles.logo}>
          AUTO<span style={{ color: '#b58a35' }}>Z</span>
        </Link>

        <p style={styles.kicker}>SELLER PORTAL</p>
        <h1 style={styles.heading}>Welcome Back</h1>
        <p style={styles.subtitle}>
          Sign in to manage your vehicle listings.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing In...' : 'Sign In as Seller'}
          </button>
        </form>

        <p style={styles.footer}>
          Not a seller?{' '}
          <Link to="/" style={styles.link}>
            Back to Marketplace
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '25px',
    background: '#f4f5f7',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '42px',
    background: '#fff',
    borderRadius: '14px',
    boxShadow: '0 8px 35px rgba(0,0,0,0.08)',
  },
  logo: {
    display: 'block',
    textAlign: 'center',
    color: '#171717',
    fontSize: '30px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    textDecoration: 'none',
  },
  kicker: {
    marginTop: '30px',
    color: '#a67c18',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '2px',
  },
  heading: {
    textAlign: 'center',
    marginBottom: '8px',
    color: '#171717',
  },
  subtitle: {
    textAlign: 'center',
    color: '#777',
    marginBottom: '28px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    marginTop: '18px',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px',
    border: '1px solid #ddd',
    borderRadius: '7px',
    fontSize: '15px',
  },
  button: {
    width: '100%',
    marginTop: '25px',
    padding: '14px',
    border: 'none',
    borderRadius: '7px',
    background: '#171717',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    padding: '12px',
    borderRadius: '7px',
    background: '#fff0ef',
    color: '#b42318',
    fontSize: '14px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '25px',
    fontSize: '13px',
    color: '#777',
  },
  link: {
    color: '#a67c18',
    fontWeight: 'bold',
    textDecoration: 'none',
  },
}