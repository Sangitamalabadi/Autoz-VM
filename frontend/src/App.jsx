

import { useEffect, useMemo, useState } from 'react'

import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
  Link,
} from 'react-router-dom'

import api, {
  initializeCSRF,
  BACKEND_URL,
} from './api'

import VehicleDetails from './VehicleDetails'
import './App.css'
import BuyerMyBids from './BuyerMyBids'

const MAX_IMAGES = 15


// =====================================================
// COMMON HELPERS
// =====================================================
function getImageUrl(image) {
  if (!image) return ''

  const normalized = String(image).replace(/\\/g, '/')
  const filename = normalized.split('/').pop()

  if (/^[1-7]\.webp$/i.test(filename) && normalized.includes('vehicles')) {
    return `/vehicles/${filename}`
  }

  if (/^https?:\/\//i.test(normalized)) return normalized

  return `${BACKEND_URL}${normalized.startsWith('/') ? '' : '/'}${normalized}`
}

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(price || 0))
}

function formatBidDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data

  if (typeof data?.message === 'string') return data.message
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.error === 'string') return data.error

  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([field, messages]) => {
        const value = Array.isArray(messages)
          ? messages.join(', ')
          : String(messages)

        return `${field}: ${value}`
      })
      .join(' | ') || fallback
  }

  return error?.message || fallback
}

async function getCSRFHeaders() {
  const token = await initializeCSRF()

  if (!token) {
    throw new Error('Unable to obtain CSRF token. Please refresh the page.')
  }

  return { 'X-CSRFToken': token }
}



// =====================================================
// SELLER LOGIN
// =====================================================

