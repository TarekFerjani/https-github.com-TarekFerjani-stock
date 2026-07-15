import React, { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScan: (scannedCode: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
      }
    };
    
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSimulateScan = () => {
    // Simulate a scan with a random EAN-13 barcode
    const randomBarcode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    onScan(randomBarcode);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">Scanner un Code-barres</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md bg-gray-900"></video>
          )}
        </div>
        <div className="p-4 bg-gray-50 rounded-b-lg flex flex-col items-center space-y-2">
            <p className="text-sm text-gray-600">Pointez la caméra vers un code-barres.</p>
            <button
              onClick={handleSimulateScan}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Simuler la détection
            </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;