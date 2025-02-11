import React, { useEffect, useRef } from 'react';
import { Viewer } from 'gle-gaussian-splat-3d';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPLAT_FILE_PATH = 'icc.ply';

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (isOpen && containerRef.current && !viewerRef.current) {
      const containerEl = containerRef.current;

      const initViewer = async () => {
        try {
          // Initialize viewer with documented parameters [1][4][6]
          const viewer = new Viewer({
            gpuAcceleratedSort: true,
            useBuiltInControls: true,
            backgroundColor: [0.08, 0.08, 0.08], // Equivalent to THREE.Color(0x151515)
            initialCameraPosition: [0, 1.5, 4],
            initialCameraLookAt: [0, 0, 0],
            cameraUp: [0, 1, 0]
          });

          viewerRef.current = viewer;
          
          // Required initialization before DOM operations [6]
          viewer.init();
          containerEl.appendChild(viewer.domElement);

          try {
            const storage = getStorage();
            const fileRef = ref(storage, SPLAT_FILE_PATH);
            const signedUrl = await getDownloadURL(fileRef);
            const proxyUrl = `/api/splat?url=${encodeURIComponent(signedUrl)}`;

            // Load file using validated method [1][4]
            await viewer.loadFile(proxyUrl, {
              splatAlphaRemovalThreshold: 7,
              halfPrecisionCovariancesOnGPU: true,
              position: [0, -0.5, 0],
              rotation: [-Math.PI / 2, 0, 0]
            });

            viewer.start();
          } catch (error) {
            console.error('Error loading splat:', error);
            onClose();
          }

          // Handle window resizing via viewer API [6]
          const onResize = () => {
            viewer.setSize(
              containerEl.clientWidth,
              containerEl.clientHeight
            );
          };

          window.addEventListener('resize', onResize);
          onResize();

          return () => {
            window.removeEventListener('resize', onResize);
          };
        } catch (error) {
          console.error('Failed to initialize viewer:', error);
          onClose();
        }
      };

      initViewer();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-85 flex justify-center items-center">
      <div className="relative w-[95vw] h-[95vh] bg-black rounded-xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 bg-white bg-opacity-15 hover:bg-opacity-25 
                   text-white rounded-full cursor-pointer z-10 transition-colors duration-200"
          aria-label="Close"
        >
          ×
        </button>
        <div
          ref={containerRef}
          className="w-full h-full touch-none"
        />
      </div>
    </div>
  );
};

export default GaussianSplatModal;
