import { useState, useEffect, useMemo } from "react";
import { Lock, Zap, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "@/integrations/supabase/client";

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

interface BettingPanelProps {
  market: Market | null;
}

const toPercent = (num: number) => `${Math.round(num * 100)}%`;
const formatSOL = (amount: number) => (amount / 1000).toFixed(1) + 'k SOL';

export const BettingPanel = ({ market }: BettingPanelProps) => {
  const [betAmount, setBetAmount] = useState(10);
  const [selectedOutcome, setSelectedOutcome] = useState<'A' | 'B'>('A');
  const [isBetting, setIsBetting] = useState(false);
  const [betMessage, setBetMessage] = useState('');

  useEffect(() => {
    if (betMessage) {
      const timer = setTimeout(() => setBetMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [betMessage]);

  const handleBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (betAmount < 1) {
      setBetMessage('Minimum bet is 1 SOL.');
      return;
    }

    if (!market) return;

    setIsBetting(true);
    setBetMessage(`Placing ${betAmount} SOL bet on Outcome ${selectedOutcome}...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('place-bet', {
        body: {
          marketId: market.id,
          outcome: selectedOutcome,
          amount: betAmount,
        },
      });

      if (error) throw error;

      setIsBetting(false);
      if (data?.success) {
        setBetMessage(`✅ Bet confirmed! ${betAmount} SOL on Outcome ${selectedOutcome}. New balance: ${data.newBalance.toFixed(2)} SOL`);
        // Trigger a re-fetch of user balance in parent component
        window.dispatchEvent(new CustomEvent('balance-updated'));
      } else {
        setBetMessage('❌ Bet failed. Please try again.');
      }
    } catch (error: any) {
      setIsBetting(false);
      console.error('Bet error:', error);
      setBetMessage(`❌ ${error.message || 'Failed to place bet'}`);
    }
  };

  const impliedReturn = useMemo(() => {
    if (!market) return '0.00';
    const price = selectedOutcome === 'A' ? market.priceA : market.priceB;
    const grossPayout = betAmount * (1 / price);
    return grossPayout.toFixed(2);
  }, [betAmount, selectedOutcome, market]);

  if (!market) {
    return (
      <div className="p-8 bg-card rounded-xl h-full flex flex-col justify-center items-center text-center">
        <Lock className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-xl font-bold text-foreground">Select a Market</h2>
        <p className="text-muted-foreground mt-2">
          Choose a live market to place your confidential opinion.
        </p>
        <p className="text-xs mt-4 text-muted-foreground">
          All settlements are resolved using Arcium's MPC Quorum for verifiable privacy.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card rounded-xl shadow-lg h-full flex flex-col">
      <h2 className="text-2xl font-extrabold text-primary mb-4">{market.title}</h2>
      
      <div className="flex justify-between items-center text-sm mb-4 border-b border-border pb-3">
        <div className="flex items-center">
          <Zap className="w-4 h-4 text-warning mr-2" />
          <span className="text-muted-foreground">Total Volume:</span>
          <span className="text-foreground font-bold ml-2">{formatSOL(market.volume)}</span>
        </div>
        <div className="flex items-center">
          <Lock className="w-4 h-4 text-secondary mr-2" />
          <span className="text-muted-foreground">MPC Quorum</span>
        </div>
      </div>

      <form onSubmit={handleBet} className="mt-4 flex flex-col flex-grow">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedOutcome('A')}
              disabled={isBetting}
              className={`
                p-4 rounded-xl text-left transition-all duration-200 border-2
                ${selectedOutcome === 'A' ? 'bg-primary/20 border-primary' : 'bg-muted border-border hover:bg-muted/70'}
                ${isBetting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span className="text-xs uppercase font-semibold text-muted-foreground">
                Outcome A: {toPercent(market.priceA)}
              </span>
              <p className="text-foreground font-bold mt-1">{market.outcomeA}</p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedOutcome('B')}
              disabled={isBetting}
              className={`
                p-4 rounded-xl text-left transition-all duration-200 border-2
                ${selectedOutcome === 'B' ? 'bg-primary/20 border-primary' : 'bg-muted border-border hover:bg-muted/70'}
                ${isBetting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span className="text-xs uppercase font-semibold text-muted-foreground">
                Outcome B: {toPercent(market.priceB)}
              </span>
              <p className="text-foreground font-bold mt-1">{market.outcomeB}</p>
            </button>
          </div>

          <div>
            <label htmlFor="betAmount" className="block text-sm font-medium text-muted-foreground mb-2">
              Stake Amount (SOL)
            </label>
            <Input
              id="betAmount"
              type="number"
              min="1"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(1, parseFloat(e.target.value)))}
              className="w-full"
              required
            />
          </div>

          <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
            <p className="text-sm font-medium text-muted-foreground">Est. Payout (If Correct):</p>
            <p className="text-lg font-extrabold text-primary">{impliedReturn} SOL</p>
          </div>
        </div>
        
        <Button
          type="submit"
          disabled={isBetting}
          className="mt-6 w-full shadow-glow"
          size="lg"
        >
          {isBetting ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
              Processing...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Place Confidential Opinion
            </>
          )}
        </Button>
        
        {betMessage && (
          <p className={`mt-3 text-center text-sm font-semibold ${betMessage.startsWith('✅') ? 'text-success' : 'text-destructive'}`}>
            {betMessage}
          </p>
        )}
      </form>
    </div>
  );
};
