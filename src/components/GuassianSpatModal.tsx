import React from "react";

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Renders a fullscreen modal with a Polycam embed iframe.
 * The iframe is sized to 110% of viewport (both width and height)
 * so there's a bit of overfill, and no black bars.
 */
const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        zIndex: 9999,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1001,
          padding: "8px 16px",
          background: "rgba(255, 255, 255, 0.1)",
          color: "#fff",
          border: "1px solid #fff",
          cursor: "pointer",
        }}
      >
        Close
      </button>

      {/* Wrapper to hold the iframe, positioned absolutely so we can scale it */}
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <iframe
          src="https://poly.cam/capture/cd2ecc58-8716-44b8-9b1c-d0599c4ffa1f/embed"
          title="polycam capture viewer"
          style={{
            position: "absolute",
            // Scale to 110%: We set width/height to 110% of viewport
            width: "110vw",
            height: "110vh",
            // shift it left/top by 5% so it's centered in the modal
            left: "-5vw",
            top: "-5vh",
            border: "none",
          }}
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default GaussianSplatModal;
