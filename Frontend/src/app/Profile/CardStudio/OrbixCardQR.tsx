import React, { useState, useEffect } from "react";
import QRCode from "qrcode";

interface OrbixCardQRProps {
    value: string;
    size?: number;
    className?: string;
    showLogo?: boolean;
}

export const OrbixCardQR: React.FC<OrbixCardQRProps> = ({
    value,
    size = 240,
    className = "",
    showLogo = true,
}) => {
    const [qrDataUrl, setQrDataUrl] = useState<string>("");

    useEffect(() => {
        let isMounted = true;
        if (!value) return;

        QRCode.toDataURL(value, {
            errorCorrectionLevel: "H", // High error correction allows center logo without losing scanability
            margin: 2,
            width: size * 2, // High DPI rendering
            color: {
                dark: "#0a0d12",
                light: "#ffffff",
            },
        })
            .then((url) => {
                if (isMounted) setQrDataUrl(url);
            })
            .catch((err) => {
                console.error("Failed to generate QR code", err);
            });

        return () => {
            isMounted = false;
        };
    }, [value, size]);

    const centerLogoSize = Math.round(size * 0.22);

    return (
        <div
            className={`relative flex items-center justify-center rounded-2xl sm:rounded-3xl bg-white p-3 sm:p-4 shadow-xl border border-neutral-100 ${className}`}
            style={{ width: size, height: size }}
        >
            {qrDataUrl ? (
                <img
                    src={qrDataUrl}
                    alt="Scan Orbix Profile QR Code"
                    className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                    crossOrigin="anonymous"
                />
            ) : (
                <div className="w-full h-full bg-neutral-100 rounded-xl animate-pulse flex items-center justify-center text-neutral-400 text-xs">
                    Generating QR...
                </div>
            )}

            {/* Centered Orbix Brand Emblem */}
            {showLogo && qrDataUrl && (
                <div
                    className="absolute inset-0 m-auto rounded-xl bg-black border-2 border-white shadow-md flex items-center justify-center z-10"
                    style={{
                        width: centerLogoSize,
                        height: centerLogoSize,
                    }}
                >
                    <svg
                        className="w-3/5 h-3/5 text-white"
                        viewBox="0 0 271 270"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                        <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                        <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                    </svg>
                </div>
            )}
        </div>
    );
};
