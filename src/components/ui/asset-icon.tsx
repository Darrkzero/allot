import { CHAIN_LOGOS } from "@/lib/logos/chains";
import { TOKEN_LOGOS, logoDataUri, type LogoToken } from "@/lib/logos/tokens";

const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// A token on its own home chain needs no badge (BTC on Bitcoin, SOL on Solana…).
const HOME: Record<string, string> = { BTC: "btc", SOL: "sol", ZEC: "zec", ETH: "eth", NEAR: "near", TON: "ton", TRX: "tron", BNB: "bsc" };

/** Token logo with a small network badge, e.g. USDC with a Base badge. Decorative: the text next to it names the asset. */
export function AssetIcon({ symbol, chain, size = 28, className = "" }: { symbol: string; chain: string; size?: number; className?: string }) {
  const token = symbol in TOKEN_LOGOS ? logoDataUri(symbol as LogoToken) : null;
  const chainSvg = HOME[symbol] === chain ? null : CHAIN_LOGOS[chain];
  const badge = Math.round(size * 0.56);

  return (
    <span aria-hidden className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#171a22] ring-1 ring-white/10">
        {token ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token} alt="" width={size} height={size} className="h-[112%] w-[112%] max-w-none" />
        ) : (
          <span className="text-[10px] font-bold text-white/70">{symbol.slice(0, 3)}</span>
        )}
      </span>
      {chainSvg && (
        <span
          className="absolute grid place-items-center rounded-full bg-[#0b0d12] ring-2 ring-[#0b0d12]"
          style={{ width: badge, height: badge, right: -badge * 0.22, bottom: -badge * 0.18 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgUri(chainSvg)} alt="" width={badge} height={badge} className="h-full w-full" />
        </span>
      )}
    </span>
  );
}
