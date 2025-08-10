import { useState } from 'react'
import OverlaysTab from './overlays/OverlaysTab'
import OrdersTab from './orders/OrdersTab'
import HistoryTab from './history/HistoryTab'
import BasketTab from './baskets/BasketTab'
import WalletBadge from '../WalletBadge'

function Dashboard() {
  // Default to 'orders' and show its tab first
  const [activeTab, setActiveTab] = useState<'overlays' | 'orders' | 'history' | 'basket'>('orders')

  return (
    <div className="dashboard-container">
      <nav className="top-navbar">
        <div className="navbar-content" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="nav-title">Energy Dashboard</div>

          {/* Reordered buttons: Orders first, then Overlays */}
          <div className="nav-tabs">
            <button
              className={`nav-button ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              🤝 Orders
            </button>
            <button
              className={`nav-button ${activeTab === 'overlays' ? 'active' : ''}`}
              onClick={() => setActiveTab('overlays')}
            >
              🌐 Overlays
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

          {/* Wallet badge on far right */}
          <div style={{ marginLeft: 'auto' }}>
            <WalletBadge />
          </div>
        </div>
      </nav>

      <div className="tab-content">
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'overlays' && <OverlaysTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'basket' && <BasketTab />}
      </div>
    </div>
  )
}

export default Dashboard
