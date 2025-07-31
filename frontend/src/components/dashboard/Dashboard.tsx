import { useState } from 'react'
import OverlaysTab from './OverlaysTab'
import TransactionsTab from './TransactionsTab'
import HistoryTab from './HistoryTab'
import BasketTab from './BasketTab'

function Dashboard() {
    const [activeTab, setActiveTab] = useState<'overlays' | 'transactions' | 'history' | 'basket'>('overlays')
  
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
                className={`nav-button ${activeTab === 'transactions' ? 'active' : ''}`}
                onClick={() => setActiveTab('transactions')}
              >
                🤝 Transactions
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
          {activeTab === 'transactions' && <TransactionsTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'basket' && <BasketTab />}
        </div>
      </div>
    )
  }
  

export default Dashboard
