import { useState } from "react";
import { PlusCircle, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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

interface MarketCreatorProps {
  onCreateMarket: (market: Omit<Market, 'id'>) => void;
}

export const MarketCreator = ({ onCreateMarket }: MarketCreatorProps) => {
  const [title, setTitle] = useState('');
  const [outcomeA, setOutcomeA] = useState('Yes');
  const [outcomeB, setOutcomeB] = useState('No');
  const [durationDays, setDurationDays] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !outcomeA || !outcomeB || durationDays < 1) {
      setMessage('Error: Please fill all fields correctly.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const marketData = {
        title,
        outcomeA,
        outcomeB,
        priceA: 0.50,
        priceB: 0.50,
        volume: 0,
        endTime: new Date(Date.now() + durationDays * 86400000).toISOString(),
        status: 'Active',
      };

      onCreateMarket(marketData);
      setMessage('✅ Market successfully created!');
      setTitle('');
      setOutcomeA('Yes');
      setOutcomeB('No');
      setDurationDays(7);

    } catch (error) {
      console.error("Error creating market:", error);
      setMessage('❌ Failed to create market.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="p-6 bg-card rounded-xl shadow-lg">
      <h3 className="text-xl font-bold text-foreground mb-4 flex items-center">
        <PlusCircle className="w-5 h-5 text-secondary mr-2" />
        Create Permissionless Market
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Be the first to create a unique market for others to bet on.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          placeholder="Market Question (e.g., Will SOL hit $200 by Dec?)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="text"
            placeholder="Outcome A (e.g., Yes)"
            value={outcomeA}
            onChange={(e) => setOutcomeA(e.target.value)}
            required
          />
          <Input
            type="text"
            placeholder="Outcome B (e.g., No)"
            value={outcomeB}
            onChange={(e) => setOutcomeB(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Duration (Days)
          </label>
          <Input
            type="number"
            min="1"
            max="365"
            value={durationDays}
            onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-secondary shadow-purple"
          size="lg"
        >
          {isLoading ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-secondary-foreground border-t-transparent rounded-full" />
              Creating...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Create Market
            </>
          )}
        </Button>
        {message && (
          <p className={`text-center text-sm font-semibold ${message.startsWith('✅') ? 'text-success' : 'text-destructive'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
};
