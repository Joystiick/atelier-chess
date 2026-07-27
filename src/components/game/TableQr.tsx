"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

type TableQrProps = {
  url: string;
  size?: number;
  label?: string;
};

export function TableQr({ url, size = 200, label }: TableQrProps) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: { dark: "#0c1610", light: "#e8efe6" },
    }).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl bg-[var(--cream)] p-3 shadow-lg ring-1 ring-[var(--brass-dim)]">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Join table QR code" width={size} height={size} />
        ) : (
          <div
            className="animate-pulse bg-black/10"
            style={{ width: size, height: size }}
          />
        )}
      </div>
      {label && <p className="text-center text-xs text-[var(--mist)]">{label}</p>}
    </div>
  );
}
