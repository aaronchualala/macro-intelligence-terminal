"use client";

import { useEffect, useRef } from "react";

export function TradingViewTape() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || ref.current.dataset.loaded) return;
    ref.current.dataset.loaded = "true";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "FOREXCOM:SPXUSD", title: "SPX" },
        { proName: "NASDAQ:NDX", title: "NDX" },
        { proName: "TVC:US02Y", title: "US2Y" },
        { proName: "TVC:US10Y", title: "US10Y" },
        { proName: "TVC:DXY", title: "DXY" },
        { proName: "NYMEX:CL1!", title: "WTI" },
        { proName: "TVC:GOLD", title: "Gold" },
        { proName: "BITSTAMP:BTCUSD", title: "BTC" }
      ],
      showSymbolLogo: false,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "regular",
      locale: "en"
    });
    ref.current.appendChild(script);
  }, []);

  return (
    <div className="h-11 overflow-hidden border-y border-neutral-900 bg-black">
      <div ref={ref} className="tradingview-widget-container h-full">
        <div className="tradingview-widget-container__widget h-full" />
      </div>
    </div>
  );
}
