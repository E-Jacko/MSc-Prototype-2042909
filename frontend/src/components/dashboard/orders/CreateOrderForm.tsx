// simple create form with uniform width and labels above

import { useState } from 'react'

export type OrderFormData = {
  type: 'offer' | 'demand'
  quantity: number
  price: number
  currency: 'GBP' | 'SATS'
  expiryDate: string            // 'YYYY-MM-DDTHH:MM'
  overlay: string               // e.g. 'Cardiff – Cathays'
}

type Props = { onSubmit: (data: OrderFormData) => void }

function CreateOrderForm({ onSubmit }: Props) {
  // local form state
  const [formData, setFormData] = useState<OrderFormData>({
    type: 'offer',
    quantity: 0,
    price: 0,
    currency: 'GBP',
    expiryDate: '',
    overlay: 'Cardiff – Cathays'
  })

  // shared sizing so fields line up nicely
  const FIELD_WIDTH = 280
  const GAP_PX = 8
  const BTN_W = 70

  // tiny styles
  const fieldWrap: React.CSSProperties = { marginBottom: '1rem', width: FIELD_WIDTH }
  const labelStyle: React.CSSProperties = { marginBottom: '0.25rem', fontWeight: 500, textAlign: 'left' }
  const inputStyle: React.CSSProperties = {
    padding: '0.5rem',
    fontSize: '1rem',
    backgroundColor: '#1f1f1f',
    border: '1px solid #555',
    color: 'white',
    borderRadius: 4,
    width: FIELD_WIDTH
  }
  const currencyBtn: React.CSSProperties = {
    ...inputStyle,
    width: BTN_W,
    textAlign: 'center',
    padding: '0.5rem',
    cursor: 'pointer'
  }
  const priceInput: React.CSSProperties = {
    ...inputStyle,
    width: `calc(${FIELD_WIDTH}px - ${GAP_PX}px - ${BTN_W}px)`
  }

  // handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' ? Number(value) : value
    }))
  }

  // swap price unit
  const toggleCurrency = () => {
    setFormData(prev => ({ ...prev, currency: prev.currency === 'GBP' ? 'SATS' : 'GBP' }))
  }

  // submit upstream and reset
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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {/* type */}
      <div style={fieldWrap}>
        <label style={labelStyle}>Type:</label>
        <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
          <option value="offer">Offer</option>
          <option value="demand">Demand</option>
        </select>
      </div>

      {/* quantity */}
      <div style={fieldWrap}>
        <label style={labelStyle}>Quantity (kWh):</label>
        <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} style={inputStyle} min={0}/>
      </div>

      {/* price + currency toggle (row totals exactly FIELD_WIDTH) */}
      <div style={fieldWrap}>
        <label style={labelStyle}>Price ({formData.currency === 'GBP' ? '£' : 'sats'} / kWh):</label>
        <div style={{ display: 'flex', gap: GAP_PX }}>
          <input type="number" name="price" value={formData.price} onChange={handleChange} style={priceInput} min={0}/>
          <button type="button" onClick={toggleCurrency} style={currencyBtn}>{formData.currency}</button>
        </div>
      </div>

      {/* expiry with time */}
      <div style={fieldWrap}>
        <label style={labelStyle}>Expiry Date & Time:</label>
        <input type="datetime-local" name="expiryDate" value={formData.expiryDate} onChange={handleChange} style={inputStyle}/>
      </div>

      {/* overlay */}
      <div style={{ ...fieldWrap, marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Overlay:</label>
        <select name="overlay" value={formData.overlay} onChange={handleChange} style={inputStyle}>
          <option value="Cardiff – Cathays">Cardiff – Cathays</option>
        </select>
      </div>

      {/* submit */}
      <button
        type="submit"
        style={{
          ...inputStyle,
          backgroundColor: '#007bff',
          color: '#fff',
          fontWeight: 'bold',
          marginTop: '0.5rem',
          width: FIELD_WIDTH,
          cursor: 'pointer'
        }}
      >
        Create Order
      </button>
    </form>
  )
}

export default CreateOrderForm
