import { TrendingUp, Clock } from "lucide-react";

interface Market {
  id: string;
  title: string;
  outcomeA: string;
  outcomeB: string;
  priceA: number;
  priceB: number;
  volume: number;
  endTime: string;
  status: string;
}

interface MarketCardProps {
  market: Market;
  onSelect: (market: Market) => void;
  selected?: Market | null;
}

const toPercent = (num: number) => `${Math.round(num * 100)}%`;
const formatSOL = (amount: number) => (amount / 1000).toFixed(1) + 'k SOL';

export const MarketCard = ({ market, onSelect, selected }: MarketCardProps) => {
  const isSelected = market.id === selected?.id;
  const priceA = toPercent(market.priceA);
  const priceB = toPercent(market.priceB);
  const priceDiff = market.priceA - market.priceB;
  const isTrendingUp = priceDiff > 0;

  return (
    <div
      onClick={() => onSelect(market)}
      className={`
        bg-card p-4 rounded-xl shadow-lg cursor-pointer transition-all duration-300
        hover:shadow-glow hover:border-primary/50 relative border-2
        ${isSelected ? 'border-primary shadow-glow' : 'border-border'}
        h-full flex flex-col
      `}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center">
          <TrendingUp className="w-3 h-3 mr-1 text-info" />
          Live Market
        </span>
        <span className="text-xs text-primary font-mono">
          {formatSOL(market.volume)}
        </span>
      </div>
      <h3 className="text-lg font-bold text-foreground mb-3 flex-grow">{market.title}</h3>

      <div className="flex space-x-2 text-sm font-semibold mb-2">
        <div className={`flex-1 p-2 rounded-lg transition-colors ${isTrendingUp ? 'bg-success/20' : 'bg-destructive/20'}`}>
          <p className="text-muted-foreground text-xs">Outcome A:</p>
          <p className="text-foreground text-xl">{priceA}</p>
        </div>
        <div className={`flex-1 p-2 rounded-lg transition-colors ${!isTrendingUp ? 'bg-success/20' : 'bg-destructive/20'}`}>
          <p className="text-muted-foreground text-xs">Outcome B:</p>
          <p className="text-foreground text-xl">{priceB}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center text-xs text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" />
        Closes: {new Date(market.endTime).toLocaleDateString()}
      </div>
    </div>
  );
};
