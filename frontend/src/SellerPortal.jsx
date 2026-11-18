import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { initializeCSRF } from './api'

const BACKEND_URL = 'http://127.0.0.1:8000'

function imageUrl(value) {
  if (!value) return ''
  if (value.startsWith('http')) return value
  return `${BACKEND_URL}${value.startsWith('/') ? '' : '/'}${value}`
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function getErrorMessage(error) {
  const data = error.response?.data

  if (typeof data === 'string') return data
  if (data?.detail) return data.detail
  if (data?.error) return data.error
  if (data?.message) return data.message

  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([field, messages]) => {
        const value = Array.isArray(messages)
          ? messages.join(', ')
          : String(messages)

        return `${field}: ${value}`
      })
      .join(' | ')
  }

  return error.message || 'Something went wrong. Please try again.'
}

function SellerPortal() {
  const navigate = useNavigate()

  const [seller, setSeller] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [vehicles, setVehicles] = useState([])
  const [companies, setCompanies] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    company: '',
    model_name: '',
    price: '',
    year: '',
    km_driven: '',
    category: 'Car',
    description: '',
    owner: '1st Owner',
  })

  const [mainImage, setMainImage] = useState(null)
  const [galleryImages, setGalleryImages] = useState([])

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    border: '1px solid #d5d5d5',
    borderRadius: '7px',
    marginTop: '7px',
    background: '#fff',
    color: '#171717',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '16px',
    color: '#333',
    fontSize: '14px',
    fontWeight: 600,
  }

  const buttonStyle = {
    border: 'none',
    borderRadius: '7px',
    padding: '12px 18px',
    background: '#171717',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  }

  // -------------------------------------
  // CHECK SELLER SESSION
  // -------------------------------------

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        await initializeCSRF()

        const response = await api.get('auth/me/')

        const data = response.data

        if (!active) return

        if (data?.authenticated && data?.user) {
          setSeller(data.user)
        } else if (data?.user && data?.user?.is_seller) {
          setSeller(data.user)
        } else {
          setSeller(null)
        }
      } catch (error) {
        if (active) setSeller(null)
      } finally {
        if (active) setAuthLoading(false)
      }
    }

    checkSession()

    return () => {
      active = false
    }
  }, [])

  // -------------------------------------
  // LOAD SELLER DATA
  // -------------------------------------

  useEffect(() => {
    if (!seller) return

    let active = true

    async function loadSellerData() {
      setDataLoading(true)
      setPageError('')

      try {
        const [vehicleResponse, companyResponse] = await Promise.all([
          api.get('vehicles/my-listings/'),
          api.get('companies/'),
        ])

        if (!active) return

        const vehicleData =
          vehicleResponse.data?.results || vehicleResponse.data

        const companyData =
          companyResponse.data?.results || companyResponse.data

        setVehicles(Array.isArray(vehicleData) ? vehicleData : [])
        setCompanies(Array.isArray(companyData) ? companyData : [])
      } catch (error) {
        console.error('SELLER DASHBOARD ERROR:', error)
        if (active) setPageError(getErrorMessage(error))
      } finally {
        if (active) setDataLoading(false)
      }
    }

    loadSellerData()

    return () => {
      active = false
    }
  }, [seller])

  // -------------------------------------
  // SELLER LOGIN
  // -------------------------------------

  async function handleLogin(event) {
    event.preventDefault()

    if (loginLoading) return

    setLoginError('')
    setLoginLoading(true)

    try {
      const csrfToken = await initializeCSRF()

      const response = await api.post(
        'auth/login/',
        {
          username: username.trim(),
          password,
        },
        {
          withCredentials: true,
          headers: csrfToken
            ? { 'X-CSRFToken': csrfToken }
            : {},
        }
      )

      const data = response.data

      if (data?.success === false) {
        throw new Error(data.detail || data.error || 'Login failed.')
      }

      const loggedInUser = data?.user || data?.data?.user || null

      if (!loggedInUser) {
        throw new Error(
          'Login response did not contain user details. Please verify the seller login API response.'
        )
      }

      // Verify that the logged-in account is a Seller.
      const role = String(
        loggedInUser.role ||
        loggedInUser.user_type ||
        ''
      ).toLowerCase()

      const groups = Array.isArray(loggedInUser.groups)
        ? loggedInUser.groups.map((item) =>
            String(typeof item === 'string' ? item : item.name).toLowerCase()
          )
        : []

      const isSeller =
        role === 'seller' ||
        groups.includes('seller') ||
        loggedInUser.is_seller === true

      if (!isSeller) {
        await api.post('auth/logout/', {}, { withCredentials: true })
        throw new Error('This account does not have Seller access.')
      }

      setSeller(loggedInUser)
      setPassword('')
      setLoginError('')
      setSuccessMessage('Welcome to your AutoZ Seller Dashboard.')
    } catch (error) {
      console.error('SELLER LOGIN ERROR:', error)
      console.error('SELLER LOGIN RESPONSE:', error.response?.data)

      if (error.response?.status === 403) {
        setLoginError('CSRF verification failed. Refresh the page and try again.')
      } else if (error.response?.status === 404) {
        setLoginError('Seller login API was not found. Check the backend URL.')
      } else if (error.response?.status === 401) {
        setLoginError('Invalid username or password.')
      } else {
        setLoginError(getErrorMessage(error))
      }
    } finally {
      setLoginLoading(false)
    }
  }

  // -------------------------------------
  // SELLER LOGOUT
  // -------------------------------------

  async function handleLogout() {
    try {
      const csrfToken = await initializeCSRF()

      await api.post(
        'auth/logout/',
        {},
        {
          withCredentials: true,
          headers: csrfToken
            ? { 'X-CSRFToken': csrfToken }
            : {},
        }
      )

      setSeller(null)
      setVehicles([])
      setPassword('')
      setSuccessMessage('')
      setPageError('')
    } catch (error) {
      console.error('SELLER LOGOUT ERROR:', error)
      setPageError(getErrorMessage(error))
    }
  }

  // -------------------------------------
  // FORM HANDLING
  // -------------------------------------

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function handleMainImageChange(event) {
    const file = event.target.files?.[0] || null
    setMainImage(file)
  }

  function handleGalleryChange(event) {
    const files = Array.from(event.target.files || [])
    setGalleryImages(files)
  }

  function resetForm() {
    setForm({
      title: '',
      company: '',
      model_name: '',
      price: '',
      year: '',
      km_driven: '',
      category: 'Car',
      description: '',
      owner: '1st Owner',
    })

    setMainImage(null)
    setGalleryImages([])

    const mainInput = document.getElementById('seller-main-image')
    const galleryInput = document.getElementById('seller-gallery-images')

    if (mainInput) mainInput.value = ''
    if (galleryInput) galleryInput.value = ''
  }

  // -------------------------------------
  // CREATE VEHICLE LISTING
  // -------------------------------------

  async function handleCreateVehicle(event) {
    event.preventDefault()

    if (submitting) return

    setPageError('')
    setSuccessMessage('')

    if (!form.company) {
      setPageError('Please select a vehicle company.')
      return
    }

    if (!mainImage) {
      setPageError('Please select the main vehicle image.')
      return
    }

    if (galleryImages.length + 1 > 15) {
      setPageError('You can upload a maximum of 15 images, including the main image.')
      return
    }

    const price = Number(form.price)
    const year = Number(form.year)
    const mileage = Number(form.km_driven)

    if (!Number.isFinite(price) || price <= 0) {
      setPageError('Please enter a valid vehicle price.')
      return
    }

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setPageError('Please enter a valid vehicle year.')
      return
    }

    if (!Number.isInteger(mileage) || mileage < 0) {
      setPageError('Please enter valid mileage.')
      return
    }

    setSubmitting(true)

    try {
      const csrfToken = await initializeCSRF()

      const formData = new FormData()

      formData.append('title', form.title.trim())
      formData.append('company', form.company)
      formData.append('model_name', form.model_name.trim())
      formData.append('price', String(price))
      formData.append('year', String(year))
      formData.append('km_driven', String(mileage))
      formData.append('category', form.category)
      formData.append('description', form.description.trim())
      formData.append('owner', form.owner)
      formData.append('image', mainImage)

      galleryImages.forEach((file) => {
        formData.append('images', file)
      })

      const response = await api.post(
        'vehicles/create/',
        formData,
        {
          withCredentials: true,
          headers: {
            ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
            // Do not set Content-Type manually for FormData.
          },
        }
      )

      console.log('VEHICLE CREATED:', response.data)

      resetForm()
      setSuccessMessage(
        'Vehicle submitted successfully. Your listing is Pending Admin Approval.'
      )

      await refreshListings()
    } catch (error) {
      console.error('CREATE VEHICLE ERROR:', error)
      console.error('CREATE VEHICLE RESPONSE:', error.response?.data)
      setPageError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------
  // REFRESH LISTINGS
  // -------------------------------------

  async function refreshListings() {
    try {
      const response = await api.get('vehicles/my-listings/')
      const data = response.data?.results || response.data

      setVehicles(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('REFRESH LISTINGS ERROR:', error)
      setPageError(getErrorMessage(error))
    }
  }

  // -------------------------------------
  // DELETE LISTING
  // -------------------------------------

  async function handleDelete(vehicle) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${vehicle.title}"?`
    )

    if (!confirmed) return

    setPageError('')
    setSuccessMessage('')

    try {
      const csrfToken = await initializeCSRF()

      await api.delete(
        `vehicles/${vehicle.id}/delete/`,
        {
          withCredentials: true,
          headers: csrfToken
            ? { 'X-CSRFToken': csrfToken }
            : {},
        }
      )

      setSuccessMessage('Vehicle listing deleted successfully.')
      await refreshListings()
    } catch (error) {
      console.error('DELETE VEHICLE ERROR:', error)
      setPageError(getErrorMessage(error))
    }
  }

  // -------------------------------------
  // LOGIN SCREEN
  // -------------------------------------

  if (authLoading) {
    return (
      <div style={styles.centerPage}>
        <h2>Checking Seller Session...</h2>
      </div>
    )
  }

  if (!seller) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={styles.kicker}>AUTOZ SELLER PORTAL</div>

          <h1 style={{ marginBottom: 8 }}>Seller Login</h1>

          <p style={{ color: '#777', marginBottom: 28 }}>
            Sign in to manage your vehicle listings.
          </p>

          <form onSubmit={handleLogin}>
            <label style={labelStyle}>
              Username
              <input
                style={inputStyle}
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Enter seller username"
                required
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                required
              />
            </label>

            {loginError && (
              <div role="alert" style={styles.error}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                ...buttonStyle,
                width: '100%',
                opacity: loginLoading ? 0.7 : 1,
              }}
            >
              {loginLoading ? 'Signing In...' : 'Sign In as Seller'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/')}
            style={styles.backButton}
          >
            ← Back to Marketplace
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------
  // SELLER DASHBOARD
  // -------------------------------------

  const pendingCount = vehicles.filter(
    (vehicle) => vehicle.listing_status === 'PENDING'
  ).length

  const approvedCount = vehicles.filter(
    (vehicle) => vehicle.listing_status === 'APPROVED'
  ).length

  const rejectedCount = vehicles.filter(
    (vehicle) => vehicle.listing_status === 'REJECTED'
  ).length

  return (
    <div style={styles.dashboard}>
      <header style={styles.header}>
        <div>
          <div style={styles.kicker}>AUTOZ SELLER PORTAL</div>
          <h1 style={{ margin: '7px 0' }}>Seller Dashboard</h1>
          <p style={{ margin: 0, color: '#777' }}>
            Manage your vehicle listings and submissions.
          </p>
        </div>

        <div style={styles.headerActions}>
          <span style={{ fontWeight: 600 }}>
            {seller.username || seller.name || 'Seller'}
          </span>

          <button
            type="button"
            onClick={() => navigate('/')}
            style={styles.secondaryButton}
          >
            Marketplace
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={styles.darkButton}
          >
            Log Out
          </button>
        </div>
      </header>

      {pageError && (
        <div role="alert" style={styles.error}>
          {pageError}
        </div>
      )}

      {successMessage && (
        <div role="status" style={styles.success}>
          {successMessage}
        </div>
      )}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span>Total Listings</span>
          <strong>{vehicles.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Pending Approval</span>
          <strong>{pendingCount}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Approved Listings</span>
          <strong>{approvedCount}</strong>
        </div>

        <div style={styles.statCard}>
          <span>Rejected Listings</span>
          <strong>{rejectedCount}</strong>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.kicker}>NEW VEHICLE</div>
            <h2 style={{ margin: '7px 0' }}>Add Vehicle Listing</h2>
            <p style={{ margin: 0, color: '#777' }}>
              Submit your vehicle for AutoZ admin review.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateVehicle}>
          <div style={styles.formGrid}>
            <label style={labelStyle}>
              Vehicle Title *
              <input
                style={inputStyle}
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. 2022 BMW X5 xDrive40i"
                required
              />
            </label>

            <label style={labelStyle}>
              Company / Make *
              <select
                style={inputStyle}
                name="company"
                value={form.company}
                onChange={handleChange}
                required
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Model *
              <input
                style={inputStyle}
                name="model_name"
                value={form.model_name}
                onChange={handleChange}
                placeholder="e.g. X5 xDrive40i"
                required
              />
            </label>

            <label style={labelStyle}>
              Price (USD) *
              <input
                style={inputStyle}
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                placeholder="e.g. 45000"
                required
              />
            </label>

            <label style={labelStyle}>
              Model Year *
              <input
                style={inputStyle}
                name="year"
                type="number"
                min="1900"
                max="2100"
                value={form.year}
                onChange={handleChange}
                placeholder="e.g. 2022"
                required
              />
            </label>

            <label style={labelStyle}>
              Mileage (miles) *
              <input
                style={inputStyle}
                name="km_driven"
                type="number"
                min="0"
                value={form.km_driven}
                onChange={handleChange}
                placeholder="Enter mileage in miles"
                required
              />
            </label>

            <label style={labelStyle}>
              Vehicle Category *
              <select
                style={inputStyle}
                name="category"
                value={form.category}
                onChange={handleChange}
                required
              >
                <option value="Car">Car</option>
                <option value="Bike">Bike</option>
                <option value="Truck">Truck</option>
              </select>
            </label>

            <label style={labelStyle}>
              Ownership *
              <select
                style={inputStyle}
                name="owner"
                value={form.owner}
                onChange={handleChange}
                required
              >
                <option value="1st Owner">1st Owner</option>
                <option value="2nd Owner">2nd Owner</option>
                <option value="3rd Owner">3rd Owner</option>
                <option value="Single Owner - USA Clean Title">
                  Single Owner - USA Clean Title
                </option>
                <option value="2 Owners - US">2 Owners - US</option>
              </select>
            </label>
          </div>

          <label style={labelStyle}>
            Vehicle Description *
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe condition, features, service history and other details..."
              required
            />
          </label>

          <div style={styles.formGrid}>
            <label style={labelStyle}>
              Main Vehicle Image *
              <input
                id="seller-main-image"
                style={inputStyle}
                type="file"
                accept="image/*"
                onChange={handleMainImageChange}
                required
              />
              <small style={{ color: '#777', fontWeight: 400 }}>
                Required. This is the primary listing image.
              </small>
            </label>

            <label style={labelStyle}>
              Additional Images
              <input
                id="seller-gallery-images"
                style={inputStyle}
                type="file"
                accept="image/*"
                multiple
                onChange={handleGalleryChange}
              />
              <small style={{ color: '#777', fontWeight: 400 }}>
                Optional. Maximum 14 additional images.
              </small>
            </label>
          </div>

          {(mainImage || galleryImages.length > 0) && (
            <div style={{ marginBottom: 20, color: '#555', fontSize: 14 }}>
              Main image: {mainImage?.name || 'Not selected'}
              <br />
              Additional images: {galleryImages.length}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...buttonStyle,
              minWidth: 190,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting Listing...' : 'Submit Vehicle for Approval'}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.kicker}>YOUR INVENTORY</div>
            <h2 style={{ margin: '7px 0' }}>My Vehicle Listings</h2>
          </div>

          <button
            type="button"
            onClick={refreshListings}
            style={styles.secondaryButton}
          >
            ↻ Refresh
          </button>
        </div>

        {dataLoading ? (
          <p>Loading your vehicle listings...</p>
        ) : vehicles.length === 0 ? (
          <div style={styles.empty}>
            <h3>No vehicle listings yet</h3>
            <p>Add your first vehicle using the form above.</p>
          </div>
        ) : (
          <div style={styles.listingGrid}>
            {vehicles.map((vehicle) => (
              <article key={vehicle.id} style={styles.listingCard}>
                {vehicle.image ? (
                  <img
                    src={imageUrl(vehicle.image)}
                    alt={vehicle.title}
                    style={styles.vehicleImage}
                  />
                ) : (
                  <div style={styles.imagePlaceholder}>AUTOZ</div>
                )}

                <div style={{ padding: 18 }}>
                  <div style={styles.listingTop}>
                    <span style={styles.status(vehicle.listing_status)}>
                      {vehicle.listing_status || 'PENDING'}
                    </span>
                    <span style={{ color: '#777', fontSize: 12 }}>
                      ID #{vehicle.id}
                    </span>
                  </div>

                  <h3 style={{ margin: '12px 0 7px' }}>
                    {vehicle.title}
                  </h3>

                  <p style={{ color: '#777', margin: '0 0 8px' }}>
                    {vehicle.company_name || 'Vehicle'} · {vehicle.year}
                  </p>

                  <strong style={{ fontSize: 19 }}>
                    {formatPrice(vehicle.price)}
                  </strong>

                  {vehicle.listing_status === 'REJECTED' &&
                    vehicle.rejection_reason && (
                      <div style={styles.rejection}>
                        <strong>Admin feedback</strong>
                        <p style={{ margin: '5px 0 0' }}>
                          {vehicle.rejection_reason}
                        </p>
                      </div>
                    )}

                  <div style={styles.listingActions}>
                    <button
                      type="button"
                      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                      style={styles.secondaryButton}
                    >
                      View
                    </button>

                    {(vehicle.listing_status === 'PENDING' ||
                      vehicle.listing_status === 'REJECTED') && (
                      <button
                        type="button"
                        onClick={() => handleDelete(vehicle)}
                        style={styles.deleteButton}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} AutoZ Seller Portal
      </footer>
    </div>
  )
}

// -------------------------------------
// STYLES
// -------------------------------------

const styles = {
  centerPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f4f5f7',
    color: '#171717',
  },

  loginPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    background: '#f4f5f7',
    color: '#171717',
  },

  loginCard: {
    width: '100%',
    maxWidth: 430,
    boxSizing: 'border-box',
    background: '#fff',
    padding: 32,
    borderRadius: 14,
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },

  kicker: {
    color: '#a67c18',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 2,
  },

  backButton: {
    width: '100%',
    marginTop: 18,
    padding: 11,
    border: '1px solid #ddd',
    borderRadius: 7,
    background: '#fff',
    cursor: 'pointer',
  },

  dashboard: {
    minHeight: '100vh',
    padding: '35px 5%',
    background: '#f4f5f7',
    color: '#171717',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 28,
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },

  darkButton: {
    padding: '11px 16px',
    border: 'none',
    borderRadius: 7,
    background: '#171717',
    color: '#fff',
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '10px 15px',
    border: '1px solid #ddd',
    borderRadius: 7,
    background: '#fff',
    color: '#171717',
    cursor: 'pointer',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },

  statCard: {
    padding: 22,
    background: '#fff',
    borderRadius: 11,
    boxShadow: '0 3px 14px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    color: '#777',
  },

  panel: {
    background: '#fff',
    borderRadius: 12,
    padding: 26,
    marginBottom: 25,
    boxShadow: '0 3px 14px rgba(0,0,0,0.04)',
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 24,
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '0 18px',
  },

  error: {
    padding: 13,
    marginBottom: 20,
    borderRadius: 7,
    background: '#fff0ef',
    border: '1px solid #ffc9c5',
    color: '#b42318',
    overflowWrap: 'anywhere',
  },

  success: {
    padding: 13,
    marginBottom: 20,
    borderRadius: 7,
    background: '#edf9f0',
    border: '1px solid #b8e5c2',
    color: '#18753a',
  },

  empty: {
    padding: 35,
    textAlign: 'center',
    background: '#fafafa',
    borderRadius: 9,
    color: '#777',
  },

  listingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 20,
  },

  listingCard: {
    border: '1px solid #eee',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
  },

  vehicleImage: {
    width: '100%',
    height: 190,
    objectFit: 'cover',
    display: 'block',
    background: '#eee',
  },

  imagePlaceholder: {
    height: 190,
    display: 'grid',
    placeItems: 'center',
    background: '#e9e9e9',
    color: '#999',
    fontWeight: 800,
    letterSpacing: 3,
  },

  listingTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  status: (value) => ({
    padding: '6px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    background:
      value === 'APPROVED'
        ? '#e8f6ed'
        : value === 'REJECTED'
          ? '#fff0ef'
          : '#fff6df',
    color:
      value === 'APPROVED'
        ? '#18753a'
        : value === 'REJECTED'
          ? '#b42318'
          : '#946200',
  }),

  rejection: {
    marginTop: 13,
    padding: 11,
    borderRadius: 7,
    background: '#fff0ef',
    color: '#a12620',
    fontSize: 13,
  },

  listingActions: {
    display: 'flex',
    gap: 9,
    marginTop: 17,
  },

  deleteButton: {
    padding: '10px 15px',
    border: '1px solid #f0c5c2',
    borderRadius: 7,
    background: '#fff',
    color: '#b42318',
    cursor: 'pointer',
  },

  footer: {
    padding: 20,
    textAlign: 'center',
    color: '#888',
    fontSize: 13,
  },
}

export default SellerPortal