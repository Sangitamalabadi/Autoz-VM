
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { initializeCSRF, BACKEND_URL } from './api'
import './VehicleDetails.css'

const MILES_PER_KM = 0.621371

const TICKET_TYPES = [
  { value: 'FRAUD', label: 'Fraud / Fake Vehicle' },
  { value: 'PAYMENT', label: 'Payment Issue' },
  { value: 'VEHICLE', label: 'Vehicle Not As Described' },
  { value: 'OTHER', label: 'Other' },
]
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
    maximumFractionDigits: 2,
  }).format(Number(price || 0))
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatMileage(kilometers) {
  const miles = Number(kilometers || 0) * MILES_PER_KM
  return `${formatNumber(Math.round(miles))} miles`
}

function formatDate(date) {
  if (!date) return 'Not available'

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not available'
  }

  return parsedDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getApiError(error, fallback) {
  const data = error?.response?.data

  if (typeof data === 'string') return data

  if (data?.detail) return data.detail
  if (data?.error) return data.error
  if (data?.message) return data.message

  if (data && typeof data === 'object') {
    const firstValue = Object.values(data)[0]

    if (Array.isArray(firstValue)) {
      return String(firstValue[0])
    }

    if (typeof firstValue === 'string') {
      return firstValue
    }
  }

  return fallback
}

function getAuctionList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

function isAuctionEnded(auction) {
  if (!auction) return true

  return (
    auction.is_active === false ||
    auction.is_expired === true ||
    auction.is_closed === true ||
    (
      auction.end_time &&
      new Date(auction.end_time).getTime() <= Date.now()
    )
  )
}

function VehicleDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState(null)
  const [auction, setAuction] = useState(null)
  const [bids, setBids] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState(false)

  const [bidderName, setBidderName] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [bidLoading, setBidLoading] = useState(false)
  const [bidError, setBidError] = useState('')
  const [bidMessage, setBidMessage] = useState('')

  const [issueType, setIssueType] = useState('FRAUD')
  const [reportMessage, setReportMessage] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSuccess, setReportSuccess] = useState('')

  const [auctionTime, setAuctionTime] = useState(Date.now())

  // =====================================
  // AUCTION SELECTION
  // =====================================

  const selectVehicleAuction = useCallback((auctionList) => {
    const matchingAuctions = auctionList.filter(
      (item) => Number(item.vehicle?.id) === Number(id)
    )

    if (!matchingAuctions.length) return null

    const activeAuctions = matchingAuctions.filter(
      (item) => !isAuctionEnded(item)
    )

    const candidates = activeAuctions.length
      ? activeAuctions
      : matchingAuctions

    return [...candidates].sort((a, b) => {
      return Number(b.id) - Number(a.id)
    })[0]
  }, [id])

  // =====================================
  // LOAD VEHICLE AND AUCTION
  // =====================================

  const loadDetails = useCallback(async () => {
    const [vehicleResponse, auctionResponse] = await Promise.all([
      api.get(`vehicles/${id}/`),
      api.get('auctions/'),
    ])

    const vehicleData = vehicleResponse.data
    const auctionList = getAuctionList(auctionResponse.data)

    const matchingAuction = selectVehicleAuction(auctionList)

    setVehicle(vehicleData)
    setAuction(matchingAuction)

    setBids(
      Array.isArray(matchingAuction?.bids)
        ? matchingAuction.bids
        : []
    )
  }, [id, selectVehicleAuction])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError('')
        setImageError(false)

        await loadDetails()
      } catch (err) {
        console.error('Vehicle details error:', err)

        if (active) {
          setError(
            getApiError(err, 'Unable to load vehicle details.')
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [loadDetails])

  // =====================================
  // AUCTION STATUS TIMER
  // =====================================

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAuctionTime(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const isAuctionClosed = useMemo(() => {
    if (!auction) return true

    return (
      auction.is_active === false ||
      auction.is_expired === true ||
      auction.is_closed === true ||
      (
        auction.end_time &&
        new Date(auction.end_time).getTime() <= auctionTime
      ) ||
      vehicle?.is_sold === true
    )
  }, [auction, vehicle, auctionTime])

  const currentPrice = Number(
    auction?.current_price ?? auction?.base_price ?? vehicle?.price ?? 0
  )

  const minimumBid = currentPrice + 1000

  // =====================================
  // REFRESH AUCTION DATA
  // =====================================

  const refreshAuctionData = useCallback(async () => {
    if (!auction?.id) return

    try {
      const [auctionResponse, bidResponse] = await Promise.all([
        api.get(`auctions/${auction.id}/`),
        api.get(`auctions/${auction.id}/bids/`),
      ])

      setAuction(auctionResponse.data)
      setBids(getAuctionList(bidResponse.data))

    } catch (err) {
      console.error('Auction refresh error:', err)

      try {
        const response = await api.get('auctions/')

        const updatedAuction = getAuctionList(response.data).find(
          (item) => Number(item.id) === Number(auction.id)
        )

        if (updatedAuction) {
          setAuction(updatedAuction)

          setBids(
            Array.isArray(updatedAuction.bids)
              ? updatedAuction.bids
              : []
          )
        }
      } catch (fallbackError) {
        console.error(
          'Auction fallback refresh error:',
          fallbackError
        )
      }
    }
  }, [auction?.id])

  // =====================================
  // QUICK BID
  // =====================================

  function handleQuickBid(amount) {
    setBidAmount((minimumBid + amount).toFixed(2))
    setBidError('')
    setBidMessage('')
  }

  // =====================================
  // PLACE BID - CSRF PROTECTED
  // =====================================

  async function handlePlaceBid(event) {
    event.preventDefault()

    if (bidLoading) return

    setBidError('')
    setBidMessage('')

    if (!auction) {
      setBidError('Auction is not available for this vehicle.')
      return
    }

    if (isAuctionClosed) {
      setBidError('This auction is closed.')
      return
    }

    const amount = Number(bidAmount)

    if (!Number.isFinite(amount) || amount < minimumBid) {
      setBidError(
        `Your bid must be at least ${formatPrice(minimumBid)}.`
      )
      return
    }

    if (!bidderName.trim()) {
      setBidError('Please enter your name.')
      return
    }

    try {
      setBidLoading(true)

      const csrfToken = await initializeCSRF()

      if (!csrfToken) {
        throw new Error(
          'Unable to obtain CSRF token. Please refresh the page.'
        )
      }

      const response = await api.post(
        'bids/',
        {
          auction: auction.id,
          bidder_name: bidderName.trim(),
          bid_amount: amount.toFixed(2),
        },
        {
          withCredentials: true,
          headers: {
            'X-CSRFToken': csrfToken,
          },
        }
      )

      console.log('Bid submitted successfully:', response.data)

      setBidMessage('Your bid has been submitted successfully!')
      setBidAmount('')

      await refreshAuctionData()

    } catch (err) {
      console.error('Bid submission error:', err)
      console.error('Bid error response:', err.response?.data)

      if (err.response?.status === 403) {
        setBidError(
          'CSRF verification failed. Please refresh the page and try again.'
        )
      } else {
        setBidError(
          getApiError(
            err,
            'Unable to place your bid. Please try again.'
          )
        )
      }

      await refreshAuctionData()

    } finally {
      setBidLoading(false)
    }
  }

  // =====================================
  // REPORT VEHICLE
  // =====================================

  async function handleReportVehicle(event) {
    event.preventDefault()

    setReportError('')
    setReportSuccess('')

    if (reportLoading) return

    if (!vehicle?.id) {
      setReportError('Vehicle information is not available.')
      return
    }

    if (!reportMessage.trim()) {
      setReportError('Please describe the issue.')
      return
    }

    try {
      setReportLoading(true)

      const csrfToken = await initializeCSRF()

      if (!csrfToken) {
        throw new Error('Unable to obtain CSRF token.')
      }

      await api.post(
        'tickets/',
        {
          vehicle: vehicle.id,
          issue_type: issueType,
          message: reportMessage.trim(),
        },
        {
          withCredentials: true,
          headers: {
            'X-CSRFToken': csrfToken,
          },
        }
      )

      setReportSuccess(
        'Your report has been submitted successfully.'
      )

      setReportMessage('')
      setIssueType('FRAUD')

    } catch (err) {
      console.error('Report submission error:', err)

      setReportError(
        getApiError(err, 'Unable to submit your report.')
      )

    } finally {
      setReportLoading(false)
    }
  }

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <div className="details-state">
        <div className="details-loader" />
        <h2>Loading Vehicle Details</h2>
        <p>
          Please wait while we prepare your vehicle information.
        </p>
      </div>
    )
  }

  // =====================================
  // ERROR
  // =====================================

  if (error || !vehicle) {
    return (
      <div className="details-state">
        <h2>{error || 'Vehicle not found'}</h2>

        <button onClick={() => navigate('/')}>
          Back to Marketplace
        </button>
      </div>
    )
  }

  // =====================================
  // MAIN UI
  // =====================================

  return (
    <div className="details-page">

      <header className="details-header">
        <button
          onClick={() => navigate('/')}
          className="back-button"
        >
          ← Back to Vehicles
        </button>

        <div className="details-logo">
          AUTO<span>Z</span>
        </div>

        <span className="header-market-label">
          US & UK MARKETPLACE
        </span>
      </header>

      <main className="details-container">

        {/* VEHICLE IMAGE */}

        <section className="details-image-section">
          {vehicle.image && !imageError ? (
            <img
              src={getImageUrl(vehicle.image)}
              alt={vehicle.title || 'Vehicle'}
              className="details-main-image"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="details-no-image">
              AUTOZ
            </div>
          )}

          <span className="details-verified">
            {vehicle.is_verified
              ? '✓ VERIFIED VEHICLE'
              : 'NOT VERIFIED'}
          </span>

          <div className="image-caption">
            Premium Vehicle Collection
          </div>
        </section>

        {/* VEHICLE INFORMATION */}

        <section className="details-information">

          <span className="details-company">
            {vehicle.company_name || vehicle.company?.name || 'PREMIUM AUTOMOTIVE'}
          </span>

          <h1>{vehicle.title}</h1>

          <div className="details-price">
            {formatPrice(vehicle.price)}
          </div>

          <span className={
            vehicle.is_sold
              ? 'details-status sold'
              : 'details-status available'
          }>
            {vehicle.is_sold ? 'SOLD' : 'AVAILABLE'}
          </span>

          <h2>Vehicle Specifications</h2>

          <div className="specifications-grid">

            <div className="specification">
              <span>Year</span>
              <strong>{vehicle.year || 'N/A'}</strong>
            </div>

            <div className="specification">
              <span>Model</span>
              <strong>{vehicle.model_name || 'N/A'}</strong>
            </div>

            <div className="specification">
              <span>Mileage</span>
              <strong>{formatMileage(vehicle.km_driven)}</strong>
            </div>

            <div className="specification">
              <span>Category</span>
              <strong>{vehicle.category || 'N/A'}</strong>
            </div>

            <div className="specification">
              <span>Ownership</span>
              <strong>{vehicle.owner || 'N/A'}</strong>
            </div>

            <div className="specification">
              <span>Verification</span>
              <strong>
                {vehicle.is_verified ? 'Verified' : 'Pending'}
              </strong>
            </div>

          </div>

          {/* DESCRIPTION */}

          <div className="details-description">
            <h2>Vehicle Description</h2>

            <p>
              {vehicle.description || 'No description available.'}
            </p>
          </div>

          {/* AUCTION */}

          <section className="auction-section">

            <div className="auction-heading">
              <div>
                <span className="section-eyebrow">
                  LIVE MARKETPLACE
                </span>

                <h2>Auction Details</h2>
              </div>

              <span className={
                isAuctionClosed
                  ? 'auction-status closed'
                  : 'auction-status live'
              }>
                {isAuctionClosed ? 'AUCTION CLOSED' : 'LIVE AUCTION'}
              </span>
            </div>

            {auction ? (
              <>

                <div className="auction-price-grid">

                  <div className="auction-price-card">
                    <span>Base Price</span>
                    <strong>
                      {formatPrice(auction.base_price)}
                    </strong>
                  </div>

                  <div className="auction-price-card highlight">
                    <span>Current Highest Bid</span>
                    <strong>
                      {formatPrice(auction.current_price)}
                    </strong>
                  </div>

                  <div className="auction-price-card">
                    <span>Total Bids</span>
                    <strong>
                      {auction.bid_count ?? bids.length}
                    </strong>
                  </div>

                </div>

                <div className="auction-ending">
                  <span>Auction Ending Date</span>
                  <strong>
                    {formatDate(auction.end_time)}
                  </strong>
                </div>

                {/* BID HISTORY */}

                <div className="bid-history-section">

                  <div className="section-title-row">
                    <h2>Bid History</h2>

                    <span>
                      {bids.length} Records
                    </span>
                  </div>

                  {bids.length > 0 ? (
                    <div className="bid-history-list">

                      {bids.map((bid) => (
                        <div
                          className="bid-history-item"
                          key={bid.id}
                        >

                          <div>
                            <strong>
                              {bid.bidder_name}
                            </strong>

                            <span>
                              {formatDate(bid.bid_time)}
                            </span>
                          </div>

                          <strong className="bid-history-amount">
                            {formatPrice(bid.bid_amount)}
                          </strong>

                        </div>
                      ))}

                    </div>
                  ) : (
                    <p className="no-bids">
                      No bid history is available yet.
                    </p>
                  )}

                </div>

                {/* PLACE BID */}

                <div className="place-bid-section">

                  <h2>Place Your Bid</h2>

                  {isAuctionClosed ? (
                    <div className="auction-closed-message">
                      This auction has ended. New bids are not accepted.
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBid}>

                      <div className="minimum-bid-info">
                        <span>Minimum Bid Amount</span>

                        <strong>
                          {formatPrice(minimumBid)}
                        </strong>
                      </div>

                      <label htmlFor="bidderName">
                        Your Name
                      </label>

                      <input
                        id="bidderName"
                        type="text"
                        value={bidderName}
                        onChange={(event) => setBidderName(event.target.value)}
                        placeholder="Enter your full name"
                        maxLength={100}
                        autoComplete="name"
                        required
                      />

                      <label htmlFor="bidAmount">
                        Your Bid Amount (USD)
                      </label>

                      <input
                        id="bidAmount"
                        type="number"
                        min={minimumBid}
                        step="0.01"
                        value={bidAmount}
                        onChange={(event) => setBidAmount(event.target.value)}
                        placeholder={`Minimum ${minimumBid}`}
                        required
                      />

                      <div className="quick-bid-buttons">

                        <button
                          type="button"
                          onClick={() => handleQuickBid(5000)}
                        >
                          +$5K
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickBid(10000)}
                        >
                          +$10K
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickBid(50000)}
                        >
                          +$50K
                        </button>

                      </div>

                      {bidError && (
                        <div className="form-error" role="alert">
                          {bidError}
                        </div>
                      )}

                      {bidMessage && (
                        <div className="form-success" role="status">
                          {bidMessage}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="place-bid-button"
                        disabled={bidLoading || isAuctionClosed}
                      >
                        {bidLoading
                          ? 'Submitting...'
                          : 'Place Your Bid →'}
                      </button>

                    </form>
                  )}

                </div>

              </>
            ) : (
              <div className="no-auction-message">
                No auction is currently available for this vehicle.
              </div>
            )}

          </section>

          {/* REPORT VEHICLE */}

          <section className="report-section">

            <span className="section-eyebrow">
              CUSTOMER SUPPORT
            </span>

            <h2>Report This Vehicle</h2>

            <p>
              Found suspicious information or an issue with this listing?
              Send a report to our support team.
            </p>

            <form onSubmit={handleReportVehicle}>

              <label htmlFor="issueType">
                Issue Type
              </label>

              <select
                id="issueType"
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
              >
                {TICKET_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>

              <label htmlFor="reportMessage">
                Describe Your Issue
              </label>

              <textarea
                id="reportMessage"
                rows="4"
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
                placeholder="Tell us what happened..."
                maxLength={2000}
                required
              />

              {reportError && (
                <div className="form-error" role="alert">
                  {reportError}
                </div>
              )}

              {reportSuccess && (
                <div className="form-success" role="status">
                  {reportSuccess}
                </div>
              )}

              <button
                type="submit"
                className="report-submit-button"
                disabled={reportLoading}
              >
                {reportLoading
                  ? 'Submitting...'
                  : 'Submit Report →'}
              </button>

            </form>

          </section>

          <button
            className="details-back-button"
            onClick={() => navigate('/')}
          >
            ← Back to Marketplace
          </button>

        </section>

      </main>

      <footer className="details-footer">

        <div className="details-logo">
          AUTO<span>Z</span>
        </div>

        <p>
          Premium Vehicle Marketplace · US & UK
        </p>

      </footer>

    </div>
  )
}

export default VehicleDetails
