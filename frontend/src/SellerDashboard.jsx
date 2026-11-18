import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { initializeCSRF } from './api'

const formatPrice = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const statusStyle = {
  APPROVED: { color: '#16803c', background: '#e9f7ee' },
  PENDING: { color: '#946200', background: '#fff5d9' },
  REJECTED: { color: '#b42318', background: '#fff0ef' },
}

export default function SellerDashboard() {
  const navigate = useNavigate()

  const [seller, setSeller] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError('')

      await initializeCSRF()

      const [sellerResponse, vehicleResponse] = await Promise.all([
        api.get('auth/me/'),
        api.get('vehicles/my-listings/'),
      ])

      if (!sellerResponse.data?.authenticated) {
        navigate('/seller/login', { replace: true })
        return
      }

      setSeller(sellerResponse.data.user)

      const data = vehicleResponse.data?.results || vehicleResponse.data
      setVehicles(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/seller/login', { replace: true })
        return
      }

      console.error('SELLER DASHBOARD ERROR:', err)
      setError(
        err.response?.data?.detail ||
        'Unable to load your seller dashboard.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const handleLogout = async () => {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      const csrfToken = await initializeCSRF()

      await api.post(
        'auth/logout/',
        {},
        {
          headers: { 'X-CSRFToken': csrfToken },
          withCredentials: true,
        }
      )

      navigate('/seller/login', { replace: true })
    } catch (err) {
      console.error('SELLER LOGOUT ERROR:', err)
      setError('Unable to logout. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return <div style={styles.center}>Loading Seller Dashboard...</div>
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#b42318' }}>{error}</p>
        <button onClick={loadDashboard} style={styles.button}>
          Try Again
        </button>
      </div>
    )
  }

  const pending = vehicles.filter(
    (vehicle) => vehicle.listing_status === 'PENDING'
  ).length

  const approved = vehicles.filter(
    (vehicle) => vehicle.listing_status === 'APPROVED'
  ).length

  const rejected = vehicles.filter(
    (vehicle) => vehicle.listing_status === 'REJECTED'
  ).length

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>
          AUTO<span style={{ color: '#b58a35' }}>Z</span>
        </Link>

        <div style={styles.headerRight}>
          <span>Welcome, {seller?.username}</span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={styles.logout}
          >
            {loggingOut ? 'Logging Out...' : 'Logout'}
          </button>
        </div>
      </header>

      <main style={styles.container}>
        <div style={styles.headingRow}>
          <div>
            <p style={styles.kicker}>SELLER PORTAL</p>
            <h1 style={styles.heading}>Seller Dashboard</h1>
            <p style={styles.subtitle}>
              Manage your vehicles and listing approval status.
            </p>
          </div>

          <button
            style={styles.button}
            onClick={() => navigate('/seller/vehicles/new')}
          >
            + Add New Vehicle
          </button>
        </div>

        <section style={styles.stats}>
          <Stat title="Total Listings" value={vehicles.length} />
          <Stat title="Pending Approval" value={pending} />
          <Stat title="Approved" value={approved} />
          <Stat title="Rejected" value={rejected} />
        </section>

        <section style={styles.panel}>
          <h2>My Vehicle Listings</h2>

          {vehicles.length === 0 ? (
            <div style={styles.empty}>
              <h3>No vehicles listed yet</h3>
              <p>Start by adding your first vehicle to AutoZ.</p>
              <button
                style={styles.button}
                onClick={() => navigate('/seller/vehicles/new')}
              >
                Add Your First Vehicle
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.cell}>Vehicle</th>
                    <th style={styles.cell}>Year</th>
                    <th style={styles.cell}>Price</th>
                    <th style={styles.cell}>Status</th>
                    <th style={styles.cell}>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td style={styles.cell}>
                        <strong>{vehicle.title}</strong>
                        <div style={{ color: '#777', fontSize: '12px' }}>
                          {vehicle.company_name || ''}
                        </div>
                      </td>

                      <td style={styles.cell}>{vehicle.year}</td>
                      <td style={styles.cell}>
                        {formatPrice(vehicle.price)}
                      </td>

                      <td style={styles.cell}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(statusStyle[vehicle.listing_status] || {}),
                          }}
                        >
                          {vehicle.listing_status || 'UNKNOWN'}
                        </span>

                        {vehicle.rejection_reason && (
                          <p style={styles.rejection}>
                            {vehicle.rejection_reason}
                          </p>
                        )}
                      </td>

                      <td style={styles.cell}>
                        {vehicle.created_at
                          ? new Date(vehicle.created_at).toLocaleDateString(
                              'en-US'
                            )
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Stat({ title, value }) {
  return (
    <div style={styles.statCard}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f4f5f7',
    color: '#171717',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
    padding: '18px 5%',
    background: '#fff',
    borderBottom: '1px solid #eee',
  },
  logo: {
    color: '#171717',
    fontSize: '25px',
    fontWeight: 'bold',
    textDecoration: 'none',
    letterSpacing: '2px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
  },
  logout: {
    padding: '10px 16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
  },
  container: {
    width: '90%',
    maxWidth: '1250px',
    margin: '35px auto',
  },
  headingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '25px',
  },
  kicker: {
    color: '#a67c18',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '2px',
  },
  heading: {
    margin: '8px 0',
    fontSize: '32px',
  },
  subtitle: {
    color: '#777',
  },
  button: {
    padding: '13px 20px',
    border: 'none',
    borderRadius: '7px',
    background: '#171717',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '25px',
  },
  statCard: {
    padding: '22px',
    background: '#fff',
    borderRadius: '10px',
    boxShadow: '0 3px 15px rgba(0,0,0,0.04)',
  },
  panel: {
    padding: '25px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 3px 15px rgba(0,0,0,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  cell: {
    padding: '14px 12px',
    borderBottom: '1px solid #eee',
    whiteSpace: 'nowrap',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  rejection: {
    maxWidth: '220px',
    color: '#b42318',
    fontSize: '12px',
    whiteSpace: 'normal',
  },
  empty: {
    textAlign: 'center',
    padding: '45px 15px',
    color: '#777',
  },
  center: {
    minHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
  },
}