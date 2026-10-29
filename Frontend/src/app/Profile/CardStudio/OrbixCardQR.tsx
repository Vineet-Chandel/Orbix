import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { OrbixLogo } from "../../../components/OrbixLogo";

interface OrbixCardQRProps {
    value: string;
    size?: number;
    className?: string;
    showLogo?: boolean;
}

const qrCache = new Map<string, string>();

export const OrbixCardQR: React.FC<OrbixCardQRProps> = React.memo(({
    value,
    size = 240,
    className = "",
    showLogo = true,
}) => {
    const cacheKey = `${value}_${size}`;
    const [qrDataUrl, setQrDataUrl] = useState<string>(() => qrCache.get(cacheKey) || "");

    useEffect(() => {
        if (!value) return;
        if (qrCache.has(cacheKey)) {
            setQrDataUrl(qrCache.get(cacheKey)!);
            return;
        }

        let isMounted = true;

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
                qrCache.set(cacheKey, url);
                if (isMounted) setQrDataUrl(url);
            })
            .catch((err) => {
                console.error("Failed to generate QR code", err);
            });

        return () => {
            isMounted = false;
        };
    }, [value, size, cacheKey]);

    const centerLogoSize = Math.round(size * 0.15);

    return (
        <div
            className={`relative flex items-center justify-center rounded-2xl sm:rounded-3xl bg-white p-2 sm:p-3 shadow-xl border border-neutral-100 ${className}`}
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
                    className="absolute inset-0 m-auto  bg-white p-1 shadow-md flex items-center justify-center z-10"
                    style={{
                        width: centerLogoSize,
                        height: centerLogoSize,
                    }}
                >

                    <OrbixLogo className="w-full h-full text-black" color="black" strokeColor="black" />


                </div>
            )}
        </div>
    );
});
