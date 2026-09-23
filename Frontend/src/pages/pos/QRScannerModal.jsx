import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scannerContainerId = "pos-html5-qr-reader";

  useEffect(() => {
    if (!isOpen) {
      if (html5QrCodeRef.current && isScanning) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current.clear();
            setIsScanning(false);
          })
          .catch((err) => console.warn("Error stopping scanner on modal close:", err));
      }
      return;
    }

    setCameraError(null);
    let isMounted = true;

    // Small delay to ensure DOM element exists
    const timer = setTimeout(async () => {
      try {
        const qrCodeInstance = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = qrCodeInstance;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await qrCodeInstance.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (isMounted) {
              // Play a cheerful beep sound via Web Audio API
              try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
              } catch (_) {
                // AudioContext not allowed or unsupported
              }

              onScanSuccess(decodedText);
            }
          },
          () => {
            // Frame parse error - ignore standard noise
          }
        );

        if (isMounted) {
          setIsScanning(true);
        }
      } catch (err) {
        console.error("Camera start failed:", err);
        if (isMounted) {
          setCameraError(
            err?.name === "NotAllowedError"
              ? "Camera permission was denied. Please allow camera access in your browser."
              : "Unable to access camera or no camera found on this device."
          );
          setIsScanning(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current?.clear();
            setIsScanning(false);
          })
          .catch(() => {});
      }
    };
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in-up">
      <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Live Product Scanner</h3>
              <p className="text-xs text-slate-500">Scan product QR code or Barcode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
            title="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-full aspect-square max-w-[320px] rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center border-2 border-dashed border-blue-400 shadow-inner">
            <div id={scannerContainerId} className="w-full h-full" />

            {/* Target Reticle Overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-lg relative">
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></span>
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></span>
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></span>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></span>
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div>
              </div>
            </div>
          </div>

          {cameraError ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-left text-xs text-red-700 border border-red-200 w-full">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold">Camera Access Issue</p>
                <p>{cameraError}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Auto-adds product to billing cart upon scan</span>
              </div>
              <p className="text-xs text-slate-500">
                Point your camera at the QR code displayed on screen or product sticker
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}

QRScannerModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScanSuccess: PropTypes.func.isRequired,
};
