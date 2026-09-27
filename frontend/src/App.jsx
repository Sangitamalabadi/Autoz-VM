import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [cars, setCars] = useState([])
  const [allCars, setAllCars] = useState([])
  const [selectedCompany, setSelectedCompany] = useState('')

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/vehicles/').then(res => {
      setCars(res.data)
      setAllCars(res.data)
    })
  }, [])

  // Vehicle madhunach Company list banvu
  const companys = [...new Set(allCars.map(c => c.company_name))]

  const handleCompanyClick = (name) => {
    setSelectedCompany(name)
    if (name === '') {
      setCars(allCars)
    } else {
      setCars(allCars.filter(c => c.company_name === name))
    }
  }

  return (
    <div style={{background: '#f2f4f5', minHeight: '100vh', fontFamily: 'Arial'}}>
      <div style={{background: '#002f34', color: 'white', padding: '12px 20px', display: 'flex', justifyContent: 'space-between'}}>
        <h2 style={{margin:0}}>Autoz - Solapur Marketplace</h2>
        <span>Buy & Sell Cars</span>
      </div>

      <div style={{padding: '15px', background: 'white', display: 'flex', gap: '10px', overflowX: 'auto', boxShadow: '0 2px 4px #ccc'}}>
        <button onClick={() => handleCompanyClick('')} style={{padding: '8px 16px', borderRadius: '20px', border: '1px solid', background: selectedCompany===''?'#002f34':'white', color: selectedCompany===''?'white':'black', cursor:'pointer', fontWeight:'bold'}}>All</button>
        {companys.map(name => (
          <button key={name} onClick={() => handleCompanyClick(name)} style={{padding: '8px 16px', borderRadius: '20px', border: '1px solid', background: selectedCompany===name?'#002f34':'white', color: selectedCompany===name?'white':'black', cursor:'pointer', fontWeight:'bold'}}>{name}</button>
        ))}
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', padding: '20px'}}>
        {cars.map(car => (
          <div key={car.id} style={{background: 'white', borderRadius: '4px', border: '1px solid #ddd', overflow: 'hidden'}}>
            <img src={car.image} alt={car.title} style={{width: '100%', height: '200px', objectFit: 'cover'}} />
            <div style={{padding: '10px'}}>
              <h3 style={{margin: '5px 0', color: '#002f34'}}>₹ {Number(car.price).toLocaleString('en-IN')}</h3>
              <p style={{margin: '5px 0', fontSize: '14px'}}>{car.title}</p>
              <p style={{fontSize: '12px', color: '#888'}}>{car.model_name} | {car.year} | {car.km_driven} KM</p>
              <div style={{display: 'flex', justifyContent:'space-between', marginTop: '10px'}}>
                <span style={{background: '#ffe6a8', padding: '2px 8px', fontSize:'11px'}}>{car.company_name}</span>
                <span style={{background: '#c8f7c5', padding: '2px 8px', fontSize:'11px'}}>{car.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App