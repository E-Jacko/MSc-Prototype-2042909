import { useState } from 'react'
import OverlaysTab from './overlays/OverlaysTab'
import OrdersTab from './orders/OrdersTab'
import HistoryTab from './history/HistoryTab'
import BasketTab from './baskets/BasketTab'

function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overlays' | 'orders' | 'history' | 'basket'>('overlays')

  return (
    <div className="dashboard-container">
      <nav className="top-navbar">
        <div className="navbar-content">
          <div className="nav-title">Energy Dashboard</div>
          <div className="nav-tabs">
            <button
              className={`nav-button ${activeTab === 'overlays' ? 'active' : ''}`}
              onClick={() => setActiveTab('overlays')}
            >
              🌐 Overlays
            </button>
            <button
              className={`nav-button ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              🤝 Orders
            </button>
            <button
              className={`nav-button ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              🕘 History
            </button>
            <button
              className={`nav-button ${activeTab === 'basket' ? 'active' : ''}`}
              onClick={() => setActiveTab('basket')}
            >
              🧺 Basket
            </button>
          </div>
        </div>
      </nav>

      <div className="tab-content">
        {activeTab === 'overlays' && <OverlaysTab />}
        {activeTab === 'orders' && <OrdersTab />}     {/* ✅ updated */}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'basket' && <BasketTab />}
      </div>
    </div>
  )
}

export default Dashboard
