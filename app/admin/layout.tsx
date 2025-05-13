import React, { ReactNode } from "react"
import "../../src/styles/globals.css"

interface RootLayoutProps {
  children: ReactNode
}

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <>
      <div className="admin-layout">
        <div className="admin-container">{children}</div>
      </div>
    </>
  )
}

export default RootLayout
