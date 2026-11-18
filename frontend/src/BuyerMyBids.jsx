
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from './api'

const BACKEND_URL = 'http://localhost:8000'

function getImageUrl(image) {
  if (!image) return null

  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image
  }

  return `${BACKEND_URL}${image.startsWith('/') ? '' : '/'}${image}`
}

function formatAmount(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0))
}

function formatDate(date) {
  if (!date) return 'Date unavailable'

  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function BuyerMyBids() {
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function fetchMyBids() {
      try {
        setLoading(true)
        setError('')

        const response = await api.get('bids/my-bids/')

        if (isMounted) {
          const data = response.data
          setBids(Array.isArray(data) ? data : data.results || [])
        }
      } catch (err) {
        if (isMounted) {
          if (
            err.response?.status === 401 ||
            err.response?.status === 403
          ) {
            setError(
              'Please log in with your Buyer account to view your bids.'
            )
          } else {
            setError(
              err.response?.data?.detail ||
              'Unable to load your bids. Please try again.'
            )
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchMyBids()

    return () => {
      isMounted = false
    }
  }, [])

  const highestBids = bids.filter(
    (bid) => bid.is_highest_bid
  ).length

  const outbidBids = bids.length - highestBids

  return (
    <div className="autoz-bids-page">

      <style>{`
        .autoz-bids-page {
          min-height: 100vh;
          padding: 35px 0 45px;
          color: #ffffff;
          background:
            radial-gradient(ellipse at 75% 5%, rgba(174, 122, 32, .13), transparent 38%),
            linear-gradient(135deg, #090909, #111111 55%, #080808);
        }

        .autoz-bids-page * {
          box-sizing: border-box;
        }

        .autoz-bids-header {
          display: grid;
          grid-template-columns: minmax(260px, .9fr) minmax(0, 2fr);
          gap: 25px;
          align-items: center;
          margin-bottom: 32px;
        }

        .autoz-bids-eyebrow {
          color: #eeb747;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }

        .autoz-bids-title {
          font-size: clamp(42px, 5vw, 66px);
          line-height: 1;
          font-weight: 850;
          letter-spacing: -2px;
          color: #ffffff;
          margin: 0 0 13px;
        }

        .autoz-bids-description {
          color: #c1c1c8;
          font-size: 15px;
          margin: 0;
        }

        .autoz-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .autoz-summary-card {
          min-height: 137px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 17px;
          border: 1px solid #a47b32;
          border-radius: 17px;
          background: linear-gradient(145deg, #191919, #0d0d0d);
        }

        .autoz-summary-icon {
          width: 64px;
          height: 64px;
          min-width: 64px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 30px;
          color: #f3bd55;
          background: rgba(219, 165, 58, .12);
        }

        .autoz-summary-label {
          color: #eeeeee;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .autoz-summary-value {
          font-size: 34px;
          font-weight: 850;
          line-height: 1.1;
          margin: 0 0 4px;
          color: #ffffff;
        }

        .autoz-summary-note {
          color: #b9b9c0;
          font-size: 11px;
          margin: 0;
        }

        .autoz-back-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e1ae45;
          color: #f3bd55;
          border-radius: 30px;
          padding: 11px 18px;
          font-size: 13px;
          font-weight: 750;
          text-decoration: none;
          white-space: nowrap;
          transition: .2s;
        }

        .autoz-back-link:hover {
          background: #f3bd55;
          color: #111111;
        }

        .autoz-history-panel {
          padding: 20px;
          border: 1px solid #59451f;
          border-radius: 19px;
          background: rgba(8, 8, 8, .91);
        }

        .autoz-history-title {
          color: #ffffff;
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 5px;
        }

        .autoz-history-subtitle {
          color: #b8bbc4;
          font-size: 14px;
          margin: 0;
        }

        .autoz-record-count {
          color: #f3bd55;
          border: 1px solid #b88a35;
          border-radius: 30px;
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 750;
          white-space: nowrap;
        }

        .autoz-bid-row {
          display: grid;
          grid-template-columns: 270px minmax(170px, 1.25fr) minmax(170px, .9fr) minmax(145px, .8fr) 155px;
          align-items: center;
          gap: 20px;
          padding: 9px 12px;
          min-height: 142px;
          margin-top: 15px;
          border: 1px solid #303030;
          border-radius: 17px;
          background: linear-gradient(110deg, #181818, #0d0e10);
          transition: .2s;
        }

        .autoz-bid-row:hover {
          border-color: #b58a3c;
          transform: translateY(-2px);
        }

        .autoz-bid-image {
          width: 100%;
          height: 122px;
          display: block;
          object-fit: cover;
          border-radius: 13px;
          background: #222222;
        }

        .autoz-no-image {
          height: 122px;
          border-radius: 13px;
          background: #202020;
          color: #aaa;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 13px;
        }

        .autoz-vehicle-title {
          color: #ffffff;
          font-size: 19px;
          font-weight: 800;
          margin: 0 0 9px;
          overflow-wrap: anywhere;
        }

        .autoz-vehicle-info {
          color: #b9bdc8;
          font-size: 13px;
          margin: 0 0 7px;
          overflow-wrap: anywhere;
        }

        .autoz-amount-section {
          border-left: 1px solid #414141;
          border-right: 1px solid #414141;
          padding: 8px 20px;
          min-width: 0;
        }

        .autoz-amount-label {
          color: #b8bbc4;
          font-size: 14px;
          margin-bottom: 5px;
        }

        .autoz-amount {
          color: #f3bd55;
          font-size: clamp(23px, 2.3vw, 34px);
          font-weight: 850;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .autoz-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 30px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .autoz-highest {
          color: #35d98b;
          background: rgba(30, 190, 110, .12);
          border: 1px solid #20b96b;
        }

        .autoz-outbid {
          color: #ff5555;
          background: rgba(255, 55, 55, .10);
          border: 1px solid #e33d3d;
        }

        .autoz-status-note {
          color: #b8bbc4;
          font-size: 12px;
          line-height: 1.45;
          margin: 9px 0 0;
        }

        .autoz-view-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          padding: 13px 12px;
          border-radius: 30px;
          background: linear-gradient(135deg, #f8cf76, #e9ad3e);
          color: #111111;
          font-size: 13px;
          font-weight: 850;
          text-decoration: none;
          white-space: nowrap;
          transition: .2s;
        }

        .autoz-view-button:hover {
          color: #111111;
          background: #ffffff;
          transform: translateY(-2px);
        }

        .autoz-bottom-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 22px;
          padding: 14px 20px;
          border: 1px solid #73551f;
          border-radius: 15px;
          background: linear-gradient(90deg, #17130b, #101010);
        }

        .autoz-bottom-message {
          color: #f3bd55;
          font-size: 15px;
          font-weight: 750;
          margin: 0;
        }

        .autoz-explore-button {
          background: linear-gradient(135deg, #f8cf76, #e9ad3e);
          color: #111111;
          padding: 10px 18px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 850;
          text-decoration: none;
          white-space: nowrap;
        }

        .autoz-explore-button:hover {
          background: #ffffff;
          color: #111111;
        }

        .autoz-empty-state {
          text-align: center;
          padding: 55px 20px;
          color: #aaa;
        }

        @media (max-width: 1100px) {
          .autoz-bids-header {
            grid-template-columns: 1fr;
          }

          .autoz-bid-row {
            grid-template-columns: 210px 1fr 1fr;
            gap: 16px;
          }

          .autoz-amount-section {
            border: 0;
            padding: 8px 0;
          }

          .autoz-status-section {
            grid-column: 2;
          }

          .autoz-view-section {
            grid-column: 3;
          }
        }

        @media (max-width: 767px) {
          .autoz-bids-page {
            padding: 27px 0 40px;
          }

          .autoz-bids-header {
            gap: 22px;
          }

          .autoz-summary-grid {
            grid-template-columns: 1fr;
          }

          .autoz-summary-card {
            min-height: 105px;
          }

          .autoz-history-panel {
            padding: 13px;
          }

          .autoz-history-title {
            font-size: 22px;
          }

          .autoz-bid-row {
            grid-template-columns: 1fr;
            gap: 13px;
            padding: 12px;
          }

          .autoz-bid-image,
          .autoz-no-image {
            height: 205px;
          }

          .autoz-vehicle-title {
            font-size: 19px;
          }

          .autoz-amount-section {
            border-top: 1px solid #414141;
            border-bottom: 1px solid #414141;
            padding: 13px 0;
          }

          .autoz-status-section,
          .autoz-view-section {
            grid-column: auto;
          }

          .autoz-view-button {
            width: 100%;
          }

          .autoz-bottom-banner {
            align-items: flex-start;
            flex-direction: column;
          }

          .autoz-explore-button {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      <div className="container">

        {/* PAGE HEADER AND SUMMARY */}

        <div className="autoz-bids-header">

          <div>
            <p className="autoz-bids-eyebrow">
              AUTOZ AUCTION ACCOUNT
            </p>

            <h1 className="autoz-bids-title">
              My Bids
            </h1>

            <p className="autoz-bids-description">
              Track your bids and monitor your auction activity.
            </p>
          </div>

          <div className="d-flex flex-column gap-3">

            <div className="d-flex justify-content-end">
              <Link to="/" className="autoz-back-link">
                ← &nbsp; Back to Marketplace
              </Link>
            </div>

            <div className="autoz-summary-grid">

              <div className="autoz-summary-card">
                <div className="autoz-summary-icon">
                  🔨
                </div>

                <div>
                  <p className="autoz-summary-label">
                    Total Bids
                  </p>

                  <h3 className="autoz-summary-value">
                    {bids.length}
                  </h3>

                  <p className="autoz-summary-note">
                    All bids placed by you
                  </p>
                </div>
              </div>

              <div className="autoz-summary-card">
                <div
                  className="autoz-summary-icon"
                  style={{
                    color: '#35d98b',
                    background: 'rgba(30,190,110,.12)',
                  }}
                >
                  🏆
                </div>

                <div>
                  <p className="autoz-summary-label">
                    Highest Bids
                  </p>

                  <h3
                    className="autoz-summary-value"
                    style={{ color: '#35d98b' }}
                  >
                    {highestBids}
                  </h3>

                  <p className="autoz-summary-note">
                    Currently leading bids
                  </p>
                </div>
              </div>

              <div className="autoz-summary-card">
                <div
                  className="autoz-summary-icon"
                  style={{
                    color: '#ff5555',
                    background: 'rgba(255,55,55,.10)',
                  }}
                >
                  ✕
                </div>

                <div>
                  <p className="autoz-summary-label">
                    Outbid
                  </p>

                  <h3
                    className="autoz-summary-value"
                    style={{ color: '#ff5555' }}
                  >
                    {outbidBids}
                  </h3>

                  <p className="autoz-summary-note">
                    Bids exceeded by others
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="text-center py-5">
            <div
              className="spinner-border"
              style={{ color: '#f3bd55' }}
              role="status"
            />

            <p className="mt-3 autoz-bids-description">
              Loading your bids...
            </p>
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div
            className="alert"
            style={{
              background: '#291c1c',
              color: '#ffb4b4',
              border: '1px solid #673333',
              borderRadius: '10px',
            }}
          >
            {error}
          </div>
        )}

        {/* BID HISTORY */}

        {!loading && !error && (
          <>

            <div className="autoz-history-panel">

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">

                <div>
                  <h3 className="autoz-history-title">
                    ◴ &nbsp; Your Bidding History
                  </h3>

                  <p className="autoz-history-subtitle">
                    Review all your vehicle auction bids.
                  </p>
                </div>

                <span className="autoz-record-count">
                  {bids.length} Total Records
                </span>

              </div>

              {/* NO BIDS */}

              {bids.length === 0 && (
                <div className="autoz-empty-state">
                  <div style={{ fontSize: '48px' }}>
                    🏎️
                  </div>

                  <h4 className="text-white mt-3">
                    No Bids Yet
                  </h4>

                  <p>
                    Vehicles you bid on will appear here.
                  </p>

                  <Link
                    to="/"
                    className="autoz-view-button"
                    style={{
                      maxWidth: '220px',
                      margin: '20px auto 0',
                    }}
                  >
                    Explore Vehicles →
                  </Link>
                </div>
              )}

              {/* BID LIST */}

              {bids.map((bid) => {
                const imageUrl = getImageUrl(bid.vehicle_image)

                return (
                  <div className="autoz-bid-row" key={bid.id}>

                    {/* VEHICLE IMAGE */}

                    <div>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={bid.vehicle_title || 'Vehicle'}
                          className="autoz-bid-image"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                            const fallback = event.currentTarget.nextElementSibling
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}

                      <div
                        className="autoz-no-image"
                        style={{
                          display: imageUrl ? 'none' : 'flex',
                        }}
                      >
                        No Vehicle Image
                      </div>
                    </div>

                    {/* VEHICLE DETAILS */}

                    <div>
                      <h4 className="autoz-vehicle-title">
                        {bid.vehicle_title || 'Vehicle'}
                      </h4>

                      <p className="autoz-vehicle-info">
                        Auction ID: #{bid.auction}
                      </p>

                      <p className="autoz-vehicle-info mb-0">
                        ▣ &nbsp; Bid Placed: {formatDate(bid.bid_time)}
                      </p>
                    </div>

                    {/* BID AMOUNT */}

                    <div className="autoz-amount-section">
                      <p className="autoz-amount-label">
                        Your Bid Amount
                      </p>

                      <h3 className="autoz-amount">
                        {formatAmount(bid.bid_amount)}
                      </h3>
                    </div>

                    {/* STATUS */}

                    <div className="autoz-status-section">

                      {bid.is_highest_bid ? (
                        <>
                          <span className="autoz-status autoz-highest">
                            ✓ &nbsp; Highest Bid
                          </span>

                          <p className="autoz-status-note">
                            You are currently the highest bidder!
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="autoz-status autoz-outbid">
                            ✕ &nbsp; Outbid
                          </span>

                          <p className="autoz-status-note">
                            Another bidder placed a higher bid.
                          </p>
                        </>
                      )}

                    </div>

                    {/* VIEW VEHICLE */}

                    <div className="autoz-view-section">
                      {bid.vehicle_id ? (
                        <Link
                          to={`/vehicles/${bid.vehicle_id}`}
                          className="autoz-view-button"
                        >
                          View Vehicle &nbsp; →
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="autoz-view-button"
                          style={{
                            background: '#393939',
                            color: '#aaaaaa',
                            border: 'none',
                          }}
                        >
                          Vehicle Unavailable
                        </button>
                      )}
                    </div>

                  </div>
                )
              })}

            </div>

            {/* BOTTOM BANNER */}

            <div className="autoz-bottom-banner">
              <p className="autoz-bottom-message">
                🏆 &nbsp; Keep bidding and win your dream vehicle!
              </p>

              <Link to="/" className="autoz-explore-button">
                Explore More Vehicles &nbsp; →
              </Link>
            </div>

          </>
        )}

      </div>
    </div>
  )
}

export default BuyerMyBids
