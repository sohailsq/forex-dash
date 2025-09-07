import { useState, ReactNode } from 'react'

type Tab = {
  id: string
  label: string

  content: ReactNode
}

type Props = {
  tabs: Tab[]
  defaultTab?: string
}

export function Tabs({ tabs, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {/* <span className="tab-icon">{tab.icon}</span> */}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      
      <div className="tab-content">
        {activeTabContent}
      </div>
    </div>
  )
}
