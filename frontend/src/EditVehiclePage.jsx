
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { initializeCSRF } from './api'

const MAX_IMAGES = 15

function EditVehiclePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState(null)
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
    red: '#b42318',
    green: '#18733b',
  }

  const cardStyle = {
    background: '#fff',
    border: `1px solid ${colors.border}`,
    borderRadius: '16px',
    padding: '25px',
    boxShadow: '0 5px 20px rgba(16,24,39,0.05)',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 13px',
    border: `1px solid ${colors.border}`,
    borderRadius: '9px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: '#fff',
    color: colors.text,
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
    padding: '12px 19px',
    borderRadius: '9px',
    fontWeight: '700',
    cursor: 'pointer',
  }

  const lightButton = {
    background: '#fff',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    padding: '12px 19px',
    borderRadius: '9px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  const getCompanyId = (item, companyList) => {
    if (item.company && typeof item.company === 'object') {
      return String(item.company.id || '')
    }

    if (item.company) return String(item.company)
    if (item.company_id) return String(item.company_id)

    const match = companyList.find(
      (company) => company.name === item.company_name
    )

    return match ? String(match.id) : ''
  }

  const getMiles = (item) => {
    return Math.round(Number(item?.km_driven || 0) * 0.621371)
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        const [vehicleResponse, companyResponse] = await Promise.all([
          api.get('vehicles/my-listings/'),
          api.get('companies/'),
        ])

        const vehicleData =
          vehicleResponse.data?.results || vehicleResponse.data

        const companyData =
          companyResponse.data?.results || companyResponse.data

        const listing = Array.isArray(vehicleData)
          ? vehicleData.find((item) => String(item.id) === String(id))
          : null

        if (!listing) {
          throw new Error('Vehicle listing was not found.')
        }

        if (!mounted) return

        const availableCompanies = Array.isArray(companyData)
          ? companyData
          : []

        setCompanies(availableCompanies)
        setVehicle(listing)

        setForm({
          title: listing.title || '',
          company: getCompanyId(listing, availableCompanies),
          model_name: listing.model_name || '',
          price: listing.price || '',
          year: listing.year || '',
          miles: getMiles(listing),
          category: listing.category || 'Car',
          description: listing.description || '',
          owner: listing.owner || '1st Owner',
        })
      } catch (err) {
        console.error('EDIT PAGE LOAD ERROR:', err)

        if (mounted) {
          setError(
            err.response?.data?.detail ||
            err.message ||
            'Unable to load vehicle details.'
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [id])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (submitting || !vehicle) return

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

    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
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
      await initializeCSRF()

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

      const response = await api.patch(
        `vehicles/${id}/update/`,
        payload,
        { withCredentials: true }
      )

      setSuccess(
        response.data?.message || 'Vehicle listing updated successfully.'
      )
    } catch (err) {
      console.error('UPDATE VEHICLE ERROR:', err)
      console.error('UPDATE VEHICLE RESPONSE:', err.response?.data)

      const data = err.response?.data

      const message =
        typeof data === 'string'
          ? data
          : data?.detail ||
            data?.message ||
            Object.entries(data || {})
              .map(([key, value]) =>
                `${key}: ${Array.isArray(value) ? value.join(', ') : value}`
              )
              .join(' | ') ||
            'Unable to update vehicle listing.'

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: colors.background,
        color: colors.muted,
      }}>
        Loading vehicle details...
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.background,
        padding: '50px 5%',
      }}>
        <div style={cardStyle}>
          <h2>Unable to Open Listing</h2>
          <p style={{ color: colors.red }}>{error}</p>
          <button style={goldButton} onClick={() => navigate('/seller')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const wasRejected = vehicle.listing_status === 'REJECTED'

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.background,
      padding: '35px 4%',
      color: colors.text,
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: '1500px',
        margin: '0 auto',
      }}>

        <header style={{
          ...cardStyle,
          background: colors.navy,
          color: '#fff',
          marginBottom: '22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
        }}>
          <div>
            <div style={{
              color: colors.gold,
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '2px',
            }}>
              AUTOZ SELLER PORTAL
            </div>

            <h1 style={{ margin: '8px 0', fontSize: '27px' }}>
              Edit Vehicle Listing
            </h1>

            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px' }}>
              Update your vehicle information and listing details.
            </p>
          </div>

          <button
            type="button"
            style={{
              ...lightButton,
              background: 'transparent',
              color: '#fff',
              borderColor: '#64748b',
            }}
            onClick={() => navigate('/seller')}
          >
            ← Back to Dashboard
          </button>
        </header>

        <section style={cardStyle}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div>
              <h2 style={{ margin: '0 0 6px' }}>
                Vehicle Information
              </h2>
              <p style={{
                color: colors.muted,
                fontSize: '13px',
                margin: 0,
              }}>
                Listing ID: #{vehicle.id}
              </p>
            </div>

            <span style={{
              background: wasRejected ? '#fff0f0' :
                vehicle.listing_status === 'APPROVED' ? '#e8f7ed' : '#fff5dc',
              color: wasRejected ? colors.red :
                vehicle.listing_status === 'APPROVED' ? colors.green : '#946200',
              padding: '7px 13px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '700',
            }}>
              {vehicle.listing_status || 'PENDING'}
            </span>
          </div>

          {wasRejected && (
            <div style={{
              background: '#fff5dc',
              border: '1px solid #f0d28a',
              color: '#946200',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '13px',
            }}>
              <strong>Re-submission notice</strong>
              <p style={{ margin: '6px 0 0' }}>
                Updating this rejected listing will submit it again for admin
                approval according to the existing backend workflow.
              </p>

              {vehicle.rejection_reason && (
                <p style={{ margin: '9px 0 0' }}>
                  <strong>Admin feedback:</strong> {vehicle.rejection_reason}
                </p>
              )}
            </div>
          )}

          {error && (
            <div role="alert" style={{
              background: '#fff0f0',
              color: colors.red,
              border: '1px solid #f2caca',
              padding: '13px',
              borderRadius: '9px',
              marginBottom: '17px',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div role="status" style={{
              background: '#e9f7ef',
              color: colors.green,
              border: '1px solid #b7e4c7',
              padding: '15px',
              borderRadius: '9px',
              marginBottom: '17px',
              fontSize: '14px',
            }}>
              <strong>✓ {success}</strong>
              <p style={{ margin: '8px 0' }}>
                Your changes have been saved.
              </p>
              <button
                type="button"
                style={goldButton}
                onClick={() => navigate('/seller')}
              >
                Return to Seller Dashboard
              </button>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '18px',
              }}>
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
                    placeholder="X5 xDrive40i"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Price (USD) *</label>
                  <input
                    type="number"
                    name="price"
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
                    type="number"
                    name="year"
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
                    type="number"
                    name="miles"
                    min="0"
                    value={form.miles}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Vehicle Category *</label>
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
                  <label style={labelStyle}>Ownership *</label>
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
                  rows={6}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Describe vehicle condition, features, service history and title status..."
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '11px',
                flexWrap: 'wrap',
                marginTop: '25px',
              }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...goldButton,
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Updating Listing...' : '✓ Update Listing'}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  style={lightButton}
                  onClick={() => navigate('/seller')}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <p style={{
          textAlign: 'center',
          color: colors.muted,
          fontSize: '12px',
          marginTop: '22px',
        }}>
          AUTOZ SELLER PORTAL · UNITED STATES & UNITED KINGDOM
        </p>
      </div>
    </div>
  )
}

export default EditVehiclePage