function SellerLoginPanel({ onLogin, onCancel, onRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (loading) return

    setError('')

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    setLoading(true)

    try {
      const headers = await getCSRFHeaders()

      const response = await api.post(
        'auth/login/',
        {
          username: username.trim(),
          password,
        },
        {
          headers,
          withCredentials: true,
        }
      )

      if (response.data?.success && response.data?.user) {
        onLogin(response.data.user)
      } else {
        setError(
          response.data?.message ||
          response.data?.detail ||
          'Seller login was unsuccessful.'
        )
      }
    } catch (err) {
      console.error('SELLER LOGIN ERROR:', err)
      setError(getErrorMessage(err, 'Unable to login as Seller.'))

      if (err.response?.status === 401) {
        setError('Invalid username or password.')
      } else if (err.response?.status === 403) {
        setError('Seller access required. Please use a Seller account.')
      } else if (err.response?.status === 404) {
        setError('Seller login API not found. Check the backend URL.')
      } else if (err.response?.status === 500) {
        setError('Server error. Please check the Django terminal.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="seller-login"
      style={{
        maxWidth: '460px',
        margin: '35px auto',
        padding: '30px',
        background: '#fff',
        color: '#171717',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ color: '#a67c18', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px' }}>
        AUTOZ SELLER PORTAL
      </div>

      <h2 style={{ margin: '10px 0' }}>Seller Login</h2>

      <p style={{ color: '#666', marginBottom: '24px' }}>
        Sign in to manage your vehicle listings and sales.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="seller-username" style={{ display: 'block', marginBottom: '7px' }}>
          Username
        </label>

        <input
          id="seller-username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Enter your Seller username"
          autoComplete="username"
          required
          style={authInputStyle}
        />

        <label htmlFor="seller-password" style={{ display: 'block', marginBottom: '7px' }}>
          Password
        </label>

        <input
          id="seller-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          style={authInputStyle}
        />

        {error && <p role="alert" style={errorStyle}>{error}</p>}

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in...' : 'Login as Seller'}
        </button>

              <p
          style={{
            textAlign: 'center',
            marginTop: '18px',
            color: '#555',
            fontSize: '14px',
          }}
        >
          New seller?{' '}
          <button
            type="button"
            onClick={onRegister}
            style={textButtonStyle}
          >
            Create Seller Account
          </button>
        </p>

        <button
          type="button"
          onClick={onCancel}
          style={secondaryButtonStyle}
        >
          Back to Marketplace
        </button>
      </form>
    </section>
  )
}

// =====================================================
// SELLER DASHBOARD - UPDATED AUTOZ PREMIUM VERSION
// =====================================================

function SellerDashboard({ seller, onLogout }) {
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [companies, setCompanies] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Edit listing states
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Image management states
  const [imageVehicle, setImageVehicle] = useState(null)
  const [newImages, setNewImages] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState(null)

  const [form, setForm] = useState({
    title: '',
    company: '',
    model_name: '',
    price: '',
    year: '',
    miles: '',
    category: 'Car',
    description: '',
    owner: '1st Owner',
  })

  const [images, setImages] = useState([])

  const [editForm, setEditForm] = useState({
    title: '',
    company: '',
    model_name: '',
    price: '',
    year: '',
    miles: '',
    category: 'Car',
    description: '',
    owner: '1st Owner',
  })

  // ---------------------------------------------------
  // COMMON STYLES
  // ---------------------------------------------------

  const colors = {
    navy: '#101827',
    navyLight: '#1d2939',
    gold: '#d6a52c',
    goldLight: '#fff5d8',
    background: '#f4f6fa',
    text: '#172033',
    muted: '#667085',
    border: '#e5e7eb',
    white: '#ffffff',
    red: '#c62828',
    redLight: '#fff0f0',
    green: '#18733b',
    greenLight: '#e9f7ef',
    orange: '#946200',
    orangeLight: '#fff5dc',
  }

  const cardStyle = {
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: '15px',
    padding: '22px',
    boxShadow: '0 5px 20px rgba(16,24,39,0.045)',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 13px',
    border: `1px solid ${colors.border}`,
    borderRadius: '9px',
    fontSize: '14px',
    color: colors.text,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '700',
    marginBottom: '7px',
    color: colors.text,
  }

  const goldButton = {
    background: colors.gold,
    color: '#151515',
    border: '1px solid #c18c12',
    padding: '11px 17px',
    borderRadius: '9px',
    fontWeight: '700',
    cursor: 'pointer',
  }

  const darkButton = {
    background: colors.navy,
    color: '#fff',
    border: `1px solid ${colors.navy}`,
    padding: '11px 17px',
    borderRadius: '9px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  const lightButton = {
    background: '#fff',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    padding: '10px 15px',
    borderRadius: '9px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  const dangerButton = {
    background: '#fff',
    color: colors.red,
    border: '1px solid #e5a1a1',
    padding: '10px 15px',
    borderRadius: '9px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  const formGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '17px',
  }

  // ---------------------------------------------------
  // LOAD SELLER LISTINGS
  // ---------------------------------------------------

  const loadListings = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      setError('')

      const response = await api.get('vehicles/my-listings/')
      const data = response.data?.results || response.data

      setListings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('SELLER LISTINGS ERROR:', err)

      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Your Seller session has expired. Please log in again.')
      } else {
        setError(getErrorMessage(err, 'Unable to load your vehicle listings.'))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ---------------------------------------------------
  // LOAD COMPANIES
  // ---------------------------------------------------

  useEffect(() => {
    let mounted = true

    async function loadCompanies() {
      try {
        const response = await api.get('companies/')
        const data = response.data?.results || response.data

        if (mounted) {
          setCompanies(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('COMPANY LIST ERROR:', err)
      }
    }

    loadCompanies()
    loadListings()

    return () => {
      mounted = false
    }
  }, [])

  // ---------------------------------------------------
  // COMMON HELPERS
  // ---------------------------------------------------

  const getVehicleImages = (vehicle) => {
    return Array.isArray(vehicle?.additional_images)
      ? vehicle.additional_images
      : []
  }

  const getTotalImageCount = (vehicle) => {
    return (vehicle?.image ? 1 : 0) + getVehicleImages(vehicle).length
  }

  const formatStatus = (status) => {
    if (status === 'APPROVED') return 'Approved'
    if (status === 'REJECTED') return 'Rejected'
    return 'Pending'
  }

  const getStatusColors = (status) => {
    if (status === 'APPROVED') {
      return { background: '#e8f7ed', color: '#18733b' }
    }

    if (status === 'REJECTED') {
      return { background: '#fff0f0', color: '#b42318' }
    }

    return { background: '#fff5dc', color: '#946200' }
  }

  const statusBadge = (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    ...getStatusColors(status),
  })

  const validateVehicleForm = (data) => {
    if (!data.title.trim()) return 'Vehicle title is required.'
    if (!data.company) return 'Please select a vehicle brand.'
    if (!data.model_name.trim()) return 'Vehicle model is required.'

    if (
      !data.price ||
      !Number.isFinite(Number(data.price)) ||
      Number(data.price) <= 0
    ) {
      return 'Please enter a valid vehicle price.'
    }

    if (
      !data.year ||
      Number(data.year) < 1900 ||
      Number(data.year) > 2100
    ) {
      return 'Please enter a valid manufacturing year.'
    }

    if (
      data.miles === '' ||
      !Number.isFinite(Number(data.miles)) ||
      Number(data.miles) < 0
    ) {
      return 'Please enter valid mileage in miles.'
    }

    return ''
  }

  const getMilesFromVehicle = (vehicle) => {
    return Math.round(Number(vehicle?.km_driven || 0) * 0.621371)
  }

  const getCompanyId = (vehicle) => {
    if (vehicle.company && typeof vehicle.company === 'object') {
      return String(vehicle.company.id || '')
    }

    if (vehicle.company) return String(vehicle.company)
    if (vehicle.company_id) return String(vehicle.company_id)

    const matchingCompany = companies.find(
      (company) => company.name === vehicle.company_name
    )

    return matchingCompany ? String(matchingCompany.id) : ''
  }

  // ---------------------------------------------------
  // ADD VEHICLE FORM HANDLERS
  // ---------------------------------------------------

  const updateForm = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleImageChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])

    if (selectedFiles.length > MAX_IMAGES) {
      setError(`You can select a maximum of ${MAX_IMAGES} images.`)
      setImages(selectedFiles.slice(0, MAX_IMAGES))
      event.target.value = ''
      return
    }

    const invalidFile = selectedFiles.find(
      (file) => !file.type.startsWith('image/')
    )

    if (invalidFile) {
      setError('Please select image files only.')
      setImages([])
      event.target.value = ''
      return
    }

    setError('')
    setImages(selectedFiles)
  }

  const resetVehicleForm = () => {
    setForm({
      title: '',
      company: '',
      model_name: '',
      price: '',
      year: '',
      miles: '',
      category: 'Car',
      description: '',
      owner: '1st Owner',
    })

    setImages([])
  }

  // ---------------------------------------------------
  // CREATE VEHICLE LISTING
  // ---------------------------------------------------

  const handleCreateListing = async (event) => {
    event.preventDefault()

    if (submitting) return

    setError('')
    setSuccess('')

    const validationError = validateVehicleForm(form)

    if (validationError) {
      setError(validationError)
      return
    }

    if (images.length === 0) {
      setError('Please upload at least one vehicle image.')
      return
    }

    if (images.length > MAX_IMAGES) {
      setError(`A maximum of ${MAX_IMAGES} images is allowed.`)
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()

      formData.append('title', form.title.trim())
      formData.append('company', form.company)
      formData.append('model_name', form.model_name.trim())
      formData.append('price', form.price)
      formData.append('year', form.year)

      const kilometres = Math.round(Number(form.miles) * 1.60934)
      formData.append('km_driven', String(kilometres))

      formData.append('category', form.category)
      formData.append('description', form.description.trim())
      formData.append('owner', form.owner)

      formData.append('image', images[0])

      images.slice(1).forEach((file) => {
        formData.append('images', file)
      })

      const headers = await getCSRFHeaders()

      const response = await api.post(
        'vehicles/create/',
        formData,
        {
          headers,
          withCredentials: true,
        }
      )

      setSuccess(
        response.data?.message ||
        'Vehicle submitted successfully. Your listing is pending admin approval.'
      )

      resetVehicleForm()
      setShowAddForm(false)

      await loadListings(true)
    } catch (err) {
      console.error('CREATE VEHICLE ERROR:', err)
      console.error('CREATE VEHICLE RESPONSE:', err.response?.data)

      setError(getErrorMessage(err, 'Unable to create vehicle listing.'))

      if (err.response?.status === 401) {
        setError('Please log in again to create a vehicle listing.')
      } else if (err.response?.status === 403) {
        setError('Only authenticated Sellers can create vehicle listings.')
      }
    } finally {
      setSubmitting(false)
    }
  }
// ---------------------------------------------------
// OPEN EDIT LISTING - SEPARATE EDIT PAGE
// ---------------------------------------------------

const openEditListing = (vehicle) => {
  setError('')
  setSuccess('')
  setImageVehicle(null)
  setShowAddForm(false)

  navigate(`/seller/edit/${vehicle.id}`, {
    state: { vehicle },
  })
}

  // ---------------------------------------------------
  // UPDATE VEHICLE LISTING
  // ---------------------------------------------------

  const handleUpdateListing = async (event) => {
    event.preventDefault()

    if (!editingVehicle || editSubmitting) return

    setError('')
    setSuccess('')

    const validationError = validateVehicleForm(editForm)

    if (validationError) {
      setError(validationError)
      return
    }

    setEditSubmitting(true)

    try {
      const kilometres = Math.round(Number(editForm.miles) * 1.60934)

      const payload = {
        title: editForm.title.trim(),
        company: editForm.company,
        model_name: editForm.model_name.trim(),
        price: editForm.price,
        year: Number(editForm.year),
        km_driven: kilometres,
        category: editForm.category,
        description: editForm.description.trim(),
        owner: editForm.owner,
      }

      const headers = await getCSRFHeaders()

      const response = await api.patch(
        `vehicles/${editingVehicle.id}/update/`,
        payload,
        {
          headers,
          withCredentials: true,
        }
      )

      const wasRejected = editingVehicle.listing_status === 'REJECTED'

      setEditingVehicle(null)

      setSuccess(
        response.data?.message ||
        (
          wasRejected
            ? 'Listing updated successfully and submitted again for admin approval.'
            : 'Vehicle listing updated successfully.'
        )
      )

      await loadListings(true)
    } catch (err) {
      console.error('UPDATE LISTING ERROR:', err)
      console.error('UPDATE LISTING RESPONSE:', err.response?.data)

      setError(
        getErrorMessage(
          err,
          'Unable to update vehicle listing. Please check whether the listing has bid history.'
        )
      )
    } finally {
      setEditSubmitting(false)
    }
  }

  // ---------------------------------------------------
  // OPEN IMAGE MANAGEMENT
  // ---------------------------------------------------

  const openImageManager = (vehicle) => {
    setError('')
    setSuccess('')
    setEditingVehicle(null)
    setNewImages([])
    setImageVehicle(vehicle)
    setShowAddForm(false)
  }

  const handleNewImagesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])

    const currentCount = getTotalImageCount(imageVehicle)
    const availableSlots = MAX_IMAGES - currentCount

    if (availableSlots <= 0) {
      setError(`This listing already has the maximum ${MAX_IMAGES} images.`)
      setNewImages([])
      event.target.value = ''
      return
    }

    if (selectedFiles.length > availableSlots) {
      setError(
        `You can add only ${availableSlots} more image(s). Maximum ${MAX_IMAGES} images allowed.`
      )
      setNewImages(selectedFiles.slice(0, availableSlots))
      event.target.value = ''
      return
    }

    const invalidFile = selectedFiles.find(
      (file) => !file.type.startsWith('image/')
    )

    if (invalidFile) {
      setError('Please select image files only.')
      setNewImages([])
      event.target.value = ''
      return
    }

    setError('')
    setNewImages(selectedFiles)
  }

  // ---------------------------------------------------
  // UPLOAD ADDITIONAL VEHICLE IMAGES
  // ---------------------------------------------------

  const handleUploadImages = async () => {
    if (!imageVehicle || newImages.length === 0 || uploadingImages) return

    const currentCount = getTotalImageCount(imageVehicle)

    if (currentCount + newImages.length > MAX_IMAGES) {
      setError(`A maximum of ${MAX_IMAGES} images is allowed.`)
      return
    }

    setUploadingImages(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()

      newImages.forEach((file) => {
        formData.append('images', file)
      })

      const headers = await getCSRFHeaders()

      await api.post(
        `vehicles/${imageVehicle.id}/images/`,
        formData,
        {
          headers,
          withCredentials: true,
        }
      )

      setNewImages([])
      setSuccess(
        'Images uploaded successfully. If this listing was approved, image changes may require admin re-approval.'
      )

      await loadListings(true)

      const response = await api.get('vehicles/my-listings/')
      const data = response.data?.results || response.data
      const updatedListings = Array.isArray(data) ? data : []

      setListings(updatedListings)

      const updatedVehicle = updatedListings.find(
        (item) => item.id === imageVehicle.id
      )

      if (updatedVehicle) {
        setImageVehicle(updatedVehicle)
      }
    } catch (err) {
      console.error('IMAGE UPLOAD ERROR:', err)
      console.error('IMAGE UPLOAD RESPONSE:', err.response?.data)

      setError(
        getErrorMessage(err, 'Unable to upload vehicle images.')
      )
    } finally {
      setUploadingImages(false)
    }
  }

  // ---------------------------------------------------
  // DELETE ADDITIONAL IMAGE
  // ---------------------------------------------------

  const handleDeleteImage = async (imageId) => {
    if (!imageVehicle || deletingImageId) return

    const confirmed = window.confirm(
      'Are you sure you want to remove this vehicle image?'
    )

    if (!confirmed) return

    setDeletingImageId(imageId)
    setError('')
    setSuccess('')

    try {
      const headers = await getCSRFHeaders()

      await api.delete(
        `vehicles/${imageVehicle.id}/images/${imageId}/delete/`,
        {
          headers,
          withCredentials: true,
        }
      )

      setSuccess('Vehicle image removed successfully.')

      await loadListings(true)

      const response = await api.get('vehicles/my-listings/')
      const data = response.data?.results || response.data
      const updatedListings = Array.isArray(data) ? data : []

      setListings(updatedListings)

      const updatedVehicle = updatedListings.find(
        (item) => item.id === imageVehicle.id
      )

      if (updatedVehicle) {
        setImageVehicle(updatedVehicle)
      } else {
        setImageVehicle(null)
      }
    } catch (err) {
      console.error('IMAGE DELETE ERROR:', err)
      console.error('IMAGE DELETE RESPONSE:', err.response?.data)

      setError(
        getErrorMessage(err, 'Unable to remove this vehicle image.')
      )
    } finally {
      setDeletingImageId(null)
    }
  }

  // ---------------------------------------------------
  // DELETE LISTING
  // ---------------------------------------------------

  const handleDeleteListing = async (vehicleId) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this vehicle listing? This action cannot be undone.'
    )

    if (!confirmed) return

    setDeletingId(vehicleId)
    setError('')
    setSuccess('')

    try {
      const headers = await getCSRFHeaders()

      await api.delete(
        `vehicles/${vehicleId}/delete/`,
        {
          headers,
          withCredentials: true,
        }
      )

      setSuccess('Vehicle listing deleted successfully.')

      if (imageVehicle?.id === vehicleId) setImageVehicle(null)
      if (editingVehicle?.id === vehicleId) setEditingVehicle(null)

      await loadListings(true)
    } catch (err) {
      console.error('DELETE LISTING ERROR:', err)

      setError(
        getErrorMessage(
          err,
          'Unable to delete this listing. It may have auction or bid history.'
        )
      )
    } finally {
      setDeletingId(null)
    }
  }

  // ---------------------------------------------------
  // DASHBOARD COUNTS
  // ---------------------------------------------------

  const pendingCount = listings.filter(
    (item) => item.listing_status === 'PENDING'
  ).length

  const approvedCount = listings.filter(
    (item) => item.listing_status === 'APPROVED'
  ).length

  const rejectedCount = listings.filter(
    (item) => item.listing_status === 'REJECTED'
  ).length

  const filteredListings = listings.filter((item) => {
    if (statusFilter === 'ALL') return true
    return item.listing_status === statusFilter
  })

  // ---------------------------------------------------
  // REUSABLE FORM FIELD
  // ---------------------------------------------------

  const renderVehicleFields = (data, onChange) => (
    <div style={formGrid}>
      <div>
        <label style={labelStyle}>Vehicle Title *</label>
        <input
          name="title"
          value={data.title}
          onChange={onChange}
          placeholder="2022 BMW X5 xDrive40i"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Vehicle Brand *</label>
        <select
          name="company"
          value={data.company}
          onChange={onChange}
          required
          style={inputStyle}
        >
          <option value="">Select Brand</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Model *</label>
        <input
          name="model_name"
          value={data.model_name}
          onChange={onChange}
          placeholder="X5 xDrive40i"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Price (USD) *</label>
        <input
          name="price"
          type="number"
          min="0.01"
          step="0.01"
          value={data.price}
          onChange={onChange}
          placeholder="45000"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Manufacturing Year *</label>
        <input
          name="year"
          type="number"
          min="1900"
          max="2100"
          value={data.year}
          onChange={onChange}
          placeholder="2022"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Mileage (Miles) *</label>
        <input
          name="miles"
          type="number"
          min="0"
          value={data.miles}
          onChange={onChange}
          placeholder="25000"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Vehicle Category *</label>
        <select
          name="category"
          value={data.category}
          onChange={onChange}
          style={inputStyle}
        >
          <option value="Car">Car</option>
          <option value="Bike">Bike</option>
          <option value="Truck">Truck</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>Ownership *</label>
        <select
          name="owner"
          value={data.owner}
          onChange={onChange}
          style={inputStyle}
        >
          <option value="1st Owner">1st Owner</option>
          <option value="2nd Owner">2nd Owner</option>
          <option value="3rd Owner">3rd Owner</option>
          <option value="Single Owner - USA Clean Title">
            Single Owner - USA Clean Title
          </option>
          <option value="2 Owners - US">2 Owners - US</option>
        </select>
      </div>
    </div>
  )

  // ---------------------------------------------------
  // DASHBOARD UI
  // ---------------------------------------------------

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        color: colors.text,
        padding: '30px 4%',
        boxSizing: 'border-box',
      }}
    >
      {/* HEADER */}

      <header
        style={{
          background: colors.navy,
          color: '#fff',
          padding: '23px 26px',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '25px',
          boxShadow: '0 8px 25px rgba(16,24,39,0.13)',
        }}
      >
        <div>
          <div
            style={{
              color: colors.gold,
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '2px',
            }}
          >
            AUTOZ SELLER PORTAL
          </div>

          <h1 style={{ margin: '8px 0', fontSize: '28px' }}>
            Seller Dashboard
          </h1>

          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px' }}>
            Welcome, {seller?.username || 'Seller'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadListings(true)}
            disabled={refreshing}
            style={{
              ...lightButton,
              background: 'transparent',
              color: '#fff',
              borderColor: '#64748b',
            }}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>

          <button
            type="button"
            onClick={onLogout}
            style={{
              ...goldButton,
              background: 'transparent',
              color: '#fff',
              borderColor: colors.gold,
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* SUMMARY CARDS */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '16px',
          marginBottom: '23px',
        }}
      >
        {[
          {
            label: 'Total Listings',
            value: listings.length,
            icon: '🚘',
            color: colors.navy,
          },
          {
            label: 'Pending Approval',
            value: pendingCount,
            icon: '◷',
            color: '#946200',
          },
          {
            label: 'Approved Listings',
            value: approvedCount,
            icon: '✓',
            color: '#18733b',
          },
          {
            label: 'Rejected Listings',
            value: rejectedCount,
            icon: '✕',
            color: '#b42318',
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              ...cardStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
            }}
          >
            <div
              style={{
                width: '47px',
                height: '47px',
                borderRadius: '13px',
                display: 'grid',
                placeItems: 'center',
                background: '#f4f5f7',
                color: item.color,
                fontSize: '23px',
                fontWeight: '800',
              }}
            >
              {item.icon}
            </div>

            <div>
              <p
                style={{
                  margin: 0,
                  color: colors.muted,
                  fontSize: '13px',
                }}
              >
                {item.label}
              </p>

              <h2 style={{ margin: '5px 0 0', fontSize: '27px' }}>
                {item.value}
              </h2>
            </div>
          </div>
        ))}
      </div>

      {/* ALERTS */}

      {error && (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            background: colors.redLight,
            border: '1px solid #f2b7b7',
            borderRadius: '10px',
            color: colors.red,
            marginBottom: '17px',
            fontSize: '14px',
          }}
        >
          <strong>Attention: </strong>{error}
          <button
            type="button"
            onClick={() => setError('')}
            style={{
              float: 'right',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: colors.red,
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: '14px 16px',
            background: colors.greenLight,
            border: '1px solid #b7e4c7',
            borderRadius: '10px',
            color: colors.green,
            marginBottom: '17px',
            fontSize: '14px',
          }}
        >
          <strong>Success: </strong>{success}
          <button
            type="button"
            onClick={() => setSuccess('')}
            style={{
              float: 'right',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: colors.green,
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* MANAGE VEHICLES HEADER */}

      <section
        style={{
          ...cardStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '23px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '22px' }}>
            Manage Your Vehicles
          </h2>
          <p style={{ margin: 0, color: colors.muted, fontSize: '14px' }}>
            Add, edit and manage your vehicle inventory.
          </p>
        </div>

        <button
          type="button"
          style={goldButton}
          onClick={() => {
            setShowAddForm((previous) => !previous)
            setEditingVehicle(null)
            setImageVehicle(null)
            setError('')
            setSuccess('')
          }}
        >
          {showAddForm ? 'Close Form' : '+ Add New Vehicle'}
        </button>
      </section>

      {/* ADD VEHICLE FORM */}

      {showAddForm && (
        <section style={{ ...cardStyle, marginBottom: '23px' }}>
          <h2 style={{ marginTop: 0 }}>Add New Vehicle</h2>

          <p style={{ color: colors.muted, fontSize: '14px' }}>
            Complete all required information. Your new listing will be
            submitted for admin approval.
          </p>

          <form onSubmit={handleCreateListing}>
            {renderVehicleFields(form, updateForm)}

            <div style={{ marginTop: '18px' }}>
              <label style={labelStyle}>Vehicle Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={updateForm}
                rows={4}
                placeholder="Describe vehicle condition, features, service history and title status..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginTop: '18px' }}>
              <label style={labelStyle}>
                Vehicle Images * (Maximum {MAX_IMAGES})
              </label>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                style={{ ...inputStyle, background: '#fafafa' }}
              />

              <p style={{ color: colors.muted, fontSize: '12px' }}>
                First selected image will be the main vehicle image.
              </p>

              {images.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '12px',
                    marginTop: '12px',
                  }}
                >
                  {images.map((file, index) => (
                    <div key={`${file.name}-${index}`}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Vehicle preview ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '85px',
                          objectFit: 'cover',
                          borderRadius: '9px',
                        }}
                      />
                      <small style={{ color: colors.muted }}>
                        {index === 0 ? 'Main Image' : `Image ${index + 1}`}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...goldButton,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>

              <button
                type="button"
                style={lightButton}
                onClick={() => {
                  resetVehicleForm()
                  setShowAddForm(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* EDIT LISTING PANEL */}

      {editingVehicle && (
        <section
          style={{
            ...cardStyle,
            marginBottom: '23px',
            borderTop: `4px solid ${colors.gold}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 5px' }}>✎ Edit Vehicle Listing</h2>
              <p style={{ color: colors.muted, fontSize: '13px', margin: 0 }}>
                Update the vehicle information below.
              </p>
            </div>

            <button
              type="button"
              style={lightButton}
              onClick={() => setEditingVehicle(null)}
            >
              ✕ Close
            </button>
          </div>

          {editingVehicle.listing_status === 'REJECTED' && (
            <div
              style={{
                background: colors.orangeLight,
                color: colors.orange,
                padding: '13px',
                borderRadius: '9px',
                marginBottom: '18px',
                fontSize: '13px',
              }}
            >
              <strong>Re-submission notice</strong>
              <p style={{ margin: '5px 0 0' }}>
                Updating this rejected listing will submit it again for admin
                approval, according to the existing backend workflow.
              </p>
            </div>
          )}

          <form onSubmit={handleUpdateListing}>
            {renderVehicleFields(editForm, updateEditForm)}

            <div style={{ marginTop: '18px' }}>
              <label style={labelStyle}>Vehicle Description</label>
              <textarea
                name="description"
                value={editForm.description}
                onChange={updateEditForm}
                rows={4}
                placeholder="Vehicle condition, features and service history..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={editSubmitting}
                style={{
                  ...goldButton,
                  opacity: editSubmitting ? 0.6 : 1,
                }}
              >
                {editSubmitting ? 'Updating...' : '✓ Update Listing'}
              </button>

              <button
                type="button"
                style={lightButton}
                onClick={() => setEditingVehicle(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* IMAGE MANAGEMENT PANEL */}

      {imageVehicle && (
        <section
          style={{
            ...cardStyle,
            marginBottom: '23px',
            borderTop: `4px solid ${colors.gold}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 5px' }}>▣ Manage Vehicle Images</h2>
              <p style={{ color: colors.muted, fontSize: '13px', margin: 0 }}>
                {imageVehicle.title}
              </p>
            </div>

            <button
              type="button"
              style={lightButton}
              onClick={() => {
                setImageVehicle(null)
                setNewImages([])
              }}
            >
              ✕ Close
            </button>
          </div>

          <div
            style={{
              background: '#f5f7fb',
              borderRadius: '9px',
              padding: '12px 15px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '13px',
            }}
          >
            <span>
              Images: <strong>{getTotalImageCount(imageVehicle)} / {MAX_IMAGES}</strong>
            </span>
            <span style={{ color: colors.muted }}>
              Main image is managed separately from gallery images.
            </span>
          </div>

          {/* MAIN IMAGE */}

          <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>
            Main Vehicle Image
          </h3>

          {imageVehicle.image ? (
            <div
              style={{
                width: '180px',
                maxWidth: '100%',
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '22px',
              }}
            >
              <img
                src={getImageUrl(imageVehicle.image)}
                alt="Main vehicle"
                style={{
                  width: '100%',
                  height: '115px',
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: colors.orange,
                }}
              >
                ★ Main Image
              </div>
            </div>
          ) : (
            <p style={{ color: colors.muted }}>No main image available.</p>
          )}

          {/* GALLERY IMAGES */}

          <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>
            Gallery Images
          </h3>

          {getVehicleImages(imageVehicle).length === 0 ? (
            <p style={{ color: colors.muted, fontSize: '13px' }}>
              No additional gallery images available.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '13px',
                marginBottom: '20px',
              }}
            >
              {getVehicleImages(imageVehicle).map((image, index) => (
                <div
                  key={image.id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <img
                    src={getImageUrl(image.image)}
                    alt={`Vehicle gallery ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '105px',
                      objectFit: 'cover',
                    }}
                  />

                  <div
                    style={{
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <small style={{ color: colors.muted }}>
                      Image {index + 2}
                    </small>

                    <button
                      type="button"
                      disabled={deletingImageId === image.id}
                      onClick={() => handleDeleteImage(image.id)}
                      style={{
                        ...dangerButton,
                        padding: '5px 8px',
                        fontSize: '11px',
                        opacity: deletingImageId === image.id ? 0.5 : 1,
                      }}
                    >
                      {deletingImageId === image.id ? '...' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* UPLOAD NEW IMAGES */}

          <div
            style={{
              padding: '17px',
              background: '#fafbfc',
              border: `1px dashed #b8c0cc`,
              borderRadius: '11px',
            }}
          >
            <label style={labelStyle}>Upload Additional Images</label>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleNewImagesChange}
              style={inputStyle}
            />

            <p style={{ color: colors.muted, fontSize: '12px' }}>
              You can upload up to {Math.max(0, MAX_IMAGES - getTotalImageCount(imageVehicle))} more image(s).
            </p>

            {newImages.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                {newImages.map((file, index) => (
                  <div key={`${file.name}-${index}`}>
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`New upload ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '75px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                      }}
                    />
                    <small style={{ color: colors.muted }}>
                      New {index + 1}
                    </small>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={uploadingImages || newImages.length === 0}
              onClick={handleUploadImages}
              style={{
                ...goldButton,
                marginTop: '15px',
                opacity: uploadingImages || newImages.length === 0 ? 0.5 : 1,
              }}
            >
              {uploadingImages ? 'Uploading...' : '↑ Upload Images'}
            </button>
          </div>

          <p
            style={{
              marginTop: '15px',
              fontSize: '12px',
              color: colors.muted,
            }}
          >
            Note: Image upload and removal are performed through your existing
            seller image APIs. The main image cannot be removed using the
            additional-image delete endpoint.
          </p>
        </section>
      )}

      {/* MY VEHICLE LISTINGS */}

      <section style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 5px', fontSize: '22px' }}>
              My Vehicle Listings
            </h2>
            <p style={{ color: colors.muted, margin: 0, fontSize: '13px' }}>
              Manage your vehicles and track their approval status.
            </p>
          </div>

          <span
            style={{
              background: '#f0f1f4',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {listings.length} Listings
          </span>
        </div>

        {/* FILTERS */}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '9px',
            marginBottom: '20px',
          }}
        >
          {[
            { label: 'All', value: 'ALL', count: listings.length },
            { label: 'Pending', value: 'PENDING', count: pendingCount },
            { label: 'Approved', value: 'APPROVED', count: approvedCount },
            { label: 'Rejected', value: 'REJECTED', count: rejectedCount },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              style={{
                padding: '9px 16px',
                borderRadius: '22px',
                border: statusFilter === filter.value
                  ? `1px solid ${colors.navy}`
                  : `1px solid ${colors.border}`,
                background: statusFilter === filter.value
                  ? colors.navy
                  : '#fff',
                color: statusFilter === filter.value ? '#fff' : colors.text,
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              }}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>

        {/* LOADING */}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 10px' }}>
            <p style={{ color: colors.muted }}>
              Loading your vehicle listings...
            </p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🚘</div>

            <h3 style={{ margin: '0 0 8px' }}>
              No {statusFilter === 'ALL'
                ? ''
                : formatStatus(statusFilter).toLowerCase()} listings found
            </h3>

            <p style={{ color: colors.muted, fontSize: '14px' }}>
              {statusFilter === 'ALL'
                ? 'Select Add New Vehicle to create your first listing.'
                : 'There are currently no vehicles in this status.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))',
              gap: '18px',
            }}
          >
            {filteredListings.map((vehicle) => {
              const status = vehicle.listing_status || 'PENDING'
              const canDelete = ['PENDING', 'REJECTED'].includes(status)
              const miles = getMilesFromVehicle(vehicle)
              const galleryCount = getVehicleImages(vehicle).length

              return (
                <article
                  key={vehicle.id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: '13px',
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '0 4px 14px rgba(16,24,39,0.04)',
                  }}
                >
                  {/* VEHICLE IMAGE */}

                  <div style={{ position: 'relative' }}>
                    {vehicle.image ? (
                      <img
                        src={getImageUrl(vehicle.image)}
                        alt={vehicle.title}
                        style={{
                          width: '100%',
                          height: '190px',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: '190px',
                          display: 'grid',
                          placeItems: 'center',
                          background: '#edf0f4',
                          color: colors.muted,
                        }}
                      >
                        AUTOZ
                      </div>
                    )}

                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        ...statusBadge(status),
                      }}
                    >
                      {formatStatus(status)}
                    </span>

                    <span
                      style={{
                        position: 'absolute',
                        right: '12px',
                        bottom: '12px',
                        background: 'rgba(16,24,39,0.8)',
                        color: '#fff',
                        padding: '5px 9px',
                        borderRadius: '20px',
                        fontSize: '11px',
                      }}
                    >
                      {getTotalImageCount(vehicle)} / {MAX_IMAGES} Images
                    </span>
                  </div>

                  {/* VEHICLE DETAILS */}

                  <div style={{ padding: '17px' }}>
                    <h3 style={{ margin: '0 0 7px', fontSize: '17px' }}>
                      {vehicle.title}
                    </h3>

                    <p
                      style={{
                        color: colors.muted,
                        margin: '0 0 12px',
                        fontSize: '13px',
                      }}
                    >
                      {vehicle.company_name || 'Vehicle'} · {vehicle.model_name || ''} · {vehicle.year || '—'}
                    </p>

                    <strong style={{ fontSize: '21px', color: colors.navy }}>
                      {formatPrice(vehicle.price)}
                    </strong>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginTop: '10px',
                        fontSize: '12px',
                        color: colors.muted,
                      }}
                    >
                      <span>◷ {miles.toLocaleString('en-US')} miles</span>
                      <span>▣ {galleryCount + (vehicle.image ? 1 : 0)} images</span>
                    </div>

                    {/* REJECTION FEEDBACK */}

                    {status === 'REJECTED' && (
                      <div
                        style={{
                          padding: '13px',
                          borderRadius: '9px',
                          background: colors.redLight,
                          border: '1px solid #f2caca',
                          marginTop: '15px',
                        }}
                      >
                        <div
                          style={{
                            color: colors.red,
                            fontWeight: '800',
                            fontSize: '13px',
                            marginBottom: '6px',
                          }}
                        >
                          ⚠ Admin Rejection Reason
                        </div>

                        <p
                          style={{
                            color: '#8f2929',
                            margin: 0,
                            fontSize: '13px',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {vehicle.rejection_reason ||
                            'No rejection reason was provided by the administrator.'}
                        </p>

                        <p
                          style={{
                            color: '#8f2929',
                            fontSize: '12px',
                            margin: '9px 0 0',
                            fontWeight: '600',
                          }}
                        >
                          Please update your listing and submit it again.
                        </p>
                      </div>
                    )}

                    {status === 'PENDING' && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '10px',
                          borderRadius: '8px',
                          background: colors.orangeLight,
                          color: colors.orange,
                          fontSize: '12px',
                        }}
                      >
                        ◷ Waiting for admin approval.
                      </div>
                    )}

                    {status === 'APPROVED' && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '10px',
                          borderRadius: '8px',
                          background: colors.greenLight,
                          color: colors.green,
                          fontSize: '12px',
                        }}
                      >
                        ✓ Your vehicle has been approved.
                      </div>
                    )}

                    {/* ACTION BUTTONS */}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '9px',
                        marginTop: '17px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openEditListing(vehicle)}
                        style={{
                          ...goldButton,
                          padding: '10px 7px',
                          fontSize: '12px',
                        }}
                      >
                        ✎ Edit Listing
                      </button>

                      <button
                        type="button"
                        onClick={() => openImageManager(vehicle)}
                        style={{
                          ...darkButton,
                          padding: '10px 7px',
                          fontSize: '12px',
                        }}
                      >
                        ▣ Manage Images
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteListing(vehicle.id)}
                          disabled={deletingId === vehicle.id}
                          style={{
                            ...dangerButton,
                            gridColumn: '1 / -1',
                            opacity: deletingId === vehicle.id ? 0.5 : 1,
                          }}
                        >
                          {deletingId === vehicle.id
                            ? 'Deleting...'
                            : 'Delete Listing'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* FOOTER */}

      <footer
        style={{
          textAlign: 'center',
          color: colors.muted,
          fontSize: '12px',
          marginTop: '25px',
          paddingBottom: '10px',
          letterSpacing: '0.5px',
        }}
      >
        AUTOZ SELLER PORTAL · UNITED STATES & UNITED KINGDOM
      </footer>
    </div>
  )
}




// =====================================================
// AUTOZ SELLER - SEPARATE EDIT VEHICLE PAGE
// =====================================================

function SellerEditPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()

  const [vehicle, setVehicle] = useState(
    location.state?.vehicle || null
  )

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    title: '',
    company: '',
    model_name: '',
    price: '',
    year: '',
    miles: '',
    category: 'Car',
    description: '',
    owner: '1st Owner',
  })

  const colors = {
    navy: '#101827',
    gold: '#d6a52c',
    background: '#f4f6fa',
    text: '#172033',
    muted: '#667085',
    border: '#e5e7eb',
    red: '#c62828',
    green: '#18733b',
  }

  const cardStyle = {
    background: '#fff',
    border: `1px solid ${colors.border}`,
    borderRadius: '16px',
    padding: '26px',
    boxShadow: '0 5px 20px rgba(16,24,39,0.05)',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 13px',
    border: `1px solid ${colors.border}`,
    borderRadius: '9px',
    fontSize: '14px',
    color: colors.text,
    background: '#fff',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '700',
    marginBottom: '7px',
    color: colors.text,
  }

  const buttonStyle = {
    background: colors.gold,
    color: '#151515',
    border: '1px solid #c18c12',
    padding: '12px 20px',
    borderRadius: '9px',
    fontWeight: '700',
    cursor: 'pointer',
  }

  // ---------------------------------------------------
  // LOAD VEHICLE AND COMPANIES
  // ---------------------------------------------------

  useEffect(() => {
    let mounted = true

    const loadPageData = async () => {
      try {
        setLoading(true)
        setError('')

        const [listResponse, companyResponse] = await Promise.all([
          api.get('vehicles/my-listings/'),
          api.get('companies/'),
        ])

        const listingData =
          listResponse.data?.results || listResponse.data

        const companyData =
          companyResponse.data?.results || companyResponse.data

        const allListings = Array.isArray(listingData)
          ? listingData
          : []

        const selectedVehicle = allListings.find(
          (item) => String(item.id) === String(id)
        )

        if (!selectedVehicle) {
          throw new Error('Vehicle listing was not found.')
        }

        if (!mounted) return

        setVehicle(selectedVehicle)
        setCompanies(
          Array.isArray(companyData) ? companyData : []
        )

        let companyId = ''

        if (
          selectedVehicle.company &&
          typeof selectedVehicle.company === 'object'
        ) {
          companyId = String(selectedVehicle.company.id || '')
        } else if (selectedVehicle.company) {
          companyId = String(selectedVehicle.company)
        } else if (selectedVehicle.company_id) {
          companyId = String(selectedVehicle.company_id)
        } else {
          const matchingCompany = companyData.find(
            (item) =>
              item.name === selectedVehicle.company_name
          )

          companyId = matchingCompany
            ? String(matchingCompany.id)
            : ''
        }

        setForm({
          title: selectedVehicle.title || '',
          company: companyId,
          model_name: selectedVehicle.model_name || '',
          price: selectedVehicle.price || '',
          year: selectedVehicle.year || '',
          miles: Math.round(
            Number(selectedVehicle.km_driven || 0) * 0.621371
          ),
          category: selectedVehicle.category || 'Car',
          description: selectedVehicle.description || '',
          owner: selectedVehicle.owner || '1st Owner',
        })
      } catch (err) {
        console.error('EDIT PAGE LOAD ERROR:', err)

        if (mounted) {
          setError(
            getErrorMessage(
              err,
              'Unable to load vehicle information.'
            )
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadPageData()

    return () => {
      mounted = false
    }
  }, [id])

  // ---------------------------------------------------
  // FORM HANDLER
  // ---------------------------------------------------

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  // ---------------------------------------------------
  // UPDATE VEHICLE
  // ---------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (submitting) return

    setError('')
    setSuccess('')

    if (!form.title.trim()) {
      setError('Vehicle title is required.')
      return
    }

    if (!form.company) {
      setError('Please select a vehicle brand.')
      return
    }

    if (!form.model_name.trim()) {
      setError('Vehicle model is required.')
      return
    }

    if (
      !form.price ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) <= 0
    ) {
      setError('Please enter a valid vehicle price.')
      return
    }

    if (
      !form.year ||
      Number(form.year) < 1900 ||
      Number(form.year) > 2100
    ) {
      setError('Please enter a valid manufacturing year.')
      return
    }

    if (
      form.miles === '' ||
      !Number.isFinite(Number(form.miles)) ||
      Number(form.miles) < 0
    ) {
      setError('Please enter valid mileage in miles.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        title: form.title.trim(),
        company: form.company,
        model_name: form.model_name.trim(),
        price: form.price,
        year: Number(form.year),
        km_driven: Math.round(Number(form.miles) * 1.60934),
        category: form.category,
        description: form.description.trim(),
        owner: form.owner,
      }

      const headers = await getCSRFHeaders()

      const response = await api.patch(
        `vehicles/${id}/update/`,
        payload,
        {
          headers,
          withCredentials: true,
        }
      )

      setSuccess(
        response.data?.message ||
        'Vehicle listing updated successfully.'
      )

      setTimeout(() => {
        navigate('/seller', {
          state: {
            updated: true,
          },
        })
      }, 900)
    } catch (err) {
      console.error('VEHICLE UPDATE ERROR:', err)
      console.error('VEHICLE UPDATE RESPONSE:', err.response?.data)

      setError(
        getErrorMessage(
          err,
          'Unable to update vehicle listing. Please check whether the listing has bid history.'
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------
  // LOADING SCREEN
  // ---------------------------------------------------

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: colors.background,
          color: colors.text,
        }}
      >
        Loading vehicle details...
      </div>
    )
  }

  // ---------------------------------------------------
  // EDIT PAGE UI
  // ---------------------------------------------------

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        padding: '35px 5%',
        boxSizing: 'border-box',
        color: colors.text,
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        {/* PAGE HEADER */}

        <div
          style={{
            background: colors.navy,
            color: '#fff',
            borderRadius: '16px',
            padding: '25px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              color: colors.gold,
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '2px',
            }}
          >
            AUTOZ SELLER PORTAL
          </div>

          <h1 style={{ margin: '9px 0', fontSize: '27px' }}>
            Edit Vehicle Listing
          </h1>

          <p style={{ margin: 0, color: '#cbd5e1' }}>
            Update your vehicle information and manage your listing.
          </p>
        </div>

        {/* BACK BUTTON */}

        <button
          type="button"
          onClick={() => navigate('/seller')}
          style={{
            background: '#fff',
            border: `1px solid ${colors.border}`,
            padding: '11px 17px',
            borderRadius: '9px',
            cursor: 'pointer',
            fontWeight: '700',
            marginBottom: '20px',
          }}
        >
          ← Back to Seller Dashboard
        </button>

        {error && (
          <div
            role="alert"
            style={{
              padding: '14px',
              background: '#fff0f0',
              color: colors.red,
              borderRadius: '9px',
              marginBottom: '16px',
              border: '1px solid #f2b7b7',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              padding: '14px',
              background: '#e9f7ef',
              color: colors.green,
              borderRadius: '9px',
              marginBottom: '16px',
              border: '1px solid #b7e4c7',
            }}
          >
            {success}
          </div>
        )}

        {vehicle && (
          <form onSubmit={handleSubmit} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '23px',
              }}
            >
              <div>
                <h2 style={{ margin: '0 0 6px' }}>
                  Vehicle Information
                </h2>

                <p style={{ margin: 0, color: colors.muted, fontSize: '13px' }}>
                  Listing ID: #{vehicle.id}
                </p>
              </div>

              <span
                style={{
                  background:
                    vehicle.listing_status === 'APPROVED'
                      ? '#e8f7ed'
                      : vehicle.listing_status === 'REJECTED'
                        ? '#fff0f0'
                        : '#fff5dc',
                  color:
                    vehicle.listing_status === 'APPROVED'
                      ? '#18733b'
                      : vehicle.listing_status === 'REJECTED'
                        ? '#b42318'
                        : '#946200',
                  borderRadius: '20px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: '800',
                  height: 'fit-content',
                }}
              >
                {vehicle.listing_status || 'PENDING'}
              </span>
            </div>

            {vehicle.listing_status === 'REJECTED' && (
              <div
                style={{
                  background: '#fff5dc',
                  color: '#946200',
                  padding: '14px',
                  borderRadius: '9px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                <strong>Admin feedback</strong>
                <p style={{ margin: '6px 0 0' }}>
                  {vehicle.rejection_reason ||
                    'Please review and update your vehicle information.'}
                </p>
                <p style={{ margin: '8px 0 0' }}>
                  After updating, your listing may be submitted again for admin approval.
                </p>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '18px',
              }}
            >
              <div>
                <label style={labelStyle}>Vehicle Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                  placeholder="2022 BMW X5 xDrive40i"
                />
              </div>

              <div>
                <label style={labelStyle}>Vehicle Brand *</label>
                <select
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                >
                  <option value="">Select Brand</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Model *</label>
                <input
                  name="model_name"
                  value={form.model_name}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Price (USD) *</label>
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Manufacturing Year *</label>
                <input
                  name="year"
                  type="number"
                  min="1900"
                  max="2100"
                  value={form.year}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Mileage (Miles) *</label>
                <input
                  name="miles"
                  type="number"
                  min="0"
                  value={form.miles}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Vehicle Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="Car">Car</option>
                  <option value="Bike">Bike</option>
                  <option value="Truck">Truck</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Ownership</label>
                <select
                  name="owner"
                  value={form.owner}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="1st Owner">1st Owner</option>
                  <option value="2nd Owner">2nd Owner</option>
                  <option value="3rd Owner">3rd Owner</option>
                  <option value="Single Owner - USA Clean Title">
                    Single Owner - USA Clean Title
                  </option>
                  <option value="2 Owners - US">2 Owners - US</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={labelStyle}>Vehicle Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
                placeholder="Describe vehicle condition, features and service history..."
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                marginTop: '25px',
              }}
            >
              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...buttonStyle,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Updating...' : '✓ Save Changes'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/seller')}
                style={{
                  background: '#fff',
                  border: `1px solid ${colors.border}`,
                  padding: '12px 20px',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p
          style={{
            textAlign: 'center',
            color: colors.muted,
            fontSize: '12px',
            marginTop: '25px',
          }}
        >
          AUTOZ SELLER PORTAL · UNITED STATES & UNITED KINGDOM
        </p>
      </div>
    </div>
  )
}


// =====================================================
// ADMIN BIDS DASHBOARD
// =====================================================

function AdminBidsDashboard() {
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedBid, setSelectedBid] = useState(null)

  // ---------------------------------------------------
  // LOAD ALL BIDS
  // ---------------------------------------------------

  const loadBids = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      // Correct Django API endpoint
      const response = await api.get('admin/bids/')

      const data = response.data?.results || response.data

      setBids(Array.isArray(data) ? data : [])

    } catch (err) {
      console.error('ADMIN BIDS ERROR:', err)

      if (err.response?.status === 401) {
        setError(
          'You are not authenticated as an administrator. Please log in through Django Admin.'
        )
      } else if (err.response?.status === 403) {
        setError(
          'Admin access denied. Please log in through Django Admin using your staff account.'
        )
      } else if (err.response?.status === 404) {
        setError(
          'Admin Bids API endpoint was not found. Please verify the backend URL configuration.'
        )
      } else if (!err.response) {
        setError(
          'Network Error: Unable to connect to Django backend. Check whether the backend server is running and verify the API base URL.'
        )
      } else {
        setError(
          getErrorMessage(err, 'Unable to load bid records.')
        )
      }

    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ---------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    loadBids()
  }, [])

  // ---------------------------------------------------
  // SEARCH FILTER
  // ---------------------------------------------------

  const filteredBids = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return bids

    return bids.filter((bid) => [
      bid.id,
      bid.bidder_name,
      bid.username,
      bid.user,
      bid.vehicle_title,
      bid.company_name,
      bid.auction_id,
      bid.auction,
      bid.bid_amount,
    ].join(' ').toLowerCase().includes(query))

  }, [bids, search])

  
  // ---------------------------------------------------
  // DASHBOARD STATISTICS
  // ---------------------------------------------------

  const uniqueVehicles = new Set(
    bids.map((bid) => bid.vehicle_title).filter(Boolean)
  ).size

  const uniqueBidders = new Set(
    bids.map((bid) =>
      bid.user || bid.username || bid.bidder_name
    ).filter(Boolean)
  ).size

  const totalBidValue = bids.reduce(
    (total, bid) =>
      total + Number(bid.bid_amount || 0),
    0
  )

  // ---------------------------------------------------
  // STYLES
  // ---------------------------------------------------

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '22px',
    boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
  }

  const cellStyle = {
    padding: '14px 12px',
    borderBottom: '1px solid #eee',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    fontSize: '14px',
  }

  const detailRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '13px 0',
    borderBottom: '1px solid #eee',
    fontSize: '14px',
  }

  // ---------------------------------------------------
  // DASHBOARD UI
  // ---------------------------------------------------

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f5f7',
        padding: '35px 5%',
        color: '#171717',
      }}
    >

      {/* HEADER */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={kickerStyle}>
            AUTOZ ADMINISTRATION
          </div>

          <h1 style={{ margin: '8px 0', fontSize: '32px' }}>
            AutoZ Bids
          </h1>

          <p style={{ color: '#777', margin: 0 }}>
            Central dashboard for all vehicle auction bids.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => loadBids(true)}
            disabled={refreshing}
            style={secondaryButtonStyle}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>

          <button
            type="button"
            onClick={() => window.location.assign('/')}
            style={{
              ...secondaryButtonStyle,
              background: '#171717',
              color: '#fff',
              borderColor: '#171717',
            }}
          >
            Back to Marketplace
          </button>
        </div>
      </div>

      {/* LOADING */}

      {loading ? (

        <div style={cardStyle}>
          Loading AutoZ bid records...
        </div>

      ) : error ? (

        /* ERROR */

        <div
          style={{
            ...cardStyle,
            background: '#fff1f0',
            color: '#b42318',
          }}
        >
          <h2>Unable to Access AutoZ Bids</h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() => loadBids()}
            style={secondaryButtonStyle}
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={() =>
              window.open(`${BACKEND_URL}/admin/`, '_blank')
            }
            style={{
              ...secondaryButtonStyle,
              marginLeft: '10px',
            }}
          >
            Open Django Admin
          </button>
        </div>

      ) : (

        /* DASHBOARD CONTENT */

        <>
          {/* SUMMARY CARDS */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '18px',
              marginBottom: '24px',
            }}
          >
            {[
              ['Total Bids', bids.length],
              ['Vehicles With Bids', uniqueVehicles],
              ['Unique Bidders', uniqueBidders],
              ['Combined Bid Value', formatPrice(totalBidValue)],
            ].map(([label, value]) => (
              <div key={label} style={cardStyle}>
                <p style={{ color: '#777', margin: 0 }}>
                  {label}
                </p>

                <h2
                  style={{
                    fontSize: '27px',
                    marginBottom: 0,
                  }}
                >
                  {value}
                </h2>
              </div>
            ))}
          </div>

          {/* ALL BID RECORDS */}

          <div style={cardStyle}>
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ margin: '0 0 5px' }}>
                All Bid Records
              </h2>

              <p
                style={{
                  color: '#777',
                  margin: 0,
                  fontSize: '13px',
                }}
              >
                Latest bid records are displayed first.
              </p>
            </div>

            {/* SEARCH */}

            <input
              type="search"
              placeholder="Search by bidder, vehicle, company or auction ID..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              style={{
                ...formInputStyle,
                marginBottom: '20px',
              }}
            />

            {/* TABLE */}

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '1150px',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#f7f7f7',
                      color: '#555',
                    }}
                  >
                    {[
                      'Bid ID',
                      'Vehicle',
                      'Company',
                      'Bidder Name',
                      'Username',
                      'Bid Amount',
                      'Bid Date & Time',
                      'Auction ID',
                      'Action',
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={cellStyle}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredBids.length === 0 ? (

                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          ...cellStyle,
                          textAlign: 'center',
                          padding: '35px',
                        }}
                      >
                        No bid records found.
                      </td>
                    </tr>

                  ) : (

                    filteredBids.map((bid) => (
                      <tr key={bid.id}>
                        <td style={cellStyle}>
                          #{bid.id}
                        </td>

                        <td
                          style={{
                            ...cellStyle,
                            fontWeight: 'bold',
                          }}
                        >
                          {bid.vehicle_title || '—'}
                        </td>

                        <td style={cellStyle}>
                          {bid.company_name || '—'}
                        </td>

                        <td style={cellStyle}>
                          {bid.bidder_name || '—'}
                        </td>

                        <td style={cellStyle}>
                          {bid.username || 'Guest'}
                        </td>

                        <td
                          style={{
                            ...cellStyle,
                            color: '#16803c',
                            fontWeight: 'bold',
                          }}
                        >
                          {formatPrice(bid.bid_amount)}
                        </td>

                        <td style={cellStyle}>
                          {formatBidDate(bid.bid_time)}
                        </td>

                        <td style={cellStyle}>
                          #{bid.auction_id || bid.auction || '—'}
                        </td>

                        <td style={cellStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedBid(bid)
                            }
                            style={{
                              padding: '8px 13px',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#171717',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))

                  )}
                </tbody>
              </table>
            </div>

            <p
              style={{
                color: '#777',
                fontSize: '13px',
                marginTop: '16px',
              }}
            >
              Showing {filteredBids.length} of {bids.length} bid records.
            </p>
          </div>
        </>
      )}

      {/* BID DETAILS MODAL */}

      {selectedBid && (
        <div
          role="presentation"
          onClick={() => setSelectedBid(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            overflowY: 'auto',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '14px',
              padding: '28px',
              color: '#171717',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={kickerStyle}>
                  AUTOZ ADMINISTRATION
                </span>

                <h2>
                  Bid Details #{selectedBid.id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBid(null)}
                style={secondaryButtonStyle}
              >
                ×
              </button>
            </div>

            {/* BID AMOUNT */}

            <div
              style={{
                background: '#f8f8f8',
                borderRadius: '9px',
                padding: '16px',
                marginBottom: '18px',
              }}
            >
              <span
                style={{
                  color: '#777',
                  fontSize: '12px',
                }}
              >
                BID AMOUNT
              </span>

              <h2
                style={{
                  color: '#16803c',
                  margin: '5px 0 0',
                }}
              >
                {formatPrice(selectedBid.bid_amount)}
              </h2>
            </div>

            {/* BID INFORMATION */}

            {[
              ['Bid ID', `#${selectedBid.id}`],

              ['Bidder Name', selectedBid.bidder_name || '—'],

              ['Username', selectedBid.username || 'Guest'],

              [
                'User ID',
                selectedBid.user_id ??
                  (
                    typeof selectedBid.user === 'number'
                      ? selectedBid.user
                      : selectedBid.user?.id
                  ) ??
                  '—',
              ],

              ['Vehicle', selectedBid.vehicle_title || '—'],

              ['Company', selectedBid.company_name || '—'],

              [
                'Auction ID',
                `#${selectedBid.auction_id || selectedBid.auction || '—'}`,
              ],

              [
                'Bid Date & Time',
                formatBidDate(selectedBid.bid_time),
              ],

              [
                'Highest Bid',
                selectedBid.is_highest_bid === undefined
                  ? 'Not available'
                  : selectedBid.is_highest_bid
                    ? 'Yes'
                    : 'No',
              ],

              [
                'Outbid Status',
                selectedBid.is_outbid === undefined
                  ? 'Not available'
                  : selectedBid.is_outbid
                    ? 'Outbid'
                    : 'Not Outbid',
              ],

            ].map(([label, value]) => (
              <div
                key={label}
                style={detailRowStyle}
              >
                <strong>{label}</strong>

                <span style={{ textAlign: 'right' }}>
                  {value}
                </span>
              </div>
            ))}

            {/* CLOSE */}

            <button
              type="button"
              onClick={() => setSelectedBid(null)}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '13px',
                border: 'none',
                borderRadius: '7px',
                background: '#171717',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Close Details
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// =====================================================
// SELLER PORTAL
// =====================================================

function SellerPortal() {
  const navigate = useNavigate()

  const [seller, setSeller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function checkSellerSession() {
      try {
        await initializeCSRF()

        const response = await api.get('auth/me/')

        if (!mounted) return

        if (
          response.data?.authenticated &&
          response.data?.user
        ) {
          setSeller(response.data.user)
        }
      } catch (err) {
        console.log('Seller session check:', err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkSellerSession()

    return () => {
      mounted = false
    }
  }, [])

  const handleSellerLogin = (user) => {
    setSeller(user)
    setError('')
  }

  const handleSellerLogout = async () => {
    try {
      const headers = await getCSRFHeaders()

      await api.post(
        'auth/logout/',
        {},
        {
          headers,
          withCredentials: true,
        }
      )

      setSeller(null)
      navigate('/')
    } catch (err) {
      console.error('SELLER LOGOUT ERROR:', err)
      setError(getErrorMessage(err, 'Unable to logout. Please try again.'))
    }
  }

  if (loading) {
    return (
      <div className="state-message">
        <div className="loader"></div>
        <p>Checking Seller session...</p>
      </div>
    )
  }

  if (seller) {
    return (
      <>
        {error && (
          <p role="alert" style={errorStyle}>
            {error}
          </p>
        )}

        <SellerDashboard
          seller={seller}
          onLogout={handleSellerLogout}
        />
      </>
    )
  }
  return (
  <SellerLoginPanel
    onLogin={handleSellerLogin}
    onCancel={() => navigate('/')}
    onRegister={() => navigate('/?sellerRegister=1')}
  />
)
}
// =====================================================
// MARKETPLACE
// =====================================================

function Marketplace() {
  const navigate = useNavigate()

  const [vehicles, setVehicles] = useState([])
  const [auctions, setAuctions] = useState([])
  const [companies, setCompanies] = useState([])

  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('All')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // BUYER SESSION
  const [buyer, setBuyer] = useState(null)

  // SELLER SESSION
  const [seller, setSeller] = useState(null)
  const [showSellerLogin, setShowSellerLogin] = useState(false)

  const [authLoading, setAuthLoading] = useState(true)

  // BUYER LOGIN / REGISTER
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [registerUsername, setRegisterUsername] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
    // SELLER REGISTRATION
// SELLER REGISTRATION
const [showSellerRegister, setShowSellerRegister] = useState(
  () => new URLSearchParams(window.location.search).get('sellerRegister') === '1'
)
  const [sellerRegisterUsername, setSellerRegisterUsername] = useState('')
  const [sellerRegisterEmail, setSellerRegisterEmail] = useState('')
  const [sellerRegisterPassword, setSellerRegisterPassword] = useState('')
  const [sellerRegisterConfirmPassword, setSellerRegisterConfirmPassword] = useState('')
  const [sellerRegisterError, setSellerRegisterError] = useState('')
  const [sellerRegisterLoading, setSellerRegisterLoading] = useState(false)

  const [authMessage, setAuthMessage] = useState('')

  // ---------------------------------------------------
  // LOAD MARKETPLACE DATA
  // ---------------------------------------------------

  useEffect(() => {
    let mounted = true

    async function loadMarketplace() {
      try {
        setLoading(true)
        setError('')

        const [vehicleRes, auctionRes, companyRes] = await Promise.all([
          api.get('vehicles/'),
          api.get('auctions/'),
          api.get('companies/'),
        ])

        if (!mounted) return

        const vehicleData = vehicleRes.data?.results || vehicleRes.data
        const auctionData = auctionRes.data?.results || auctionRes.data
        const companyData = companyRes.data?.results || companyRes.data

        setVehicles(Array.isArray(vehicleData) ? vehicleData : [])
        setAuctions(Array.isArray(auctionData) ? auctionData : [])
        setCompanies(Array.isArray(companyData) ? companyData : [])
      } catch (err) {
        console.error('Marketplace API error:', err)

        if (mounted) {
          setError(
            'Unable to connect to AutoZ server. Please check that Django is running.'
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadMarketplace()

    return () => {
      mounted = false
    }
  }, [])

  // ---------------------------------------------------
  // CHECK EXISTING BUYER / SELLER SESSION
  // ---------------------------------------------------

  useEffect(() => {
    let mounted = true

    async function checkSessions() {
      try {
        await initializeCSRF()

        const [buyerResult, sellerResult] = await Promise.allSettled([
          api.get('buyer/me/'),
          api.get('auth/me/'),
        ])

        if (!mounted) return

        if (
          buyerResult.status === 'fulfilled' &&
          buyerResult.value.data?.authenticated &&
          buyerResult.value.data?.user
        ) {
          setBuyer(buyerResult.value.data.user)
        }

        if (
          sellerResult.status === 'fulfilled' &&
          sellerResult.value.data?.authenticated &&
          sellerResult.value.data?.user
        ) {
          setSeller(sellerResult.value.data.user)
          setBuyer(null)
        }
      } catch (err) {
        console.log('Session check:', err.message)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    checkSessions()

    return () => {
      mounted = false
    }
  }, [])

  // ---------------------------------------------------
  // OPEN AUTH PANELS
  // ---------------------------------------------------

  const openLogin = () => {
    setShowLogin(true)
    setShowRegister(false)
    setShowSellerLogin(false)
    setLoginError('')
    setRegisterError('')
    setAuthMessage('')
  }

  const openRegister = () => {
    setShowRegister(true)
    setShowLogin(false)
    setShowSellerLogin(false)
    setLoginError('')
    setRegisterError('')
    setAuthMessage('')
  }

  const openSellerLogin = () => {
    setShowSellerLogin(true)
    setShowLogin(false)
    setShowRegister(false)
    setLoginError('')
    setRegisterError('')
    setAuthMessage('')

    document.getElementById('seller-login')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
  const openSellerRegister = () => {
  setShowSellerRegister(true)
  setShowSellerLogin(false)
  setShowLogin(false)
  setShowRegister(false)

  setSellerRegisterError('')
  setLoginError('')
  setRegisterError('')
  setAuthMessage('')

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}
  // ---------------------------------------------------
  // SELLER LOGIN SUCCESS
  // ---------------------------------------------------

  const handleSellerLoginSuccess = (user) => {
    setSeller(user)
    setBuyer(null)
    setShowSellerLogin(false)
    setShowLogin(false)
    setShowRegister(false)
    setAuthMessage('')
  }

  // ---------------------------------------------------
  // BUYER LOGIN
  // ---------------------------------------------------

  const handleBuyerLogin = async (event) => {
    event.preventDefault()
    if (loginLoading) return

    setLoginError('')
    setAuthMessage('')
    setLoginLoading(true)

    try {
      const username = loginUsername.trim()

      if (!username || !loginPassword) {
        setLoginError('Please enter your username and password.')
        return
      }

      const headers = await getCSRFHeaders()

      const response = await api.post(
        'buyer/login/',
        {
          username,
          password: loginPassword,
        },
        {
          headers,
          withCredentials: true,
        }
      )

      if (response.data?.success && response.data?.user) {
        setBuyer(response.data.user)
        setSeller(null)
        setLoginUsername('')
        setLoginPassword('')
        setShowLogin(false)
        setShowRegister(false)
        setAuthMessage('Welcome to AutoZ!')
      } else {
        setLoginError(
          response.data?.detail ||
          response.data?.error ||
          'Login response was unsuccessful.'
        )
      }
    } catch (err) {
      console.error('BUYER LOGIN ERROR:', err)

      setLoginError(
        getErrorMessage(err, 'Unable to login. Please try again.')
      )

      if (err.response?.status === 403) {
        setLoginError('CSRF verification failed. Please refresh and try again.')
      } else if (err.response?.status === 404) {
        setLoginError('Buyer login API not found. Please check the backend URL.')
      }
    } finally {
      setLoginLoading(false)
    }
  }

  // ---------------------------------------------------
  // BUYER REGISTRATION
  // ---------------------------------------------------

  const handleBuyerRegister = async (event) => {
    event.preventDefault()
    if (registerLoading) return

    setRegisterError('')
    setAuthMessage('')

    const username = registerUsername.trim()
    const email = registerEmail.trim()

    if (!username || !email || !registerPassword || !registerConfirmPassword) {
      setRegisterError('Please fill in all registration fields.')
      return
    }

    if (username.length < 3) {
      setRegisterError('Username must contain at least 3 characters.')
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('Passwords do not match.')
      return
    }

    setRegisterLoading(true)

    try {
      const headers = await getCSRFHeaders()

      const response = await api.post(
        'buyer/register/',
        {
          username,
          email,
          password: registerPassword,
          confirm_password: registerConfirmPassword,
        },
        {
          headers,
          withCredentials: true,
        }
      )

      if (response.data?.success) {
        setRegisterUsername('')
        setRegisterEmail('')
        setRegisterPassword('')
        setRegisterConfirmPassword('')

        setLoginUsername(username)
        setLoginPassword('')

        setShowRegister(false)
        setShowLogin(true)
        setAuthMessage('Buyer account created successfully! Please log in.')
      } else {
        setRegisterError(
          response.data?.detail ||
          response.data?.error ||
          'Registration was unsuccessful.'
        )
      }
    } catch (err) {
      console.error('BUYER REGISTRATION ERROR:', err)

      setRegisterError(
        getErrorMessage(err, 'Unable to create your account.')
      )

      if (err.response?.status === 403) {
        setRegisterError(
          'CSRF verification failed. Please refresh the page and try again.'
        )
      }
    } finally {
      setRegisterLoading(false)
    }
  }

    // ---------------------------------------------------
  // SELLER REGISTRATION
  // ---------------------------------------------------

  const handleSellerRegister = async (event) => {
    event.preventDefault()

    if (sellerRegisterLoading) return

    setSellerRegisterError('')
    setAuthMessage('')

    const username = sellerRegisterUsername.trim()
    const email = sellerRegisterEmail.trim()

    if (
      !username ||
      !email ||
      !sellerRegisterPassword ||
      !sellerRegisterConfirmPassword
    ) {
      setSellerRegisterError('Please fill in all registration fields.')
      return
    }

    if (username.length < 3) {
      setSellerRegisterError('Username must contain at least 3 characters.')
      return
    }

    if (sellerRegisterPassword !== sellerRegisterConfirmPassword) {
      setSellerRegisterError('Passwords do not match.')
      return
    }

    setSellerRegisterLoading(true)

    try {
      const headers = await getCSRFHeaders()

      const response = await api.post(
        'seller/register/',
        {
          username,
          email,
          password: sellerRegisterPassword,
          confirm_password: sellerRegisterConfirmPassword,
        },
        {
          headers,
          withCredentials: true,
        }
      )

      if (response.data?.success) {
        setSellerRegisterUsername('')
        setSellerRegisterEmail('')
        setSellerRegisterPassword('')
        setSellerRegisterConfirmPassword('')

        setShowSellerRegister(false)
        setShowSellerLogin(true)

        setAuthMessage(
          'Seller account created successfully! Please log in.'
        )
      } else {
        setSellerRegisterError(
          response.data?.detail ||
          response.data?.error ||
          'Seller registration was unsuccessful.'
        )
      }
    } catch (err) {
      console.error('SELLER REGISTRATION ERROR:', err)

      setSellerRegisterError(
        getErrorMessage(err, 'Unable to create your seller account.')
      )

      if (err.response?.status === 403) {
        setSellerRegisterError(
          'CSRF verification failed. Please refresh the page and try again.'
        )
      }
    } finally {
      setSellerRegisterLoading(false)
    }
  }

  // ---------------------------------------------------
  // BUYER LOGOUT
  // ---------------------------------------------------

  const handleBuyerLogout = async () => {
    setLoginError('')
    setAuthMessage('')

    try {
      const headers = await getCSRFHeaders()

      await api.post(
        'buyer/logout/',
        {},
        {
          headers,
          withCredentials: true,
        }
      )

      setBuyer(null)
      setShowLogin(false)
      setShowRegister(false)
      setLoginPassword('')
      setLoginUsername('')
      setAuthMessage('You have been logged out successfully.')
    } catch (err) {
      console.error('BUYER LOGOUT ERROR:', err)

      setLoginError(
        getErrorMessage(err, 'Unable to logout. Please try again.')
      )
    }
  }

  // ---------------------------------------------------
  // SELLER LOGOUT
  // ---------------------------------------------------

  const handleSellerLogout = async () => {
    try {
      const headers = await getCSRFHeaders()

      await api.post(
        'auth/logout/',
        {},
        {
          headers,
          withCredentials: true,
        }
      )

      setSeller(null)
      setShowSellerLogin(false)
      setAuthMessage('Seller logged out successfully.')
    } catch (err) {
      console.error('SELLER LOGOUT ERROR:', err)

      setAuthMessage(
        getErrorMessage(err, 'Unable to logout Seller.')
      )
    }
  }

  // ---------------------------------------------------
  // FILTER VEHICLES
  // ---------------------------------------------------

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const companyName = vehicle.company_name || ''
      const searchText = `${vehicle.title || ''} ${companyName}`.toLowerCase()

      const matchesSearch = searchText.includes(search.toLowerCase())

      const matchesCompany =
        selectedCompany === 'All' || companyName === selectedCompany

      return matchesSearch && matchesCompany && !vehicle.is_sold
    })
  }, [vehicles, search, selectedCompany])

  // ---------------------------------------------------
  // ACTIVE AUCTIONS
  // ---------------------------------------------------

  const activeAuctions = useMemo(() => {
    const now = Date.now()

    return auctions
      .filter((auction) => {
        if (auction.is_active !== true || !auction.end_time) return false

        const endTime = new Date(auction.end_time).getTime()

        if (Number.isNaN(endTime) || endTime <= now) return false
        if (auction.vehicle?.is_sold === true) return false

        return true
      })
      .sort((a, b) => (
        new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
      ))
  }, [auctions])

  const auctionByVehicleId = useMemo(() => {
    const map = new Map()

    activeAuctions.forEach((auction) => {
      const vehicleId = Number(auction.vehicle?.id)
      if (!vehicleId) return

      const existing = map.get(vehicleId)

      if (
        !existing ||
        Number(auction.current_price || 0) >
        Number(existing.current_price || 0)
      ) {
        map.set(vehicleId, auction)
      }
    })

    return map
  }, [activeAuctions])

  // ---------------------------------------------------
  // NAVIGATION HELPERS
  // ---------------------------------------------------

  const scrollToListings = () => {
    document.getElementById('vehicles')?.scrollIntoView({
      behavior: 'smooth',
    })
  }

  const openVehicleDetails = (vehicleId) => {
    navigate(`/vehicles/${vehicleId}`)
  }

  // ---------------------------------------------------
  // SELLER DASHBOARD VIEW
  // ---------------------------------------------------

  if (seller) {
    return (
      <SellerDashboard
        seller={seller}
        onLogout={handleSellerLogout}
      />
    )
  }

  // ---------------------------------------------------
  // MARKETPLACE VIEW
  // ---------------------------------------------------

  return (
    <div className="autoz-app">

      {/* TOP STRIP */}

      <div className="top-strip">
        <div className="top-strip-inner">
          <span>THE GLOBAL DESTINATION FOR PREMIUM VEHICLE AUCTIONS</span>

          <div className="top-links">
            <span>United States</span>
            <span className="top-divider">|</span>
            <span>United Kingdom</span>
          </div>
        </div>
      </div>

      {/* HEADER */}

      <header className="main-header">
        <a className="brand-logo" href="#home">
          <span className="brand-symbol">A</span>
          <span>AUTO<span className="brand-highlight">Z</span></span>
        </a>

        <nav className="main-nav">
          <a className="nav-active" href="#home">Home</a>
          <a href="#vehicles">Browse Cars</a>
          <a href="#auctions">Auctions</a>
          <a href="#brands">Top Brands</a>
        </nav>
<div className="header-actions">
  {authLoading ? (
    <span>Checking...</span>
  ) : seller ? (
    <span className="login-link">
      Seller: {seller.username}
    </span>
  ) : buyer ? (
    <>
      <span className="login-link">
        Hi, {buyer.username}
      </span>

      <Link
        to="/my-bids"
        className="login-link"
        style={{
          textDecoration: 'none',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        My Bids
      </Link>

      <button
        type="button"
        className="sell-button"
        onClick={handleBuyerLogout}
      >
        Log Out
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className="login-link"
        onClick={openLogin}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        Log In
      </button>

      <button
        type="button"
        className="sell-button"
        onClick={openRegister}
        style={{ cursor: 'pointer' }}
      >
        Register <span>↗</span>
      </button>
    </>
  )}

  <Link className="sell-button" to="/seller">
    List Your Vehicle <span>↗</span>
  </Link>
</div>
</header>


      {/* BUYER LOGIN PANEL */}

      {showLogin && !buyer && (
        <div style={authPanelStyle}>
          <h2 style={{ marginTop: 0 }}>Buyer Login</h2>

          <p style={{ color: '#666' }}>
            Sign in to your AutoZ Buyer account.
          </p>

          <form onSubmit={handleBuyerLogin}>
            <label htmlFor="buyer-username" style={formLabelStyle}>
              Username
            </label>

            <input
              id="buyer-username"
              type="text"
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              required
              style={authInputStyle}
            />

            <label htmlFor="buyer-password" style={formLabelStyle}>
              Password
            </label>

            <input
              id="buyer-password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              style={authInputStyle}
            />

            {loginError && (
              <p role="alert" style={errorStyle}>{loginError}</p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loginLoading}
              style={{ width: '100%' }}
            >
              {loginLoading ? 'Signing in...' : 'Login'}
            </button>

            <p
              style={{
                textAlign: 'center',
                marginTop: '18px',
                color: '#555',
                fontSize: '14px',
              }}
            >
              Don't have an account?{' '}
              <button
                type="button"
                onClick={openRegister}
                style={textButtonStyle}
              >
                Register
              </button>
            </p>

            <button
              type="button"
              onClick={() => {
                setShowLogin(false)
                setLoginError('')
                setLoginPassword('')
              }}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* BUYER REGISTRATION PANEL */}

      {showRegister && !buyer && (
        <div style={authPanelStyle}>
          <h2 style={{ marginTop: 0 }}>Create Buyer Account</h2>

          <p style={{ color: '#666' }}>
            Join AutoZ and start exploring premium vehicle auctions.
          </p>

          <form onSubmit={handleBuyerRegister}>
            <label htmlFor="register-username" style={formLabelStyle}>
              Username
            </label>

            <input
              id="register-username"
              type="text"
              value={registerUsername}
              onChange={(event) => setRegisterUsername(event.target.value)}
              placeholder="Choose a username"
              autoComplete="username"
              minLength={3}
              required
              style={authInputStyle}
            />

            <label htmlFor="register-email" style={formLabelStyle}>
              Email Address
            </label>

            <input
              id="register-email"
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              required
              style={authInputStyle}
            />

            <label htmlFor="register-password" style={formLabelStyle}>
              Password
            </label>

            <input
              id="register-password"
              type="password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              required
              style={authInputStyle}
            />

            <label htmlFor="register-confirm-password" style={formLabelStyle}>
              Confirm Password
            </label>

            <input
              id="register-confirm-password"
              type="password"
              value={registerConfirmPassword}
              onChange={(event) => setRegisterConfirmPassword(event.target.value)}
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              style={authInputStyle}
            />

            {registerError && (
              <p role="alert" style={errorStyle}>{registerError}</p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={registerLoading}
              style={{ width: '100%' }}
            >
              {registerLoading ? 'Creating Account...' : 'Create Buyer Account'}
            </button>

            <p
              style={{
                textAlign: 'center',
                marginTop: '18px',
                color: '#555',
                fontSize: '14px',
              }}
            >
              Already have an account?{' '}
              <button
                type="button"
                onClick={openLogin}
                style={textButtonStyle}
              >
                Log In
              </button>
            </p>

            <button
              type="button"
              onClick={() => {
                setShowRegister(false)
                setRegisterError('')
              }}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
          </form>
        </div>
      )}



  {/* SELLER REGISTRATION PANEL */}

      {showSellerRegister && !seller && (
        <div id="seller-register" style={authPanelStyle}>
          <h2 style={{ marginTop: 0 }}>Create Seller Account</h2>

          <p style={{ color: '#666' }}>
            Join AutoZ as a seller and start listing your vehicles.
          </p>

          <form onSubmit={handleSellerRegister}>
            <label htmlFor="seller-register-username" style={formLabelStyle}>
              Username
            </label>

            <input
              id="seller-register-username"
              type="text"
              value={sellerRegisterUsername}
              onChange={(event) => setSellerRegisterUsername(event.target.value)}
              placeholder="Choose a username"
              autoComplete="username"
              minLength={3}
              required
              style={authInputStyle}
            />

            <label htmlFor="seller-register-email" style={formLabelStyle}>
              Email Address
            </label>

            <input
              id="seller-register-email"
              type="email"
              value={sellerRegisterEmail}
              onChange={(event) => setSellerRegisterEmail(event.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              required
              style={authInputStyle}
            />

            <label htmlFor="seller-register-password" style={formLabelStyle}>
              Password
            </label>

            <input
              id="seller-register-password"
              type="password"
              value={sellerRegisterPassword}
              onChange={(event) => setSellerRegisterPassword(event.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              required
              style={authInputStyle}
            />

            <label
              htmlFor="seller-register-confirm-password"
              style={formLabelStyle}
            >
              Confirm Password
            </label>

            <input
              id="seller-register-confirm-password"
              type="password"
              value={sellerRegisterConfirmPassword}
              onChange={(event) =>
                setSellerRegisterConfirmPassword(event.target.value)
              }
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              style={authInputStyle}
            />

            {sellerRegisterError && (
              <p role="alert" style={errorStyle}>
                {sellerRegisterError}
              </p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={sellerRegisterLoading}
              style={{ width: '100%' }}
            >
              {sellerRegisterLoading
                ? 'Creating Seller Account...'
                : 'Create Seller Account'}
            </button>

            <p
              style={{
                textAlign: 'center',
                marginTop: '18px',
                color: '#555',
                fontSize: '14px',
              }}
            >
              Already registered as a seller?{' '}
              <button
                type="button"
                onClick={openSellerLogin}
                style={textButtonStyle}
              >
                Log In
              </button>
            </p>

            <button
              type="button"
              onClick={() => {
                setShowSellerRegister(false)
                setSellerRegisterError('')
              }}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
          </form>
        </div>
      )}


{/* SELLER LOGIN PANEL */}

  {showSellerLogin && (
  <SellerLoginPanel
    onLogin={handleSellerLoginSuccess}
    onCancel={() => setShowSellerLogin(false)}
    onRegister={openSellerRegister}
  />
  )}
      {/* AUTH MESSAGE */}

      {authMessage && (
        <div
          role="status"
          style={{
            textAlign: 'center',
            padding: '10px',
            color: '#16803c',
          }}
        >
          {authMessage}
        </div>
      )}

      <main>

        {/* HERO SECTION */}

        <section className="hero-section" id="home">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="eyebrow-line"></span>
              DRIVE THE EXTRAORDINARY
            </div>

            <h1>
              YOUR NEXT DRIVE.
              <br />
              <span>YOUR NEXT DEAL.</span>
            </h1>

            <p className="hero-description">
              Discover exceptional vehicles and exciting auctions.
              Your trusted marketplace for buying and selling across
              the US and UK.
            </p>

            <div className="hero-buttons">
              <button
                onClick={scrollToListings}
                className="primary-button"
              >
                Explore Vehicles <span>↗</span>
              </button>

              <a href="#auctions" className="secondary-button">
                Explore Auctions <span>→</span>
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong>{vehicles.length}+</strong>
                <span>Listed Vehicles</span>
              </div>

              <div className="stat-divider"></div>

              <div>
                <strong>{activeAuctions.length}+</strong>
                <span>Live Auctions</span>
              </div>

              <div className="stat-divider"></div>

              <div>
                <strong>{companies.length}+</strong>
                <span>Top Brands</span>
              </div>
            </div>
          </div>

          <div className="hero-art">
            <div className="hero-orbit orbit-one"></div>
            <div className="hero-orbit orbit-two"></div>

            <div className="hero-car-shape">
              <div className="car-glow"></div>
              <div className="car-roof"></div>
              <div className="car-window"></div>
              <div className="car-body"></div>
              <div className="car-wheel wheel-left"></div>
              <div className="car-wheel wheel-right"></div>
              <div className="car-light"></div>
            </div>

            <div className="hero-art-label">
              <span className="live-dot"></span>
              PREMIUM COLLECTION
            </div>

            <div className="hero-art-number">01 / AUTOZ</div>
          </div>

          <div className="hero-bottom-note">
            <span>01</span> BUILT FOR THE LOVE OF DRIVING
          </div>
        </section>

        {/* TRUST BAR */}

        <section className="trust-bar">
          <div><span className="trust-icon">✓</span> Trusted Marketplace</div>
          <div><span className="trust-icon">◇</span> Verified Listings</div>
          <div><span className="trust-icon">↗</span> Competitive Auctions</div>
          <div><span className="trust-icon">◎</span> US & UK Marketplace</div>
        </section>

        {/* BRANDS SECTION */}

        <section className="brands-section section-wrap" id="brands">
          <div className="section-heading">
            <div>
              <span className="section-kicker">EXPLORE THE COLLECTION</span>
              <h2>TOP BRANDS <span>US & UK</span></h2>
            </div>

            <p>Find the name you love. Discover the drive you deserve.</p>
          </div>

          <div className="brand-list">
            <button
              className={
                selectedCompany === 'All'
                  ? 'brand-chip selected'
                  : 'brand-chip'
              }
              onClick={() => setSelectedCompany('All')}
            >
              All Brands
            </button>

            {companies.map((company) => (
              <button
                key={company.id}
                className={
                  selectedCompany === company.name
                    ? 'brand-chip selected'
                    : 'brand-chip'
                }
                onClick={() => {
                  setSelectedCompany(company.name)
                  scrollToListings()
                }}
              >
                {company.name}
              </button>
            ))}
          </div>
        </section>

        {/* VEHICLES SECTION */}

        <section className="vehicles-section section-wrap" id="vehicles">
          <div className="section-heading">
            <div>
              <span className="section-kicker">FIND YOUR PERFECT MATCH</span>
              <h2>FEATURED <span>VEHICLES</span></h2>
            </div>

            <span className="result-count">
              {filteredVehicles.length} VEHICLES FOUND
            </span>
          </div>

          <div className="search-toolbar">
            <div className="search-box">
              <span>⌕</span>

              <input
                type="search"
                placeholder="Search by vehicle or brand..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <button
              className="filter-button"
              onClick={() => {
                setSearch('')
                setSelectedCompany('All')
              }}
            >
              ↻ Reset Filters
            </button>
          </div>

          {loading ? (
            <div className="state-message">
              <div className="loader"></div>
              <p>Loading the AutoZ collection...</p>
            </div>
          ) : error ? (
            <div className="state-message error-message">
              <strong>Connection unavailable</strong>
              <p>{error}</p>

              <button
                className="primary-button"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="state-message">
              <strong>No vehicles found</strong>
              <p>Try another search or select a different brand.</p>
            </div>
          ) : (
            <div className="vehicle-grid">
              {filteredVehicles.map((vehicle) => {
                const vehicleAuction = auctionByVehicleId.get(
                  Number(vehicle.id)
                )

                const displayPrice =
                  vehicleAuction?.current_price ?? vehicle.price

                // Database stores km_driven; display miles on the US marketplace.
                const displayMiles = Math.round(
                  Number(vehicle.km_driven || 0) * 0.621371
                )

                return (
                  <article className="vehicle-card" key={vehicle.id}>
                    <div
                      className="vehicle-image"
                      onClick={() => openVehicleDetails(vehicle.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' ||
                          event.key === ' '
                        ) {
                          event.preventDefault()
                          openVehicleDetails(vehicle.id)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {vehicle.image ? (
                        <img
                          src={getImageUrl(vehicle.image)}
                          alt={vehicle.title}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="image-placeholder">AUTOZ</div>
                      )}

                      <span className="vehicle-category">
                        {vehicle.is_verified ? '✓ VERIFIED' : 'VEHICLE'}
                      </span>

                      {vehicle.is_sold && (
                        <span className="sold-label">SOLD</span>
                      )}
                    </div>

                    <div className="vehicle-info">
                      <div className="vehicle-brand">
                        {vehicle.company_name || 'AUTOZ COLLECTION'}
                      </div>

                      <h3>{vehicle.title}</h3>

                      <div className="vehicle-meta">
                        <span>{vehicle.year || '—'}</span>
                        <span>{displayMiles.toLocaleString('en-US')} miles</span>
                      </div>

                      <div className="vehicle-card-footer">
                        <div>
                          <span className="price-caption">
                            {vehicleAuction ? 'CURRENT BID' : 'CURRENT PRICE'}
                          </span>

                          <strong>{formatPrice(displayPrice)}</strong>
                        </div>

                        <button
                          className="card-arrow"
                          onClick={() => openVehicleDetails(vehicle.id)}
                          aria-label={`View ${vehicle.title}`}
                        >
                          ↗
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* LIVE AUCTIONS */}

        <section className="auction-section" id="auctions">
          <div className="section-wrap">
            <div className="section-heading auction-heading">
              <div>
                <span className="section-kicker">THE EXCITEMENT STARTS HERE</span>
                <h2>LIVE <span>AUCTIONS</span></h2>
              </div>

              <span className="live-label">
                <span className="live-dot"></span>
                LIVE MARKETPLACE
              </span>
            </div>

            {activeAuctions.length === 0 ? (
              <div className="auction-empty">
                <strong>New auctions are on the way.</strong>
                <p>Check back soon for exciting vehicle auctions.</p>
              </div>
            ) : (
              <div className="auction-grid">
                {activeAuctions.map((auction) => (
                  <article className="auction-card" key={auction.id}>
                    <div
                      className="auction-image"
                      onClick={() => {
                        if (auction.vehicle?.id) {
                          openVehicleDetails(auction.vehicle.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (
                          (event.key === 'Enter' || event.key === ' ') &&
                          auction.vehicle?.id
                        ) {
                          event.preventDefault()
                          openVehicleDetails(auction.vehicle.id)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {auction.vehicle?.image ? (
                        <img
                          src={getImageUrl(auction.vehicle.image)}
                          alt={auction.vehicle.title || 'Auction vehicle'}
                        />
                      ) : (
                        <div className="image-placeholder">
                          AUTOZ AUCTION
                        </div>
                      )}

                      <span>AUCTION #{auction.id}</span>
                    </div>

                    <div className="auction-info">
                      <h3>
                        {auction.vehicle?.title || 'Premium Vehicle'}
                      </h3>

                      <p>Starting price</p>
                      <strong>{formatPrice(auction.base_price)}</strong>

                      <div className="auction-current">
                        <span>Current bid</span>
                        <b>{formatPrice(auction.current_price)}</b>
                      </div>

                      <div className="auction-end">
                        Ends: {new Date(auction.end_time).toLocaleString('en-US')}
                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          if (auction.vehicle?.id) {
                            openVehicleDetails(auction.vehicle.id)
                          }
                        }}
                      >
                        View Auction
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SELL BANNER */}

        <section className="sell-banner section-wrap" id="sell">
          <div>
            <span className="section-kicker">
              YOUR VEHICLE. THE RIGHT AUDIENCE.
            </span>

            <h2>READY TO MAKE <span>YOUR MOVE?</span></h2>

            <p>
              Bring your vehicle to a marketplace built for serious
              buyers and sellers.
            </p>
          </div>

          <Link className="primary-button" to="/seller">
            Start Selling <span>↗</span>
          </Link>
        </section>
      </main>

      {/* FOOTER */}

      <footer className="footer" id="login">
        <div className="footer-main section-wrap">
          <a className="brand-logo footer-logo" href="#home">
            <span className="brand-symbol">A</span>
            <span>AUTO<span className="brand-highlight">Z</span></span>
          </a>

          <p>Driven by passion. Connected by AutoZ.</p>

          <span className="footer-region">
            UNITED STATES · UNITED KINGDOM
          </span>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} AUTOZ. ALL RIGHTS RESERVED.</span>
          <span>THE MARKETPLACE FOR YOUR NEXT DRIVE.</span>
        </div>
      </footer>
    </div>
  )
}


// =====================================================
// SHARED STYLES
// =====================================================

const authPanelStyle = {
  maxWidth: '420px',
  margin: '20px auto',
  padding: '28px',
  background: '#fff',
  color: '#171717',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
}

const authInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px',
  marginBottom: '16px',
  border: '1px solid #ccc',
  borderRadius: '6px',
}

const formInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  background: '#fff',
  color: '#171717',
}

const formLabelStyle = {
  display: 'block',
  marginBottom: '7px',
  fontWeight: '600',
  fontSize: '14px',
}

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '17px',
}

const dashboardCardStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '23px',
  boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
}

const kickerStyle = {
  color: '#a67c18',
  fontWeight: 'bold',
  letterSpacing: '2px',
  fontSize: '12px',
}

const errorStyle = {
  color: '#b42318',
  background: '#fff1f0',
  border: '1px solid #ffc9c5',
  padding: '11px',
  borderRadius: '6px',
  fontSize: '14px',
  overflowWrap: 'anywhere',
  marginBottom: '15px',
}

const secondaryButtonStyle = {
  padding: '11px 16px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  background: '#fff',
  color: '#171717',
  cursor: 'pointer',
  marginTop: '10px',
}

const textButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#b8860b',
  fontWeight: 'bold',
  cursor: 'pointer',
}



// =====================================================
// MAIN APP ROUTES
// =====================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* MARKETPLACE */}
        <Route path="/" element={<Marketplace />} />

        {/* VEHICLE DETAILS */}
        <Route
          path="/vehicles/:id"
          element={<VehicleDetails />}
        />

        {/* ADMIN BIDS DASHBOARD */}
        <Route
          path="/admin/bids"
          element={<AdminBidsDashboard />}
        />

      {/* BUYER MY BIDS PAGE */}
       <Route
       path="/my-bids"
       element={<BuyerMyBids />}
        />
        {/* SELLER PORTAL */}
        <Route
          path="/seller"
          element={<SellerPortal />}
        />

        {/* SELLER EDIT VEHICLE PAGE */}
        <Route
          path="/seller/edit/:id"
          element={<SellerEditPage />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
