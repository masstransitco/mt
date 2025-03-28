"use client"

import { useState, useCallback } from "react"
import Head from "next/head"
import dynamic from "next/dynamic"
import { SideButtonsPanel } from "@/components/DraggableHeader"
import SideSheet from "@/components/ui/SideSheet"

// Dynamically import with no SSR
const GMapWithErrorBoundary = dynamic(() => import("@/components/GMap"), {
  ssr: false,
})
const AppMenu = dynamic(() => import("@/components/ui/AppMenu"), {
  ssr: false,
})
const QrScannerOverlay = dynamic(() => import("@/components/ui/QrScannerOverlay"), {
  ssr: false,
})
const WalletModal = dynamic(() => import("@/components/ui/WalletModal"), {
  ssr: false,
})
const SignInModal = dynamic(() => import("@/components/ui/SignInModal"), {
  ssr: false,
})
const LicenseModal = dynamic(() => import("@/components/ui/LicenseModal"), {
  ssr: false,
})

export default function Page() {
  // Modal states at the page level
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)

  // Add states for menu and scanner
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev)
  }, [])

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      {/* Make main take full viewport height */}
      <main className="h-screen w-full overflow-hidden relative">
        {/* GMap takes full size of main */}
        <div className="absolute inset-0">
          <GMapWithErrorBoundary googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""} />
        </div>

        {/* Header overlaps the map */}
        <SideButtonsPanel onToggleMenu={toggleMenu} onScannerOpen={() => setIsScannerOpen(true)} />

        {/* Side Sheet Menu */}
        <SideSheet isOpen={isMenuOpen} onClose={handleMenuClose} size="full">
          <AppMenu
            onClose={handleMenuClose}
            onOpenWallet={() => setShowWalletModal(true)}
            onOpenSignIn={() => setShowSignInModal(true)}
            onOpenLicense={() => setShowLicenseModal(true)}
          />
        </SideSheet>

        {/* QR Scanner Overlay */}
        {isScannerOpen && <QrScannerOverlay isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />}

        {/* Modals */}
        <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />

        <SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} />

        <LicenseModal isOpen={showLicenseModal} onClose={() => setShowLicenseModal(false)} />
      </main>
    </>
  )
}

