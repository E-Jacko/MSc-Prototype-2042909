import { useState } from 'react'

export type OrderFormData = {
  type: 'offer' | 'demand'
  quantity: number
  price: number
  currency: 'GBP' | 'SATS'
  expiryDate: string
  overlay: string
}

type Props = {
  onSubmit: (data: OrderFormData) => void
}

function CreateOrderForm({ onSubmit }: Props) {
  const [formData, setFormData] = useState<OrderFormData>({
    type: 'offer',
    quantity: 0,
    price: 0,
    currency: 'GBP',
    expiryDate: '',
    overlay: 'Cardiff – Cathays'
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' ? Number(value) : value
    }))
  }

  const toggleCurrency = () => {
    setFormData(prev => ({
      ...prev,
      currency: prev.currency === 'GBP' ? 'SATS' : 'GBP'
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({
      type: 'offer',
      quantity: 0,
      price: 0,
      currency: 'GBP',
      expiryDate: '',
      overlay: 'Cardiff – Cathays'
    })
  }

  const labelStyle = {
    marginBottom: '0.25rem',
    fontWeight: 500,
    textAlign: 'left' as const
  }

  const inputStyle = {
    padding: '0.5rem',
    fontSize: '1rem',
    backgroundColor: '#1f1f1f',
    border: '1px solid #555',
    color: 'white',
    borderRadius: '4px',
    width: '250px'
  }

  const priceInputStyle = {
    ...inputStyle,
    width: '170px'
  }

  const currencyButtonStyle = {
    ...inputStyle,
    width: '70px',
    textAlign: 'center' as const,
    padding: '0.5rem',
    cursor: 'pointer'
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {/* Type */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Type:</label>
        <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
          <option value="offer">Offer</option>
          <option value="demand">Demand</option>
        </select>
      </div>

      {/* Quantity */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Quantity (kWh):</label>
        <input
          type="number"
          name="quantity"
          value={formData.quantity}
          onChange={handleChange}
          style={inputStyle}
          min={0}
        />
      </div>

      {/* Price & Currency Toggle */}
      <div style={{ marginBottom: '1rem', width: '250px' }}>
        <label style={labelStyle}>
          Price ({formData.currency === 'GBP' ? '£' : 'sats'} / kWh):
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            style={priceInputStyle}
            min={0}
          />
          <button type="button" onClick={toggleCurrency} style={currencyButtonStyle}>
            {formData.currency}
          </button>
        </div>
      </div>

      {/* Expiry */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Expiry Date:</label>
        <input
          type="date"
          name="expiryDate"
          value={formData.expiryDate}
          onChange={handleChange}
          style={inputStyle}
        />
      </div>

      {/* Overlay */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Overlay:</label>
        <select name="overlay" value={formData.overlay} onChange={handleChange} style={inputStyle}>
          <option value="Cardiff – Cathays">Cardiff – Cathays</option>
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        style={{
          ...inputStyle,
          backgroundColor: '#007bff',
          color: '#fff',
          fontWeight: 'bold',
          marginTop: '0.5rem',
          width: '250px'
        }}
      >
        Create Order
      </button>
    </form>
  )
}

export default CreateOrderForm
